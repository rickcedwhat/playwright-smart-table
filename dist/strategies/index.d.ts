export * from './pagination';
export * from './sorting';
export * from './columns';
export * from './headers';
export * from './fill';
export * from './resolution';
export * from './dedupe';
export * from './loading';
export declare const Strategies: {
    Pagination: {
        click: (selectors: {
            next?: import("..").Selector;
            previous?: import("..").Selector;
            nextBulk?: import("..").Selector;
            previousBulk?: import("..").Selector;
            first?: import("..").Selector;
        }, options?: {
            nextBulkPages?: number;
            previousBulkPages?: number;
            stabilization?: import("./stabilization").StabilizationStrategy;
            timeout?: number;
        }) => import("../types").PaginationStrategy;
        infiniteScroll: (options?: {
            action?: "scroll" | "js-scroll";
            scrollTarget?: import("..").Selector;
            scrollAmount?: number;
            stabilization?: import("./stabilization").StabilizationStrategy;
            timeout?: number;
        }) => import("../types").PaginationStrategy;
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
        default: ({ row, columnName, value, fillOptions, config, table }: Parameters<import("../types").FillStrategy>[0]) => Promise<void>;
    };
    Resolution: {
        default: import("./resolution").ColumnResolutionStrategy;
    };
    Dedupe: {
        byTopPosition: (tolerance?: number) => import("../types").DedupeStrategy;
    };
    Loading: {
        Table: {
            hasSpinner: (selector?: string) => ({ root }: import("..").TableContext) => Promise<boolean>;
            custom: (fn: (context: import("..").TableContext) => Promise<boolean>) => (context: import("..").TableContext) => Promise<boolean>;
            never: () => Promise<boolean>;
        };
        Row: {
            hasClass: (className?: string) => (row: import("..").SmartRow) => Promise<boolean>;
            hasText: (text?: string | RegExp) => (row: import("..").SmartRow) => Promise<boolean>;
            hasEmptyCells: () => (row: import("..").SmartRow) => Promise<boolean>;
            never: () => Promise<boolean>;
        };
        Headers: {
            stable: (duration?: number) => (context: import("..").TableContext) => Promise<boolean>;
            never: () => Promise<boolean>;
        };
    };
};
