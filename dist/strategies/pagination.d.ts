import type { PaginationStrategy, Selector } from '../types';
export declare const PaginationStrategies: {
    /**
     * Strategy: Clicks a "Next" button and waits for the first row of data to change.
     */
    clickNext: (nextButtonSelector: Selector, timeout?: number) => PaginationStrategy;
    /**
     * Strategy: Scrolls to the bottom and waits for more rows to appear.
     */
    infiniteScroll: (timeout?: number) => PaginationStrategy;
};
