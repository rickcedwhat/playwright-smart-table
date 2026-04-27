# Playwright Smart Table

Playwright Smart Table helps you test tables by column name instead of DOM position. It maps the headers once, returns normal Playwright Locators, and adds table-aware helpers for rows and cells.

## 30-Second Example

```typescript
import { test, expect } from '@playwright/test';
import { useTable } from '@rickcedwhat/playwright-smart-table';

test('verify an employee row', async ({ page }) => {
  await page.goto('https://datatables.net/examples/data_sources/dom');

  const table = await useTable(page.locator('#example')).init();
  const row = table.getRow({ Name: 'Airi Satou' });

  await expect(row.getCell('Position')).toHaveText('Accountant');
  await expect(row.getCell('Office')).toHaveText('Tokyo');
});
```

The important part is the mental model:

- `useTable(root)` creates a table helper scoped to one table.
- `table.init()` reads the headers and builds the column map.
- `table.getRow({ Name: 'Airi Satou' })` finds a row by cell text.
- `row.getCell('Office')` returns a regular Playwright `Locator`.

## Most Users Need Four Methods

| Need | Use |
|---|---|
| Get a row already visible on the current page | `table.getRow(filters)` |
| Search more than the current page | `await table.findRow(filters, { maxPages: 5 })` |
| Collect matching rows across pages | `await table.findRows(filters, { maxPages: 5 })` |
| Read or validate every row | `await table.map(...)` or `await table.forEach(...)` |

## When It Helps

Use this library when your tests need to:

- Find rows by meaningful cell values, not `nth()` indexes.
- Read, assert, or click cells by column name.
- Search across paginated or infinitely scrolling tables by configuring pagination and increasing `maxPages`.
- Extract row data with `toJSON()`.
- Adapt to grids like MUI DataGrid, AG Grid, React Data Grid, or custom table-like DOM.

## Where To Go Next

- [Getting Started](/guide/getting-started): install the package and write the first test.
- [Core Concepts](/guide/core-concepts): understand `TableResult`, `SmartRow`, and strategies.
- [Examples](/examples/): choose a task-based example.
- [API Reference](/api/): look up exact method and config details.
