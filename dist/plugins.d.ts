export declare const Plugins: {
    RDG: {
        Strategies: {
            header: (context: import("./types").TableContext) => Promise<string[]>;
            getCellLocator: ({ row, columnIndex }: any) => any;
            cellNavigation: ({ root, page, index }: any) => Promise<void>;
            pagination: import("./types").PaginationStrategy;
        };
    };
    Glide: {
        Strategies: {
            fill: import("./types").FillStrategy;
            fillSimple: import("./types").FillStrategy;
            pagination: import("./types").PaginationStrategy;
            header: (context: import("./types").StrategyContext, options?: {
                limit?: number;
                selector?: string;
                scrollAmount?: number;
            }) => Promise<string[]>;
            navigation: {
                goUp: (context: import("./types").StrategyContext) => Promise<void>;
                goDown: (context: import("./types").StrategyContext) => Promise<void>;
                goLeft: (context: import("./types").StrategyContext) => Promise<void>;
                goRight: (context: import("./types").StrategyContext) => Promise<void>;
                goHome: (context: import("./types").StrategyContext) => Promise<void>;
            };
            getCellLocator: ({ row, columnIndex }: any) => any;
            getActiveCell: ({ page }: any) => Promise<{
                rowIndex: number;
                columnIndex: number;
                locator: any;
            } | null>;
        };
    };
};
