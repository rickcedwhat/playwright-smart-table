import type { SortingStrategy } from '../types';

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
        const { resolve, config, root } = context;
        const headerLoc = resolve(config.headerSelector, root);

        const headers = await headerLoc.all();
        const headerTexts = await Promise.all(headers.map(h => h.innerText()));

        const columnIndex = headerTexts.findIndex(text => text.trim() === columnName);
        if (columnIndex === -1) {
          throw new Error(`[AriaSort] Header with text "${columnName}" not found.`);
        }

        const targetHeader = headers[columnIndex];

        // Click repeatedly to cycle through sort states
        for (let i = 0; i < 3; i++) { // Max 3 clicks to prevent infinite loops (none -> asc -> desc)
          const currentState = await targetHeader.getAttribute('aria-sort');
          const mappedState = currentState === 'ascending' ? 'asc' : currentState === 'descending' ? 'desc' : 'none';

          if (mappedState === direction) {
            return; // Desired state achieved
          }
          await targetHeader.click();
        }

        throw new Error(`[AriaSort] Could not achieve sort direction "${direction}" for column "${columnName}" after 3 clicks.`);
      },
      async getSortState({ columnName, context }) {
        const { resolve, config, root } = context;
        const headerLoc = resolve(config.headerSelector, root);

        const headers = await headerLoc.all();
        const headerTexts = await Promise.all(headers.map(h => h.innerText()));

        const columnIndex = headerTexts.findIndex(text => text.trim() === columnName);
        if (columnIndex === -1) {
          return 'none'; // Header not found, so it's not sorted
        }

        const targetHeader = headers[columnIndex];
        const ariaSort = await targetHeader.getAttribute('aria-sort');

        if (ariaSort === 'ascending') return 'asc';
        if (ariaSort === 'descending') return 'desc';
        return 'none';
      },
    };
  },
};
