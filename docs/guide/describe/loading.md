# Loading States

Some tables show loading indicators while data fetches — a spinner overlay, skeleton rows, or headers that shift as columns load. Configure `strategies.loading` to tell the library what "loading" looks like so it waits before reading.

---

## Detecting table and row loading

Each loading strategy is a function that returns `true` while loading and `false` when ready. The library provides built-in helpers for common patterns (spinners, skeleton class names, header stability), or you can pass your own function:

```typescript
import { Strategies } from '@rickcedwhat/playwright-smart-table'

const table = useTable(locator, {
  strategies: {
    loading: {
      isTableLoading: Strategies.Loading.Table.hasSpinner('.loading-overlay'),
      isRowLoading: Strategies.Loading.Row.hasClass('skeleton'),
      isHeaderLoading: Strategies.Loading.Headers.stable(300),
    }
  }
})
```

See the [API reference](/api/strategies#loading) for the full list of built-in helpers and the function signatures for each level.

---

## How long do we wait?

When the table says it's loading, we wait — but not forever. After 10 seconds we give up and read what's there. If your backend is genuinely slow, give it more time:

```typescript
strategies: {
  loading: {
    isTableLoading: Strategies.Loading.Table.hasSpinner('.loading-overlay'),
    loadingTimeout: 30_000,
  }
}
```

_Config: `strategies.loading.loadingTimeout`_

Configured `rowLoadingTimeout` and `cellLoadingTimeout` budgets include the loading check itself, even if it returns a promise that never finishes. Polling pauses and the cell's initial rendering grace period use the same budget. On expiry, the library follows your configured skip, read-as-is, throw, or cell callback policy.

Header loading and visibility checks use the initialization budget (`table.init({ timeout: 5000 })`, default 3000 ms). Custom header discovery and header transformers retain control of their own operations, which may take longer. A timed-out loading check cannot resume initialization later.

These deadlines stop waiting for loading checks; they do not cancel the checks' underlying work. Reading the value or running a timeout callback happens afterward and may take additional time. Without a configured row/cell timeout, the existing behavior is unchanged.

---

## Cell loading timeout

Individual cells can also be in a loading state. `onCellLoadingTimeout` controls what happens when a cell hasn't resolved after `cellLoadingTimeout` ms:

```typescript
const table = useTable(locator, {
  strategies: {
    loading: {
      cellLoadingTimeout: 5000,
      onCellLoadingTimeout: 'skip', // use an empty string | 'read-as-is' | 'throw'
    }
  }
})
```

Pass a callback to handle it yourself:

```typescript
strategies: {
  loading: {
    cellLoadingTimeout: 5000,
    onCellLoadingTimeout: async (cell, columnName, row) => {
      return '' // value to use for this cell
    }
  }
}
```

---

→ [API Reference: Strategies — loading](/api/strategies#loading)
