import type { Locator, Page } from '@playwright/test';
import type { ContentReadyStrategy } from '../types';

export type { ContentReadyStrategy };

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
            const deadline = Date.now() + timeout;
            const remaining = () => Math.max(0, deadline - Date.now());
            let prev = await row.innerText({ timeout: remaining() || timeout });
            while (remaining() > 0) {
                await page.waitForTimeout(Math.min(interval, remaining()));
                if (remaining() <= 0) break;
                const cur = await row.innerText({ timeout: remaining() });
                if (cur === prev) return;
                prev = cur;
            }
        };
    },
};
