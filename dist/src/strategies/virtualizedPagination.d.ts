import { PaginationStrategy } from '../types';
/**
 * Strategies for handling virtualized pagination where:
 * 1. The total row count might not change (DOM recycling).
 * 2. We need to check for *new content* appearing to confirm pagination success.
 */
export declare const virtualizedInfiniteScroll: (options?: {
    /** Selector for the scrollable container. Defaults to table root. */
    scrollTarget?: string;
    /** Amount to scroll in pixels. Default 500. */
    scrollAmount?: number;
    /** Timeout to wait for content stability. Default 500ms. */
    stabilityTimeout?: number;
    /** Max retries to detect content change. Default 3. */
    retries?: number;
    /** force use of JS scrollTop property instead of mouse wheel. Default: false */
    useJsScroll?: boolean;
}) => PaginationStrategy;
export declare const VirtualizedPaginationStrategies: {
    virtualInfiniteScroll: (options?: {
        /** Selector for the scrollable container. Defaults to table root. */
        scrollTarget?: string;
        /** Amount to scroll in pixels. Default 500. */
        scrollAmount?: number;
        /** Timeout to wait for content stability. Default 500ms. */
        stabilityTimeout?: number;
        /** Max retries to detect content change. Default 3. */
        retries?: number;
        /** force use of JS scrollTop property instead of mouse wheel. Default: false */
        useJsScroll?: boolean;
    }) => PaginationStrategy;
};
