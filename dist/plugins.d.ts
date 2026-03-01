export declare const Plugins: {
    RDG: {
        Strategies: {
            header: (context: import("./types").TableContext) => Promise<string[]>;
            getCellLocator: ({ row, columnIndex }: any) => any;
            navigation: {
                goRight: ({ root, page }: any) => Promise<void>;
                goLeft: ({ root, page }: any) => Promise<void>;
                goDown: ({ root, page }: any) => Promise<void>;
                goUp: ({ root, page }: any) => Promise<void>;
                goHome: ({ root, page }: any) => Promise<void>;
            };
            pagination: import("./types").PaginationPrimitives;
        };
    };
    Glide: {
        Strategies: {
            fill: import("./types").FillStrategy;
            fillSimple: import("./types").FillStrategy;
            pagination: import("./types").PaginationPrimitives;
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
            loading: {
                isHeaderLoading: () => Promise<boolean>;
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
