# Milestones 1–2 contracts and decisions

Executable schemas live in `src/contracts.ts`; runtime session ownership is in
`src/sessions.ts`. This is a private, experimental API on the revival branch.

## Tools and ownership

- `open_session({ url, timeoutMs? })` creates an isolated, server-owned Chromium
  browser with no inherited authentication state. HTTP(S) only; embedded credentials
  are rejected. Returns an opaque browser-session UUID, URL, revision zero and lease.
- `inspect_table({ sessionId, tableSelector?, budget? })` observes the existing page.
  It does not click, scroll, generate a config or assert full-dataset coverage.
- `close_session({ sessionId })` closes the browser, invalidates the handle and
  interrupts in-flight inspection. Repeating close waits for any in-flight cleanup and returns `closed: false`.

Browser handles belong to one MCP connection, not a global pool. HTTP uses the SDK's
stateful Streamable HTTP transport so requests, cancellation notifications and
browser ownership stay with the same client. Stdio has one manager per process.
Knowing a browser UUID from another connection does not grant access.

Limit: three browsers per MCP connection, including concurrent openings and closing browsers; eight HTTP
connections, including initialization reservations. Browser leases renew when an
operation starts and expire after five minutes without a new operation. Expiry is
checked at access and swept in the background. Idle HTTP connections also expire
after five minutes; clients must reinitialize (reload the bench). Terminating an
HTTP protocol session or shutting down stdio disposes its owned browsers.

## Evidence and lifecycle

Each inspection attempt increments a revision, including failed attempts. A successful
observation has a fresh evidence UUID, observation timestamp, URL, browser UUID and
revision. Findings reference that evidence and specify scope, status and limitations.
Previous observations remain historical evidence; they are not a current-state cache.
External app changes are not continuously monitored: re-inspect after any relevant
change. No stable-row identity or readiness claim follows from an attribute or sample.

Statuses are observed, tested, hypothesis, unknown and unsupported. The recovered
preset fingerprint remains a hypothesis with an explained weighted score, not a
calibrated probability or working config. Current coverage is always mounted-only
with `fullDatasetVerified: false`. Record IDs are candidates from `data-id`.

Column values use DOM order as an explicit assumption. Duplicate headers, cell-count
mismatch, or inconsistent `aria-colindex`/`data-field` metadata withhold mapped records
and set `layoutUnsupported`. This is not a general virtualized-grid resolver. Text,
row, header, element-signal and output truncation are explicitly reported.

## Budgets, cancellation and errors

Inspection defaults: 10000 ms, 100 rows, 32768 output bytes, zero actions, one page.
Accepted ranges: 100–30000 ms, 1–1000 rows, 4096–65536 output bytes. The output cap
covers the serialized successful MCP tool result, including text and structured
content; protocol framing/control errors are excluded. Trim whole records, never
JSON fragments, and use UTF-8 bytes rather than character counts. Oversized metadata
returns `OUTPUT_BUDGET` and can be retried with a larger limit.

One page/zero actions means a single mounted-page observation with no tool-issued
traversal. It does not block the application's own requests or redirects. These are
per-call budgets, not an aggregate agent-task allowance; the agent harness
accounts for calls, pages, time and cost across a whole task.

Opening and inspection each use a single deadline, rather than restarting a timeout
for every Playwright operation. MCP cancellation or expiry of a work deadline
invalidates the affected browser session and closes its browser; cleanup is awaited
and can add elapsed time. A busy session rejects concurrent inspection with
`SESSION_BUSY`; other sessions remain independent. Close can interrupt a busy session.
An abrupt lost network connection may require deadline/lease cleanup; it is not a
promise of instantaneous disconnect detection.

Tool errors include codes such as STALE_SESSION, SESSION_LIMIT, SESSION_BUSY,
TIME_BUDGET, CANCELLED, OUTPUT_BUDGET and INSPECTION_FAILED. Closed/expired/foreign
handles share a descriptive stale-session error. Invalid inputs are rejected by
native SDK/Zod schemas. No validation bypasses or arbitrary execution endpoints exist.

## Config execution boundary

Milestone 1 decision: do not execute model-generated JavaScript. The bench accepts
only a strict data submission (records, partial/complete claim, navigation summaries).
Unknown fields such as `code` are rejected. Milestone 2 now implements the constrained proposal and disposable runner below. Merely type-checking will not establish runtime success.

## Fixtures, oracles and evaluation

`plain`, `paginated`, and `broken-next` expose a six-person dataset; the first two
people have identical visible Name/Team values but distinct attribute IDs. Pagination
renders two records per page. `?page=1` starts on the second page. The broken fixture's
Next button receives clicks without moving. Only the current page's data is sent to
the browser, not an embedded JavaScript array of the full dataset.

The independent expected manifest is `tests/bench/people-oracle.json`. Its versioned
order policy currently ignores ordering; compare membership, multiplicity and exact
column values. The manifest is not produced from the fixture renderer, returned by
MCP, or served as a static file. The bench-only POST `/bench/evaluate` reports missing,
extra and repeated records, wrong values, ineffective navigation claims and unsupported
completeness claims. No MCP evaluation/oracle tool is advertised.

The UI only offers automatic comparison for an exact registered fixture URL; custom
targets have no assumed answer key. The privileged comparator still assesses submitted
data against an explicitly selected fixture, not the origin of that submission.

The result is `submitted-data-only`, always `configValidated: false`. Even exact data
does not authorize a complete-traversal claim without a trusted runner witness. The
bench can assess a manually corrupted submission to prove the evaluator catches it;
this is not evidence that a model produced that submission or that any config ran.

Oracle separation is an evaluation boundary, not protection against an agent with
arbitrary local filesystem/network access. Human comparison results can reveal expected
values. Blind agent runs must receive only the intended MCP tools and withhold bench
files/API/results; otherwise label the run exploratory, not blind. The milestone-2 trusted witness comparator below is separate from this data-only route.
Actual provider/model evaluations remain deferred.

## Decision log

- Stateful HTTP and owned browsers: needed for connection isolation and native MCP
  cancellation. Same SDK factory/schemas serve HTTP and stdio. Revisit if host testing
  identifies an interoperability issue; do not reintroduce schema bypasses.
- Explicit open/inspect/close: lifecycle and cost are observable. The one-shot milestone-0
  signature is superseded on this unreleased branch. Browser attachment/auth is deferred.
- Bench-only oracle comparison: lets us debug extraction/scoring without feeding answers
  into the investigator. Revisit when designing the isolated model-evaluation harness.
- No arbitrary config code: prove fixture/scorer correctness before adding execution.
  Milestone 2 must supply the runner and evidence supporting validation claims.


## Milestone 2 workflow contract

`src/workflow-contracts.ts` defines strict native-table proposals: root/header/row/cell
CSS selectors, literal data-id identity candidate and optional Next/Previous selectors.
No code, callbacks, unknown strategy names or arbitrary execution fields are accepted.

- `propose_config` is read-only (10 seconds), observes exactly one supported root and
  returns a proposed config/code with session revision and evidence UUID. Recognized
  selectors remain hypotheses. Missing recognized controls do not prove no pagination.
- `probe_pagination` accepts an explicit proposal and workflow budget. It scans forward
  from the current position, records actions/pages/start/end/termination and attempts
  reverse-button restoration in the same allowance. Restoration means matching starting
  row IDs and values, not exact URL equality. It does not claim a first-page rewind.
- `validate_config` snapshots the selected root, then generates trusted source from
  JSON literals. A new outside-checkout consumer installs the prepared tarball with a
  separate frozen lockfile, offline and with lifecycle scripts disabled. It compiles
  generated config and trusted runner against the installed public types, verifies
  the resolved library path stays inside the consumer, then runs the actual library.

Workflow defaults: 60000 ms, 12 action attempts, 5 forward pages, 100 returned rows,
65536 encoded tool-result bytes. Limits: 100–120000 ms, 0–30 actions, 1–10 pages,
1–1000 rows, 8192–131072 bytes. Rewind/reset/restoration share the action and time
budgets; maxPages bounds the forward scan, not reverse navigation. Output is trimmed
by whole records and marked partial; oversized metadata errors rather than lying.
Native cancellation may prevent the client from receiving the final response. Prior
transcript evidence remains available; hard timeouts/cancellation invalidate the
session and terminate owned consumer process groups, then remove temporary consumers.
They are errors, never successful traversal witnesses. Cleanup can add elapsed time.

Execution uses current useTable, Strategies.Pagination.click, multi-row findRows,
row.toJSON, map and reset. It compares library values with the current DOM, checks
page-local and cross-visited-page identity contradictions, and explicitly rewinds
through Previous until disabled before scanning. Disabled Next is control-based
termination only. The library core is unchanged. Flat native tables only; unknown
readiness, virtualization, spans and ambiguous identity need later investigations.

Validation returns init/query/extraction/reset checks, diagnostics, start/end data,
rewind and termination, action/page counts, actual browser/Playwright/TypeScript,
resolved consumer package path, archive checksum, preparation commit and run UUID.
`fullDatasetVerified` remains false. Original browser state is unchanged on normal
validation; cancellation/timeout invalidates that owned session as described above.
The prepared archive/lockfile persist until cleared; each execution directory is
removed. Preparation can access the registry; validation uses the prepared cache.

Only completed server-produced run IDs enter a bounded witness store (100 entries,
10-minute leases). Privileged POST `/bench/validate` requires an existing witness
and registered local fixture source. It compares exact membership/multiplicity/values
against the independent oracle; submitted JSON cannot upgrade a data-only comparison.
`configValidated: true` means this exact successful execution/build/fixture matched,
including rewind and reset. A partial/failed run or wrong source cannot pass, even
if its row values happen to match. This witness store is not an auth boundary.

Structure/pagination playbooks have independent versioned resources and prompts,
loaded from one maintained Markdown source each. Real SDK discovery/read/get calls
are tested. The baseline harness loads prompts explicitly only in the guided condition.
Scripted harness regression is separate from model runs, deferred by user choice.
See `evaluations/README.md` for adapter isolation, budgets, artifacts and limitations.

Decision: use constrained source generation and a trusted runner rather than evaluate
arbitrary model JS. This is sufficient to exercise current strategy APIs and exposes
real type/runtime mistakes without inventing another table engine. Reconsider this
boundary only for a demonstrated unsupported use case and an explicit execution model.


Earlier review corrections: configurable MCP ports are shared by proxy and fixture
URLs; data-only navigation summaries include direction (default Next for existing
submissions) and are checked against fixture transitions. Scoring reads only own
column properties. Inspection withholds positional records for spans. Closing
browsers reserve capacity; elapsed deadlines are checked synchronously before
success. HTTP shutdown stops admission before disposing active and initializing
connection owners. Regression coverage includes an alternate-port UI path and
shutdown during concurrent initialization.
