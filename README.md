Playwright Smart Table 🧠

A production-ready, type-safe table wrapper for Playwright.

This library abstracts away the complexity of testing dynamic web tables. It handles Pagination, Infinite Scroll, Virtualization, and Data Grids (MUI, AG-Grid) so your tests remain clean and readable.

📦 Installation

npm install @rickcedwhat/playwright-smart-table


Requires @playwright/test as a peer dependency.

⚡ Quick Start

1. The Standard HTML Table

For standard tables (<table>, <tr>, <td>), no configuration is needed.

import { test, expect } from '@playwright/test';
import { useTable } from '@rickcedwhat/playwright-smart-table';

test('Verify User Email', async ({ page }) => {
  const table = useTable(page.locator('#users-table'));
  
  // 🪄 Finds the row with Name="Alice", then gets the Email cell.
  // If Alice is on Page 2, it handles pagination automatically.
  const row = await table.getByRow({ Name: 'Alice' });
  
  await expect(row.getCell('Email')).toHaveText('alice@example.com');
});


2. Complex Grids (Material UI / AG-Grid / Divs)

For modern React grids, simply override the selectors and define a pagination strategy.

import { useTable, TableStrategies } from '@rickcedwhat/playwright-smart-table';

const table = useTable(page.locator('.MuiDataGrid-root'), {
  rowSelector: '.MuiDataGrid-row',
  headerSelector: '.MuiDataGrid-columnHeader',
  cellSelector: '.MuiDataGrid-cell',
  // Strategy: Tell it how to find the next page
  pagination: TableStrategies.clickNext(
    // Use 'page' to find buttons outside the table container
    (root) => root.page().getByRole('button', { name: 'Go to next page' })
  )
});


🧠 SmartRow Pattern

The core power of this library is the SmartRow.

Unlike a standard Playwright Locator, a SmartRow is aware of its context within the table's schema. It extends the standard Locator API, so you can chain standard Playwright methods (.click(), .isVisible()) directly off it.

getCell(columnName)

Instead of writing brittle nth-child selectors, ask for the column by name.

// ✅ Good: Resilient to column reordering
await row.getCell('Email').click(); 

// ❌ Bad: Brittle
await row.locator('td').nth(2).click(); 


toJSON()

Extracts the entire row's data into a clean key-value object.

const data = await row.toJSON();
console.log(data); 
// { Name: "Alice", Role: "Admin", Status: "Active" }


📖 API Reference

getByRow(filters, options?)

Strict Retrieval. Finds a single specific row.

Throws Error if >1 rows match (ambiguous query).

Returns Sentinel if 0 rows match (allows not.toBeVisible() assertions).

Auto-Paginates if the row isn't found on the current page.

// Find a row where Name is "Alice" AND Role is "Admin"
const row = await table.getByRow({ Name: "Alice", Role: "Admin" });
await expect(row).toBeVisible();

// Assert it does NOT exist
await expect(await table.getByRow({ Name: "Ghost" })).not.toBeVisible();


getAllRows(options?)

Inclusive Retrieval. Gets a collection of rows.

Returns: Array of SmartRow objects.

Best for: Checking existence ("at least one") or validating sort order.

// 1. Get ALL rows on the current page
const allRows = await table.getAllRows();

// 2. Get subset of rows (Filtering)
const activeUsers = await table.getAllRows({ 
  filter: { Status: 'Active' } 
});
expect(activeUsers.length).toBeGreaterThan(0); // "At least one active user"

// 3. Dump data to JSON
const data = await table.getAllRows({ asJSON: true });
console.log(data); // [{ Name: "Alice", Status: "Active" }, ...]


🧩 Pagination Strategies

This library uses the Strategy Pattern to handle navigation. You can use the built-in strategies or write your own.

Built-in Strategies

clickNext(selector)
Best for standard tables (Datatables, lists). Clicks a button and waits for data to change.

pagination: TableStrategies.clickNext((root) => 
  root.page().getByRole('button', { name: 'Next' })
)


infiniteScroll()
Best for Virtualized Grids (AG-Grid, HTMX). Aggressively scrolls to trigger data loading.

pagination: TableStrategies.infiniteScroll()


clickLoadMore(selector)
Best for "Load More" buttons. Clicks and waits for row count to increase.

Writing Custom Strategies

A Strategy is just a function that receives the table context and returns a Promise<boolean> (true if navigation happened, false if we reached the end).

import { PaginationStrategy } from '@rickcedwhat/playwright-smart-table';

const myCustomStrategy: PaginationStrategy = async ({ root, page, config }) => {
  // 1. Check if we can navigate
  const nextBtn = page.getByTestId('custom-next-arrow');
  if (!await nextBtn.isVisible()) return false;

  // 2. Perform Navigation
  await nextBtn.click();

  // 3. Smart Wait (Crucial!)
  // Wait for a loading spinner to disappear, or data to change
  await expect(page.locator('.spinner')).not.toBeVisible();
  
  return true; // We successfully moved to the next page
};


🛠️ Developer Tools

Don't waste time writing selectors manually. Use the generator tools to create your config.

generateConfigPrompt(options?)

Prints a prompt you can paste into ChatGPT/Gemini to generate the TableConfig for your specific HTML.

// Options: 'console' (default), 'report' (Playwright HTML Report), 'file'
await table.generateConfigPrompt({ output: 'report' });


generateStrategyPrompt(options?)

Prints a prompt to help you write a custom Pagination Strategy.

await table.generateStrategyPrompt({ output: 'console' });
