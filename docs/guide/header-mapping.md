---
aside: false
pageClass: table-anatomy-doc
---

<!-- Last Reviewed: 04/28/2026 -->

# Header Mapping

Headers become the names you use in filters and `row.getCell()`. Real app tables often include unlabeled checkbox columns, sort arrows, counts, percentages, or other UI-only text.

This visual focuses on how Smart Table turns rendered headers into stable column names.

<HeaderMapping />

## What To Notice

- Blank headers are still addressable with fallback names like `__col_0`.
- `headerTransformer` runs before names are stored, so you can remove sort arrows, counters, badges, or suffixes.
- The final names are what you use in calls like `table.getRow({ Name: 'Airi Satou' })` and `row.getCell('Office')`.

For the exact API, see [`headerSelector`](/api/table-config#headerselector) and [`headerTransformer`](/api/table-config#headertransformer).
