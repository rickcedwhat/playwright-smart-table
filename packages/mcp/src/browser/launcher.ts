import type { Browser, BrowserContext } from '@playwright/test';

export interface LaunchedBrowser {
  browser: Browser;
  context: BrowserContext;
}

/**
 * Launches a Playwright Chromium browser and returns the browser + context.
 * Headless by default; pass { headless: false } for interactive auth mode.
 */
export async function launchBrowser(options: { headless?: boolean } = {}): Promise<LaunchedBrowser> {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({ headless: options.headless ?? true });
  const context = await browser.newContext();
  return { browser, context };
}

/**
 * Gracefully closes the browser context and browser instance.
 */
export async function closeBrowser({ browser, context }: LaunchedBrowser): Promise<void> {
  await context.close().catch(() => undefined);
  await browser.close().catch(() => undefined);
}
