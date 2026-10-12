import { describe, expect, it, vi } from 'vitest';
import type { SmartRow } from '../../src/types';
import { createSmartRowArray } from '../../src/utils/smartRowArray';

describe('SmartRowArray.toJSON owns sequential reads', () => {
    it('finishes a row before starting a peer that may move the shared viewport', async () => {
        const events: string[] = [];
        let release!: () => void;
        const gate = new Promise<void>(resolve => { release = resolve; });
        const rows = createSmartRowArray([
            { toJSON: async () => {
                events.push('Alice started');
                await gate;
                events.push('Alice finished');
                return { Name: 'Alice' };
            } },
            { toJSON: async () => {
                events.push('Bob started');
                return { Name: 'Bob' };
            } },
        ] as SmartRow[]);

        const reading = rows.toJSON();
        try {
            expect(events).toEqual(['Alice started']);
        } finally {
            release();
        }
        expect(await reading).toEqual([{ Name: 'Alice' }, { Name: 'Bob' }]);
        expect(events).toEqual(['Alice started', 'Alice finished', 'Bob started']);
    });

    it('preserves a read error and does not start later rows after failure', async () => {
        const failure = new Error('read failed');
        const laterRead = vi.fn().mockResolvedValue({ Name: 'Bob' });
        const rows = createSmartRowArray([
            { toJSON: async () => { throw failure; } },
            { toJSON: laterRead },
        ] as SmartRow[]);

        await expect(rows.toJSON()).rejects.toBe(failure);
        expect(laterRead).not.toHaveBeenCalled();
    });
});
