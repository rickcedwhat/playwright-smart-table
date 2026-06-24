import { describe, it, expect, vi } from 'vitest';
import { RowFinder } from '../../src/engine/rowFinder';
import { NavigationBarrier } from '../../src/utils/navigationBarrier';
import type { FinalTableConfig } from '../../src/types';

// This file needs getUnseenIndices to return real indices — keep the mock local.
vi.mock('../../src/utils/elementTracker', () => ({
    ElementTracker: class {
        private _indices: number[];
        constructor(_label: string) {
            // will be set per-test via prototype spy
            this._indices = [];
        }
        async getUnseenIndices(_loc: any) { return this._indices; }
        async cleanup() {}
    },
}));

function makeConfig(overrides: Partial<FinalTableConfig> = {}): FinalTableConfig {
    return {
        rowSelector: 'tr',
        headerSelector: 'th',
        cellSelector: 'td',
        maxPages: 1,
        autoScroll: false,
        headerTransformer: ({ text }: any) => text,
        onReset: async () => {},
        strategies: {},
        debug: { logLevel: 'none' },
        ...overrides,
    } as any;
}

describe('RowFinder.findRows — barrier propagation', () => {
    it('passes a shared NavigationBarrier to all rows when concurrency=synchronized and batch size > 1', async () => {
        const { ElementTracker } = await import('../../src/utils/elementTracker');
        // Return indices 0 and 1 so two rows are treated as "new"
        vi.spyOn(ElementTracker.prototype, 'getUnseenIndices').mockResolvedValue([0, 1]);

        const page = { waitForTimeout: vi.fn() };
        const root = { page: () => page } as any;
        const row1 = {} as any;
        const row2 = {} as any;

        const rowLocator = {
            all: vi.fn().mockResolvedValue([row1, row2]),
            count: vi.fn().mockResolvedValue(2),
        } as any;

        const makeSmartRow = vi.fn().mockReturnValue({ rowIndex: 0 });

        const finder = new RowFinder(
            root,
            makeConfig({ concurrency: 'synchronized' } as any),
            vi.fn().mockReturnValue(rowLocator),
            { applyFilters: vi.fn().mockReturnValue(rowLocator) } as any,
            { getMap: vi.fn().mockResolvedValue(new Map([['id', 0]])) } as any,
            makeSmartRow,
        );

        await finder.findRows({});

        expect(makeSmartRow).toHaveBeenCalledTimes(2);
        const barrier0 = makeSmartRow.mock.calls[0][4];
        const barrier1 = makeSmartRow.mock.calls[1][4];
        expect(barrier0).toBeInstanceOf(NavigationBarrier);
        // Both rows in the same batch share one barrier instance
        expect(barrier0).toBe(barrier1);
    });

    it('passes undefined barrier when concurrency is not synchronized', async () => {
        const { ElementTracker } = await import('../../src/utils/elementTracker');
        vi.spyOn(ElementTracker.prototype, 'getUnseenIndices').mockResolvedValue([0, 1]);

        const page = { waitForTimeout: vi.fn() };
        const root = { page: () => page } as any;

        const rowLocator = {
            all: vi.fn().mockResolvedValue([{}, {}]),
            count: vi.fn().mockResolvedValue(2),
        } as any;

        const makeSmartRow = vi.fn().mockReturnValue({ rowIndex: 0 });

        const finder = new RowFinder(
            root,
            makeConfig(),
            vi.fn().mockReturnValue(rowLocator),
            { applyFilters: vi.fn().mockReturnValue(rowLocator) } as any,
            { getMap: vi.fn().mockResolvedValue(new Map([['id', 0]])) } as any,
            makeSmartRow,
        );

        await finder.findRows({});

        for (const call of makeSmartRow.mock.calls) {
            expect(call[4]).toBeUndefined();
        }
    });
});
