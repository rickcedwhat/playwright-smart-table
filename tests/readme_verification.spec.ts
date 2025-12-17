import { test, expect } from '@playwright/test';
import { useTable } from '../src/useTable';
import { TableStrategies } from '../src/strategies';

test.describe('README.md Examples Verification', () => {

  test('Quick Start: Standard Table', async ({ page }) => {
    await page.goto('https://datatables.net/examples/data_sources/dom');

    // #region quick-start
    const table = useTable(page.locator('#example'), {
      headerSelector: 'thead th' // Override for this specific site
    });

    // 🪄 Finds the row with Name="Airi Satou", then gets the Position cell.
    // If Airi is on Page 2, it handles pagination automatically.
    const row = await table.getByRow({ Name: 'Airi Satou' });

    await expect(row.getCell('Position')).toHaveText('Accountant');
    // #endregion quick-start
  });

  test('Strategy: Click Next (Datatables.net)', async ({ page }) => {
    await page.goto('https://datatables.net/examples/data_sources/dom');
    // Ensure table is fully loaded
    await page.waitForSelector('#example_wrapper');

    // #region pagination
    const table = useTable(page.locator('#example'), {
      rowSelector: 'tbody tr',
      headerSelector: 'thead th',
      cellSelector: 'td',
      // Strategy: Tell it how to find the next page
      pagination: TableStrategies.clickNext(() => 
        page.getByRole('link', { name: 'Next' })
      ),
      maxPages: 5 // Allow scanning up to 5 pages
    });

    // ✅ Verify Colleen is NOT visible initially
    await expect(page.getByText("Colleen Hurst")).not.toBeVisible();

    await expect(await table.getByRow({ Name: "Colleen Hurst" })).toBeVisible();
    // NOTE: We're now on the page where Colleen Hurst exists (typically Page 2)

    // #endregion pagination
  });

  test('SmartRow interaction (v2.0 Feature)', async ({ page }) => {
    await page.goto('https://datatables.net/examples/data_sources/dom');
    const table = useTable(page.locator('#example'), { headerSelector: 'thead th' });

    // #region smart-row
    // 1. Get SmartRow via getByRow
    const row = await table.getByRow({ Name: 'Airi Satou' });

    // 2. Interact with cell (No more getByCell needed!)
    // ✅ Good: Resilient to column reordering
    await row.getCell('Position').click();

    // 3. Dump data from row
    const data = await row.toJSON();
    console.log(data);
    // { Name: "Airi Satou", Position: "Accountant", ... }
    // #endregion smart-row

    expect(data.Office).toBe('Tokyo');
  });

  test('getAllRows({ asJSON: true }) returns data objects', async ({ page }) => {
    await page.goto('https://datatables.net/examples/data_sources/dom');
    const table = useTable(page.locator('#example'), { headerSelector: 'thead th' });

    // #region get-all-rows
    // 1. Get ALL rows on the current page
    const allRows = await table.getAllRows();

    // 2. Get subset of rows (Filtering)
    const tokyoUsers = await table.getAllRows({
      filter: { Office: 'Tokyo' }
    });
    expect(tokyoUsers.length).toBeGreaterThan(0);

    // 3. Dump data to JSON
    const data = await table.getAllRows({ asJSON: true });
    console.log(data); // [{ Name: "Airi Satou", ... }, ...]
    // #endregion get-all-rows

    expect(data[0]['Name']).toBe('Airi Satou');
  });

  test('Strict Retrieval & Negative Assertion', async ({ page }) => {
    await page.goto('https://datatables.net/examples/data_sources/dom');
    const table = useTable(page.locator('#example'), { headerSelector: 'thead th' });

    // #region get-by-row
    // Find a row where Name is "Airi Satou" AND Office is "Tokyo"
    const row = await table.getByRow({ Name: "Airi Satou", Office: "Tokyo" });
    await expect(row).toBeVisible();

    // Assert it does NOT exist
    await expect(await table.getByRow({ Name: "Ghost User" })).not.toBeVisible();
    // #endregion get-by-row
  });
});