import { describe, it, expect, vi } from 'vitest';
import { Strategies } from '../../src/index';

const mockRoot = (evaluateResult: any) => ({
    evaluate: vi.fn().mockResolvedValue(evaluateResult),
    locator: vi.fn().mockReturnValue({
        first: vi.fn().mockReturnValue({
            waitFor: vi.fn().mockResolvedValue(undefined),
        }),
    }),
});

const mockConfig = (overrides: any = {}) => ({
    rowSelector: '.row',
    cellSelector: '.cell',
    debug: { logLevel: 'error' as const },
    ...overrides,
});

describe('Strategies.Viewport.dataAttribute()', () => {
    describe('getVisibleRowRange', () => {
        it('logs error when rows exist but none have the row attribute', async () => {
            const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
            const strategy = Strategies.Viewport.dataAttribute();
            const root = mockRoot({ first: 0, last: 0, _rowCount: 15, _validCount: 0 });
            const config = mockConfig();

            const result = await strategy.getVisibleRowRange!(
                { root, config } as any,
            );

            expect(result).toEqual({ first: 0, last: 0 });
            expect(spy).toHaveBeenCalledWith(
                expect.stringContaining('dataAttribute viewport: 15 row(s) found but none have attribute "data-index"'),
                expect.anything(),
            );
            spy.mockRestore();
        });

        it('does not log when rows have valid attributes', async () => {
            const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
            const strategy = Strategies.Viewport.dataAttribute();
            const root = mockRoot({ first: 2, last: 10, _rowCount: 9, _validCount: 9 });
            const config = mockConfig();

            const result = await strategy.getVisibleRowRange!(
                { root, config } as any,
            );

            expect(result).toEqual({ first: 2, last: 10 });
            expect(spy).not.toHaveBeenCalled();
            spy.mockRestore();
        });

        it('does not log when no rows are visible', async () => {
            const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
            const strategy = Strategies.Viewport.dataAttribute();
            const root = mockRoot({ first: 0, last: 0, _rowCount: 0, _validCount: 0 });
            const config = mockConfig();

            const result = await strategy.getVisibleRowRange!(
                { root, config } as any,
            );

            expect(result).toEqual({ first: 0, last: 0 });
            expect(spy).not.toHaveBeenCalled();
            spy.mockRestore();
        });

        it('uses custom rowAttribute name in the warning message', async () => {
            const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
            const strategy = Strategies.Viewport.dataAttribute({ rowAttribute: 'aria-rowindex' });
            const root = mockRoot({ first: 0, last: 0, _rowCount: 5, _validCount: 0 });
            const config = mockConfig();

            await strategy.getVisibleRowRange!({ root, config } as any);

            expect(spy).toHaveBeenCalledWith(
                expect.stringContaining('none have attribute "aria-rowindex"'),
                expect.anything(),
            );
            spy.mockRestore();
        });
    });

    describe('getVisibleColumnRange', () => {
        it('logs error when cells exist but none have the column attribute', async () => {
            const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
            const strategy = Strategies.Viewport.dataAttribute();
            const root = mockRoot({ first: 0, last: 0, _cellCount: 8, _validCount: 0 });
            const config = mockConfig();

            const result = await strategy.getVisibleColumnRange!(
                { root, config } as any,
            );

            expect(result).toEqual({ first: 0, last: 0 });
            expect(spy).toHaveBeenCalledWith(
                expect.stringContaining('dataAttribute viewport: 8 cell(s) found but none have attribute "data-index"'),
                expect.anything(),
            );
            spy.mockRestore();
        });

        it('does not log when cells have valid attributes', async () => {
            const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
            const strategy = Strategies.Viewport.dataAttribute();
            const root = mockRoot({ first: 0, last: 5, _cellCount: 6, _validCount: 6 });
            const config = mockConfig();

            const result = await strategy.getVisibleColumnRange!(
                { root, config } as any,
            );

            expect(result).toEqual({ first: 0, last: 5 });
            expect(spy).not.toHaveBeenCalled();
            spy.mockRestore();
        });
    });

    describe('strips diagnostic fields from return value', () => {
        it('getVisibleRowRange returns only first and last', async () => {
            const strategy = Strategies.Viewport.dataAttribute();
            const root = mockRoot({ first: 3, last: 12, _rowCount: 10, _validCount: 10 });
            const config = mockConfig();

            const result = await strategy.getVisibleRowRange!({ root, config } as any);

            expect(result).toEqual({ first: 3, last: 12 });
            expect(result).not.toHaveProperty('_rowCount');
            expect(result).not.toHaveProperty('_validCount');
        });

        it('getVisibleColumnRange returns only first and last', async () => {
            const strategy = Strategies.Viewport.dataAttribute();
            const root = mockRoot({ first: 1, last: 7, _cellCount: 7, _validCount: 7 });
            const config = mockConfig();

            const result = await strategy.getVisibleColumnRange!({ root, config } as any);

            expect(result).toEqual({ first: 1, last: 7 });
            expect(result).not.toHaveProperty('_cellCount');
            expect(result).not.toHaveProperty('_validCount');
        });
    });
});
