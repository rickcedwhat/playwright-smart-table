import type { PaginationStrategy, Selector } from '../types';
import { StabilizationStrategy } from './stabilization';
export declare const PaginationStrategies: {
    /**
     * Strategy: Clicks a "Next" button and waits for stabilization.
     * @param nextButtonSelector Selector for the next page button.
     * @param options.stabilization Strategy to determine when the page has updated.
     *        Defaults to `contentChanged({ scope: 'first' })`.
     * @param options.timeout Timeout for the click action.
     */
    clickNext: (nextButtonSelector: Selector, options?: {
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
