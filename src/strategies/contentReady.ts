import type { Locator, Page } from '@playwright/test';
import type { ContentReadyStrategy, RowReadyPredicate } from '../types';

function isTimeout(error: unknown): boolean {
    return (error as Error | undefined)?.name === 'TimeoutError';
}

/** Playwright < 1.62 has no `locator.waitForFunction`: poll with one `evaluate` per check. */
async function pollPredicate(row: Locator, page: Page, predicate: RowReadyPredicate<unknown>, arg: unknown, timeout: number, interval: number): Promise<void> {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
        if (await row.evaluate(predicate, arg, { timeout: Math.max(1, deadline - Date.now()) })) return;
        await page.waitForTimeout(Math.min(interval, Math.max(0, deadline - Date.now())));
    }
}

export const ContentReadyStrategies = {
    /**
     * Waits in the browser until `predicate(rowElement, arg)` returns a truthy value, e.g. until
     * a skeleton placeholder is gone or every cell has rendered. Resolves when `timeout` expires
     * even if the predicate never passed, like the other content-ready strategies.
     *
     * Uses `locator.waitForFunction` (Playwright 1.62+), which re-resolves the row on each retry
     * and polls without a round-trip per check. Older versions poll via `locator.evaluate`.
     * `timeout` and `interval` must be positive finite milliseconds. `interval` only controls
     * the older-version fallback; native polling is controlled by Playwright.
     *
     * @example
     * contentReady: Strategies.ContentReady.until(row => !row.querySelector('.skeleton'))
     */
    until: <Arg = undefined>(
        predicate: RowReadyPredicate<Arg>,
        options: { arg?: Arg; timeout?: number; interval?: number } = {}
    ): ContentReadyStrategy => {
        const timeout = options.timeout ?? 500;
        const interval = options.interval ?? 50;
        if (!Number.isFinite(timeout) || timeout <= 0) {
            throw new Error('ContentReady.until: timeout must be a positive finite number');
        }
        if (!Number.isFinite(interval) || interval <= 0) {
            throw new Error('ContentReady.until: interval must be a positive finite number');
        }
        const fn = predicate as RowReadyPredicate<unknown>;
        const arg: unknown = options.arg;
        return async (row: Locator, page: Page) => {
            try {
                if (typeof row.waitForFunction === 'function') {
                    await row.waitForFunction(fn, arg, { timeout });
                } else {
                    await pollPredicate(row, page, fn, arg, timeout, interval);
                }
            } catch (error) {
                if (!isTimeout(error)) throw error;
            }
        };
    },


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
