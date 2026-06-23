# Iterate Rows

## Walk every row

```typescript
await table.forEach(async ({ row }) => {
  await expect(row.getCell('Status')).toHaveText('Active')
})
```

Processes rows one at a time, in order. Default for `forEach`.

---

## Map rows to data

```typescript
const emails = await table.map(async ({ row }) => row.getCell('Email').innerText())
const allRows = await table.map(async ({ row }) => row.toJSON())
```

Like `forEach` but returns an array. Default concurrency for `map` is `parallel`.

---

## Filter rows by a condition

```typescript
const highEarners = await table.filter(
  async ({ row }) => {
    const salary = await row.getCell('Salary').innerText()
    return parseInt(salary.replace(/[^0-9]/g, '')) > 50000
  },
  { maxPages: 5 }
)
```

Returns a `SmartRowArray` of all rows where the predicate returns `true`. Default concurrency for `filter` is `sequential`.

---

## Early exit

Call `stop()` from the callback to halt iteration early:

```typescript
await table.forEach(async ({ row, stop }) => {
  const status = await row.getCell('Status').innerText()
  if (status === 'Archived') stop()
})
```

`stop()` works in `forEach`, `map`, and `filter`. Note that it halts at the page boundary — rows already in-flight on the current page will still complete before iteration stops.

If you need to stop at the exact row rather than the page boundary, the table is async-iterable and supports `break`:

```typescript
for await (const { row } of table) {
  if (await row.getCell('Status').innerText() === 'Archived') break
}
```

---

## Concurrency

`forEach`, `map`, and `filter` all accept a `concurrency` option:

```typescript
await table.map(async ({ row }) => row.toJSON(), { concurrency: 'sequential' })
```

- **`parallel`** — all row callbacks run concurrently. Fastest. Default for `map`.
- **`sequential`** — one row at a time, in order. Default for `forEach` and `filter`.
- **`synchronized`** — row callbacks run in parallel, but the library waits for all rows on the current page to finish before advancing to the next page. Use when your callbacks interact with the table and page navigation needs to be coordinated.


---

## Callback context

Every callback receives a `RowIterationContext` object:

```typescript
await table.forEach(async ({ row, index, pageIndex, stop }) => {
  console.log(`Row ${index} on page ${pageIndex}`)
})
```

| Field | Type | Description |
|---|---|---|
| `row` | `SmartRow` | The current row |
| `index` | `number` | 0-based counter — order visited, not DOM position |
| `pageIndex` | `number` | 0-based page index the row was collected from |
| `stop` | `() => void` | Halt iteration at the next page boundary |

> **Note:** The legacy `rowIndex` field is deprecated and will be removed in v7. Use `index` instead.

---

## Limiting pages

```typescript
await table.forEach(async ({ row }) => { ... }, { maxPages: 3 })
```

`maxPages` caps how many pages are visited. Defaults to `config.maxPages` (which defaults to `Infinity`). All three methods accept this option.

---

## Deduplication

Infinite-scroll tables replay rows as you scroll. Pass `dedupe` to skip rows you've already seen:

```typescript
await table.map(
  async ({ row }) => row.toJSON(),
  {
    dedupe: async (row) => row.getCell('ID').innerText(),
  }
)
```

`dedupe` is a function that returns a unique string key per row. Rows with a key already seen are skipped silently.

---

## Bulk pagination

```typescript
await table.map(async ({ row }) => row.toJSON(), { useBulkPagination: true })
```

When `strategies.pagination.goNextBulk` is configured, setting `useBulkPagination: true` advances pages in larger jumps during iteration instead of one page at a time. Useful for tables with a very large number of pages.

---

→ [API Reference: Table Methods — forEach](/api/table-methods#foreach) · [Table Methods — map](/api/table-methods#map) · [Table Methods — filter](/api/table-methods#filter)
