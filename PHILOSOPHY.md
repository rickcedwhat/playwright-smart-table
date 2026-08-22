# Library Philosophy

> **The guiding light for Playwright Smart Table.**
> Re-read this when proposing features, reviewing PRs, or running a GBU audit.
> If the library drifts from these principles, the drift is the bug — not the principles.

---

## One-sentence mission

**The library teaches itself how *your* table works — it does not invent a universal table model and force every app into it.**

Users describe structure and behavior through config and pluggable strategies. The core orchestrates row finding, iteration, and cell access. Variation lives at the edges.

---

## The North Star: Describe, Don't Encode

Tables in the wild differ wildly: button pagination, infinite scroll, MUI DataGrid virtualization, custom editors, recycled DOM nodes. Encoding every variant into `useTable.ts` would make the core an ever-growing special-case machine.

Instead:

1. **Describe** where headers, rows, and cells live (selectors / transformers).
2. **Describe** how the table moves (pagination, viewport, loading, sorting, fill, …) via **strategies**.
3. **Reuse** those descriptions as **presets** when a whole library family repeats (MUI, RDG, Glide).

The docs already frame this as *[Describe Your Table](docs/guide/describe/index.md)*. That framing is intentional — keep it.

```text
┌─────────────────────────────────────────────────────────┐
│  Core (thin): init, map headers, find/iterate, SmartRow │
│                                                         │
│  Strategies (pluggable): pagination, loading, viewport, │
│  sorting, fill, headers, dedupe, contentReady, …        │
│                                                         │
│  Presets (optional packs): spread into config for known │
│  libraries — never hardcode those libs into the core    │
└─────────────────────────────────────────────────────────┘
```

---

## Principles

### 1. Strategy-first configuration

Anything that varies by table framework or DOM shape belongs in `src/strategies/` (or a user-supplied strategy), not in core control flow.

| Put it here | Not here |
|---|---|
| New pagination / loading / viewport behavior → strategy factory | `if (isMui) { ... }` inside `useTable.ts` |
| Official convenience for a library → `src/presets/` | Built-in knowledge of AgGrid/MUI/etc. in the engine |
| User-specific quirk → their config / custom strategy | A new core API “just for this one app” |

**Litmus:** Can a consumer achieve the same outcome by composing strategies without a library release? If yes, prefer that path over growing the core.

### 2. Keep the core thin

`useTable` is an orchestrator: map structure, apply filters, advance pages, return Playwright locators. It should not accumulate framework-specific branches.

- Prefer adding a strategy hook over adding a config boolean that secretly embeds behavior.
- Prefer composing existing hooks over inventing parallel code paths.
- If a change requires touching both the engine *and* inventing a one-off concept that only one table type needs, stop and redesign as a strategy.

### 3. Stay close to Playwright

Return `Locator` (and thin wrappers like `SmartRow` that still expose the locator). Do not reimplement click/fill/expect. Locators stay lazy and auto-waiting; extracting text too early throws that power away.

`get*` vs `find*` follows Playwright’s mental model: sync/local vs async/searching.

### 4. Reader of the DOM, not a store

The table reflects what is on screen. Cache only structural metadata (header maps, pagination position flags). Data values are read fresh. When the UI moves, strategies say *how* to wait and navigate — the core does not invent a shadow data model.

### 5. Scope stops at the table boundary

In scope: headers, rows, cells, in-table controls (sort, pagination next to the table, viewport scroll).

Out of scope: global search bars, app routing, visual regression, pure-canvas grids with no DOM. See also [ROADMAP.md](ROADMAP.md) non-goals.

### 6. Real use cases over theoretical completeness

Ship what production tests need. Prefer a small, reliable primitive a strategy can build on over a kitchen-sink API. Practicality and stability beat covering every hypothetical table.

### 7. Stability of the public surface

Do not break the `useTable(locator, config)` signature. Extend through config, strategies, and presets. Deprecate with a path; remove on major versions — don’t silently rewrite meaning.

### 8. Fail helpful, log intentionally

Errors should name the missing column, ambiguous row, or invalid strategy and point toward a fix. Use `logDebug()` — never ad-hoc `console.log` in library code.

---

## What “plugin-able” means here

- **Strategies** — single-concern functions/factories the engine calls at well-defined points (`pagination`, `loading`, `viewport`, `contentReady`, …).
- **Presets** — named bundles of selectors + strategies for popular libraries. They are *configuration*, not new engines.
- **Column overrides** — per-column read/write without a global fill rewrite.

A preset that only works because the core special-cases that library by name is a philosophy violation, even if tests pass.

---

## Decision checklist (use on every non-trivial change)

Before merging a feature or filing “just one more option”:

1. **Describe or encode?** Does this let users describe their table, or does it hardcode one table’s behavior into the core?
2. **Strategy or core?** If it varies by DOM/framework, is it a new/extended strategy rather than a branch in `useTable` / `rowFinder`?
3. **Playwright-native?** Do public APIs still return locators (or thin locator-preserving wrappers)?
4. **Scope?** Is this still about the table and its direct controls?
5. **Necessity?** Is this driven by a real test pain, or speculative completeness?
6. **Surface area?** Can we avoid a breaking change to `useTable`?
7. **Removability?** If this idea is wrong later, can we delete a strategy/preset without gutting the engine?

If you answer “encode / core branch / custom wrapper / out of scope / speculative / breaking / fused into engine” — redesign before shipping.

---

## Anti-patterns (smell test)

- Growing `useTable.ts` with framework-specific conditionals
- New public methods that wrap a single Playwright call (`clickCell`, `hoverRow`, …)
- Config flags that are really hidden strategies (`useVirtualMuiMode: true`)
- Caching cell text “for performance” across navigations
- Teaching the core about a CSS class from one design system
- APIs that only make sense for one preset and are useless for plain HTML tables

---

## How we use this document

| Cadence | How |
|---|---|
| **PR review** | Run the decision checklist on non-trivial changes |
| **GBU reports** (`/gbu`) | Score the library against this philosophy; call out drift as Bad/Ugly |
| **Roadmap** | Prefer items that deepen strategy/preset power over core complexity |
| **Agent work** | Agents treat this file as constraints, same as `AGENTS.md` |

When philosophy and convenience conflict, **philosophy wins**. Convenience belongs in presets and docs examples.

---

## Related reading

- Practical contributor rules: [CONTRIBUTING.md](CONTRIBUTING.md) (Design Philosophy + Development Guidelines)
- Agent constraints: [AGENTS.md](AGENTS.md)
- User-facing “describe your table” flow: [docs/guide/describe/](docs/guide/describe/index.md)
- Explicit non-goals: [ROADMAP.md](ROADMAP.md)
- Strategy API reference: [docs/api/strategies.md](docs/api/strategies.md)
