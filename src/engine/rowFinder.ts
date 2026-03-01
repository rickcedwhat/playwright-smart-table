import type { Locator, Page } from '@playwright/test';
import { FinalTableConfig, TableContext, Selector, SmartRow, FilterValue, PaginationPrimitives } from '../types';
import { FilterEngine } from '../filterEngine';
import { TableMapper } from './tableMapper';
import { logDebug, debugDelay } from '../utils/debugUtils';
import { createSmartRowArray, SmartRowArray } from '../utils/smartRowArray';
import { validatePaginationResult } from '../strategies/validation';
import { ElementTracker } from '../utils/elementTracker';

export class RowFinder<T = any> {
    private resolve: (item: Selector, parent: Locator | Page) => Locator;

    constructor(
        private rootLocator: Locator,
        private config: FinalTableConfig,
        resolve: (item: Selector, parent: Locator | Page) => Locator,
        private filterEngine: FilterEngine,
        private tableMapper: TableMapper,
        private makeSmartRow: (loc: Locator, map: Map<string, number>, index: number, tablePageIndex?: number) => SmartRow<T>,
        private tableState: { currentPageIndex: number } = { currentPageIndex: 0 }
    ) {
        this.resolve = resolve;
    }

    private log(msg: string) {
        logDebug(this.config, 'verbose', msg);
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
            return this.makeSmartRow(rowLocator, await this.tableMapper.getMap(), 0);
        }

        logDebug(this.config, 'error', 'Row not found', filters);
        await debugDelay(this.config, 'findRow');

        const sentinel = this.resolve(this.config.rowSelector, this.rootLocator)
            .filter({ hasText: "___SENTINEL_ROW_NOT_FOUND___" + Date.now() });
        const smartRow = this.makeSmartRow(sentinel, await this.tableMapper.getMap(), 0);
        (smartRow as any)._isSentinel = true;
        return smartRow;
    }

    public async findRows(
        filters?: Partial<T> | Record<string, FilterValue>,
        options?: { exact?: boolean, maxPages?: number }
    ): Promise<SmartRowArray<T>> {
        const filtersRecord = (filters as Record<string, FilterValue>) || {};
        const map = await this.tableMapper.getMap();
        const allRows: SmartRow<T>[] = [];
        const effectiveMaxPages = options?.maxPages ?? this.config.maxPages ?? Infinity;
        let pagesScanned = 1;

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
                        this.rootLocator.page()
                    );
                }

                // Get only newly seen matched rows
                const newIndices = await tracker.getUnseenIndices(rowLocators);
                const currentRows = await rowLocators.all();
                const isRowLoading = this.config.strategies.loading?.isRowLoading;

                for (const idx of newIndices) {
                    const smartRow = this.makeSmartRow(currentRows[idx], map, allRows.length, this.tableState.currentPageIndex);
                    if (isRowLoading && await isRowLoading(smartRow)) continue;
                    allRows.push(smartRow);
                }
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
                if (this.config.strategies.pagination?.goNextBulk) {
                    paginationResult = await this.config.strategies.pagination.goNextBulk(context);
                } else if (this.config.strategies.pagination?.goNext) {
                    paginationResult = await this.config.strategies.pagination.goNext(context);
                } else {
                    break;
                }

                const didPaginate = validatePaginationResult(paginationResult, 'Pagination Strategy');
                if (!didPaginate) break;

                const pagesJumped = typeof paginationResult === 'number' ? paginationResult : 1;
                this.tableState.currentPageIndex += pagesJumped;
                pagesScanned += pagesJumped;
                await collectMatches();
            }
        } finally {
            await tracker.cleanup(this.rootLocator.page());
        }

        return createSmartRowArray(allRows);
    }

    private async findRowLocator(
        filters: Record<string, FilterValue>,
        options: { exact?: boolean, maxPages?: number } = {}
    ): Promise<Locator | null> {
        const map = await this.tableMapper.getMap();
        const effectiveMaxPages = options.maxPages ?? this.config.maxPages;
        let pagesScanned = 1;

        this.log(`Looking for row: ${JSON.stringify(filters)} (MaxPages: ${effectiveMaxPages})`);

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
                    this.log('Table is loading... waiting');
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
                this.rootLocator.page()
            );

            const count = await matchedRows.count();
            this.log(`Page ${this.tableState.currentPageIndex}: Found ${count} matches.`);

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
                this.log(`Page ${this.tableState.currentPageIndex}: Not found. Attempting pagination...`);
                const context: TableContext = {
                    root: this.rootLocator,
                    config: this.config,
                    resolve: this.resolve,
                    page: this.rootLocator.page()
                };

                let paginationResult: boolean | number | PaginationPrimitives | undefined;
                if (this.config.strategies.pagination?.goNextBulk) {
                    paginationResult = await this.config.strategies.pagination.goNextBulk(context);
                } else if (this.config.strategies.pagination?.goNext) {
                    paginationResult = await this.config.strategies.pagination.goNext(context);
                } else {
                    this.log(`Page ${this.tableState.currentPageIndex}: Pagination failed (no goNext or goNextBulk primitive).`);
                    return null;
                }

                const didLoadMore = validatePaginationResult(paginationResult, 'Pagination Strategy');

                if (didLoadMore) {
                    const pagesJumped = typeof paginationResult === 'number' ? paginationResult : 1;
                    this.tableState.currentPageIndex += pagesJumped;
                    pagesScanned += pagesJumped;
                    continue;
                } else {
                    this.log(`Page ${this.tableState.currentPageIndex}: Pagination failed (end of data).`);
                }
            }
            return null;
        }
    }
}
