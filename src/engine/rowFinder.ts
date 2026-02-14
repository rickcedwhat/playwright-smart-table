import type { Locator, Page } from '@playwright/test';
import { FinalTableConfig, TableContext, Selector, SmartRow } from '../types';
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
        filters: Record<string, string | RegExp | number>,
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

    public async findRows<R extends { asJSON?: boolean }>(
        filters: Partial<T> | Record<string, string | RegExp | number>,
        options?: { exact?: boolean, maxPages?: number } & R
    ): Promise<R['asJSON'] extends true ? Record<string, string>[] : SmartRowArray<T>> {
        const map = await this.tableMapper.getMap();
        const allRows: SmartRow<T>[] = [];
        const effectiveMaxPages = options?.maxPages ?? this.config.maxPages ?? Infinity;
        let pageCount = 0;

        const collectMatches = async () => {
            let rowLocators = this.resolve(this.config.rowSelector, this.rootLocator);
            rowLocators = this.filterEngine.applyFilters(
                rowLocators,
                filters as Record<string, any>,
                map,
                options?.exact ?? false,
                this.rootLocator.page()
            );

            const currentRows = await rowLocators.all();
            const isRowLoading = this.config.strategies.loading?.isRowLoading;

            for (let i = 0; i < currentRows.length; i++) {
                const smartRow = this.makeSmartRow(currentRows[i], map, i);
                if (isRowLoading && await isRowLoading(smartRow)) continue;
                allRows.push(smartRow);
            }
        };

        // Scan first page
        await collectMatches();

        // Pagination Loop
        while (pageCount < effectiveMaxPages && this.config.strategies.pagination) {
            // Check if pagination needed? findRows assumes we want ALL matches across maxPages.
            // If explicit maxPages is set, we paginate. If global maxPages is 1 (default), we stop.
            // Wait, loop condition `pageCount < effectiveMaxPages`. If maxPages=1, 0 < 1 is true.
            // We paginate AFTER first scan.
            // If maxPages=1, we should NOT paginate.
            if (effectiveMaxPages <= 1) break;

            const context: TableContext = {
                root: this.rootLocator,
                config: this.config,
                resolve: this.resolve,
                page: this.rootLocator.page()
            };

            const paginationResult = await this.config.strategies.pagination(context);
            const didPaginate = validatePaginationResult(paginationResult, 'Pagination Strategy');

            if (!didPaginate) break;

            pageCount++;
            await collectMatches();
        }

        if (options?.asJSON) {
            return Promise.all(allRows.map(r => r.toJSON())) as any;
        }
        return createSmartRowArray(allRows) as any;
    }

    private async findRowLocator(
        filters: Record<string, string | RegExp | number>,
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
