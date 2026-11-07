# Provider-neutral baseline runner — v1

Model runs are opt-in and currently deferred. `pnpm mcp:baseline --plan` prints
`not-run`, never fabricated success rates. `--self-test` runs a scripted adapter over
plain/broken cases with both guidance paths; it is labeled a harness regression,
asserts its outcomes, and is not evidence of model quality.

Prepare/build first. To run a model, configure a trusted adapter executable:

```sh
export MCP_BASELINE_ADAPTER=/absolute/path/to/adapter
export MCP_BASELINE_ADAPTER_ARGS='[]'
export MCP_BASELINE_MODEL='explicit-provider-model-id'
export MCP_BASELINE_SETTINGS='{"temperature":0}'
pnpm mcp:baseline
```

The adapter is provider/host code, not an agent tool. Each turn receives one JSON
object on stdin: `protocolVersion`, `model`, `settings`, conversation `messages`
and discovered MCP `tools`. It emits one JSON object on stdout, then exits:

```json
{"action":{"type":"tool","name":"open_session","arguments":{"url":"TASK_URL"}},"usage":{"inputTokens":123,"outputTokens":45}}
```

Or a final action:

```json
{"action":{"type":"final","outcome":"ready","runId":"VALIDATION_RUN_UUID","summary":"Tested scope and remaining limits"}}
```

Final outcomes: ready, partial, unsupported, failed. Ready requires the matching
successful validation witness and exact independent record comparison; broken Next
requires a useful negative outcome. Tool errors, invalid actions and budget stops
are saved. Usage is optional and recorded as supplied; unavailable cost stays null.
The adapter must translate only supplied messages/tools to its model, carry provider
settings consistently, and expose no shell, files, web or oracle access. Credentials
belong in adapter configuration and must not appear in stdout/transcripts. The runner
cannot make an untrusted adapter into a secure sandbox.

The harness opens fresh MCP/server/browser state for each of 4 scenarios × 2 guidance
conditions × 5 runs. Guidance uses actual `prompts/get` calls; registration alone is
not counted as loading. Unguided contexts receive tool descriptions, no playbooks.
The inventory fixture is held out of these initial model tasks. All runs share the
same 24 tool-call, 16 action, 16 scanned-page and 120-second task limits. Per-tool
budgets are clamped to remaining allowances; failed state-changing calls without a
budget witness stop conservatively. Rewind/restoration consume the action allowance;
scanned-page accounting concerns forward observations, not every internal DOM read.

Only the assigned fixture URL may be opened. The provider sees no answer key or
privileged comparison. Evaluation occurs after final and is saved only in artifacts.
Each run records task/fixture/guidance versions, tool schemas in adapter context,
transcript, proposals, run/build/SDK/browser information, outcomes, timing and supplied
usage. `summary.json` preserves raw outcomes/denominators and per-run checksums.
Five runs are a starting baseline, not statistical confidence. Review false successes
and set thresholds before claiming improvement or moving to a pilot.
