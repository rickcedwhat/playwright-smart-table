import { describe, it, expect, vi } from 'vitest';
import { FilterStrategies } from '../../src/strategies/filter';
import type { TableContext } from '../../src/types';

describe('FilterStrategies additional branches', () => {
  it('handles function-valued filter (locator-based)', () => {
    const rows: any = { filter: vi.fn().mockReturnThis() };
    const cellTemplate: any = { nth: vi.fn().mockReturnThis(), locator: vi.fn().mockReturnThis() };
    const resolve = vi.fn().mockReturnValue(cellTemplate);

    const ctx: TableContext = {
      root: {} as any,
      config: { cellSelector: 'td' } as any,
      page: {} as any,
      resolve,
    };

    const filterFn = (cell: any) => cell.locator('input:checked');

    FilterStrategies.default.apply({
      rows,
      filter: { column: 'X', value: filterFn },
      colIndex: 1,
      tableContext: ctx,
    } as any);

    expect(cellTemplate.nth).toHaveBeenCalledWith(1);
    expect(cellTemplate.locator).toHaveBeenCalledWith('input:checked');
    expect(rows.filter).toHaveBeenCalled();
  });

  it('converts numeric filter to string and uses getByText', () => {
    const rows: any = { filter: vi.fn().mockReturnThis() };
    const cellTemplate: any = { nth: vi.fn().mockReturnThis(), getByText: vi.fn().mockReturnThis() };
    const resolve = vi.fn().mockReturnValue(cellTemplate);

    const ctx: TableContext = {
      root: {} as any,
      config: { cellSelector: 'td' } as any,
      page: {} as any,
      resolve,
    };

    FilterStrategies.default.apply({
      rows,
      filter: { column: 'Num', value: 42 },
      colIndex: 0,
      tableContext: ctx,
    } as any);

    expect(cellTemplate.nth).toHaveBeenCalledWith(0);
    expect(cellTemplate.getByText).toHaveBeenCalledWith('42', { exact: true });
    expect(rows.filter).toHaveBeenCalled();
  });

  it('spy strategy sets calledRef and delegates', () => {
    const rows: any = { filter: vi.fn().mockReturnThis() };
    const cellTemplate: any = { nth: vi.fn().mockReturnThis(), getByText: vi.fn().mockReturnThis() };
    const resolve = vi.fn().mockReturnValue(cellTemplate);

    const ctx: TableContext = {
      root: {} as any,
      config: { cellSelector: 'td' } as any,
      page: {} as any,
      resolve,
    };

    const calledRef: { called?: boolean } = {};
    const strat = FilterStrategies.spy(calledRef);
    strat.apply({ rows, filter: { column: 'Name', value: 'Bob' }, colIndex: 0, tableContext: ctx } as any);

    expect(calledRef.called).toBe(true);
    expect(cellTemplate.getByText).toHaveBeenCalledWith('Bob', { exact: true });
  });
});

