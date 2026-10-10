import { describe, it, expect } from 'vitest';
import { PaginationStrategies } from '../../src/strategies/pagination';
import type { TableContext } from '../../src/types';

const context = { root: {} } as unknown as TableContext;

describe('Pagination.click numberOfPages → getTotalPages', () => {
    it('is not provided when numberOfPages is unset', () => {
        expect(PaginationStrategies.click({ next: '#next' }).getTotalPages).toBeUndefined();
    });

    it('returns a static page count', async () => {
        const strategy = PaginationStrategies.click({ next: '#next' }, { numberOfPages: 12 });
        expect(await strategy.getTotalPages!(context)).toBe(12);
    });

    it('calls a function with the table root', async () => {
        let received: unknown;
        const strategy = PaginationStrategies.click({ next: '#next' }, {
            numberOfPages: async (root) => { received = root; return 4; },
        });
        expect(await strategy.getTotalPages!(context)).toBe(4);
        expect(received).toBe(context.root);
    });

    for (const bad of [0, 1.5, NaN, Infinity, -2]) {
        it(`throws for ${bad}`, async () => {
            const strategy = PaginationStrategies.click({ next: '#next' }, { numberOfPages: () => bad });
            await expect(strategy.getTotalPages!(context)).rejects.toThrow(
                `numberOfPages must return a finite integer >= 1 (received: ${bad})`,
            );
        });
    }
});
