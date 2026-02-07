
import { test, expect } from '@playwright/test';
import { useTable } from '../src/useTable';

test('strict mode handles multiple matches correctly', async ({ page }) => {
    await page.setContent(`
    <html>
      <body>
        <table>
          <thead><tr><th>Name</th><th>Status</th></tr></thead>
          <tbody>
            <tr><td>John</td><td>Active</td></tr>
            <tr><td>Jane</td><td>Active</td></tr>
            <tr><td>Bob</td><td>Inactive</td></tr>
          </tbody>
        </table>
      </body>
    </html>
  `);

    const table = useTable(page.locator('table')); // defaults to strict: true

    // STRICT: Should throw when finding "Active" (2 matches)
    await expect(async () => {
        await table.findRow({ Status: 'Active' });
    }).rejects.toThrow(/Strict Mode Violation/);

    // RELAXED: Should return first match
    const looseTable = useTable(page.locator('table'), { strict: false });
    const row = await looseTable.findRow({ Status: 'Active' });
    const name = await row.getCell('Name').innerText();
    expect(name).toBe('John'); // The first "Active" row
});
