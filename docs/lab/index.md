---
aside: false
pageClass: table-anatomy-doc
---

# Lab (draft visuals) <LabFeedbackMark slug="intro" label="Page intro" />

**Local preview:** run `npm run docs:dev`, then open **Lab** in the top nav or go to [`/lab/`](/lab/) (with the site base, e.g. `http://localhost:5173/playwright-smart-table/lab/`).  
**Published site:** draft pages under `docs/lab` are **not** shipped; `npm run docs:build` (used in CI) excludes them. To build the full site including Lab, use `npm run docs:build:all`.

Interactive rough drafts for docs and UX. Polished teaching pages live under [How It Works](/guide/table-anatomy).

## Pagination sandbox <LabFeedbackMark slug="pagination-sandbox" label="Pagination sandbox" />

Switch between pagination types. Toggle selectors on/off — disabled buttons go dark in the mock UI and drop out of the generated config. The library page counter updates as you navigate.

<LabPaginationSandbox />

## findRow trace (step-through) <LabFeedbackMark slug="findrow-trace" label="findRow trace step-through" />

<LabGetRowTrace />

## forEach trace (animated) <LabFeedbackMark slug="foreach-trace" label="forEach trace animation" />

<LabForEachTrace />

> Want to see how parallel and synchronized modes change this pattern? See [Concurrency modes](#concurrency-modes) below.

## Live query builder <LabFeedbackMark slug="query-builder" label="Live query builder" />

Edit the `getRow` call directly — add and remove key/value pairs, watch the table respond in real time. Misspell a column name to see the guided error with fuzzy suggestions, right inline.

<LabQueryBuilder />

## The column shuffle test <LabFeedbackMark slug="before-after" label="The column shuffle test" />

Pick a question. Shuffle the columns. Brittle index-based code reads from the wrong cell — Smart Table stays tied to header names regardless of column order.

<LabBeforeAfterV2 />

## Init → getRow (debugger-style) <LabFeedbackMark slug="init-get-row-debug" label="Init getRow debugger" />

<LabInitGetRowDebug />

## findRow + pagination + checkbox (debugger-style) <LabFeedbackMark slug="find-row-pagination-debug" label="findRow pagination debugger" />

<LabFindRowPaginationDebug />

## Concurrency modes <LabFeedbackMark slug="concurrency-modes" label="Concurrency modes animator" />

Run the same 3-page `forEach` in each concurrency mode and watch how the row callbacks are scheduled. The elapsed time badge shows the relative cost of each approach. Use the speed picker to see the difference clearly or simulate realistic timing.

<LabConcurrencyAnimator />

## Inline components <LabFeedbackMark slug="inline-components" label="Inline components demo" />

### MethodBadge

Inline async/sync pill for use next to method names in API docs.

`getRow()` <MethodBadge type="sync" /> returns the first matching row from the current page without paginating.

`findRow()` <MethodBadge type="async" /> paginates until a match is found or `maxPages` is exhausted.

`findRows()` <MethodBadge type="async" /> collects all matching rows across pages.

`init()` <MethodBadge type="async" /> resolves headers and populates the column map.

### ConfigSwatch

Collapsible config block for embedding ready-to-use configs inline in example pages.

<ConfigSwatch label="MUI DataGrid — viewport preset" :code="`const table = useTable(page.locator('.MuiDataGrid-root'), {
  strategies: {
    viewport: Strategies.Viewport.dataAttribute({ attribute: 'data-rowindex' })
  }
})`" />

<ConfigSwatch label="AG Grid — custom selectors" :code="`const table = useTable(page.locator('.ag-root'), {
  headerSelector: '.ag-header-cell-text',
  rowSelector: '.ag-row',
  cellSelector: '.ag-cell'
})`" />

<ConfigSwatch label="Click pagination with bulk nav" :code="`const table = useTable(locator, {
  strategies: {
    pagination: Strategies.Pagination.click({
      next:  () => page.getByRole('button', { name: 'Next' }),
      prev:  () => page.getByRole('button', { name: 'Prev' }),
      first: () => page.getByRole('button', { name: 'First' }),
      last:  () => page.getByRole('button', { name: 'Last' }),
    })
  },
  maxPages: 20
})`" />

## Existing interactives <LabFeedbackMark slug="links-concepts" label="Links to Concepts pages" />

- [Table Anatomy](/guide/table-anatomy) — selector scoping.
- [Header Mapping](/guide/header-mapping) — `__col_*` + `headerTransformer`.
- [Pagination Strategies](/guide/pagination) — pagination shapes.
