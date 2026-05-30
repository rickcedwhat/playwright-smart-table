import { describe, it, expect } from 'vitest';
import { createGlide } from '../../src/presets/glide';

describe('Issue 104: Glide preset configurable column count and timing', () => {
    describe('createGlide', () => {
        it('returns a preset with a viewport strategy', () => {
            const preset = createGlide();
            expect(preset.strategies?.viewport).toBeDefined();
        });

        it('different attachTimeout options produce different viewport instances', () => {
            const preset1 = createGlide({ attachTimeout: 1000 });
            const preset2 = createGlide({ attachTimeout: 5000 });
            expect(preset1.strategies?.viewport).not.toBe(preset2.strategies?.viewport);
        });

        it('includes required selectors and concurrency', () => {
            const preset = createGlide();
            expect(preset.headerSelector).toBe('table[role="grid"] thead tr th');
            expect(preset.rowSelector).toBe('table[role="grid"] tbody tr');
            expect(preset.concurrency).toBe('sequential');
        });
    });

    describe('NavigationPrimitives settleMs / maxWaitMs overrides', () => {
        it('NavigationPrimitives type accepts settleMs and maxWaitMs', () => {
            const nav: import('../../src/strategies/columns').NavigationPrimitives = {
                settleMs: 100,
                maxWaitMs: 500,
            };
            expect(nav.settleMs).toBe(100);
            expect(nav.maxWaitMs).toBe(500);
        });
    });
});
