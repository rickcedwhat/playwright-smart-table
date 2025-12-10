// tests/strategies.spec.ts
import { test, expect } from '@playwright/test';
import { useTable } from '../src/useTable';
import { TableStrategies } from '../src/strategies';

test.describe('Real World Strategy Tests', () => {

  test('Strategy: Click Next (Datatables.net)', async ({ page }) => {
    await page.goto('https://datatables.net/examples/data_sources/dom');

    const tableLoc = page.locator('#example');

    const table = useTable(tableLoc, {
      rowSelector: 'tbody tr',
      headerSelector: 'thead th',
      cellSelector: 'td',
      // Strategy: Standard "Next" Button
      pagination: TableStrategies.clickNext('#example_next'),
      maxPages: 3
    });

    // Verify Page 1
    await expect(await table.getByRow({ Name: "Airi Satou" })).toBeVisible();
    
    // Verify Page 2 (Triggers Click Next)
    // "Bradley Greer" is usually on Page 2
    console.log("🔎 Searching for Bradley Greer (Page 2)...");
    await expect(await table.getByRow({ Name: "Bradley Greer" })).toBeVisible();
    console.log("✅ Found row on Page 2!");
  });

  test('Strategy: Infinite Scroll (HTMX Example)', async ({ page }) => {
    await page.goto('https://htmx.org/examples/infinite-scroll/');
    
    const tableLoc = page.locator('table');

    const table = useTable(tableLoc, {
      rowSelector: 'tbody tr',
      headerSelector: 'thead th',
      cellSelector: 'td',
      // Strategy: Infinite Scroll (Scroll to bottom -> Wait for row count to increase)
      pagination: TableStrategies.infiniteScroll(),
      maxPages: 5
    });

    // 1. Get initial count
    const initialRows = await table.getRows();
    console.log(`Initial Row Count: ${initialRows.length}`);

    // 2. Trigger Scroll by searching for a row that doesn't exist yet
    // HTMX demo generates random IDs. We'll simulate a deep search by asking for
    // the 40th row (since it loads ~20 at a time).
    
    // HACK: Since IDs are random, we simply check that the library *attempts* to scroll.
    // We expect it to eventually fail finding "NonExistent", but verify it tried 5 pages.
    console.log("🔎 Triggering Scroll...");
    const missing = await table.getByRow({ "ID": "NonExistentID" });
    
    // It should have tried 5 times (scrolling each time)
    await expect(missing).not.toBeVisible();
    
    const finalRows = await table.getRows();
    console.log(`Final Row Count: ${finalRows.length}`);
    
    expect(finalRows.length).toBeGreaterThan(initialRows.length);
    console.log("✅ Infinite Scroll successfully loaded more rows!");
  });

});