import { describe, it, expect, vi } from 'vitest';
import { scanPages } from '../../src/engine/scanPages';
import type { FinalTableConfig } from '../../src/types';

describe('scanPages (#427)', () => {
    const config = { debug: false } as FinalTableConfig;

    it('visits page 1 only when maxPages is 1', async () => {
        const advancePage = vi.fn().mockResolvedValue(true);
        const onPage = vi.fn().mockResolvedValue('continue');
        let pageIndex = 0;

        const result = await scanPages(
            {
                advancePage,
                getCurrentPageIndex: () => pageIndex,
                config,
            },
            onPage,
            { maxPages: 1, label: 'test' }
        );

        expect(onPage).toHaveBeenCalledTimes(1);
        expect(advancePage).not.toHaveBeenCalled();
        expect(result.pagesScanned).toBe(1);
    });

    it('stops early when onPage returns stop', async () => {
        const advancePage = vi.fn().mockResolvedValue(true);
        const onPage = vi.fn()
            .mockResolvedValueOnce('continue')
            .mockResolvedValueOnce('stop');
        let pageIndex = 0;

        const result = await scanPages(
            {
                advancePage: async () => {
                    pageIndex += 1;
                    return advancePage();
                },
                getCurrentPageIndex: () => pageIndex,
                config,
            },
            onPage,
            { maxPages: 10, label: 'test' }
        );

        expect(onPage).toHaveBeenCalledTimes(2);
        expect(result.pagesScanned).toBe(2);
    });

    it('runs EOF final scan when advancePage returns false', async () => {
        const pages: Array<{ isFinalScan: boolean }> = [];
        let pageIndex = 0;
        let advances = 0;

        await scanPages(
            {
                advancePage: async () => {
                    advances++;
                    if (advances >= 2) return false;
                    pageIndex += 1;
                    return true;
                },
                getCurrentPageIndex: () => pageIndex,
                config,
            },
            async (ctx) => {
                pages.push({ isFinalScan: ctx.isFinalScan });
                return 'continue';
            },
            { maxPages: 10, finalScanOnEof: true, label: 'test' }
        );

        expect(pages).toEqual([
            { isFinalScan: false },
            { isFinalScan: false },
            { isFinalScan: true },
        ]);
    });

    it('skips final scan when finalScanOnEof is false', async () => {
        const onPage = vi.fn().mockResolvedValue('continue');
        let pageIndex = 0;

        await scanPages(
            {
                advancePage: async () => false,
                getCurrentPageIndex: () => pageIndex,
                config,
            },
            onPage,
            { maxPages: 5, finalScanOnEof: false, label: 'test' }
        );

        expect(onPage).toHaveBeenCalledTimes(1);
    });

    it('accounts for bulk page jumps in pagesScanned', async () => {
        let pageIndex = 0;
        const onPage = vi.fn().mockResolvedValue('continue');

        const result = await scanPages(
            {
                advancePage: async () => {
                    pageIndex += 5;
                    return true;
                },
                getCurrentPageIndex: () => pageIndex,
                config,
            },
            onPage,
            { maxPages: 10, useBulk: true, label: 'test' }
        );

        // page1 + jump5 → pagesScanned=6; then continue until >= 10
        expect(result.pagesScanned).toBeGreaterThanOrEqual(10);
        expect(onPage.mock.calls.length).toBeGreaterThan(1);
    });

    it('calls waitForReady before each page', async () => {
        const waitForReady = vi.fn().mockResolvedValue(undefined);
        let pageIndex = 0;
        let advances = 0;

        await scanPages(
            {
                advancePage: async () => {
                    advances++;
                    if (advances > 1) return false;
                    pageIndex += 1;
                    return true;
                },
                getCurrentPageIndex: () => pageIndex,
                config,
                waitForReady,
            },
            async () => 'continue',
            { maxPages: 10, finalScanOnEof: true, label: 'test' }
        );

        // page1, page2, final scan = 3
        expect(waitForReady).toHaveBeenCalledTimes(3);
    });
});
