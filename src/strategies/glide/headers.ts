import { StrategyContext, Selector } from '../../types';

/**
 * Scans for headers by finding a scrollable container and setting scrollLeft.
 */
export const scrollRightHeader = async (context: StrategyContext, options?: { limit?: number, selector?: string, scrollAmount?: number }): Promise<string[]> => {
    const { resolve, config, root, page } = context;
    const limit = options?.limit ?? 20;
    const scrollAmount = options?.scrollAmount ?? 300;
    const collectedHeaders = new Set<string>();

    const getVisible = async () => {
        const headerLoc = resolve(config.headerSelector as Selector, root);
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
};
