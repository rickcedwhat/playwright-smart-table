import type { Locator, Page } from '@playwright/test';
import { FinalTableConfig, TableContext, Selector, SmartRow, FilterValue, PaginationPrimitives } from '../types';
import { FilterEngine } from '../filterEngine';
import { TableMapper } from './tableMapper';
import { logDebug, debugDelay } from '../utils/debugUtils';
import { createSmartRowArray, SmartRowArray } from '../utils/smartRowArray';
import { validatePaginationResult } from '../strategies/validation';
import { ElementTracker } from '../utils/elementTracker';
import { SENTINEL_ROW } from '../utils/sentinel';

export class RowFinder<T = any> {
    private resolve: (item: Selector, parent: Locator | Page) => Locator;

    constructor(
        private rootLocator: Locator,
        private config: FinalTableConfig,
        resolve: (item: Selector, parent: Locator | Page) => Locator,
        private filterEngine: FilterEngine,
        private tableMapper: TableMapper,
        private makeSmartRow: (loc: Locator, map: Map<string, number>, index: number | undefined, tablePageIndex?: number) => SmartRow<T>,
        private tableState: { currentPageIndex: number } = { currentPageIndex: 0 }
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
        const smartRow = this.makeSmartRow(sentinel, await this.tableMapper.getMap(), 0);
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
                const isRowLoading = this.config.strategies.loading?.isRowLoading;
                const rawRowTimeout = this.config.strategies.loading?.rowLoadingTimeout;
                // undefined = unset (legacy skip); 0 = no wait (immediate check); >0 = wait up to N ms
                // Non-finite values are treated as unset (defensive guard against Infinity/NaN)
                const rowLoadingTimeout = rawRowTimeout !== undefined && Number.isFinite(rawRowTimeout) && rawRowTimeout >= 0
                    ? rawRowTimeout
                    : undefined;
                const onRowLoadingTimeout = this.config.strategies.loading?.onRowLoadingTimeout ?? 'read-as-is';
                let added = 0;

                for (const idx of newIndices) {
                    const smartRow = this.makeSmartRow(currentRows[idx], map, idx, this.tableState.currentPageIndex);

                    if (isRowLoading && await isRowLoading(smartRow)) {
                        if (rowLoadingTimeout === undefined) {
                            // No timeout configured (or invalid value) — legacy skip behavior
                            logDebug(this.config, 'verbose', `findRows: page ${this.tableState.currentPageIndex} — row skipped (isRowLoading=true, no timeout)`);
                            continue;
                        }

                        // Wait up to rowLoadingTimeout ms (0 = one immediate re-check, no polling)
                        logDebug(this.config, 'verbose', `findRows: row ${idx} — waiting up to ${rowLoadingTimeout}ms for row to load`);
                        const deadline = Date.now() + rowLoadingTimeout;
                        let resolved = !(await isRowLoading(smartRow)); // immediate check (handles timeout=0)
                        while (!resolved && Date.now() < deadline) {
                            await currentRows[idx].page().waitForTimeout(100);
                            resolved = !(await isRowLoading(smartRow));
                        }

                        if (!resolved) {
                            logDebug(this.config, 'verbose', `findRows: row ${idx} — still loading after ${rowLoadingTimeout}ms, action: ${onRowLoadingTimeout}`);
                            if (onRowLoadingTimeout === 'skip') continue;
                            if (onRowLoadingTimeout === 'throw') {
                                throw new Error(`[SmartTable] Row ${idx} did not finish loading within ${rowLoadingTimeout}ms`);
                            }
                            // 'read-as-is': fall through and add the row
                        } else {
                            logDebug(this.config, 'verbose', `findRows: row ${idx} — finished loading`);
                        }
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
                const context: TableContext = {
                    root: this.rootLocator,
                    config: this.config,
                    resolve: this.resolve,
                    page: this.rootLocator.page()
                };

                let paginationResult: boolean | number | PaginationPrimitives | undefined;
                const useBulk = options?.useBulkPagination !== false && !!this.config.strategies.pagination?.goNextBulk;
                if (useBulk) {
                    paginationResult = await this.config.strategies.pagination.goNextBulk!(context);
                } else if (this.config.strategies.pagination?.goNext) {
                    paginationResult = await this.config.strategies.pagination.goNext(context);
                } else {
                    logDebug(this.config, 'verbose',`findRows: no pagination primitive — stopping`);
                    break;
                }

                const didPaginate = validatePaginationResult(paginationResult, 'Pagination Strategy');
                if (!didPaginate) {
                    logDebug(this.config, 'verbose',`findRows: pagination returned false — end of data`);
                    break;
                }

                const pagesJumped = typeof paginationResult === 'number' ? paginationResult : 1;
                this.tableState.currentPageIndex += pagesJumped;
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
                const context: TableContext = {
                    root: this.rootLocator,
                    config: this.config,
                    resolve: this.resolve,
                    page: this.rootLocator.page()
                };

                let paginationResult: boolean | number | PaginationPrimitives | undefined;
                const pagination = this.config.strategies.pagination;
                const useBulk = options.useBulkPagination !== false && !!pagination?.goNextBulk;
                if (useBulk && pagination?.goNextBulk) {
                    paginationResult = await pagination.goNextBulk(context);
                } else if (pagination?.goNext) {
                    paginationResult = await pagination.goNext(context);
                } else {
                    logDebug(this.config, 'verbose',`Page ${this.tableState.currentPageIndex}: Pagination failed (no goNext or goNextBulk primitive).`);
                    return null;
                }

                const didLoadMore = validatePaginationResult(paginationResult, 'Pagination Strategy');

                if (didLoadMore) {
                    const pagesJumped = typeof paginationResult === 'number' ? paginationResult : 1;
                    this.tableState.currentPageIndex += pagesJumped;
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

    private async resolveRowIndex(rowLocator: Locator): Promise<number | undefined> {
        const allRows = await this.resolve(this.config.rowSelector, this.rootLocator).all();
        const targetHandle = await rowLocator.elementHandle();
        if (!targetHandle) return undefined;
        for (let i = 0; i < allRows.length; i++) {
            const handle = await allRows[i].elementHandle();
            if (handle && await handle.evaluate((el, t) => el === t, targetHandle)) {
                return i;
            }
        }
        return undefined;
    }
}
