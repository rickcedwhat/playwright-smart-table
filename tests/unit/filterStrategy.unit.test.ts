import { describe, it, expect, vi } from 'vitest';
import { FilterStrategies } from '../../src/strategies/filter';
import type { TableContext } from '../../src/types';
import type { Locator, Page } from '@playwright/test';

describe('FilterStrategies.default', () => {
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

  const mockPage = {} as unknown as Page;

  it('applies text-based filter by delegating to Playwright locators', () => {
    const baseRows = createRecursiveMockLocator('rows');
    const cellTemplate = createRecursiveMockLocator('cellTemplate');
    const resolve = vi.fn().mockReturnValue(cellTemplate);

    const ctx: TableContext = {
      root: {} as any,
      config: { cellSelector: 'td' } as any,
      page: mockPage,
      resolve,
    };

    const result = FilterStrategies.default.apply({
      rows: baseRows as unknown as Locator,
      filter: { column: 'Name', value: 'Alice' },
      colIndex: 0,
      tableContext: ctx,
    } as any);

    const baseMock: any = baseRows;
    expect(baseMock.filter).toHaveBeenCalledTimes(1);
    expect(cellTemplate.nth).toHaveBeenCalledWith(0);
    expect(cellTemplate.getByText).toHaveBeenCalledWith('Alice', { exact: true });
  });
});

