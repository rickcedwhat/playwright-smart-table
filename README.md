Playwright Smart Table 🧠

A production-ready, type-safe table wrapper for Playwright.

This library abstracts away the complexity of testing dynamic web tables. It handles Pagination, Infinite Scroll, Virtualization, and Data Grids (MUI, AG-Grid) so your tests remain clean and readable.

📦 Installation

npm install @rickcedwhat/playwright-smart-table


Requires @playwright/test as a peer dependency.

🚀 Quick Start

1. The Standard HTML Table

For standard tables (<table>, <tr>, <td>), no configuration is needed.

import { test, expect } from '@playwright/test';
import { useTable } from '@rickcedwhat/playwright-smart-table';

test('Verify User Email', async ({ page }) => {
  const table = useTable(page.locator('#users-table'));
  
  // 🪄 Magic: Finds the row with Name="Alice", then gets the Email cell
  // If Alice is on Page 2, it handles pagination automatically.
  await expect(
    await table.getByCell({ Name: 'Alice' }, 'Email')
  ).toHaveText('alice@example.com');
});


2. Complex Grids (Material UI / AG-Grid / Divs)

For modern React grids that use <div> structures, simply override the selectors.

import { useTable, TableStrategies } from '@rickcedwhat/playwright-smart-table';

const table = useTable(page.locator('.MuiDataGrid-root'), {
  rowSelector: '.MuiDataGrid-row',
  headerSelector: '.MuiDataGrid-columnHeader',
  cellSelector: '.MuiDataGrid-cell',
  // Strategy: Tell it how to find the next page
  pagination: TableStrategies.clickNext(
    (root) => root.getByRole('button', { name: 'Go to next page' })
  )
});


🧩 Pagination Strategies

This library uses the Strategy Pattern to handle navigation. This ensures future stability: we can add new ways to paginate without breaking existing tests.

clickNext(selector)

Best for standard tables (Datatables, lists).

Behavior: Clicks the button -> Waits for the first row of data to change.

Selector: Can be a CSS string OR a Playwright locator function.

// CSS String
pagination: TableStrategies.clickNext('button.next-page')

// Locator Function (More Robust)
pagination: TableStrategies.clickNext((root) => root.getByRole('button', { name: 'Next' }))


infiniteScroll()

Best for Virtualized Grids (AG-Grid) or lazy-loading lists (HTMX).

Behavior: Aggressively scrolls the container/window to the bottom -> Waits for row count to increase.

pagination: TableStrategies.infiniteScroll()


clickLoadMore(selector)

Best for "Load More" buttons.

Behavior: Clicks button -> Waits for row count to increase.

pagination: TableStrategies.clickLoadMore('button.load-more')


📖 API Reference

getByRow(filters, options?)

Returns the Locator for a specific row.

Strict Mode: Throws an error if filters match more than 1 row.

Auto-Pagination: Will search up to maxPages to find the row.

// Find a row where Name is "Alice" AND Role is "Admin"
const row = await table.getByRow({ Name: "Alice", Role: "Admin" });
await expect(row).toBeVisible();


getByCell(filters, targetColumn)

Returns the Locator for a specific cell inside a matched row.

Use this for interactions (clicking edit buttons, checking checkboxes).

// Find Alice's row, then find the "Actions" column, then click the button inside it
await table.getByCell({ Name: "Alice" }, "Actions").getByRole('button').click();


getRowAsJSON(filters)

Returns a POJO (Plain Old JavaScript Object) of the row data. Useful for debugging or strict data assertions.

const data = await table.getRowAsJSON({ ID: "101" });
console.log(data); 
// Output: { ID: "101", Name: "Alice", Status: "Active" }


getRows()

Returns an array of all rows on the current page.

const allRows = await table.getRows();
expect(allRows[0].Name).toBe("Alice"); // Verify sort order


🛠️ Developer Tools

The library includes helper tools to generate configurations for you.

// Print the HTML structure prompt to console
// Copy-paste the output into ChatGPT/Gemini to get your config object
await table.generateConfigPrompt();

// Print a prompt to help write a custom Pagination Strategy
await table.generateStrategyPrompt();


🛡️ Stability & Versioning

This package follows Semantic Versioning.

1.x.x: No breaking changes to the useTable signature.

New strategies may be added, but existing ones will remain stable.

To ensure stability in your projects, install with:

"@rickcedwhat/playwright-smart-table": "^1.0.0"
