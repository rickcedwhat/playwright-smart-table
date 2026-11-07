# MCP inspector revival plan

Status: milestones 0 and 1 locally complete; milestone 2 is next. CI/review status is tracked in the revival PR.
Tracking: #108. Existing experiment: draft PR #157 (`feat/mcp-custom-inspector-wip`).
Related: #532 (packaged guidance), #526 (identity information limits).

This replaces the earlier model-first plan. Preserve its experiments in Git history
and PR #157. This file is the source of truth for scope, acceptance, decisions and
progress; update it as implementation proceeds.

## Goal

Given a real table, help an agent produce a working playwright-smart-table config
and show evidence for what was tested, what was covered and what remains unknown.
A config remains a proposal until executed. Compilation, a successful click, or a
plausible row count alone does not establish correctness.

The workflow is connect → inspect → propose → execute → compare. The inspector UI
is the maintainer's evaluation bench for this workflow, including manual corrections,
replayable failures and model comparisons. Keep it as a first-class development tool.

## Development approach

- Use a dedicated feature branch and small checkpoint commits. Milestones need not
  each become a release or merge; extended experimentation on the branch is fine.
- Start the revival from current main and selectively recover useful PR #157 code.
  Preserve the old branch until every component has a retain/rework/defer decision.
- Keep inspection/framework knowledge in MCP modules and library strategies/presets;
  keep the library core thin and public Locators intact.
- Verify current APIs rather than copying old generated imports, API names or SDK
  workarounds. Preserve normal library packaging/release behavior.
- Record the library build under test. #545's atomic-layout guard is merged to main;
  a merge does not prove npm consumers have it. Do not advertise unreleased behavior
  as a released guarantee.

## Architecture

The host agent selects investigations and interprets evidence. Its MCP client calls
our server. The server manages browser sessions, executes probes, validates inputs
and returns structured findings. The UI exercises the same server capabilities;
it must not maintain a second inspection implementation.

Independent investigation modules:

- Structure/selectors: candidate roots, headers, rows, cells and table ambiguity.
- Presets: supporting/contradictory framework evidence, followed by preset trials.
- Pagination: controls, page position, movement, stopping and rewind behavior.
- Virtualization: mounting/recycling, logical indices and X/Y scroll behavior.
- Identity: candidate keys, missing values, collisions and continuity limitations.
- Readiness: loading transitions, wait conditions and timeouts.

Each module owns a playbook, observation code, bounded probes, result schema and
fixtures. Share session/evidence contracts, not module implementations. Dependencies
are explicit: pagination can verify movement without proving unique identity or
complete membership.

Use prose for investigation guidance and executable checks for measurable claims.
Playbooks may become MCP prompts/resources and packaged skills from one maintained
source. Registration does not prove a host loaded or followed them; test that path.
Keep tool descriptions small and precise.

Keep the exposed MCP surface small. Session open/close, selected-aspect inspection,
explicit probes and config validation are candidate capabilities; settle names and
granularity using a real client. Verify current SDK/protocol and transport conventions
rather than preserving the old compatibility bypasses.

Core inspection/validation must work without a provider API key. Embedded model calls
and dual-model comparison remain useful bench experiments. Make provider orchestration
replaceable and measure its benefit before requiring it for consumers.

## Evidence, state and execution boundaries

A finding includes its value, status, evidence, tested scope, contradictions/limits
and the session/state where it was obtained. Use observed, tested, hypothesis, unknown
and unsupported explicitly. Tested means within the recorded scope, not universally
proven. Heuristic scores must explain their calculation, not imply calibrated odds.

Distinguish navigation completion, identity and dataset completeness. Budget exhaustion
means partial coverage. Record starting/ending position, actions, termination reason,
coverage limits and restoration outcome. Successful navigation is not a completeness
oracle; sampled ID uniqueness is not proof of global uniqueness.

Use persistent, bounded sessions with isolated browser contexts, expiry, explicit
close, stale-session errors and cleanup on failure/cancellation. Recheck or invalidate
evidence after navigation, sorting, filtering or dataset changes. Start with owned
contexts and storage-state auth; evaluate existing-browser attachment separately.
Test local login/session reuse automatically; real SSO/MFA remains a manual case.

Separate observation from clicking/scrolling probes. Declare allowed actions and
limits on time, actions, pages and output. Return useful partial evidence on timeout
or cancellation. Restoration is best effort and must be reported. Initial probes
exclude record editing/deletion and unrelated application controls.

DOM content and generated code are untrusted. Page text cannot redefine instructions
or action scope. Validate configs before bounded execution and define the execution
boundary in milestone 1. Never log credentials/storage state or implicitly send page
snapshots to a model provider. Record redaction/truncation as missing evidence.

## How we test it

1. Module tests: finding rules, negative evidence, schemas and uncertainty handling.
2. Browser fixtures: actual observation/probe behavior against controlled tables.
3. Protocol tests: a real MCP client/server round trip, tool discovery, malformed
   inputs, errors, session isolation, cancellation and cleanup—not just handler calls.
4. Agent evaluations: task → tools → proposed config → execution → independent scoring.

Versioned fixture manifests provide the answer key: expected record occurrences,
values, order rules, navigation behavior and supported claims. Keep this oracle out
of the inspected DOM and agent context. Compare membership, multiplicity and values,
not only counts or distinct text. Identity-ambiguous fixtures require honest limits.

Save fixture/seed, task, playbook/tool versions, library build, SDK/browser,
provider/model/settings, tool transcript, evidence, config, execution outcome,
termination reason, elapsed time and available cost/token figures. Do not fabricate
missing cost data. Retain failures as replayable cases and regression tests.

Make deterministic unit/browser/protocol checks blocking in CI once implemented.
Initially run model evaluations explicitly rather than as flaky PR gates. Start with
five fresh runs per scenario/model configuration, reporting raw outcomes/denominators;
this is a baseline, not statistical confidence. Set agent thresholds and budgets after
the first baseline, before comparing improvements. Keep holdout fixtures so evaluation
cannot be passed by hardcoding benchmark selectors. Reset state and budgets equally
when comparing models or guidance variants.

## Milestones and exit criteria

### 0. Recover a runnable baseline

- [x] Inventory PR #157: retain/rework/defer server, probes, generator, auth, UI,
  model comparison, tests, scratch files and accidental worktree gitlinks.
- [x] Create the revival branch from main; recover useful work selectively.
- [x] Verify dependencies, SDK schemas/transport and remove input-validation bypasses.
- [x] Establish clean install/build/server/UI commands and exercise a protocol call.

Exit: a clean checkout can launch the bench, call the real server and show findings
or actionable errors. Record broken/unsupported parts instead of marking them complete.

### 1. Establish contracts and an independent answer key

- [x] Define session/evidence/finding/action-budget/validation schemas.
- [x] Decide initial tools, protocol/transport, browser ownership, config execution
  boundary and cancellation semantics; record rationale in the decision log.
- [x] Add plain, button-paginated and broken-navigation fixtures. Include a later-page
  start and valid duplicate-looking records with stable IDs.
- [x] Wire evaluation and UI comparison without leaking the oracle to the agent.

Exit: the evaluator catches missing/extra records, collapsed duplicates, wrong values,
ineffective Next controls and unsupported claims independently of a model.

### 2. Complete the first reliable workflow

- [ ] Implement structure/pagination playbooks, observations and bounded probes.
- [ ] Produce configs using current APIs; type-check and execute against an installed
  packed library in a disposable consumer outside this checkout.
- [ ] Verify init, representative queries, full supported traversal and truthful
  starting-page/rewind reporting. A partial scan cannot be called complete.
- [ ] Test malformed input, isolation, timeout/cancellation and browser cleanup.
- [ ] Record agent baselines with and without guidance under equal budgets.

Exit: supported deterministic cases match exact expected records/multiplicity and
values; negative cases report useful failures/limits. Save/review every false success.
A screenshot of plausible output is not acceptance evidence.

### 3. Challenge virtualization and identity

- [ ] Add a recycling grid with stable IDs; assert exact membership and column values.
- [ ] Add identical-looking records without identity evidence; require uncertainty.
- [ ] Exercise pinned/duplicate headers, filler/off-screen columns, nonzero scroll,
  repeated/missing/page-local IDs, overscan and delayed readiness.
- [ ] Exercise sorting/data changes and contradictory metadata; reject stale claims.
- [ ] Evaluate frames, shadow DOM and canvas-only content; state unsupported cases.
- [ ] Exercise hostile page text and misleading controls within the probe action scope.

Exit: known-data cases satisfy their oracle; ambiguous cases do not claim verified
identity/completeness. Reproduce new library bugs separately rather than hiding them
behind inspector-specific workarounds.

### 4. Evaluate usefulness and prepare an opt-in pilot

- [ ] Compare host-led and optional embedded-model variants in the same UI using equal
  fixtures, tasks, reset state and budgets. Measure success, false success, time/cost.
- [ ] Try representative real tables with ground truth where available. Label other
  runs exploratory, not benchmark passes.
- [ ] Test package installation, browser setup, auth/session reuse and real host discovery.
- [ ] Reconcile shared playbooks with #532: plain skills versus Intent, version matching,
  source references and opt-in loading without duplicated guidance.
- [ ] Document supported scope, results, limits, data handling and separate MCP versioning.

Exit: deterministic gates and agreed agent/holdout thresholds pass; no unexplained
false successes remain in the release suite. Pilot publication is a separate decision,
not an automatic milestone action.

## Checkpoints and decision log

After each milestone, update checkboxes and append a dated checkpoint with commit/run
IDs, evidence paths, passed/failed cases, remaining uncertainty, scope changes and the
next smallest experiment. Mark partial work partial and preserve failed cases.

For each decision record the question, chosen approach, rationale, supporting evidence
and what would cause reconsideration. Outstanding first decisions are in milestone 1;
proposed interfaces, session approach and five-run baseline may change with evidence.

Revisit the plan after milestone 2, before another framework/provider, and before a
release decision. Before expanding scope, require a measured task benefit, correctness
fix or evaluation improvement; otherwise defer it.

Do not promise universal dedupe/completeness, redesign library APIs for the inspector,
auto-install hooks, distribute contributor workflows as consumer guidance, or make
third-party website uptime a blocking CI dependency.

### 2026-11-06 checkpoint — milestone 0

Branch: `feat/108-mcp-revival`. Baseline implementation: `95e6b8cd` (from main
`38c70b22`, with #545 and this plan merged). The original PR #157 is unchanged.

Recovery decisions and repeatable commands are in `packages/mcp/README.md`. The
server uses SDK 1.32.2/Zod 4.6.7, real schemas, stdio and loopback Streamable HTTP.
The UI uses the same server tool. No provider key or implicit model request is needed.

Local evidence: frozen install and builds passed; 12 recovered detector tests passed
after correcting four stale equal-weight expectations to the existing weighted
contract; real stdio discovery/validation/browser/error/recovery smoke passed; real
UI → HTTP MCP → Chromium inspection/error/retry smoke passed. A fresh source snapshot
without node_modules also passed frozen install, builds and both smoke paths. Root
build, 465 unit tests, fallow and snippet validation passed. A packed library tarball
contained root dist and excluded the new workspace packages. CI coverage is defined
in `.github/workflows/mcp-check.yml`; CI results are not asserted by this local record.

The UI has been visually inspected at 1280×850. Its fixture reports 3 mounted rows
and a declared count of 50 without claiming traversal completeness. Preset scores
are explicitly hypotheses, not verified configs or calibrated probabilities.

Remaining limitations: temporary browsers per call, per-operation rather than shared
run deadlines, no cancellation/session/auth contract, no generated configs, no
validated pagination/virtualization/identity/readiness, and no model comparison yet.
The old picker/provider/comparison experiments remain available for later recovery.
No agent-quality benchmark or real-MUI preset validation is claimed at this stage.

Next smallest experiment: milestone 1 session/evidence/tool contracts plus controlled
plain and paginated fixtures with evaluator-only answer keys. Keep the bench running
on this feature branch while those contracts are designed and tested.

### 2026-11-06 checkpoint — milestone 1

Branch: `feat/108-mcp-revival`, draft PR #547. Implementation: `902a89b5`, with
custom-target comparison guard `600a6608`. The original draft PR #157 is unchanged.
Contracts and decisions are recorded in `packages/mcp/CONTRACTS.md`; repeatable
commands and current limitations are in `packages/mcp/README.md`.

The MCP exposes open/inspect/close tools with isolated, connection-owned browser
sessions, expiry, bounded read-only observations, revision-scoped evidence and
native cancellation. Both stdio and stateful Streamable HTTP are exercised.
Observation results report mounted data and hypotheses without asserting identity,
full traversal or config validity. Ambiguous column layouts withhold mapped records.

Controlled fixtures cover plain tables, working/broken button navigation, later-page
starts and duplicate-looking records with stable IDs. A separately authored answer
key checks missing/extra/repeated records, wrong values, ineffective navigation and
unsupported completeness claims. The UI compares submitted data only, labels config
validation false, prevents stale comparisons and offers automatic comparison only
for exact registered fixture URLs. The answer key is absent from the MCP tool surface
and fixture HTML; a blind agent evaluation must additionally restrict access to local
files and the privileged bench comparator. This is not a sandbox against arbitrary
agent filesystem/network tools.

Local evidence: 21 MCP unit tests, real stdio contract/browser smoke, HTTP ownership/
cancellation/fixture checks and UI comparison/error/retry checks passed. A fresh
source snapshot passed frozen install, both builds and both smoke paths. The final
custom-target guard passed the UI/HTTP suite again. Root build, 465 library unit tests
and fallow passed; no library runtime or version change was made. The running bench
was visually inspected. CI/review results remain separately tracked in PR #547.

Budgets are per call, not shared across an agent task; observation action/page limits
are currently zero/one. Browser cleanup is awaited rather than a hard real-time SLA.
No generated config execution, model quality baseline, verified pagination traversal,
virtualization or arbitrary-site authentication support is claimed.

Next: milestone 2 structure/pagination guidance and bounded probes, then current-API
config generation validated by a trusted disposable installed-package consumer.
Only that runner can support stronger config/traversal claims.
