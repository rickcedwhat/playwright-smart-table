import type { Locator, Page } from '@playwright/test';
import { FinalTableConfig, Selector, SmartRow, FilterValue } from '../types';
import { FilterEngine } from '../filterEngine';
import { TableMapper } from './tableMapper';
import { logDebug, debugDelay } from '../utils/debugUtils';
import { createSmartRowArray, SmartRowArray } from '../utils/smartRowArray';
import { ElementTracker } from '../utils/elementTracker';
import { SENTINEL_ROW } from '../utils/sentinel';
import { NavigationBarrier } from '../utils/navigationBarrier';
import { resolveLogicalRowIndex, resolveRowLoading } from './rowResolution';

export class RowFinder<T = any> {
    private resolve: (item: Selector, parent: Locator | Page) => Locator;

    constructor(
        private rootLocator: Locator,
        private config: FinalTableConfig,
        resolve: (item: Selector, parent: Locator | Page) => Locator,
        private filterEngine: FilterEngine,
        private tableMapper: TableMapper,
        private makeSmartRow: (loc: Locator, map: Map<string, number>, index: number | undefined, tablePageIndex?: number, barrier?: NavigationBarrier, rowSelector?: string) => SmartRow<T>,
        private tableState: { currentPageIndex: number } = { currentPageIndex: 0 },
        private advancePage: (useBulk: boolean) => Promise<boolean> = async () => false
    ) {
        this.resolve = resolve;
    }

    private splitFilters(filters: Record<string, FilterValue>): {
        domFilters: Record<string, FilterValue>;
        overrideFilters: Record<string, FilterValue>;
        syntheticFilters: Record<string, FilterValue>;
    } {
        const domFilters: Record<string, FilterValue> = {};
        const overrideFilters: Record<string, FilterValue> = {};
        const syntheticFilters: Record<string, FilterValue> = {};
        for (const [key, value] of Object.entries(filters)) {
            if (this.config.syntheticColumns?.[key]) {
                syntheticFilters[key] = value;
            } else if (this.config.columnOverrides?.[key as keyof T]?.read) {
                overrideFilters[key] = value;
            } else {
                domFilters[key] = value;
            }
        }
        return { domFilters, overrideFilters, syntheticFilters };
    }

    static matchReadValue(readValue: string, filterValue: FilterValue, exact: boolean): boolean {
        if (typeof filterValue === 'function') {
            throw new Error(
                `[SmartTable] Function filters are not supported for columns with columnOverrides.read. ` +
                `Use a string, number, or RegExp filter instead.`
            );
        }
        if (typeof filterValue === 'string' || typeof filterValue === 'number') {
            const target = String(filterValue);
            return exact ? readValue === target : readValue.includes(target);
        }
        if (filterValue instanceof RegExp) {
            return filterValue.test(readValue);
        }
        return true;
    }

    private async matchesOverrideFilters(
        rowLocator: Locator,
        overrideFilters: Record<string, FilterValue>,
        map: Map<string, number>,
        exact: boolean
    ): Promise<boolean> {
        for (const [colName, filterValue] of Object.entries(overrideFilters)) {
            const colIndex = map.get(colName);
            if (colIndex === undefined) continue;
            const override = this.config.columnOverrides![colName as keyof T]!;
            const cell = this.resolve(this.config.cellSelector, rowLocator).nth(colIndex);
            const getCell = (name: string) => {
                const idx = map.get(name);
                if (idx === undefined) throw new Error(`Column "${name}" not found`);
                return this.resolve(this.config.cellSelector, rowLocator).nth(idx);
            };
            const context = {
                row: this.makeSmartRow(rowLocator, map, undefined),
                columnName: colName,
                columnIndex: colIndex,
                getCell,
            };
            const readValue = String(await override.read!(cell, context));
            if (!RowFinder.matchReadValue(readValue, filterValue, exact)) return false;
        }
        return true;
    }

    private async matchesSyntheticFilters(
        rowLocator: Locator,
        syntheticFilters: Record<string, FilterValue>,
        map: Map<string, number>,
        exact: boolean
    ): Promise<boolean> {
        const smartRow = this.makeSmartRow(rowLocator, map, undefined);
        for (const [colName, filterValue] of Object.entries(syntheticFilters)) {
            const def = this.config.syntheticColumns![colName];
            const computedValue = String(await def.compute(smartRow));
            if (!RowFinder.matchReadValue(computedValue, filterValue, exact)) return false;
        }
        return true;
    }

    public async findRow(
        filters: Record<string, FilterValue>,
        options: { exact?: boolean, maxPages?: number } = {}
    ): Promise<SmartRow<T>> {
        logDebug(this.config, 'info', 'Searching for row', filters);

        await this.tableMapper.getMap();

        const rowLocator = await this.findRowLocator(filters, options);

        if (rowLocator) {
            logDebug(this.config, 'info', 'Row found');
            await debugDelay(this.config, 'findRow');
            const map = await this.tableMapper.getMap();
            const resolved = await this.resolveRowIndex(rowLocator);
            return this.makeSmartRow(rowLocator, map, resolved?.index, this.tableState.currentPageIndex, undefined, resolved?.selector);
        }

        logDebug(this.config, 'error', 'Row not found', filters);
        await debugDelay(this.config, 'findRow');

        const sentinel = this.resolve(this.config.rowSelector, this.rootLocator)
            .filter({ hasText: "___SENTINEL_ROW_NOT_FOUND___" + Date.now() });
        const smartRow = this.makeSmartRow(sentinel, await this.tableMapper.getMap(), undefined);
        (smartRow as any)[SENTINEL_ROW] = true;
        return smartRow;
    }

    public async findRows(
        filters: Record<string, FilterValue> = {},
        options?: { exact?: boolean, maxPages?: number, useBulkPagination?: boolean }
    ): Promise<SmartRowArray<T>> {
        const filtersRecord = filters;
        const map = await this.tableMapper.getMap();
        const allRows: SmartRow<T>[] = [];
        const effectiveMaxPages = options?.maxPages ?? this.config.maxPages ?? Infinity;
        let pagesScanned = 1;

        logDebug(this.config, 'verbose',`findRows: starting (maxPages=${effectiveMaxPages}, filters=${JSON.stringify(filtersRecord)})`);

        const tracker = new ElementTracker('findRows');

        try {
            const { domFilters, overrideFilters, syntheticFilters } = this.splitFilters(filtersRecord);
            const hasOverrideFilters = Object.keys(overrideFilters).length > 0;
            const hasSyntheticFilters = Object.keys(syntheticFilters).length > 0;

            const collectMatches = async () => {
                let rowLocators = this.resolve(this.config.rowSelector, this.rootLocator);
                if (Object.keys(domFilters).length > 0) {
                    rowLocators = this.filterEngine.applyFilters(
                        rowLocators,
                        domFilters,
                        map,
                        options?.exact ?? false,
                        this.rootLocator.page(),
                        this.rootLocator
                    );
                }

                // Get only newly seen matched rows
                const newIndices = await tracker.getUnseenIndices(rowLocators);
                const currentRows = await rowLocators.all();
                let added = 0;

                // One barrier per batch — synchronizes cell navigation across all rows in this page's results
                const useBarrier = this.config.concurrency === 'synchronized' && newIndices.length > 1;
                const barrier = useBarrier ? new NavigationBarrier(newIndices.length) : undefined;

                for (const idx of newIndices) {
                    const resolved = await resolveLogicalRowIndex(
                        currentRows[idx],
                        this.config,
                        () => allRows.length,
                    );
                    const smartRow = this.makeSmartRow(currentRows[idx], map, resolved?.index, this.tableState.currentPageIndex, barrier, resolved?.selector);

                    // findRows skips a still-loading row when no timeout is configured (legacy
                    // behavior) — see resolveRowLoading's `noTimeoutAction: 'skip'`.
                    const loadingOutcome = await resolveRowLoading(
                        smartRow,
                        this.config.strategies.loading,
                        'skip',
                        (msg) => logDebug(this.config, 'verbose', `findRows: ${msg}`),
                    );
                    if (loadingOutcome !== 'process') {
                        barrier?.markFinished();
                        if (loadingOutcome === 'throw') {
                            throw new Error(`[SmartTable] Row ${allRows.length} did not finish loading within ${this.config.strategies.loading?.rowLoadingTimeout}ms`);
                        }
                        continue; // 'skip'
                    }

                    if (hasOverrideFilters && !await this.matchesOverrideFilters(currentRows[idx], overrideFilters, map, options?.exact ?? false)) {
                        barrier?.markFinished();
                        continue;
                    }

                    if (hasSyntheticFilters && !await this.matchesSyntheticFilters(currentRows[idx], syntheticFilters, map, options?.exact ?? false)) {
                        barrier?.markFinished();
                        continue;
                    }

                    allRows.push(smartRow);
                    added++;
                }
                logDebug(this.config, 'verbose',`findRows: page ${this.tableState.currentPageIndex} — ${added} new match(es) (total: ${allRows.length})`);
            };

            // Scan first page
            await collectMatches();

            // Pagination Loop
            while (pagesScanned < effectiveMaxPages && this.config.strategies.pagination) {
                // Default to single-step goNext; bulk is opt-in via useBulkPagination: true (#349).
                // Bulk-by-default made findRows jump N pages per advance and silently skip the
                // rows on intermediate pages. When only a bulk primitive exists, _advancePage
                // still falls back to it.
                const useBulk = options?.useBulkPagination === true && !!this.config.strategies.pagination?.goNextBulk;
                const prevPage = this.tableState.currentPageIndex;
                const didPaginate = await this.advancePage(useBulk);
                if (!didPaginate) {
                    logDebug(this.config, 'verbose',`findRows: pagination returned false — final scan`);
                    await collectMatches();
                    break;
                }

                const pagesJumped = this.tableState.currentPageIndex - prevPage;
                pagesScanned += pagesJumped;
                logDebug(this.config, 'verbose',`findRows: advanced ${pagesJumped} page(s), now at page ${this.tableState.currentPageIndex}`);
                await debugDelay(this.config, 'pagination');
                await collectMatches();
            }
        } finally {
            await tracker.cleanup(this.rootLocator.page());
        }

        logDebug(this.config, 'verbose',`findRows: done — ${allRows.length} row(s) collected across ${pagesScanned} page(s)`);
        return createSmartRowArray(allRows);
    }

    private async findRowLocator(
        filters: Record<string, FilterValue>,
        options: { exact?: boolean, maxPages?: number, useBulkPagination?: boolean } = {}
    ): Promise<Locator | null> {
        const map = await this.tableMapper.getMap();
        const effectiveMaxPages = options.maxPages ?? this.config.maxPages;
        let pagesScanned = 1;

        logDebug(this.config, 'verbose',`Looking for row: ${JSON.stringify(filters)} (MaxPages: ${effectiveMaxPages})`);

        while (true) {
            // Check Loading
            if (this.config.strategies.loading?.isTableLoading) {
                const isLoading = await this.config.strategies.loading.isTableLoading({
                    root: this.rootLocator,
                    config: this.config,
                    page: this.rootLocator.page(),
                    resolve: this.resolve
                });

                if (isLoading) {
                    logDebug(this.config, 'verbose','Table is loading... waiting');
                    await this.rootLocator.page().waitForTimeout(200);
                    continue;
                }
            }

            const allRows = this.resolve(this.config.rowSelector, this.rootLocator);
            const { domFilters, overrideFilters, syntheticFilters } = this.splitFilters(filters);
            const hasPostFilters = Object.keys(overrideFilters).length > 0 || Object.keys(syntheticFilters).length > 0;

            let matchedRows = allRows;
            if (Object.keys(domFilters).length > 0) {
                matchedRows = this.filterEngine.applyFilters(
                    allRows,
                    domFilters,
                    map,
                    options.exact || false,
                    this.rootLocator.page(),
                    this.rootLocator
                );
            }

            if (!hasPostFilters) {
                const count = await matchedRows.count();
                logDebug(this.config, 'verbose',`Page ${this.tableState.currentPageIndex}: Found ${count} matches.`);
                if (count > 1) await this.throwIfAmbiguous(await matchedRows.all(), filters, map);
                if (count === 1) return matchedRows.first();
            } else {
                const candidates = await matchedRows.all();
                logDebug(this.config, 'verbose',`Page ${this.tableState.currentPageIndex}: ${candidates.length} DOM candidate(s), post-filtering with override/synthetic columns`);
                const results = await Promise.all(
                    candidates.map(async c => {
                        if (Object.keys(overrideFilters).length > 0 && !await this.matchesOverrideFilters(c, overrideFilters, map, options.exact || false)) return false;
                        if (Object.keys(syntheticFilters).length > 0 && !await this.matchesSyntheticFilters(c, syntheticFilters, map, options.exact || false)) return false;
                        return true;
                    })
                );
                const postFilterMatches = candidates.filter((_, i) => results[i]);
                logDebug(this.config, 'verbose',`Page ${this.tableState.currentPageIndex}: ${postFilterMatches.length} match(es) after post-filter`);
                if (postFilterMatches.length > 1) await this.throwIfAmbiguous(postFilterMatches, filters, map);
                if (postFilterMatches.length === 1) return postFilterMatches[0];
            }

            if (pagesScanned < effectiveMaxPages) {
                logDebug(this.config, 'verbose',`Page ${this.tableState.currentPageIndex}: Not found. Attempting pagination...`);
                // Default to single-step goNext; bulk is opt-in via useBulkPagination: true (#349).
                // Bulk-by-default made findRow jump past the page holding the target row.
                const useBulk = options.useBulkPagination === true && !!this.config.strategies.pagination?.goNextBulk;
                const prevPage = this.tableState.currentPageIndex;
                const didLoadMore = await this.advancePage(useBulk);

                if (didLoadMore) {
                    const pagesJumped = this.tableState.currentPageIndex - prevPage;
                    pagesScanned += pagesJumped;
                    logDebug(this.config, 'verbose', `findRowLocator: advanced ${pagesJumped} page(s), now at page ${this.tableState.currentPageIndex}`);
                    await debugDelay(this.config, 'pagination');
                    continue;
                } else {
                    logDebug(this.config, 'verbose',`Page ${this.tableState.currentPageIndex}: pagination returned false — final scan`);
                    pagesScanned = effectiveMaxPages;
                    continue;
                }
            }
            return null;
        }
    }

    private resolveRowIndex(rowLocator: Locator) {
        // Shared resolver: resolveRowIndex strategy first, else the DOM-position fallback.
        return resolveLogicalRowIndex(rowLocator, this.config, () => this.scanDomPosition(rowLocator));
    }

    /**
     * Fallback for findRow when no resolveRowIndex strategy is configured: find the row's
     * position in the current DOM order in a SINGLE roundtrip. Previously this looped over
     * every row calling elementHandle() + evaluate() per row (O(n) CDP roundtrips, and
     * elementHandle() is soft-deprecated). We resolve the target once and let evaluateAll
     * compare it against the full row set in the browser. The row set is resolved through the
     * same selector/scope as everywhere else, so a string, function, or Locator rowSelector
     * all behave identically. (#350)
     */
    private async throwIfAmbiguous(rows: Locator[], filters: Record<string, FilterValue>, map: Map<string, number>): Promise<never> {
        const sampleData: string[] = [];
        try {
            const sampleCount = Math.min(rows.length, 3);
            for (let i = 0; i < sampleCount; i++) {
                const rowData = await this.makeSmartRow(rows[i], map, 0, this.tableState.currentPageIndex).toJSON();
                sampleData.push(JSON.stringify(rowData));
            }
        } catch (e) { }
        const sampleMsg = sampleData.length > 0 ? `\nSample matching rows:\n${sampleData.map((d, i) => `  ${i + 1}. ${d}`).join('\n')}` : '';
        throw new Error(
            `Ambiguous Row: Found ${rows.length} rows matching ${JSON.stringify(filters)} on page ${this.tableState.currentPageIndex}. ` +
            `Expected exactly one match. Try adding more filters to make your query unique.${sampleMsg}`
        );
    }

    private async scanDomPosition(rowLocator: Locator): Promise<number | undefined> {
        const targetHandle = await rowLocator.elementHandle();
        if (!targetHandle) return undefined;
        try {
            const rowsLocator = this.resolve(this.config.rowSelector, this.rootLocator);
            const index = await rowsLocator.evaluateAll(
                (rows, target) => (rows as Element[]).indexOf(target as Element),
                targetHandle
            );
            return index >= 0 ? index : undefined;
        } finally {
            await targetHandle.dispose();
        }
    }
}
