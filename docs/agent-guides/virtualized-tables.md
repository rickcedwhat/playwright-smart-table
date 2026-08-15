# Agent Guide: Virtualized Tables

Patterns and failure modes discovered from real client configurations. Read this before configuring Smart Table for any table that uses a virtual scroll (TanStack Virtual, react-window, Braintrust-style, MUI DataGrid).

---

## Stabilization: `contentChanged` is wrong for transform-based virtualizers

### The failure

`Strategies.Stabilization.contentChanged()` fingerprints all visible row `innerText`. It works correctly for append-only tables (new rows are added to the DOM after each scroll) and for virtualizers that recycle DOM elements (element content changes when a node is reused for a new row).

It fails silently for virtualizers that reposition rows via `style.top` or CSS transforms without changing row content — the DOM text stays identical after every scroll, so `contentChanged` always times out and returns `false`. `goNext` returns `false`, `_advancePage` declares end-of-data, and only the initially-rendered rows are returned.

This was the root cause of a Braintrust playground table returning 16 rows instead of 20 — even after increasing the timeout to 5000ms, the text never changed.

### The fix

Replace `contentChanged` with a scroll-position delta check:

```ts
stabilization: async (context, action) => {
  const before = await scroller.evaluate((el) => el.scrollTop);
  await action();
  await context.page.waitForTimeout(500); // let the virtualizer settle
  const after = await scroller.evaluate((el) => el.scrollTop);
  return after > before; // true while scroll advances; false at the bottom
},
```

This terminates naturally: `true` on every scroll that moves, `false` only when the container can no longer advance (bottom reached). The iteration loop's `ElementTracker` handles row deduplication — no risk of processing rows twice.

### Decision table

| Virtualizer type | Correct stabilization |
|---|---|
| Append-only (rows added to DOM) | `rowCountIncreased` (default) |
| DOM recycling (elements reused, content changes) | `contentChanged` |
| Transform-only (all rows always in DOM, repositioned) | scroll-position delta (above) |
| Unknown | check with `logLevel: 'verbose'` — if "no new row(s) found" after first page and `goNext returned false`, switch to scroll-position delta |

---

## Viewport strategy: `dataAttribute()` requires `data-index` on row elements

### The failure

`Strategies.Viewport.dataAttribute()` reads `data-index` (configurable via `rowAttribute`) from **row elements** to compute `getVisibleRowRange`. It reads `data-index` from **cell elements** to compute `getVisibleColumnRange`. These are two different DOM elements — the strategy assumes the same attribute name appears on both.

When `data-index` exists only on cells (column index) and not on rows, `getVisibleRowRange` gets `NaN` for every row, filters them all out, and returns `{ first: 0, last: 0 }` with no warning.

In 6.20.0+, the final-scan viewport filter uses this range to decide which newly-discovered rows are "in view." A range of `[0, 0]` means every row at DOM position > 0 is excluded. In the Braintrust case, this silently dropped 4 rows that `ElementTracker` had correctly discovered — producing a clean 16-row result with no error thrown.

Issue filed: [#410](https://github.com/rickcedwhat/playwright-smart-table/issues/410)

### When `dataAttribute()` is correct

Use it when **row elements** carry a numeric index attribute:

```ts
// MUI DataGrid — rows have aria-rowindex (1-based)
viewport: Strategies.Viewport.dataAttribute({
  rowAttribute: 'aria-rowindex',
  columnAttribute: 'aria-colindex',
  rowOffset: 1,
  columnOffset: 1,
})

// TanStack Virtual rows with data-index on the row element itself
viewport: Strategies.Viewport.dataAttribute()
```

### When to remove it

If row elements (`rowSelector`) do not carry a numeric index attribute — only cell children do — remove the viewport strategy entirely:

```ts
// strategies: {
//   viewport: Strategies.Viewport.dataAttribute(), ← remove this
// }
```

Without a viewport strategy, the final-scan viewport filter is skipped, `bringIntoView` falls back to `element.scrollIntoView({ block: 'nearest' })`, and all discovered rows are accepted. This is correct and safe for single-axis scroll tables.

### How to check

Before configuring, verify the row element has the expected attribute:

```ts
// In a browser evaluate on the table root:
const rows = document.querySelectorAll('div[class*="group/tablerow"]');
console.log([...rows].map(r => r.getAttribute('data-index')));
// If all null → dataAttribute() is wrong for rows; cells have it, not rows
```

---

## Scroll amount

Keep `scrollAmount` below the scroll container's `clientHeight`. Jumping past the container height in a single step can skip rows that are never materialized by the virtualizer. A value of 200–300px is safe for most table viewports.

```ts
scrollAmount: 250, // not 600
```

---

## Putting it together: reference config for transform-based Braintrust tables

```ts
const table = useTable(tableContainer, {
  concurrency: "synchronized",
  autoScroll: true,
  maxPages: 10,

  headerSelector: "div[data-column-name]",
  rowSelector: 'div[class*="group/tablerow"]',
  cellSelector: "div[data-index]",

  strategies: {
    getCellLocator: ({ row, columnIndex }) =>
      row.locator(`div[data-index="${columnIndex}"]`),

    // No viewport strategy — row elements don't carry data-index
    // (cells do, but that's the column index, not the row index)

    pagination: Strategies.Pagination.infiniteScroll({
      scrollTarget: () => scroller,
      scrollAmount: 250,
      action: "js-scroll",
      stabilization: async (context, action) => {
        const before = await scroller.evaluate((el) => el.scrollTop);
        await action();
        await context.page.waitForTimeout(500);
        const after = await scroller.evaluate((el) => el.scrollTop);
        return after > before;
      },
    }),

    header: async ({ root }) => readBraintrustHeaderNames(root),

    loading: {
      isHeaderLoading: async ({ root }) => {
        await waitForBraintrustHeadersStable(root, {
          stableMs: 5000,
          timeoutMs: 20000,
        });
        return false;
      },
      isTableLoading: Strategies.Loading.Table.never,
    },

    dedupe: async (row) =>
      (await row.getAttribute("data-index").catch(() => null)) ??
      Math.random().toString(),
  },
});
```
