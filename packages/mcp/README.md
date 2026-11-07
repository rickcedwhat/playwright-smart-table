# MCP inspection bench — milestones 0–1

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
CI uses Node 24. Native SDK schemas replace the old bypass. Both stdio and stateful
Streamable HTTP now own isolated browser sessions; see CONTRACTS.md for lifetime,
budgets, cancellation and ownership details.

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
services on 3001/6274. Tests refuse occupied ports. `mcp:test` runs detector,
contract and evaluator unit tests plus real stdio browser checks
for discovery, schemas, evidence revisions, budgets, cancellation, expiry, session
limits and recovery. `mcp:test-ui` also exercises stateful HTTP ownership, native
cancellation, real fixture navigation, oracle separation and editable UI comparisons.
The MCP workflow runs both paths. `test:http` is an internal subpackage check requiring
the running bench; normally let `mcp:test-ui` start and clean up the services.

## Use the bench

Select Plain, Paginated, Later page or Broken Next, then **Run inspection**. Repeated
inspection reuses that owned browser until closed, expired or cancelled; changing the
target URL opens a new one. **Close browser session** releases it. **Cancel inspection**
sends MCP cancellation. Reload the bench if the MCP connection itself expires.

For benchmark fixtures, **Compare with fixture** assesses the editable submission.
Try removing a record or changing a value, or asserting `complete`. The comparison
shows concrete differences and unsupported claims. It never reports a config as
validated. The paginated fixture intentionally returns only the current mounted page;
a partial observation is not a complete scan. IDs distinguish the two visible Alice
copies; text dedupe would incorrectly collapse them.

The API is now `open_session` → `inspect_table({ sessionId, ... })` → `close_session`.
The milestone-0 one-shot URL signature has changed on this unreleased branch. No model
calls, generated config execution, pagination probes, authenticated session import,
or completeness guarantees are implemented. Mapped records use an explicitly limited
positional DOM assumption and are withheld for detected inconsistent layouts.

See `CONTRACTS.md` for executable schema locations, exact limits, the independent
answer-key boundary, comparison semantics and implementation decisions. The next
milestone implements the structure/pagination workflow and trusted config execution.

## Recovery inventory from PR #157

- **Retained/reworked:** weighted preset detector and its 12 tests; MUI-shaped fixture;
  DOM signal collection (root included, ambiguous roots fail); owned Chromium
  lifecycle (persistent sessions added in milestone 1); React inspection bench and result/error presentation.
- **Replaced:** schema bypasses, stdout monkeypatches and custom SSE plumbing with
  supported SDK schemas, clean stdio and loopback Streamable HTTP. Startup now owns
  its child processes instead of killing listeners by port.
- **Deferred to contracts/workflow milestones:** old config generator (outdated API
  names/imports), all-in-one tool, pagination/virtualization inference, loading stubs,
  interactive picker and authenticated browser import. Persistent owned sessions
  are now implemented; unsupported tools are not advertised.
- **Preserved for later bench work:** provider/model discovery, dual-model comparison,
  richer code viewer/styling and run-state preferences. These remain in the old branch;
  they were not silently dropped from the roadmap or presented as working here.
- **Excluded:** persisted `.mcp-state.json`, dotenv/secrets, scratch scripts and
  accidental `.claude/worktrees` gitlinks. No old lockfile or old main was merged.

Continue with milestone 2 in `.agents/plans/mcp-inspector.md`: investigation
playbooks, validated config proposals and a trusted consumer execution harness.
