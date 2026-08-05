import { describe, it, expect, vi } from 'vitest';
import { RowFinder } from '../../src/engine/rowFinder';
import { FinalTableConfig, FilterValue } from '../../src/types';

describe('Synthetic Columns', () => {
    describe('RowFinder.splitFilters', () => {
        const makeFinder = (overrideCols: string[] = [], syntheticCols: string[] = []) => {
            const columnOverrides: any = {};
            for (const col of overrideCols) {
                columnOverrides[col] = { read: vi.fn() };
            }
            const syntheticColumns: any = {};
            for (const col of syntheticCols) {
                syntheticColumns[col] = { compute: vi.fn() };
            }
            const config = {
                columnOverrides,
                syntheticColumns,
            } as unknown as FinalTableConfig;

            const finder = new (RowFinder as any)(
                {}, config, vi.fn(), {}, {}, vi.fn(), { currentPageIndex: 0 }, vi.fn()
            );
            return finder;
        };

        it('routes synthetic filters to syntheticFilters bucket', () => {
            const finder = makeFinder([], ['Total']);
            const result = finder.splitFilters({ Name: 'Alice', Total: '100' });
            expect(result.domFilters).toEqual({ Name: 'Alice' });
            expect(result.overrideFilters).toEqual({});
            expect(result.syntheticFilters).toEqual({ Total: '100' });
        });

        it('separates all three filter types', () => {
            const finder = makeFinder(['Link'], ['Total']);
            const result = finder.splitFilters({ Name: 'Alice', Link: '/foo', Total: '100' });
            expect(result.domFilters).toEqual({ Name: 'Alice' });
            expect(result.overrideFilters).toEqual({ Link: '/foo' });
            expect(result.syntheticFilters).toEqual({ Total: '100' });
        });

        it('synthetic takes priority over override when a column is in both', () => {
            const finder = makeFinder(['Total'], ['Total']);
            const result = finder.splitFilters({ Total: '100' });
            expect(result.syntheticFilters).toEqual({ Total: '100' });
            expect(result.overrideFilters).toEqual({});
        });
    });

    describe('RowFinder.matchReadValue', () => {
        it('matches string exactly when exact=true', () => {
            expect(RowFinder.matchReadValue('100', '100', true)).toBe(true);
            expect(RowFinder.matchReadValue('1000', '100', true)).toBe(false);
        });

        it('matches string with includes when exact=false', () => {
            expect(RowFinder.matchReadValue('1000', '100', false)).toBe(true);
        });

        it('matches RegExp', () => {
            expect(RowFinder.matchReadValue('42', /^\d+$/, true)).toBe(true);
            expect(RowFinder.matchReadValue('abc', /^\d+$/, true)).toBe(false);
        });

        it('matches number as string', () => {
            expect(RowFinder.matchReadValue('42', 42, true)).toBe(true);
        });

        it('throws on function filter', () => {
            expect(() => RowFinder.matchReadValue('42', (() => {}) as any, true)).toThrow('Function filters are not supported');
        });
    });
});
