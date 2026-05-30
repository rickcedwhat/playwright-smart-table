<!-- Last Reviewed: 30/05/2026 -->
# Filtering & Queries

Smart Table locates rows by matching column values rather than by DOM position. This page explains how that filter model works, what happens when something goes wrong, and how to build queries that hold up in real test suites.

## The filter model

A filter is a plain object where each key is a **column name** (exactly as it appears in the table header) and each value is the **cell text** to match against.

```typescript
// Match the row where the "Name" column contains "Airi Satou"
const row = table.getRow({ Name: 'Airi Satou' });

// Match on multiple columns simultaneously — all conditions must hold
const row = table.getRow({ Office: 'Tokyo', Status: 'Active' });
```

Under the hood, Smart Table turns each key/value pair into a Playwright `.filter({ has: ... })` call. The filter scopes to the correct column index using the header map built during `init()`, so column order in the DOM does not matter.

### Exact vs. partial matching

By default, Smart Table uses Playwright's `getByText(value, { exact: true })`. An exact match requires the full cell text — not a substring. Pass `exact: false` in the table config if you need substring matching.

```typescript
const table = useTable(page.locator('#employees'), { exact: false });

// Matches "Airi Satou" even if the cell reads "Airi Satou (lead)"
const row = table.getRow({ Name: 'Airi Satou' });
```

### Filter values

Values can be:

| Type | Example | Behavior |
|---|---|---|
| `string` | `'Tokyo'` | Text match (exact or partial, per config) |
| `number` | `42` | Converted to string, then matched |
| `(cell) => Locator` | `(cell) => cell.locator('[aria-checked]')` | Locator-based — use for checkboxes, icons, nested elements |

## `getRow` vs `findRow`

Both accept the same filter object. The difference is pagination.

```typescript
// Synchronous — current page only. Requires init() first.
const row = table.getRow({ Name: 'Airi Satou' });

// Async — paginates until found or maxPages exhausted. Auto-initializes.
const row = await table.findRow({ Name: 'Colleen Hurst' });
```

`getRow` throws if zero rows match and also if more than one row matches — it expects exactly one result. Use `findRows` when you expect multiple matches.

```typescript
// Collect all engineers across pages
const engineers = await table.findRows({ Role: 'Engineer' });
```

## Interactive query builder

Edit the filter object below and watch how it maps to the table on the right. Add fields, combine conditions, and misspell a column name to see the error message Smart Table produces.

<LabQueryBuilder />

## Typos and the column-not-found error

Column names are case-sensitive. When a key does not match any header, Smart Table throws immediately — before any network requests or page navigation — with a message that includes fuzzy suggestions:

```
Column 'Nme' not found

Did you mean:
  • Name (86% match)

Available columns: Name, Role, Office, Status, Department

Tip: Column names are case-sensitive
```

The suggestions come from a weighted Levenshtein distance, so a single transposition or missing character typically surfaces the right column at the top of the list.

### Type safety as a first line of defence

If you declare your row type, TypeScript catches typos at compile time — no runtime error needed.

```typescript
type Employee = {
  Name: string;
  Role: string;
  Office: string;
  Status: string;
  Department: string;
};

const table = useTable<Employee>(page.locator('#employees'));

// TypeScript error: '"Nme"' is not assignable to keyof Employee
const row = await table.findRow({ Nme: 'Airi Satou' });
```

## Locator-based filters

For cells whose content cannot be read as plain text — checkboxes, icon-only status columns, custom renderers — pass a function instead of a string.

```typescript
// Find the row where the "Active" column contains a checked checkbox
const row = table.getRow({
  Name: 'Airi Satou',
  Active: (cell) => cell.locator('[aria-checked="true"]')
});
```

The function receives the `cell` locator (already scoped to the correct column) and must return a locator that Playwright uses as a `has` constraint.

## Combining filters with pagination

Pass a pagination strategy when the target row may not be on the first page.

```typescript
import { Strategies, useTable } from '@rickcedwhat/playwright-smart-table';

const table = useTable(page.locator('#employees'), {
  strategies: {
    pagination: Strategies.Pagination.click({
      next: () => page.getByRole('link', { name: 'Next' })
    })
  },
  maxPages: 10
});

// Searches up to 10 pages
const row = await table.findRow({ Department: 'Engineering', Office: 'Berlin' });
await expect(row.getCell('Name')).toHaveText('George Fox');
```

## Next steps

- [Table Methods API](/api/table-methods) — full signatures for `getRow`, `findRow`, `findRows`, `filter`, `forEach`, and `map`.
- [Core Concepts](/guide/core-concepts) — SmartRow, strategies, and type safety in depth.
- [Configuration](/guide/configuration) — `exact`, `maxPages`, `strategies`, and selector overrides.
