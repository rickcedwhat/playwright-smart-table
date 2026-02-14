import { describe, it, expect, vi } from 'vitest';
import { FilterEngine } from '../../src/filterEngine';
import { FinalTableConfig } from '../../src/types';
import { Page, Locator } from '@playwright/test';

describe('FilterEngine', () => {
    // Mock Config
    const mockConfig = {
        cellSelector: 'td',
    } as FinalTableConfig;

    // Mock Locator factory
    const createMockLocator = (name: string = 'locator') => {
        const methods = {
            filter: vi.fn().mockReturnThis(),
            nth: vi.fn().mockReturnThis(),
            getByText: vi.fn().mockReturnThis(),
            locator: vi.fn().mockReturnThis(),
            first: vi.fn().mockReturnThis(),
            all: vi.fn().mockResolvedValue([]),
            toString: () => name
        };
        // Allow chaining to return new instances if needed, but for now returning 'this' (the methods object) is enough for simple chaining checks
        // deeper chaining might need recursive mocks
        return methods as unknown as Locator;
    };

    // Recursive Mock Locator
    const createRecursiveMockLocator = (name: string) => {
        const mock: any = {
            _name: name,
            filter: vi.fn(),
            nth: vi.fn(),
            getByText: vi.fn(),
            locator: vi.fn(),
        };

        mock.filter.mockReturnValue(mock);
        mock.nth.mockReturnValue(mock);
        mock.getByText.mockReturnValue(mock);
        mock.locator.mockReturnValue(mock);

        return mock as unknown as Locator;
    };

    // Mock Page
    const mockPage = {
        locator: vi.fn()
    } as unknown as Page;

    // Mock Resolve
    const mockResolve = vi.fn();

    describe('applyFilters', () => {
        it('should return original rows if no filters provided', () => {
            const engine = new FilterEngine(mockConfig, mockResolve);
            const baseRows = createMockLocator('baseRows');
            const map = new Map<string, number>();

            const result = engine.applyFilters(baseRows, {}, map, false, mockPage);
            expect(result).toBe(baseRows);
        });

        it('should throw error if column not found', () => {
            const engine = new FilterEngine(mockConfig, mockResolve);
            const baseRows = createMockLocator('baseRows');
            const map = new Map<string, number>([['Name', 0]]);

            expect(() => {
                engine.applyFilters(baseRows, { 'Age': '30' }, map, false, mockPage);
            }).toThrow(/Column 'Age' not found/);
        });

        it('should chain .filter() for each criteria', () => {
            const engine = new FilterEngine(mockConfig, mockResolve);
            const baseRows = createRecursiveMockLocator('baseRows');
            const map = new Map<string, number>([
                ['Name', 0],
                ['Role', 1]
            ]);

            // Setup mock for cell resolution
            const mockCellParam = createRecursiveMockLocator('cellParam');
            mockResolve.mockReturnValue(mockCellParam);

            const result = engine.applyFilters(baseRows, { 'Name': 'John', 'Role': 'Admin' }, map, true, mockPage);

            // Verify resolve called for cell template
            expect(mockResolve).toHaveBeenCalledWith(mockConfig.cellSelector, mockPage);

            // Verify filter called twice
            const baseMock = baseRows as any;
            expect(baseMock.filter).toHaveBeenCalledTimes(2);

            // Verify nth and getByText called on the cell template
            // We can't easily inspect the arguments of 'has' because it's a Locator object, 
            // but we can verify that the cell template interactions happened.
            const cellMock = mockCellParam as any;

            // Check calls for "Name" (index 0, value 'John')
            expect(cellMock.nth).toHaveBeenCalledWith(0);
            expect(cellMock.getByText).toHaveBeenCalledWith('John', { exact: true });

            // Check calls for "Role" (index 1, value 'Admin')
            expect(cellMock.nth).toHaveBeenCalledWith(1);
            expect(cellMock.getByText).toHaveBeenCalledWith('Admin', { exact: true });
        });
    });
});
