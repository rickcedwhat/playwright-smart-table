// src/strategies/index.ts
import { PaginationStrategy, Selector, TableContext } from '../types';

/**
 * Helper to get 'expect' safely in ANY environment.
 * 1. Tries global scope (QA Wolf / Cloud Runners).
 * 2. Tries local require (Standard Playwright).
 */
const getExpect = () => {
  // 1. Priority: Global (Environment injected)
  const globalExpect = (globalThis as any).expect;
  if (globalExpect) return globalExpect;

  // 2. Fallback: Module Import (Local development)
  // We use a try-catch with require to safely attempt loading the module
  // without crashing environments where the module doesn't exist.
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { expect } = require('@playwright/test');
    if (expect) return expect;
  } catch (e) {
    // Module not found or require not available.
  }

  // 3. Fatal Error
  throw new Error("@rickcedwhat/playwright-smart-table: 'expect' not found. Ensure you are running in a Playwright test.");
};

export const TableStrategies = {
  clickNext: (nextButtonSelector: Selector, timeout = 5000): PaginationStrategy => {
    return async ({ root, config, resolve }: TableContext) => {
      // ✅ LAZY LOAD: Safe for both Local & Cloud
      const expect = getExpect();
      
      const nextBtn = resolve(nextButtonSelector, root).first();

      if (!await nextBtn.isVisible() || !await nextBtn.isEnabled()) {
        return false;
      }

      const firstRow = resolve(config.rowSelector, root).first();
      const oldText = await firstRow.innerText().catch(() => ""); 

      await nextBtn.click();

      try {
        await expect(firstRow).not.toHaveText(oldText, { timeout });
        return true; 
      } catch (e) {
        return false; 
      }
    };
  },

  clickLoadMore: (buttonSelector: Selector, timeout = 5000): PaginationStrategy => {
    return async ({ root, config, resolve }: TableContext) => {
      const expect = getExpect(); // ✅ LAZY LOAD
      const loadMoreBtn = resolve(buttonSelector, root).first();

      if (!await loadMoreBtn.isVisible() || !await loadMoreBtn.isEnabled()) {
        return false;
      }

      const rows = resolve(config.rowSelector, root);
      const oldCount = await rows.count();

      await loadMoreBtn.click();

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

  infiniteScroll: (timeout = 5000): PaginationStrategy => {
    return async ({ root, config, resolve, page }: TableContext) => {
      const expect = getExpect(); // ✅ LAZY LOAD
      const rows = resolve(config.rowSelector, root);
      const oldCount = await rows.count();

      if (oldCount === 0) return false;

      await rows.last().scrollIntoViewIfNeeded();
      await page.keyboard.press('End');

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
  }
};