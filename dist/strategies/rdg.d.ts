import { TableContext } from '../types';
/**
 * Scrolls the grid horizontally to collect all column headers.
 * Handles empty headers by labeling them (e.g. "Checkbox").
 */
export declare const scrollRightHeaderRDG: (context: TableContext) => Promise<string[]>;
/**
 * Uses a row-relative locator to avoid issues with absolute aria-rowindex
 * changing during pagination/scrolling.
 */
export declare const rdgGetCellLocator: ({ row, columnIndex }: any) => any;
/**
 * Scrolls the grid vertically to load more virtualized rows.
 */
export declare const rdgPaginationStrategy: import("../types").PaginationStrategy;
export declare const rdgNavigation: {
    goRight: ({ root, page }: any) => Promise<void>;
    goLeft: ({ root, page }: any) => Promise<void>;
    goDown: ({ root, page }: any) => Promise<void>;
    goUp: ({ root, page }: any) => Promise<void>;
    goHome: ({ root, page }: any) => Promise<void>;
};
export declare const RDGStrategies: {
    header: (context: TableContext) => Promise<string[]>;
    getCellLocator: ({ row, columnIndex }: any) => any;
    navigation: {
        goRight: ({ root, page }: any) => Promise<void>;
        goLeft: ({ root, page }: any) => Promise<void>;
        goDown: ({ root, page }: any) => Promise<void>;
        goUp: ({ root, page }: any) => Promise<void>;
        goHome: ({ root, page }: any) => Promise<void>;
    };
    pagination: import("../types").PaginationStrategy;
};
