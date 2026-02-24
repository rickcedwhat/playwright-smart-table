
import { test, expect } from '@playwright/test';
import { useTable } from '../src/index';
import { DedupeStrategies } from '../src/strategies/dedupe';

test('DedupeStrategies.byTopPosition handles duplicate rows', async ({ page }) => {
  await page.setContent(`
    <html>
      <style>
        tr { height: 20px; }
      </style>
      <body>
        <table>
          <thead><tr><th>ID</th></tr></thead>
          <tbody>
            <tr id="r1"><td>1</td></tr>
            <tr id="r2"><td>2</td></tr>
          </tbody>
        </table>
      </body>
    </html>
  `);

  let pageCount = 0;
  const table = useTable(page.locator('table'), {
    strategies: {
      dedupe: DedupeStrategies.byTopPosition(5), // 5px tolerance
      pagination: async () => {
        pageCount++;
        return pageCount < 2;
      }
    }
  });

  const results = await table.map(({ row }) => row.getCell('ID').innerText(), {
    maxPages: 2
  });

  expect(results).toHaveLength(2);
  expect(results).toEqual(['1', '2']);
});
