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

## Options

All three methods accept a second `options` argument:

```typescript
await table.map(
  async ({ row }) => row.toJSON(),
  {
    maxPages: 5,
    dedupe: async (row) => row.getCell('ID').innerText(),
  }
)
```

- **`maxPages`** — cap how many pages are visited. Defaults to `config.maxPages`.
- **`dedupe`** — for infinite-scroll tables that replay rows as you scroll, pass a function returning a unique key per row. Already-seen rows are skipped.

The callback also receives `index` (0-based visit counter) and `pageIndex` (which page the row came from). See the [API reference](/api/table-methods#foreach) for the full options list.

---

→ [API Reference: Table Methods — forEach](/api/table-methods#foreach) · [Table Methods — map](/api/table-methods#map) · [Table Methods — filter](/api/table-methods#filter)
