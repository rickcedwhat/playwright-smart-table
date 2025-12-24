import type { Locator } from '@playwright/test';
import { TableConfig, TableContext, TableResult } from './types';
/**
 * A collection of pre-built pagination strategies.
 */
export declare const PaginationStrategies: {
    /**
     * Clicks a "Next" button.
     * @param selector - The CSS selector for the "Next" button.
     */
    NextButton: (selector: string) => ((context: TableContext) => Promise<boolean>);
    /**
     * Clicks numbered page links.
     * @param selector - The CSS selector for the page number links.
     */
    NumberedPages: (selector: string) => ((context: TableContext) => Promise<boolean>);
};
/**
 * @deprecated Use `PaginationStrategies` instead. This alias will be removed in a future major version.
 */
export declare const TableStrategies: {
    /**
     * Clicks a "Next" button.
     * @param selector - The CSS selector for the "Next" button.
     */
    NextButton: (selector: string) => ((context: TableContext) => Promise<boolean>);
    /**
     * Clicks numbered page links.
     * @param selector - The CSS selector for the page number links.
     */
    NumberedPages: (selector: string) => ((context: TableContext) => Promise<boolean>);
};
/**
 * A collection of pre-built sorting strategies.
 */
export declare const SortingStrategies: {
    AriaSort: () => import("./types").SortingStrategy;
};
export declare const useTable: (rootLocator: Locator, configOptions?: TableConfig) => TableResult;
