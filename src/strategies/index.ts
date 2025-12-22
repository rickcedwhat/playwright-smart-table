// src/strategies/index.ts
import { PaginationStrategy, Selector, TableContext } from '../types';

/**
 * Internal helper to wait for a condition to be met.
 * Replaces the dependency on 'expect(...).toPass()' to ensure compatibility
 * with environments like QA Wolf where 'expect' is not globally available.
 */
const waitForCondition = async (
  predicate: () => Promise<boolean>, 
  timeout: number, 
  page: any // Context page for pauses
): Promise<boolean> => {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    if (await predicate()) {
      return true;
    }
    // Wait 100ms before next check (Standard Polling)
    await page.waitForTimeout(100).catch(() => new Promise(r => setTimeout(r, 100)));
  }
  
  return false;
};

export const TableStrategies = {
  /**
   * Strategy: Clicks a "Next" button and waits for the first row of data to change.
   */
  clickNext: (nextButtonSelector: Selector, timeout = 5000): PaginationStrategy => {
    return async ({ root, config, resolve, page }: TableContext) => {
      const nextBtn = resolve(nextButtonSelector, root).first();

      // Debug log (can be verbose, maybe useful for debugging only)
      // console.log(`[Strategy: clickNext] Checking button...`);

      // Check if button exists/enabled before clicking.
      // We do NOT wait here because if the button isn't visible/enabled, 
      // we assume we reached the last page.
      if (!await nextBtn.isVisible()) {
        console.log(`[Strategy: clickNext] Button not visible. Stopping pagination.`);
        return false;
      }
      
      if (!await nextBtn.isEnabled()) {
         console.log(`[Strategy: clickNext] Button disabled. Stopping pagination.`);
         return false;
      }

      // 1. Snapshot current state
      const firstRow = resolve(config.rowSelector, root).first();
      const oldText = await firstRow.innerText().catch(() => ""); 

      // 2. Click
      console.log(`[Strategy: clickNext] Clicking next button...`);
      try {
        await nextBtn.click({ timeout: 2000 }); 
      } catch (e) {
        console.warn(`[Strategy: clickNext] Click failed (blocked or detached): ${e}`);
        return false;
      }

      // 3. Smart Wait (Polling)
      const success = await waitForCondition(async () => {
        const newText = await firstRow.innerText().catch(() => "");
        return newText !== oldText;
      }, timeout, page);

      if (!success) {
        console.warn(`[Strategy: clickNext] Warning: Table content did not change after clicking Next.`);
      }

      return success;
    };
  },

  /**
   * Strategy: Clicks a "Load More" button and waits for the row count to increase.
   */
  clickLoadMore: (buttonSelector: Selector, timeout = 5000): PaginationStrategy => {
    return async ({ root, config, resolve, page }: TableContext) => {
      const loadMoreBtn = resolve(buttonSelector, root).first();

      if (!await loadMoreBtn.isVisible() || !await loadMoreBtn.isEnabled()) {
        return false;
      }

      // 1. Snapshot count
      const rows = resolve(config.rowSelector, root);
      const oldCount = await rows.count();

      // 2. Click
      await loadMoreBtn.click();

      // 3. Smart Wait (Polling)
      return await waitForCondition(async () => {
        const newCount = await rows.count();
        return newCount > oldCount;
      }, timeout, page);
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

      // 1. Trigger Scroll
      await rows.last().scrollIntoViewIfNeeded();

      // 2. Smart Wait (Polling)
      return await waitForCondition(async () => {
        const newCount = await rows.count();
        return newCount > oldCount;
      }, timeout, page);
    };
  }
};