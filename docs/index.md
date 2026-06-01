---
layout: home

hero:
  name: "Playwright Smart Table"
  text: "Test tables by column name, not DOM position."
  tagline: "Reference columns by name, not position. Drop into any Playwright test."
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: View Examples
      link: /examples/
    - theme: alt
      text: API Reference
      link: /api/

features:
  - title: Find visible rows
    details: "Target a row already on screen by matching meaningful cell values."
  - title: Search across pages
    details: "Look beyond the current page without hand-rolling pagination loops."
  - title: Collect matching rows
    details: "Gather every row that matches a filter across paginated or virtualized tables."
  - title: Validate full tables
    details: "Read, assert, or transform each row while keeping tests table-aware."
---

## Why not just use Playwright selectors?

Table cells have no stable identity — a cell is just "the 4th `<td>` in this row." That index shifts silently the moment a column is added, removed, or reordered.

**Without Smart Table:**
```typescript
// Which column is td:nth-child(4)? No one knows without opening the app.
// Add a "Department" column before "Office" and this reads the wrong data — silently.
const row = await page.locator('tbody tr')
  .filter({ has: page.locator('td:nth-child(1)', { hasText: 'Airi Satou' }) })
  .first();

await expect(row.locator('td:nth-child(4)')).toHaveText('Tokyo');      // Office?
await expect(row.locator('td:nth-child(3)')).toHaveText('Accountant'); // Position?
```

**With Smart Table:**
```typescript
// Column names, not indexes. Still plain Playwright locators under the hood.
const table = await useTable(page.locator('#employees')).init();
const row = table.getRow({ Name: 'Airi Satou' });

await expect(row.getCell('Office')).toHaveText('Tokyo');
await expect(row.getCell('Position')).toHaveText('Accountant');
```

| | Raw Playwright | Smart Table |
|---|---|---|
| Column added to the app | ❌ `nth-child` indexes shift silently | ✅ unaffected — looks up by name |
| Column renamed in the app | ❌ reads wrong cell, no error | ✅ throws immediately with suggestions |
| Find a row on page 3 of 10 | ❌ write your own pagination loop | ✅ `findRow({ Name: 'X' }, { maxPages: 10 })` |
| Assert several columns at once | ❌ `td:nth-child(2)`, `(4)`, `(7)`… | ✅ `getCell('Name')`, `getCell('Office')` |
| Fill an editable cell | ❌ DOM traversal to locate the input | ✅ `row.smartFill({ Status: 'Active' })` |
