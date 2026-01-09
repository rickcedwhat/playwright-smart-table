import { StrategyContext } from '../types';

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
        const headerLoc = resolve(config.headerSelector, root);
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
     * Scans for headers by finding a scrollable container and setting scrollLeft.
     */
    scrollRight: async (context: StrategyContext, options?: { limit?: number, selector?: string, scrollAmount?: number }): Promise<string[]> => {
        const { resolve, config, root, page } = context;
        const limit = options?.limit ?? 20;
        const scrollAmount = options?.scrollAmount ?? 300;
        const collectedHeaders = new Set<string>();

        const getVisible = async () => {
            const headerLoc = resolve(config.headerSelector, root);
            const texts = await headerLoc.allInnerTexts();
            return texts.map(t => t.trim());
        };

        // Initial capture
        let currentHeaders = await getVisible();
        currentHeaders.forEach(h => collectedHeaders.add(h));

        // Find scroller using JS for better iframe/shadow support
        const scrollerHandle = await root.evaluateHandle((el, selector) => {
            if (selector && el.matches(selector)) return el;
            const effectiveSelector = selector || '.dvn-scroller';
            const ancestor = el.closest(effectiveSelector);
            if (ancestor) return ancestor;
            return document.querySelector(effectiveSelector);
        }, options?.selector);

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
            console.warn("HeaderStrategies.scrollRight: Could not find scroller. Returning visible headers.");
        }

        // Scroll back to start
        await scrollerHandle.evaluate(el => el!.scrollLeft = 0);
        await page.waitForTimeout(200);

        return Array.from(collectedHeaders);
    },

    /**
     * Strategy that clicks into the table to establish focus and then uses the Right Arrow key
     * to navigate cell-by-cell, collecting headers found along the way.
     */
    keyboard: async (context: StrategyContext, options?: { limit?: number, maxSilentClicks?: number }): Promise<string[]> => {
        const { resolve, config, root, page } = context;
        const limit = options?.limit ?? 100;
        const maxSilentClicks = options?.maxSilentClicks ?? 10;
        const collectedHeaders = new Set<string>();

        const getVisible = async () => {
            const headerLoc = resolve(config.headerSelector, root);
            const texts = await headerLoc.allInnerTexts();
            return texts.map(t => t.trim());
        };

        // 1. Initial capture
        let currentHeaders = await getVisible();
        currentHeaders.forEach(h => collectedHeaders.add(h));

        // 2. Click to focus
        // Try to find the canvas sibling specifically for Glide, otherwise click root
        const canvas = root.locator('xpath=ancestor::div').locator('canvas').first();
        if (await canvas.count() > 0) {
            // Click lower in the canvas to hit a data cell instead of header
            // Adjusted to y=60 to target Row 1
            await canvas.click({ position: { x: 50, y: 60 }, force: true }).catch(() => { });
        } else {
            await root.click({ position: { x: 10, y: 10 }, force: true }).catch(() => { });
        }

        // Reset to home
        await page.keyboard.press('Control+Home');
        await page.keyboard.press('Home');
        // Wait for potential scroll/focus reset
        await page.evaluate(() => new Promise(requestAnimationFrame));

        currentHeaders = await getVisible();
        currentHeaders.forEach(h => collectedHeaders.add(h));

        // 3. Navigate right loop
        let silentCounter = 0;
        for (let i = 0; i < limit; i++) {
            const sizeBefore = collectedHeaders.size;

            await page.keyboard.press('ArrowRight');
            // Small breathing room for key press to register
            await page.evaluate(() => new Promise(requestAnimationFrame));


            const newHeaders = await getVisible();
            newHeaders.forEach(h => collectedHeaders.add(h));

            if (collectedHeaders.size === sizeBefore) {
                silentCounter++;
            } else {
                silentCounter = 0;
            }

            if (silentCounter >= maxSilentClicks) {
                break;
            }
        }

        return Array.from(collectedHeaders);
    },
};
