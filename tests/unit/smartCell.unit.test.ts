import { describe, it, expect, vi } from 'vitest';
import { errors } from '@playwright/test';
import createSmartRow from '../../src/smartRow';
import { FinalTableConfig } from '../../src/types';

/**
 * Minimal Locator-like mock used across tests.
 */
function makeMockLocator(overrides: Record<string, any> = {}) {
    const loc: Record<string, any> = {
        count: vi.fn().mockResolvedValue(1),
        nth: vi.fn().mockReturnThis(),
        page: vi.fn().mockReturnValue({
            keyboard: { press: vi.fn() },
            waitForTimeout: vi.fn(),
        }),
        evaluate: vi.fn(),
        scrollIntoViewIfNeeded: vi.fn(),
        innerText: vi.fn().mockResolvedValue('cell text'),
        focus: vi.fn(),
        ...overrides,
    };
    // Make nth() return a new object each call so locator chaining works
    loc.nth = vi.fn().mockReturnValue(loc);
    return loc;
}

function makeConfig(overrides: Partial<FinalTableConfig<any>> = {}): FinalTableConfig<any> {
    return {
        rowSelector: 'tr',
        headerSelector: 'th',
        cellSelector: 'td',
        strategies: {},
        debug: { logLevel: 'none' },
        ...overrides,
    } as FinalTableConfig<any>;
}

describe('SmartCell', () => {
    describe('getCell() return value', () => {
        it('returns an object with a bringIntoView method', () => {
            const loc = makeMockLocator();
            const config = makeConfig();
            const map = new Map([['Name', 0]]);
            const row = createSmartRow(loc, map, 0, config, loc, (_sel, parent) => loc as any, null);
            const cell = row.getCell('Name');
            expect(typeof cell.bringIntoView).toBe('function');
        });

        it('throws when column does not exist', () => {
            const loc = makeMockLocator();
            const config = makeConfig();
            const map = new Map([['Name', 0]]);
            const row = createSmartRow(loc, map, 0, config, loc, (_sel, parent) => loc as any, null);
            expect(() => row.getCell('NonExistent')).toThrow(/NonExistent/);
        });

        it('uses getCellLocator strategy when provided', () => {
            const loc = makeMockLocator();
            const customCell = makeMockLocator();
            const getCellLocator = vi.fn().mockReturnValue(customCell);
            const config = makeConfig({ strategies: { getCellLocator } });
            const map = new Map([['Email', 1]]);
            const row = createSmartRow(loc, map, 0, config, loc, (_sel, parent) => loc as any, null);
            row.getCell('Email');
            expect(getCellLocator).toHaveBeenCalledWith(
                expect.objectContaining({ columnName: 'Email', columnIndex: 1 })
            );
        });
    });

    describe('SmartCell.bringIntoView()', () => {
        it('resolves without error for a simple (non-virtualized) table', async () => {
            const loc = makeMockLocator();
            const config = makeConfig();
            const map = new Map([['Name', 0]]);
            const row = createSmartRow(loc, map, 0, config, loc, (_sel, parent) => loc as any, null);
            await expect(row.getCell('Name').bringIntoView()).resolves.toBeUndefined();
        });

        it('calls beforeCellRead with correct args after navigation', async () => {
            const loc = makeMockLocator();
            const beforeCellRead = vi.fn().mockResolvedValue(undefined);
            const config = makeConfig({ strategies: { beforeCellRead } });
            const map = new Map([['Region', 2]]);
            const row = createSmartRow(loc, map, 0, config, loc, (_sel, parent) => loc as any, null);
            await row.getCell('Region').bringIntoView();
            expect(beforeCellRead).toHaveBeenCalledOnce();
            const args = beforeCellRead.mock.calls[0][0];
            expect(args.columnName).toBe('Region');
            expect(args.columnIndex).toBe(2);
            expect(typeof args.getHeaderCell).toBe('function');
        });

        it('does NOT call beforeCellRead when strategy is absent', async () => {
            const loc = makeMockLocator();
            const config = makeConfig({ strategies: {} });
            const map = new Map([['Status', 0]]);
            const row = createSmartRow(loc, map, 0, config, loc, (_sel, parent) => loc as any, null);
            // Should not throw
            await expect(row.getCell('Status').bringIntoView()).resolves.toBeUndefined();
        });

        it('calls viewport.scrollToColumn when column is out of visible range', async () => {
            const scrollToColumn = vi.fn().mockResolvedValue(undefined);
            const loc = makeMockLocator({
                // First count() call returns 0 (not yet in DOM), second returns 1 (after scroll)
                count: vi.fn()
                    .mockResolvedValueOnce(0)  // targetReached check before scroll
                    .mockResolvedValue(1),     // targetReached check after scroll
            });
            const config = makeConfig({
                strategies: {
                    viewport: {
                        getVisibleColumnRange: vi.fn()
                            .mockResolvedValue({ first: 0, last: 2 }),
                        scrollToColumn,
                    },
                },
            });
            const map = new Map([['FarRight', 5]]);
            const row = createSmartRow(loc, map, 0, config, loc, (_sel, parent) => loc as any, null);
            await row.getCell('FarRight').bringIntoView();
            expect(scrollToColumn).toHaveBeenCalledWith(expect.anything(), 5);
        });

        it('forwards getHeaderCell from table reference when available', async () => {
            const loc = makeMockLocator();
            const beforeCellRead = vi.fn().mockResolvedValue(undefined);
            const mockHeaderCell = makeMockLocator();
            const getHeaderCell = vi.fn().mockResolvedValue(mockHeaderCell);
            const config = makeConfig({ strategies: { beforeCellRead } });
            const map = new Map([['City', 3]]);
            const mockTable = { getHeaderCell, getHeaders: vi.fn() } as any;
            const row = createSmartRow(loc, map, 0, config, loc, (_sel, parent) => loc as any, mockTable);
            await row.getCell('City').bringIntoView();
            // getHeaderCell from the table should be passed through
            const passedGetHeaderCell = beforeCellRead.mock.calls[0][0].getHeaderCell;
            await passedGetHeaderCell('City');
            expect(getHeaderCell).toHaveBeenCalledWith('City');
        });
    });

    describe('getValue()', () => {
        it('reads cell text without navigation when no viewport/navigation', async () => {
            const loc = makeMockLocator({
                innerText: vi.fn().mockResolvedValue('  Alice  '),
            });
            const config = makeConfig();
            const map = new Map([['Name', 0]]);
            const row = createSmartRow(loc, map, 0, config, loc, (_sel, parent) => loc as any, null);
            await expect(row.getValue('Name')).resolves.toBe('Alice');
        });

        it('navigates via viewport.scrollToColumn before reading virtualized columns', async () => {
            const scrollToColumn = vi.fn().mockResolvedValue(undefined);
            const loc = makeMockLocator({
                count: vi.fn()
                    .mockResolvedValueOnce(0)
                    .mockResolvedValue(1),
                innerText: vi.fn().mockResolvedValue('hidden-value'),
            });
            const config = makeConfig({
                strategies: {
                    viewport: {
                        getVisibleColumnRange: vi.fn().mockResolvedValue({ first: 0, last: 1 }),
                        scrollToColumn,
                    },
                },
            });
            const map = new Map([['FarRight', 5]]);
            const row = createSmartRow(loc, map, 0, config, loc, (_sel, parent) => loc as any, null);
            await expect(row.getValue('FarRight')).resolves.toBe('hidden-value');
            expect(scrollToColumn).toHaveBeenCalledWith(expect.anything(), 5);
        });

        it('navigates to an off-screen cell before calling its read override', async () => {
            let attached = false;
            const loc = makeMockLocator({
                count: vi.fn().mockImplementation(async () => Number(attached)),
                innerText: vi.fn().mockResolvedValue('cell-value'),
            });
            const scrollToColumn = vi.fn().mockImplementation(async () => { attached = true; });
            const read = vi.fn(async (cell) => cell.innerText());
            const config = makeConfig({
                columnOverrides: { FarRight: { read } },
                strategies: { viewport: {
                    getVisibleColumnRange: vi.fn().mockResolvedValue({ first: 0, last: 1 }),
                    scrollToColumn,
                } },
            });
            const row = createSmartRow(loc, new Map([['FarRight', 5]]), 0, config, loc, () => loc as any, null);

            await expect(row.getValue('FarRight')).resolves.toBe('cell-value');
            expect(scrollToColumn).toHaveBeenCalledWith(expect.anything(), 5);
            expect(read).toHaveBeenCalledWith(loc, expect.anything());
        });

        it('reads an attached cell when navigation has no row index', async () => {
            const loc = makeMockLocator({ innerText: vi.fn().mockResolvedValue('Alice') });
            const goRight = vi.fn();
            const config = makeConfig({ strategies: { navigation: { goRight } } });
            const row = createSmartRow(loc, new Map([['Name', 0]]), undefined, config, loc, () => loc as any, null);

            await expect(row.getValue('Name')).resolves.toBe('Alice');
            expect(goRight).not.toHaveBeenCalled();
        });

        it('requires a row index when navigation must reach a missing cell', async () => {
            const loc = makeMockLocator({ count: vi.fn().mockResolvedValue(0) });
            const config = makeConfig({ strategies: { navigation: { goRight: vi.fn() } } });
            const row = createSmartRow(loc, new Map([['Name', 0]]), undefined, config, loc, () => loc as any, null);

            await expect(row.getValue('Name')).rejects.toThrow('Row index is required for navigation');
        });

        it('waits for a visible-column cell to attach before scrolling', async () => {
            let attached = false;
            const loc = makeMockLocator({
                count: vi.fn().mockImplementation(async () => Number(attached)),
                waitFor: vi.fn().mockImplementation(async () => { attached = true; }),
                innerText: vi.fn().mockResolvedValue('delayed'),
            });
            const scrollToColumn = vi.fn();
            const config = makeConfig({ strategies: {
                viewport: {
                    getVisibleColumnRange: vi.fn().mockResolvedValue({ first: 0, last: 0 }),
                    scrollToColumn,
                },
            } });
            const row = createSmartRow(loc, new Map([['Name', 0]]), 0, config, loc, () => loc as any, null);

            await expect(row.getValue('Name')).resolves.toBe('delayed');
            expect(loc.waitFor).toHaveBeenCalledWith({ state: 'attached', timeout: 500 });
            expect(scrollToColumn).not.toHaveBeenCalled();
        });

        it('passes a lazy cell locator to a row-derived override without a DOM cell', async () => {
            const loc = makeMockLocator({
                count: vi.fn().mockResolvedValue(0),
                waitFor: vi.fn().mockRejectedValue(new errors.TimeoutError('timeout')),
                evaluate: vi.fn().mockResolvedValue('row-42'),
            });
            const read = vi.fn(async (_cell, { row }) => row.evaluate(() => 'row-42'));
            const config = makeConfig({
                columnOverrides: { Identity: { read } },
                strategies: { viewport: {
                    getVisibleColumnRange: vi.fn().mockResolvedValue({ first: 0, last: 1 }),
                    scrollToColumn: vi.fn(),
                } },
            });
            const row = createSmartRow(loc, new Map([['Identity', 1]]), 0, config, loc, () => loc as any, null);

            await expect(row.getValue('Identity')).resolves.toBe('row-42');
            expect(read).toHaveBeenCalledWith(loc, expect.objectContaining({ row, columnIndex: 1 }));
            expect(loc.innerText).not.toHaveBeenCalled();
        });
    });

    describe('SmartCell is a drop-in Locator replacement', () => {
        it('exposes standard Locator properties (innerText, count, nth, etc.)', () => {
            const loc = makeMockLocator();
            const config = makeConfig();
            const map = new Map([['Name', 0]]);
            const row = createSmartRow(loc, map, 0, config, loc, (_sel, parent) => loc as any, null);
            const cell = row.getCell('Name');
            // SmartCell is a branded Locator — these methods must exist
            expect(typeof cell.innerText).toBe('function');
            expect(typeof cell.count).toBe('function');
            expect(typeof cell.nth).toBe('function');
        });
    });
});
