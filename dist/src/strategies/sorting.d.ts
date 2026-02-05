import type { SortingStrategy } from '../types';
/**
 * A collection of pre-built sorting strategies.
 */
export declare const SortingStrategies: {
    /**
     * A sorting strategy that interacts with column headers based on ARIA attributes.
     * - `doSort`: Clicks the header repeatedly until the desired `aria-sort` state is achieved.
     * - `getSortState`: Reads the `aria-sort` attribute from the header.
     */
    AriaSort: () => SortingStrategy;
};
