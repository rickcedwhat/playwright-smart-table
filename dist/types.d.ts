import { Locator, Page } from '@playwright/test';
export type Selector = string | ((root: Locator | Page) => Locator);
export type SmartRow = Locator & {
    getCell(column: string): Locator;
    toJSON(): Promise<Record<string, string>>;
};
export interface TableContext {
    root: Locator;
    config: Required<TableConfig>;
    page: Page;
    resolve: (selector: Selector, parent: Locator | Page) => Locator;
}
/**
 * A function that handles pagination logic.
 * Returns true if more data was loaded (navigation occurred), false if end of data.
 */
export type PaginationStrategy = (context: TableContext) => Promise<boolean>;
export interface TableConfig {
    rowSelector?: Selector;
    headerSelector?: Selector;
    cellSelector?: Selector;
    /**
     * Strategy for handling pagination.
     * Use presets from TableStrategies or write your own.
     */
    pagination?: PaginationStrategy;
    maxPages?: number;
    /**
     * Optional hook to rename columns dynamically.
     * Useful for naming empty columns (like '__col_0') to something semantic like 'Actions'.
     */
    headerTransformer?: (text: string, index: number) => string;
}
export interface TableResult {
    getHeaders: () => Promise<string[]>;
    getHeaderCell: (columnName: string) => Promise<Locator>;
    /** * Find a specific row by its content.
     * Default: Returns SmartRow (Locator).
     * Option { asJSON: true }: Returns Record<string, string> (Data).
     */
    getByRow: <T extends {
        asJSON?: boolean;
    }>(filters: Record<string, string | RegExp | number>, options?: {
        exact?: boolean;
        maxPages?: number;
    } & T) => Promise<T['asJSON'] extends true ? Record<string, string> : SmartRow>;
    /** * Get all rows on the current page.
     * Default: Returns SmartRow[] (Locators).
     * Option { asJSON: true }: Returns Record<string, string>[] (Data).
     */
    getAllRows: <T extends {
        asJSON?: boolean;
    }>(options?: T) => Promise<T['asJSON'] extends true ? Record<string, string>[] : SmartRow[]>;
    generateConfigPrompt: () => Promise<void>;
    generateStrategyPrompt: () => Promise<void>;
}
