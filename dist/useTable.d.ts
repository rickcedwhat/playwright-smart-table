import type { Locator } from '@playwright/test';
import { TableConfig, Selector, TableResult, PaginationStrategy } from './types';
import { FillStrategies } from './strategies/fill';
import { HeaderStrategies } from './strategies/headers';
import { CellNavigationStrategies, ColumnStrategies } from './strategies/columns';
import { ResolutionStrategies } from './strategies/resolution';
import { Strategies } from './strategies';
/**
 * Main hook to interact with a table.
 */
export declare const useTable: <T = any>(rootLocator: Locator, configOptions?: TableConfig) => TableResult<T>;
export declare const PaginationStrategies: {
    clickNext: (nextButtonSelector: Selector, timeout?: number) => PaginationStrategy;
    clickLoadMore: (buttonSelector: Selector, timeout?: number) => PaginationStrategy;
    infiniteScroll: (timeout?: number) => PaginationStrategy;
};
/** @deprecated Use Strategies.Pagination instead */
export declare const DeprecatedTableStrategies: {
    clickNext: (nextButtonSelector: Selector, timeout?: number) => PaginationStrategy;
    clickLoadMore: (buttonSelector: Selector, timeout?: number) => PaginationStrategy;
    infiniteScroll: (timeout?: number) => PaginationStrategy;
};
export declare const SortingStrategies: {
    AriaSort: () => import("./types").SortingStrategy;
};
export { FillStrategies, HeaderStrategies, CellNavigationStrategies, ColumnStrategies, ResolutionStrategies, Strategies };
