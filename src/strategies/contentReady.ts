import type { Locator, Page } from '@playwright/test';

export type ContentReadyStrategy = (row: Locator, page: Page) => Promise<void>;

export const ContentReadyStrategies = {
    /**
     * Polls the row's text content until two consecutive reads match.
     * Handles recycling virtualizers where position updates synchronously
     * but React renders cell content asynchronously.
     */
    textStable: (options: { timeout?: number; interval?: number } = {}): ContentReadyStrategy => {
        const timeout = options.timeout ?? 500;
        const interval = options.interval ?? 50;
        return async (row: Locator, page: Page) => {
            let prev = await row.innerText().catch(() => '');
            const deadline = Date.now() + timeout;
            while (Date.now() < deadline) {
                await page.waitForTimeout(interval);
                const cur = await row.innerText().catch(() => '');
                if (cur === prev) return;
                prev = cur;
            }
        };
    },
};
