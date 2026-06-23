# Loading States

Some tables show loading indicators while data fetches — a spinner overlay, skeleton rows, or headers that shift as columns load. Configure `strategies.loading` to tell the library what "loading" looks like so it waits before reading.

---

## Detecting table and row loading

Each loading strategy is a function that returns `true` while loading and `false` when ready. The library provides built-in helpers for common patterns (spinners, skeleton class names, header stability), or you can pass your own function:

```typescript
import { LoadingStrategies } from 'playwright-smart-table'

const table = useTable(locator, {
  strategies: {
    loading: {
      table: LoadingStrategies.Table.hasSpinner('.loading-overlay'),
      row: LoadingStrategies.Row.hasClass('skeleton'),
      headers: LoadingStrategies.Headers.stable(300),
    }
  }
})
```

See the [API reference](/api/strategies#loading) for the full list of built-in helpers and the function signatures for each level.

---

## Cell loading timeout

Individual cells can also be in a loading state. `onCellLoadingTimeout` controls what happens when a cell hasn't resolved after `cellLoadingTimeout` ms:

```typescript
const table = useTable(locator, {
  cellLoadingTimeout: 5000,
  onCellLoadingTimeout: 'skip', // omit from toJSON() | 'read-as-is' | 'throw'
})
```

Pass a callback to handle it yourself:

```typescript
onCellLoadingTimeout: async (cell, columnName, row) => {
  return '' // value to use for this cell
}
```

---

→ [API Reference: Strategies — loading](/api/strategies#loading) · [Config Options — cellLoadingTimeout](/api/table-config#cellloadingtimeout)
