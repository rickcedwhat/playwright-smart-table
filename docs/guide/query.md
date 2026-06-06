# Query Your Table

Once Playwright Smart Table knows your table, here's what you can ask it.

> Each query below only works because of a corresponding config. Where relevant, the config that unlocks it is noted — if something isn't working, that's the first place to look.

## Get a row on the current page

`table.getRow({ ColumnName: 'value' })` — synchronous, current page only. No config beyond selectors required.

_Unlocked by: identifying your [headers, rows, and cells](/guide/describe#how-do-we-identify-your-headers)_

## Find a row across pages

`await table.findRow({ ColumnName: 'value' })` — paginates until found or `maxPages` is exhausted.

_Unlocked by: [pagination strategy](/guide/describe#how-does-pagination-work)_

## Collect matching rows across pages

`await table.findRows({ Status: 'Active' })` — returns all matches across pages.

_Unlocked by: [pagination strategy](/guide/describe#how-does-pagination-work)_

## Iterate all rows

`await table.forEach(...)` — walk every row in order. `await table.map(...)` — same but returns an array.

_Unlocked by: selectors alone for single-page; add pagination strategy for multi-page_

## Read a row's data

`await row.toJSON()` — all cells as a plain object. Works on any row.

_Unlocked by: identifying your [cells](/guide/describe#how-do-we-identify-your-cells)_

## Read a single cell

`row.getCell('Column Name')` — returns a plain Playwright Locator.

## Fill a row's cells

`await row.smartFill({ Status: 'Active' })` — write to editable cells.

_Unlocked by: [fill strategy](/guide/describe#are-any-cells-editable)_

---

_Outline — content TBD_
