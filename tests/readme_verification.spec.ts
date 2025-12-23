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

  test('SmartRow: Core Pattern', async ({ page }) => {
    await page.goto('https://datatables.net/examples/data_sources/dom');
    const table = useTable(page.locator('#example'), { headerSelector: 'thead th' });

    // #region smart-row
    // 1. Get SmartRow via getByRow
    const row = await table.getByRow({ Name: 'Airi Satou' });

    // 2. Interact with cell
    // ✅ Good: Resilient to column reordering
    await row.getCell('Position').click();

    // 3. Dump data from row
    const data = await row.toJSON();
    console.log(data);
    // { Name: "Airi Satou", Position: "Accountant", ... }
    // #endregion smart-row

    expect(data.Office).toBe('Tokyo');
  });

  test('Pagination: Click Next Strategy', async ({ page }) => {
    await page.goto('https://datatables.net/examples/data_sources/dom');
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

  test('getByRow: Strict Retrieval & Negative Assertion', async ({ page }) => {
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

  test('getAllRows: Multiple Usage Patterns', async ({ page }) => {
    await page.goto('https://datatables.net/examples/data_sources/dom');
    const table = useTable(page.locator('#example'), { headerSelector: 'thead th' });

    // #region get-all-rows
    // 1. Get ALL rows on the current page
    const allRows = await table.getAllRows();
    expect(allRows.length).toBeGreaterThan(0);

    // 2. Get subset of rows (Filtering)
    const tokyoUsers = await table.getAllRows({
      filter: { Office: 'Tokyo' }
    });
    expect(tokyoUsers.length).toBeGreaterThan(0);

    // 3. Dump data to JSON
    const data = await table.getAllRows({ asJSON: true });
    console.log(data); // [{ Name: "Airi Satou", ... }, ...]
    expect(data.length).toBeGreaterThan(0);
    expect(data[0]).toHaveProperty('Name');
    // #endregion get-all-rows
  });

  test('headerTransformer: Renaming Empty Columns', async ({ page }) => {
    await page.goto('https://mui.com/material-ui/react-table/');
    
    // #region header-transformer
    const table = useTable(page.locator('.MuiDataGrid-root').first(), {
      rowSelector: '.MuiDataGrid-row',
      headerSelector: '.MuiDataGrid-columnHeader',
      cellSelector: '.MuiDataGrid-cell',
      pagination: TableStrategies.clickNext(
        (root) => root.getByRole("button", { name: "Go to next page" })
      ),
      maxPages: 5,
      // Transform empty columns (detected as __col_0, __col_1, etc.) to meaningful names
      headerTransformer: ({ text }) => {
        // We know there is only one empty column which we will rename to "Actions" for easier reference
        if (text.includes('__col_') || text.trim() === '') {
          return 'Actions';
        }
        return text;
      }
    });

    const headers = await table.getHeaders();
    // Now we can reference the "Actions" column even if it has no header text
    expect(headers).toContain('Actions');
    
    // Use the renamed column
    const row = await table.getByRow({ "Last name": "Melisandre" });
    await row.getCell('Actions').getByLabel("Select row").click();
    // #endregion header-transformer
  });

  test('headerTransformer: Normalizing Column Names', async ({ page }) => {
    await page.goto('https://the-internet.herokuapp.com/tables');
    
    // #region header-transformer-normalize
    const table = useTable(page.locator('#table1'), {
      // Normalize column names: remove extra spaces, handle inconsistent casing
      headerTransformer: ({ text }) => {
        return text.trim()
          .replace(/\s+/g, ' ')  // Normalize whitespace
          .replace(/^\s*|\s*$/g, ''); // Remove leading/trailing spaces
      }
    });

    // Now column names are consistent
    const row = await table.getByRow({ "Last Name": "Doe" });
    await expect(row.getCell("Email")).toHaveText("jdoe@hotmail.com");
    // #endregion header-transformer-normalize
  });

  test('Advanced: Debug Mode', async ({ page }) => {
    await page.goto('https://datatables.net/examples/data_sources/dom');
    
    // #region advanced-debug
    const table = useTable(page.locator('#example'), {
      headerSelector: 'thead th',
      debug: true // Enables verbose logging of internal operations
    });
    
    const row = await table.getByRow({ Name: 'Airi Satou' });
    await expect(row).toBeVisible();
    // #endregion advanced-debug
  });

  test('Advanced: Reset Table State', async ({ page }) => {
    await page.goto('https://datatables.net/examples/data_sources/dom');
    const table = useTable(page.locator('#example'), { 
      headerSelector: 'thead th',
      pagination: TableStrategies.clickNext(() => 
        page.getByRole('link', { name: 'Next' })
      ),
      maxPages: 5
    });
    
    // #region advanced-reset
    // Navigate deep into the table by searching for a row on a later page
    try {
      await table.getByRow({ Name: 'Angelica Ramos' });
    } catch (e) {}
    
    // Reset internal state (and potentially UI) to Page 1
    await table.reset();
    
    // Now subsequent searches start from the beginning
    const firstPageRow = await table.getByRow({ Name: 'Airi Satou' });
    await expect(firstPageRow).toBeVisible();
    // #endregion advanced-reset
  });

  test('Advanced: Column Scanning', async ({ page }) => {
    await page.goto('https://datatables.net/examples/data_sources/dom');
    const table = useTable(page.locator('#example'), { headerSelector: 'thead th' });

    // #region advanced-column-scan
    // Quickly grab all text values from the "Office" column
    const offices = await table.getColumnValues('Office'); 
    expect(offices).toContain('Tokyo');
    expect(offices.length).toBeGreaterThan(0);
    // #endregion advanced-column-scan
  });

  test('Advanced: Column Scanning with Custom Mapper', async ({ page }) => {
    await page.goto('https://datatables.net/examples/data_sources/dom');
    const table = useTable(page.locator('#example'), { headerSelector: 'thead th' });

    // #region advanced-column-scan-mapper
    // Extract numeric values from a column
    const ages = await table.getColumnValues('Age', {
      mapper: async (cell) => {
        const text = await cell.innerText();
        return parseInt(text, 10);
      }
    });
    
    // Now ages is an array of numbers
    expect(ages.every(age => typeof age === 'number')).toBe(true);
    expect(ages.length).toBeGreaterThan(0);
    // #endregion advanced-column-scan-mapper
  });

  test('getByRow: Returning JSON Data', async ({ page }) => {
    await page.goto('https://datatables.net/examples/data_sources/dom');
    const table = useTable(page.locator('#example'), { headerSelector: 'thead th' });

    // #region get-by-row-json
    // Get row data directly as JSON object
    const data = await table.getByRow({ Name: 'Airi Satou' }, { asJSON: true });
    // Returns: { Name: "Airi Satou", Position: "Accountant", Office: "Tokyo", ... }
    
    expect(data).toHaveProperty('Name', 'Airi Satou');
    expect(data).toHaveProperty('Position');
    // #endregion get-by-row-json
  });

  test('getAllRows: Filtering with Exact Match', async ({ page }) => {
    await page.goto('https://datatables.net/examples/data_sources/dom');
    const table = useTable(page.locator('#example'), { headerSelector: 'thead th' });

    // #region get-all-rows-exact
    // Get rows with exact match (default is fuzzy/contains match)
    const exactMatches = await table.getAllRows({
      filter: { Office: 'Tokyo' },
      exact: true // Requires exact string match
    });
    
    expect(exactMatches.length).toBeGreaterThan(0);
    // #endregion get-all-rows-exact
  });
});
