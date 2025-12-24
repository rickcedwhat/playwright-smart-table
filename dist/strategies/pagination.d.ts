import type { PaginationStrategy, Selector } from '../types';
export declare const PaginationStrategies: {
    /**
     * Strategy: Clicks a "Next" button and waits for the first row of data to change.
     */
    clickNext: (nextButtonSelector: Selector, timeout?: number) => PaginationStrategy;
    /**
     * Strategy: Clicks a "Load More" button and waits for the row count to increase.
     */
    clickLoadMore: (buttonSelector: Selector, timeout?: number) => PaginationStrategy;
    /**
     * Strategy: Scrolls to the bottom and waits for more rows to appear.
     */
    infiniteScroll: (timeout?: number) => PaginationStrategy;
};
/**
 * @deprecated Use `PaginationStrategies` instead. This alias will be removed in a future major version.
 */
export declare const TableStrategies: {
    /**
     * Strategy: Clicks a "Next" button and waits for the first row of data to change.
     */
    clickNext: (nextButtonSelector: Selector, timeout?: number) => PaginationStrategy;
    /**
     * Strategy: Clicks a "Load More" button and waits for the row count to increase.
     */
    clickLoadMore: (buttonSelector: Selector, timeout?: number) => PaginationStrategy;
    /**
     * Strategy: Scrolls to the bottom and waits for more rows to appear.
     */
    infiniteScroll: (timeout?: number) => PaginationStrategy;
};
