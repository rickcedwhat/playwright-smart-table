# Maintainer TODO

Local sequencing and scratch work — **not** a public roadmap. Prefer GitHub issues for trackable work.

## MCP server (IDE-agnostic table recon)

_Moved from closed GitHub issue [#27](https://github.com/rickcedwhat/playwright-smart-table/issues/27) (2026-03)._

**Problem:** `table-recon` flows lean on agentic browser control; other IDEs burn context on raw automation unless we expose high-level tools via MCP.

**Goal:** Package PST-style table introspection as an MCP server (e.g. `@rickcedwhat/pst-mcp-server`) so assistants get tools like `analyze_table`.

### Phase 1 — `analyze_table` (per #27)

- [ ] Create `mcp-server/` at repo root (`type: "module"`).
- [ ] Deps: `@modelcontextprotocol/sdk`, `playwright`, `typescript`.
- [ ] `Server` + `StdioServerTransport` (SDK stdio pattern).
- [ ] Single tool **`analyze_table`**: args `url` (required), `tableSelector` (optional, default `table, [role="grid"], .MuiDataGrid-root`).
- [ ] Handler: launch Chromium headless → navigate → wait for selector → DOM recon (row counts, virtualization hints, pagination) → close browser → return plain-text classification + recommended `useTable` / strategy hints.
- [ ] `package.json` **`bin`** → compiled JS for `npx` usage.
- [ ] README: Cursor / Claude Desktop `mcp.json` snippets.

### Phase 2 (later — not in #27)

- [ ] Iterative tools: e.g. `try_use_table_config`, `scroll_probe`, `export_config`, structured JSON diagnostics.
- [ ] Optional: CDP attach, headed / auth handoff.

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
