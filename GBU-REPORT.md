# GBU Report - playwright-smart-table v6.25.0

Generated: 2026-11-01 (America/New_York)

Audited: main at `da9fcc26039b1a74707ca5c59aa9e216763139eb` (after #529). The package version is still 6.25.0; everything below the 6.25.0 heading in CHANGELOG is unreleased. Previous report: [2026-10-11](https://github.com/rickcedwhat/playwright-smart-table/blob/4d4c252c9c256a7b58cd69799dc86e4d328b7de1/GBU-REPORT.md).

**Bottom line.** Seven of the nine October defects are fixed and re-verified, with no framework branches added to the core. None of those fixes has shipped: npm still serves 6.25.0. The audit found two new P1s, both silent or blocking: atomic snapshots mislabel columns on column-virtualized grids, and the #529 header fix breaks tables with a sticky first column. All four newly opened `investigate:` issues (#533–#536) reproduce. Release the backlog once #530 lands, then fix the new P1s before adding API.

## Scope and validation

Read AGENTS.md, CLAUDE.md, .cursorrules, PHILOSOPHY.md, ROADMAP.md, and the [GBU workflow](.agents/workflows/gbu.md). Reviewed exports, types, `useTable.ts`, `smartRow.ts`, every engine module, the changed strategies/presets, CHANGELOG `[Unreleased]`, the 39-file diff since the last audit (25 source/test files), and all open issues and PRs. Full probe scripts and raw output: [2026-11-01 reproductions](docs/audits/2026-11-01-reproductions.md).

| Check | Result |
|---|---|
| `pnpm run build` | Passed; generators produced no tracked changes |
| `pnpm run fallow` | Passed; no issues |
| `pnpm run test:unit` | 42 files, 465 tests passed |
| `pnpm run docs:build` | Passed (including this report's evidence file) |
| CI-A / CI-B browser suites | **Not run locally.** Playwright 1.64.0 needs Chromium build 1248, which isn't installed here, and installing it was out of scope. Evidence instead: [#529](https://github.com/rickcedwhat/playwright-smart-table/pull/529) (now `da9fcc26`) passed "Unit + Core Tests" and "Integration Tests" in GitHub Actions; its PR reports 301 core + 19 integration, retries disabled. |
| Regression probes (Oct findings) | 14 probes re-run against `dist` with local Chrome; results below |
| New probes | 13 probes covering #533–#536 and audit candidates; all results reproduced on a second run |

The unit run still prints an unhandled `ECONNREFUSED ::1:3000` from a child process after the `viewport-data-attribute` tests. No unit test references port 3000; origin still unknown (log hygiene, not a demonstrated library failure).

### Status of 2026-10-11 findings

| Finding | Issue | Status on `da9fcc26` |
|---|---|---|
| U1 atomic snapshot reads replacement row | #511 | **Fixed** — rejects, never returns `WRONG-ROW-9` |
| U2 detached synchronized `findRows` deadlock | #512 | **Fixed** — single read settles |
| U3 render-window index vs logical identity | #513 | **Fixed** — live and atomic read row 100 |
| U4 unbounded loading predicates | #514 | **Fixed** — row, cell, header all time out at 50 ms |
| U5 viewport cache lifetime | #515 | **Fixed** — revalidate/reset see `[A, B]` |
| U6 `byTopPosition` slot reuse | #516 | **Deprecated, behavior kept** (#525) — still returns `[A]`; JSDoc/docs only, no runtime warning |
| U7 header discovery from nonzero scroll | #517 | **Fixed** (#529) — but see new U2 regression |
| U8 lazy init skips page detection | #518 | **Open on main** — fix in [#530](https://github.com/rickcedwhat/playwright-smart-table/pull/530), all checks green |
| U9 missing index attributes → 0 | #519 | **Open** — still `{first: 0, last: 0}`, no diagnostic |
| B1 same-page `bringIntoView` paginates | — | **Open** — `goToFirst` still called once |
| B2 synthetic chaining parity | — | **Open** — `getValue` rejects, `toJSON` allows |

## PHILOSOPHY ALIGNMENT 🧭

Reference: [PHILOSOPHY.md](PHILOSOPHY.md).

| Principle | Assessment | Score |
|---|---|---|
| Describe, don't encode | Fixes landed in shared engines (`deadline.ts`, `memoizeViewport.ts`, `headerScroll.ts`) with no framework checks. RDG lost 63 lines by adopting shared discovery. | 9/10 |
| Strategy-first | Variation still at the edges. The sticky-header regression is a *shared* strategy assuming stable geometry; fix it in the strategy, not the mapper. | 9/10 |
| Keep the core thin | `useTable.ts` 705 → 648 lines. Still four identical iteration-environment literals (six near-copies counting `countRows`/`findRowByIndex`) and four separate cell-resolution paths (B5). | 8/10 |
| Stay close to Playwright | Locators everywhere; native `describe()`/`waitForFunction` with fallbacks. `mapColumn<R>` promises a conversion Playwright never performs (#536). | 8/10 |
| Reader of DOM, not a store | Viewport cache now scoped per operation — a real improvement. But `reset()` writes page 0 into metadata without checking the DOM (#533). | 7/10 |
| Scope stops at table boundary | Unchanged; generic strategies scoped to root. | 9/10 |
| Real use cases | New issues are evidence-first `investigate:` tickets with validation steps — good discipline. #532 (agent skills) is tooling, not runtime scope creep. | 9/10 |
| Stable surface; helpful failures | Deprecation-with-path for `byTopPosition` is textbook. Against that: atomic reads mislabel columns silently, ambiguous-row errors show non-matching samples, and regex filters silently drop rows. | 6/10 |

**Alignment: 8.5/10** (unchanged). No checklist failures in merged work; the drift is correctness at strategy/engine contracts, not encoded framework knowledge. Decision-checklist note for upcoming fixes: do not special-case MUI/RDG inside `readRowAtomic`, and do not fix sticky headers in `TableMapper` by de-duplicating names (that would undo #529's correct handling of genuinely duplicate labels).

## THE GOOD ✅

- **Fast, disciplined remediation.** #521–#525 and #529 closed seven P1s in about two weeks (Oct 11–24), each in a focused PR whose new browser cases failed on the old code. Re-running the October probes confirms the fixes in a fresh environment.
- **Lifecycle logic moved into shared primitives.** `withinDeadline` bounds every loading predicate; `memoizeViewport` scopes geometry to one navigation; `scrollAndCollectHeaders` serves generic, Glide and RDG. These are exactly the "small reliable primitive" PHILOSOPHY asks for.
- **Compatibility-first deprecation.** `byTopPosition` kept its behavior, gained a JSDoc deprecation, and the docs/agent guide now steer to stable record keys. Principle 7 followed precisely.
- **Duplicate header labels now reach validation.** Position-keyed discovery no longer silently merges two real columns that share a label; `headerTransformer` can rename them.
- **Evidence-first issue intake.** #533–#536 each state preconditions, expected behavior, and a validation test. All four reproduced on the first attempt, so they can be promoted directly to `fix:`.
- **Hygiene holds.** Fallow clean, generators idempotent, 465 unit tests, `rowFinder.barrier.test.ts` (which asserted the deadlock-causing shape) removed as recommended.

## THE BAD ⚠️

### B1 — Seven P1 fixes are unreleased

CHANGELOG `[Unreleased]` contains #511–#517 plus AbortSignal and `ContentReady.until`; npm `latest` is 6.25.0 (2026-10-10). Users are still exposed to wrong-row snapshots, deadlocks and unbounded waits. **Action:** merge #530, then `pnpm version minor` → 6.26.0 (new public options make this a minor). Consider whether U1/U2 below should block or follow.

### B2 — Ambiguous-row errors show rows that don't match (P2, new)

`RowFinder.throwIfAmbiguous()` builds sample rows with `makeSmartRow(rows[i], map, 0, …)`. With a `resolveRowIndex` strategy, `toJSON()` sees index 0 ≠ the row's real index, "recovers" logical row 0, and prints its data. Probe: matches are two `Dup` rows; the error lists `{"Name":"Alice"}` twice. **Action:** pass the resolved index (or `undefined`) for samples. Test: ambiguous match with a numeric resolver asserts samples contain only matching values.

### B3 — Dedupe results depend on concurrency mode; callbacks cannot signal "bad read" (P2, new; relates to #526, #535)

Two simultaneous rows with the same key: `sequential` returns `[X, Y]`, `parallel` and `synchronized` return `[X, X, Y]`. The only record of this is a unit-test comment ("known trade-off"); public docs say only "already-seen keys are skipped". Separately, #535 is confirmed: the test title says the later `alice` row must survive, while the assertion expects it skipped. Row callbacks have no public skip/invalid signal, because `SKIP` is module-private. **Action:** as #526's first deliverable, define one rule for co-occurring equal keys across all modes and document it. Then rename or rewrite the #535 test to match whichever contract is chosen. Do not add a public skip sentinel until #526 decides whether one is warranted.

### B4 — `mapColumn<R>` promises unconverted values (P2, #536 confirmed)

`mapColumn<number>('Count')` type-checks as `number[]` and returns `["42"]` (`typeof` → `string`). **Action (non-breaking):** add an overload that infers `R` from a `columnOverrides[col].read` or an explicit mapper, and mark the bare generic form deprecated in JSDoc for v7. Add a `tsd`/`expectTypeOf` check.

### B5 — Cell resolution is implemented four ways (core thinness)

`resolveCellLocator` (filters, override filters), `cellIn` in `rowSnapshot.ts` (live reads), `getValue`'s override `getCell` (`cellSelector.nth()` — **ignores `getCellLocator`**), and atomic `snapshot.cells[idx]` (ignores it too; see U1). Divergent paths are why U1 exists. **Action:** route every sibling/cell lookup through `resolveCellLocator`. Collapse the four identical iteration-environment literals in `useTable.ts` (iterator, `forEach`, `map`, `filter`) into one factory at the same time; this is a mechanical change.

### B6 — Carry-overs and documentation drift

- October B1 (same-page `bringIntoView` without `goToPage` calls `goToFirst`) and B2 (synthetic chaining parity) still reproduce and have no issues filed.
- `src/types.ts:857` still says synchronized mode has "serial actions"; `runMap` runs callbacks concurrently.
- CLAUDE.md still says "`RowFinder` has its own pagination loop"; it uses `scanPages`.
- `.cursorrules` still says Claude Code uses worktrees; AGENTS.md says both agents use branches in the main worktree.
- ROADMAP's completed `reset()` entry documents the order `onReset` → `goToFirst` → clear; the code runs `goToFirst` → clear → re-init → `onReset` (see closed #404).
- `byTopPosition` deprecation has no runtime signal; consider a one-time `logDebug` warning (not `console.warn`, to avoid CI noise).

## THE UGLY 🚨

### U1 — Atomic `toJSON` mislabels columns when `getCellLocator` is configured (P1, new)

**Trigger:** any grid where DOM cell order ≠ header index: column virtualization, filler or pinned cells. `getCellLocator` exists precisely for these, and the MUI DataGrid, RDG and Glide presets all set it.

**Observed:** six headers A–F, only D–F mounted (`aria-colindex` 4–6). Live `toJSON({columns:['D','E','F']})` → `{D:'d1', E:'e1', F:'f1'}`. Atomic same columns → `{}`. Atomic all columns → `{A:'d1', B:'e1', C:'f1'}`, i.e. wrong data under wrong names with no error.

**Cause:** `readRowAtomic()` indexes `snapshot.cells[idx]` by header position and ignores `strategies.getCellLocator`; the existing test "skips fake columns that exceed DOM cell count" codifies silent omission.

**Action:** fail loudly first: when `getCellLocator` is set, or the clone's cell count doesn't match the map, throw a clear error for atomic reads (or for missing columns). Then design a strategy-level hook for mapping cloned cells to columns, e.g. reading a configurable column-index attribute inside the same `evaluate`. MUI's `getCellLocator` resolves via `root` + `data-rowindex`, so it cannot simply be re-run against an off-screen clone; keep this generic. Tests: column-virtualized atomic read, filler cell before first column, MUI DataGrid integration atomic read.

### U2 — Sticky first header breaks `init()` after #529 (P1 blocked operation, regression)

**Trigger:** `Strategies.Header.horizontalScroll` on a table whose pinned/sticky header has no `aria-colindex`.

**Observed:** `init()` throws `Duplicate column names found: "Name"`. The same table with `aria-colindex` maps all eight columns correctly. Before #529, discovery de-duplicated by label, so this layout worked.

**Cause:** unindexed headers are keyed by content-space x (`rect.left + scrollLeft`). A sticky header's viewport x is constant, so its content-space x changes every step and it is collected once per window.

**Action:** in `scrollAndCollectHeaders`, recognize the same element across windows (e.g. sticky/fixed computed position, or constant viewport x across steps) and key it once, while still letting genuinely duplicate labels through to mapper validation. Tests: sticky left, sticky right, both, with and without `aria-colindex`; plus the existing duplicate-label cases.

### U3 — `reset()`, `countRows()` and `toArray()` record page 0 without rewinding (P1, #533 confirmed)

**Trigger:** paginated table with no `goToFirst`, or a `goToFirst` returning `false`.

**Observed:** after `findRow({Name:'C'})` + `reset()`, the DOM shows page 3 while `currentPageIndex` is 0, and a row found on page 3 reports `tablePageIndex: 0`. The same desync follows every `countRows()` and `toArray()` call, because both call `reset()` in `finally`. A later `bringIntoView()` then plans from the wrong page.

**Action:** separate cache reset from navigation; set the page index to 0 only after `goToFirst` returns truthy. Otherwise keep the last known index and log (or detect via `detectCurrentPage`). Coordinate with #530, which already rewrites init/reset lifecycle state: land #530 first, then fix #533 on top of it.

### U4 — Global/sticky RegExp filters drop rows and mutate the caller's regex (P2, #534 confirmed)

**Observed:** three identical `Active` rows, override/synthetic column filter `/Active/g` or `/y`: first `findRows` → 2, second → 1, `countRows` → 2; caller's `lastIndex` left at 6. DOM-column filters (Playwright `getByText`) correctly return 3.

**Action:** in `RowFinder.matchReadValue`, test against a stateless copy (`new RegExp(re.source, re.flags.replace(/[gy]/g, ''))`) or reset `lastIndex` around each test. This is a one-line fix plus a parameterized test over `'' | g | y` on both paths.

### Still open from October

- **#518** lazy init skips page detection: fixed in #530, checks green; merge it.
- **#519** missing index attributes parsed as 0: unchanged, no PR.

## Newly opened issues — assessment

| Issue | Verdict | Recommendation |
|---|---|---|
| [#533](https://github.com/rickcedwhat/playwright-smart-table/issues/533) reset without rewind | **Reproduced**, broader than filed (`countRows`, `toArray`) | Relabel `fix:` P1 (U3); after #530 |
| [#534](https://github.com/rickcedwhat/playwright-smart-table/issues/534) g/y RegExp | **Reproduced** | Relabel `fix:` P2 (U4); quick win |
| [#535](https://github.com/rickcedwhat/playwright-smart-table/issues/535) test title vs assertion | **Confirmed** | Fold into #526's contract decision (B3) |
| [#536](https://github.com/rickcedwhat/playwright-smart-table/issues/536) `mapColumn<R>` | **Reproduced** (runtime `string`) | Non-breaking overload + deprecation (B4) |
| [#526](https://github.com/rickcedwhat/playwright-smart-table/issues/526) duplicate-looking occurrences | Valid; new evidence: results already differ by concurrency mode | Start by unifying/documenting co-occurrence semantics; likely doc-first outcome per its own deliverable 4 |
| [#532](https://github.com/rickcedwhat/playwright-smart-table/issues/532) packaged agent skills | Philosophy-compatible (teaches "describe your table"; no runtime change) | Defer until U1–U3 ship so the skill doesn't encode known-broken behavior (atomic on virtualized grids, sticky headers). Pilot as plain `SKILL.md` added to `files`; evaluate Intent afterwards. |

## UPSTREAM PLAYWRIGHT OPPORTUNITIES 🚀

- **Releases reviewed:** v1.64.1 (2026-10-14) is the only release since the last audit. It contains two bug fixes (Electron first window; a Chromium 155+ CORS redirect abort with routes registered), neither of which affects this library. Upstream release notes on `main` have no 1.65 section yet. Dependabot [#531](https://github.com/rickcedwhat/playwright-smart-table/pull/531) bumps dev Playwright to 1.64.1.
- **Still-unused opportunities from 1.62–1.64** (no change in recommendation):
  - `Locator.within()` (1.64): candidate for row-scoped cell resolution. Prototype only *after* B5 consolidates cell resolution, so there's one place to adopt it.
  - `locator.visible()` (1.63): optional hidden-node filtering; it does not replace viewport geometry oracles.
  - `scroll: 'none'` action option (1.62): still the substance of #486.
  - Action `signal` (1.62): still #509, the follow-up after scan-level AbortSignal (#507).
- **Already adopted:** `locator.describe()` (with fallback) and `locator.waitForFunction()` in `ContentReady.until` (with polling fallback).
- **Compatibility:** optional peer stays `^1.40.0`. Keep feature detection for new methods. New *options* on existing methods (`scroll`, `signal`) need an explicit policy because method-existence checks can't prove option support. A packed-consumer smoke on real 1.40.x is still missing (carried from the last report).

## TEST AUDIT

Inventory: 41 unit files and 45 browser spec files (37 top-level, 8 integration). Changes since the [2026-10-11 inventory](docs/audits/2026-10-11-test-inventory.md): added `findrows-independent-reads`, `header-discovery-order`, `loading-deadlines` (spec + unit), `viewport-cache-lifecycle`, `unit/viewport-cache`, `unit/smartRowArray`; rewrote `dedupe-strategy`; extended `tojson-row-stable`; removed `unit/rowFinder.barrier`. The October U1–U7 "missing test" rows are now covered.

### Redundant tests

| Test file / name | Duplicates | Recommendation |
|---|---|---|
| `unit/mapColumn.unit.test.ts` | Still exercises locally recreated guards rather than `table.mapColumn()` (carried from October) | Replace with public-API tests; fold into the #536 type/runtime test |
| `integration/rdg.spec.ts` / `rdg-2d.spec.ts` header discovery | Now also covered by `header-discovery-order.spec.ts` (RDG case, offset 400, 30+ steps) | Keep one RDG discovery assertion in integration; drop the duplicate |
| `tojson-row-stable.spec.ts` "skips fake columns that exceed DOM cell count" | Codifies silent omission that hides U1 | Rewrite to the chosen loud-failure contract |
| `unit/dedupe-after-callback.test.ts` case 2 | Contradicts its own title (#535) | Rename/rewrite after the B3 contract decision |

### Missing tests

| Feature | Why important | Suggested test |
|---|---|---|
| Atomic read with `getCellLocator` / column virtualization (U1) | Silent wrong-column data | Fixture with D–F mounted; atomic must equal live or throw; MUI DataGrid atomic read |
| Sticky/pinned headers in horizontal discovery (U2) | Blocks `init()` | Sticky left/right, with/without `aria-colindex`; duplicates still rejected |
| `reset`/`countRows`/`toArray` without working `goToFirst` (U3) | Desyncs path planning | Start on page 3; assert DOM page and `currentPageIndex` agree after each |
| RegExp `g`/`y` on override and synthetic filters (U4) | Silent row loss | 3 identical values; repeated `findRows`/`countRows`; caller `lastIndex` unchanged |
| Ambiguous-row error samples with resolver (B2) | Misleading diagnostics | Samples contain only matching rows |
| Dedupe of co-occurring equal keys across modes (B3) | Mode-dependent results | Same fixture, all three modes, one documented result |
| `mapColumn` typing (B4) | Type lies | `expectTypeOf` + runtime `typeof` |
| `getValue` override `getCell` with `getCellLocator` (B5) | Sibling read hits wrong cell | Column-virtualized row; override reads sibling via `getCell` |
| October B1/B2, #519 | Still reproduce | As specified in the previous report |
| Minimum-peer packed smoke (1.40.x) | Fallback paths unproven | Carried from October |

## SUMMARY

- **Overall health: 7/10** (up from 6.5). The October P1 backlog is largely fixed and verified. Two new P1s, one of them a regression, plus an unreleased backlog keep it from scoring higher.
- **Philosophy alignment: 8.5/10.** Fixes stayed generic. Remaining drift is contract consistency (cell resolution, page metadata, dedupe semantics), not framework encoding.
- **Top three priorities:**
  1. **Ship what's fixed:** merge #530, release 6.26.0. Optionally include the #534 one-liner.
  2. **Remove the two new P1s:** atomic reads with `getCellLocator` (U1, fail loudly first) and the sticky-header regression (U2). Consolidating cell resolution (B5) makes U1's real fix one change.
  3. **Make page metadata truthful:** #533 (U3) on top of #530, then #519.

This audit changed only report, reproduction and roadmap documentation. No library or test code was modified.
