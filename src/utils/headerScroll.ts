import type { JSHandle } from '@playwright/test';
import type { StrategyContext } from '../types';
import { logDebug } from './debugUtils';

export const readVisibleHeaders = async ({ resolve, config, root }: StrategyContext): Promise<string[]> => {
    const texts = await resolve(config.headerSelector, root).allInnerTexts();
    return texts.map(t => t.trim());
};

type HeaderGeometry = { name: string; index: string | null; x: number; screenX: number; width: number; node: number };

/** Runs in the browser, so it must not reference anything outside its own body. */
function readHeaderGeometry(elements: Element[], offset: number): HeaderGeometry[] {
    // Stable per-element ids let discovery tell a header that stayed put from a recycled node.
    const w = window as unknown as { __smartTableHeaderNodes?: WeakMap<Element, number>; __smartTableHeaderSeq?: number };
    if (!w.__smartTableHeaderNodes) w.__smartTableHeaderNodes = new WeakMap();
    const nodes = w.__smartTableHeaderNodes;
    return elements.map(el => {
        if (!nodes.has(el)) {
            w.__smartTableHeaderSeq = (w.__smartTableHeaderSeq || 0) + 1;
            nodes.set(el, w.__smartTableHeaderSeq);
        }
        const { left, width } = el.getBoundingClientRect();
        return {
            name: (el as HTMLElement).innerText.trim(),
            index: el.getAttribute('aria-colindex'),
            x: left + offset,
            screenX: left,
            width,
            node: nodes.get(el)!,
        };
    });
}

const logicalIndex = (header: HeaderGeometry): number | undefined => {
    const index = header.index?.trim() ? Number(header.index) : NaN;
    return Number.isFinite(index) ? index : undefined;
};

/** `candidates` holds every content x seen for a header that did not move with the content. */
type CollectedHeader = { name: string; index?: number; x: number; width: number; candidates?: number[] };
type Sighting = { key: string; screenX: number; scrollLeft: number };

const movedWithContent = (header: HeaderGeometry, scrollLeft: number, last: Sighting) =>
    Math.abs(header.screenX - (last.screenX - (scrollLeft - last.scrollLeft))) < 1.5;

const overlaps = (x: number, width: number, other: CollectedHeader) =>
    x < other.x + other.width - 1 && other.x < x + width - 1;

/**
 * A pinned header sits at its real table position only in some windows (the leftmost for
 * start-pinned, the rightmost for end-pinned); elsewhere it covers other columns.
 */
function placePinnedHeaders(headers: CollectedHeader[]): void {
    const scrolling = headers.filter(h => !h.candidates);
    for (const header of headers) {
        if (!header.candidates) continue;
        header.x = header.candidates.find(x => !scrolling.some(other => overlaps(x, header.width, other)))
            ?? header.candidates[0];
    }
}

/** Shared horizontal discovery for generic, Glide and RDG strategies. */
export async function scrollAndCollectHeaders(
    context: StrategyContext,
    findScroller: () => Promise<JSHandle<Element | null>>,
    options: { limit?: number; scrollAmount?: number; notFoundMessage: string; emptyHeader?: string; coverScrollRange?: boolean },
): Promise<string[]> {
    const { config, page, resolve, root } = context;
    let limit = options.limit ?? 20;
    const scrollAmount = options.scrollAmount ?? 300;
    const scrollerHandle = await findScroller();
    let found = false;
    try {
        found = await scrollerHandle.evaluate(el => !!el);
        if (!found) {
            logDebug(config, 'info', options.notFoundMessage);
            return (await readVisibleHeaders(context)).map(h => h || options.emptyHeader || '');
        }

        // RDG must retain full coverage when steps are narrowed to fit its viewport.
        // Derive a finite budget from the current scroll range; other callers keep their limit.
        if (options.coverScrollRange) {
            const steps = await scrollerHandle.evaluate((el, amount) => {
                const step = Math.min(amount, el!.clientWidth);
                return step > 0 ? Math.ceil((el!.scrollWidth - el!.clientWidth) / step) + 1 : 0;
            }, scrollAmount);
            limit = Math.max(limit, steps);
        }

        // Identity and ordering are separate: an index key is not a pixel coordinate.
        const collected = new Map<string, CollectedHeader>();
        // Latest sighting of each unindexed header element, keyed by node|name.
        const sightings = new Map<string, Sighting>();
        const recordUnindexed = (header: HeaderGeometry, name: string, scrollLeft: number) => {
            const id = `${header.node}|${name}`;
            const last = sightings.get(id);
            const entry = last && collected.get(last.key);
            if (!last || !entry || (!entry.candidates && movedWithContent(header, scrollLeft, last))) {
                // The label keeps a pinned header from replacing the column it is drawn over.
                const key = `x_${Math.round(header.x)}|${name}`;
                sightings.set(id, { key, screenX: header.screenX, scrollLeft });
                collected.set(key, { name, x: header.x, width: header.width });
                return;
            }
            // Same element and label, but it did not move with the content: the header is pinned
            // (or shifting into its pinned spot), however the page pins it.
            sightings.set(id, { key: last.key, screenX: header.screenX, scrollLeft });
            if (!entry.candidates) entry.candidates = [entry.x];
            entry.candidates.push(header.x);
        };
        const collect = async () => {
            const scrollLeft = await scrollerHandle.evaluate(el => el!.scrollLeft);
            const headers = await resolve(config.headerSelector, root).evaluateAll(readHeaderGeometry, scrollLeft);
            for (const header of headers) {
                const name = header.name || options.emptyHeader || '';
                const index = logicalIndex(header);
                if (index === undefined) recordUnindexed(header, name, scrollLeft);
                else collected.set(`index_${index}`, { name, index, x: header.x, width: header.width });
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
        const headers = [...collected.values()];
        placePinnedHeaders(headers);
        // Choose one coordinate system for the entire result, never per header.
        const allIndexed = headers.every(h => h.index !== undefined);
        return headers.sort((a, b) => allIndexed ? a.index! - b.index! : a.x - b.x).map(h => h.name);
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
