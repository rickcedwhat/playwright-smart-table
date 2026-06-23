# Loading Strategies

Playwright Smart Table can detect when a table, row, or set of headers is still loading and wait for it to finish before proceeding. Configure loading detection through `strategies.loading`.

---

## Table-level loading

Use these when the entire table shows a loading state — a spinner overlay, a skeleton screen, or similar.

### `LoadingStrategies.Table.hasSpinner(selector?)`

```typescript
import { LoadingStrategies } from 'playwright-smart-table'

const table = useTable(locator, {
  strategies: {
    loading: {
      table: LoadingStrategies.Table.hasSpinner('.loading-overlay'),
    }
  }
})
```

Resolves to `true` (still loading) while the element matching `selector` is visible. Defaults to `'.loading-spinner'`.

---

### `LoadingStrategies.Table.custom(fn)`

```typescript
strategies: {
  loading: {
    table: LoadingStrategies.Table.custom(async ({ root, page }) => {
      return await page.locator('[aria-busy="true"]').isVisible()
    })
  }
}
```

Pass any async function that returns `true` while loading and `false` when ready.

---

### `LoadingStrategies.Table.never`

```typescript
strategies: {
  loading: {
    table: LoadingStrategies.Table.never,
  }
}
```

The default. Tells the library the table is never in a loading state and to proceed immediately.

---

## Row-level loading

Use these when individual rows can appear as skeleton/placeholder rows while data loads.

### `LoadingStrategies.Row.hasClass(className?)`

```typescript
strategies: {
  loading: {
    row: LoadingStrategies.Row.hasClass('skeleton-row'),
  }
}
```

Returns `true` while the row element has the given class. Defaults to `'skeleton'`.

---

### `LoadingStrategies.Row.hasText(text?)`

```typescript
strategies: {
  loading: {
    row: LoadingStrategies.Row.hasText('Loading...'),
  }
}
```

Returns `true` while the row's text content includes the given string (or matches the given regex). Defaults to `'Loading...'`.

---

### `LoadingStrategies.Row.hasEmptyCells()`

```typescript
strategies: {
  loading: {
    row: LoadingStrategies.Row.hasEmptyCells(),
  }
}
```

Returns `true` while all cells in the row are empty. Useful for tables that render blank rows before populating them.

---

### `LoadingStrategies.Row.never`

The default. Skips row-level loading checks entirely.

---

## Header stabilization

Use these when headers load asynchronously or change dynamically (e.g. column visibility toggles).

### `LoadingStrategies.Headers.stable(duration?, options?)`

```typescript
strategies: {
  loading: {
    headers: LoadingStrategies.Headers.stable(300),
  }
}
```

Waits until the header signature (count + text) has not changed for `duration` ms. Defaults to `200` ms.

For slow or virtualized grids that churn headers for several seconds, add `pollMs` and `timeoutMs`:

```typescript
strategies: {
  loading: {
    headers: LoadingStrategies.Headers.stable(300, {
      pollMs: 100,
      timeoutMs: 5000,
    }),
  }
}
```

- **`pollMs`** — how often to re-check while waiting. Default: same as `duration` (single-shot check).
- **`timeoutMs`** — hard deadline; throws if headers never stabilize within this window. Default: no limit.

---

## Cell loading timeout

When an individual cell is still in a loading state after `config.cellLoadingTimeout` ms, `onCellLoadingTimeout` controls what happens:

```typescript
const table = useTable(locator, {
  cellLoadingTimeout: 5000,
  onCellLoadingTimeout: 'skip',       // omit the column from toJSON()
  // onCellLoadingTimeout: 'read-as-is',  // return whatever is currently in the DOM
  // onCellLoadingTimeout: 'throw',       // throw an error (default)
})
```

You can also pass a callback for full control:

```typescript
const table = useTable(locator, {
  cellLoadingTimeout: 5000,
  onCellLoadingTimeout: async (cell, columnName, row) => {
    console.warn(`Timed out reading "${columnName}"`)
    return ''
  },
})
```

The callback receives the cell `Locator`, the `columnName` string, and the `SmartRow` instance, and must return the string value to use for that cell.

---

→ [API Reference: Strategies — loading](/api/strategies#loading) · [Config Options — cellLoadingTimeout](/api/table-config#cellloadingtimeout)
