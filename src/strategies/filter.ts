import type { Locator } from '@playwright/test';
import type { FilterStrategy, FilterValue, TableContext } from '../types';

/**
 * Example filter strategies.
 * - default: small convenience wrapper that mirrors the engine's default behavior.
 * - spy(factory): returns a strategy that marks `calledRef.called = true` when invoked.
 */
export const FilterStrategies = {
  default: {
    apply({ rows, filter, colIndex, tableContext }: {
      rows: Locator;
      filter: { column: string; value: FilterValue };
      colIndex: number;
      tableContext: TableContext;
    }) {
      const page = tableContext.page;
      const resolve = tableContext.resolve;
      const cellTemplate = resolve(tableContext.config.cellSelector as any, page);
      const targetCell = cellTemplate.nth(colIndex);
      if (typeof filter.value === 'function') {
        return rows.filter({ has: (filter.value as any)(targetCell) });
      }
      const textVal = typeof filter.value === 'number' ? String(filter.value) : filter.value;
      return rows.filter({ has: targetCell.getByText(textVal, { exact: true }) });
    }
  } as FilterStrategy,

  spy: (calledRef: { called?: boolean } = {}) => ({
    apply({ rows, filter, colIndex, tableContext }: {
      rows: Locator;
      filter: { column: string; value: FilterValue };
      colIndex: number;
      tableContext: TableContext;
    }) {
      calledRef.called = true;
      // Delegate to default behaviour for actual filtering
      const page = tableContext.page;
      const resolve = tableContext.resolve;
      const cellTemplate = resolve(tableContext.config.cellSelector as any, page);
      const targetCell = cellTemplate.nth(colIndex);
      if (typeof filter.value === 'function') {
        return rows.filter({ has: (filter.value as any)(targetCell) });
      }
      const textVal = typeof filter.value === 'number' ? String(filter.value) : filter.value;
      return rows.filter({ has: targetCell.getByText(textVal, { exact: true }) });
    }
  }) as FilterStrategy,
};

export type { FilterStrategy } from '../types';

