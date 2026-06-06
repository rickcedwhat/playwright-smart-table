# Iterate Rows

## Walk every row

```typescript
await table.forEach(async ({ row }) => {
  await expect(row.getCell('Status')).toHaveText('Active')
})
```

Processes rows one at a time, in order.

## Map rows to data

```typescript
const emails = await table.map(async ({ row }) => row.getCell('Email').innerText())
const allRows = await table.map(async ({ row }) => row.toJSON())
```

Like `forEach` but returns an array.

## Concurrency

By default both `forEach` and `map` run sequentially. You can change this with the `concurrency` option:

```typescript
const table = useTable(locator, { concurrency: 'parallel' })
```

- **`sequential`** (default) — one row at a time, in order
- **`parallel`** — all rows processed concurrently; fastest, but only use if your callbacks are independent and don't interact with the table
- **`synchronized`** — rows processed concurrently but coordinated; use when callbacks interact with the table and need to stay in sync

_TBD — concurrency deserves its own page with more detail._
