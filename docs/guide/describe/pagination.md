# How does pagination work?

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

Not every table has all of these — only pass the ones that exist. A table with just Next and Previous only needs those two keys.

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


---

## Custom pagination strategy

If none of the built-in strategies fit your table, you can pass a plain object that implements the `PaginationPrimitives` interface. All properties are optional — only implement the ones your table UI actually has.

```typescript
strategies: {
  pagination: {
    goNext: async ({ root }) => {
      const btn = root.page().getByRole('button', { name: 'Next' })
      if (await btn.isDisabled()) return false
      await btn.click()
      return true
    },
    goPrevious: async ({ root }) => {
      const btn = root.page().getByRole('button', { name: 'Previous' })
      if (await btn.isDisabled()) return false
      await btn.click()
      return true
    },
    goToPage: async (pageIndex, { root }) => {
      const btn = root.page().getByRole('button', { name: String(pageIndex + 1) })
      if (!await btn.isVisible()) return false
      await btn.click()
      return true
    },
  }
}
```

Each function returns `true` on success and `false` when the action isn't available (e.g. Next is disabled on the last page). The library uses these return values to know when to stop paginating.

_See [API Reference](/api/) for the full `PaginationPrimitives` shape._

_Config: `strategies.pagination`_
