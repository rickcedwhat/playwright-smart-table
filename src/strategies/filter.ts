import type { Locator } from '@playwright/test';
import type { FilterStrategy, FilterValue, TableContext } from '../types';

/**
 * Example filter strategies.
 * - default: small convenience wrapper that mirrors the engine's default behavior.
 */
export const FilterStrategies = {
  default: {
    apply({ rows, filter, colIndex, tableContext }: {
      rows: Locator;
      filter: { column: string; value: FilterValue };
      colIndex: number;
      tableContext: TableContext;
    }) {
      const scopeRow = tableContext.page.locator(':scope');
      const cellTemplate = tableContext.resolve(tableContext.config.cellSelector, scopeRow);
      const targetCell = cellTemplate.nth(colIndex);
      if (typeof filter.value === 'function') {
        return rows.filter({ has: (filter.value as any)(targetCell) });
      }
      const textVal = typeof filter.value === 'number' ? String(filter.value) : filter.value;
      return rows.filter({ has: targetCell.getByText(textVal, { exact: true }) });
    }
  } as FilterStrategy,
};

// fallow-ignore-next-line unused-type
export type { FilterStrategy } from '../types';
