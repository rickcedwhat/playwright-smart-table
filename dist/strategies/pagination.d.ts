import type { PaginationStrategy, Selector } from '../types';
import { StabilizationStrategy } from './stabilization';
export declare const PaginationStrategies: {
    click: (selectors: {
        next?: Selector;
        previous?: Selector;
        nextBulk?: Selector;
        previousBulk?: Selector;
        first?: Selector;
    }, options?: {
        nextBulkPages?: number;
        previousBulkPages?: number;
        stabilization?: StabilizationStrategy;
        timeout?: number;
    }) => PaginationStrategy;
    /**
     * Strategy: Infinite Scroll (generic).
     * Supports both simple "Scroll to Bottom" and "Virtualized Scroll".
     *
     * @param options.action 'scroll' (mouse wheel) or 'js-scroll' (direct scrollTop).
     * @param options.scrollTarget Selector for the scroll container (defaults to table root).
     * @param options.scrollAmount Amount to scroll in pixels (default 500).
     * @param options.stabilization Strategy to determine if new content loaded.
     *        Defaults to `rowCountIncreased` (simple append).
     *        Use `contentChanged` for virtualization.
     */
    infiniteScroll: (options?: {
        action?: "scroll" | "js-scroll";
        scrollTarget?: Selector;
        scrollAmount?: number;
        stabilization?: StabilizationStrategy;
        timeout?: number;
    }) => PaginationStrategy;
};
