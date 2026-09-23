import { test, expect } from '@playwright/test';
import { useTable } from '../src/index';
import type { FilterStrategy } from '../src/types';

test('Custom FilterStrategy is used by the engine', async ({ page }) => {
  await page.setContent(`
    <table id="t">
      <thead><tr><th>ID</th><th>Name</th></tr></thead>
      <tbody>
        <tr><td>1</td><td>Alice</td></tr>
        <tr><td>2</td><td>Bob</td></tr>
      </tbody>
    </table>
  `);

  const calledRef: { called?: boolean } = {};
  const spyFilter: FilterStrategy = {
    apply({ rows, filter, colIndex, tableContext }) {
      calledRef.called = true;
      const page = tableContext.page;
      const resolve = tableContext.resolve;
      const cellTemplate = resolve(tableContext.config.cellSelector as any, page);
      const targetCell = cellTemplate.nth(colIndex);
      if (typeof filter.value === 'function') {
        return rows.filter({ has: (filter.value as any)(targetCell) });
      }
      const textVal = typeof filter.value === 'number' ? String(filter.value) : filter.value;
      return rows.filter({ has: targetCell.getByText(textVal, { exact: true }) });
    },
  };

  const table = useTable(page.locator('#t'), {
    headerSelector: 'thead th',
    rowSelector: 'tbody tr',
    cellSelector: 'td',
    strategies: {
      filter: spyFilter,
    },
  });

  await table.init();

  const row = table.getRow({ ID: '2' });
  expect(calledRef.called).toBe(true);
  await expect(row.getCell('ID')).toHaveText('2');
});
