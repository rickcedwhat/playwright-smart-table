// src/strategies/index.ts
import { expect } from '@playwright/test';
import { PaginationStrategy, Selector, TableContext } from '../types';

export const TableStrategies = {
  /**
   * Strategy: Clicks a "Next" button and waits for the first row of data to change.
   * Best for: Standard pagination (Page 1 > Page 2 > Page 3)
   * * @param nextButtonSelector - Selector for the next button (e.g. 'button.next' or getByRole('button', {name: 'Next'}))
   * @param timeout - How long to wait for the table to refresh (default: 5000ms)
   */
  clickNext: (nextButtonSelector: Selector, timeout = 5000): PaginationStrategy => {
    return async ({ root, config, resolve }: TableContext) => {
      // 1. Find the button using the table's helper
      const nextBtn = resolve(nextButtonSelector, root).first();

      // If button isn't there or disabled, we are at the end
      if (!await nextBtn.isVisible() || !await nextBtn.isEnabled()) {
        return false;
      }

      // 2. Snapshot the current state (text of the first row)
      // We use the table's OWN row selector to ensure we are looking at real data
      const firstRow = resolve(config.rowSelector, root).first();
      const oldText = await firstRow.innerText().catch(() => ""); // Handle empty tables gracefully

      // 3. Click the button
      await nextBtn.click();

      // 4. Smart Wait: Wait for the first row to have DIFFERENT text
      try {
        await expect(firstRow).not.toHaveText(oldText, { timeout });
        return true; // Success: Data changed
      } catch (e) {
        return false; // Failed: Timed out (probably end of data or broken button)
      }
    };
  },

  /**
   * Strategy: Clicks a "Load More" button and waits for the row count to increase.
   * Best for: Lists where "Load More" appends data to the bottom.
   * * @param buttonSelector - Selector for the load more button
   * @param timeout - Wait timeout (default: 5000ms)
   */
  clickLoadMore: (buttonSelector: Selector, timeout = 5000): PaginationStrategy => {
    return async ({ root, config, resolve }: TableContext) => {
      const loadMoreBtn = resolve(buttonSelector, root).first();

      if (!await loadMoreBtn.isVisible() || !await loadMoreBtn.isEnabled()) {
        return false;
      }

      // 1. Snapshot: Count current rows
      const rows = resolve(config.rowSelector, root);
      const oldCount = await rows.count();

      // 2. Click
      await loadMoreBtn.click();

      // 3. Smart Wait: Wait for row count to be greater than before
      try {
        await expect(async () => {
          const newCount = await rows.count();
          expect(newCount).toBeGreaterThan(oldCount);
        }).toPass({ timeout });
        
        return true;
      } catch (e) {
        return false;
      }
    };
  },

  /**
   * Strategy: Scrolls a specific container (or the window) to the bottom.
   * Best for: Infinite Scroll grids (Ag-Grid, Virtual Lists)
   * * @param options.timeout - Wait timeout (default: 5000ms)
   * @param options.scrollerSelector - (Optional) Selector for the scrollable container. 
   * If omitted, tries to scroll the table root.
   * @param options.interval - (Optional) Polling interval in ms (default: 1000ms)
   */
  infiniteScroll: (options?: { timeout?: number, scrollerSelector?: Selector, interval?: number }): PaginationStrategy => {
    const { timeout = 5000, scrollerSelector, interval = 1000 } = options || {};

    return async ({ root, config, resolve, page }: TableContext) => {
      const rows = resolve(config.rowSelector, root);
      const oldCount = await rows.count();

      if (oldCount === 0) return false;

      // Aggressive Scroll Logic:
      // We use expect.poll to RETRY the scroll action if the count hasn't increased.
      // This fixes flakiness where the first scroll might be missed by the intersection observer.
      try {
        await expect.poll(async () => {
          // 1. Determine target container
          // If user provided a specific scroller (e.g. the div WRAPPING the table), use it.
          // Otherwise, default to the root locator.
          const scroller = scrollerSelector 
            ? resolve(scrollerSelector, root) 
            : root;

          // 2. Perform the Scroll
          // Method A: DOM Manipulation (Fastest/Most Reliable for containers)
          // We set scrollTop to a huge number to force it to the bottom
          await scroller.evaluate((el) => {
             el.scrollTop = el.scrollHeight;
          }).catch(() => {}); // Ignore if element doesn't support scrollTop (e.g. it's a window wrapper)

          // Method B: Playwright Native (Fallback)
          // Scroll the last row into view (good for Window scroll)
          await rows.last().scrollIntoViewIfNeeded().catch(() => {});

          // Method C: Keyboard (Desperation)
          await page.keyboard.press('End');

          // 3. Return count for assertion
          return rows.count();
        }, { 
          timeout,
          // ✅ FIX: Use user-provided interval (default 1000ms)
          intervals: [interval] 
        }).toBeGreaterThan(oldCount);

        return true;
      } catch (e) {
        return false;
      }
    };
  }
};