# Performance Tuning

Tips for keeping your table tests fast and reliable, especially with large datasets.

## 1. Use `iterateThroughTable`

Instead of paging manually:

```typescript
// ❌ Slow: Looping manually
for (let i = 0; i < 10; i++) {
   await table.getRows();
   await nextBtn.click();
}

// ✅ Fast: Built-in iteration
await table.iterateThroughTable(async ({ rows }) => {
   // Processing happens efficiently in batches
});
```

## 2. Prefetch Columns

When converting rows to JSON, specify only the columns you need. This prevents the library from trying to read every single cell (which might involve scrolling or complex resolution).

```typescript
// ❌ Reads ALL columns (slow if many columns)
const data = await row.toJSON();

// ✅ Reads only specified columns (fast)
const data = await row.toJSON({ 
    columns: ['ID', 'Status', 'Email'] 
});
```

## 3. Avoid `findRow` for simple checks

If you know the row is on the first page, use `getRow()` (sync-like) instead of `findRow()` (async search).

```typescript
// ❌ Searches all pages (overhead)
await table.findRow({ ID: '123' });

// ✅ Checks current page immediately
table.getRow({ ID: '123' }); 
```

## 4. Cache Table Initialization

The `init()` method analyzes headers. You only need to call it once per page load.

```typescript
const table = useTable(loc);

// Setup (runs init once)
await table.findRow({ ... }); 

// Subsequent calls re-use the cached header map
await table.findRow({ ... }); 
```

> [!TIP]
> If the page creates a fresh table DOM (e.g., during sorting/filtering), the library detects the detached elements and re-initializes automatically.

## 5. Locators vs Text

Always prefer assertions on Locators rather than extracting text.

```typescript
// ❌ Slow: Extracts text (round trip to browser)
const text = await row.getCell('Status').innerText();
expect(text).toBe('Active');

// ✅ Fast: Playwright assertion (runs in browser context)
await expect(row.getCell('Status')).toHaveText('Active');
```
