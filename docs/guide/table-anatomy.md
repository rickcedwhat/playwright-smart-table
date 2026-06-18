---
aside: false
pageClass: table-anatomy-doc
---

<!-- Last Reviewed: 04/27/2026 -->

# Table Anatomy

Smart Table starts with one Playwright locator: the table root. Selectors in the config are resolved from that root, then cells are resolved from each matched row.

This page focuses on the core selector model.

<TableAnatomy />

## What To Notice

- `headerSelector` is scoped to the table root and defines the column map.
- `rowSelector` is also scoped to the table root and defines searchable records.
- `cellSelector` is scoped to each row, not the table root.

Once those pieces are mapped, test code can stay focused on intent:

```typescript
const row = table.getRow({ Name: 'Airi Satou' });
await expect(row.getCell('Office')).toHaveText('Tokyo');
```

For messy headers, see [Header Mapping](/guide/header-mapping). For paginated tables, see [Pagination](/guide/pagination).

## Why Column Order Must Not Matter

The selector model above keeps your test code stable across layout changes — but there is a subtler threat: **column reordering**.

Real tables get reshuffled all the time. A product team adds a "Priority" column to the front. A user drags "Status" to the right. An A/B test swaps two columns for half of your traffic. Any of those changes silently breaks locators that refer to columns by their numeric position (`.nth(2)`, `td:eq(3)`, etc.).

Smart Table resolves cells by **header name**, not position. The column map is built lazily on first use from the live header elements resolved by your `headerSelector` (or header strategy), then cached in memory. Subsequent calls return the cached map — it is only rebuilt when `revalidate()` or `remapHeaders()` clears the cache, so the mapping always reflects the layout at the time of the last (re)initialization.

### See it in action

The demo below drives the same five questions against the same table data. Click **Shuffle columns** and watch what happens to the two approaches:

- **Brittle (fixed indices):** the locator code is frozen — column numbers baked in at write time. After a shuffle it reads from whichever cell happens to land in that slot.
- **Smart Table:** resolves column positions at runtime from the header row. The answer is always correct, regardless of column order.

<LabBeforeAfterV2 />

The underlying employee data never changes — only column positions do. Yet one approach returns wrong answers the moment the table is reshuffled, while the other stays correct every time.

This is the core guarantee that `headerSelector` + `cellSelector` together provide: your test assertions are tied to **meaning** (the column name), not to **position** (the nth cell in a row).
