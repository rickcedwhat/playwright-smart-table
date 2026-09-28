import type { JSHandle } from '@playwright/test';
import type { StrategyContext } from '../types';
import { logDebug } from './debugUtils';

export const readVisibleHeaders = async ({ resolve, config, root }: StrategyContext): Promise<string[]> => {
    const texts = await resolve(config.headerSelector, root).allInnerTexts();
    return texts.map(t => t.trim());
};

/**
 * Horizontal header discovery shared by `HeaderStrategies.horizontalScroll` and the Glide preset:
 * reset the scroller to the left, step right collecting headers until two consecutive steps add
 * nothing (or `limit` is hit), then scroll back. Callers differ only in how they find the scroller.
 */
export async function scrollAndCollectHeaders(
    context: StrategyContext,
    findScroller: () => Promise<JSHandle<Element | null>>,
    options: { limit?: number; scrollAmount?: number; notFoundMessage: string },
): Promise<string[]> {
    const { config, page } = context;
    const limit = options.limit ?? 20;
    const scrollAmount = options.scrollAmount ?? 300;
    const collectedHeaders = new Set<string>(await readVisibleHeaders(context));

    const scrollerHandle = await findScroller();
    const isScrollerFound = await scrollerHandle.evaluate(el => !!el);
    if (!isScrollerFound) {
        logDebug(config, 'info', options.notFoundMessage);
        return Array.from(collectedHeaders);
    }

    const collectAfterStep = async () => {
        await scrollerHandle.evaluate((el, amount) => el!.scrollLeft += amount, scrollAmount);
        await page.waitForTimeout(300);
        (await readVisibleHeaders(context)).forEach(h => collectedHeaders.add(h));
    };

    await scrollerHandle.evaluate(el => el!.scrollLeft = 0);
    await page.waitForTimeout(200);

    for (let i = 0; i < limit; i++) {
        const sizeBefore = collectedHeaders.size;
        await collectAfterStep();
        if (collectedHeaders.size === sizeBefore) {
            await collectAfterStep();
            if (collectedHeaders.size === sizeBefore) break;
        }
    }

    await scrollerHandle.evaluate(el => el!.scrollLeft = 0);
    await page.waitForTimeout(200);

    return Array.from(collectedHeaders);
}
