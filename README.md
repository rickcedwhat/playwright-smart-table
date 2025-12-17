Playwright Smart Table 🧠

A production-ready, type-safe table wrapper for Playwright.

This library abstracts away the complexity of testing dynamic web tables. It handles Pagination, Infinite Scroll, Virtualization, and Data Grids (MUI, AG-Grid) so your tests remain clean and readable.

📦 Installation

npm install @rickcedwhat/playwright-smart-table


Requires @playwright/test as a peer dependency.

⚡ Quick Start

1. The Standard HTML Table

For standard tables (<table>, <tr>, <td>), no configuration is needed (defaults work for most standard HTML tables).

<!-- embed: quick-start -->

<!-- /embed: quick-start -->

2. Complex Grids (Material UI / AG-Grid / Divs)

For modern React grids, simply override the selectors and define a pagination strategy.

<!-- embed: pagination -->

<!-- /embed: pagination -->

🧠 SmartRow Pattern

The core power of this library is the SmartRow.

Unlike a standard Playwright Locator, a SmartRow is aware of its context within the table's schema. It extends the standard Locator API, so you can chain standard Playwright methods (.click(), .isVisible()) directly off it.

<!-- embed: smart-row -->

<!-- /embed: smart-row -->

📖 API Reference

getByRow(filters, options?)

Strict Retrieval. Finds a single specific row.

Throws Error if >1 rows match (ambiguous query).

Returns Sentinel if 0 rows match (allows not.toBeVisible() assertions).

Auto-Paginates if the row isn't found on the current page.

<!-- embed: get-by-row -->

<!-- /embed: get-by-row -->

getAllRows(options?)

Inclusive Retrieval. Gets a collection of rows.

Returns: Array of SmartRow objects.

Best for: Checking existence ("at least one") or validating sort order.

<!-- embed: get-all-rows -->

<!-- /embed: get-all-rows -->

🧩 Pagination Strategies

This library uses the Strategy Pattern to handle navigation. You can use the built-in strategies or write your own.

Built-in Strategies

clickNext(selector) Best for standard tables (Datatables, lists). Clicks a button and waits for data to change.

pagination: TableStrategies.clickNext((root) => 
  root.page().getByRole('button', { name: 'Next' })
)


infiniteScroll() Best for Virtualized Grids (AG-Grid, HTMX). Aggressively scrolls to trigger data loading.

pagination: TableStrategies.infiniteScroll()


clickLoadMore(selector) Best for "Load More" buttons. Clicks and waits for row count to increase.

🛠️ Developer Tools

Don't waste time writing selectors manually. Use the generator tools to create your config.

generateConfigPrompt(options?)

Prints a prompt you can paste into ChatGPT/Gemini to generate the TableConfig for your specific HTML.

// Options: 'console' (default), 'error' (Throw error to see prompt in trace/cloud)
await table.generateConfigPrompt({ output: 'console' });


generateStrategyPrompt(options?)

Prints a prompt to help you write a custom Pagination Strategy.

await table.generateStrategyPrompt({ output: 'console' });
