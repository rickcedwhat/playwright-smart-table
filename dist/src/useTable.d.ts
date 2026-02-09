import type { Locator } from '@playwright/test';
import { TableConfig, TableContext, Selector, TableResult, SmartRow as SmartRowType, DedupeStrategy, PaginationStrategy } from './types';
import { FillStrategies } from './strategies/fill';
import { HeaderStrategies } from './strategies/headers';
import { CellNavigationStrategies } from './strategies/columns';
import { ResolutionStrategies } from './strategies/resolution';
import { Strategies } from './strategies';
/**
 * Main hook to interact with a table.
 */
export declare const useTable: <T = any>(rootLocator: Locator, configOptions?: TableConfig) => TableResult<T>;
export declare const PaginationStrategies: {
    clickNext: (nextButtonSelector: Selector, options?: {
        stabilization?: import("./strategies/stabilization").StabilizationStrategy;
        timeout?: number;
    }) => PaginationStrategy;
    infiniteScroll: (options?: {
        action?: "scroll" | "js-scroll";
        scrollTarget?: Selector;
        scrollAmount?: number;
        stabilization?: import("./strategies/stabilization").StabilizationStrategy;
        timeout?: number;
    }) => PaginationStrategy;
};
export declare const LoadingStrategies: {
    Table: {
        hasSpinner: (selector?: string) => ({ root }: TableContext) => Promise<boolean>;
        custom: (fn: (context: TableContext) => Promise<boolean>) => (context: TableContext) => Promise<boolean>;
        never: () => Promise<boolean>;
    };
    Row: {
        hasClass: (className?: string) => (row: SmartRowType) => Promise<boolean>;
        hasText: (text?: string | RegExp) => (row: SmartRowType) => Promise<boolean>;
        hasEmptyCells: () => (row: SmartRowType) => Promise<boolean>;
        never: () => Promise<boolean>;
    };
};
export declare const SortingStrategies: {
    AriaSort: () => import("./types").SortingStrategy;
};
export declare const DedupeStrategies: {
    byTopPosition: (tolerance?: number) => DedupeStrategy;
};
export { FillStrategies, HeaderStrategies, CellNavigationStrategies, ResolutionStrategies, Strategies };
