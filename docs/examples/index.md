# Examples

Real tables, real configs, real queries. Snippets are imported directly from browser tests. The HTML and paginated MUI examples run against local fixtures in PR CI; the 100,000-row MUI example runs in the optional live-site suite.

Pick the one that looks most like your table and steal it. Import `useTable`, `presets`, `Strategies`, and `mergeTableConfig` from `@rickcedwhat/playwright-smart-table` as needed, and `expect` from `@playwright/test`. Each example starts with a Playwright `page` on the matching demo.

## Standard HTML table

A plain `<table>` with `<thead>` and `<tbody>`. This is the easy case. You mostly just point `useTable()` at it.

<<< ../../tests/readme_verification.spec.ts#docs-standard

### Add pagination

Same table, but the row you want is on page 2. Tell the library where the Next button is and switch from `getRow()` to `findRow()`. `getRow()` only looks at the current page; `findRow()` goes looking.

<<< ../../tests/readme_verification.spec.ts#pagination

→ [Pagination](/guide/describe/pagination) for buttons, page numbers, and bulk jumps.

## MUI DataGrid

Virtualized rows, virtualized columns, div-based markup, pagination in the footer. Doing this by hand is miserable. There's a preset.

<<< ../../tests/integration/mui-data-grid.spec.ts#docs-mui-pagination

To find a row by logical index, start with a fresh table instance:

<<< ../../tests/integration/mui-data-grid.spec.ts#docs-mui-index

To scrape columns that start off-screen:

<<< ../../tests/integration/mui-data-grid.spec.ts#docs-mui-map

The last one is the one that usually bites people. MUI only renders the columns in view, so a naive scrape silently drops everything to the right. The preset scrolls horizontally as needed so `toJSON()` gets every column.

If your grid is the plain MUI `<Table>` component rather than DataGrid, use `presets.muiTable` instead. Non-English UI? `createMuiDataGrid({ buttonLabels })` / `createMuiTable({ buttonLabels })` let you rename the pagination buttons the preset looks for.

## Infinite scroll

No Next button. More rows show up when you scroll. Two things change: the pagination strategy scrolls instead of clicking, and you'll usually want a `dedupe` so rows that stay on screen between scrolls don't get counted twice.

<<< ../../tests/readme_verification.spec.ts#iterate-through-table-dedupe

`dedupe` returns a key per row. Pick something actually unique. An ID column is ideal.

### Infinite scroll on top of a preset

Presets are just config objects, so you can swap out one piece. This is the MUI DataGrid demo with 100,000 rows, where the footer pagination is replaced with scrolling. This configuration is exercised by the optional live-site suite, rather than blocking PR CI:

<<< ../../tests/integration/mui-datagrid-live-t2-100k.spec.ts#docs-mui-infinite-config

<<< ../../tests/integration/mui-datagrid-live-t2-100k.spec.ts#docs-mui-infinite-init

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
