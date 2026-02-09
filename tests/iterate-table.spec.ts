
import { test, expect } from '@playwright/test';
import { useTable } from '../src/useTable';

test('iterateThroughTable flattens array results and provides SmartRowArray', async ({ page }) => {
  await page.setContent(`
    <html>
      <body>
        <table>
          <thead><tr><th>ID</th><th>Val</th></tr></thead>
          <tbody>
            <tr><td>1</td><td>A</td></tr>
            <tr><td>2</td><td>B</td></tr>
          </tbody>
        </table>
      </body>
    </html>
  `);

  const table = useTable(page.locator('table'));

  const results = await table.iterateThroughTable<string>(async ({ rows }) => {
    // Verify SmartRowArray
    expect(typeof rows.toJSON).toBe('function');

    // Return array of strings to test flattening
    // For each row, return 2 strings
    const rowData = await rows[0].getCell('Val').innerText();
    return [`${rowData}-1`, `${rowData}-2`];
  }, { pagination: async () => false });

  // Since we have 2 rows, and we return 2 items per row?
  // Wait, iterateThroughTable calls callback once per PAGE (or batch).
  // Here we have 1 page.
  // So callback is called ONCE with all rows.
  // rows.length should be 2.

  // If we return ['A-1', 'A-2'], allData will be ['A-1', 'A-2'].
  // But we want to process all rows.

  // Let's adjust the test to actually iterate rows inside.

  const results2 = await table.iterateThroughTable<string>(async ({ rows }) => {
    const mapped = await Promise.all(rows.map(async r => {
      const val = await r.getCell('Val').innerText();
      return [val + '1', val + '2'];
    }));
    // mapped is [['A1', 'A2'], ['B1', 'B2']]
    // We want to return a flat list to be added to allData.
    return mapped.flat();
  }, { pagination: async () => false, autoFlatten: true });

  expect(results2).toEqual(['A1', 'A2', 'B1', 'B2']);
});
