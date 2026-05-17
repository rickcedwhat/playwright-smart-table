import { describe, it, expect, vi } from 'vitest';
import { createGlideSeekColumnIndex } from '../../src/presets/glide/columns';
import { createGlide } from '../../src/presets/glide';

describe('Issue 104: Glide preset configurable column count and timing', () => {
    describe('createGlideSeekColumnIndex', () => {
        it('computes scroll ratio based on the given columnCount', async () => {
            let capturedArgs: { colIdx: number; count: number } | null = null;
            const mockScroller = {
                evaluate: vi.fn(async (_fn: Function, args: any) => {
                    capturedArgs = args;
                }),
            };
            const mockPage = {
                locator: vi.fn().mockReturnValue({ first: () => mockScroller }),
                waitForTimeout: vi.fn(),
            } as any;

            const seek128 = createGlideSeekColumnIndex(128);
            await seek128({ page: mockPage } as any, 64);

            expect(capturedArgs).toEqual({ colIdx: 64, count: 128 });
        });

        it('uses 64 as default for glideSeekColumnIndex', async () => {
            let capturedArgs: { colIdx: number; count: number } | null = null;
            const mockScroller = {
                evaluate: vi.fn(async (_fn: Function, args: any) => {
                    capturedArgs = args;
                }),
            };
            const mockPage = {
                locator: vi.fn().mockReturnValue({ first: () => mockScroller }),
                waitForTimeout: vi.fn(),
            } as any;

            const { glideSeekColumnIndex } = await import('../../src/presets/glide/columns');
            await glideSeekColumnIndex({ page: mockPage } as any, 32);

            expect(capturedArgs).toEqual({ colIdx: 32, count: 64 });
        });
    });

    describe('createGlide', () => {
        it('returns a preset with a viewport strategy', () => {
            const preset = createGlide();
            expect(preset.strategies?.viewport).toBeDefined();
        });

        it('different columnCount options produce different viewport instances', () => {
            const preset64 = createGlide({ columnCount: 64 });
            const preset128 = createGlide({ columnCount: 128 });
            expect(preset128.strategies?.viewport).not.toBe(preset64.strategies?.viewport);
        });

        it('includes required selectors and concurrency', () => {
            const preset = createGlide({ columnCount: 32 });
            expect(preset.headerSelector).toBe('table[role="grid"] thead tr th');
            expect(preset.rowSelector).toBe('table[role="grid"] tbody tr');
            expect(preset.concurrency).toBe('sequential');
        });
    });

    describe('NavigationPrimitives settleMs / maxWaitMs overrides', () => {
        it('NavigationPrimitives type accepts settleMs and maxWaitMs', () => {
            // Type-level test: if this compiles, the fields are accepted
            const nav: import('../../src/strategies/columns').NavigationPrimitives = {
                settleMs: 100,
                maxWaitMs: 500,
            };
            expect(nav.settleMs).toBe(100);
            expect(nav.maxWaitMs).toBe(500);
        });
    });
});
