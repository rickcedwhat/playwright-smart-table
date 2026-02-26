# Playwright Smart Table

**Production-ready table testing for Playwright with smart column-aware locators.**

[![npm version](https://img.shields.io/github/package-json/v/rickcedwhat/playwright-smart-table?label=npm&color=blue&t=2)](https://www.npmjs.com/package/@rickcedwhat/playwright-smart-table)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 📚 [Full Documentation →](https://rickcedwhat.github.io/playwright-smart-table/)

**Visit the complete documentation at: https://rickcedwhat.github.io/playwright-smart-table/**

---

## Why Playwright Smart Table?

Testing HTML tables in Playwright is painful. Traditional approaches are fragile and hard to maintain.

### The Problem

**Traditional approach:**

```typescript
// ❌ Fragile - breaks if columns reorder
const email = await page.locator('tbody tr').nth(2).locator('td').nth(3).textContent();

// ❌ Brittle XPath
const row = page.locator('//tr[td[contains(text(), "John")]]');

// ❌ Manual column mapping
const headers = await page.locator('thead th').allTextContents();
const emailIndex = headers.indexOf('Email');
const email = await row.locator('td').nth(emailIndex).textContent();
```

### The Solution

**Playwright Smart Table:**

```typescript
// ✅ Column-aware - survives column reordering
const row = await table.findRow({ Name: 'John Doe' });
const email = await row.getCell('Email').textContent();

// ✅ Auto-pagination
const allEngineers = await table.findRows({ Department: 'Engineering' });

// ✅ Type-safe
type Employee = { Name: string; Email: string; Department: string };
const table = useTable<Employee>(page.locator('#table'));
```

## Quick Start

### Installation

```bash
npm install @rickcedwhat/playwright-smart-table
```

### Basic Usage

```typescript
import { useTable } from '@rickcedwhat/playwright-smart-table';

const table = await useTable(page.locator('#my-table')).init();

// Find row by column values
const row = await table.findRow({ Name: 'John Doe' });

// Access cells by column name
const email = await row.getCell('Email').textContent();

// Search across paginated tables
const allActive = await table.findRows({ Status: 'Active' });
```

### Iterating Across Pages

```typescript
// forEach — sequential, safe for interactions (parallel: false default)
await table.forEach(async ({ row, rowIndex, stop }) => {
  if (await row.getCell('Status').innerText() === 'Done') stop();
  await row.getCell('Checkbox').click();
});

// map — parallel within page, safe for reads (parallel: true default)
const emails = await table.map(({ row }) => row.getCell('Email').innerText());

// filter — async predicate across all pages, returns SmartRowArray
const active = await table.filter(async ({ row }) =>
  await row.getCell('Status').innerText() === 'Active'
);

// for await...of — low-level page-by-page iteration
for await (const { row, rowIndex } of table) {
  console.log(rowIndex, await row.getCell('Name').innerText());
}
```

> **`map` + UI interactions:** `map` defaults to `parallel: true`. If your callback opens popovers,
> fills inputs, or otherwise mutates UI state, pass `{ parallel: false }` to avoid overlapping interactions.

### `filter` vs `findRows`

| Use case | Best tool |
|---|---|
| Match by column value / regex / locator | `findRows` |
| Computed value (math, range, derived) | `filter` |
| Cross-column OR logic | `filter` |
| Multi-step interaction in predicate (click, read, close) | `filter` |
| Early exit after N matches | `filter` + `stop()` |

**`findRows` is faster** for column-value matches — Playwright evaluates the locator natively with no DOM reads. **`filter` is more flexible** for logic that a CSS selector can't express.

```typescript
// findRows — structural match, no DOM reads, fast
const notStarted = await table.findRows({
  Status: (cell) => cell.locator('[class*="gray"]')
});

// filter — arbitrary async logic
const expensive = await table.filter(async ({ row }) => {
  const price = parseFloat(await row.getCell('Price').innerText());
  const qty = parseFloat(await row.getCell('Qty').innerText());
  return price * qty > 1000;
});
```

### Advanced: `columnOverrides`

For complex DOM structures, custom data extraction, or specialized input widgets, use `columnOverrides` to intercept how Smart Table interacts with specific columns:

```typescript
const table = useTable(page.locator('#table'), {
  columnOverrides: {
    // Override how data is read from the 'Status' column (e.g., for .toJSON())
    Status: {
      read: async (cell) => {
        const isChecked = await cell.locator('input[type="checkbox"]').isChecked();
        return isChecked ? 'Active' : 'Inactive';
      }
    },
    // Override how data is written to the 'Tags' column (for .smartFill())
    Tags: {
      write: async (cell, value) => {
        await cell.click();
        await page.keyboard.type(value);
        await page.keyboard.press('Enter');
      }
    }
  }
});
```

## Key Features

- 🎯 **Smart Locators** - Find rows by content, not position
- 🧠 **Fuzzy Matching** - Smart suggestions for typos in column names
- ⚡ **Smart Initialization** - Handles loading states and dynamic headers automatically
- 📄 **Auto-Pagination** - Search across all pages automatically
- 🔍 **Column-Aware Access** - Access cells by column name
- 🔁 **Iteration Methods** - `forEach`, `map`, `filter`, and `for await...of` across all pages
- 🛠️ **Debug Mode** - Visual debugging with slow motion and logging
- 🔌 **[Extensible Strategies](docs/concepts/strategies.md)** - Support any table implementation
- 💪 **Type-Safe** - Full TypeScript support
- 🚀 **Production-Ready** - Battle-tested in real-world applications

## When to Use This Library

**Use this library when you need to:**

- ✅ Find rows by column values
- ✅ Access cells by column name
- ✅ Search across paginated tables
- ✅ Handle column reordering
- ✅ Extract structured data
- ✅ Fill/edit table cells
- ✅ Work with dynamic tables (MUI DataGrid, AG Grid, etc.)

**You might not need this library if:**

- ❌ You don't interact with tables at all
- ❌ You don't need to find a row based on a value in a cell
- ❌ You don't need to find a cell based on a value in another cell in the same row

### ⚠️ Important Note on Pagination & Interactions

When `findRows` or `filter` paginates across pages, returned `SmartRow` locators point to rows that may be off the current DOM page.

- **Data extraction:** Safe — `toJSON()` and cell reads work while the row is visible during iteration.
- **Interactions after pagination:** Use `await row.bringIntoView()` first — it navigates back to the page the row was originally found on, then you can safely click/fill.

```typescript
const active = await table.filter(async ({ row }) =>
  await row.getCell('Status').innerText() === 'Active'
);

for (const row of active) {
  await row.bringIntoView(); // navigate back to the row's page
  await row.getCell('Checkbox').click(); // safe to interact
}
```

## Documentation

**📚 Full documentation available at: https://rickcedwhat.github.io/playwright-smart-table/**

- [Getting Started Guide](https://rickcedwhat.github.io/playwright-smart-table/guide/getting-started)
- [Core Concepts](https://rickcedwhat.github.io/playwright-smart-table/guide/core-concepts)
- [API Reference](https://rickcedwhat.github.io/playwright-smart-table/api/)
- [Examples](https://rickcedwhat.github.io/playwright-smart-table/examples/)
- [Troubleshooting](https://rickcedwhat.github.io/playwright-smart-table/troubleshooting)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT © Cedrick Catalan

## Links

- [Documentation](https://rickcedwhat.github.io/playwright-smart-table/)
- [npm Package](https://www.npmjs.com/package/@rickcedwhat/playwright-smart-table)
- [GitHub Repository](https://github.com/rickcedwhat/playwright-smart-table)
- [Issues](https://github.com/rickcedwhat/playwright-smart-table/issues)
