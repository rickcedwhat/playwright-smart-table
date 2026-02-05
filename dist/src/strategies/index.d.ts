export * from './pagination';
export * from './sorting';
export * from './columns';
export * from './headers';
export * from './fill';
export * from './resolution';
export declare const Strategies: {
    Pagination: {
        clickNext: (nextButtonSelector: import("..").Selector, timeout?: number) => import("..").PaginationStrategy;
        infiniteScroll: (timeout?: number) => import("..").PaginationStrategy;
    };
    Sorting: {
        AriaSort: () => import("..").SortingStrategy;
    };
    CellNavigation: {
        default: () => Promise<void>;
    };
    Header: {
        visible: ({ config, resolve, root }: import("..").StrategyContext) => Promise<string[]>;
    };
    Fill: {
        default: ({ row, columnName, value, fillOptions }: Parameters<import("..").FillStrategy>[0]) => Promise<void>;
    };
    Resolution: {
        default: import("./resolution").ColumnResolutionStrategy;
    };
};
