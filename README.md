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

## Key Features

- 🎯 **Smart Locators** - Find rows by content, not position
- 🧠 **Fuzzy Matching** - Smart suggestions for typos (e.g., incorrectly typed "Firstname" suggests "First Name" in error messages)
- ⚡ **Smart Initialization** - Handles loading states and dynamic headers automatically
- 📄 **Auto-Pagination** - Search across all pages automatically
- 🔍 **Column-Aware Access** - Access cells by column name
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

When using `findRows` across multiple pages, the returned `SmartRow` locators represent elements that may no longer be attached to the current DOM if the table paginated past them.

- **Data Extraction:** Safe. You can use `table.iterateThroughTable()` to extract data (`await row.toJSON()`) while the row is visible.
- **Interactions:** Unsafe directly. You cannot do `await row.click()` if the row is on Page 1 but the table is currently showing Page 3. 
- **Solution:** If you need to interact with a row found on a previous page, you may be able to use `await row.bringIntoView()` before interacting with it to force the table to paginate back to that row (Note: this specific cross-page interaction flow is currently under testing).

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
