// src/strategies/pagination.ts
import type { PaginationStrategy, Selector, TableContext } from '../types';
import { waitForCondition } from '../utils';

import { StabilizationStrategies, StabilizationStrategy } from './stabilization';

export const PaginationStrategies = {
  /**
   * Strategy: Clicks a "Next" button and waits for stabilization.
   * @param nextButtonSelector Selector for the next page button.
   * @param options.stabilization Strategy to determine when the page has updated.
   *        Defaults to `contentChanged({ scope: 'first' })`.
   * @param options.timeout Timeout for the click action.
   */
  clickNext: (nextButtonSelector: Selector, options: {
    stabilization?: StabilizationStrategy,
    timeout?: number
  } = {}): PaginationStrategy => {
    return async (context: TableContext) => {
      const { root, resolve, page } = context;
      const nextBtn = resolve(nextButtonSelector, root).first();

      if (!await nextBtn.isVisible() || !await nextBtn.isEnabled()) {
        return false;
      }

      // Default stabilization: Wait for first row content to change
      const stabilization = options.stabilization ??
        StabilizationStrategies.contentChanged({ scope: 'first', timeout: options.timeout });

      // Stabilization: Wrap action
      const success = await stabilization(context, async () => {
        await nextBtn.click({ timeout: 2000 }).catch(() => { });
      });
      return success;
    };
  },

  /**
   * Strategy: Infinite Scroll (generic).
   * Supports both simple "Scroll to Bottom" and "Virtualized Scroll".
   * 
   * @param options.action 'scroll' (mouse wheel) or 'js-scroll' (direct scrollTop).
   * @param options.scrollTarget Selector for the scroll container (defaults to table root).
   * @param options.scrollAmount Amount to scroll in pixels (default 500).
   * @param options.stabilization Strategy to determine if new content loaded.
   *        Defaults to `rowCountIncreased` (simple append).
   *        Use `contentChanged` for virtualization.
   */
  infiniteScroll: (options: {
    action?: 'scroll' | 'js-scroll',
    scrollTarget?: Selector,
    scrollAmount?: number,
    stabilization?: StabilizationStrategy,
    timeout?: number
  } = {}): PaginationStrategy => {
    return async (context: TableContext) => {
      const { root, resolve, page } = context;
      const scrollTarget = options.scrollTarget
        ? resolve(options.scrollTarget, root)
        : root;

      // Default stabilization: Wait for row count to increase (Append mode)
      const stabilization = options.stabilization ??
        StabilizationStrategies.rowCountIncreased({ timeout: options.timeout });

      const amount = options.scrollAmount ?? 500;

      const doScroll = async () => {
        const box = await scrollTarget.boundingBox();
        // Action: Scroll
        if (options.action === 'js-scroll' || !box) {
          await scrollTarget.evaluate((el: HTMLElement, y: number) => {
            el.scrollTop += y;
          }, amount);
        } else {
          // Mouse Wheel
          await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
          await page.mouse.wheel(0, amount);
        }
      };

      // Stabilization: Wait
      const success = await stabilization(context, doScroll);
      return success;
    };
  }
};
