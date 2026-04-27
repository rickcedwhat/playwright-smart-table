<!-- Last Reviewed: 02/06/2026 -->
# Getting Started

This guide gets you from install to a useful table test. Start here if you are new to the library.

## Installation

```bash
npm install @rickcedwhat/playwright-smart-table
```

## Your First Test

```typescript
import { test, expect } from '@playwright/test';
import { useTable } from '@rickcedwhat/playwright-smart-table';

test('find and verify employee', async ({ page }) => {
  await page.goto('https://datatables.net/examples/data_sources/dom');

  const table = await useTable(page.locator('#example')).init();
  const row = table.getRow({ Name: 'Airi Satou' });

  await expect(row.getCell('Position')).toHaveText('Accountant');
  await expect(row.getCell('Office')).toHaveText('Tokyo');
});
```

## Why This Works

`useTable()` reads the table headers and remembers which column index belongs to each name. `getRow()` finds a row by cell text, and `getCell()` returns a normal Playwright `Locator`, so Playwright assertions and actions still work.

That means your test can say “the row where `Name` is `Airi Satou`, then the `Office` cell” instead of relying on `nth()` indexes.

## Which Method Should I Use?

| If you need to... | Use this |
|---|---|
| Find a row on the current page | `table.getRow(filters)` |
| Search through paginated data for one row | `await table.findRow(filters, { maxPages })` |
| Collect matching rows across pages | `await table.findRows(filters, { maxPages })` |
| Read a value from every row | `await table.map(({ row }) => ...)` |
| Click, fill, or assert every row in order | `await table.forEach(async ({ row }) => ...)` |

### Current Page

Use `getRow()` when the row is already visible. Because it is synchronous, call `init()` first.

```typescript
const table = await useTable(page.locator('#example')).init();

const row = table.getRow({ Name: 'Airi Satou' });
await expect(row.getCell('Office')).toHaveText('Tokyo');
```

### Paginated Tables

Use `findRow()` or `findRows()` when the table may need to move through pages. Add a pagination strategy so Smart Table knows how to click Next, and increase `maxPages` above the default of `1`.

```typescript
import { Strategies, useTable } from '@rickcedwhat/playwright-smart-table';

const table = useTable(page.locator('#example'), {
  strategies: {
    pagination: Strategies.Pagination.click({
      next: () => page.getByRole('link', { name: 'Next' })
    })
  },
  maxPages: 5
});

const row = await table.findRow({ Name: 'Colleen Hurst' });
await expect(row.getCell('Office')).toHaveText('San Francisco');
```

### Reading Every Row

Use `map()` for data extraction. It returns a plain array.

```typescript
const offices = await table.map(({ row }) => row.getCell('Office').innerText());
expect(offices).toContain('Tokyo');
```

Use `forEach()` for ordered interactions.

```typescript
await table.forEach(async ({ row }) => {
  await expect(row.getCell('Status')).toHaveText('Active');
});
```

## When Defaults Do Not Work

Standard HTML tables often work with no selector config. For `div`-based grids, tell Smart Table where headers, rows, and cells live.

```typescript
const table = useTable(page.locator('#table'), {
  headerSelector: '[role="columnheader"]',
  rowSelector: '[role="row"]',
  cellSelector: '[role="gridcell"]'
});
```

If your table needs special behavior, use a strategy. Common examples are pagination, sorting, virtualized columns, and custom filling.

## Next Steps

- [Core Concepts](/guide/core-concepts): learn the three main ideas.
- [Examples](/examples/): pick a task-based example.
- [Configuration](/guide/configuration): adapt Smart Table to a custom DOM.
- [API Reference](/api/): look up exact method and config details.
