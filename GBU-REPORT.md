# GBU Report - playwright-smart-table v6.23.1

Generated: 2026-09-30 (main @ `a231fb32`)

> Guiding light: [`PHILOSOPHY.md`](./PHILOSOPHY.md)
> Previous audit: 2026-08-22 (v6.20.1). All of its issues ([#426](https://github.com/rickcedwhat/playwright-smart-table/issues/426)–[#434](https://github.com/rickcedwhat/playwright-smart-table/issues/434)) plus the follow-up batch ([#439](https://github.com/rickcedwhat/playwright-smart-table/issues/439)–[#442](https://github.com/rickcedwhat/playwright-smart-table/issues/442), [#457](https://github.com/rickcedwhat/playwright-smart-table/issues/457)) have shipped. It's in git history.

---

## What changed since the last audit

| August finding | Status now |
|---|---|
| Glide canvas/`Home` logic in core `_navigateToCell` | ✅ Gone. Only a generic `snapFirstColumnIntoView` navigation hook remains; a unit test guards it (`navigateToCell.no-glide-core`) |
| Generic strategies shipping framework CSS defaults | ✅ Gone. No MUI/RDG/Glide/Tailwind selectors outside `src/presets/` (one example string in a warning message) |
| 7 divergent page/scan loops | ✅ Mostly fixed. `scanPages` serves `findRow`, `findRows`, `map`/`forEach`/`filter` and `countRows`, and the async iterator reuses `runMap`. ⚠️ `findRowByIndex` still has its own `_advancePage` loop |
| Dead `Strategies.Resolution` / `CellNavigation` / `Filter.spy` | ✅ Removed from the namespace. ⚠️ The `ResolutionStrategies` factory file and its unit tests still exist (see Bad #2) |
| `Plugins` / `getColumnValues` undead | ✅ Marked `@deprecated`, with parity tests; removal is scheduled for v7 in ROADMAP |
| Unbounded `isTableLoading`, parallel `map` default, double sort retry | ✅ Fixed in 6.22.0 (#434) |
| `console.*` in `generateConfig` | ✅ Routed through `logDebug`. The remaining `console.warn`s are deliberate one-time footgun warnings |
| Stale `CONTRIBUTING.md` (npm) | ❌ **Not fixed.** It still says `npm install` / `npm test` |
| `useTable.ts` ~797 / `smartRow.ts` ~993 lines | ❌ **Grew** to 889 / 1,039 |

---

## PHILOSOPHY ALIGNMENT 🧭

(Reference: PHILOSOPHY.md)

- **Mission fit:** Strong. The August drift (framework knowledge in the core) is gone. Everything framework-specific lives in `src/presets/` or is a user strategy, and `TableConfig` + `TableStrategies` + presets is still the only way to teach the library a table. The Grafana work (#417) was done entirely in test-side strategies (`resolveRowIndex`, custom viewport); the core didn't learn about Grafana.
- **Strategy-first:** Rich hook surface (`pagination`, `loading` incl. row/cell timeouts, `viewport`, `contentReady`, `resolveRowIndex`, `dedupe`, `columnOverrides`, `syntheticColumns`). Presets are `Partial<TableConfig>` built by factories (`createMuiDataGrid({ buttonLabels })`, `createGlide`). There are no `if (isMui)` checks anywhere in the engine.
- **Core thinness:** The weak spot. The engine was split out (`src/engine/`: `rowFinder`, `tableIteration`, `scanPages`, `tableMapper`, `rowResolution`), but `useTable.ts` still grew by about 90 lines. It inlines three engines that belong in `src/engine/`: `countRows` (~120 lines), `sorting.apply` (~50 lines of retry/wait orchestration) and `findRowByIndex` (~65 lines, with its own pagination loop). `smartRow.ts` at 1,039 lines is the largest file: `_navigateToCell` (~330 lines), plus a `toJSON` that contains its own atomic snapshot, materialization and re-pin machinery.
- **Decision-checklist failures:** None among recent features. #457 (function selectors) warns and degrades in the strategy instead of branching in the core; #461 was a regression, not a design choice. The one soft failure is **Removability** (checklist item 7): recycling-virtualizer correctness (re-pin, atomic `toJSON`, overscan deferral, final scan) is spread through `smartRow` and `tableIteration`, not isolated behind a hook.
- **Score: 8/10 alignment** (up from 7). The hard violations are gone; what's left is core weight.

---

## THE GOOD ✅

- **Presets are pure configuration.** `mui.ts`, `rdg.ts` and `glide/` are factories returning `Partial<TableConfig>`, and deleting one wouldn't touch the engine. `buttonLabels` localization goes through the factory, not a core flag.
- **Describe-your-table held under pressure.** Grafana-class tables (`style.top` rows, no `data-rowindex`), async content (`contentReady.textStable` / `mutationSettled`) and recycling DOM were all solved with strategies a user can write. The core only gained generic primitives (`resolveRowIndex`, `contentReady`, overscan-aware `getVisibleRowIndices`).
- **One scan primitive.** `scanPages` (#427) gives `findRow`/`findRows`/`map`/`forEach`/`filter`/`countRows` the same EOF final scan, loading gate and bounded page budget. The async iterator is a thin adapter over `runMap`.
- **Playwright-native surface.** `SmartRow` is still a Locator with extras. Sentinel rows keep `expect(row).not.toBeVisible()` working, and `get*` (sync, local) versus `find*` (async, searching) is consistent. `TableSelector` (#457) unifies string and `(root) => Locator` selectors.
- **Fail-helpful.** Column typo suggestions, strict-mode `getRow`, strategy validators, `maxPages: 1` plus pagination warning, `currentPageIndex` write warning, and one-time warnings when string-only features get a function selector.
- **Release safety net is real now.** Compiled `dist/` is scanned for runtime Playwright requires (6.23.1). `scripts/test-packaging.sh` runs on every PR: it loads the package without `@playwright/test` and type-checks the published `.d.ts` on TS latest, 5 and 6 (#462). `noUnusedLocals`/`noUnusedParameters` are on (#463). API docs signatures are generated from `src/types.ts` and CI fails on drift (#441).
- **Deep test suite.** 85 files and about 830 tests, covering both engine internals (Vitest) and public behavior (Playwright), plus integration runs against MUI DataGrid, RDG and RDG2D.

---

## THE BAD ⚠️

1. **`useTable.ts` inlines three engines.** `countRows`, `sorting.apply` and `findRowByIndex` together are about 235 of its 889 lines. `findRowByIndex` also keeps its own `_advancePage` loop, the last one outside `scanPages`.
   - *Fix:* Move them to `src/engine/` (`countRows.ts`, `sorting.ts`, `rowByIndex.ts`) and have `findRowByIndex`'s fallback use `scanPages` with a stop predicate. This is refactoring only, with no behavior change.

2. **Dead module and dead public type.** `src/strategies/resolution.ts` exports `ResolutionStrategies`, which nothing imports; it has 7 unit tests (`tests/unit/resolution.test.ts`). `ColumnResolutionStrategy` is exported from `types.ts` and `strategies/index.ts` but nothing consumes it. Deprecated `CellNavigationStrategy` is still exported.
   - *Fix:* Delete the factory and its tests now. Keep the two types until v7 (removing a public type is breaking) and add them to ROADMAP "Deferred to v7".

3. **The README snippet pipeline is vestigial.** `README.md` is now a 63-line landing page with **no** embed markers. `generate-docs` still extracts 15 `#region`s from `readme_verification.spec.ts` on every build and updates nothing. Docs examples, including the new examples page (#402), are hand-copied from tests and can drift. `.cursorrules` / `CLAUDE.md` still say README snippets are auto-generated. There's also an orphan `// #endregion advanced-column-scan` with no opening `#region`.
   - *Fix:* Either point the generator at `docs/**/*.md` (embed tested snippets into the guide and examples pages), or delete it and update the agent rules. The first option matches the "every snippet is tested" promise on the examples page.

4. **`CONTRIBUTING.md` still teaches npm.** `npm install`, `npm test`, `npm run build`, `npm run docs:dev`, plus the PR checklist line. This was flagged in August and still isn't fixed.
   - *Fix:* Switch to pnpm (`pnpm install --frozen-lockfile`, `pnpm run test:unit`, `npx playwright test`).

5. **`smartRow.ts` is the new center of gravity (1,039 lines).** `toJSON` alone owns atomic snapshots, materialization, re-pin/recovery and per-cell loading timeouts. None of it is framework-specific, but it isn't removable either.
   - *Fix:* Extract `_navigateToCell` to `src/engine/cellNavigation.ts` (August's option B, never completed) and the atomic/re-pin logic to `src/engine/rowSnapshot.ts`. Freeze growth in `smartRow.ts`.

6. **Soft-drift defaults remain.** `maxPages: 1` (it warns now, but still surprises people), `autoScroll: true`, and `pagination: {}` as an empty default object. None are wrong, but each needs a doc callout.
   - *Fix:* Leave as-is for v6 and revisit with the v7 preset API ([#327](https://github.com/rickcedwhat/playwright-smart-table/issues/327)).

7. **`./types` subpath export maps its runtime entry to `dist/index.js`.** Harmless because it's type-only, but surprising.
   - *Fix:* Mark it types-only, or map `default` to `dist/types.js`.

---

## THE UGLY 🚨

1. **`infiniteScroll` silently returns incomplete data ([#473](https://github.com/rickcedwhat/playwright-smart-table/issues/473)).** A fixed `scrollAmount` (default 500px) larger than the scroller's rendered window skips rows that never get mounted: 163/300 and 246/300 in the Grafana fixture, with no error. Silent data loss is the worst failure mode for a scraping library, and the default is enough to trigger it in a ~300px scroller. Existing tests hide it: they use 1,000–1,500px steps but only `findRow` the *last* row.
   - *Action:* Clamp the default to the scroller's `clientHeight` and warn when an explicit value exceeds it. Optionally detect gaps via `resolveRowIndex`. Add a `test.fail()` regression now.

2. **Grafana-class tables are unverified ([#417](https://github.com/rickcedwhat/playwright-smart-table/issues/417), reopened).** Five fixes landed in August, but the issue auto-closed on the first merge and nobody checked it against the real table. The 18-row early stop is still unreproduced. Until the faithful fixture (branch `test/417-grafana-fixture`) turns into assertions, the virtualization guide's claims for this class of table rest on a weaker synthetic test.
   - *Action:* Land #473, convert the fixture into asserting tests, then consider an optional real-Grafana-in-Docker job.

3. **PR CI depends on live third-party sites, hidden by retries.** CI-A runs `readme_verification` (11 datatables.net tests, mui.com and htmx.org), `debug-mode` (6 datatables.net tests) and `error-handling` (3 datatables.net tests). CI-B runs `mui-table` (mui.com) and `glide` (glideapps storybook). Global `retries: 2`, plus per-file retries, hides both site outages and real flakiness. On top of that, `playground-virtualization`, `dedupe-loading-order` and `performance` silently `test.skip` when `localhost:3000` is down, so coverage can drop without anything failing.
   - *Action:* Move `debug-mode` and `error-handling` to `setContent` fixtures. Snapshot the datatables page into `tests/test-assets/` for `readme_verification`. Keep live-site checks in the existing non-blocking live config. Make the playground skips fail in CI.

4. **A regression shipped in three releases (6.21.0–6.23.0, [#461](https://github.com/rickcedwhat/playwright-smart-table/issues/461)).** A value import from `@playwright/test` made the package crash for consumers without it. This is fixed now, and three guards prevent a repeat: the build scan, the PR packaging job and `noUnusedLocals`. It stays in Ugly for this report only, because 11 versions had to be deprecated on npm ([#464](https://github.com/rickcedwhat/playwright-smart-table/issues/464)).
   - *Action:* None left; closed out by #462 and #463. Drop from the next report.

---

## TEST AUDIT

**Inventory:** 85 files, about 830 tests: 34 E2E specs (~296), 8 integration specs (28) and 43 Vitest files (~500, of which 75 are CI-bot tests in `unit/bot/bot-queue.test.ts`, which aren't library code).

### Redundant Tests

| Test File | Test Name | Duplicates | Recommendation |
|---|---|---|---|
| `edge-cases.spec.ts` | `bringIntoView() throws when row index is unknown` | Nothing: it builds a hand-written mock object and asserts the mock's own `throw`; no library code runs | **Cut**, or rewrite against a real `getRow()` row |
| `edge-cases.spec.ts` | `table has expected core methods` | TypeScript types plus every other spec | **Cut** |
| `edge-cases.spec.ts` | `init chaining works` | Every spec that does `await useTable(...).init()` | **Cut** |
| `edge-cases.spec.ts` | `getRow works when table appears later (lazy load)` | Content is set before `init()`; `init with timeout waits for table to appear` covers the real case | **Cut** |
| `edge-cases.spec.ts` | `getRow vs findRow: current page only vs cross-page` · `wasFound() returns false for sentinel rows…` | `findRow with maxPages: 1 returns sentinel…` (same fixture and steps) | **Merge** into that test |
| `edge-cases.spec.ts` | `columnOverrides.read only: toJSON uses custom read for column` | `column-overrides-read-context` `single-argument read(cell) still works…` | **Cut** |
| `row-finder.spec.ts` | Whole file (4 tests) | `rowindex-resolution.spec.ts`, `unit/rowFinder.unit` `useBulk`, `functional-methods` #349 | **Fold** the one unique test (getRow → undefined `rowIndex`) into `rowindex-resolution`; delete the file |
| `functional-methods.spec.ts` | `dedupe option > map with dedupe skips duplicate rows` | The fixture has no duplicates, so it asserts nothing | **Cut**, or give the fixture real duplicates |
| `functional-methods.spec.ts` | `map > concurrency: sequential produces ordered results` · `forEach with useBulkPagination: false uses goNext (default)` | The defaults are already exercised by the base `map`/`forEach` tests | **Cut** |
| `functional-methods.spec.ts` | `filter > returns a SmartRowArray with toJSON()` | `filter > returns only rows matching predicate across all pages` | **Merge** |
| `functional-methods.spec.ts` | `map > stop() halts after current page` | Asserts `<= 4`, which also passes with 0 rows | **Keep**, but assert the exact rows |
| `sorting.spec.ts` | `should apply ascending/descending sort and update aria-sort attribute` | The `…correctly sorted alphabetically/numerically` tests (same apply) | **Merge** (state + attribute + data once each) |
| `debug-mode.spec.ts` | `Combined debug features` · `No debug mode works normally (performance check)` | Assert only `toBeDefined()` / timing on a live site | **Cut** |
| `debug-mode.spec.ts` | `Verbose logging emits expected messages during map()` · `Granular delays work` | `unit/debugUtils.coverage` (same messages and delays) | **Cut** / **merge**, and move what's left to `setContent` |
| `strategies.spec.ts` | `Strategy: Infinite Scroll (HTMX Example)` | `readme_verification` HTMX dedupe test (same site and strategy); already out of CI-A | **Cut** |
| `header-transformer.spec.ts` | `headerTransformer receives seenHeaders to handle duplicates` | `error-handling` `headerTransformer can fix duplicate errors` | **Merge** into one `headerTransformer` describe |
| `playground-virtualization.spec.ts` | `should handle random stutter delays` | `toBeTruthy()` also passes for a sentinel row; `duration > 0` means nothing | **Cut**, or assert `wasFound()` + data |
| `integration/rdg.spec.ts` | `should handle reading specific columns from middle of table` · `should paginate through virtualized rows` | Same file: `…all columns including virtualized ones` / `synchronized map collects 50+ unique rows…` | **Cut** / **merge** |
| `integration/rdg-2d.spec.ts` | `getCell works for columns at different horizontal positions` | Never calls `getCell`; a subset of `reads all columns for a row…` | **Rewrite** to use `getCell`, or cut |
| `integration/glide.spec.ts` | `should infinite scroll` | `should infinite scroll with scroll right` (a superset) | **Merge** |
| `unit/issue104.test.ts` | Whole file | One test asserts an object literal (tsc covers it); the rest duplicate `glide-viewport.test.ts` | **Merge** into `glide-viewport`; delete |
| `unit/mui.sort.test.ts` | `does not call waitForTimeout with a fixed 500ms value` | `gbu-434` `muiDataGrid.doSort clicks once` (same mock) | **Merge** |
| `unit/resolution.test.ts` | All 7 tests | Tests the dead `ResolutionStrategies` module (Bad #2) | **Cut** with the module |

Also: rename `gbu-432-coverage`, `gbu-434-safer-defaults`, `gbu-457-selector-types` and `dedupe-loading-order` to feature names, since audit or bug numbers don't say what a file covers. Consider moving `unit/bot/bot-queue.test.ts` next to the bot scripts so library test counts stay honest.

### Missing Tests

| Feature | Why Important | Suggested Test |
|---|---|---|
| `infiniteScroll` step larger than the rendered window (#473) | Known silent data loss, and no test catches it | Recycling list with a 200–300px scroller and the default step; `map` must return all N unique rows. `test.fail()` until fixed |
| `createMuiTable` / `createMuiDataGrid` `buttonLabels` | **Zero coverage** (it was on August's missing list too). Non-English UIs silently stop paginating | Footer with `aria-label="Page suivante"`: the factory with labels clicks it; the default preset returns `false` |
| `Pagination.click` `detectCurrentPage` | **Zero coverage.** The init path sets `currentPageIndex` and has a fallback for invalid values | Init on page 3 → `currentPageIndex === 2`; `-1` or a throw → 0 without crashing |
| `Pagination.click` `numberOfPages` → `getTotalPages` | **Zero coverage.** Integer validation plus `goToLast` path planning | `0` / `1.5` / NaN throw; `bringIntoView` near the end uses `goToLast` + `goPrevious` |
| `pageNumbers` windowing (real DOM) | Only a mock unit test exists; exact-label matching ("1" vs "10") is untested | Sliding 1–5 pager; `bringIntoView` to page 12; pages "1" and "10" present |
| `LoadingStrategies.Table.hasSpinner`, `Row.hasClass` / `hasText` / `hasEmptyCells` | Exported helpers that are never exercised | Unit per helper (true and false branches) |
| Custom `strategies.fill` contract | Only the "not a function" validation is tested | Spy fill strategy: called once per column with `{row, columnName, value, fillOptions, config, table}`; the default isn't called |
| `columnOverrides.write` edge cases | 1 happy-path test | write without `read`; a throwing write names the column; conflict with `syntheticColumns` |
| Row-loading timeouts, deterministic | `findRows` skip/throw only run against the playground server (and silently skip when it's down); `map` + `'throw'` is untested | `setContent` skeleton rows: `findRows` skip/throw and `map` throw |
| `sorting.apply` when `isTableLoading` never settles | Only the success path is tested | Always-loading table → `apply` rejects within its budget |
| `findRowByIndex` via `scrollToRow` / pagination, deterministic | Only tested on the MUI app (CI-B) | `setContent` fixture with `resolveRowIndex` + `viewport.scrollToRow` for an unmounted index |
| Async `headerTransformer` + `locator` arg | The types allow both; neither is tested | Transformer reading `locator.getAttribute('data-key')` asynchronously |

**Adequately covered:** `getRowByIndex`, `countRows`, `mapColumn`, `getColumnValues`, `scrollToColumn`, `revalidate`, `isEmpty`, `reset`/`onReset`, `for await`, `mergeTableConfig`, dedupe, `contentReady`, Glide factories and `rdg2D` (integration only). The optional-peer guarantee is covered by `scripts/test-packaging.sh` on every PR.

**Flaky-risk hot spots:**
- **Wall-clock assertions:** `debug-mode`, `error-handling` ("wait for headers", > 1,100ms), `playground-virtualization` ("cache", 1,200–1,500ms) and `performance`.
- **Fixed `waitForTimeout` sleeps:** most heavily in `viewport-strategy` (~12) and `horizontal-virtualization` (7).

---

## SUMMARY

- **Overall health score: 8/10** (up from 7.5). The architecture debt from August is paid down and the release safety net is much stronger. Two things hold it back: one silent data-loss bug (#473), and a CI suite that leans on live sites and retries.
- **Philosophy alignment score: 8/10** (up from 7). The hard violations are gone; what's left is core weight in `useTable.ts` and `smartRow.ts`.
- **Top 3 priorities:**
  1. **[#473](https://github.com/rickcedwhat/playwright-smart-table/issues/473): fix silent row skipping in `infiniteScroll`**, then land the Grafana fixture assertions for [#417](https://github.com/rickcedwhat/playwright-smart-table/issues/417). Correctness first.
  2. **Take live sites off the PR critical path.** Use `setContent` or snapshot fixtures for `debug-mode`, `error-handling` and `readme_verification`; make playground skips fail in CI; then reconsider the global `retries: 2`. Cut the redundant and tautological tests listed above in the same pass.
  3. **Thin the core again.** Move `countRows`, `sorting.apply` and `findRowByIndex` (onto `scanPages`) out of `useTable.ts`, and `_navigateToCell` and the snapshot/re-pin logic out of `smartRow.ts`. Delete the dead `ResolutionStrategies` module. Refactor only: this restores Principle 2 without touching the public API.

**Quick wins** (small PRs that don't need a decision): `CONTRIBUTING.md` → pnpm; delete `resolution.ts` + its tests; fix the orphan `#endregion`; add the `buttonLabels` / `detectCurrentPage` / `numberOfPages` tests.

**Needs your decision:** what to do with the README snippet pipeline. Either retarget it at `docs/**/*.md` so the guide and examples pages embed tested snippets, or delete it and update `.cursorrules` / `CLAUDE.md`.

### Issue map (GBU → GitHub)

| Topic | Issue |
|---|---|
| `infiniteScroll` silent row skipping | [#473](https://github.com/rickcedwhat/playwright-smart-table/issues/473) |
| Grafana-class verification | [#417](https://github.com/rickcedwhat/playwright-smart-table/issues/417) |
| Live sites off the PR critical path | [#474](https://github.com/rickcedwhat/playwright-smart-table/issues/474) |
| Cut redundant/tautological tests; rename bug-numbered files | [#475](https://github.com/rickcedwhat/playwright-smart-table/issues/475) |
| Missing tests for public options | [#476](https://github.com/rickcedwhat/playwright-smart-table/issues/476) |
| Move engines out of `useTable.ts` | [#477](https://github.com/rickcedwhat/playwright-smart-table/issues/477) |
| Move cell navigation and snapshot logic out of `smartRow.ts` | [#478](https://github.com/rickcedwhat/playwright-smart-table/issues/478) |
| Quick wins | [#479](https://github.com/rickcedwhat/playwright-smart-table/issues/479) |
| README snippet generator decision | [#480](https://github.com/rickcedwhat/playwright-smart-table/issues/480) |
