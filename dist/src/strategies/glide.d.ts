import { FillStrategy } from '../types';
export declare const glideFillStrategy: FillStrategy;
export declare const glidePaginationStrategy: import("../types").PaginationStrategy;
export declare const glideGetCellLocator: ({ page, columnIndex, rowIndex }: any) => any;
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
    cellNavigation: (context: import("../types").StrategyContext & {
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
