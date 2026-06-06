# Read Cells

## Get a specific cell

```typescript
const cell = row.getCell('Email')
await expect(cell).toHaveText('john@example.com')
await cell.click()
```

Returns a plain Playwright locator. Pass it to `expect()`, `click()`, `fill()`, or anything else Playwright supports.

## Read a full row as an object

```typescript
const data = await row.toJSON()
// { firstName: 'John', lastName: 'Doe', Email: 'john@example.com', Status: 'Active' }
```

Returns all cells as a plain object keyed by column name. If the table is virtualized, pair this with `row.bringIntoView()` first to make sure the row is rendered before reading.
