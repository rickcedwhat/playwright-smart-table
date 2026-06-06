# Find Rows

## Get a row on the current page

```typescript
const row = table.getRow({ firstName: 'John', lastName: 'Doe' })
```

Synchronous. Returns a locator for the first row on the current page that matches all filters. If more than one row matches, the first is returned — no error is thrown. If you need an exact unique match, use `findRow` instead.

---

## Find a row across pages

```typescript
const row = await table.findRow({ firstName: 'John', lastName: 'Doe' }, { maxPages: 10 })
```

Paginates until it finds exactly one match or hits `maxPages`. If more than one row matches on the same page, it throws an `Ambiguous Row` error with details about the conflicting rows — add more filters to narrow it down. Requires a pagination strategy if the row might not be on the first page.

---

## Collect all matching rows

```typescript
const activeUsers = await table.findRows({ Status: 'Active' }, { maxPages: 10 })
```

Returns every match across pages. Add a pagination strategy to search beyond page one.
