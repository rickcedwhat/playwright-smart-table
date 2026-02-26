---
description: Automatically refactor a Playwright test snippet using older versions of playwright-smart-table to the latest v6.7.0 patterns and APIs
---

## /refactor - Upgrade Playwright Smart Table Code

This workflow upgrades a provided code snippet that uses an older version of `playwright-smart-table` to the latest version (v6.7.0+). The user will provide the code and the original version number, and you will refactor it using the modern APIs.

### Step 1: Analyze the Snippet

Read the provided code snippet and identify any deprecated or older patterns. Specifically, look for:

**Deprecated Methods:**
- 🚫 `iterateThroughTable` -> ✅ Replace with `await table.forEach()`, `table.map()`, or `table.filter()`
- 🚫 `getColumnValues` -> ✅ Replace with `await table.map(({ row }) => row.getCell('Name').innerText())`
- 🚫 `dataMapper` -> ✅ Replace with `columnOverrides.read` in the config
- 🚫 `cellResolver` -> ✅ Replace with `columnOverrides` or custom `getCellLocator`

**Outdated Strategies:**
- 🚫 `Strategies.Pagination.clickNext()` -> ✅ Replace with `Strategies.Pagination.click({ next: '[selector]' })`
- 🚫 Complex infinite loops for sorting -> ✅ Replace with `await table.sorting.apply('Column', 'asc')`
- 🚫 Parallel processing issues -> ✅ Note that `table.map()` is parallel by default, but `table.forEach()` is sequential.

### Step 2: Determine the Target Refactor

Based on what the snippet is trying to achieve, determine the cleanest modern approach:
- If the snippet is collecting data into an array (`const data = []; await table.iterateThroughTable... data.push()`), use **`const data = await table.map()`**.
- If the snippet is performing a side-effect (clicking a button, asserting visibility) on every row, use **`await table.forEach({ parallel: false })`**.
- If the snippet is looking for multiple specific rows to return them, use **`const rows = await table.filter()`**.
- If the snippet relies on `batchSize` limits during iteration, translate that to the `maxPages` option in the new iterators to bound the search.
- If the snippet provides custom input logic for `smartFill` or extraction via `dataMapper`, roll that into `config.columnOverrides`.

### Step 3: Provide the Refactored Code

Present the refactored code block to the user.

Ensure the new code:
1. Is structurally simpler and shorter than the original.
2. Removes all warnings/deprecated methods.
3. Preserves the original intent of the test/script.
4. Uses proper async/await syntax (remember that iterators like `map` and `forEach` resolve `Promise` structures automatically).

### Step 4: Explain the Changes

Below the refactored code block, provide a brief bulleted list explaining *why* the changes were made (e.g., "Replaced `iterateThroughTable` with `table.map` for cleaner data collection", "Migrated `clickNext` to the unified `click` strategy for pagination primitives support").
