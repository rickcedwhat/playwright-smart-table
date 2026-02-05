# Debugging Guide

How to diagnose issues when the library can't find your row or column.

## Enable Debug Logs

The easiest way to see what's happening is to enable logging in the table config.

```typescript
const table = useTable(loc, {
    debug: {
        logLevel: 'verbose', // 'none' | 'error' | 'info' | 'verbose'
        slow: 500            // formatting delay in ms
    }
});
```

**Output:**
```
🔍 [SmartTable] Finding row with filters: { Name: 'John' }
ℹ️ [SmartTable] Scanned 10 rows on page 1
🔍 [SmartTable] Checking row 1: Name="Alice" (Mismatch)
🔍 [SmartTable] Checking row 2: Name="John" (Match!)
```

## Common Issues & Fixes

### "Column not found"
**Cause:** The header selector didn't match the table headers.
**Fix:**
1. Check the `headerSelector` config.
2. Use `table.getHeaders()` to see what was actually detected.

```typescript
console.log(await table.getHeaders());
```

### "Row not found"
**Cause:** Data mismatch or strict matching.
**Fix:**
1. Disable `exact` match: `findRow({ Name: 'John' }, { exact: false })`.
2. Inspect the cell text: `await table.getRows().then(r => r[0].toJSON())`.

### "Element is not attached"
**Cause:** The table re-rendered (e.g. React/Vue update) and the cached Locators are stale.
**Fix:**
The library handles this automatically in 99% of cases. If you see this manually, try:
```typescript
await table.revalidate();
```

## Visual Debugging

Since `SmartRow` returns standard Playwright Locators, you can use Playwright's visual tools:

```typescript
// Highlight the specific cell
await row.getCell('Status').highlight();

// Pause execution to inspect DOM
await page.pause();
```

## Checking Initialization State

Unsure if the table understands your structure?

```typescript
// Check if headers are mapped
if (table.isInitialized()) {
    const headers = await table.getHeaders();
    console.log('Mapped Columns:', headers);
}
```
