// src/strategies/pagination.ts
import type { PaginationStrategy, Selector, TableContext } from '../types';
import { waitForCondition } from '../utils';

export const PaginationStrategies = {
  /**
   * Strategy: Clicks a "Next" button and waits for the first row of data to change.
   */
  clickNext: (nextButtonSelector: Selector, timeout = 5000): PaginationStrategy => {
    return async ({ root, config, resolve, page }: TableContext) => {
      const nextBtn = resolve(nextButtonSelector, root).first();

      if (!await nextBtn.isVisible() || !await nextBtn.isEnabled()) {
        return false;
      }

      const firstRow = resolve(config.rowSelector, root).first();
      const oldText = await firstRow.innerText().catch(() => "");

      await nextBtn.click({ timeout: 2000 }).catch(() => { });

      const success = await waitForCondition(async () => {
        const newText = await firstRow.innerText().catch(() => "");
        return newText !== oldText;
      }, timeout, page);

      return success;
    };
  },

  /**
   * Strategy: Scrolls to the bottom and waits for more rows to appear.
   */
  infiniteScroll: (timeout = 5000): PaginationStrategy => {
    return async ({ root, config, resolve, page }: TableContext) => {
      const rows = resolve(config.rowSelector, root);
      const oldCount = await rows.count();
      if (oldCount === 0) return false;

      await rows.last().scrollIntoViewIfNeeded();

      return await waitForCondition(async () => {
        const newCount = await rows.count();
        return newCount > oldCount;
      }, timeout, page);
    };
  }
};
