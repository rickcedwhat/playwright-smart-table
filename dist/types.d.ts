import type { Locator, Page } from '@playwright/test';
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
export type PaginationStrategy = (context: TableContext) => Promise<boolean>;
export interface PromptOptions {
    /**
     * Output Strategy:
     * - 'error': Throws an error with the prompt (Best for Cloud/QA Wolf to get clean text).
     * - 'console': Standard console logs (Default).
     */
    output?: 'console' | 'error';
    includeTypes?: boolean;
}
export interface TableConfig {
    rowSelector?: Selector;
    headerSelector?: Selector;
    cellSelector?: Selector;
    pagination?: PaginationStrategy;
    maxPages?: number;
    /**
     * Hook to rename columns dynamically.
     * * @param args.text - The default innerText of the header.
     * @param args.index - The column index.
     * @param args.locator - The specific header cell locator.
     */
    headerTransformer?: (args: {
        text: string;
        index: number;
        locator: Locator;
    }) => string | Promise<string>;
    autoScroll?: boolean;
    /**
     * Enable debug mode to log internal state to console.
     */
    debug?: boolean;
    /**
     * Strategy to reset the table to the first page.
     * Called when table.reset() is invoked.
     */
    onReset?: (context: TableContext) => Promise<void>;
}
export interface TableResult {
    getHeaders: () => Promise<string[]>;
    getHeaderCell: (columnName: string) => Promise<Locator>;
    getByRow: <T extends {
        asJSON?: boolean;
    }>(filters: Record<string, string | RegExp | number>, options?: {
        exact?: boolean;
        maxPages?: number;
    } & T) => Promise<T['asJSON'] extends true ? Record<string, string> : SmartRow>;
    getAllRows: <T extends {
        asJSON?: boolean;
    }>(options?: {
        filter?: Record<string, any>;
        exact?: boolean;
    } & T) => Promise<T['asJSON'] extends true ? Record<string, string>[] : SmartRow[]>;
    generateConfigPrompt: (options?: PromptOptions) => Promise<void>;
    generateStrategyPrompt: (options?: PromptOptions) => Promise<void>;
    /**
     * Resets the table state (clears cache, flags) and invokes the onReset strategy.
     */
    reset: () => Promise<void>;
    /**
     * Scans a specific column across all pages and returns the values.
     */
    getColumnValues: <V = string>(column: string, options?: {
        mapper?: (cell: Locator) => Promise<V> | V;
        maxPages?: number;
    }) => Promise<V[]>;
}
