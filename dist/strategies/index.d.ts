import { PaginationStrategy, Selector } from '../types';
export declare const TableStrategies: {
    /**
     * Strategy: Clicks a "Next" button and waits for the first row of data to change.
     * Best for: Standard pagination (Page 1 > Page 2 > Page 3)
     * * @param nextButtonSelector - Selector for the next button (e.g. 'button.next' or getByRole('button', {name: 'Next'}))
     * @param timeout - How long to wait for the table to refresh (default: 5000ms)
     */
    clickNext: (nextButtonSelector: Selector, timeout?: number) => PaginationStrategy;
    /**
     * Strategy: Clicks a "Load More" button and waits for the row count to increase.
     * Best for: Lists where "Load More" appends data to the bottom.
     * * @param buttonSelector - Selector for the load more button
     * @param timeout - Wait timeout (default: 5000ms)
     */
    clickLoadMore: (buttonSelector: Selector, timeout?: number) => PaginationStrategy;
    /**
     * Strategy: Scrolls to the bottom of the table and waits for more rows to appear.
     * Best for: Infinite Scroll grids (Ag-Grid, Virtual Lists)
     * * @param timeout - Wait timeout (default: 5000ms)
     */
    infiniteScroll: (timeout?: number) => PaginationStrategy;
};
