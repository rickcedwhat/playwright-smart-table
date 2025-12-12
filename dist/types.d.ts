import { Locator, Page } from '@playwright/test';
/**
 * A selector can be a CSS string, a function, or null (to disable/skip).
 */
export type Selector = string | ((parent: Locator | Page) => Locator) | null;
export interface TableConfig {
    rowSelector?: Selector;
    headerSelector?: Selector;
    cellSelector?: Selector;
    pagination?: PaginationStrategy;
    maxPages?: number;
    /**
     * Statically override specific column names.
     * Use 'undefined' to keep the detected name for that index.
     * Use this to name columns for Menus or Forms that have no headers.
     * Example: ['MenuItem'] or [undefined, "Actions"]
     */
    columnNames?: (string | undefined)[];
}
export interface TableContext {
    root: Locator;
    config: Required<TableConfig>;
    page: Page;
    resolve: (item: Selector, parent: Locator | Page) => Locator;
}
export type PaginationStrategy = (context: TableContext) => Promise<boolean>;
