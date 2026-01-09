export * from './pagination';
export * from './sorting';
export * from './columns';
export * from './headers';
export * from './fill';
export * from './resolution';
export declare const Strategies: {
    Pagination: {
        clickNext: (nextButtonSelector: import("..").Selector, timeout?: number) => import("..").PaginationStrategy;
        clickLoadMore: (buttonSelector: import("..").Selector, timeout?: number) => import("..").PaginationStrategy;
        infiniteScroll: (timeout?: number) => import("..").PaginationStrategy;
    };
    Sorting: {
        AriaSort: () => import("..").SortingStrategy;
    };
    Column: {
        default: () => Promise<void>;
        keyboard: (context: import("..").StrategyContext & {
            column: string;
            index: number;
            rowIndex?: number;
        }) => Promise<void>;
    };
    CellNavigation: {
        default: () => Promise<void>;
        keyboard: (context: import("..").StrategyContext & {
            column: string;
            index: number;
            rowIndex?: number;
        }) => Promise<void>;
    };
    Header: {
        visible: ({ config, resolve, root }: import("..").StrategyContext) => Promise<string[]>;
        scrollRight: (context: import("..").StrategyContext, options?: {
            limit?: number;
            selector?: string;
            scrollAmount?: number;
        }) => Promise<string[]>;
        keyboard: (context: import("..").StrategyContext, options?: {
            limit?: number;
            maxSilentClicks?: number;
        }) => Promise<string[]>;
    };
    Fill: {
        default: ({ row, columnName, value, fillOptions }: Parameters<import("..").FillStrategy>[0]) => Promise<void>;
    };
    Resolution: {
        default: import("./resolution").ColumnResolutionStrategy;
    };
    DeprecatedPagination: {
        clickNext: (nextButtonSelector: import("..").Selector, timeout?: number) => import("..").PaginationStrategy;
        clickLoadMore: (buttonSelector: import("..").Selector, timeout?: number) => import("..").PaginationStrategy;
        infiniteScroll: (timeout?: number) => import("..").PaginationStrategy;
    };
};
