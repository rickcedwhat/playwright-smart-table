# What's virtualized?

Virtualized tables only render what's visible — rows and columns outside the viewport are removed from the DOM entirely. Trying to read a cell that isn't rendered will give you nothing.

Playwright Smart Table handles this with a viewport strategy. You describe what's currently in the DOM, and the library scrolls before it reads.

## ViewportStrategy

Implement whichever of these four functions your grid exposes — all are optional:

```typescript
strategies: {
  viewport: {
    // Return the 0-based index range of rows currently rendered in the DOM
    getVisibleRowRange: async ({ root }) => {
      return root.evaluate(el => {
        const rows = [...el.querySelectorAll('[role="row"]')]
        const indices = rows
          .map(r => Number(r.getAttribute('aria-rowindex')) - 1)
          .filter(n => !isNaN(n))
        return { first: Math.min(...indices), last: Math.max(...indices) }
      })
    },

    // Return the 0-based index range of columns currently rendered in the DOM
    getVisibleColumnRange: async ({ root }) => {
      return root.evaluate(el => {
        const cells = [...el.querySelectorAll('[role="gridcell"]')]
        const indices = cells
          .map(c => Number(c.getAttribute('aria-colindex')) - 1)
          .filter(n => !isNaN(n))
        return { first: Math.min(...indices), last: Math.max(...indices) }
      })
    },

    // Scroll to make a specific row visible
    scrollToRow: async ({ root }, rowIndex) => {
      await root.locator(`[aria-rowindex="${rowIndex + 1}"]`).scrollIntoViewIfNeeded()
    },

    // Scroll to make a specific column visible
    scrollToColumn: async ({ root }, colIndex) => {
      await root.locator(`[aria-colindex="${colIndex + 1}"]`).first().scrollIntoViewIfNeeded()
    },
  }
}
```

---

## Built-in strategies <Badge type="tip" text="Shortcut" />

If your grid stamps rows and cells with a DOM attribute containing their index (like `aria-rowindex`, `data-index`, or similar), `Strategies.Viewport.dataAttribute()` implements all four functions for you:

```typescript [MUI DataGrid / ARIA grids — aria-rowindex (1-based)]
strategies: {
  viewport: Strategies.Viewport.dataAttribute({
    scrollContainer: '.MuiDataGrid-virtualScroller',
    rowAttribute: 'aria-rowindex',
    columnAttribute: 'aria-colindex',
    rowOffset: 1,
    columnOffset: 1,
  })
}
```

```typescript [TanStack and similar — data-index (0-based, the default)]
strategies: {
  viewport: Strategies.Viewport.dataAttribute({
    scrollContainer: '#table-scroller',
  })
}
```

_Config: `strategies.viewport`_
