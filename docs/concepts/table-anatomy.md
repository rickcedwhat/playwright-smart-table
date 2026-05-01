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

For messy headers, see [Header Mapping](/concepts/header-mapping). For paginated tables, see [Pagination Strategies](/concepts/pagination-strategies).
