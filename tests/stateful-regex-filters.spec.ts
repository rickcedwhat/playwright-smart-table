import { test, expect } from '@playwright/test';
import { useTable, type TableConfig } from '../src';

const html = '<table><thead><tr><th>Name</th><th>Status</th></tr></thead><tbody><tr><td>Alice</td><td>Active</td></tr><tr><td>Bob</td><td>Active</td></tr></tbody></table>';
for (const path of ['override', 'synthetic', 'DOM'] as const) {
  for (const flags of ['gi', 'yi', 'gyi']) {
    test(`${path} filters isolate ${flags} regex state across rows and calls`, async ({ page }) => {
      await page.setContent(html);
      const config: TableConfig = { strategies: { loading: {} } };
      const column = path === 'synthetic' ? 'Computed' : 'Status';
      if (path === 'override') config.columnOverrides = { Status: { read: cell => cell.innerText() } };
      if (path === 'synthetic') config.syntheticColumns = { Computed: { compute: row => row.getCell('Status').innerText() } };
      const table = useTable(page.locator('table'), config);
      for (const initial of [0, 3]) {
        const expression = new RegExp('active', flags);
        expression.lastIndex = initial;
        const filter = { [column]: expression };
        for (let attempt = 0; attempt < 2; attempt++) {
          expect(await Promise.all((await table.findRows(filter)).map(row => row.getCell('Name').innerText()))).toEqual(['Alice', 'Bob']);
          expect(expression.lastIndex).toBe(initial);
          expect(await table.countRows(filter)).toBe(2);
          expect(expression.lastIndex).toBe(initial);
          await expect(table.findRow(filter)).rejects.toThrow(/multiple|ambiguous/i);
          expect(expression.lastIndex).toBe(initial);
        }
      }
    });
  }
}
for (const path of ['override', 'synthetic'] as const) {
  test(`${path} preserves sticky anchoring and accepts a frozen caller regex`, async ({ page }) => {
    await page.setContent(html.replaceAll('Active', 'prefixActive'));
    const table = useTable(page.locator('table'), {
      strategies: { loading: {} },
      ...(path === 'override' ? { columnOverrides: { Status: { read: (cell: import('@playwright/test').Locator) => cell.innerText() } } } :
        { syntheticColumns: { Computed: { compute: (row: import('../src').SmartRow) => row.getCell('Status').innerText() } } }),
    });
    const column = path === 'override' ? 'Status' : 'Computed';
    const expression = /Active/y;
    expression.lastIndex = 6;
    Object.freeze(expression);
    expect(await table.countRows({ [column]: expression })).toBe(0);
    expect(expression.lastIndex).toBe(6);
    expect(await table.countRows({ [column]: /Active/g })).toBe(2);
  });
}
