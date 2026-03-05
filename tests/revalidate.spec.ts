import { test, expect } from '@playwright/test';
import { useTable } from '../src/index';

test('revalidate() picks up dynamic column visibility changes', async ({ page }) => {
  await page.setContent(`
    <table id="t">
      <thead><tr><th>A</th><th>B</th></tr></thead>
      <tbody><tr><td>1</td><td>2</td></tr></tbody>
    </table>
  `);

  const table = useTable(page.locator('#t'), {
    headerSelector: 'thead th',
    rowSelector: 'tbody tr',
    cellSelector: 'td',
  });

  await table.init();
  const headersBefore = await table.getHeaders();
  expect(headersBefore).toEqual(['A', 'B']);

  // Remove column B from DOM
  await page.evaluate(() => {
    document.querySelectorAll('#t thead th')[1].remove();
    document.querySelectorAll('#t tbody tr').forEach(r => {
      const td = r.querySelectorAll('td')[1];
      if (td) td.remove();
    });
  });

  await table.revalidate();
  const headersAfter = await table.getHeaders();
  expect(headersAfter).toEqual(['A']);
});

