import { test, expect } from '@playwright/test';
import { useTable } from '../src/useTable';
import { Strategies } from '../src/strategies';

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

    const initialRows = await table.getRows();
    console.log(`Initial Row Count: ${initialRows.length}`);

    console.log("🔎 Triggering Scroll...");
    // Use findRow for pagination
    const missing = await table.findRow({ "ID": "NonExistentID" });

    await expect(missing).not.toBeVisible();

    // ✅ UPDATE: getRows -> getRows
    const finalRows = await table.getRows();
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
      strategies: {
        pagination: Strategies.Pagination.clickNext(
          (root) => root.getByRole("button", { name: "Go to next page" })
        ),
      },
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
    const currentPageRow = table.getRow({ "Last name": "Melisandre" });
    await expect(currentPageRow).not.toBeVisible();

    // Then find it across pages
    const row = await table.findRow({ "Last name": "Melisandre" });
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
    const actionsRow = await table.findRow({ Age: "150" });
    const actionsCell = actionsRow.getCell("Actions");
    await actionsCell.getByLabel("Select row").click();
  });

  test.describe('RowType Generic Support', () => {
    test('should provide typed row data with generic', async ({ page }) => {
      await page.goto('https://datatables.net/examples/data_sources/dom');

      interface Employee {
        Name: string;
        Position: string;
        Office: string;
        Age: string;
        'Start date': string;
        Salary: string;
      }

      const table = useTable<Employee>(page.locator('#example'), {
        headerSelector: 'thead th'
      });
      await table.init();

      const row = table.getRowByIndex(0);
      const data = await row.toJSON();

      // TypeScript should infer data as Employee
      expect(data.Name).toBeDefined();
      expect(data.Position).toBeDefined();
      expect(data.Office).toBeDefined();
      expect(typeof data.Name).toBe('string');
    });

    test('should support Partial<T> in filters', async ({ page }) => {
      await page.goto('https://datatables.net/examples/data_sources/dom');

      interface Employee {
        Name: string;
        Position: string;
        Office: string;
      }

      const table = useTable<Employee>(page.locator('#example'), {
        headerSelector: 'thead th'
      });
      await table.init();

      // Should accept Partial<Employee> - only Name field
      const row = table.getRow({ Name: 'Airi Satou' });
      await expect(row).toBeVisible();

      // Should also work with findRow
      const searchedRow = await table.findRow({ Office: 'Tokyo' });
      await expect(searchedRow).toBeVisible();
    });

    test('should work with getRows and asJSON', async ({ page }) => {
      await page.goto('https://datatables.net/examples/data_sources/dom');

      interface Employee {
        Name: string;
        Office: string;
      }

      const table = useTable<Employee>(page.locator('#example'), {
        headerSelector: 'thead th'
      });
      await table.init();

      // Get typed data
      const rows = await table.getRows();
      const data = await rows.toJSON();

      // TypeScript should infer data as Employee[]
      expect(data.length).toBeGreaterThan(0);
      expect(data[0].Name).toBeDefined();
      expect(data[0].Office).toBeDefined();
    });
  });

});