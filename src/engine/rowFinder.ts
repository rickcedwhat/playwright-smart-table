import type { Locator, Page } from '@playwright/test';
import { FinalTableConfig, TableContext, Selector, SmartRow, FilterValue } from '../types';
import { FilterEngine } from '../filterEngine';
import { TableMapper } from './tableMapper';
import { logDebug, debugDelay } from '../utils/debugUtils';
import { createSmartRowArray, SmartRowArray } from '../utils/smartRowArray';
import { validatePaginationResult } from '../strategies/validation';

export class RowFinder<T = any> {
    private resolve: (item: Selector, parent: Locator | Page) => Locator;

    constructor(
        private rootLocator: Locator,
        private config: FinalTableConfig,
        resolve: (item: Selector, parent: Locator | Page) => Locator,
        private filterEngine: FilterEngine,
        private tableMapper: TableMapper,
        private makeSmartRow: (loc: Locator, map: Map<string, number>, index: number) => SmartRow<T>
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
        return this.makeSmartRow(sentinel, await this.tableMapper.getMap(), 0);
    }

    public async findRows(
        filtersOrOptions?: (Partial<T> | Record<string, FilterValue>) & ({ exact?: boolean, maxPages?: number }),
        // Deprecated: verify legacy usage pattern support
        legacyOptions?: { exact?: boolean, maxPages?: number }
    ): Promise<SmartRowArray<T>> {
        // Detect argument pattern:
        // Pattern A: findRows({ Name: 'Alice' }, { maxPages: 5 })
        // Pattern B: findRows({ maxPages: 5 })  <-- No filters, just options
        // Pattern C: findRows({ Name: 'Alice' }) <-- Only filters

        let filters: Record<string, FilterValue> = {};
        let options: { exact?: boolean, maxPages?: number } = {};

        if (legacyOptions) {
            // Pattern A
            filters = filtersOrOptions as Record<string, FilterValue>;
            options = legacyOptions;
        } else {
            // Pattern B or C
            // We need to separate unknown keys (filters) from known options (exact, maxPages)
            // However, filtersOrOptions can be null/undefined
            if (filtersOrOptions) {
                const { exact, maxPages, ...rest } = filtersOrOptions as any;
                options = { exact, maxPages };
                filters = rest;
            }
        }

        const map = await this.tableMapper.getMap();
        const allRows: SmartRow<T>[] = [];
        const effectiveMaxPages = options.maxPages ?? this.config.maxPages ?? Infinity;
        let pageCount = 0;

        const collectMatches = async () => {
            // ... logic ...
            let rowLocators = this.resolve(this.config.rowSelector, this.rootLocator);
            // Only apply filters if we have them
            if (Object.keys(filters).length > 0) {
                rowLocators = this.filterEngine.applyFilters(
                    rowLocators,
                    filters,
                    map,
                    options.exact ?? false,
                    this.rootLocator.page()
                );
            }

            const currentRows = await rowLocators.all();
            const isRowLoading = this.config.strategies.loading?.isRowLoading;

            for (let i = 0; i < currentRows.length; i++) {
                const smartRow = this.makeSmartRow(currentRows[i], map, allRows.length + i);
                if (isRowLoading && await isRowLoading(smartRow)) continue;
                allRows.push(smartRow);
            }
        };

        // Scan first page
        await collectMatches();

        // Pagination Loop - Corrected logic
        // We always scan at least 1 page.
        // If maxPages > 1, and we have a pagination strategy, we try to go next.
        while (pageCount < effectiveMaxPages - 1 && this.config.strategies.pagination) {
            const context: TableContext = {
                root: this.rootLocator,
                config: this.config,
                resolve: this.resolve,
                page: this.rootLocator.page()
            };

            // Check if we should stop? (e.g. if we found enough rows? No, findRows finds ALL)

            const paginationResult = await this.config.strategies.pagination(context);
            const didPaginate = await validatePaginationResult(paginationResult, 'Pagination Strategy');

            if (!didPaginate) break;

            pageCount++;
            // Wait for reload logic if needed? Usually pagination handles it.
            await collectMatches();
        }

        return createSmartRowArray(allRows);
    }

    private async findRowLocator(
        filters: Record<string, FilterValue>,
        options: { exact?: boolean, maxPages?: number } = {}
    ): Promise<Locator | null> {
        const map = await this.tableMapper.getMap();
        const effectiveMaxPages = options.maxPages ?? this.config.maxPages;
        let currentPage = 1;

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
            this.log(`Page ${currentPage}: Found ${count} matches.`);

            if (count > 1) {
                const sampleData: string[] = [];
                try {
                    const firstFewRows = await matchedRows.all();
                    const sampleCount = Math.min(firstFewRows.length, 3);
                    for (let i = 0; i < sampleCount; i++) {
                        const rowData = await this.makeSmartRow(firstFewRows[i], map, 0).toJSON();
                        sampleData.push(JSON.stringify(rowData));
                    }
                } catch (e) { }
                const sampleMsg = sampleData.length > 0 ? `\nSample matching rows:\n${sampleData.map((d, i) => `  ${i + 1}. ${d}`).join('\n')}` : '';

                throw new Error(
                    `Ambiguous Row: Found ${count} rows matching ${JSON.stringify(filters)} on page ${currentPage}. ` +
                    `Expected exactly one match. Try adding more filters to make your query unique.${sampleMsg}`
                );
            }

            if (count === 1) return matchedRows.first();

            if (currentPage < effectiveMaxPages) {
                this.log(`Page ${currentPage}: Not found. Attempting pagination...`);
                const context: TableContext = {
                    root: this.rootLocator,
                    config: this.config,
                    resolve: this.resolve,
                    page: this.rootLocator.page()
                };

                const paginationResult = await this.config.strategies.pagination!(context);
                const didLoadMore = validatePaginationResult(paginationResult, 'Pagination Strategy');

                if (didLoadMore) {
                    currentPage++;
                    continue;
                } else {
                    this.log(`Page ${currentPage}: Pagination failed (end of data).`);
                }
            }
            return null;
        }
    }
}
