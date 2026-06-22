# How does pagination work?

## PaginationPrimitives

The full pagination interface. Every property is optional — implement only what your table has. Each navigation function returns `true` on success, `false` when the action isn't available (e.g. Next is disabled on the last page).

If a navigation function throws an error, it bubbles up — the library doesn't catch it for you. Use `return false` to signal "not available" (e.g. the Next button is disabled); let real errors throw.

```typescript
strategies: {
  pagination: {
    // Move forward/backward one page
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

    // Jump multiple pages at once
    goNextBulk: async ({ root }) => {
      const btn = root.page().getByRole('button', { name: 'Next 10' })
      if (await btn.isDisabled()) return false
      await btn.click()
      return true
    },
    goPreviousBulk: async ({ root }) => {
      const btn = root.page().getByRole('button', { name: 'Prev 10' })
      if (await btn.isDisabled()) return false
      await btn.click()
      return true
    },

    // Jump to first/last page
    goToFirst: async ({ root }) => {
      const btn = root.page().getByRole('button', { name: 'First' })
      if (await btn.isDisabled()) return false
      await btn.click()
      return true
    },
    goToLast: async ({ root }) => {
      const btn = root.page().getByRole('button', { name: 'Last' })
      if (await btn.isDisabled()) return false
      await btn.click()
      return true
    },

    // Jump to a specific page index (0-based)
    // Return false if that page number isn't visible in the current UI — the
    // library will step toward it with goNext/goPrevious and retry
    goToPage: async (pageIndex, { root }) => {
      const btn = root.page().locator(`.page-btn:text-is("${pageIndex + 1}")`)
      if (!await btn.isVisible()) return false
      await btn.click()
      return true
    },

    // Tell the library how many pages exist (optional — enables path optimization)
    getTotalPages: async ({ root }) => {
      const text = await root.page().locator('.page-count').textContent()
      return text ? parseInt(text) : null
    },

    // Called once at init() — sync the library's page counter if the table
    // loads on a page other than the first (e.g. a deep-linked URL on page 5)
    detectCurrentPage: async (root) => {
      const text = await root.locator('[aria-current="page"]').textContent()
      return parseInt(text ?? '1') - 1
    },

    // Tell the library how many pages goNextBulk/goPreviousBulk jump
    // Used for navigation path planning
    nextBulkPages: 10,
    previousBulkPages: 10,
  }
}
```

---

## Built-in strategies <Badge type="tip" text="Shortcut" />

`Strategies.Pagination.click()` is a convenience wrapper around `PaginationPrimitives` — pass selectors instead of writing click handlers. It covers all primitives except `detectCurrentPage` ([#212](https://github.com/rickcedwhat/playwright-smart-table/issues/212)).

Without `detectCurrentPage`, the library always starts at page index 0. If your table can load on a page other than the first (e.g. a deep-linked URL on page 5), you'll need to implement `detectCurrentPage` via a custom strategy for now.

:::tabs
== Buttons

Pass whichever buttons your table has — all are optional.

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

Some tables show numbered buttons (1 2 3 4 5) that jump directly to that page. Pass `pageNumbers` with a locator matching all the number buttons.

```typescript
strategies: {
  pagination: Strategies.Pagination.click({
    next: page.getByRole('button', { name: 'Next' }),
    previous: page.getByRole('button', { name: 'Previous' }),
    pageNumbers: page.locator('.pagination-number'),
  })
}
```

The page number strategy is **windowed** — if the target page isn't visible in the current set of buttons, the library steps toward it using next/prev and retries.

> _Deep dive into windowed pagination coming soon._

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

_Config: `strategies.pagination`_


---

→ [API Reference: Strategies — pagination](/api/strategies#pagination)
