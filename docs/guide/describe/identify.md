# How do we identify your headers, rows, and cells?

## Headers

Default: `<th>`

You can override that if your table uses something else:

```typescript
useTable(locator, { headerSelector: '[data-column]' })
useTable(locator, { headerSelector: '.column-header' })
useTable(locator, { headerSelector: '[role="columnheader"]' })
```

_Config: `headerSelector`_

---

## Rows

Default: `<tr>` inside `<tbody>`

Make this specific enough that it **only matches body rows** — not header rows. If your selector accidentally captures the header row, Playwright Smart Table will treat it as a data row.

```typescript
useTable(locator, { rowSelector: '[role="row"]' })
useTable(locator, { rowSelector: '.ag-row' })
useTable(locator, { rowSelector: 'tbody tr' })
```

_Config: `rowSelector`_

---

## Cells

Default: `<td>`

Cell selectors are resolved **relative to each row** — so `.cell` means "find `.cell` inside this row", not anywhere in the table. You don't need to scope them yourself.

```typescript
useTable(locator, { cellSelector: '[role="gridcell"]' })
useTable(locator, { cellSelector: '.ag-cell' })
```

_Config: `cellSelector`_
