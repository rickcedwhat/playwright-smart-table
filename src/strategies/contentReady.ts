import type { Locator, Page } from '@playwright/test';
import type { ContentReadyStrategy } from '../types';

export type { ContentReadyStrategy };

export const ContentReadyStrategies = {
    /**
     * Polls the row's text content until two consecutive reads match.
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

    /**
     * Uses MutationObserver to wait for DOM mutations on the row's subtree
     * to settle. Resolves when no mutations occur for `quietPeriod` ms, or
     * when `timeout` expires.
     */
    mutationSettled: (options: { timeout?: number; quietPeriod?: number } = {}): ContentReadyStrategy => {
        const timeout = options.timeout ?? 500;
        const quietPeriod = options.quietPeriod ?? 100;
        return async (row: Locator) => {
            await row.evaluate(
                (el, opts) => {
                    return new Promise<void>((resolve) => {
                        let quietTimer: ReturnType<typeof setTimeout>;
                        let deadlineTimer: ReturnType<typeof setTimeout>;

                        const done = () => {
                            clearTimeout(quietTimer);
                            clearTimeout(deadlineTimer);
                            observer.disconnect();
                            resolve();
                        };

                        const observer = new MutationObserver(() => {
                            clearTimeout(quietTimer);
                            quietTimer = setTimeout(done, opts.quietPeriod);
                        });

                        observer.observe(el, {
                            childList: true,
                            subtree: true,
                            characterData: true,
                        });

                        quietTimer = setTimeout(done, opts.quietPeriod);
                        deadlineTimer = setTimeout(done, opts.timeout);
                    });
                },
                { timeout, quietPeriod },
            );
        };
    },
};
