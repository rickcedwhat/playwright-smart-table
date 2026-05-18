import { describe, it, expect, vi } from 'vitest';
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
