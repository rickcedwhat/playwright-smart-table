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
 * Scrolls virtualized columns into view before reading.
 */
export declare const rdgCellNavigation: ({ root, page, index }: any) => Promise<void>;
/**
 * Scrolls the grid vertically to load more virtualized rows.
 */
export declare const rdgPaginationStrategy: ({ root, page }: TableContext) => Promise<boolean>;
export declare const RDGStrategies: {
    header: (context: TableContext) => Promise<string[]>;
    getCellLocator: ({ row, columnIndex }: any) => any;
    cellNavigation: ({ root, page, index }: any) => Promise<void>;
    pagination: ({ root, page }: TableContext) => Promise<boolean>;
};
