# Strategies

All strategy options live under `config.strategies`. Every strategy is optional and additive — PST uses built-in defaults for anything not configured.

```typescript
import { useTable, Strategies } from '@rickcedwhat/playwright-smart-table';
const { Pagination, Stabilization } = Strategies;

const table = await useTable(locator, {
  strategies: {
    pagination: Pagination.infiniteScroll({ ... }),
    loading: { isCellLoading: async (cell) => ... },
  },
}).init();
```

→ [API: Config Options](/api/table-config)

---

## Pagination

### `pagination`

<!-- api-signature: pagination -->

### Signature

```typescript
pagination?: PaginationStrategy
```

<!-- /api-signature: pagination -->

Controls how PST advances through pages during `findRow`, `findRows`, `forEach`, `map`, and `filter`.

**Built-in factories** via `Strategies.Pagination`:

#### `Pagination.click`

Advances by clicking a "Next page" button.

```typescript
pagination: Strategies.Pagination.click({
  nextButton: page.locator('[aria-label="Next page"]'),
  prevButton: page.locator('[aria-label="Previous page"]'),
})
```

#### `Pagination.infiniteScroll`

Advances by scrolling the table container.

```typescript
pagination: Strategies.Pagination.infiniteScroll({
  action: 'js-scroll',        // 'scroll' | 'js-scroll'
  scrollTarget: (root) => root,
  scrollAmount: 300,
  stabilization: Strategies.Stabilization.contentChanged({ scope: 'all', timeout: 3000 }),
})
```

→ [Guide: Pagination](/guide/describe/pagination)

---

## Loading

### `loading`

<!-- api-signature: loading -->

### Signature

```typescript
loading?: LoadingStrategy
```

<!-- /api-signature: loading -->

Strategies for detecting loading states at the table, row, and cell level.

```typescript
strategies: {
  loading: {
    isTableLoading: async (context) =>
      (await context.root.locator('.spinner').count()) > 0,

    isRowLoading: async (row) =>
      (await row.locator('[aria-busy="true"]').count()) > 0,

    isCellLoading: async (cell) =>
      (await cell.locator('.skeleton').count()) > 0,
    cellLoadingTimeout: 10_000,
    onCellLoadingTimeout: 'read-as-is', // 'skip' | 'read-as-is' | 'throw'
  },
}
```

**Built-in presets** via `Strategies.Loading`:

- `Strategies.Loading.Table.never` — table is never loading
- `Strategies.Loading.Row.never` — rows are never loading

---

## Header

### `header`

<!-- api-signature: header -->

### Signature

```typescript
header?: HeaderStrategy
```

<!-- /api-signature: header -->

Custom logic for discovering column names. Use when headers require scrolling or special parsing.

**Built-in factories** via `Strategies.Header`:

- `Strategies.Header.visible` — reads headers currently in the DOM
- `Strategies.Header.horizontalScroll` — scrolls horizontally to discover virtualized headers

```typescript
// Custom header strategy
header: async ({ root, page }) => {
  const headers = [];
  // ... scroll and collect header text ...
  return headers; // string[]
}
```

→ [Guide: Custom Header Text](/guide/describe/header-text)

---

## Viewport

### `viewport`

<!-- api-signature: viewport -->

### Signature

```typescript
viewport?: ViewportStrategy
```

<!-- /api-signature: viewport -->

Oracle strategies for **2D virtualized tables** (e.g., react-data-grid, AG Grid) where both rows and columns are recycled as the user scrolls. When present, PST uses these to detect and recover from the 2D scroll hazard.

```typescript
viewport: {
  getVisibleRowRange: async ({ root }) =>
    root.evaluate(el => {
      const rows = [...el.querySelectorAll('[aria-rowindex]')];
      const idxs = rows.map(r => Number(r.getAttribute('aria-rowindex')) - 1);
      return idxs.length
        ? { first: Math.min(...idxs), last: Math.max(...idxs) }
        : { first: 0, last: 0 };
    }),

  getVisibleColumnRange: async ({ root }) =>
    root.evaluate(el => {
      const cells = [...el.querySelectorAll('[aria-colindex]')];
      const idxs = cells.map(c => Number(c.getAttribute('aria-colindex')) - 1);
      return idxs.length
        ? { first: Math.min(...idxs), last: Math.max(...idxs) }
        : { first: 0, last: 0 };
    }),

  scrollToRow: async ({ root }, rowIndex) =>
    root.evaluate((el, idx) => {
      const prevScrollLeft = el.scrollLeft;
      const row = el.querySelector(`[aria-rowindex="${idx + 1}"]`);
      if (row) {
        el.scrollTop = Math.max(0, parseInt(row.style.top || '0') - el.clientHeight / 3);
      } else {
        el.scrollTop = Math.max(0, idx * 35 - el.clientHeight / 3);
      }
      el.scrollLeft = prevScrollLeft; // preserve horizontal position
      return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    }, rowIndex),

  scrollToColumn: async ({ root }, colIndex) =>
    root.evaluate((el, idx) => {
      const prevScrollTop = el.scrollTop;
      const header = el.querySelector(`[aria-colindex="${idx + 1}"]`);
      if (header) el.scrollLeft = header.offsetLeft;
      el.scrollTop = prevScrollTop; // preserve vertical position
      return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    }, colIndex),
}
```

::: tip
After scrolling one axis in a 2D virtualized grid, the other axis is often reset by the grid's React re-render. Save and restore the other axis's scroll position inside the same `evaluate()` call, then wait two `requestAnimationFrame` ticks for React to commit.
:::

→ [Guide: Virtual Scroll](/guide/describe/virtualization)

---

## Sorting

### `sorting`

<!-- api-signature: sorting -->

### Signature

```typescript
sorting?: SortingStrategy
```

<!-- /api-signature: sorting -->

Implements column sort apply/detect for `table.sorting.apply()` and `table.sorting.getState()`.

```typescript
sorting: {
  apply: async ({ root, page }, columnName, direction) => {
    await root.locator(`[data-col="${columnName}"] .sort-btn`).click();
  },
  getState: async ({ root }, columnName) => {
    const attr = await root.locator(`[data-col="${columnName}"]`).getAttribute('aria-sort');
    return attr === 'ascending' ? 'asc' : attr === 'descending' ? 'desc' : 'none';
  },
}
```

---

## Fill

### `fill`

<!-- api-signature: fill -->

### Signature

```typescript
fill?: FillStrategy
```

<!-- /api-signature: fill -->

Global fill strategy for `smartFill`. Applied to all columns unless overridden by `columnOverrides.write`.

**Built-in via `Strategies.Fill`:**

- `Strategies.Fill.default` — auto-detects input type (text, select, checkbox, contenteditable)

```typescript
fill: Strategies.Fill.default
```

→ [Guide: Fill Cells](/guide/describe/editing)

---

## Dedupe

### `dedupe`

<!-- api-signature: dedupe -->

### Signature

```typescript
dedupe?: DedupeStrategy
```

<!-- /api-signature: dedupe -->

Prevents the same row from being yielded twice during pagination. Useful when rows overlap between scroll positions.

```typescript
// Dedupe by a stable row attribute
dedupe: async (row) => row.getAttribute('aria-rowindex')

// Dedupe by cell text
dedupe: async (row) =>
  row.locator('td').first().innerText().catch(() => null)
```

---

## Cell Locator

### `getCellLocator`

<!-- api-signature: getCellLocator -->

### Signature

```typescript
getCellLocator?: GetCellLocatorFn
```

<!-- /api-signature: getCellLocator -->

Custom function for resolving a cell locator from a row and column index. Use for grids where the default `cellSelector` + nth-child approach doesn't match DOM structure.

```typescript
// react-data-grid: use aria-colindex
getCellLocator: ({ row, columnIndex }) =>
  row.locator(`[role="gridcell"][aria-colindex="${columnIndex + 1}"]`)
```

---

## Before Cell Read

### `beforeCellRead`

<!-- api-signature: beforeCellRead -->

### Signature

```typescript
beforeCellRead?: BeforeCellReadFn
```

<!-- /api-signature: beforeCellRead -->

Hook called before each cell value is read in `toJSON` and `columnOverrides.read`. Fires for both default `innerText` extraction and custom read mappers.

```typescript
// Scroll an off-screen column into view before reading
beforeCellRead: async ({ root, columnName, columnIndex }) => {
  await root.evaluate((el, idx) => { el.scrollLeft = idx * 120; }, columnIndex);
}
```

---

## Navigation

### `navigation`

<!-- api-signature: navigation -->

### Signature

```typescript
navigation?: NavigationPrimitives
```

<!-- /api-signature: navigation -->

Primitive navigation functions used internally for keyboard-based cell navigation (`goUp`, `goDown`, `goLeft`, `goRight`, `goHome`).

---

## Filter

### `filter`

<!-- api-signature: filter -->

### Signature

```typescript
filter(
  predicate: (ctx: RowIterationContext<T>) => boolean | Promise<boolean>,
  options?: RowIterationOptions
): Promise<SmartRowArray<T>>
```

<!-- /api-signature: filter -->

Pluggable row filter strategy. When present, `FilterEngine` delegates filter application to this strategy instead of using the default column-value comparison.

---

## Stabilization

Used inside pagination strategies to detect when a page transition has settled.

**Built-in factories** via `Strategies.Stabilization`:

```typescript
// Wait until table content stops changing
Strategies.Stabilization.contentChanged({ scope: 'all', timeout: 3000 })

// Wait a fixed delay
Strategies.Stabilization.timeout(500)
```
