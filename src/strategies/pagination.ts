// src/strategies/pagination.ts
import type { PaginationStrategy, Selector, TableContext } from '../types';
import { waitForCondition } from '../utils';

import { StabilizationStrategies, StabilizationStrategy } from './stabilization';

export const PaginationStrategies = {  /**
   * Strategy: Classic Pagination Buttons.
   * Clicks 'Next', 'Previous', or 'First' buttons and waits for stabilization.
   * 
   * @param selectors Selectors for pagination buttons.
   * @param options.stabilization Strategy to determine when the page has updated.
   *        Defaults to `contentChanged({ scope: 'first' })`.
   * @param options.timeout Timeout for the click action.
   */
  click: (selectors: {
    next?: Selector,
    previous?: Selector,
    nextBulk?: Selector,
    previousBulk?: Selector,
    first?: Selector,
  }, options: {
    nextBulkPages?: number,
    previousBulkPages?: number,
    stabilization?: StabilizationStrategy,
    timeout?: number
  } = {}): PaginationStrategy => {
    const defaultStabilize = options.stabilization ?? StabilizationStrategies.contentChanged({ scope: 'first', timeout: options.timeout });

    const createClicker = (selector?: Selector, returnVal: boolean | number = true) => {
      if (!selector) return undefined;
      return async (context: TableContext): Promise<any> => {
        const { root, resolve } = context;
        const btn = resolve(selector, root).first();

        if (!btn || !await btn.isVisible() || !await btn.isEnabled()) {
          return false;
        }

        return await defaultStabilize(context, async () => {
          await btn.click({ timeout: 2000 }).catch(() => { });
        }).then(stabilized => stabilized ? returnVal : false);
      };
    };

    const nextBulk = options.nextBulkPages ?? 10;
    const prevBulk = options.previousBulkPages ?? 10;
    return {
      goNext: createClicker(selectors.next),
      goPrevious: createClicker(selectors.previous),
      goNextBulk: createClicker(selectors.nextBulk, nextBulk),
      goPreviousBulk: createClicker(selectors.previousBulk, prevBulk),
      goToFirst: createClicker(selectors.first),
      nextBulkPages: nextBulk,
      previousBulkPages: prevBulk,
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

    // Default stabilization: Wait for row count to increase (Append mode)
    const stabilization = options.stabilization ??
      StabilizationStrategies.rowCountIncreased({ timeout: options.timeout });
    const amount = options.scrollAmount ?? 500;

    const createScroller = (directionMultiplier: 1 | -1) => {
      return async (context: TableContext) => {
        const { root, resolve, page } = context;
        const scrollTarget = options.scrollTarget
          ? resolve(options.scrollTarget, root)
          : root;

        const doScroll = async () => {
          const box = await scrollTarget.boundingBox();
          const scrollValue = amount * directionMultiplier;

          // Action: Scroll
          if (options.action === 'js-scroll' || !box) {
            await scrollTarget.evaluate((el: HTMLElement, y: number) => {
              el.scrollTop += y;
            }, scrollValue);
          } else {
            // Mouse Wheel
            await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
            await page.mouse.wheel(0, scrollValue);
          }
        };

        // Stabilization: Wait
        return await stabilization(context, doScroll);
      };
    };

    const createGoToFirst = () => {
      return async (context: TableContext) => {
        const { root, resolve } = context;
        const scrollTarget = options.scrollTarget
          ? resolve(options.scrollTarget, root)
          : root;

        const doScroll = async () => {
          await scrollTarget.evaluate((el: HTMLElement) => {
            el.scrollTop = 0;
            el.scrollLeft = 0;
          });
        };

        // Stabilization: Wait for content to reset
        return await stabilization(context, doScroll);
      };
    };

    return {
      goNext: createScroller(1),
      goPrevious: createScroller(-1),
      goToFirst: createGoToFirst()
    };
  }
};
