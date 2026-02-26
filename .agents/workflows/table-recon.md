---
description: Live table reconnaissance — navigate to a real table and determine the best playwright-smart-table strategies for it
---

# Table Recon Workflow

Use this workflow when given a URL to a live web app with a table. The goal is to determine the correct `useTable` config — specifically the **strategies** — by directly observing the table's behavior in the browser.

> **Note**: Selectors (rowSelector, cellSelector, headerSelector) are usually straightforward and can be discovered via `generateConfigPrompt`. The hard part is the **strategies** (pagination, loading, stabilization, dedupe, sorting). This workflow focuses on those.

---

## Phase 1 — Navigate & Hand Off to User

1. Use the browser tool to open the provided URL.
2. Observe what you can from the page (public/unauthenticated state).
3. Use `notify_user` to tell the user:
   - That you've opened the URL
   - Whether a login step is required
   - Where to navigate after logging in (if known), e.g. "please navigate to the Issues table"
   - That they should confirm once they are on the page with the table visible

**Do not proceed past this step until the user confirms.**

---

## Phase 2 — Selector Discovery via `generateConfigPrompt`

Once the user confirms the table is visible:

1. In the browser, open DevTools console.
2. Try to identify the table's root locator (a wrapping element that contains both headers and rows).
3. Call `table.generateConfigPrompt()` conceptually — inspect the DOM to capture:
   - **rowSelector**: the repeating element for each row (e.g. `tr`, `[role="row"]`, `.row-class`)
   - **cellSelector**: the cell element within a row (e.g. `td`, `[role="gridcell"]`)
   - **headerSelector**: the header element (e.g. `th`, `[role="columnheader"]`)
4. Note any quirks: system columns, icon-only columns, hidden columns.

---

## Phase 3 — Strategy Reconnaissance

Investigate each strategy area by interacting with the table in the browser. For each area, record what you observe and what strategy to recommend.

### 3a. Pagination Strategy

Scroll to the bottom of the table or look for pagination controls.

**Questions to answer:**
- Are there **Next/Previous buttons**? → `PaginationStrategies.click({ next: '...', previous: '...' })`
- Does the table use **infinite scroll** (new rows append)?  → `PaginationStrategies.infiniteScroll()`
- Is the table **virtualized** (same DOM rows recycle as you scroll)? → `infiniteScroll` with `stabilization: StabilizationStrategies.contentChanged({ scope: 'first' })`
- Is there **no pagination** (all data on page)? → No strategy needed.

**How to detect virtualization:**
- Open DevTools Elements panel, scroll the table, and watch if the row DOM nodes recycle (same elements, changing content) or if new DOM nodes are added.
- If row count in DOM stays constant while scrolling → **virtualized**.
- If new rows are added to the DOM → **infinite scroll (append)**.

### 3b. Loading / Stabilization Strategy

Trigger a table reload (e.g. apply a filter, change a sort) and observe:

**Questions to answer:**
- Is there a **spinner or overlay** while loading? → `LoadingStrategies.Table.hasSpinner('.selector')`
- Do rows show **skeleton placeholders** (empty/shimmer rows) while loading? → `LoadingStrategies.Row.hasClass('skeleton-class')`
- Does the table reload **instantly** with no loading state? → `LoadingStrategies.Table.never`

**Stabilization** (for pagination):
- After clicking Next or scrolling, does the first row's content change? → `StabilizationStrategies.contentChanged({ scope: 'first' })`
- Does the row count increase? → `StabilizationStrategies.rowCountIncreased()`
- Is there a network request? Observe the Network tab for XHRs triggered by pagination.

### 3c. Sorting Strategy

Click a column header and observe:

**Questions to answer:**
- Does the URL change when sorting? → Note the param name.
- Does the header show a sort indicator (arrow icon, aria-sort attribute)?
  - Check `aria-sort` attribute on the `<th>` → use a custom `sortingStrategy` reading `aria-sort`.
  - Check for a CSS class on the header → use a class-based strategy.
- Does the table re-render (flicker/spinner) after sort? → Factor into stabilization.
- Is sorting purely client-side (no network request)? → Note this.

### 3d. Dedupe Strategy

Used when the same row might appear multiple times (e.g. during virtualization transitions).

**Questions to answer:**
- Does each row have a unique stable `data-id`, `data-row-id`, or similar attribute? → `DedupeStrategies.byAttribute('data-id')`
- Is deduplication needed at all? Only relevant for virtualized/infinite scroll tables. → If simple pagination, skip this.

### 3e. Resolution Strategy (Row Count)

**Questions to answer:**
- Is there a **total count indicator** on the page (e.g. "Showing 1-50 of 234 results")? → Custom resolution reading that element.
- Can the count be read from a specific element? → Note the selector.
- No count? → Default resolution (count visible rows).

---

## Phase 4 — Produce Config Recommendation

After completing Phase 3, write out a recommended `useTable` config:

```typescript
const table = useTable(page.locator('/* root selector */'), {
  rowSelector: '/* row selector */',
  cellSelector: '/* cell selector */',
  headerSelector: '/* header selector */',

  // headerTransformer if needed:
  // headerTransformer: async ({ text }) => text.trim(),

  strategies: {
    pagination: PaginationStrategies./* chosen strategy */,
    loading: {
      table: LoadingStrategies.Table./* chosen strategy */,
      row: LoadingStrategies.Row./* chosen strategy */,
    },
    // sorting: ...,
    // dedupe: ...,
  },

  debug: { logLevel: 'verbose' }
});
```

Include:
- **Rationale** for each strategy choice (1 sentence each)
- Any **caveats** or edge cases observed
- Suggested **follow-up tests** to validate the config (e.g. "verify row count after Next click")

---

## Phase 5 — Confirm with User

Use `notify_user` to present:
1. The recommended config
2. Key observations that drove each strategy decision
3. Any open questions (e.g. "I couldn't trigger a sort — please try clicking a column header and tell me what you observe")

Ask the user to confirm or provide additional observations before writing test code.
