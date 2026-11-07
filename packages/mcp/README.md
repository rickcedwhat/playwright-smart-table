# MCP inspection bench — milestone 0

Development baseline on `feat/108-mcp-revival`; not a released MCP package.
Both workspace packages are private. The library's public API and npm files remain
unchanged. Run commands below from the repository root.

## Clean checkout

Use Node 24 (package minimum: 22.12) and the root-declared pnpm 10.33.2.

```sh
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm mcp:build
pnpm mcp:dev
```

On Linux CI, use `pnpm exec playwright install --with-deps chromium`.
Open http://127.0.0.1:6274. The URL field starts with a local MUI-shaped fixture;
click **Run inspection**. The server is http://127.0.0.1:3001/mcp, with `/health`
and `/fixtures/mui-datagrid` routes. The UI proxies these routes to the loopback
server, so no permissive CORS setup is needed. These are development services,
not a production hosting setup. Keep both ports free; Ctrl+C stops both children.
The launcher does not kill existing listeners or silently switch ports.

For a local MCP host, launch `node packages/mcp/dist/index.js` from the repository
root; it defaults to stdio. No API key, dotenv file, or provider access is required.
Transport/library dependencies are frozen in pnpm-lock.yaml; the baseline was
verified with SDK 1.32.2, Zod 4.6.7, Playwright 1.64.1 and Node 26.8.1 locally.
CI uses Node 24. SDK v1's supported registerTool schemas replace the old bypass;
stdio and Streamable HTTP replace the old custom SSE plumbing. MCP transport
sessions here are stateless; persistent browser sessions belong to milestone 1.

## Checks

```sh
pnpm mcp:build
pnpm mcp:test
pnpm mcp:test-ui
pnpm run build
pnpm run test:unit
pnpm run fallow
```

Stop the running bench before `mcp:test-ui`, which launches and cleans up its own
services on 3001/6274. Tests refuse occupied ports. `mcp:test` runs 12 recovered
fingerprint tests and a real stdio client against local browser fixtures: discovery,
schema rejection, successful inspection, ambiguous roots, missing selector timeout,
and recovery. `mcp:test-ui` exercises the real UI → HTTP MCP → browser path and
checks findings, visible errors, retry and browser console errors. The dedicated
MCP workflow runs these build/test commands on workspace changes.

## Honest baseline scope

`inspect_table` accepts an HTTP(S) URL, optional `tableSelector`, and a per-operation
`timeoutMs` (100–30000, default 10000). It opens an isolated temporary browser,
observes one table and closes it in finally. Supply a selector when multiple table
roots match. It never falls back silently to inspecting the entire document.

Findings include mounted row count, declared root row count, sampled headers/rows,
and the recovered preset fingerprint as a **hypothesis**. Its weighted confidence
field is a heuristic score, not a calibrated probability. Root signals are included.
Class/signal sampling is capped at 2000 descendants and marked when truncated;
header and row text samples are bounded, not a complete extraction.

There are no model calls, generated configs, pagination actions, persistent browser
sessions, authentication UI, validated virtualization/identity/readiness decisions,
or completeness guarantees yet. Timeouts are per operation, not a shared run budget;
request cancellation and closing an in-flight run need milestone 1 work. The old
comparison UI/provider/picker experiments remain in PR #157 for deliberate recovery.
Do not treat an observed count or full fingerprint score as a successful table config.

## Recovery inventory from PR #157

- **Retained/reworked:** weighted preset detector and its 12 tests; MUI-shaped fixture;
  DOM signal collection (root included, ambiguous roots fail); temporary Chromium
  ownership; React inspection bench and result/error presentation.
- **Replaced:** schema bypasses, stdout monkeypatches and custom SSE plumbing with
  supported SDK schemas, clean stdio and loopback Streamable HTTP. Startup now owns
  its child processes instead of killing listeners by port.
- **Deferred to contracts/workflow milestones:** old config generator (outdated API
  names/imports), all-in-one tool, pagination/virtualization inference, loading stubs,
  interactive picker and authenticated/persistent sessions. Unsupported tools are
  not advertised in the baseline.
- **Preserved for later bench work:** provider/model discovery, dual-model comparison,
  richer code viewer/styling and run-state preferences. These remain in the old branch;
  they were not silently dropped from the roadmap or presented as working here.
- **Excluded:** persisted `.mcp-state.json`, dotenv/secrets, scratch scripts and
  accidental `.claude/worktrees` gitlinks. No old lockfile or old main was merged.

Continue with milestone 1 in `.agents/plans/mcp-inspector.md`: evidence/session
contracts, fixture answer keys, tool boundaries, cancellation and config execution.
