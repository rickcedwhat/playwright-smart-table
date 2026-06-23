# Debugging

Tools for diagnosing table configuration problems and slowing down automation for visual inspection.

---

## Log levels

Enable structured logging by setting `debug.logLevel` in your table config:

```typescript
const table = useTable(locator, {
  debug: {
    logLevel: 'info',
  }
})
```

| Level | What you see |
|---|---|
| `'none'` | Nothing (default) |
| `'error'` | Errors only |
| `'info'` | Errors + key lifecycle events (init, pagination, row matches) |
| `'verbose'` | Everything, including per-cell reads and navigation steps |

---

## Slow mode

Slow down operations so you can watch them in a headed browser:

```typescript
const table = useTable(locator, {
  debug: {
    slow: 500,           // add 500 ms before every operation
  }
})
```

Apply different delays per operation type:

```typescript
debug: {
  slow: {
    pagination: 1000,    // pause 1 s before each page advance
    getCell: 200,        // pause 200 ms before each cell read
    findRow: 500,        // pause 500 ms before each find attempt
    default: 100,        // fallback for everything else
  }
}
```

> **Warning:** `debug.slow` in CI will produce a console warning. Remove it (or guard with `process.env.CI !== 'true'`) before merging.

---

## Generate a config prompt

```typescript
await table.generateConfig()
```

Prints an AI-friendly description of what the library can see in the DOM — headers, row selectors, pagination controls — to the terminal. Paste the output into an AI chat to get a starting-point configuration for your table.

---

## Common issues

**Headers resolve to `[]`**
The `headerSelector` points to elements that don't exist yet. Check whether headers load asynchronously and add `LoadingStrategies.Headers.stable()`.

**`findRow` returns nothing**
The filter value might not match the cell text exactly (whitespace, casing, hidden characters). Add `logLevel: 'verbose'` and look for "checking row" lines to see what the library actually reads.

**Cell reads time out**
A cell's loading indicator uses a locator that doesn't match. Set `cellLoadingTimeout` and `onCellLoadingTimeout: 'read-as-is'` to skip the wait and see what's in the DOM at the time.

**`bringIntoView` navigates to the wrong row**
The `rowIndex` passed to `SmartRow` is wrong. This can happen if you pass a row from `getRow()` (which has no rowIndex) to code that assumes a valid index. Use `findRow()` or `findRows()` so rowIndex is always resolved correctly.

---

→ [API Reference: Config Options — debug](/api/table-config#debug) · [Table Methods — generateConfig](/api/table-methods#generateconfig)
