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
