# Migration Notes: Upgrading to @rickcedwhat/playwright-smart-table 3.1.0

## Overview

Version 3.1.0 introduces a **lazy initialization API** and significant API simplifications. The main changes are:

1. **`getByRow()` is now synchronous** (was async in 2.x)
2. **`init()` method must be called** before using synchronous methods
3. **`getByRowAcrossPages()` renamed to `searchForRow()`**
4. **`asJSON` option removed** - use `.toJSON()` method directly
5. **New `iterateThroughTable()` feature** for advanced pagination workflows

---

## Breaking Changes

### 1. `getByRow()` is Now Synchronous

**Before (2.x):**
```typescript
const table = useTable(page.locator('#example'));
const row = await table.getByRow({ Name: 'John' }); // async
```

**After (3.1.0):**
```typescript
const table = useTable(page.locator('#example'));
await table.init(); // Must initialize first!
const row = table.getByRow({ Name: 'John' }); // sync - no await
```

**Error if not initialized:**
- `getByRow()` will throw an error if `init()` hasn't been called
- Use `await table.init()` or `await table.init({ timeout: 5000 })` before calling sync methods

### 2. Removed `asJSON` Option

**Before (2.x):**
```typescript
const data = await table.getByRow({ Name: 'John' }, { asJSON: true });
```

**After (3.1.0):**
```typescript
await table.init();
const row = table.getByRow({ Name: 'John' });
const data = await row.toJSON(); // Use .toJSON() method
```

**Applies to both:**
- `getByRow()` - use `row.toJSON()`
- `searchForRow()` - use `row.toJSON()`

### 3. `getByRowAcrossPages()` Renamed to `searchForRow()`

**Before (2.x):**
```typescript
const row = await table.getByRowAcrossPages({ Name: 'John' });
```

**After (3.1.0):**
```typescript
const row = await table.searchForRow({ Name: 'John' });
```

**Key differences:**
- `searchForRow()` is **async** and **auto-initializes** (no need to call `init()` first)
- Works with any strategy (not just pagination)
- Searches across all available data using the configured strategy

---

## Migration Patterns

### Pattern 1: Basic Table Usage

**Before (2.x):**
```typescript
const table = useTable(page.locator('#example'));
const row = await table.getByRow({ Name: 'John' });
const cell = row.getCell('Email');
await expect(cell).toHaveText('john@example.com');
```

**After (3.1.0):**
```typescript
const table = useTable(page.locator('#example'));
await table.init(); // Add this
const row = table.getByRow({ Name: 'John' }); // Remove await
const cell = row.getCell('Email');
await expect(cell).toHaveText('john@example.com');
```

### Pattern 2: One-Liner Initialization

**Option A - Separate:**
```typescript
const table = useTable(page.locator('#example'));
await table.init();
```

**Option B - Chained:**
```typescript
const table = await useTable(page.locator('#example')).init();
```

Both patterns are valid. Use chained pattern for cleaner code when initializing immediately.

### Pattern 3: Searching Across Pages

**Before (2.x):**
```typescript
// getByRow would paginate automatically (if configured)
const row = await table.getByRow({ Name: 'John' });
const data = await table.getByRow({ Name: 'John' }, { asJSON: true });
```

**After (3.1.0):**
```typescript
// Use searchForRow for searching across pages
const row = await table.searchForRow({ Name: 'John' }); // auto-initializes
const data = await row.toJSON(); // Use .toJSON() method
```

### Pattern 4: Current Page vs Search Across Pages

**After (3.1.0):**
```typescript
await table.init();

// Check current page only (synchronous)
const currentPageRow = table.getByRow({ Name: 'John' });
await expect(currentPageRow).toBeVisible(); // or .not.toBeVisible()

// Search across all pages (async, auto-initializes)
const foundRow = await table.searchForRow({ Name: 'John' });
await expect(foundRow).toBeVisible();
```

**Key distinction:**
- `getByRow()` - searches **current page only**, synchronous
- `searchForRow()` - searches **all available data**, asynchronous

### Pattern 5: Getting JSON Data

**Before (2.x):**
```typescript
const data = await table.getByRow({ Name: 'John' }, { asJSON: true });
```

**After (3.1.0):**
```typescript
await table.init();
const row = table.getByRow({ Name: 'John' });
const data = await row.toJSON(); // Call method on SmartRow
```

Or with `searchForRow()`:
```typescript
const row = await table.searchForRow({ Name: 'John' });
const data = await row.toJSON();
```

### Pattern 6: Initialization with Timeout

**For lazy-loaded tables:**
```typescript
const table = useTable(page.locator('#table'));

// Wait for table to appear (up to 5 seconds)
await table.init({ timeout: 5000 });

// Now safe to use sync methods
const row = table.getByRow({ Name: 'John' });
```

---

## Auto-Initialization Behavior

### Methods That Auto-Initialize (No `init()` needed)
These async methods will automatically initialize the table:
- `searchForRow()` ✅
- `getAllRows()` ✅
- `getColumnValues()` ✅
- `iterateThroughTable()` ✅

### Methods That Require `init()` First
These synchronous methods require explicit initialization:
- `getByRow()` ❌ (throws error if not initialized)
- `getHeaders()` ❌
- `getHeaderCell()` ❌

---

## New Features in 3.1.0

### `iterateThroughTable()` - Advanced Pagination

New method for iterating through paginated tables with full control:

```typescript
await table.init();

const results = await table.iterateThroughTable({
  callback: async (row, context) => {
    const data = await row.toJSON();
    // Process row data
    return data;
  },
  dedupeStrategy: 'id', // Optional: deduplicate by ID column
  onFirst: async (row) => {
    // Called on first row
  },
  onLast: async (row) => {
    // Called on last row
  }
});

// results is an array of all callback return values
```

See CHANGELOG.md for full documentation of this feature.

---

## Safety: Calling `init()` Multiple Times

**Good news:** `init()` is **idempotent** - calling it multiple times is safe and does nothing after the first call.

```typescript
const table = useTable(page.locator('#example'));
await table.init(); // First call - initializes the table
await table.init(); // Second call - returns immediately (no-op)
await table.init(); // Third call - also safe (no-op)

// All of these work fine:
const row1 = table.getByRow({ Name: 'John' });
const row2 = table.getByRow({ Name: 'Jane' });
```

**Implementation detail:** The `init()` method checks if the table is already initialized (`_isInitialized && _headerMap`) and returns early if so. This means:

- ✅ No performance penalty for accidental double calls
- ✅ No errors or side effects
- ✅ Safe to call `init()` defensively in helper functions
- ✅ Safe to call before every `getByRow()` if you're unsure

**However:** After calling `reset()`, you **must** call `init()` again:

```typescript
await table.init();
// ... use table ...
await table.reset(); // Clears initialization state
await table.init(); // Must re-initialize after reset
```

---

## Common Migration Errors

### Error: "Table not initialized"
**Cause:** Called `getByRow()` before `init()`

**Fix:**
```typescript
await table.init(); // Add this
const row = table.getByRow({ Name: 'John' });
```

### Error: "TypeError: Cannot read property 'toJSON' of undefined"
**Cause:** Using `asJSON` option which was removed

**Fix:**
```typescript
// Before:
const data = await table.getByRow({ Name: 'John' }, { asJSON: true });

// After:
await table.init();
const row = table.getByRow({ Name: 'John' });
const data = await row.toJSON();
```

### Error: "getByRowAcrossPages is not a function"
**Cause:** Method was renamed

**Fix:**
```typescript
// Before:
const row = await table.getByRowAcrossPages({ Name: 'John' });

// After:
const row = await table.searchForRow({ Name: 'John' });
```

---

## Quick Reference

| Old (2.x) | New (3.1.0) | Notes |
|-----------|-------------|-------|
| `await table.getByRow(...)` | `table.getByRow(...)` | Remove `await`, add `await table.init()` first |
| `await table.getByRowAcrossPages(...)` | `await table.searchForRow(...)` | Renamed, auto-initializes |
| `getByRow(..., { asJSON: true })` | `row.toJSON()` | Use method instead of option |
| `getByRowAcrossPages(..., { asJSON: true })` | `(await searchForRow(...)).toJSON()` | Use method instead of option |

---

## Testing Your Migration

1. **Find all `getByRow` calls** - Remove `await`, add `init()` before
2. **Find all `getByRowAcrossPages` calls** - Rename to `searchForRow`
3. **Find all `asJSON: true` options** - Replace with `.toJSON()` method calls
4. **Run your test suite** - Verify all tests pass
5. **Check for TypeScript errors** - Fix any type issues

---

## Additional Resources

- Full changelog: See `CHANGELOG.md`
- Examples: See `tests/readme_verification.spec.ts`
- Compatibility tests: See `tests/compatibility.spec.ts`

