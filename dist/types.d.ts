import { Locator, Page } from '@playwright/test';
/**
 * A selector can be a CSS string or a function.
 * We allow 'parent' to be Locator OR Page to match your working logic.
 */
export type Selector = string | ((parent: Locator | Page) => Locator);
export interface TableConfig {
    rowSelector?: Selector;
    headerSelector?: Selector;
    cellSelector?: Selector;
    pagination?: PaginationStrategy;
    maxPages?: number;
}
export interface TableContext {
    root: Locator;
    config: Required<TableConfig>;
    page: Page;
    resolve: (item: Selector, parent: Locator | Page) => Locator;
}
export type PaginationStrategy = (context: TableContext) => Promise<boolean>;
