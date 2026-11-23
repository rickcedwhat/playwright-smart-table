# MCP inspection bench — milestone 4 started

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
The server is http://127.0.0.1:3001/mcp; `/health` reports milestone 3. Ports must be
free; `MCP_PORT` changes the server, proxy and fixture targets together. Ctrl+C stops owned children without killing anyone else's listeners.
For a local MCP host, use the absolute-path stdio launcher below.
No API key or model access is required for inspection, probes or config execution.
The UI calls the same tools via stateful Streamable HTTP and proxies bench routes.

`mcp:prepare` builds and packs the current library into an immutable external temporary
archive, resolves a separate consumer lockfile and warms the pnpm cache. This setup
step may access the registry. Each validation then performs a frozen offline install
with lifecycle scripts disabled in a new temporary consumer outside this checkout.
The prepared absolute pnpm store path is passed explicitly, so MCP hosts that strip
environment variables still use the warmed cache. The archive, manifest and dist checksums prevent silently testing a stale build.
Rerun preparation after changing the root manifest/dist or clearing temporary files.
Local `.mcp-state.json` points to the prepared archive; never commit this generated state.

## Local host setup (Antigravity)

Prepare/build the checkout as above, then generate a machine-specific config:

```sh
node packages/mcp/host.mjs --config
```

Merge the returned `smart-table-dev` entry into `mcpServers` in Antigravity's
`~/.gemini/config/mcp_config.json`. Preserve other entries. The desktop UI's
**Customizations → Installed → MCP Servers → Copy Config File Path** confirms the
active path. Restart Antigravity if the list stays stale after a window refresh.
The initial desktop check on 2026-11-23 required a full app restart.
The optional workspace config `.agents/mcp_config.json` is for workspace-aware
surfaces such as the CLI; it was not sufficient for this desktop server list.
[Antigravity's MCP documentation](https://antigravity.google/docs/mcp) describes
configuration, timeouts and lazy tool loading.

The generator prints JSON only and never writes host settings. Its absolute Node
and launcher paths work from an unrelated working directory; its explicit PATH
keeps pnpm available in a GUI environment. No credentials or other environment
variables are copied into the config. Regenerate after moving the checkout or
changing the Node/pnpm installation. Generated local config is ignored by Git.
The launcher neither downloads packages nor silently rebuilds the checkout; missing
builds/runtime dependencies fail on stderr with setup instructions. Stdout is MCP
protocol only. Current host checks cover macOS/Linux, not Windows.

Confirm **smart-table-dev → 9 tools enabled** without sending a chat prompt.
Startup instructions explain the workflow and boundaries. The read-only
`get_investigation_guide` tool exposes the same versioned playbooks as the three
resources/prompts, so resource/prompt UI support is not required to retrieve them.
Antigravity's cached schemas and `instructions.md` confirm discovery, not that an
agent read/followed guidance or invoked tools correctly.

```sh
pnpm mcp:test-host
```

This deterministic SDK check launches the exact generated command from an unrelated
working directory, discovers tools/guidance, compares tool/resource/prompt contents,
validates native and later-page tables with the packed library, closes sessions and
reconnects. The local transcript is `.mcp-runs/host-installation.json`. It is a
regression test, **not an Antigravity agent run or model-quality result**. Desktop
verification is separately recorded in the plan checkpoint.

Sessions remain isolated and unauthenticated; a host's browser login is not inherited.
Auth/session import, representative real-site trials, model usefulness comparisons,
publication and pilot readiness remain future work. Keep model runs deferred.
Remove only `smart-table-dev` from the host config and restart it to uninstall the
local connection; the checkout and unrelated servers are unaffected.

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
Spans, general 2D virtualization, identity-ambiguous rows and auth import remain
unsupported. The constrained vertical-grid extension is described below. Labels cannot guarantee application-side effects; use controlled targets.
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


## Milestone 3: recycling grids and honest limits

Select **Recycling grid — stable IDs** or **start at row 9** in the bench. Run
inspection, inspect virtualization, propose, probe navigation and validate. The
fixture retains six DOM row elements while representing twenty records. The
installed consumer must extract the exact twenty IDs/values, including two Alice/Ops
occurrences, rewind from a nonzero position and reset. The bench independently scores
that execution. Mounted-node counts and declared row counts are never substitutes.

`inspect_virtualization` is read-only and separates mounted/visible rows, declared
metadata, ID candidates, readiness and unsupported layouts. `probe_virtualization`
scrolls only the proposed viewport and attempts restoration within the shared budget.
Grid proposals require session/state evidence. Sorting or state changes require a
new proposal; a fresh consumer unable to recreate that state fails before config
execution. Overlapping windows must preserve ID/index/value continuity. Only the
visited scope is tested; metadata and dataset-revision tokens are application claims.

Current supported grid contract is deliberately narrow: the top-level DOM grid is
its own vertical viewport, fixed row height, complete unique headers/field indices,
nonempty ID candidates, explicit busy/readiness and dataset revision. It composes
existing Pagination.infiniteScroll, Viewport.dataAttribute, resolveRowIndex and dedupe
strategies. No library-core special cases or public API changes were introduced.
The UI declares ten forward windows/twenty actions for grid checks; lesser budgets
return partial coverage. The default workflow budget remains unchanged.

Adversarial fixtures exercise missing/repeated/page-local IDs, identical-looking
records without IDs, overscan, delayed/never-ready windows, nonzero scroll, sorting,
mid-scan revisions, contradictory indices, pinned duplicate headers, filler cells,
unmounted columns and horizontal overflow. Frames, shadow-root tables and canvas-only
content explicitly remain unsupported. The hostile-text fixture checks the bounded
tools' scroll-only behavior; it is not a model prompt-injection evaluation.

No-ID records retain unknown identity. Logical positions are observed metadata; the
current strategy does not upgrade them into global record keys. This is a supported-
scope decision, not a claim that every future position-based approach is impossible.
The independent scorer counts valid repeated occurrences rather than collapsing them.

Model runs remain deferred. Existing scripted harness checks are still deterministic
regressions only; no model/provider calls or quality baselines were added.


## Reading the bench UI

Investigation controls and results sit side by side in the main body. Before an
investigation, only the target form is shown. Inspection reveals follow-up actions
and result tabs, with one highlighted next action. Generated code is shown first;
internal proposal editing is collapsed. Snapshot is the initial rendered view, Config is a proposal, Navigation
is a bounded probe, and Results contains the executed run's verdict. A registered
fixture pass is explicitly labeled **Config passed this fixture**. Runtime-only
custom-target checks and partial runs have different verdicts. Raw evidence is
collapsed by default (generated code starts expanded) and can be copied without expanding them.

Results includes a copyable run summary with the verdict, record count and fixture
comparison. The optional Scorer lab is under Advanced and compares an editable initial-row submission. Its results
never clear or replace the config verdict. Target changes and reinspection clear
previous results; proposal edits clear downstream checks. Closing the browser retains
results for review/copying while disabling actions that need the session.
