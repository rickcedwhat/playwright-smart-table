---
aside: false
pageClass: table-anatomy-doc
---

<!-- Last Reviewed: 05/30/2026 -->

# Concurrency Modes

When you call `forEach`, `map`, or `filter` across a paginated table, Smart Table has to decide how to schedule the work for each row. That scheduling decision is the **concurrency mode**.

Getting it right matters: the wrong mode for your table can produce flaky reads, corrupt writes, or needlessly slow test runs.

## The three modes

### Sequential

```typescript
await table.forEach(async (row) => {
  const name = await row.getCell('Name').innerText()
  console.log(name)
})
```

One row at a time, in order. The callback for row _N_ finishes before the callback for row _N+1_ begins. Pages advance only after all callbacks on the current page complete.

**When to use it:**

- Your callback clicks a button, opens a modal, or triggers any DOM change that affects other rows.
- You need predictable order for logging or assertions.
- The table renders cells into a tooltip or popover that can only be open for one row at a time (scenario 3 in the interactive below).
- Debugging: sequential makes traces easy to read.

**Cost:** All rows are processed in series — total time scales with `rows × time-per-row`.

---

### Parallel

```typescript
await table.forEach(async (row) => {
  const value = await row.getCell('Status').innerText()
  results.push(value)
}, { concurrency: 'parallel' })
```

All rows on the current page run their callbacks at the same time. Pages still advance one at a time (all callbacks on page _N_ must settle before page _N+1_ is loaded), but within a page, callbacks overlap freely.

**When to use it:**

- Read-only operations where each callback is independent — extracting text, asserting values, or pushing data into an accumulator.
- All the cells you need are already in the DOM on every page (no column scrolling, no tooltips).
- Speed is a priority and you have confirmed there are no shared side-effects between callbacks.

**Cost:** Much faster than sequential for read-heavy workloads. Be cautious: if callbacks interact with shared UI state, races will produce wrong reads or silent data corruption.

---

### Synchronized

```typescript
await table.forEach(async (row) => {
  const dept = await row.getCell('Department').innerText()
  results.push(dept)
}, { concurrency: 'synchronized' })
```

Rows within a page run their callbacks in parallel up to a _barrier_: any operation that touches shared viewport state (such as `scrollToColumn`) pauses until all sibling callbacks have reached the same point, then all proceed together. Pages still advance sequentially.

**When to use it:**

- Your table virtualizes columns (only a subset of columns are in the DOM at once) and callbacks call `scrollToColumn`.
- Without a barrier, parallel callbacks scroll the column viewport independently and land out of sync with each other.
- You want page-level parallelism for speed, but need coordinated navigation for correctness.

**Cost:** Slightly slower than plain parallel because of barrier synchronization, but significantly faster than sequential across many rows.

---

## Setting a default

You can set the default mode for the whole table in `useTable` config:

```typescript
// All forEach / map / filter calls default to parallel
const table = useTable(locator, {
  concurrency: 'parallel'
})
```

Per-call options always override the table-level default:

```typescript
// Table default is parallel, but this call runs sequentially
await table.forEach(async (row) => {
  await row.getCell('Action').locator('button').click()
}, { concurrency: 'sequential' })
```

---

## Interactive

The animator below runs the same 3-page `forEach` in all three modes side by side. Pick a scenario to see how the mode that works for simple tables can break down when the table has shared UI state.

<LabConcurrencyAnimator />

## What to notice

- **Scenario 1 — All cells in DOM:** Parallel and synchronized finish in roughly the same time and both produce correct results. Sequential is noticeably slower. Synchronized is marked "same as parallel" here because there is no column scroll barrier to coordinate — prefer parallel when columns are always in the DOM.

- **Scenario 2 — Columns virtualized:** Parallel breaks. Each row fires `scrollToColumn` independently; they race to scroll the same viewport and settle out of sync, producing wrong or missing reads. Synchronized introduces a barrier so all rows scroll together and land on the correct column every time.

- **Scenario 3 — Click for name (tooltip):** Only one cell can be open at a time — clicking a second row closes the first. Parallel tries to click all rows on the page simultaneously; almost every read gets nothing. Synchronized coordinates the column scroll, not the row callbacks, so the conflict still occurs. Sequential is the only correct choice here: it opens, reads, and closes each row before moving to the next.

- **Elapsed time badge:** Shows the real (simulated) wall-clock time for each mode. With many pages and fast callbacks, the speed advantage of parallel over sequential can be substantial.

- **Speed picker:** Use "2× slower" or "4× slower" to see the scheduling pattern clearly. "Realistic" collapses the gaps — at real Playwright speeds the difference in timing is dramatic but harder to see in the animator.

---

## Quick-reference table

| Scenario | Sequential | Parallel | Synchronized |
| :--- | :---: | :---: | :---: |
| Read-only, all columns in DOM | ✓ | ✓ recommended | ✓ (same as parallel) |
| Read-only, columns virtualized | ✓ | ✗ races | ✓ recommended |
| Click / mutation per row | ✓ recommended | ✗ conflicts | ✗ conflicts |
| Tooltip / modal per row | ✓ recommended | ✗ conflicts | ✗ conflicts |

See [`concurrency`](/api/table-config#concurrency) in the API reference for the exact type signature and per-call override syntax.
