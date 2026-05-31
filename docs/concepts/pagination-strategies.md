---
aside: false
pageClass: table-anatomy-doc
---

<!-- Last Reviewed: 04/28/2026 -->

# Pagination Strategies

Pagination is the part of table testing that most often depends on your app. Smart Table does not guess how your UI moves; you describe the movement with a pagination strategy.

This page shows common pagination shapes and the strategy primitive that usually fits.

<PaginationStrategies />

## What To Notice

- `goNext` and `goPrevious` are enough for simple one-page-at-a-time searches.
- `goToFirst` is useful when a scan or reset should start from page one.
- `goToLast` enables optimal path planning (wrap-around) when navigating to distant pages.
- `goToPage` fits numbered pagination or page inputs.
- `numberOfPages` allows Smart Table to calculate the most efficient path between distant pages (e.g., jumping to the last page first).
- Infinite scroll and load-more UIs still use the pagination strategy slot; the strategy just scrolls or loads instead of clicking a numbered pagination component.

Each primitive should return `true` when movement happened and `false` when there is nowhere else to go. For exact signatures, see [Pagination Strategies](/api/strategies#pagination-strategies).

---

## Try It — Pagination Config Builder

The sandbox below lets you explore how different pagination setups translate directly into library config. Switch between pagination types, toggle optional selectors on and off, and watch the generated config update live. Use the plan builder to pick a target page and see exactly which primitives Smart Table would call to get there — then step through or run them all at once against the mock table.

<LabPaginationSandbox />

### What to notice

- **Toggling `first` / `last` off** removes those lines from the config and changes the plan: without `goToLast`, wrap-around paths are unavailable; without `goToFirst`, backward navigation must rely on `previous` or `previousBulk` alone.
- **`nextBulk` / `previousBulk` trade fewer clicks for a coarser granularity.** Enable them to see the planner skip entire decades of pages instead of stepping one at a time — but note that `nextBulkPages` must match the actual number of pages your UI advances per click.
- **`numberOfPages` unlocks wrap-around.** When it is enabled and `last` is present, the planner can jump to the end and work backwards — often the shortest path to a high-numbered page.
- **Load More and Infinite Scroll are forward-only.** Once content is loaded it stays in the DOM; the library only needs to advance, never retreat. That is why `goToFirst` and `goToPrevious` do not appear in those configs.
- **Every config is minimal by design.** You only describe the controls that actually exist in your UI. Anything you omit is simply not used by Smart Table during a search.
