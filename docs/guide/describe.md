# Describe Your Table

Before Playwright Smart Table can do anything, it needs to understand your table. Each question below maps to a part of the config — answer them and you have what you need.

## Where is your table?

The root locator you pass to `useTable()`. Everything else is resolved from here.

```typescript
useTable(page.locator('#my-table'))
useTable(page.locator('[role="grid"]'))
useTable(page.locator('.ag-root'))
```

_Config: first argument to `useTable()`_

## How do we identify your headers?

Are they `<th>` elements? A data attribute like `[data-column]`? A class like `.column-header`?

```typescript
// Default — works for standard <table> with <th>
useTable(locator)

// Div-based grid
useTable(locator, { headerSelector: '[data-column]' })
useTable(locator, { headerSelector: '.column-header' })
```

_Config: `headerSelector`_

## How do we identify your rows?

```typescript
// Default — <tr> inside <tbody>
useTable(locator)

// Role-based
useTable(locator, { rowSelector: '[role="row"]' })

// Class-based
useTable(locator, { rowSelector: '.ag-row' })
```

_Config: `rowSelector`_

## How do we identify your cells?

```typescript
// Default — <td>
useTable(locator)

// Role-based
useTable(locator, { cellSelector: '[role="gridcell"]' })
```

_Config: `cellSelector`_

## How does pagination work?

Does your table paginate, and if so, how?

**Next/prev buttons:**
```typescript
strategies: {
  pagination: Strategies.Pagination.click({
    next: () => page.getByRole('button', { name: 'Next' }),
    prev: () => page.getByRole('button', { name: 'Prev' }),
  })
}
```

**Individual page numbers + bulk navigation:**
```typescript
strategies: {
  pagination: Strategies.Pagination.click({
    next: () => page.getByRole('button', { name: 'Next' }),
    prev: () => page.getByRole('button', { name: 'Prev' }),
    first: () => page.getByRole('button', { name: 'First' }),
    last: () => page.getByRole('button', { name: 'Last' }),
  })
}
```

**Infinite scroll:**
_TBD_

**No pagination:** Don't set a pagination strategy. Queries stay on the current page.

_Config: `strategies.pagination`_

## What's virtualized?

Virtualized tables only render what's visible — rows and columns outside the viewport are removed from the DOM. Playwright Smart Table needs to know this so it can scroll before it reads.

How do you know if a cell is in the DOM? Often the rendered rows and columns carry a data attribute that tells you their address — like `data-rowindex` or `aria-rowindex`. If your table does this, Playwright Smart Table can use it to know the boundaries of what's currently rendered.

```typescript
// data-index attribute (TanStack, Braintrust-style)
strategies: {
  viewport: Strategies.Viewport.dataAttribute()
}

// aria-rowindex / aria-colindex (1-based ARIA grids)
strategies: {
  viewport: Strategies.Viewport.dataAttribute({
    rowAttribute: 'aria-rowindex',
    columnAttribute: 'aria-colindex',
    rowOffset: 1,
    columnOffset: 1,
  })
}
```

_Config: `strategies.viewport`_

## What does your header text actually say?

If your headers include sort arrows, counts, badges, or other noise, use `headerTransformer` to clean them up before they're stored. The cleaned name is what you use everywhere else.

```typescript
headerTransformer: async ({ text }) => text.replace(/[↑↓▲▼]/g, '').trim()
```

_Config: `headerTransformer`_

## Are any cells editable?

_Fill strategies — TBD_

_Config: `strategies.fill`, `columnOverrides.write`_

---

_Outline — content TBD_
