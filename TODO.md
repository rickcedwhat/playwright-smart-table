# Maintainer TODO

Local sequencing and scratch work — **not** a public roadmap. Prefer GitHub issues for trackable work.

## Virtual grids / Braintrust-style coverage

- [x] `braintrust` like coverage (impl in playground) -> solve scroll hazard with beforeRowRead or X-only column reveal for 2D virtual grids (see issue 47 + issue 46) + wrap getCell() with SmartCell (Locator + bringIntoView) #43 ([#43](https://github.com/rickcedwhat/playwright-smart-table/issues/43), [#46](https://github.com/rickcedwhat/playwright-smart-table/issues/46), [#47](https://github.com/rickcedwhat/playwright-smart-table/issues/47))
- [ ] `npm run apply` -> `npx @rickcedwhat/antigravity apply`? (review this)
- [ ] add `/new-table` workflow -> interactive wizard to setup a new table configuration in a project (like a CLI)s

**GitHub:** [#46](https://github.com/rickcedwhat/playwright-smart-table/issues/46) (docs hazard), [#47](https://github.com/rickcedwhat/playwright-smart-table/issues/47) (optional API). Split notes: [docs/internal/issue-45-split.md](docs/internal/issue-45-split.md).

## npmx / generated API docs

[npmx](https://npmx.com) builds an interactive Docs tab from exported TypeScript + TSDoc/JSDoc (similar in spirit to JSR). Complements README + VitePress without maintaining huge API tables by hand.

- [ ] **Review current package page on npmx** — Open `@rickcedwhat/playwright-smart-table` on npmx, skim the Docs tab for gaps (empty symbols, missing `@example`, noisy exports).
- [ ] **Prioritize improvements** — Usually: rich block on `useTable`, `@example` on hot types/strategies, `@internal` on anything that should not appear in public reference; align with existing `docs/api` where it helps.

First step is audit-in-browser; then decide what to change in source (`src/*.ts` JSDoc) vs what is already good enough.
