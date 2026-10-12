import { describe, expect, it, vi } from 'vitest';
import { memoizeViewport as createCache } from '../../src/utils/memoizeViewport';
import type { TableContext, ViewportStrategy } from '../../src/types';

const context = {} as TableContext;
const oldRange = { first: 0, last: 0 };
const freshRange = { first: 1, last: 2 };
const memoizeViewport = (viewport: ViewportStrategy) => createCache(viewport).viewport;

describe('navigation-scoped viewport cache', () => {
    it('shares geometry queries within navigation, but refreshes on the next operation', async () => {
        const columns = vi.fn().mockResolvedValueOnce(oldRange).mockResolvedValue(freshRange);
        const rows = vi.fn().mockResolvedValue(oldRange);
        const viewport = { getVisibleColumnRange: columns, getVisibleRowRange: rows };
        const first = memoizeViewport(viewport);
        expect(await Promise.all([first.getVisibleColumnRange!(context), first.getVisibleColumnRange!(context)])).toEqual([oldRange, oldRange]);
        await first.getVisibleRowRange!(context);
        await first.getVisibleRowRange!(context);
        expect(columns).toHaveBeenCalledOnce();
        expect(rows).toHaveBeenCalledOnce();
        expect(await memoizeViewport(viewport).getVisibleColumnRange!(context)).toEqual(freshRange);
        expect(columns).toHaveBeenCalledTimes(2);
    });

    it('honors disableCache for repeated queries within navigation', async () => {
        const columns = vi.fn().mockResolvedValueOnce(oldRange).mockResolvedValue(freshRange);
        const viewport = memoizeViewport({ disableCache: true, getVisibleColumnRange: columns });
        expect(await viewport.getVisibleColumnRange!(context)).toEqual(oldRange);
        expect(await viewport.getVisibleColumnRange!(context)).toEqual(freshRange);
        expect(columns).toHaveBeenCalledTimes(2);
    });

    for (const method of ['scrollToColumn', 'scrollToRow'] as const) {
        it(`${method} invalidates both ranges and a late query cannot repopulate them`, async () => {
            let release!: (value: typeof oldRange) => void;
            const pending = new Promise<typeof oldRange>(resolve => { release = resolve; });
            const columns = vi.fn().mockReturnValueOnce(pending).mockResolvedValue(freshRange);
            const rows = vi.fn().mockResolvedValueOnce(oldRange).mockResolvedValue(freshRange);
            const viewport = memoizeViewport({ getVisibleColumnRange: columns, getVisibleRowRange: rows, [method]: async () => {} });
            const oldQuery = viewport.getVisibleColumnRange!(context);
            await viewport.getVisibleRowRange!(context);
            await viewport[method]!(context, 1);
            expect(await viewport.getVisibleColumnRange!(context)).toEqual(freshRange);
            expect(await viewport.getVisibleRowRange!(context)).toEqual(freshRange);
            release(oldRange);
            expect(await oldQuery).toEqual(oldRange);
            expect(await viewport.getVisibleColumnRange!(context)).toEqual(freshRange);
            expect(columns).toHaveBeenCalledTimes(2);
            expect(rows).toHaveBeenCalledTimes(2);
        });
    }

    it('discards geometry queried while a scroll is in progress', async () => {
        let finish!: () => void;
        const moving = new Promise<void>(resolve => { finish = resolve; });
        const transitional = { first: 1, last: 1 };
        const columns = vi.fn().mockResolvedValueOnce(oldRange).mockResolvedValueOnce(transitional).mockResolvedValue(freshRange);
        const viewport = memoizeViewport({ getVisibleColumnRange: columns, scrollToColumn: () => moving });
        await viewport.getVisibleColumnRange!(context);
        const scroll = viewport.scrollToColumn!(context, 1);
        expect(await viewport.getVisibleColumnRange!(context)).toEqual(transitional);
        finish();
        await scroll;
        expect(await viewport.getVisibleColumnRange!(context)).toEqual(freshRange);
    });

    it('clears cached geometry even when a scroll fails', async () => {
        const error = new Error('scroll failed');
        const columns = vi.fn().mockResolvedValueOnce(oldRange).mockResolvedValue(freshRange);
        const viewport = memoizeViewport({ getVisibleColumnRange: columns, scrollToColumn: async () => { throw error; } });
        await viewport.getVisibleColumnRange!(context);
        await expect(viewport.scrollToColumn!(context, 1)).rejects.toBe(error);
        expect(await viewport.getVisibleColumnRange!(context)).toEqual(freshRange);
    });

    it('never memoizes row membership', async () => {
        const indices = vi.fn().mockResolvedValueOnce([0]).mockResolvedValue([0, 1]);
        const viewport: ViewportStrategy = memoizeViewport({ getVisibleRowIndices: indices });
        expect(await viewport.getVisibleRowIndices!(context)).toEqual([0]);
        expect(await viewport.getVisibleRowIndices!(context)).toEqual([0, 1]);
    });

    it('can discard pre-scroll geometry when another participant moves the viewport', async () => {
        const columns = vi.fn().mockResolvedValueOnce(oldRange).mockResolvedValue(freshRange);
        const cache = createCache({ getVisibleColumnRange: columns });
        await cache.viewport.getVisibleColumnRange!(context);
        cache.clear();
        expect(await cache.viewport.getVisibleColumnRange!(context)).toEqual(freshRange);
    });
});
