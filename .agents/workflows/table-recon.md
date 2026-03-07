---
description: Live table reconnaissance — navigate to a real table and determine the best playwright-smart-table strategies for it
---

# Table Recon Workflow

Use this workflow when given a URL to a live web app with a table. The goal is to determine the correct `useTable` config — specifically the **strategies** — by directly observing the table's behavior in the browser.

> **Note**: Selectors (rowSelector, cellSelector, headerSelector) are usually straightforward and can be discovered via `generateConfig`. The hard part is the **strategies** (pagination, loading, stabilization, dedupe, sorting). This workflow focuses on those.

> **Before proposing any workaround or library change, check what the library already handles.** Read `src/strategies/`, `src/smartRow.ts`, and `src/types.ts` first. The library already covers most virtualization scenarios natively. Proposing new primitives or library changes without checking existing capabilities is a recurring source of wasted effort.

> **Never edit the library itself during table recon.** Your job is to find the right config, not change the lib. If you genuinely believe something is missing, at most add a note to `ROADMAP.md`. In practice, dive into the existing tests and source implementations first — almost everything is already covered.

---

## Phase 0 — Create a Working Folder

Before writing any code, create a dedicated folder at the project root:

```
table-recon/<descriptive-name>/
```

Use a short kebab-case name that describes the table being investigated (e.g. `table-recon/grafana-explore-query/`, `table-recon/github-issues/`).

Put **all** recon scripts, debug configs, and scratch files here. Do not scatter files at the root or in `tests/`. This folder is temporary — the user will delete it once the config is promoted to a real helper file.

---


1. Use the browser tool to open the provided URL.
2. Observe what you can from the page (public/unauthenticated state).
3. Use `notify_user` to tell the user:
   - That you've opened the URL
   - Whether a login step is required
   - Where to navigate after logging in (if known)
   - That they should confirm once they are on the page with the table visible

**Do not proceed past this step until the user confirms.**

---

## Phase 2 — Selector Discovery via `generateConfig`

Once the user confirms the table is visible:

1. In the browser, open DevTools console.
2. Identify the table's root locator (wrapping element containing both headers and rows).
3. Inspect the DOM to capture:
   - **rowSelector**: the repeating element for each row (e.g. `tr`, `[role="row"]`, `.row-class`)
   - **cellSelector**: the cell element within a row (e.g. `td`, `[role="gridcell"]`)
   - **headerSelector**: the header element (e.g. `th`, `[role="columnheader"]`)
4. Note any quirks: system columns, icon-only columns, hidden columns.

---

## Phase 3 — Strategy Reconnaissance

### 3a. Pagination Strategy

Scroll to the bottom of the table or look for pagination controls.

**Questions to answer:**
- Are there **Next/Previous buttons**? → `PaginationStrategies.click({ next: '...', previous: '...' })`
- Does the table use **infinite scroll** (new rows append)? → `PaginationStrategies.infiniteScroll()`
- Is the table **virtualized** (DOM rows recycle as you scroll)? → `infiniteScroll` with `contentChanged({ scope: 'first' })`
- Is there **no pagination** (all data on page)? → No strategy needed.

**How to detect virtualization:**
- Open DevTools Elements panel, scroll the table, and watch if row DOM nodes recycle (same elements, changing content) or if new nodes are added.
- Row count in DOM stays constant → **virtualized**. New rows added → **infinite scroll (append)**.

**scrollAmount tuning:** If rows are skipped during pagination, the scroll amount is too large. A safe value is ~50% of the visible viewport height. For a table showing ~12 rows at 33px each, use `scrollAmount: 200`. Too large and boundary rows fall between pages.

---

### 3b. Horizontal Column Virtualization

Scroll the table horizontally and observe the DevTools Elements panel.

**Questions to answer:**
- Do column DOM nodes unmount when scrolled out of view? → **horizontal virtualization**.
- Do cells have an `aria-colindex` or similar stable attribute identifying their logical column?

**How the library handles this natively — no workarounds needed:**

Three built-in mechanisms together cover horizontal virtualization completely:

**1. Custom `header` strategy** — scroll left-to-right and collect header texts in order. Return a plain string array. Array index = logical column position.

```javascript
header: async ({ resolve, config, root, page }) => {
  const headerLoc = resolve(config.headerSelector, root);
  const collected = new Set();
  await root.evaluate(el => el.scrollLeft = 0);
  let lastSize = 0;
  for (let i = 0; i < 15; i++) {
    (await headerLoc.allInnerTexts()).forEach(t => collected.add(t.trim()));
    if (collected.size === lastSize) break;
    lastSize = collected.size;
    await root.evaluate(el => el.scrollLeft += 500);
    await page.waitForTimeout(300);
  }
  await root.evaluate(el => el.scrollLeft = 0);
  return Array.from(collected);
}
```

**2. `getCellLocator`** — bypass `.nth()` and use the cell's stable DOM attribute instead:

```javascript
getCellLocator: ({ row, columnIndex }) =>
  row.locator(`[aria-colindex="${columnIndex + 1}"]`) // aria-colindex is 1-based
```

**3. `navigation` primitives** — `_navigateToCell` in `smartRow.ts` already calculates `targetIndex - currentIndex` and calls `goRight` or `goLeft` automatically. Just provide the scroll mechanics:

```javascript
navigation: {
  goHome: async ({ root }) => { await root.evaluate(el => el.scrollLeft = 0); },
  goRight: async ({ root }) => { await root.evaluate(el => el.scrollLeft += 150); },
  goLeft: async ({ root }) => { await root.evaluate(el => el.scrollLeft -= 150); },
}
```

**Do NOT use `beforeCellRead` or `columnOverrides` for scrolling.** Those are for reading special cell content (popovers, color indicators, etc). Navigation belongs in `navigation` primitives.

---

### 3c. Loading / Stabilization Strategy

Trigger a table reload (apply a filter, change a sort) and observe:

- Is there a **spinner or overlay** while loading? → `LoadingStrategies.Table.hasSpinner('.selector')`
- Do rows show **skeleton placeholders** while loading? → `LoadingStrategies.Row.hasClass('skeleton-class')`
- Does the table reload **instantly**? → `LoadingStrategies.Table.never`

**Stabilization** (for pagination):
- First row content changes after scroll → `contentChanged({ scope: 'first' })`
- Entire list remounts after scroll → `contentChanged({ scope: 'all' })`
- Row count increases → `rowCountIncreased()`

---

### 3d. Sorting Strategy

Click a column header and observe:

- Does the header show `aria-sort`? → Use `getSortState` reading `aria-sort`.
- Is sorting done via a **dropdown or external control** (not a column header)?
  - **Do not use `sorting` in the config.** Export a standalone `applySort(page, option)` helper instead. The library's `sorting.apply(columnName, direction)` model doesn't fit non-column-based sort UIs — `getSortState` will always return `'none'` and `sorting.apply()` will throw after 3 retries even when the sort succeeded.
- Does the table re-render after sort? → Factor into stabilization.

---

### 3e. Dedupe Strategy

Used when the same row might appear multiple times during virtualization transitions.

- Does each row have `aria-rowindex`? (react-data-grid always sets this) → `dedupe: async (row) => await row.getAttribute('aria-rowindex')`
- Does each row have `data-id` or similar? → Use that.
- No stable attribute? → Use the first cell's text: `dedupe: async (row) => await row.locator('[role*="cell"]').first().innerText().catch(() => null)`

---

### 3f. Dynamic Column Changes

If the table allows users to **add or remove columns** (e.g. a column picker), the library's internal header map goes stale.

**Solution:** Call `table.reset()` after any column change. This clears the header map and re-runs header discovery automatically — no other changes needed.

```javascript
await columnPicker.addColumn('Priority');
await table.reset(); // re-maps all headers including the new column
const rows = await table.map(({ row }) => row.toJSON());
```

---

## Phase 4 — Produce Config Recommendation

```typescript
const table = useTable(page.locator('/* root */'), {
  rowSelector: '/* row */',
  cellSelector: '/* cell */',
  headerSelector: '/* header */',

  strategies: {
    // For horizontally virtualized tables only:
    header: async ({ resolve, config, root, page }) => { /* scroll + collect */ },
    getCellLocator: ({ row, columnIndex }) => row.locator(`[aria-colindex="${columnIndex + 1}"]`),
    navigation: { goHome, goRight, goLeft },

    pagination: PaginationStrategies./* chosen */,
    loading: {
      isTableLoading: LoadingStrategies.Table./* chosen */,
      isRowLoading: LoadingStrategies.Row./* chosen */,
    },
    dedupe: async (row) => /* stable unique key */,
  },
});
```

Include rationale (1 sentence each) and any edge cases observed.

---

## Phase 5 — Confirm with User

Use `notify_user` to present:
1. The recommended config
2. Key observations that drove each strategy decision
3. Any open questions

Ask the user to confirm before writing test code.