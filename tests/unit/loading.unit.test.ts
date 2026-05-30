import { describe, it, expect, vi, afterEach } from 'vitest';
import { LoadingStrategies } from '../../src/strategies/loading';
import type { TableContext } from '../../src/types';

function makeContext(overrides: {
    waitForTimeout?: (...args: any[]) => Promise<any>;
    resolveHeaders?: () => { innerText: () => Promise<string> }[];
} = {}): TableContext {
    const headers: { innerText: () => Promise<string> }[] = overrides.resolveHeaders?.() ?? [];
    return {
        root: {} as any,
        page: {
            waitForTimeout: overrides.waitForTimeout ?? vi.fn().mockResolvedValue(undefined),
        } as any,
        resolve: vi.fn().mockReturnValue({
            all: async () => headers,
        }) as any,
        config: { headerSelector: 'th', strategies: {} } as any,
    };
}

describe('LoadingStrategies.Headers.stable', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('single-shot path (no pollMs)', () => {
        it('returns true (still loading) when headers change during wait', async () => {
            let call = 0;
            const ctx = makeContext({
                waitForTimeout: vi.fn().mockResolvedValue(undefined),
                resolveHeaders: () => [{ innerText: async () => `header-${call++}` }],
            });
            const strategy = LoadingStrategies.Headers.stable(200);
            const result = await strategy(ctx);
            expect(result).toBe(true);
        });

        it('returns false (stable) when headers stay the same during wait', async () => {
            const ctx = makeContext({
                waitForTimeout: vi.fn().mockResolvedValue(undefined),
                resolveHeaders: () => [{ innerText: async () => 'fixed-header' }],
            });
            const strategy = LoadingStrategies.Headers.stable(200);
            const result = await strategy(ctx);
            expect(result).toBe(false);
        });
    });

    describe('polling path (with pollMs)', () => {
        it('throws when headers never stabilize within timeoutMs', async () => {
            // Control clock: each waitForTimeout(50) call advances fake time by 50ms.
            let tick = 0;
            const base = Date.now();
            vi.spyOn(Date, 'now').mockImplementation(() => base + tick * 50);

            let counter = 0;
            const ctx = makeContext({
                waitForTimeout: vi.fn().mockImplementation(async () => { tick++; }),
                resolveHeaders: () => [{ innerText: async () => `header-${counter++}` }],
            });

            const strategy = LoadingStrategies.Headers.stable(200, { pollMs: 50, timeoutMs: 300 });
            await expect(strategy(ctx)).rejects.toThrow(
                'Headers.stable: headers did not stabilise within 300ms'
            );
        });

        it('returns false (stable) when headers stop changing within timeoutMs', async () => {
            // Headers change once then stay the same — should stabilize.
            let tick = 0;
            const base = Date.now();
            vi.spyOn(Date, 'now').mockImplementation(() => base + tick * 50);

            let counter = 0;
            const ctx = makeContext({
                waitForTimeout: vi.fn().mockImplementation(async () => { tick++; }),
                // Changes on first read, then stays "stable" from the second read onward.
                resolveHeaders: () => [{ innerText: async () => { const prev = counter++; return prev < 2 ? `v${prev}` : 'stable'; } }],
            });

            const strategy = LoadingStrategies.Headers.stable(100, { pollMs: 50, timeoutMs: 2000 });
            const result = await strategy(ctx);
            expect(result).toBe(false);
        });
    });
});
