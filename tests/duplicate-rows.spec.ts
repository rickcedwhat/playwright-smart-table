
import { test, expect } from '@playwright/test';
import { useTable } from '../src/useTable';

test('findRow throws error when multiple rows match', async ({ page }) => {
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

  const table = useTable(page.locator('table'));

  // Should throw when finding "Active" (2 matches)
  await expect(async () => {
    await table.findRow({ Status: 'Active' });
  }).rejects.toThrow(/Ambiguous Row/);
});
