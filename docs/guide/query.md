# Query Your Table

Once Playwright Smart Table understands your table, here's what you can ask it to do.

The queries below require your table to be described correctly — specifically the headers, rows, and cells. Pagination and virtualization unlock additional queries or extend existing ones.

---

## Get a row on the current page

```typescript
const row = table.getRow({ Name: 'John Doe' })
await expect(row.getCell('Email')).toHaveText('john@example.com')
```

Synchronous. Returns the first matching row on the current page only. Requires: headers, rows, cells.

---

## Find a row across pages

```typescript
const row = await table.findRow({ Name: 'John Doe' }, { maxPages: 10 })
```

Paginates until it finds a match or hits `maxPages`. Requires: headers, rows, cells. Pagination strategy required if the row might not be on the first page.

---

## Collect all matching rows

```typescript
const activeUsers = await table.findRows({ Status: 'Active' }, { maxPages: 10 })
```

Returns every match across pages. Requires: headers, rows, cells. Add a pagination strategy to search beyond page one.

---

## Iterate all rows

```typescript
await table.forEach(async ({ row }) => {
  const name = await row.getCell('Name').innerText()
  console.log(name)
})
```

Walks every row in order. For concurrent iteration (faster on large tables, but requires the table to support it), see [Concurrency Modes](#concurrency-modes).

```typescript
// With concurrency
const table = useTable(locator, { concurrency: 'isolated' })
await table.forEach(async ({ row }) => { ... })
```

### Concurrency modes

- **`sequential`** (default) — one row at a time, in order. Safe for any table.
- **`isolated`** — multiple rows processed at once. Faster, but only safe if rows are independent and the table doesn't re-render between interactions.
- **`synchronized`** — for tables that require interactions to happen in a specific order across rows.

Concurrency deserves its own page. _TBD — more detail coming._

---

## Map rows to data

```typescript
const names = await table.map(async ({ row }) => row.getCell('Name').innerText())
```

Like `forEach` but returns an array. For full row data:

```typescript
const allRows = await table.map(async ({ row }) => row.toJSON())
```

If your table is virtualized, Playwright Smart Table will scroll each row into view before reading it. This is handled automatically when a viewport strategy is configured.

---

## Read a single row's data

```typescript
const data = await row.toJSON()
// { Name: 'John Doe', Email: 'john@example.com', Status: 'Active' }
```

Returns all cells as a plain object. If the table is virtualized, pair this with `row.bringIntoView()` first.

---

## Get a specific cell

```typescript
const cell = row.getCell('Status')
await expect(cell).toHaveText('Active')
await cell.click()
```

Returns a plain Playwright locator. Works on any row.

---

## Write to cells

```typescript
await row.smartFill({ Status: 'Inactive', Note: 'Updated' })
```

Writes to editable cells by column name. Requires a fill strategy if cells need custom interaction logic.

---

_Outline — content TBD_
