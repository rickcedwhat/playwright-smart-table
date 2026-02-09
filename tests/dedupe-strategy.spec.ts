
import { test, expect } from '@playwright/test';
import { useTable } from '../src/useTable';
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

  const table = useTable(page.locator('table'), {
    strategies: {
      dedupe: DedupeStrategies.byTopPosition(5) // 5px tolerance
    }
  });

  // Manually invoke iteration with a mock "scroll" behavior by just calling it?
  // iterateThroughTable iterates until maxPages or end.
  // Here we have 1 page.
  // But deduplication happens ACROSS iterations or within?
  // Within `iterateThroughTable` loop, `seenKeys` persists across iterations.

  // To test dedupe effectively, we need to simulate finding the "same" row in multiple iterations.
  // We can use `batchSize` to force multiple iterations over the SAME rows if pagination doesn't change them?
  // Or just mock `pagination` strategy to NOT scroll but keep returning true once?

  let pageCount = 0;
  const results = await table.iterateThroughTable<string>(async ({ rows }) => {
    const ids = await Promise.all(rows.map(r => r.getCell('ID').innerText()));
    return ids;
  }, {
    maxIterations: 2, // Force 2 iterations
    pagination: async () => {
      // Simulate "next page" loads the same content (often happens in virtual scroll partial updates)
      // Actually here we just return true to allow next iteration.
      // The DOM remains same.
      pageCount++;
      return pageCount < 2;
    },
    autoFlatten: true
  });

  // If dedupe works, we should only get 2 rows total, because iteration 2 sees same rows at same positions.
  // If dedupe fails, we get 4 rows (1, 2, 1, 2).

  expect(results).toHaveLength(2);
  expect(results).toEqual(['1', '2']);
});
