# Roadmap

## Short Term - Philosophy Debt

Guiding light: [`PHILOSOPHY.md`](PHILOSOPHY.md) is the scoring rubric for every `/gbu` audit ([`.agents/workflows/gbu.md`](.agents/workflows/gbu.md)). Each audit should check items off this list and file new drift as linked issues here, rather than letting it accumulate in core.

### Batch 1 — GBU 2026-08-22 ([`GBU-REPORT.md`](GBU-REPORT.md)) — shipped in v6.21.0 / v6.22.0

- [x] **Slim `_navigateToCell` / viewport-first** — [#426](https://github.com/rickcedwhat/playwright-smart-table/issues/426)
- [x] **Unify pagination/scan loops** — [#427](https://github.com/rickcedwhat/playwright-smart-table/issues/427)
- [x] **Public API hygiene (Plugins, `getColumnValues`, dead Strategies)** — [#428](https://github.com/rickcedwhat/playwright-smart-table/issues/428)
- [x] **FilterEngine + `getCellLocator`; getRow/findRow filter parity** — [#429](https://github.com/rickcedwhat/playwright-smart-table/issues/429)
- [x] **scrollToColumn / bringIntoView prefer viewport** — [#430](https://github.com/rickcedwhat/playwright-smart-table/issues/430)
- [x] **No framework CSS defaults in generic strategies** — [#431](https://github.com/rickcedwhat/playwright-smart-table/issues/431)
- [x] **Test suite cleanup (redundant + gaps)** — [#432](https://github.com/rickcedwhat/playwright-smart-table/issues/432)
- [x] **Safer defaults & footguns** — [#434](https://github.com/rickcedwhat/playwright-smart-table/issues/434)
- [x] **ROADMAP/philosophy tracking hygiene** — [#433](https://github.com/rickcedwhat/playwright-smart-table/issues/433)

### Open tech debt (next batch)

- [x] **Header scroll logic duplicated between `headers.ts` and `glide/headers.ts`** — [#439](https://github.com/rickcedwhat/playwright-smart-table/issues/439)
- [x] **Type SmartRow internal flags (`_selfHealing` / `_inBatch` / `_barrier`) instead of `as any`** — [#440](https://github.com/rickcedwhat/playwright-smart-table/issues/440)
- [x] **Document recent APIs; gate docs-check CI on `src/` changes** — [#441](https://github.com/rickcedwhat/playwright-smart-table/issues/441)
- [x] **Unify `headerSelector` / `rowSelector` / `cellSelector` types; warn when string-only features get a function** — [#457](https://github.com/rickcedwhat/playwright-smart-table/issues/457)
- [ ] **Dependabot weekly npm group blocked by bundled major bumps** — [#442](https://github.com/rickcedwhat/playwright-smart-table/issues/442)

### Deferred to v7

- **Remove deprecated `getColumnValues`** — still public in v6 (marked `@deprecated` in #428); use `mapColumn` / `map`.
- **Remove `generateConfigPrompt`** — use `generateConfig`.
- **Make `table.currentPageIndex` read-only** — writes warn since v6.22.0 (#434).

Related closed work to reopen/extend: [#327](https://github.com/rickcedwhat/playwright-smart-table/issues/327) (v7 preset API), [#386](https://github.com/rickcedwhat/playwright-smart-table/issues/386) (Grafana-class patterns).

## Short Term - Quality of Life & Safety

### 🛡️ Safety & Stability
<!-- No items currently in this section -->

### 👩‍💻 Developer Experience
- [x] **`columnOverrides`**: Introduce `columnOverrides` to `TableConfig`.
    - **Purpose**: Unified interface for two-way data binding per column, overriding `smartFill` and `toJSON`.

- [x] **Test Coverage for `bringIntoView` with `findRows`**:
    - **Purpose**: Ensure `row.bringIntoView()` works reliably for rows found across multiple pages via `findRows`.
- [x] **Array-like Iteration Methods (`map`, `forEach`, `filter`)**:
    - **Purpose**: Introduce familiar, high-level array methods on the `TableResult` interface with a public async iterator as the engine.
    - **Callback**: `{ row, rowIndex, stop }` — call `stop()` to end iteration early.
    - **Options**: `{ concurrency?: 'parallel' | 'sequential' | 'synchronized', maxPages?: number, dedupe?: DedupeStrategy }`.
      - `forEach`, `filter`, and `map`: default `concurrency: 'sequential'` (safer for UI interactions; pass `parallel` for read-only maps).
      - `synchronized`: lock-step navigation with serialized callbacks (virtualized grids).
    - **Also adds**: Public `[Symbol.asyncIterator]` on `TableResult` — enables `for await (const { row } of table)`.
    - **Deprecates**:
      - `iterateThroughTable` (use `forEach`/`map`/`filter` instead).
      - `getColumnValues` (use `map` instead) — its deprecation is documented; removal remains planned for v7.0.0.
 - [x] **Document `forEach`/`map`/`filter` in README**
 - [x] **Safer `map` concurrency default (`sequential`; parallel opt-in)** — [#434](https://github.com/rickcedwhat/playwright-smart-table/issues/434)
 - [x] **Add mutation testing (Stryker)**
    - **Purpose**: Measure test effectiveness beyond coverage by introducing mutation testing using Stryker for Vitest.
    - **Goal**: Run locally and optionally as a scheduled CI job; aim for a high mutation score (>=80–90%).
    - **Notes**: Mutation testing is compute-intensive — start as a nightly/check rather than a blocking per-PR job.
    - **Completed**: Installed Stryker and Vitest runner plugins. Created a nightly GitHub action workflow (`mutation-testing.yml`) that runs `npm run test:mutate` and uploads the HTML report as an artifact.

- [x] **Improve verbose debug logging across internals**
    - **Purpose**: Ensure key internal modules (useTable orchestration, pagination/ stabilization strategies, rowFinder, tableMapper, smartRow) emit informative logs when `config.debug.logLevel` is `verbose`.
    - **Completed**: `tableIteration.ts` now emits start/scan/dedupe/stop/advance/complete events for `forEach`, `map`, and `filter`. `rowFinder.findRows` emits per-page match counts and pagination progress. `useTable._advancePage` logs which primitive fired and pages jumped. Unit tests assert specific log substrings under `verbose`; E2E test upgraded from smoke to assertion-based.

### 🧹 Cleanup (completed in v6.7.0)
- [x] **Remove Deprecated APIs**:
    - `iterateThroughTable` → replaced by `forEach`/`map`/`filter`.
    - `dataMapper` → replaced by `columnOverrides.read`.
    - `clickNext` pagination strategy → replaced by `click({ next: ... })`.
    - *Not removed:* `getColumnValues` is still public (deprecated in [#428](https://github.com/rickcedwhat/playwright-smart-table/issues/428)); removal is deferred to v7 (see above).

### ⚡ Performance
- [x] **Improve infinite scroll iteration** (done in v6.7.2):
    - **Was**: Re-scanned entire DOM on every infinite scroll iteration (O(N²)).
    - **Now**: Incremental scan via `evaluateAll` + browser-side `WeakMap`; only new rows processed.
    - **Impact**: 10k-row traversal reduced from multiple seconds to ~400ms.

### 🛠️ Implementation Improvements
- [x] **Expose `getHeaderCell` in `StrategyContext`**: Allow custom strategies to easily resolve header cells without manual locators.
- [x] **Simplify Sorting Strategy API**: Refactor `doSort` so that strategies only define the *trigger* (e.g., "click this"), while the library handles the loop, state verification, and retries.
- [x] **`goNextBulk` / `goPreviousBulk` Pagination Primitives**: Add bulk-jump primitives to `PaginationPrimitives` for navigating N pages at a time (e.g., a `»` button that skips 10 pages). Useful for sparse sampling across large paginated tables.
- [x] **`reset()` auto-navigates to first page**: If the pagination strategy provides `goToFirst`, `reset()` should call it automatically after `onReset`. If `goToFirst` is not configured, log a message so the user knows the table may not be on page 1.
    - **Order**: `onReset(context)` → `goToFirst()` if available → clear header map + reset `currentPageIndex`.
    - **Benefit**: Removes the footgun where users must manually navigate to page 1 inside `onReset` even though they've already declared a `first:` selector in their pagination strategy.

### 🔌 Ecosystem
- [x] **Community Presets**:
    - **Goal**: `useTable(loc, { ...presets.muiDataGrid, maxPages: 5 })` (see existing MUI preset)
    - **Repository**: Created `src/presets` directory for official library support.
    - **Targets**: Material UI Table, MUI DataGrid, React Data Grid (RDG), Glide Data Grid.
    - **Vision**: Enable community contributions for specific library support, removing the burden of manual configuration for popular libraries.

## Non-Goals

To maintain focus, the following are **explicitly out of scope**:

- **Visual Regression Testing**: Use Playwright's screenshot APIs. We handle data, not pixels.
- **Pure Canvas Tables (No DOM)**: No DOM = out of scope. Canvas with DOM fallbacks is supported. (Possibly explore pure canvas tables in the future and see if we're remotely able to support them)
- **Complex Merged Cell Logic**: Basic support exists. Not a current priority.
