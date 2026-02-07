
import { test, expect } from '@playwright/test';
import { useTable } from '../src/useTable';

test('headerTransformer receives seenHeaders to handle duplicates', async ({ page }) => {
    await page.setContent(`
    <html>
      <body>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Name</th>
              <th>Role</th>
              <th>Name</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>John</td><td>john@example.com</td><td>Duplicate1</td><td>Admin</td><td>Duplicate2</td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  `);

    const table = useTable(page.locator('table'), {
        headerTransformer: ({ text, seenHeaders }) => {
            if (seenHeaders.has(text)) {
                let suffix = 1;
                while (seenHeaders.has(`${text} (${suffix})`)) {
                    suffix++;
                }
                return `${text} (${suffix})`;
            }
            return text;
        }
    });

    const headers = await table.getHeaders();
    expect(headers).toEqual(['Name', 'Email', 'Name (1)', 'Role', 'Name (2)']);
});
