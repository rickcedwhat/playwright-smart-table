# MCP inspection bench — milestones 0–2

Private development packages on `feat/108-mcp-revival`, not a published MCP release.
The root library runtime, public APIs and version are unchanged.

## Clean checkout

Use Node 24 (minimum 22.12) and root-declared pnpm 10.33.2:

```sh
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm mcp:prepare
pnpm mcp:build
pnpm mcp:dev
```

On Linux CI install browsers with `--with-deps chromium`. Open http://127.0.0.1:6274.
The server is http://127.0.0.1:3001/mcp; `/health` reports milestone 2. Ports must be
free; `MCP_PORT` changes the server, proxy and fixture targets together. Ctrl+C stops owned children without killing anyone else's listeners.
For a local MCP host, run `node packages/mcp/dist/index.js` from the repo root (stdio).
No API key or model access is required for inspection, probes or config execution.
The UI calls the same tools via stateful Streamable HTTP and proxies bench routes.

`mcp:prepare` builds and packs the current library into an immutable external temporary
archive, resolves a separate consumer lockfile and warms the pnpm cache. This setup
step may access the registry. Each validation then performs a frozen offline install
with lifecycle scripts disabled in a new temporary consumer outside this checkout.
The archive, manifest and dist checksums prevent silently testing a stale build.
Rerun preparation after changing the root manifest/dist or clearing temporary files.
Local `.mcp-state.json` points to the prepared archive; never commit this generated state.

## Bench workflow

Select **Plain**, **Paginated**, **Later page** or **Broken Next**, then:

1. **Run inspection**: mounted DOM evidence only; preset scores remain hypotheses.
2. **Propose config**: review constrained selector JSON and generated current-API code.
3. **Probe pagination**: explicitly test Next/Previous with bounded actions and
   best-effort restoration. A later-page probe starts at that page.
4. **Validate config**: compile and execute the proposal in the disposable installed
   consumer. Check init, a representative multi-row query, extraction, rewind/reset,
   start/end records, termination, library checksum and actual resolved package path.
5. **Independent fixture check**: the bench compares a server-produced execution
   witness with its private answer key. Only this comparison can report this fixture
   config validated. Runtime success alone is not a membership/completeness oracle.

Two Alice/Ops rows have different IDs and both must survive. A page limit with Next
still enabled is partial; a Next click that does not change rows fails. Later-page
validation rewinds before scanning. Validation uses a fresh unauthenticated browser;
normal execution leaves the original inspection browser unchanged. Cancellation or
timeout invalidates its session and terminates owned consumer processes.

**Compare with fixture** remains a separate editable, submitted-data-only experiment.
Remove a record or change a value to test the scorer. This route always reports
`configValidated: false`; submitted JSON cannot forge a trusted execution witness.
Custom URLs have no assumed answer key. **Close browser session** releases the browser;
reload the bench if its MCP connection expires.

Current config/probe support: flat native HTML tables with unique nonempty headers,
consistent cells, nonempty page-unique `data-id` candidates and explicit native
Next/Previous buttons outside forms. Selectors are hypotheses, not universal rules.
Spans, virtualization, async readiness, identity-ambiguous rows and auth import remain
unsupported. Labels cannot guarantee application-side effects; use controlled targets.
No arbitrary JavaScript is accepted. See `CONTRACTS.md` for exact scopes and budgets.

## Checks and replay artifacts

```sh
pnpm mcp:build
pnpm mcp:test
pnpm mcp:test-ui
pnpm run fallow
```

Run preparation first. Stop the running bench before `mcp:test-ui`, which owns its
3001/6274 services and refuses occupied ports. Tests cover unit rules, real stdio,
stateful HTTP ownership, native cancellation, expiry/cleanup, closing-browser capacity, shutdown races, disposable-consumer
execution, later-page rewind, duplicates, limits, broken controls and a holdout
inventory fixture with different selectors/data. The UI exercises proposal/probe/
validation and independent comparison as well as editable-submission guards.

`mcp:test` includes a **scripted harness self-test**, not an agent-quality baseline.
Workflow transcripts and baseline artifacts are saved under ignored `.mcp-runs/`;
CI uploads these on success or failure. The standalone `consumer/runner.mts` is
intentionally excluded from checkout-level fallow resolution: its generated config
module and installed library are resolved and type-checked in the real consumer.

## Agent baseline — opt-in, model runs deferred

```sh
pnpm mcp:baseline --plan
pnpm mcp:baseline --self-test
```

The model baseline is prepared but deferred at the user's request. See
`evaluations/README.md` for the provider-neutral JSON adapter contract and run setup.
There are four scenarios × guided/unguided × five fresh runs = 40 planned runs.
Each receives equal aggregate budgets and only MCP tools; guided runs explicitly load
the registered prompts. The independent oracle is compared only after the final
answer and never sent back to the adapter. No provider key is inferred and no model
request occurs without explicit adapter/model configuration.

## Recovery inventory from PR #157

- Retained/reworked: weighted preset detector and 12 tests, MUI-shaped fixture,
  bounded DOM collection, owned Chromium lifecycle and React bench.
- Replaced: schema bypasses/stdout monkeypatches/custom SSE with SDK schemas and
  stdio/stateful Streamable HTTP; stale generator with constrained current-API code.
- Implemented since recovery: persistent sessions, structure/pagination guidance,
  bounded probes, independent scoring and disposable installed-package execution.
- Deferred/preserved in the old branch: picker, auth import, provider discovery,
  dual-model comparison, richer viewer/preferences and virtualization experiments.
- Excluded: old persisted secrets/state, scratch scripts and accidental gitlinks.

The original draft #157 remains unchanged. Draft #547 carries the revival. Progress,
acceptance and deferred work live in `.agents/plans/mcp-inspector.md`.
