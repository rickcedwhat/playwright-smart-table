import { test, expect } from '@playwright/test';
import { useTable } from '../src/index';
import { FilterStrategies } from '../src/strategies/filter';

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

  const table = useTable(page.locator('#t'), {
    headerSelector: 'thead th',
    rowSelector: 'tbody tr',
    cellSelector: 'td',
    strategies: {
      filter: FilterStrategies.spy(calledRef)
    }
  });

  await table.init();

  const row = table.getRow({ ID: '2' });
  expect(calledRef.called).toBe(true);
  await expect(row.getCell('ID')).toHaveText('2');
});

