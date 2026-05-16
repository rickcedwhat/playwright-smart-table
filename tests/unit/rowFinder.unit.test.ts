import { describe, it, expect, vi, afterEach } from 'vitest';
import { RowFinder } from '../../src/engine/rowFinder';
import type { FinalTableConfig } from '../../src/types';

vi.mock('../../src/utils/elementTracker', () => ({
    ElementTracker: class {
        async peekUnseenIndices() { return []; }
        async commitIndices() {}
        async getUnseenIndices() { return []; }
        async cleanup() {}
    },
}));

function makeConfig(overrides: Partial<FinalTableConfig> = {}): FinalTableConfig {
    return {
        rowSelector: 'tr',
        headerSelector: 'th',
        cellSelector: 'td',
        maxPages: 3,
        autoScroll: false,
        headerTransformer: ({ text }: any) => text,
        onReset: async () => {},
        strategies: {},
        debug: { logLevel: 'none' },
        ...overrides,
    } as any;
}

function makeMinimalRoot(page: any) {
    return { page: () => page } as any;
}

function makeEmptyRowLocator() {
    return { all: async () => [], count: async () => 0 } as any;
}

afterEach(() => vi.restoreAllMocks());

// ─── findRows() non-bulk pagination ──────────────────────────────────────────

describe('RowFinder.findRows — bulk pagination flag', () => {
    it('uses goNext when useBulkPagination is false, even when goNextBulk is present', async () => {
        const goNext = vi.fn().mockResolvedValue(false);
        const goNextBulk = vi.fn().mockResolvedValue(false);
        const page = { waitForTimeout: vi.fn().mockResolvedValue(undefined) };
        const root = makeMinimalRoot(page);
        const rowLocator = makeEmptyRowLocator();

        const finder = new RowFinder(
            root,
            makeConfig({ strategies: { pagination: { goNext, goNextBulk } } }),
            vi.fn().mockReturnValue(rowLocator),
            { applyFilters: vi.fn().mockReturnValue(rowLocator) } as any,
            { getMap: vi.fn().mockResolvedValue(new Map([['id', 0]])) } as any,
            vi.fn().mockReturnValue({ rowIndex: 0 }),
        );

        await finder.findRows({}, { useBulkPagination: false });

        expect(goNext).toHaveBeenCalledTimes(1);
        expect(goNextBulk).not.toHaveBeenCalled();
    });

    it('uses goNextBulk by default when both goNext and goNextBulk are present', async () => {
        const goNext = vi.fn().mockResolvedValue(false);
        const goNextBulk = vi.fn().mockResolvedValue(false);
        const page = { waitForTimeout: vi.fn().mockResolvedValue(undefined) };
        const root = makeMinimalRoot(page);
        const rowLocator = makeEmptyRowLocator();

        const finder = new RowFinder(
            root,
            makeConfig({ strategies: { pagination: { goNext, goNextBulk } } }),
            vi.fn().mockReturnValue(rowLocator),
            { applyFilters: vi.fn().mockReturnValue(rowLocator) } as any,
            { getMap: vi.fn().mockResolvedValue(new Map([['id', 0]])) } as any,
            vi.fn().mockReturnValue({ rowIndex: 0 }),
        );

        await finder.findRows({});

        expect(goNextBulk).toHaveBeenCalledTimes(1);
        expect(goNext).not.toHaveBeenCalled();
    });
});

// ─── findRowLocator() loading poll ───────────────────────────────────────────

describe('RowFinder.findRow — isTableLoading polling', () => {
    it('polls isTableLoading until it returns false before searching for the row', async () => {
        const isTableLoading = vi.fn()
            .mockResolvedValueOnce(true)
            .mockResolvedValueOnce(true)
            .mockResolvedValueOnce(false);

        const waitForTimeout = vi.fn().mockResolvedValue(undefined);
        const page = { waitForTimeout };
        const root = makeMinimalRoot(page);

        // Row locator that reports count=1 (match found) once loading is done.
        const rowLocator = {
            elementHandle: vi.fn().mockResolvedValue(null),
        };
        const matchedRows = {
            count: vi.fn().mockResolvedValue(1),
            first: vi.fn().mockReturnValue(rowLocator),
            all: vi.fn().mockResolvedValue([]),
        };
        const allRows = { all: vi.fn().mockResolvedValue([]) };

        const finder = new RowFinder(
            root,
            makeConfig({
                maxPages: 1,
                strategies: { loading: { isTableLoading } },
            }),
            vi.fn().mockReturnValue(allRows),
            { applyFilters: vi.fn().mockReturnValue(matchedRows) } as any,
            { getMap: vi.fn().mockResolvedValue(new Map([['id', 0]])) } as any,
            vi.fn().mockReturnValue({ rowIndex: undefined }),
        );

        await finder.findRow({ id: '1' });

        expect(isTableLoading).toHaveBeenCalledTimes(3);
        expect(waitForTimeout).toHaveBeenCalledTimes(2); // once per "still loading" response
    });
});
