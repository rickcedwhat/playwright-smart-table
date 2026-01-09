import { test, expect } from '@playwright/test';
import { useTable } from '../src/useTable';
import { Strategies } from '../src/strategies';

test.describe('README.md Examples Verification', () => {

  test('Quick Start: Standard Table', async ({ page }) => {
    await page.goto('https://datatables.net/examples/data_sources/dom');

    // #region quick-start
    const table = await useTable(page.locator('#example'), {
      headerSelector: 'thead th' // Override for this specific site
    }).init();

    // 🪄 Finds the row with Name="Airi Satou", then gets the Position cell.
    // If Airi is on Page 2, use searchForRow for pagination.
    const row = table.getByRow({ Name: 'Airi Satou' });

    const positionCell = row.getCell('Position');
    await expect(positionCell).toHaveText('Accountant');
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
      strategies: {
        pagination: Strategies.Pagination.clickNext(() =>
          page.getByRole('link', { name: 'Next' })
        )
      },
      maxPages: 5 // Allow scanning up to 5 pages
    });
    await table.init();

    // ✅ Verify Colleen is NOT visible initially
    await expect(page.getByText("Colleen Hurst")).not.toBeVisible();

    // Use searchForRow for pagination
    await expect(await table.searchForRow({ Name: "Colleen Hurst" })).toBeVisible();
    // NOTE: We're now on the page where Colleen Hurst exists (typically Page 2)

    // #endregion pagination
  });

  test('SmartRow interaction (v2.0 Feature)', async ({ page }) => {
    await page.goto('https://datatables.net/examples/data_sources/dom');
    const table = useTable(page.locator('#example'), { headerSelector: 'thead th' });
    await table.init();

    // #region smart-row
    // 1. Get SmartRow via getByRow
    const row = table.getByRow({ Name: 'Airi Satou' });

    // 2. Interact with cell (No more getByCell needed!)
    // ✅ Good: Resilient to column reordering
    const positionCell = row.getCell('Position');
    await positionCell.click();

    // 3. Dump data from row
    const data = await row.toJSON();
    console.log(data);
    // { Name: "Airi Satou", Position: "Accountant", ... }
    // #endregion smart-row

    expect(data.Office).toBe('Tokyo');
  });

  test('getAllCurrentRows({ asJSON: true }) returns data objects', async ({ page }) => {
    await page.goto('https://datatables.net/examples/data_sources/dom');
    const table = useTable(page.locator('#example'), { headerSelector: 'thead th' });
    await table.init();

    // #region get-all-rows
    // 1. Get ALL rows on the current page
    const allRows = await table.getAllCurrentRows();

    // 2. Get subset of rows (Filtering)
    const tokyoUsers = await table.getAllCurrentRows({
      filter: { Office: 'Tokyo' }
    });
    expect(tokyoUsers.length).toBeGreaterThan(0);

    // 3. Dump data to JSON
    const data = await table.getAllCurrentRows({ asJSON: true });
    console.log(data); // [{ Name: "Airi Satou", ... }, ...]
    // #endregion get-all-rows

    expect(data[0]['Name']).toBe('Airi Satou');
  });

  test('Strict Retrieval & Negative Assertion', async ({ page }) => {
    await page.goto('https://datatables.net/examples/data_sources/dom');
    const table = useTable(page.locator('#example'), { headerSelector: 'thead th' });
    await table.init();

    // #region get-by-row
    // Find a row where Name is "Airi Satou" AND Office is "Tokyo"
    const row = table.getByRow({ Name: "Airi Satou", Office: "Tokyo" });
    await expect(row).toBeVisible();

    // Assert it does NOT exist
    await expect(table.getByRow({ Name: "Ghost User" })).not.toBeVisible();
    // #endregion get-by-row
  });

  test('Advanced Usage Features', async ({ page }) => {
    await page.goto('https://datatables.net/examples/data_sources/dom');

    // #region advanced-debug
    const table = useTable(page.locator('#example'), {
      headerSelector: 'thead th',
      debug: true
    });
    await table.init();
    // #endregion advanced-debug

    // #region advanced-reset
    // Navigate deep into the table (simulated by finding a row on page 2)
    // For the test to pass, we need a valid row. 'Angelica Ramos' is usually on page 1 or 2 depending on sorting.
    try {
      await table.searchForRow({ Name: 'Angelica Ramos' });
    } catch (e) { }

    // Reset internal state (and potentially UI) to Page 1
    await table.reset();
    await table.init(); // Re-init after reset
    // #endregion advanced-reset

    // #region advanced-column-scan
    // Quickly grab all text values from the "Office" column
    const offices = await table.getColumnValues('Office');
    expect(offices).toContain('Tokyo');
    // #endregion advanced-column-scan
  });
});