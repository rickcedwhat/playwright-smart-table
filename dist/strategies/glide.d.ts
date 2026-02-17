import { FillStrategy } from '../types';
export declare const glideFillStrategy: FillStrategy;
export declare const glidePaginationStrategy: import("../types").PaginationStrategy;
export declare const glideGetCellLocator: ({ row, columnIndex }: any) => any;
export declare const glideGetActiveCell: ({ page }: any) => Promise<{
    rowIndex: number;
    columnIndex: number;
    locator: any;
} | null>;
export declare const GlideStrategies: {
    fill: FillStrategy;
    pagination: import("../types").PaginationStrategy;
    header: (context: import("../types").StrategyContext, options?: {
        limit?: number;
        selector?: string;
        scrollAmount?: number;
    }) => Promise<string[]>;
    navigation: {
        goUp: (context: import("../types").StrategyContext) => Promise<void>;
        goDown: (context: import("../types").StrategyContext) => Promise<void>;
        goLeft: (context: import("../types").StrategyContext) => Promise<void>;
        goRight: (context: import("../types").StrategyContext) => Promise<void>;
        goHome: (context: import("../types").StrategyContext) => Promise<void>;
    };
    getCellLocator: ({ row, columnIndex }: any) => any;
    getActiveCell: ({ page }: any) => Promise<{
        rowIndex: number;
        columnIndex: number;
        locator: any;
    } | null>;
};
