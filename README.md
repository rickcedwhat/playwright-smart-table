# Playwright Smart Table

**Dealing with tables sucks. Locators are brittle, hard to read, and break the moment a column moves or pagination kicks in.**

Playwright Smart Table lets you find rows by column name instead of fragile DOM positions. You describe your table — it does the rest.

[![npm version](https://img.shields.io/github/package-json/v/rickcedwhat/playwright-smart-table?label=npm&color=blue&t=2)](https://www.npmjs.com/package/@rickcedwhat/playwright-smart-table)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 📚 [Full Documentation →](https://rickcedwhat.github.io/playwright-smart-table/)

---

```typescript
// ❌ Before — breaks if columns reorder
const row = page.locator('tbody tr')
  .filter({ has: page.locator('td:nth-child(1)', { hasText: 'John' }) })
  .filter({ has: page.locator('td:nth-child(2)', { hasText: 'Doe' }) })
const email = await row.locator('td:nth-child(3)').innerText()
```

```typescript
// ✅ After — column-aware, survives reordering
const row = table.getRow({ firstName: 'John', lastName: 'Doe' })
const email = await row.getCell('Email').innerText()
```

---

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

## Features

- [Row access](https://rickcedwhat.github.io/playwright-smart-table/guide/query/) — find rows by column name, not DOM index
- [Pagination search](https://rickcedwhat.github.io/playwright-smart-table/guide/query/find-rows) — `findRow` and `findRows` scan across pages automatically
- [Iteration](https://rickcedwhat.github.io/playwright-smart-table/guide/query/iterate) — `forEach`, `map`, `filter`, and `for await...of`
- [Table config](https://rickcedwhat.github.io/playwright-smart-table/guide/describe/) — plug in any pagination shape, virtual scroll, or custom header logic
- [Fill / edit cells](https://rickcedwhat.github.io/playwright-smart-table/guide/query/write) — write values back into table cells

---

- [Documentation](https://rickcedwhat.github.io/playwright-smart-table/)
- [npm Package](https://www.npmjs.com/package/@rickcedwhat/playwright-smart-table)
- [GitHub Repository](https://github.com/rickcedwhat/playwright-smart-table)
- [Issues](https://github.com/rickcedwhat/playwright-smart-table/issues)
- [Discussions](https://github.com/rickcedwhat/playwright-smart-table/discussions) — questions and ideas

MIT © Cedrick Catalan
