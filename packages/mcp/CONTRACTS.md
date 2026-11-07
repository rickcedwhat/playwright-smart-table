# Milestone 1 contracts and decisions

Executable schemas live in `src/contracts.ts`; runtime session ownership is in
`src/sessions.ts`. This is a private, experimental API on the revival branch.

## Tools and ownership

- `open_session({ url, timeoutMs? })` creates an isolated, server-owned Chromium
  browser with no inherited authentication state. HTTP(S) only; embedded credentials
  are rejected. Returns an opaque browser-session UUID, URL, revision zero and lease.
- `inspect_table({ sessionId, tableSelector?, budget? })` observes the existing page.
  It does not click, scroll, generate a config or assert full-dataset coverage.
- `close_session({ sessionId })` closes the browser, invalidates the handle and
  interrupts in-flight inspection. Repeating close returns `closed: false`.

Browser handles belong to one MCP connection, not a global pool. HTTP uses the SDK's
stateful Streamable HTTP transport so requests, cancellation notifications and
browser ownership stay with the same client. Stdio has one manager per process.
Knowing a browser UUID from another connection does not grant access.

Limit: three browsers per MCP connection, including concurrent openings; eight HTTP
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
per-call budgets, not an aggregate agent-task allowance; the later agent harness
must account for calls, pages, time and cost across a whole task.

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

Decision: do not execute model-generated JavaScript in milestone 1. The bench accepts
only a strict data submission (records, partial/complete claim, navigation summaries).
Unknown fields such as `code` are rejected. Milestone 2 must define a constrained
selector/strategy proposal and trusted, disposable consumer runner before allowing
config execution. Merely type-checking will not establish runtime success.

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
files/API/results; otherwise label the run exploratory, not blind. Agent evaluations
and trusted traversal witnesses belong to milestone 2+.

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
