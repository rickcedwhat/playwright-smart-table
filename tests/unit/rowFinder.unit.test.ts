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
    it('calls advancePage with useBulk=false when useBulkPagination option is false', async () => {
        const advancePage = vi.fn().mockResolvedValue(false);
        const page = { waitForTimeout: vi.fn().mockResolvedValue(undefined) };
        const root = makeMinimalRoot(page);
        const rowLocator = makeEmptyRowLocator();

        const finder = new RowFinder(
            root,
            makeConfig({ strategies: { pagination: { goNext: vi.fn(), goNextBulk: vi.fn() } } }),
            vi.fn().mockReturnValue(rowLocator),
            { applyFilters: vi.fn().mockReturnValue(rowLocator) } as any,
            { getMap: vi.fn().mockResolvedValue(new Map([['id', 0]])) } as any,
            vi.fn().mockReturnValue({ rowIndex: 0 }),
            undefined,
            advancePage,
        );

        await finder.findRows({}, { useBulkPagination: false });

        expect(advancePage).toHaveBeenCalledWith(false);
    });

    it('calls advancePage with useBulk=true by default when goNextBulk is present', async () => {
        const advancePage = vi.fn().mockResolvedValue(false);
        const page = { waitForTimeout: vi.fn().mockResolvedValue(undefined) };
        const root = makeMinimalRoot(page);
        const rowLocator = makeEmptyRowLocator();

        const finder = new RowFinder(
            root,
            makeConfig({ strategies: { pagination: { goNext: vi.fn(), goNextBulk: vi.fn() } } }),
            vi.fn().mockReturnValue(rowLocator),
            { applyFilters: vi.fn().mockReturnValue(rowLocator) } as any,
            { getMap: vi.fn().mockResolvedValue(new Map([['id', 0]])) } as any,
            vi.fn().mockReturnValue({ rowIndex: 0 }),
            undefined,
            advancePage,
        );

        await finder.findRows({});

        expect(advancePage).toHaveBeenCalledWith(true);
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
            getAttribute: vi.fn().mockResolvedValue(null),
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

// ─── findRow() sentinel row index ────────────────────────────────────────────

describe('RowFinder.findRow — sentinel row index', () => {
    it('passes undefined rowIndex to makeSmartRow when row is not found', async () => {
        const page = { waitForTimeout: vi.fn().mockResolvedValue(undefined) };
        const root = makeMinimalRoot(page);
        const noRows = { count: vi.fn().mockResolvedValue(0), all: vi.fn().mockResolvedValue([]), filter: vi.fn().mockReturnThis() };
        const makeSmartRow = vi.fn().mockReturnValue({ rowIndex: undefined });

        const finder = new RowFinder(
            root,
            makeConfig({ maxPages: 1 }),
            vi.fn().mockReturnValue(noRows),
            { applyFilters: vi.fn().mockReturnValue(noRows) } as any,
            { getMap: vi.fn().mockResolvedValue(new Map([['id', 0]])) } as any,
            makeSmartRow,
        );

        await finder.findRow({ id: 'missing' });

        // Sentinel construction is the last makeSmartRow call; rowIndex must be undefined
        const sentinelCall = makeSmartRow.mock.calls.at(-1);
        expect(sentinelCall?.[2]).toBeUndefined();
    });
});
