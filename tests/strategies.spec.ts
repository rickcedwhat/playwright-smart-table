import { test, expect } from '@playwright/test';
import { useTable } from '../src/index';
import { Strategies } from '../src/index';

test.describe('Real World Strategy Tests', () => {
  test('Strategy: Infinite Scroll (HTMX Example)', async ({ page }) => {
    await page.goto('https://htmx.org/examples/infinite-scroll/');

    const tableLoc = page.locator('table');

    const table = useTable(tableLoc, {
      rowSelector: 'tbody tr',
      headerSelector: 'thead th',
      cellSelector: 'td',
      strategies: {
        pagination: Strategies.Pagination.infiniteScroll()
      },
      maxPages: 5,
    });
    await table.init();

    const initialRows = await table.findRows({}, { maxPages: 1 });
    console.log(`Initial Row Count: ${initialRows.length}`);

    console.log("🔎 Triggering Scroll...");
    const missing = await table.findRow({ "ID": "NonExistentID" });

    await expect(missing).not.toBeVisible();

    const finalRows = await table.findRows({}, { maxPages: 1 });
    console.log(`Final Row Count: ${finalRows.length}`);

    expect(finalRows.length).toBeGreaterThan(initialRows.length);
  });
});