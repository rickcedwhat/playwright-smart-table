import { FillStrategy } from '../types';
/**
 * Fill strategy for Glide Data Grid with textarea validation.
 * This is the default strategy that works with the standard Glide Data Grid editor.
 */
export declare const glideFillStrategy: FillStrategy;
/**
 * Simple fill strategy for Glide Data Grid.
 * Use this if your Glide implementation doesn't use the standard textarea editor.
 * This is faster but may not work for all Glide configurations.
 */
export declare const glideFillSimple: FillStrategy;
export declare const glidePaginationStrategy: import("../types").PaginationPrimitives;
export declare const glideGetCellLocator: ({ row, columnIndex }: any) => any;
export declare const glideGetActiveCell: ({ page }: any) => Promise<{
    rowIndex: number;
    columnIndex: number;
    locator: any;
} | null>;
export declare const GlideStrategies: {
    fill: FillStrategy;
    fillSimple: FillStrategy;
    pagination: import("../types").PaginationPrimitives;
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
