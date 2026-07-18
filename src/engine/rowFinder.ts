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
        private makeSmartRow: (loc: Locator, map: Map<string, number>, index: number | undefined, tablePageIndex?: number, barrier?: NavigationBarrier) => SmartRow<T>,
        private tableState: { currentPageIndex: number } = { currentPageIndex: 0 },
        private advancePage: (useBulk: boolean) => Promise<boolean> = async () => false
    ) {
        this.resolve = resolve;
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
            const rowIndex = await this.resolveRowIndex(rowLocator);
            return this.makeSmartRow(rowLocator, map, rowIndex, this.tableState.currentPageIndex);
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
            const collectMatches = async () => {
                let rowLocators = this.resolve(this.config.rowSelector, this.rootLocator);
                // Only apply filters if we have them
                if (Object.keys(filtersRecord).length > 0) {
                    rowLocators = this.filterEngine.applyFilters(
                        rowLocators,
                        filtersRecord,
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
                    const rowIndex = await resolveLogicalRowIndex(
                        currentRows[idx],
                        this.config,
                        () => allRows.length,
                    );
                    const smartRow = this.makeSmartRow(currentRows[idx], map, rowIndex, this.tableState.currentPageIndex, barrier);

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
                    logDebug(this.config, 'verbose',`findRows: pagination returned false — end of data`);
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
            const matchedRows = this.filterEngine.applyFilters(
                allRows,
                filters,
                map,
                options.exact || false,
                this.rootLocator.page(),
                this.rootLocator
            );

            const count = await matchedRows.count();
            logDebug(this.config, 'verbose',`Page ${this.tableState.currentPageIndex}: Found ${count} matches.`);

            if (count > 1) {
                const sampleData: string[] = [];
                try {
                    const firstFewRows = await matchedRows.all();
                    const sampleCount = Math.min(firstFewRows.length, 3);
                    for (let i = 0; i < sampleCount; i++) {
                        const rowData = await this.makeSmartRow(firstFewRows[i], map, 0, this.tableState.currentPageIndex).toJSON();
                        sampleData.push(JSON.stringify(rowData));
                    }
                } catch (e) { }
                const sampleMsg = sampleData.length > 0 ? `\nSample matching rows:\n${sampleData.map((d, i) => `  ${i + 1}. ${d}`).join('\n')}` : '';

                throw new Error(
                    `Ambiguous Row: Found ${count} rows matching ${JSON.stringify(filters)} on page ${this.tableState.currentPageIndex}. ` +
                    `Expected exactly one match. Try adding more filters to make your query unique.${sampleMsg}`
                );
            }

            if (count === 1) return matchedRows.first();

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
                    logDebug(this.config, 'verbose',`Page ${this.tableState.currentPageIndex}: Pagination failed (end of data).`);
                }
            }
            return null;
        }
    }

    private resolveRowIndex(rowLocator: Locator): Promise<number | undefined> {
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
