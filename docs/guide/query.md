# Query Your Table

Once useTable knows your table, here's what you can ask it.

## Get a row on the current page

`table.getRow({ ColumnName: 'value' })` — synchronous, current page only

## Find a row across pages

`await table.findRow({ ColumnName: 'value' })` — paginates until found

## Iterate all rows

`await table.forEach(...)` and `await table.map(...)` — walk every row

## Collect matching rows

`await table.findRows({ Status: 'Active' })` — returns all matches across pages

## Read a row's data

`await row.toJSON()` — all cells as a plain object

## Fill a row's cells

`await row.smartFill({ Status: 'Active' })` — write to editable cells

---

_Outline — content TBD_
