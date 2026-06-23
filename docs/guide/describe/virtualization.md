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

---

## NavigationPrimitives

For grids that navigate columns via keyboard (e.g. React Data Grid accessibility mode), you can configure keyboard-based navigation so the library uses arrow keys rather than scroll position to reach off-screen columns:

```typescript
import { Strategies } from 'playwright-smart-table'

strategies: {
  navigation: {
    // Move focus one cell left/right/up/down
    goLeft:  async ({ page }) => { await page.keyboard.press('ArrowLeft') },
    goRight: async ({ page }) => { await page.keyboard.press('ArrowRight') },
    goUp:    async ({ page }) => { await page.keyboard.press('ArrowUp') },
    goDown:  async ({ page }) => { await page.keyboard.press('ArrowDown') },

    // Jump focus to the first column of the current row
    goHome:  async ({ page }) => { await page.keyboard.press('Home') },

    // Reset horizontal scroll without moving vertical position
    snapFirstColumnIntoView: async ({ root }) => {
      await root.evaluate(el => { el.scrollLeft = 0 })
    },

    // Coarse jump to a column index before fine-grained arrow stepping
    seekColumnIndex: async ({ root }, columnIndex) => {
      // e.g. for ARIA grids: click the header at that colindex to scroll it into view
      await root.locator(`[aria-colindex="${columnIndex + 1}"]`).first().click()
    },

    // Optional timing overrides
    settleMs: 50,    // ms to wait after each arrow key step (default: varies)
    maxWaitMs: 2000, // ms before giving up on reaching a column (default: varies)
  }
}
```

All fields are optional — implement only what your grid supports. When both `viewport` and `navigation` are configured, `viewport` is tried first.

---

→ [API Reference: Strategies — viewport](/api/strategies#viewport) · [Strategies — navigation](/api/strategies#navigation)
