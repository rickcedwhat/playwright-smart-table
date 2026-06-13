# Playwright Smart Table

**Production-ready table testing for Playwright with smart column-aware locators.**

[![npm version](https://img.shields.io/github/package-json/v/rickcedwhat/playwright-smart-table?label=npm&color=blue&t=2)](https://www.npmjs.com/package/@rickcedwhat/playwright-smart-table)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![CodeRabbit Reviews](https://img.shields.io/coderabbit/prs/github/rickcedwhat/playwright-smart-table?utm_source=oss&utm_medium=github&utm_campaign=rickcedwhat%2Fplaywright-smart-table&labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit+Reviews)](https://coderabbit.ai)

## 📚 [Full Documentation →](https://rickcedwhat.github.io/playwright-smart-table/)

---

## The Problem

Testing HTML tables in Playwright is fragile by default:

```typescript
// ❌ Breaks if columns reorder
const email = await page.locator('tbody tr').nth(2).locator('td').nth(3).textContent();

// ❌ Manual column mapping every time
const headers = await page.locator('thead th').allTextContents();
const emailIndex = headers.indexOf('Email');
const email = await row.locator('td').nth(emailIndex).textContent();
```

## The Solution

```typescript
// ✅ Column-aware — survives column reordering
const row = table.getRow({ Name: 'John Doe' });
const email = await row.getCell('Email').textContent();

// ✅ Search across pages
const allEngineers = await table.findRows({ Department: 'Engineering' }, { maxPages: 5 });

// ✅ Iterate with forEach, map, filter, or for await...of
await table.forEach(async ({ row }) => {
  await row.getCell('Checkbox').click();
});
```

## Installation

```bash
npm install @rickcedwhat/playwright-smart-table
```


## Quick Start

```typescript
import { useTable } from '@rickcedwhat/playwright-smart-table';

const table = await useTable(page.locator('#my-table')).init();

const row = table.getRow({ Name: 'John Doe' });
const email = await row.getCell('Email').innerText();
```

## Key Features

- 🎯 **Column-aware locators** — find rows and cells by name, not index
- 📄 **Pagination-aware search** — `findRows` and `forEach` scan across pages automatically
- 🔁 **Iteration methods** — `forEach`, `map`, `filter`, and `for await...of`
- 🛠️ **Debug mode** — slow motion playback and structured logs
- 🔌 **Extensible strategies** — plug in any table implementation or pagination shape
- 💪 **Full TypeScript support**

---

- [Documentation](https://rickcedwhat.github.io/playwright-smart-table/)
- [npm Package](https://www.npmjs.com/package/@rickcedwhat/playwright-smart-table)
- [GitHub Repository](https://github.com/rickcedwhat/playwright-smart-table)
- [Issues](https://github.com/rickcedwhat/playwright-smart-table/issues)

MIT © Cedrick Catalan
