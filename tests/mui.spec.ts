import { test, expect } from '@playwright/test';
import { useTable } from '../src/useTable';
import { TableStrategies } from '../src/strategies';

test('Material UI Data Grid Interaction', async ({ page }) => {
  // 1. Navigate to the MUI DataGrid demo
  await page.goto('https://mui.com/material-ui/react-table/');

  // The demo grid is usually slightly down the page
  const tableLocator = page.locator('.MuiDataGrid-root').first();
  await tableLocator.scrollIntoViewIfNeeded();

  // 2. Initialize Smart Table
  const table = useTable(tableLocator, {
    rowSelector: '.MuiDataGrid-row',
    headerSelector: '.MuiDataGrid-columnHeader',
    cellSelector: '.MuiDataGrid-cell', // MUI uses distinct divs for cells
    pagination: TableStrategies.clickNext(
      (root) => root.getByRole("button", { name: "Go to next page" })
    ),
    maxPages: 5
  });

  // Debug: See what columns were detected
  console.log('Headers Detected:', await table.getHeaders());

  // 3. Find a row (Melisandre is usually in the standard demo dataset)
  // Note: We use "Last name" because that matches the visible header text
  const row = await table.getByRow({ "Last name": "Melisandre" });
  await expect(row).toBeVisible();
  console.log('✅ Found Melisandre');

  // 4. Check specific cell data
  // "Age" column for Melisandre should be "150"
  const ageCell = await table.getByCell({ "Last name": "Melisandre" }, "Age");
  await expect(ageCell).toHaveText("150");
  console.log('✅ Verified Age is 150');

  // 5. Dump Data
  const userData = await table.getRowAsJSON({ "Last name": "Melisandre" });
  console.log('User Data JSON:', userData);

  // This works because we added getHeaders() back to the helper
const headers = await table.getHeaders();
console.log(headers);

// 4. Change: Interact with the Checkbox
// Logic: Find the cell in the first column (__col_0) for the row with Age: 150
// Then click the input/label inside that cell.
await (await table.getByCell({ Age: "150" }, "__col_0"))
    .getByLabel("Select row")
    .click();
});