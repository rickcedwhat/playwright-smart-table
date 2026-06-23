import { describe, it, expect, vi, beforeEach } from 'vitest';
import createSmartRow from '../../src/smartRow';
import { FinalTableConfig, PaginationPrimitives } from '../../src/types';

const emptyMap = new Map<string, number>();
const resolve = (sel: any, parent: any) => parent;

const makeRowLocator = () => ({
    scrollIntoViewIfNeeded: vi.fn().mockResolvedValue(undefined),
    page: vi.fn().mockReturnValue({}),
    count: vi.fn().mockResolvedValue(1),
});

const makeConfig = (pagination?: PaginationPrimitives): FinalTableConfig<any> => ({
    rowSelector: 'tr',
    headerSelector: 'th',
    cellSelector: 'td',
    strategies: { pagination },
    debug: { logLevel: 'none' },
} as any);

const makeTable = (currentPageIndex = 0) => ({ currentPageIndex });

describe('SmartRow.bringIntoView — cross-page navigation', () => {
    it('just scrolls when tablePageIndex is undefined', async () => {
        const row = makeRowLocator();
        const smart = createSmartRow(row as any, emptyMap, 0, makeConfig(), row as any, resolve, null);

        await smart.bringIntoView();

        expect(row.scrollIntoViewIfNeeded).toHaveBeenCalledOnce();
    });

    it('skips pagination when already on the target page (goToPage path)', async () => {
        const row = makeRowLocator();
        const goToPage = vi.fn().mockResolvedValue(true);
        const table = makeTable(2);
        const smart = createSmartRow(
            row as any, emptyMap, 0,
            makeConfig({ goToPage } as PaginationPrimitives),
            row as any, resolve, table as any,
            2 // tablePageIndex === currentPageIndex
        );

        await smart.bringIntoView();

        expect(goToPage).not.toHaveBeenCalled();
        expect(row.scrollIntoViewIfNeeded).toHaveBeenCalledOnce();
    });

    it('calls goToPage and updates currentPageIndex', async () => {
        const row = makeRowLocator();
        const goToPage = vi.fn().mockResolvedValue(true);
        const table = makeTable(0);
        const smart = createSmartRow(
            row as any, emptyMap, 0,
            makeConfig({ goToPage } as PaginationPrimitives),
            row as any, resolve, table as any,
            3
        );

        await smart.bringIntoView();

        expect(goToPage).toHaveBeenCalledWith(3, expect.any(Object));
        expect(table.currentPageIndex).toBe(3);
        expect(row.scrollIntoViewIfNeeded).toHaveBeenCalledOnce();
    });

    it('uses goNext steps via planNavigationPath for forward navigation', async () => {
        const row = makeRowLocator();
        const goNext = vi.fn().mockResolvedValue(true);
        const table = makeTable(0);
        const smart = createSmartRow(
            row as any, emptyMap, 0,
            makeConfig({ goNext } as PaginationPrimitives),
            row as any, resolve, table as any,
            2
        );

        await smart.bringIntoView();

        // planNavigationPath(0, 2, { goNext }) → [{ type: 'goNext', count: 2 }]
        expect(goNext).toHaveBeenCalledTimes(2);
        expect(table.currentPageIndex).toBe(2);
        expect(row.scrollIntoViewIfNeeded).toHaveBeenCalledOnce();
    });

    it('falls back to goToFirst + goNext loop when no backward primitives', async () => {
        // Going backward: currentPage=3, targetPage=1, only goToFirst+goNext available.
        // planNavigationPath returns [] since no goPrevious/goPreviousBulk/goToPage.
        // bringIntoView falls back to goToFirst() then goNext() targetPage times.
        const row = makeRowLocator();
        const goToFirst = vi.fn().mockResolvedValue(undefined);
        const goNext = vi.fn().mockResolvedValue(true);
        const table = makeTable(3);
        const smart = createSmartRow(
            row as any, emptyMap, 0,
            makeConfig({ goToFirst, goNext } as PaginationPrimitives),
            row as any, resolve, table as any,
            1
        );

        await smart.bringIntoView();

        expect(goToFirst).toHaveBeenCalledOnce();
        expect(goNext).toHaveBeenCalledTimes(1);
        expect(table.currentPageIndex).toBe(1);
        expect(row.scrollIntoViewIfNeeded).toHaveBeenCalledOnce();
    });

    it('throws when going backward with no backward primitives and no goToFirst', async () => {
        // currentPage=3, target=1, only goNext — no goPrevious, no goToFirst.
        // planNavigationPath returns []; no fallback → throws.
        const row = makeRowLocator();
        const goNext = vi.fn().mockResolvedValue(true);
        const table = makeTable(3);
        const smart = createSmartRow(
            row as any, emptyMap, 0,
            makeConfig({ goNext } as PaginationPrimitives),
            row as any, resolve, table as any,
            1
        );

        await expect(smart.bringIntoView()).rejects.toThrow(/Cannot bring row on page 1 into view/);
    });
});
