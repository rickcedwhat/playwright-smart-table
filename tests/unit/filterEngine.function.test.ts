import { describe, it, expect, vi } from 'vitest';
import { FilterEngine } from '../../src/filterEngine';
import { FinalTableConfig } from '../../src/types';
import { Page, Locator } from '@playwright/test';

describe('FilterEngine - function filters', () => {
    const mockConfig = {
        cellSelector: 'td',
    } as FinalTableConfig;

    const createRecursiveMockLocator = (name: string) => {
        const mock: any = {
            _name: name,
            filter: vi.fn(),
            nth: vi.fn(),
            getByText: vi.fn(),
            locator: vi.fn(),
            getByRole: vi.fn(),
        };

        mock.filter.mockReturnValue(mock);
        mock.nth.mockReturnValue(mock);
        mock.getByText.mockReturnValue(mock);
        mock.locator.mockReturnValue(mock);
        mock.getByRole.mockReturnValue(mock);

        return mock as unknown as Locator;
    };

    const mockPage = {
        locator: vi.fn()
    } as unknown as Page;

    const mockResolve = vi.fn();

    it('should support function-based filter values', () => {
        const engine = new FilterEngine(mockConfig, mockResolve);
        const baseRows = createRecursiveMockLocator('baseRows');
        const map = new Map<string, number>([['Name', 0]]);

        const mockCellParam = createRecursiveMockLocator('cellParam');
        mockResolve.mockReturnValue(mockCellParam);

        const filterFn = (cell: Locator) => (cell as any).locator('input:checked');

        const result = engine.applyFilters(baseRows, { 'Name': filterFn }, map, false, mockPage);

        const baseMock = baseRows as any;
        expect(baseMock.filter).toHaveBeenCalledTimes(1);
        expect(mockCellParam.nth).toHaveBeenCalledWith(0);
        expect(mockCellParam.locator).toHaveBeenCalledWith('input:checked');
    });
});

