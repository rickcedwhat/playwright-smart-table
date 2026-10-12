import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveRowLoading } from '../../src/engine/rowResolution';
import { TableMapper } from '../../src/engine/tableMapper';
import createSmartRow from '../../src/smartRow';
import type { FinalTableConfig, LoadingStrategy, SmartRow } from '../../src/types';

const page = { waitForTimeout: (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms)) };
const pending = () => new Promise<boolean>(() => {});
const predicate = (phase: 'initial' | 'later') => phase === 'initial'
    ? vi.fn(pending)
    : vi.fn().mockImplementationOnce(() => new Promise(resolve => setTimeout(() => resolve(true), 20))).mockImplementation(pending);
const observe = (promise: Promise<unknown>) => {
    const settled = vi.fn();
    void promise.then(value => settled({ value }), error => settled({ error }));
    return settled;
};

function makeRow(loading: LoadingStrategy, text = 'Alice') {
    const loc = { page: () => page, count: async () => 1, innerText: async () => text, evaluate: async () => text, nth: (_index: number): any => loc };
    const config = { strategies: { loading }, cellSelector: 'td', debug: { logLevel: 'none' } } as FinalTableConfig;
    return createSmartRow(loc as any, new Map([['Name', 0]]), 0, config, loc as any, (() => loc) as any, null);
}

function makeMapper(loading: LoadingStrategy = {}) {
    const waitFor = vi.fn().mockResolvedValue(undefined);
    const headers = { first: () => ({ waitFor }), nth: () => ({}) };
    const root = { page: () => page };
    const config = {
        autoScroll: false,
        headerSelector: 'th',
        strategies: { loading, header: vi.fn().mockResolvedValue(['Name']) },
    } as unknown as FinalTableConfig;
    return { mapper: new TableMapper(root as any, config, (() => headers) as any), config, waitFor };
}

describe('loading deadlines include pending checks', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

    for (const phase of ['initial', 'later'] as const) {
        for (const policy of ['skip', 'throw', 'read-as-is'] as const) {
            it(`row ${policy}: ${phase} pending check uses the original budget`, async () => {
                const settled = observe(resolveRowLoading({ rowIndex: 0, page: () => page } as SmartRow, {
                    isRowLoading: predicate(phase), rowLoadingTimeout: 50, onRowLoadingTimeout: policy,
                }, 'skip'));
                await vi.advanceTimersByTimeAsync(49);
                expect(settled).not.toHaveBeenCalled();
                await vi.advanceTimersByTimeAsync(1);
                expect(settled).toHaveBeenCalledExactlyOnceWith({ value: policy === 'read-as-is' ? 'process' : policy });
                expect(vi.getTimerCount()).toBe(0);
            });
        }
        for (const policy of ['skip', 'throw', 'read-as-is', 'callback'] as const) {
            it(`cell ${policy}: ${phase} pending check uses the original budget`, async () => {
                const callback = vi.fn().mockResolvedValue('fallback');
                const row = makeRow({ isCellLoading: predicate(phase), cellLoadingTimeout: 50,
                    onCellLoadingTimeout: policy === 'callback' ? callback : policy });
                const settled = observe(row.toJSON());
                await vi.advanceTimersByTimeAsync(49);
                expect(settled).not.toHaveBeenCalled();
                await vi.advanceTimersByTimeAsync(1);
                if (policy === 'throw') {
                    expect(settled).toHaveBeenCalledExactlyOnceWith({ error: expect.objectContaining({ message: expect.stringContaining('within 50ms') }) });
                } else {
                    expect(settled).toHaveBeenCalledExactlyOnceWith({ value: { Name: policy === 'callback' ? 'fallback' : policy === 'skip' ? '' : 'Alice' } });
                }
                expect(callback).toHaveBeenCalledTimes(policy === 'callback' ? 1 : 0);
                expect(vi.getTimerCount()).toBe(0);
            });
        }
        it(`header: ${phase} pending check cannot hold initialization open`, async () => {
            const check = phase === 'initial' ? vi.fn(pending) : vi.fn().mockResolvedValueOnce(true).mockImplementation(pending);
            const { mapper } = makeMapper({ isHeaderLoading: check });
            const settled = observe(mapper.getMap(150));
            await vi.advanceTimersByTimeAsync(149);
            expect(settled).not.toHaveBeenCalled();
            await vi.advanceTimersByTimeAsync(1);
            expect(settled).toHaveBeenCalledExactlyOnceWith({ error: expect.objectContaining({ message: 'Timed out waiting for headers after 150ms' }) });
            expect(mapper.isInitialized()).toBe(false);
            expect(vi.getTimerCount()).toBe(0);
        });
    }

    it('bounds the empty-cell grace check without restarting the budget', async () => {
        const check = vi.fn().mockResolvedValueOnce(false).mockImplementation(pending);
        const callback = vi.fn().mockResolvedValue('fallback');
        const settled = observe(makeRow({ isCellLoading: check, cellLoadingTimeout: 50, onCellLoadingTimeout: callback }, '').toJSON());
        await vi.advanceTimersByTimeAsync(50);
        expect(check).toHaveBeenCalledTimes(2);
        expect(settled).toHaveBeenCalledExactlyOnceWith({ value: { Name: 'fallback' } });
        expect(callback).toHaveBeenCalledOnce();
        expect(vi.getTimerCount()).toBe(0);
    });

    for (const policy of ['skip', 'throw', 'read-as-is', 'callback'] as const) {
        it(`cell ${policy}: a pending grace text peek applies the timeout policy`, async () => {
            const check = vi.fn().mockResolvedValue(false);
            const callback = vi.fn().mockResolvedValue('fallback');
            const row = makeRow({ isCellLoading: check, cellLoadingTimeout: 50,
                onCellLoadingTimeout: policy === 'callback' ? callback : policy });
            const peek = vi.spyOn(row, 'evaluate').mockImplementation(() => new Promise(() => {}));
            const read = vi.spyOn(row, 'innerText');
            const settled = observe(row.toJSON());
            await vi.advanceTimersByTimeAsync(49);
            expect(settled).not.toHaveBeenCalled();
            await vi.advanceTimersByTimeAsync(1);
            if (policy === 'throw') {
                expect(settled).toHaveBeenCalledExactlyOnceWith({ error: expect.objectContaining({ message: expect.stringContaining('within 50ms') }) });
            } else {
                expect(settled).toHaveBeenCalledExactlyOnceWith({ value: { Name: policy === 'callback' ? 'fallback' : policy === 'skip' ? '' : 'Alice' } });
            }
            expect(peek).toHaveBeenCalledOnce();
            expect(check).toHaveBeenCalledOnce();
            expect(read).toHaveBeenCalledTimes(policy === 'read-as-is' ? 1 : 0);
            expect(callback).toHaveBeenCalledTimes(policy === 'callback' ? 1 : 0);
            expect(vi.getTimerCount()).toBe(0);
        });
    }

    it('continues grace polling for actual empty text without applying the timeout policy', async () => {
        const check = vi.fn().mockResolvedValue(false);
        const settled = observe(makeRow({ isCellLoading: check, cellLoadingTimeout: 50, onCellLoadingTimeout: 'throw' }, '').toJSON());
        await vi.advanceTimersByTimeAsync(49);
        expect(settled).not.toHaveBeenCalled();
        expect(check).toHaveBeenCalledTimes(2);
        await vi.advanceTimersByTimeAsync(1);
        expect(settled).toHaveBeenCalledExactlyOnceWith({ value: { Name: '' } });
        expect(vi.getTimerCount()).toBe(0);
    });

    it('a late header-loading result cannot resume initialization or poison a retry', async () => {
        let release!: (value: boolean) => void;
        const delayed = new Promise<boolean>(resolve => { release = resolve; });
        const { mapper, config } = makeMapper({ isHeaderLoading: () => delayed });
        const settled = observe(mapper.getMap(50));
        await vi.advanceTimersByTimeAsync(50);
        expect(settled).toHaveBeenCalledExactlyOnceWith({ error: expect.objectContaining({ message: 'Timed out waiting for headers after 50ms' }) });
        release(false);
        await vi.advanceTimersByTimeAsync(0);
        expect(mapper.isInitialized()).toBe(false);
        expect(config.strategies.header).not.toHaveBeenCalled();
        config.strategies.loading!.isHeaderLoading = async () => false;
        expect(await mapper.getMap(50)).toEqual(new Map([['Name', 0]]));
        expect(vi.getTimerCount()).toBe(0);
    });

    it('caps header visibility waits to the remaining initialization budget', async () => {
        const { mapper, waitFor } = makeMapper();
        waitFor.mockImplementation(() => new Promise(() => {}));
        const settled = observe(mapper.getMap(50));
        await vi.advanceTimersByTimeAsync(50);
        expect(waitFor).toHaveBeenCalledWith({ state: 'visible', timeout: 50 });
        expect(settled).toHaveBeenCalledExactlyOnceWith({ error: expect.objectContaining({ message: 'Timed out waiting for headers after 50ms' }) });
        expect(vi.getTimerCount()).toBe(0);
    });

    for (const kind of ['row', 'cell', 'header'] as const) {
        it(`${kind}: preserves predicate errors and clears its timer`, async () => {
            const error = new Error('predicate failed');
            const check = async () => { throw error; };
            const reading = kind === 'row'
                ? resolveRowLoading({ rowIndex: 0 } as SmartRow, { isRowLoading: check, rowLoadingTimeout: 50 }, 'skip')
                : kind === 'cell' ? makeRow({ isCellLoading: check, cellLoadingTimeout: 50 }).toJSON()
                    : makeMapper({ isHeaderLoading: check }).mapper.getMap(50);
            await expect(reading).rejects.toBe(error);
            expect(vi.getTimerCount()).toBe(0);
        });
    }

    it('preserves unset row-loading behavior without starting a deadline', async () => {
        const check = vi.fn().mockResolvedValue(true);
        expect(await resolveRowLoading({} as SmartRow, { isRowLoading: check }, 'process')).toBe('process');
        expect(check).not.toHaveBeenCalled();
        expect(await resolveRowLoading({} as SmartRow, { isRowLoading: check }, 'skip')).toBe('skip');
        expect(check).toHaveBeenCalledOnce();
        expect(vi.getTimerCount()).toBe(0);
    });

    for (const kind of ['row', 'cell'] as const) {
        it(`${kind}: caps polling pauses to the remaining budget`, async () => {
            const wait = vi.spyOn(page, 'waitForTimeout');
            try {
                const reading = kind === 'row'
                    ? resolveRowLoading({ page: () => page } as SmartRow, { isRowLoading: async () => true, rowLoadingTimeout: 50, onRowLoadingTimeout: 'skip' }, 'skip')
                    : makeRow({ isCellLoading: async () => true, cellLoadingTimeout: 50, onCellLoadingTimeout: 'skip' }).toJSON();
                const settled = observe(reading);
                await vi.advanceTimersByTimeAsync(50);
                expect(settled).toHaveBeenCalledExactlyOnceWith({ value: kind === 'row' ? 'skip' : { Name: '' } });
                expect(wait).toHaveBeenCalledExactlyOnceWith(50);
                expect(vi.getTimerCount()).toBe(0);
            } finally { wait.mockRestore(); }
        });
        it(`${kind}: zero timeout does not leave a pending check unbounded`, async () => {
            const reading = kind === 'row'
                ? resolveRowLoading({} as SmartRow, { isRowLoading: pending, rowLoadingTimeout: 0, onRowLoadingTimeout: 'skip' }, 'skip')
                : makeRow({ isCellLoading: pending, cellLoadingTimeout: 0, onCellLoadingTimeout: 'skip' }).toJSON();
            const settled = observe(reading);
            await vi.advanceTimersByTimeAsync(5);
            expect(settled).toHaveBeenCalledExactlyOnceWith({ value: kind === 'row' ? 'skip' : { Name: '' } });
            expect(vi.getTimerCount()).toBe(0);
        });
        it(`${kind}: zero timeout still permits an immediate successful check`, async () => {
            const check = vi.fn().mockResolvedValueOnce(true).mockResolvedValue(false);
            const reading = kind === 'row'
                ? resolveRowLoading({ rowIndex: 0 } as SmartRow, { isRowLoading: check, rowLoadingTimeout: 0, onRowLoadingTimeout: 'throw' }, 'skip')
                : makeRow({ isCellLoading: check, cellLoadingTimeout: 0, onCellLoadingTimeout: 'throw' }).toJSON();
            expect(await reading).toEqual(kind === 'row' ? 'process' : { Name: 'Alice' });
            expect(vi.getTimerCount()).toBe(0);
        });
        it(`${kind}: successful checks clear their deadline timers`, async () => {
            const reading = kind === 'row'
                ? resolveRowLoading({} as SmartRow, { isRowLoading: async () => false, rowLoadingTimeout: 50 }, 'skip')
                : makeRow({ isCellLoading: async () => false, cellLoadingTimeout: 50 }).toJSON();
            expect(await reading).toEqual(kind === 'row' ? 'process' : { Name: 'Alice' });
            expect(vi.getTimerCount()).toBe(0);
        });
    }

    it('handles a predicate rejecting after its wait has already timed out', async () => {
        let reject!: (error: Error) => void;
        const delayed = new Promise<boolean>((_resolve, fail) => { reject = fail; });
        const settled = observe(resolveRowLoading({} as SmartRow, {
            isRowLoading: () => delayed, rowLoadingTimeout: 50, onRowLoadingTimeout: 'skip',
        }, 'skip'));
        await vi.advanceTimersByTimeAsync(50);
        expect(settled).toHaveBeenCalledExactlyOnceWith({ value: 'skip' });
        reject(new Error('late predicate failure'));
        await vi.advanceTimersByTimeAsync(0);
        expect(settled).toHaveBeenCalledOnce();
        expect(vi.getTimerCount()).toBe(0);
    });
});
