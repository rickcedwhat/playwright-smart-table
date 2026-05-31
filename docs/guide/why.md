# Why Smart Table?

Playwright is excellent at finding elements. But tables introduce a specific class of problems that plain locators handle poorly.

## The problem with raw selectors

Table cells have no stable identity. A cell is just "the 4th `<td>` in this `<tr>`." That index is meaningless to a human reading the test, and it breaks silently the moment a column is added, removed, or reordered.

```typescript
// What does td:nth-child(4) mean? No one knows without opening the app.
const cell = row.locator('td:nth-child(4)');
```

Smart Table solves this by reading the header row once and building a name→index map. Every subsequent operation uses column names, not positions.

```typescript
// Immediately obvious. Works regardless of column order.
const cell = row.getCell('Office');
```

## What it handles

- **Paginated tables** — `findRow` and `findRows` page through automatically. You set `maxPages`; the library handles clicking Next, detecting the last page, and stopping.
- **Virtualized tables** — viewport strategies keep column resolution correct when columns unmount off-screen.
- **Div-based grids** — AG Grid, MUI DataGrid, and any other `div`-based table work with a few selector overrides.
- **Editable tables** — `smartFill` and fill strategies handle input cells, dropdowns, and custom editors.

## When you don't need it

If your table is a simple static HTML `<table>` with a handful of visible rows and no pagination, plain Playwright locators may be enough. Smart Table adds value when tables are paginated, sorted, virtualized, or when tests need to stay stable as the schema changes.

## Next steps

- [Getting Started](/guide/getting-started) — install and write your first test.
- [Configuration](/guide/configuration) — adapt to a custom DOM structure.
- [Examples](/examples/) — pick a complete working example.
