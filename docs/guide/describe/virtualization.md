# What's virtualized?

Virtualized tables only render what's visible — rows and columns outside the viewport are removed from the DOM entirely. Trying to read a cell that isn't rendered will give you nothing.

Playwright Smart Table handles this with a viewport strategy. The most common approach: your grid already stamps each rendered row and cell with a DOM attribute that indicates its position — like `aria-rowindex` or `data-index`. Playwright Smart Table reads those to know what's currently in the DOM and scrolls automatically before reading.

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

// data-index (TanStack and similar — 0-based, the default)
strategies: {
  viewport: Strategies.Viewport.dataAttribute({
    scrollContainer: '#table-scroller',
  })
}
```

If your grid doesn't use index attributes, you can implement the `ViewportStrategy` interface directly — provide `getVisibleRowRange`, `getVisibleColumnRange`, `scrollToRow`, and `scrollToColumn` as needed.

_Config: `strategies.viewport`_
