# GBU Report - playwright-smart-table v6.25.0

Generated: 2026-10-11 (America/New_York)

Audited: main at `0d74239c7a4e42c1f5ba708fc6f5422a59f07984`, after #508 merged. This includes unreleased changes; the package version remains 6.25.0.

The architecture has improved substantially since the September audit. The remaining risk is lifecycle correctness: green tests coexist with reproducible wrong-row reads, missing records, and indefinitely pending reads. Fix those before expanding the public API.

## Scope, instructions, and validation

Read the shared [AGENTS.md](AGENTS.md), [CLAUDE.md](CLAUDE.md), [.cursorrules](.cursorrules), [CONTRIBUTING.md](CONTRIBUTING.md), [PHILOSOPHY.md](PHILOSOPHY.md), [ROADMAP.md](ROADMAP.md), and the specific [GBU workflow](.agents/workflows/gbu.md). AGENTS.md takes precedence over conflicting older agent guidance. Reviewed exports, public types, engines, utilities, every strategy/preset, recent changelog entries, CI configuration, open work, and all 81 test files under `tests/`. The [test inventory](docs/audits/2026-10-11-test-inventory.md) records coverage and overlap per file.

Validation on the audited commit:

| Check | Result |
|---|---|
| `pnpm run build` | Passed; generators produced no tracked changes |
| `pnpm run fallow` | Passed; no reported dead code |
| `pnpm run test:unit` | 40 files, 419 tests passed |
| CI-A, Chromium, 4 workers, retries 0 | 254 passed; 0 failed, skipped, or flaky; 87.9 s |
| CI-B, Chromium, 2 workers, retries 0 | 19 passed; 0 failed, skipped, or flaky; 32.2 s |
| Packed consumer smoke | Passed: optional-peer runtime load; declarations on TS 7.0.2, 5.9.3, and 6.0.3 |
| Report documentation | Production docs build and all 21 nav/sidebar links passed; relative file links and 81 inventory entries checked |
| Isolated audit probes | Nine defects reproduced outside the existing suite; two additional API inconsistencies reproduced |

The unit command exited successfully but printed a child-process `ECONNREFUSED` for localhost:3000. Its origin was not established; treat it as log hygiene to investigate, not a demonstrated library failure. Unit instrumentation covers roughly 58% of source lines; browser tests are not instrumented, so this is not overall behavioral coverage. Live-site specs and optional performance specs were inspected but not executed. No real Grafana environment or minimum-peer browser matrix was exercised. Passing local suites do not establish production completeness.

[Reproduction scripts and observed output](docs/audits/2026-10-11-reproductions.md) are included so findings can be verified without reconstructing the conversation. Browser probes used the freshly built package and installed Playwright 1.63.0; the header-order probe is a deterministic strategy test with a scrolling oracle. Severity: P1 = wrong data, missing data, or blocked common operations; P2 = narrower incorrect behavior or API inconsistency. Scores below are qualitative judgments, not computed metrics.

## PHILOSOPHY ALIGNMENT 🧭

Reference: [PHILOSOPHY.md](PHILOSOPHY.md).

| Principle | Assessment | Score |
|---|---|---|
| Describe, don't encode / mission fit | Selectors, transforms, overrides, and strategies still describe the table. MUI, RDG, and Glide knowledge remains in preset packs. | 9/10 |
| Strategy-first configuration | Framework variation stays at the edges. New cancellation and readiness hooks are generic. | 9/10 |
| Keep the core thin | `useTable.ts` is 705 lines and `smartRow.ts` 319 after extraction, down from the previous report's 889 and 1,039. Engines now own count, sorting, index finding, navigation, and snapshots. Repeated environment wiring remains. | 8/10 |
| Stay close to Playwright | Public rows/cells retain Locator APIs; lazy selectors, custom locators, native descriptions, and optional fallbacks remain available. | 9/10 |
| Reader of DOM, not a store | Cell values are fresh, but viewport caches survive reset/revalidation and external movement. Row identity mistakes violate the intended fresh-read contract. | 6/10 |
| Scope stops at table boundary | Generic strategies remain scoped. Glide's broader lookup is confined to the preset; proposed debug work should remain opt-in. | 9/10 |
| Real use cases over theoretical completeness | Recycling, loading, filtering, and grid fixtures cover practical cases; avoid growing another wrapper API for new upstream actions. | 9/10 |
| Stable surface; helpful failures/logging | Signature and v6 deprecations preserved. Silent fallback to a different row, missing-attribute zeroes, and non-expiring waits undermine helpful failure. | 7/10 |

**Alignment: 8.5/10.** No new framework-specific core branch or fused framework engine was found. The current drift is stale DOM geometry and inconsistent identity/lifecycle orchestration, rather than a need for another table-specific flag. The decision checklist would reject fixing these with MUI-specific conditionals, shadow row-value caches, or custom click/fill wrappers. Fix them in shared engines and strategy contracts.

## THE GOOD ✅

- **The September extraction work is real.** `engine/countRows.ts`, `sorting.ts`, `rowByIndex.ts`, `cellNavigation.ts`, and `rowSnapshot.ts` now separate substantial behavior from the factory and row constructor. `scanPages` centralizes traversal boundaries and cancellation checks.
- **Recent merges strengthened lifecycle handling.** #510 protects playground reloads from stale work; #507 handles aborts on terminal scan paths and preserves abort reasons; #508 validates readiness budgets and bounds pending fallback evaluations. Those findings are completed work, not new audit recommendations.
- **Presets remain configuration.** MUI, RDG, and Glide supply selectors and strategies while consumers can replace individual hooks. Function selectors and `getCellLocator` allow nonstandard DOM structures without changing `useTable()`.
- **Playwright compatibility has thoughtful fallbacks.** Locator descriptions use native APIs when available and fallback metadata otherwise. `ContentReady.until()` uses native `waitForFunction` with a bounded fallback. Optional-peer runtime packaging is tested separately from browser use.
- **More meaningful local coverage.** CI no longer depends on public demo sites. Grafana-style fixtures assert membership and sort parity; loading-before-dedupe, callback contracts, cross-page path planning, synthetic filtering, cancellation, and snapshot stability have focused tests.
- **Public hygiene improved.** Dead strategy factories were removed; deprecated public types remain intentionally until v7. The `./types` export and package-version check exist. Fallow is clean; do not reopen completed cleanup merely because compatibility declarations remain.

## THE BAD ⚠️

### B1 — Same-page `bringIntoView()` still performs pagination work (P2)

In [smartRow.ts](src/smartRow.ts), the no-`goToPage` path treats an empty navigation plan as a missing path. A row already on page 0 invoked `goToFirst` once in the probe. Current tests cover the same-page shortcut only when `goToPage` exists. Return early when the current page equals the target, independently of available primitives; assert zero pagination calls for both configurations.

### B2 — Synthetic-column chaining has two meanings (P2)

[smartRow.ts](src/smartRow.ts) rejects reading a synthetic column from another synthetic's `compute()`. [rowSnapshot.ts](src/engine/rowSnapshot.ts) first checks accumulated output, so `toJSON()` permits chaining to an earlier synthetic column. The probe's `getValue('Second')` rejected while `toJSON()` returned both computed values. Enforce the documented no-chaining rule consistently before using snapshot data; test declaration order and selected-column reads. Do not infer support for arbitrary dependency graphs from incidental object iteration order.

### B3 — Agent and concurrency documentation has drifted

- `.cursorrules` says Claude uses separate worktrees, while AGENTS.md says agents work on branches in the main worktree. Its release wording should point directly to `pnpm version`, avoiding ambiguous manual version editing.
- The documentation-audit workflow still lists `getColumnValues` as removed, although it remains deprecated and public until v7.
- CLAUDE.md still says RowFinder owns its own pagination loop and calls a nonexistent `findRowLocator()` method; it should describe the shared `scanPages` engine and extracted row navigation/snapshot modules.
- `src/types.ts` describes synchronized mode as having “serial actions”; `runMap` runs its callbacks concurrently through `Promise.all`. Navigation barriers coordinate navigation; they do not serialize arbitrary consumer clicks or writes. ROADMAP repeated that claim and was corrected while reconciling this audit. Document the actual guarantee and recommend sequential mode for independent UI mutations.
- The README snippet-generator decision remains open at [#480](https://github.com/rickcedwhat/playwright-smart-table/issues/480). Resolve the source-of-truth policy before changing snippets by hand.

### B4 — Test names and mocks sometimes promise more than they verify

The clearest case is `mapColumn.unit.test.ts`: it does not call `table.mapColumn()` or `getColumnValues()`. It tests locally copied callbacks and even locally recreated error guards. Other cases are listed under the test audit. Favor public behavior and exact record identities over callback-shaped mocks, lower bounds, or success alone.

### B5 — Keep remaining cleanup proportional

Repeated iteration-environment construction and duplicated filter partitioning are maintenance debt, but do not justify another broad refactor ahead of the correctness defects. Horizontal discovery also retains its scroller JSHandle without disposal; clean that up with the discovery fix. Rename the remaining `issue82.test.ts` around its navigation diagnostic behavior when that area next changes. Keep deprecated public types until v7, as already planned.

## THE UGLY 🚨

All entries below have a source explanation and an isolated reproduction on the audited commit. They are separate from the passing baseline suite.

### U1 — Atomic snapshot can silently read a replacement row (P1)

Tracked: [#511](https://github.com/rickcedwhat/playwright-smart-table/issues/511).

**Trigger:** a numeric `resolveRowIndex` strategy, target row 0, and `contentReady` that awaits while the DOM slot becomes row 9 and row 0 disappears.

**Observed:** `row.toJSON({ atomic: true })` returned `{ A: 'WRONG-ROW-9', B: 'b0' }` for the target row 0.

**Cause:** `resolveCloneTarget()` in [rowSnapshot.ts](src/engine/rowSnapshot.ts) rechecks identity after readiness, but if `rescanForRow()` returns null it continues with the drifted `cloneTarget`.

**Action:** reuse recovery-or-throw after readiness; verify identity immediately before cloning. A frozen clone prevents later mutation but cannot repair cloning the wrong record. Test both recovery and disappearance, with no substitute data accepted.

### U2 — Returned synchronized `findRows()` rows can deadlock when read separately (P1)

Tracked: [#512](https://github.com/rickcedwhat/playwright-smart-table/issues/512).

**Trigger:** two matched rows, `concurrency: 'synchronized'`, a viewport strategy, then `await rows[0].toJSON()`.

**Observed:** the single-row read was still pending at a 300 ms watchdog even though both columns were already rendered.

**Cause:** [rowFinder.ts](src/engine/rowFinder.ts) attaches an N-participant `NavigationBarrier` to returned rows. Detached callers cannot promise that the other N−1 rows will ever participate or mark themselves finished. The existing barrier propagation unit test asserts the shared barrier rather than completion of public reads.

**Action:** confine batch barriers to an owned operation that controls every participant. Independently returned rows must work singly and sequentially. Preserve synchronized `map()` behavior; test partial reads, unequal column selections, rejection, and repeated reads.

### U3 — Render-window index is mistaken for logical row identity during snapshots (P1)

Tracked: [#513](https://github.com/rickcedwhat/playwright-smart-table/issues/513).

**Trigger:** a rendered window starts at logical row 100, then `table.getRowByIndex(0).toJSON()` with a numeric resolver.

**Observed:** live and atomic reads both rejected claiming “row 0 recycled out of the DOM,” although the intended first mounted row 100 was present.

**Cause:** the snapshot pinner compares the resolver's absolute identity against `env.rowIndex` without accounting for `renderWindowPosition`. Navigation has a translation path, but snapshot identity checks run before it.

**Action:** capture the mounted row's logical identity before any await that can recycle it, then use that identity for live and atomic recovery. Preserve the documented distinction between `getRowByIndex()` and `findRowByIndex()`. Test windows starting above zero, numeric and selector-backed resolvers, and recycling during the read.

### U4 — Row, cell, and header loading waits are not bounded when predicates stay pending (P1)

Tracked: [#514](https://github.com/rickcedwhat/playwright-smart-table/issues/514).

**Trigger:** a loading predicate returns a never-settling promise with a configured 50 ms budget.

**Observed:** row loading, cell loading, and `init({ timeout: 50 })` with `isHeaderLoading` were each still pending at 300 ms.

**Cause:** [rowResolution.ts](src/engine/rowResolution.ts), [rowSnapshot.ts](src/engine/rowSnapshot.ts), and [tableMapper.ts](src/engine/tableMapper.ts) await predicates before checking elapsed time. #508 fixed pending evaluations in `ContentReady.until()` and table loading, not these other paths.

**Action:** apply remaining-budget bounds to predicate evaluation and polling, preserving each existing timeout policy (`process`, `skip`, `throw`, callback, or header error). Test immediate and later pending polls with fake timers; assert timer cleanup. A timeout race bounds the caller's wait but does not itself cancel underlying Playwright work. Cooperative signal forwarding remains [#509](https://github.com/rickcedwhat/playwright-smart-table/issues/509).

### U5 — Viewport cache survives DOM changes, reset, and revalidation (P1)

Tracked: [#515](https://github.com/rickcedwhat/playwright-smart-table/issues/515).

**Trigger:** cached visible DOM positions `[0]`; the UI then exposes `[0, 1]`; call `revalidate()` or `reset()` and map again.

**Observed:** subsequent maps still returned only A instead of A and B; the viewport oracle had been called once in total.

**Cause:** [useTable.ts](src/useTable.ts) clears geometry caches on wrapped scrolls/page advances, but not reset, header revalidation, or arbitrary external UI changes. This caches changing DOM state as though it were structural metadata.

**Action:** clear caches at lifecycle and operation boundaries; scope memoization to a well-defined scan/navigation operation, or default dynamic oracles to uncached. Test reset, revalidation, sort, external movement, and changed row membership. `disableCache: true` is an existing workaround, not a complete fix for default behavior.

### U6 — `byTopPosition` drops different records that reuse one viewport slot (P1)

Tracked: [#516](https://github.com/rickcedwhat/playwright-smart-table/issues/516).

**Trigger:** map a row A; pagination reuses its DOM slot at the same screen y-coordinate for record B; configure `Strategies.Dedupe.byTopPosition()`.

**Observed:** expected `[A, B]`, actual `[A]`.

**Cause:** [dedupe.ts](src/strategies/dedupe.ts) keys `boundingBox().y`, which is viewport position, not stable record identity or logical content offset. Recycling virtualizers naturally reuse it.

**Action:** document the strategy's restricted applicability and guide consumers toward stable identity keys. If logical-position dedupe is needed, express content-offset calculation through a strategy/context; do not invent framework-specific core math. Rewrite the current unchanged-DOM dedupe test, which ElementTracker alone can satisfy.

### U7 — Horizontal header discovery loses order and early columns when starting scrolled (P1)

Tracked: [#517](https://github.com/rickcedwhat/playwright-smart-table/issues/517).

**Trigger:** an eight-column virtualized header starts at horizontal offset 400; scan with 300 px steps and a three-column rendered window.

**Observed:** expected `['0','1','2','3','4','5','6','7']`; actual `['4','5','6','3','7']`.

**Cause:** [headerScroll.ts](src/utils/headerScroll.ts) seeds the Set before resetting the scroller and does not collect at offset 0 before stepping right. Initial encounter order becomes column-map order. RDG's independent scanner needs the same lifecycle review.

**Action:** normalize the start, wait, and collect the first window before advancing; verify complete ordered headers and name-to-cell mappings from nonzero starting positions. Keep the fix in discovery strategies. Do not quietly deduplicate duplicate labels that the mapper should reject or transform.

### U8 — Lazy initialization skips starting-page detection permanently (P1)

Tracked: [#518](https://github.com/rickcedwhat/playwright-smart-table/issues/518).

**Trigger:** `detectCurrentPage()` would return index 2; call `findRow()` before explicit `init()`, then call `init()`.

**Observed:** the detector ran zero times; table and returned row were labeled page 0.

**Cause:** `_autoInit()` and RowFinder initialize only the header mapper. Explicit `init()` then returns early because that mapper is initialized, bypassing detection and other initialization checks.

**Action:** centralize initialization state and validation across async public entry points, keeping synchronous `get*` semantics. Test fresh-table `findRow`, `findRows`, `map`, and `countRows` on a nonzero starting page, then later explicit `init()`. Avoid merely documenting an implicit requirement that consumers must call `init()` first when these APIs auto-initialize.

### U9 — Missing index attributes are parsed as valid zeroes (P2)

Tracked: [#519](https://github.com/rickcedwhat/playwright-smart-table/issues/519).

**Trigger:** visible rows/cells exist but all lack the configured index attribute.

**Observed:** dataAttribute row and column ranges returned `{ first: 0, last: 0 }` with no missing-attribute diagnostic.

**Cause:** [viewport.ts](src/strategies/viewport.ts) calls `Number(getAttribute(...))`; `Number(null)` and `Number('')` are 0. The unit test injects `_validCount: 0` rather than executing the browser parser, so it verifies an unreachable diagnostic branch for this case. This extends the previously closed [#410](https://github.com/rickcedwhat/playwright-smart-table/issues/410).

**Action:** validate attribute presence and nonempty numeric content before conversion, respecting valid zero and offsets. Test absent, empty, malformed, and mixed-valid DOM attributes. Choose an explicit unknown-range/diagnostic policy rather than silently treating missing metadata as row 0.

## UPSTREAM PLAYWRIGHT OPPORTUNITIES 🚀

Reviewed official releases v1.56.1–v1.64.0, published October 2025–October 2026, plus v1.56.0 as the boundary release. Installed lockfile/runtime version for validation: 1.63.0; dev range: `^1.59.1`; optional peer range: `^1.40.0`. Latest reviewed release is 1.64.0 (2026-10-07). Recommendations below are proposals, not claims of compatibility already tested.

| Release / official source | Relevance and proposed action |
|---|---|
| [1.64.0](https://github.com/microsoft/playwright/releases/tag/v1.64.0) | `Locator.within()` resolves positional locators separately inside each parent. Prototype row-scoped column/filter resolution with parity checks for function selectors, custom `getCellLocator`, and sparse column indices. Retain the older path. Test `--shuffle` can expose order dependencies after a dev-only upgrade. |
| [1.63.0](https://github.com/microsoft/playwright/releases/tag/v1.63.0) | `locator.visible()` can improve optional hidden-node filtering. Playwright visibility does not establish intersection with a scroll viewport, so it cannot replace geometry oracles. `ariaSnapshotJSON()` and richer trace snapshots can support opt-in diagnostics under #387. |
| [1.62.0](https://github.com/microsoft/playwright/releases/tag/v1.62.0) | Native action `scroll: 'none'` is still relevant to #486; `autoScroll: false` does not suppress native Locator action scrolling. AbortSignal support provides the next layer for #509 after existing between-operation checks. Native `locator.waitForFunction()` integration is already shipped in #508; improve remaining lifecycle gaps rather than reimplementing it. |
| [1.60.0](https://github.com/microsoft/playwright/releases/tag/v1.60.0) | Aria snapshot bounding boxes and highlight styling can help debug identity/navigation errors without creating a second table engine. Removed APIs include `Locator.ariaRef()` and old binding/logger/video options; no audited library path depended on those removals. |
| [1.59.0](https://github.com/microsoft/playwright/releases/tag/v1.59.0) | Snapshot depth/mode, normalized locators, and locator picking offer tooling improvements. They are optional inspector/example capabilities, not prerequisites for normal reads. |
| [1.58.0](https://github.com/microsoft/playwright/releases/tag/v1.58.0), [1.57.0](https://github.com/microsoft/playwright/releases/tag/v1.57.0) | Removed `_react`/`_vue`/`:light` selectors and `Page.accessibility` are not used in audited core paths. `locator.description()` supports preserving existing diagnostic labels; that implementation already exists. Hover-sensitive editors may benefit from action movement steps in consumer config/examples. |

**Compatibility and engine review:** 1.64 changes emulated screen forwarding and visibility inside hidden iframes; rerun preset fixtures after upgrading dev tooling. 1.57 changed Chromium distribution to Chrome for Testing; 1.63 also applies it on Linux arm64 and drops Ubuntu 20.04. These are test-environment considerations, not reasons to increase the library peer floor without evidence. See the linked release notes for platform details.

Feature-detect new methods such as `within`, `visible`, and `waitForFunction`. New options on existing methods (`signal`, `scroll`) require an explicit compatibility policy; checking whether `.click` exists cannot establish option support. Keep native public Locators, allow callers to supply action options where supported, and extend strategies rather than monkey-patching every Locator action. Add packed consumer/type/runtime smoke on actual peer 1.40.x and current Playwright; mocked absent-method tests do not prove minimum-peer compatibility. Existing TS 5/6 packaging checks validate TypeScript compatibility, not the Playwright version matrix.

## TEST AUDIT

All **81 files** were read: 40 unit files and 41 browser spec files. CI-A runs 33 core/local spec files, CI-B five preset integration files; two live-site files and the optional performance file are excluded from those runs. [Full inventory and overlap decisions](docs/audits/2026-10-11-test-inventory.md).

### Redundant Tests

These recommendations require selection before editing tests. A unit test and a browser integration test are not redundant merely because they touch the same API: keep distinct contract, DOM, and preset guarantees.

| Test file / name | Duplicates or weakness | Recommendation |
|---|---|---|
| `unit/mapColumn.unit.test.ts`, especially “throws when…” / “includes fuzzy suggestions…” | Locally recreated wrapper/error code, not public mapColumn; real extraction is exercised in functional/read-context specs and error helper coverage. | Replace with public-wrapper tests; cut locally manufactured guards. Preserve a direct custom-read/options/error forwarding test. |
| `dedupe-strategy.spec.ts`, “byTopPosition handles duplicate rows” | Unchanged DOM is already suppressed by ElementTracker; no distinct recycled record at the same y. | Rewrite around U6. |
| `integration/virtualized-horizontal-dedupe.spec.ts`, sequential and parallel cases | Appends all rows up front and reads the first column; does not demonstrate the advertised offscreen-column navigation or repeated identity. | Replace with actual incremental scroll, far-column read, and duplicate-key assertions; reduce the duplicate preloaded case. |
| `functional-methods.spec.ts`, the two successful countRows/reset cases | Same page fixture and count path with reset state/hook checks split. | Merge exact count, restored page, and hook-count assertions. |
| `integration/rdg.spec.ts` / `rdg-2d.spec.ts`, header discovery | Same header strategy/fixture assertions. | Share or parameterize discovery checks; retain distinct 2D viewport and recovery tests. |
| `debug-mode.spec.ts`, uniform/granular init delay | Fake-clock unit tests establish delays; browser wall-clock thresholds can be satisfied partly by normal header readiness. | Keep one public wiring smoke; move timing guarantees to deterministic clocks. |
| `unit/rowFinder.barrier.test.ts`, shared-barrier propagation | Confirms an internal shape that leads to U2; synchronized runMap test only proves owned batches. | Replace propagation-only success with detached public-read completion tests; retain barrier utility tests. |

### Missing Tests

| Feature / gap | Why important | Suggested test |
|---|---|---|
| U1: identity disappears during contentReady | Silent wrong-record output is worse than a clear rejection. | Mutate index while awaiting readiness; assert recover original or reject, never replacement values, live/atomic. |
| U2: individually consumed synchronized findRows | Consumers normally await one returned row at a time. | Single row, sequential rows, subsets, repeated reads, unequal selected columns, callback errors; bounded completion. |
| U3: mounted position vs absolute index | Existing getRowByIndex tests exercise cell access/navigation but omit snapshot reads. | Window beginning at 100; live and atomic snapshot of mounted position 0; recycle during read. |
| U4: pending loading predicates | Settled booleans do not establish timeout bounds. | Fake-clock first/later pending row/cell/header predicates, every timeout policy, timer cleanup, original errors. |
| U5: viewport cache lifecycle | Static fixtures hide stale membership after UI updates. | Change visible positions between operations; reset, revalidate, sort, external scroll; exact identities. |
| U6: dedupe under slot reuse | Viewport coordinates repeat across distinct records. | Recycle one DOM slot A→B at fixed y; collect both with an appropriate key; define byTopPosition limitations. |
| U7: nonzero initial horizontal scroll | Header map order determines every later column read. | Start scrolled; complete ordered headers; exact name-to-cell mapping; duplicate labels and handle cleanup. |
| U8: lazy init on nonzero page | Explicit-init tests do not cover public auto-init paths. | All async entry points then explicit init; one consistent detector/validation lifecycle. |
| U9: real browser attribute parsing | Injected `_validCount` bypasses the faulty conversion. | Missing/empty/malformed/mixed attributes; valid zero and offsets; observable diagnostic/range policy. |
| B1/B2: narrow API inconsistencies | Existing shortcut and synthetic tests miss alternate entry paths. | Same-page navigation with no goToPage; synthetic chaining parity across getValue/toJSON/order/columns. |
| Parallel execution and stop semantics | Sorted output alone also passes sequential execution; filter stop test accepts 2–3 rows. | Use controlled start/release gates for concurrency; assert exact stop-boundary records. |
| Loading and collection assertions | Cell-loading success can be preempted by table-loading; ≥100 plus endpoints permits missing middle IDs. | Isolate cell predicate from table readiness; assert exact ordered unique IDs 1–100. |
| Dedupe callback outcome | “does not burn key” checks only result length, permitting `[null]`. Null is not the documented skip sentinel. | Assert actual values and use the documented skip contract; rename if only characterizing null behavior. |
| Minimum optional peer and current upstream | Absent-method mocks and latest-peer package install do not test the promised floor. | Packed consumer at 1.40.x and current peer with type/runtime/browser smoke and fallback readiness. |
| Real Grafana reproduction | Faithful fixtures pass but #417 is still open for the actual environment. | Revalidate captured production selectors/row membership and sorted identity sets; do not add a live service to blocking PR CI. |

Additional naming/assertion cleanup: rename playground's one-page “fetch rows with infinite scroll” case to describe the initial batch; the optional 10,000-row performance test seeks the final row and should not claim it proves iteration of every record. The second viewport “synchronized mode” browser case does not explicitly request synchronized concurrency; tighten its configuration and assert the promised navigation calls and exact membership.

## SUMMARY

- **Overall health: 6.5/10.** Architecture and baseline validation are strong; reproduced silent-data errors and hangs limit confidence in virtualized/lifecycle operations.
- **Philosophy alignment: 8.5/10.** Keep fixes generic and strategy-first. Do not reverse the recent engine separation.
- **Top three priorities:**
  1. Restore row identity guarantees: U1 and U3, with focused browser regressions.
  2. Remove detached barrier deadlocks: U2, while preserving owned synchronized batches.
  3. Unify bounded readiness and initialization/cache lifecycle: U4, U5, and U8. Then address header discovery, dedupe semantics, and attribute parsing.

Previous audit issues #473–#479 and upstream #485/#487/#488 are closed and now checked off in ROADMAP. #480, #486, #509, and production Grafana #417 remain open. WIP PR #157 was left untouched. New findings are linked under the next roadmap batch.

### Actions for selection

Recommended first implementation: U1 + U3 as a focused snapshot-identity PR, then U2. Select any test cuts/merges and new regression tests before modifying the suite. For upstream work, prioritize the existing #509/#486 requirements; prototype `within()` only after correctness and a real peer compatibility smoke are in place. This audit changes report/roadmap documentation only; it does not implement library or test fixes.
