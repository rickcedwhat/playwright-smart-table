import type { SortingStrategy, Selector } from '../types';

/**
 * A collection of pre-built sorting strategies.
 */
export const SortingStrategies = {
  /**
   * A sorting strategy that interacts with column headers based on ARIA attributes.
   * - `doSort`: Clicks the header repeatedly until the desired `aria-sort` state is achieved.
   * - `getSortState`: Reads the `aria-sort` attribute from the header.
   */
  AriaSort: (): SortingStrategy => {
    return {
      async doSort({ columnName, direction, context }) {
        // getHeaderCell is always present on TableContext after table is initialized
        const targetHeader = await context.getHeaderCell!(columnName);
        // The table engine handles verify-and-retry. We only provide the trigger here.
        await targetHeader.click();
      },
      async getSortState({ columnName, context }) {
        try {
          const targetHeader = await context.getHeaderCell!(columnName);
          const ariaSort = await targetHeader.getAttribute('aria-sort');
          if (ariaSort === 'ascending') return 'asc';
          if (ariaSort === 'descending') return 'desc';
          return 'none';
        } catch {
          return 'none'; // Header not found, treat as unsorted
        }
      },
    };
  },
};
