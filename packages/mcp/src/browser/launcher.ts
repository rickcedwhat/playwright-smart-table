import type { Browser, BrowserContext } from '@playwright/test';

export interface LaunchedBrowser {
  browser: Browser;
  context: BrowserContext;
}

/**
 * Launches a Playwright Chromium browser and returns the browser + context.
 * Headless by default; pass { headless: false } for interactive auth mode.
 */
export async function launchBrowser(options: { headless?: boolean; storageStatePath?: string } = {}): Promise<LaunchedBrowser> {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({ 
    headless: options.headless ?? true,
    args: options.headless ? [] : ['--start-maximized']
  });
  try {
    const contextOptions = {
      ...(options.storageStatePath ? { storageState: options.storageStatePath } : {}),
      viewport: null, // Critical: Allows window to control viewport size
    };
    const context = await browser.newContext(contextOptions);
    return { browser, context };
  } catch (err) {
    await browser.close().catch(() => undefined);
    throw err;
  }
}

/**
 * Gracefully closes the browser context and browser instance.
 */
export async function closeBrowser({ browser, context }: LaunchedBrowser): Promise<void> {
  await context.close().catch(() => undefined);
  await browser.close().catch(() => undefined);
}
