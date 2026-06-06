# Find Rows

## Get a row on the current page

```typescript
const row = table.getRow({ firstName: 'John', lastName: 'Doe' })
```

Synchronous. Returns the first matching row visible right now. If no row matches, you get an empty locator — Playwright will surface the error when you try to interact with it.

If more than one row matches on the same page, `getRow` returns the first. For `findRow`, multiple matches on the same page throw an `Ambiguous Row` error — add more filters to narrow it down.

## Find a row across pages

```typescript
const row = await table.findRow({ firstName: 'John', lastName: 'Doe' }, { maxPages: 10 })
```

Paginates until it finds exactly one match or hits `maxPages`. Requires a pagination strategy if the row might not be on the first page.

## Collect all matching rows

```typescript
const activeUsers = await table.findRows({ Status: 'Active' }, { maxPages: 10 })
```

Returns every match across pages. Add a pagination strategy to search beyond page one.
