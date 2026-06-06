# Describe Your Table

Before Playwright Smart Table can do anything useful, you need to describe how your specific table works. Each section below is a question — answer them in your config and you're set.

## Where is your table?

The root locator you pass to `useTable()`. Everything else — headers, rows, cells — is resolved relative to this element.

```typescript
useTable(page.locator('#my-table'))
useTable(page.locator('[role="grid"]'))
useTable(page.locator('.ag-root'))
```

_Config: first argument to `useTable()`_

---

## How do we identify your headers?

By default Playwright Smart Table looks for `<th>` elements. If your table uses something else:

```typescript
// data attribute
useTable(locator, { headerSelector: '[data-column]' })

// class name
useTable(locator, { headerSelector: '.column-header' })

// role
useTable(locator, { headerSelector: '[role="columnheader"]' })
```

_Config: `headerSelector`_

---

## How do we identify your rows?

By default: `<tr>` elements inside `<tbody>`. Make this specific enough that it **only matches body rows** — not header rows. If your selector is too broad and accidentally captures the header row, Playwright Smart Table will try to match against it.

```typescript
// role-based (most div grids)
useTable(locator, { rowSelector: '[role="row"]' })

// class-based
useTable(locator, { rowSelector: '.ag-row' })

// scoped to body only
useTable(locator, { rowSelector: 'tbody tr' })
```

_Config: `rowSelector`_

---

## How do we identify your cells?

By default: `<td>`. Cell selectors are resolved **relative to each row** — so `.cell` means "find `.cell` inside this row", not anywhere in the table. You don't need to scope them yourself.

```typescript
// role-based
useTable(locator, { cellSelector: '[role="gridcell"]' })

// class-based
useTable(locator, { cellSelector: '.ag-cell' })
```

_Config: `cellSelector`_

---

## How does pagination work?

**Next/prev buttons only:**
```typescript
strategies: {
  pagination: Strategies.Pagination.click({
    next: page.getByRole('button', { name: 'Next' }),
    previous: page.getByRole('button', { name: 'Previous' }),
  })
}
```

**All button types (next, prev, bulk jump, first, last):**
```typescript
strategies: {
  pagination: Strategies.Pagination.click(
    {
      next: page.getByRole('button', { name: 'Next' }),
      previous: page.getByRole('button', { name: 'Previous' }),
      nextBulk: page.getByRole('button', { name: 'Next 10' }),
      previousBulk: page.getByRole('button', { name: 'Prev 10' }),
      first: page.getByRole('button', { name: 'First' }),
      last: page.getByRole('button', { name: 'Last' }),
    },
    { nextBulkPages: 10, previousBulkPages: 10 }
  )
}
```

**Infinite scroll:**
```typescript
strategies: {
  pagination: Strategies.Pagination.infiniteScroll({
    action: 'js-scroll',
    scrollTarget: (root) => root,
    scrollAmount: 200,
    stabilization: Strategies.Stabilization.rowCountIncreased({ timeout: 1000 }),
  })
}
```

**No pagination:** Don't set a pagination strategy. All queries stay on the current page.

_Config: `strategies.pagination`_

---

## What's virtualized?

Virtualized tables only render what's visible — rows and columns outside the viewport are removed from the DOM entirely. If you try to read a cell that isn't rendered, you'll get nothing.

Playwright Smart Table handles this with a viewport strategy. The most common approach: your grid already stamps each row/cell with a DOM attribute that says where it lives (`aria-rowindex`, `data-index`, etc.). Playwright Smart Table reads those to know what's rendered and scrolls as needed.

```typescript
// aria-rowindex / aria-colindex (MUI DataGrid, ARIA grids — 1-based)
strategies: {
  viewport: Strategies.Viewport.dataAttribute({
    scrollContainer: '.MuiDataGrid-virtualScroller',
    rowAttribute: 'aria-rowindex',
    columnAttribute: 'aria-colindex',
    rowOffset: 1,
    columnOffset: 1,
  })
}

// data-index (TanStack, 0-based — the default)
strategies: {
  viewport: Strategies.Viewport.dataAttribute({
    scrollContainer: '#table-scroller',
  })
}
```

_Config: `strategies.viewport`_

---

## What does your header text actually say?

Real app headers often include noise: sort arrows, column counts, status badges. `headerTransformer` runs on each header before it's stored — the result is what you use everywhere else (`getRow`, `getCell`, etc.).

_Tab 1 — Sort arrows:_
| Name ↑ | Department ↓ | Salary |
|--------|-------------|--------|
| Ada    | Engineering | 90000  |
| Bob    | Marketing   | 65000  |
| Carol  | Engineering | 95000  |

```typescript
headerTransformer: async ({ text }) => text.replace(/[↑↓▲▼]/g, '').trim()
// Resulting columns: 'Name', 'Department', 'Salary'
```

_Tab 2 — Checkbox column with no label:_
| _(checkbox)_ | Name  | Status |
|-------------|-------|--------|
| ☐           | Ada   | Active |
| ☐           | Bob   | Inactive |
| ☐           | Carol | Active |

```typescript
headerTransformer: async ({ text, index }) => {
  if (!text.trim()) return `__col_${index}`
  return text.trim()
}
// Resulting columns: '__col_0', 'Name', 'Status'
```

_Tab 3 — Lowercase normalization:_
| FIRST NAME | LAST NAME | EMAIL ADDRESS |
|-----------|-----------|---------------|
| Ada       | Lovelace  | ada@example.com |

```typescript
headerTransformer: async ({ text }) => text.toLowerCase().replace(/_/g, ' ').trim()
// Resulting columns: 'first name', 'last name', 'email address'
```

_Config: `headerTransformer`_

---

## How do we write to cells?

_Fill strategies — TBD_

_Config: `strategies.fill`, `columnOverrides.write`_

---

_Outline — content TBD_
