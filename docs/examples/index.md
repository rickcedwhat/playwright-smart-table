# Examples

Real tables, real configs, real queries. Every snippet on this page is lifted from a test that runs in CI, so if it's here, it works.

Pick the one that looks most like your table and steal it.

## Standard HTML table

A plain `<table>` with `<thead>` and `<tbody>`. This is the easy case. You mostly just point `useTable()` at it.

```typescript
// https://datatables.net/examples/data_sources/dom
const table = await useTable(page.locator('#example'), {
  headerSelector: 'thead th',
}).init();

// Exact match on one or more columns
const row = table.getRow({ Name: 'Airi Satou', Office: 'Tokyo' });
await expect(row.getCell('Position')).toHaveText('Accountant');

// Rows that aren't there are still assertable
await expect(table.getRow({ Name: 'Ghost User' })).not.toBeVisible();

// Dump the whole row
const data = await row.toJSON();
// { Name: "Airi Satou", Position: "Accountant", Office: "Tokyo", ... }
```

### Add pagination

Same table, but the row you want is on page 2. Tell the library where the Next button is and switch from `getRow()` to `findRow()`. `getRow()` only looks at the current page; `findRow()` goes looking.

```typescript
const table = await useTable(page.locator('#example'), {
  rowSelector: 'tbody tr',
  headerSelector: 'thead th',
  cellSelector: 'td',
  strategies: {
    pagination: Strategies.Pagination.click({
      next: () => page.getByRole('link', { name: 'Next' }),
    }),
  },
  maxPages: 5,
}).init();

const row = await table.findRow({ Name: 'Colleen Hurst' });
await expect(row).toBeVisible();
// You're now on whatever page Colleen was on
```

→ [Pagination](/guide/describe/pagination) for buttons, page numbers, and bulk jumps.

## MUI DataGrid

Virtualized rows, virtualized columns, div-based markup, pagination in the footer. Doing this by hand is miserable. There's a preset.

```typescript
import { useTable, presets } from '@rickcedwhat/playwright-smart-table';

const table = await useTable(page.locator('[role="grid"]').first(), presets.muiDataGrid).init();

// Sort through the grid's own header UI
await table.sorting.apply('Desk', 'asc');

// Row lives on page 2, so findRow pages through the footer to get there
const row = await table.findRow({ Desk: 'D-1011' }, { maxPages: 10 });
expect(table.currentPageIndex).toBe(1);

// Or go by logical row index instead of by value
const row25 = await table.findRowByIndex(25, { maxPages: 10 });
await expect(row25.getCell('Desk')).toHaveText('D-1025');

// Scrape everything, including columns that start off-screen
const rows = await table.map(({ row }) => row.toJSON(), { maxPages: 5 });
```

The last one is the one that usually bites people. MUI only renders the columns in view, so a naive scrape silently drops everything to the right. The preset scrolls horizontally as needed so `toJSON()` gets every column.

If your grid is the plain MUI `<Table>` component rather than DataGrid, use `presets.muiTable` instead. Non-English UI? `createMuiDataGrid({ buttonLabels })` / `createMuiTable({ buttonLabels })` let you rename the pagination buttons the preset looks for.

## Infinite scroll

No Next button. More rows show up when you scroll. Two things change: the pagination strategy scrolls instead of clicking, and you'll usually want a `dedupe` so rows that stay on screen between scrolls don't get counted twice.

```typescript
// https://htmx.org/examples/infinite-scroll/
const table = await useTable(page.locator('table'), {
  rowSelector: 'tbody tr',
  headerSelector: 'thead th',
  cellSelector: 'td',
  strategies: {
    pagination: Strategies.Pagination.infiniteScroll(),
    dedupe: (row) => row.getCell('ID').innerText(),
  },
  maxPages: 3,
}).init();

const allData = await table.map(({ row }) => row.toJSON());
```

`dedupe` returns a key per row. Pick something actually unique. An ID column is ideal.

### Infinite scroll on top of a preset

Presets are just config objects, so you can swap out one piece. This is the MUI DataGrid demo with 100,000 rows, where the footer pagination is replaced with scrolling:

```typescript
import { useTable, presets, Strategies, mergeTableConfig } from '@rickcedwhat/playwright-smart-table';

const config = mergeTableConfig(presets.muiDataGrid, {
  strategies: {
    pagination: Strategies.Pagination.infiniteScroll({
      scrollTarget: '.MuiDataGrid-virtualScroller',
      action: 'js-scroll',
      stabilization: Strategies.Stabilization.contentChanged({ timeout: 3000 }),
    }),
  },
});

// The demo page has several grids, so grab the 100k one
const grid = page.locator('.MuiDataGrid-root:has([aria-rowcount="100001"])').first();
const table = await useTable(grid, config).init();
```

`scrollTarget` matters here. The element that actually scrolls is usually not the table root. If scrolling does nothing, that's the first thing to check.

→ [Virtualization](/guide/describe/virtualization) for rows that get recycled out of the DOM as you scroll.

## Other grids

There are presets for a few more:

- **React Data Grid** — `presets.rdg` (and `presets.rdg2D` for 2D virtualization)
- **Glide Data Grid** — `presets.glide` / `createGlide()` for canvas-rendered grids

### AG Grid, TanStack Table, and friends

No preset or worked example yet. If you already test one of these with Playwright, I'd love a PR (see [#133](https://github.com/rickcedwhat/playwright-smart-table/issues/133)). It's config and docs work, no need to dig into the source.

In the meantime, [Describe Your Table](/guide/describe/) walks through building a config from scratch. Or cheat: `await table.generateConfig()` throws on purpose with your table's HTML plus the library's types, formatted as a prompt. Paste it into your AI assistant of choice and let it take the first pass.

---

::: tip Full API Reference
All config options → [Config Options](/api/table-config) · All table methods → [Table Methods](/api/table-methods) · Row API → [SmartRow](/api/smart-row) · Strategies → [Strategies](/api/strategies)
:::
