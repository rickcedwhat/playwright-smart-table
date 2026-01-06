import { test, expect } from '@playwright/test';
import { useTable } from '../src/useTable';
import { TableStrategies } from '../src/strategies';

test.describe('Real World Strategy Tests', () => {

  

  test('Strategy: Infinite Scroll (HTMX Example)', async ({ page }) => {
    await page.goto('https://htmx.org/examples/infinite-scroll/');
    
    const tableLoc = page.locator('table'); 

    const table = useTable(tableLoc, {
      rowSelector: 'tbody tr',
      headerSelector: 'thead th',
      cellSelector: 'td',
      pagination: TableStrategies.infiniteScroll(), 
      maxPages: 5
    });
    await table.init();

    const initialRows = await table.getAllCurrentRows();
    console.log(`Initial Row Count: ${initialRows.length}`);

    console.log("🔎 Triggering Scroll...");
    // Use searchForRow for pagination
    const missing = await table.searchForRow({ "ID": "NonExistentID" });
    
    await expect(missing).not.toBeVisible();
    
    // ✅ UPDATE: getRows -> getAllCurrentRows
    const finalRows = await table.getAllCurrentRows();
    console.log(`Final Row Count: ${finalRows.length}`);
    
    expect(finalRows.length).toBeGreaterThan(initialRows.length);
  });

  test('Material UI Data Grid Interaction', async ({ page }) => {
    // 1. Navigate to the MUI DataGrid demo
    await page.goto('https://mui.com/material-ui/react-table/');

    const tableLocator = page.locator('.MuiDataGrid-root').first();

    // 2. Initialize Smart Table
    const table = useTable(tableLocator, {
      rowSelector: '.MuiDataGrid-row',
      headerSelector: '.MuiDataGrid-columnHeader',
      cellSelector: '.MuiDataGrid-cell', // MUI uses distinct divs for cells
      pagination: TableStrategies.clickNext(
        (root) => root.getByRole("button", { name: "Go to next page" })
      ),
      maxPages: 5,
      // ✅ Rename the empty column to "Actions" so we can reference it easily
      headerTransformer: ({ text }) => text.includes('__col_') ? "Actions" : text
    });
    await table.init();

    // Debug: See what columns were detected
    const headers = await table.getHeaders();
    console.log('Headers Detected:', headers);
    expect(headers).toContain('Actions');

    // 3. Find a row (Melisandre is usually in the standard demo dataset)
    // First check it's not on the current page
    const currentPageRow = table.getByRow({ "Last name": "Melisandre" });
    await expect(currentPageRow).not.toBeVisible();
    
    // Then find it across pages
    const row = await table.searchForRow({ "Last name": "Melisandre" });
    await expect(row).toBeVisible();
    console.log('✅ Found Melisandre');

    // 4. Check specific cell data
    const ageCell = row.getCell('Age');
    await expect(ageCell).toHaveText("150");
    console.log('✅ Verified Age is 150');

    // 5. Dump Data
    const userData = await row.toJSON();
    console.log('User Data JSON:', userData);

    // 6. Interact with the Checkbox
    // Logic: Find the cell in the "Actions" column (was __col_0) for the row with Age: 150
    // Then click the input/label inside that cell.
    const actionsRow = await table.searchForRow({Age:"150"});
    const actionsCell = actionsRow.getCell("Actions");
    await actionsCell.getByLabel("Select row").click();
  });

});