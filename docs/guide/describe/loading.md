# Loading States

Configure `strategies.loading` to tell the library how to detect when a table or its rows are still loading.

---

## Table spinner

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

Waits until the spinner element is no longer visible before proceeding.

---

## Skeleton rows

```typescript
strategies: {
  loading: {
    row: LoadingStrategies.Row.hasClass('skeleton-row'),
  }
}
```

Skips rows while they carry the given class name.

---

## Header stabilization

```typescript
strategies: {
  loading: {
    headers: LoadingStrategies.Headers.stable(300),
  }
}
```

Waits until the header list stops changing for 300 ms before resolving column names. Useful when columns load asynchronously or visibility toggles are in flight during `init()`.

---

## Cell loading timeout

When a cell takes too long to render, `onCellLoadingTimeout` controls the fallback:

```typescript
const table = useTable(locator, {
  cellLoadingTimeout: 5000,
  onCellLoadingTimeout: 'skip', // or 'read-as-is' | 'throw'
})
```

Pass a callback for full control:

```typescript
onCellLoadingTimeout: async (cell, columnName, row) => {
  return '' // value to use for this cell
}
```

---

→ [API Reference: Strategies — loading](/api/strategies#loading) · [Config Options — cellLoadingTimeout](/api/table-config#cellloadingtimeout)
