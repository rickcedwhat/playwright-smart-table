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
            pagination: import("./types").PaginationStrategy;
            header: (context: import("./types").StrategyContext, options?: {
                limit?: number;
                selector?: string;
                scrollAmount?: number;
            }) => Promise<string[]>;
            cellNavigation: (context: import("./types").StrategyContext & {
                column: string;
                index: number;
                rowIndex?: number;
            }) => Promise<void>;
            getCellLocator: ({ page, columnIndex, rowIndex }: any) => any;
            getActiveCell: ({ page }: any) => Promise<{
                rowIndex: number;
                columnIndex: number;
                locator: any;
            } | null>;
        };
    };
};
