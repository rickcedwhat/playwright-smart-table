# Read Cells

## Get a specific cell

```typescript
const cell = row.getCell('Email')
await expect(cell).toHaveText('john@example.com')
await cell.click()
```

Returns a plain Playwright `Locator`. Pass it to `expect()`, `click()`, `fill()`, or any other Playwright API. For virtualized tables the cell is scrolled into view automatically before it is returned.

---

## Read a full row as an object

```typescript
const data = await row.toJSON()
// { ID: '1', Name: 'Alice', Email: 'alice@example.com', Status: 'Active' }
```

Returns all cells as a plain object keyed by column name.

### Read specific columns only

```typescript
const data = await row.toJSON({ columns: ['ID', 'Status'] })
// { ID: '1', Status: 'Active' }
```

Pass `{ columns }` to skip columns you don't need. Especially useful in virtualized tables where reading every column requires horizontal scrolling.

---

## Bring a row into view

```typescript
await row.bringIntoView()
const data = await row.toJSON()
```

For rows returned by `getRow()` (synchronous, no rowIndex) or when a row may have scrolled out of view after being collected, `bringIntoView()` scrolls the table to the correct page and row position before you interact. Rows returned by `findRow()` and `findRows()` already carry a known `rowIndex`, so `bringIntoView()` is optional but harmless.

---

## Scroll a column into view

```typescript
await table.scrollToColumn('Notes')
const cell = row.getCell('Notes')
```

Scrolls the table horizontally to bring the named column's header into the viewport. Use it when you need the header itself visible — for example, to click it for sorting or assert its `aria-sort` attribute. Reading cell data via `toJSON()` scrolls columns into view internally, so you don't need to call this first when collecting row data.

---

→ [API Reference: SmartRow — getCell](/api/smart-row#getcell) · [SmartRow — toJSON](/api/smart-row#tojson) · [Table Methods](/api/table-methods)
