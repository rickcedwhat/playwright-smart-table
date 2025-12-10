Playwright Smart Table 🧠
A production-ready, type-safe table wrapper for Playwright.
It handles the hard stuff automatically:
Pagination (Next buttons, Load More, Infinite Scroll)
Complex Grids (MUI, AG-Grid, React Table)
Strict Mode (Throws errors if your filters match multiple rows)
🚀 Installation
npm install playwright-smart-table


(Note: Requires @playwright/test as a peer dependency)
🏁 Quick Start
Standard HTML Table (No config needed)
import { test, expect } from '@playwright/test';
import { useTable } from 'playwright-smart-table';

test('Verify User', async ({ page }) => {
  await page.goto('/users');

  // 1. Initialize (Defaults to <table>, <tr>, <td>)
  const table = useTable(page.locator('#users-table'));
  
  // 2. Find row across pages automatically!
  // This will search Page 1, then Page 2, etc.
  const row = await table.getByRow({ Name: 'Alice', Role: 'Admin' });
  
  await expect(row).toBeVisible();
});


🧩 Pagination Strategies
This library doesn't guess how your table works. You tell it using a Strategy.
1. Standard "Next" Button
For tables like Datatables.net or simple paginated lists.
import { TableStrategies } from 'playwright-smart-table';

const table = useTable(locator, {
  // Strategy: Find button -> Click -> Wait for first row to change
  pagination: TableStrategies.clickNext('[aria-label="Next Page"]')
});


2. Infinite Scroll
For grids that load more data as you scroll down (AG-Grid, Virtual Lists, HTMX).
const table = useTable(locator, {
  // Strategy: Aggressive scroll to bottom -> Wait for row count to increase
  pagination: TableStrategies.infiniteScroll()
});


3. Load More Button
For lists with a "Load More Results" button at the bottom.
const table = useTable(locator, {
  // Strategy: Click button -> Wait for row count to increase
  pagination: TableStrategies.clickLoadMore('button.load-more')
});


⚙️ Advanced Config (MUI / Grid / Divs)
For complex div-based tables (like Material UI DataGrid), you can override the selectors.
const table = useTable(page.locator('.MuiDataGrid-root'), {
  rowSelector: '.MuiDataGrid-row',
  headerSelector: '.MuiDataGrid-columnHeader',
  cellSelector: '.MuiDataGrid-cell',
  pagination: TableStrategies.clickNext('[aria-label="Go to next page"]')
});


📖 API Reference
getByRow(filters, options?)
Finds a specific row matching the filters.
filters: { "Column Name": "Value", "Age": "25" }
options: { exact: true }
Returns: Playwright Locator for that row.
Throws error if multiple rows match.
await table.getByRow({ Email: "alice@example.com" });


getByCell(filters, targetColumn)
Finds a specific cell inside a filtered row. Useful for clicking action buttons.
Returns: Playwright Locator for the cell.
// Find the 'Edit' button for Alice
await table.getByCell({ Name: "Alice" }, "Actions").getByRole('button').click();


getRows()
Dumps all rows on the current page as an array of objects. Great for verifying sort order.
const rows = await table.getRows();
expect(rows[0].Name).toBe("Alice");
expect(rows[1].Name).toBe("Bob");


getRowAsJSON(filters)
Returns a single row's data as a JSON object.
const data = await table.getRowAsJSON({ ID: "123" });
console.log(data); // { ID: "123", Name: "Alice", Status: "Active" }


🛠️ Custom Strategies
Need to handle a custom pagination logic? Write your own strategy!
A strategy is just a function that returns Promise<boolean> (true if data loaded, false if done).
const myCustomStrategy = async ({ root, page, resolve }) => {
  // 1. Find your specific button
  const btn = resolve('.my-weird-button', root);
  
  if (!await btn.isVisible()) return false; // Stop pagination
  
  // 2. Click and Wait
  await btn.click();
  await page.waitForResponse(resp => resp.url().includes('/api/users'));
  
  return true; // We loaded more!
};

// Usage
useTable(locator, { pagination: myCustomStrategy });


