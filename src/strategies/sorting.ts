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
        const { getHeaderCell } = context;
        if (!getHeaderCell) throw new Error('getHeaderCell is required in StrategyContext for sorting.');
        // The table engine handles verify-and-retry. We only provide the trigger here.
        const targetHeader = await getHeaderCell(columnName);
        await targetHeader.click();
      },
      async getSortState({ columnName, context }) {
        const { getHeaderCell } = context;
        try {
          if (!getHeaderCell) throw new Error('getHeaderCell is required');
          const targetHeader = await getHeaderCell(columnName);
          const ariaSort = await targetHeader.getAttribute('aria-sort');

          if (ariaSort === 'ascending') return 'asc';
          if (ariaSort === 'descending') return 'desc';
          return 'none';
        } catch {
          return 'none'; // Header not found, so it's not sorted
        }
      },
    };
  },
};
