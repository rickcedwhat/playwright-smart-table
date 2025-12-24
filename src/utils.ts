// src/utils.ts
import { Page } from '@playwright/test';

/**
 * Internal helper to wait for a condition to be met.
 * Replaces the dependency on 'expect(...).toPass()' to ensure compatibility
 * with environments where 'expect' is not globally available.
 */
export const waitForCondition = async (
  predicate: () => Promise<boolean>, 
  timeout: number, 
  page: Page
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
