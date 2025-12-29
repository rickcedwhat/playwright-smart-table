import type { Locator } from '@playwright/test';
import { TableConfig, Selector, TableResult, PaginationStrategy } from './types';
/**
 * A collection of pre-built pagination strategies.
 */
export declare const PaginationStrategies: {
    clickNext: (nextButtonSelector: Selector, timeout?: number) => PaginationStrategy;
    clickLoadMore: (buttonSelector: Selector, timeout?: number) => PaginationStrategy;
    infiniteScroll: (timeout?: number) => PaginationStrategy;
};
/**
 * @deprecated Use `PaginationStrategies` instead. This alias will be removed in a future major version.
 */
export declare const TableStrategies: {
    clickNext: (nextButtonSelector: Selector, timeout?: number) => PaginationStrategy;
    clickLoadMore: (buttonSelector: Selector, timeout?: number) => PaginationStrategy;
    infiniteScroll: (timeout?: number) => PaginationStrategy;
};
/**
 * A collection of pre-built sorting strategies.
 */
export declare const SortingStrategies: {
    AriaSort: () => import("./types").SortingStrategy;
};
export declare const useTable: (rootLocator: Locator, configOptions?: TableConfig) => TableResult;
