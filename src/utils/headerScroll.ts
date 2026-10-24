import type { JSHandle } from '@playwright/test';
import type { StrategyContext } from '../types';
import { logDebug } from './debugUtils';

export const readVisibleHeaders = async ({ resolve, config, root }: StrategyContext): Promise<string[]> => {
    const texts = await resolve(config.headerSelector, root).allInnerTexts();
    return texts.map(t => t.trim());
};

/** Shared horizontal discovery for generic, Glide and RDG strategies. */
export async function scrollAndCollectHeaders(
    context: StrategyContext,
    findScroller: () => Promise<JSHandle<Element | null>>,
    options: { limit?: number; scrollAmount?: number; notFoundMessage: string; emptyHeader?: string },
): Promise<string[]> {
    const { config, page, resolve, root } = context;
    const limit = options.limit ?? 20;
    const scrollAmount = options.scrollAmount ?? 300;
    const scrollerHandle = await findScroller();
    let found = false;
    try {
        found = await scrollerHandle.evaluate(el => !!el);
        if (!found) {
            logDebug(config, 'info', options.notFoundMessage);
            return (await readVisibleHeaders(context)).map(h => h || options.emptyHeader || '');
        }

        // Position identifies a column, whereas its label may legitimately repeat.
        // Prefer the grid's logical index; otherwise use the header's content-space X.
        const collected = new Map<string, { name: string; position: number }>();
        const collect = async () => {
            const scrollLeft = await scrollerHandle.evaluate(el => el!.scrollLeft);
            const headers = await resolve(config.headerSelector, root).evaluateAll((elements, offset) =>
                elements.map(el => ({
                    name: (el as HTMLElement).innerText.trim(),
                    index: el.getAttribute('aria-colindex'),
                    x: el.getBoundingClientRect().left + offset,
                })), scrollLeft);
            for (const header of headers) {
                const index = header.index?.trim() ? Number(header.index) : NaN;
                const indexed = Number.isFinite(index);
                const position = indexed ? index : Math.round(header.x);
                const key = `${indexed ? 'index' : 'x'}_${position}`;
                collected.set(key, { name: header.name || options.emptyHeader || '', position });
            }
        };

        await scrollerHandle.evaluate(el => el!.scrollLeft = 0);
        await page.waitForTimeout(200);
        await collect();
        for (let i = 0; i < limit; i++) {
            const before = await scrollerHandle.evaluate(el => el!.scrollLeft);
            // Overlap windows even when a configured step exceeds the viewport width.
            await scrollerHandle.evaluate((el, amount) => {
                el!.scrollLeft += Math.min(amount, el!.clientWidth);
            }, scrollAmount);
            await page.waitForTimeout(300);
            await collect();
            const after = await scrollerHandle.evaluate(el => el!.scrollLeft);
            if (after === before) break;
        }
        return [...collected.values()].sort((a, b) => a.position - b.position).map(h => h.name);
    } finally {
        try {
            if (found) {
                await scrollerHandle.evaluate(el => el!.scrollLeft = 0);
                await page.waitForTimeout(200);
            }
        } finally {
            await scrollerHandle.dispose();
        }
    }
}
