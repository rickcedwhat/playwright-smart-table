// fallow-ignore-file circular-dependency
import type { StrategyContext, Selector } from '../types';
import { logDebug } from '../utils/debugUtils';

/**
 * Defines the contract for a header retrieval strategy.
 * Returns a list of unique header names found in the table.
 */
export type HeaderStrategy = (context: StrategyContext) => Promise<string[]>;

export const HeaderStrategies = {
    /**
     * Default strategy: Returns only the headers currently visible in the DOM.
     * This is fast but won't find virtualized columns off-screen.
     */
    visible: async ({ config, resolve, root }: StrategyContext): Promise<string[]> => {
        const headerLoc = resolve(config.headerSelector as Selector, root);
        try {
            // Wait for at least one header to be visible
            await headerLoc.first().waitFor({ state: 'visible', timeout: 3000 });
        } catch (e) {
            // Ignore hydration/timeout issues, return what we have
        }

        const texts = await headerLoc.allInnerTexts();
        return texts.map(t => t.trim());
    },

    /**
     * Physically scrolls the table horizontally to force virtualized columns to mount,
     * collecting their names along the way.
     *
     * **Requires `selector`** — the CSS selector for the horizontal scroll container
     * (e.g. `.dvn-scroller` for Glide, `.rdg-viewport` for RDG). Framework class names
     * belong in presets / your config, not in this generic factory. Without `selector`,
     * only currently visible headers are returned (no scrolling).
     */
    horizontalScroll: (options?: { limit?: number, selector?: string, scrollAmount?: number }): HeaderStrategy => {
        return async (context: StrategyContext): Promise<string[]> => {
            const { resolve, config, root, page } = context;
            const limit = options?.limit ?? 20;
            const scrollAmount = options?.scrollAmount ?? 300;
            const collectedHeaders = new Set<string>();

            const getVisible = async () => {
                const headerLoc = resolve(config.headerSelector as Selector, root);
                const texts = await headerLoc.allInnerTexts();
                return texts.map(t => t.trim());
            };

            let currentHeaders = await getVisible();
            currentHeaders.forEach(h => collectedHeaders.add(h));

            const selector = options?.selector;
            if (!selector) {
                logDebug(
                    config,
                    'info',
                    'HeaderStrategies.horizontalScroll: no selector provided — returning visible headers only. Pass { selector } for the scroll container (e.g. ".dvn-scroller").',
                );
                return Array.from(collectedHeaders);
            }

            const scrollerHandle = await root.evaluateHandle((el, sel) => {
                if (el.matches(sel)) return el;
                const ancestor = el.closest(sel);
                if (ancestor) return ancestor;
                const child = el.querySelector(sel);
                if (child) return child;
                return null;
            }, selector);

            const isScrollerFound = await scrollerHandle.evaluate(el => !!el);

            if (isScrollerFound) {
                await scrollerHandle.evaluate(el => el!.scrollLeft = 0);
                await page.waitForTimeout(200);

                for (let i = 0; i < limit; i++) {
                    const sizeBefore = collectedHeaders.size;

                    await scrollerHandle.evaluate((el, amount) => el!.scrollLeft += amount, scrollAmount);
                    await page.waitForTimeout(300);

                    const newHeaders = await getVisible();
                    newHeaders.forEach(h => collectedHeaders.add(h));

                    if (collectedHeaders.size === sizeBefore) {
                        await scrollerHandle.evaluate((el, amount) => el!.scrollLeft += amount, scrollAmount);
                        await page.waitForTimeout(300);
                        const retryHeaders = await getVisible();
                        retryHeaders.forEach(h => collectedHeaders.add(h));
                        if (collectedHeaders.size === sizeBefore) break;
                    }
                }
            } else {
                logDebug(config, 'info', `HeaderStrategies.horizontalScroll: Could not find scroller matching "${selector}". Returning visible headers.`);
            }

            if (isScrollerFound) {
                await scrollerHandle.evaluate(el => el!.scrollLeft = 0);
                await page.waitForTimeout(200);
            }

            return Array.from(collectedHeaders);
        };
    }
};
