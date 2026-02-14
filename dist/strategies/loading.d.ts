import { SmartRow, TableContext } from '../types';
/**
 * Strategies for detecting loading states.
 * Return `true` if the item is loading/busy, `false` if it is ready.
 */
export declare const LoadingStrategies: {
    /**
     * Strategies for detecting if the entire table is loading.
     */
    Table: {
        /**
         * Checks if a global spinner or loading overlay is visible.
         * @param selector Selector for the loading indicator (e.g. '.loading-spinner')
         */
        hasSpinner: (selector?: string) => ({ root }: TableContext) => Promise<boolean>;
        /**
         * Custom function to determine table loading state.
         */
        custom: (fn: (context: TableContext) => Promise<boolean>) => (context: TableContext) => Promise<boolean>;
        /**
         * Assume table is never loading (default).
         */
        never: () => Promise<boolean>;
    };
    /**
     * Strategies for detecting if a specific row is loading (e.g. Skeleton).
     */
    Row: {
        /**
         * Checks if the row contains a specific class indicating it's a skeleton/loading row.
         * @param className Class name acting as the loading indicator (default: 'skeleton')
         */
        hasClass: (className?: string) => (row: SmartRow) => Promise<boolean>;
        /**
         * Checks if the row's text content matches a "Loading..." string or regex.
         */
        hasText: (text?: string | RegExp) => (row: SmartRow) => Promise<boolean>;
        /**
         * Checks if the row has any cell with empty/falsy content (if strict).
         * Useful if rows render with empty cells before populating.
         */
        hasEmptyCells: () => (row: SmartRow) => Promise<boolean>;
        /**
         * Assume row is never loading (default).
         */
        never: () => Promise<boolean>;
    };
    /**
     * Strategies for detecting if headers are loading/stable.
     */
    Headers: {
        /**
         * Checks if the headers are stable (count and text) for a specified duration.
         * @param duration Duration in ms for headers to remain unchanged to be considered stable (default: 200).
         */
        stable: (duration?: number) => (context: TableContext) => Promise<boolean>;
        /**
         * Assume headers are never loading (immediate snapshot).
         */
        never: () => Promise<boolean>;
    };
};
