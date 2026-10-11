import { afterEach, describe, expect, it, vi } from 'vitest';
import { countRows, type CountRowsEnv } from '../../src/engine/countRows';
import { findRowByIndex, type RowByIndexEnv } from '../../src/engine/rowByIndex';

// Only the strategy/locator boundary is stubbed; the engine and its awaits run normally.
function countEnv() {
    const rows = { count: vi.fn().mockResolvedValue(2), all: vi.fn().mockResolvedValue([{}]) };
    const env = {
        config: { maxPages: 1, strategies: {} },
        rootLocator: { page: () => ({}) },
        getContext: vi.fn(),
        getRowLocators: vi.fn(() => rows),
        tableMapper: { getMapSync: () => new Map() },
        rowFinder: { matchesSyntheticFilters: vi.fn().mockResolvedValue(true) },
    };
    return { env: env as unknown as CountRowsEnv, rows };
}

function rowEnv() {
    const row = {};
    const rows = { all: vi.fn().mockResolvedValue([row]) };
    const resolveRowIndex = vi.fn().mockResolvedValue(7);
    const scrollToRow = vi.fn().mockResolvedValue(undefined);
    const makeSmartRow = vi.fn().mockReturnValue(row);
    const env = {
        config: { maxPages: 1, strategies: { resolveRowIndex, viewport: { scrollToRow } } },
        getRowLocators: () => rows,
        getContext: vi.fn(),
        getMap: () => new Map(),
        getCurrentPageIndex: () => 0,
        makeSmartRow,
    };
    return { env: env as unknown as RowByIndexEnv, row, rows, resolveRowIndex, scrollToRow, makeSmartRow };
}

afterEach(() => vi.useRealTimers());

describe('countRows cancellation without pagination', () => {
    it('checks before waiting for initial readiness', async () => {
        const { env } = countEnv();
        const isTableLoading = vi.fn().mockResolvedValue(false);
        env.config.strategies.loading = { isTableLoading };
        const signal = AbortSignal.abort(null);
        await expect(countRows(env, {}, { signal })).rejects.toBe(null);
        expect(isTableLoading).not.toHaveBeenCalled();
        expect(env.getRowLocators).not.toHaveBeenCalled();
    });

    it('rejects after cancellation during readiness without counting', async () => {
        const { env, rows } = countEnv();
        const controller = new AbortController();
        env.config.strategies.loading = {
            isTableLoading: async () => { controller.abort('loading'); return false; },
        };
        await expect(countRows(env, {}, { signal: controller.signal })).rejects.toBe('loading');
        expect(rows.count).not.toHaveBeenCalled();
    });

    it('rejects after cancellation during the locator count', async () => {
        const { env, rows } = countEnv();
        const controller = new AbortController();
        rows.count.mockImplementation(async () => { controller.abort(null); return 2; });
        await expect(countRows(env, {}, { signal: controller.signal })).rejects.toBe(null);
    });

    it('rejects after cancellation during post-filter evaluation', async () => {
        const { env } = countEnv();
        const controller = new AbortController();
        env.config.syntheticColumns = { total: { compute: async () => '2' } };
        vi.mocked(env.rowFinder.matchesSyntheticFilters).mockImplementation(async () => {
            controller.abort('filter');
            return true;
        });
        await expect(countRows(env, { total: '2' }, { signal: controller.signal })).rejects.toBe('filter');
    });

    it('returns counts for a live signal', async () => {
        const { env } = countEnv();
        await expect(countRows(env, {}, { signal: new AbortController().signal })).resolves.toBe(2);
    });
});

describe('findRowByIndex fast-path cancellation', () => {
    it('checks before inspecting mounted rows', async () => {
        const { env, rows, scrollToRow } = rowEnv();
        await expect(findRowByIndex(env, 7, { signal: AbortSignal.abort(null) })).rejects.toBe(null);
        expect(rows.all).not.toHaveBeenCalled();
        expect(scrollToRow).not.toHaveBeenCalled();
    });

    it.each([7, undefined])('rejects when index resolution aborts and returns %s', async (index) => {
        const { env, resolveRowIndex, scrollToRow, makeSmartRow } = rowEnv();
        const controller = new AbortController();
        resolveRowIndex.mockImplementation(async () => { controller.abort('resolve'); return index; });
        await expect(findRowByIndex(env, 7, { signal: controller.signal })).rejects.toBe('resolve');
        expect(scrollToRow).not.toHaveBeenCalled();
        expect(makeSmartRow).not.toHaveBeenCalled();
    });

    it('rejects after an aborted viewport action before inspecting rows again', async () => {
        const { env, rows, resolveRowIndex, scrollToRow, makeSmartRow } = rowEnv();
        const controller = new AbortController();
        resolveRowIndex.mockResolvedValueOnce(undefined);
        scrollToRow.mockImplementation(async () => { controller.abort('scroll'); });
        await expect(findRowByIndex(env, 7, { signal: controller.signal })).rejects.toBe('scroll');
        expect(rows.all).toHaveBeenCalledTimes(1);
        expect(makeSmartRow).not.toHaveBeenCalled();
    });

    it('rejects when aborted during the final debug delay', async () => {
        vi.useFakeTimers();
        const { env, makeSmartRow } = rowEnv();
        env.config.debug = { slow: 100 };
        const controller = new AbortController();
        const assertion = expect(findRowByIndex(env, 7, { signal: controller.signal })).rejects.toBe('delay');
        await vi.advanceTimersByTimeAsync(50);
        controller.abort('delay');
        await vi.runAllTimersAsync();
        await assertion;
        expect(makeSmartRow).not.toHaveBeenCalled();
    });

    it('returns a mounted row for a live signal', async () => {
        const { env, row } = rowEnv();
        await expect(findRowByIndex(env, 7, { signal: new AbortController().signal })).resolves.toBe(row);
    });
});
