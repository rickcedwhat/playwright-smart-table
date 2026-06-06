# How does pagination work?

:::tabs
== Buttons

Most paginated tables use buttons to move between pages. Pass whichever buttons your table has — all are optional.

```typescript
strategies: {
  pagination: Strategies.Pagination.click({
    next: page.getByRole('button', { name: 'Next' }),
    previous: page.getByRole('button', { name: 'Previous' }),
    nextBulk: page.getByRole('button', { name: 'Next 10' }),
    previousBulk: page.getByRole('button', { name: 'Prev 10' }),
    first: page.getByRole('button', { name: 'First' }),
    last: page.getByRole('button', { name: 'Last' }),
  }, { nextBulkPages: 10, previousBulkPages: 10 })
}
```

== Page numbers

Some tables show numbered buttons (1 2 3 4 5) that jump directly to that page. Pass `pageNumbers` with a locator that matches all the number buttons — the library will click the one matching the target page.

```typescript
strategies: {
  pagination: Strategies.Pagination.click({
    next: page.getByRole('button', { name: 'Next' }),
    previous: page.getByRole('button', { name: 'Previous' }),
    pageNumbers: page.locator('.pagination-number'),
  })
}
```

The page number strategy is windowed — if the target page isn't visible in the current set of buttons, the library steps toward it using next/prev and retries.

== Infinite scroll

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

== None

Don't set a pagination strategy. All queries stay on the current page.

:::

---

## Custom pagination strategy

If the built-in strategies don't fit, pass a plain object that implements the `PaginationPrimitives` interface. Every property is optional — implement only what your table has. Each function returns `true` on success, `false` when the action isn't available (e.g. Next is disabled on the last page).

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
      const btn = root.page().locator(`.page-btn:text-is("${pageIndex + 1}")`)
      if (!await btn.isVisible()) return false
      await btn.click()
      return true
    },
    getTotalPages: async ({ root }) => {
      const text = await root.page().locator('.page-count').textContent()
      return text ? parseInt(text) : null
    },
  }
}
```

`Strategies.Pagination.click()` is a convenience wrapper around this interface — it covers all primitives except `detectCurrentPage`, which is only available via a custom strategy object today ([#212](https://github.com/rickcedwhat/playwright-smart-table/issues/212)).

_Config: `strategies.pagination`_
