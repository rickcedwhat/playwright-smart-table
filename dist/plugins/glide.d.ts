import { FillStrategy, TableConfig } from '../types';
/** Strategies only for Glide Data Grid. Includes fillSimple; use when you want to supply your own selectors or override fill. */
export declare const GlideStrategies: {
    fillSimple: FillStrategy;
    fill: FillStrategy;
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
export declare const Glide: Partial<TableConfig> & {
    Strategies: typeof GlideStrategies;
};
