# Exploratory real-table trials — 2026-11-23

Four public demos were visited using the MCP's stdio tools. All four stopped at
proposal generation; zero configs were executed. These are compatibility findings,
not benchmark passes, library failures, or a model evaluation. No full-dataset
answer key was established. No page metadata was added or rewritten.

## DataTables: useful snapshot, no proposal

Target: https://datatables.net/examples/core/basic_init/zero_configuration.html
Selector: `#example`.

The MCP read ten mounted rows and six headers. All ten records had null ID
candidates. A separate DOM diagnostic confirmed no `data-id` on those mounted rows.
The proposal tool requires nonempty page-unique `data-id` and rejected the table.
The initial ten rows are not evidence of the full dataset. Navigation wasn't tested.

Next investigation: recognize the actual controls and investigate explicitly supplied
identity candidates. Do not synthesize random IDs or dedupe by visible row text to
make this demo pass. Whether a source has enough identity evidence remains separate
from whether its mounted values can be extracted.

## MUI quickstart: real IDs, incorrect structural assumptions

Target: https://mui.com/x/react-data-grid/quickstart/
Selector: `[role="grid"]` (one matching root in these visits).

The MCP recognized MUI and counted three mounted data rows, but withheld their
values as an unsupported layout. Proposal generation stopped because the root had
no `id`. A separate, fresh-page DOM diagnostic observed three data rows, all with
`data-id` and `aria-rowindex`; the root had no `data-revision` or `aria-busy`.
Its two columns comprised one `rowheader` and one `gridcell` per data row.
`aria-rowcount="4"` included the header row.

Code inspection explains several misleading diagnostics:

- `inspect_table` extracts `gridcell`/`cell`, excluding `rowheader`, so it sees too
  few values for the two observed headers.
- `readGrid` selects every `role="row"`, including the header row, and expects
  data IDs, logical indices and cells on all of them. “Identity unknown” therefore
  does not establish that the three real data rows lack IDs.
- Proposal generation requires a root ID even when the caller already supplied a
  unique selector. The constrained grid workflow also assumes `data-index`, a
  dataset revision token, particular index offsets and root-owned scrolling.

Recommended next implementation: improve mounted MUI structure/identity observation
first, preserving unknown state where needed. Test explicit rowheader mapping,
header/data-row separation and ARIA count semantics before broadening traversal or
loosening freshness checks. Root selection, identity, readiness, revision continuity
and completeness need separate evidence; recognizing MUI is not validation.

## AG Grid: loading, framework mismatch and genuinely complex scope

Target: https://www.ag-grid.com/example/
Selector: `[role="grid"]`.

The first MCP snapshot saw an empty loading grid. A later snapshot saw sixteen
mounted data rows, grouped/blank headers and a declared count of 1003. Values were
withheld. The later preset hypothesis was `rdg`, although this is AG Grid's own demo;
that heuristic must not select a working config by itself. Proposal generation again
stopped on a missing root ID.

A targeted follow-up waited for cells in a separate DOM diagnostic. It observed
sixteen data-like rows, fifteen with `row-id`, none with `data-id`, and a mixture of
`rowheader` and `gridcell`. Those counts do not prove globally stable identity.
The virtualization investigation also reported grouped/column metadata, horizontal
scope and revision/readiness limits. This example exceeds the current flat,
complete-column, at-most-1000-declared-rows contract. Merely renaming an attribute
would not make it supported.

Next investigation: retain separate pre-hydration/later observations; don't report
an empty initial grid as a completed inspection. A simpler AG Grid holdout should
precede this large grouped example.

## Plain HTML: valid body header missed

Target: https://www.w3schools.com/html/html_tables.asp
Selector: `#customers`.

The MCP counted six data rows but found zero headers and withheld values. The DOM
diagnostic observed three `th` elements, none under `thead`. This valid table uses
a header row in the body. The native observer/proposer assumes `thead th`; proposal
execution also requires `data-id`, which these rows do not have.

Next investigation: bounded native header inference with explicit ambiguity/span
handling. Improving header observation does not invent row identity or establish
traversal completeness.

## Reproduce and interpret the evidence

Prepare/build the checkout first. Running without `--run` prints the target plan
and performs no page visits:

```sh
pnpm --filter @rickcedwhat/playwright-smart-table-mcp trial:real
pnpm --filter @rickcedwhat/playwright-smart-table-mcp trial:real --run
pnpm --filter @rickcedwhat/playwright-smart-table-mcp trial:real --run --target=ag-grid
```

The runner uses bounded tool calls, closes every owned session, saves full MCP
transcripts locally and stops before validation if a probe errors or is incomplete.
Separate DOM diagnostics run in fresh, unauthenticated browser pages and only read
attributes/structure; they are not observations from the same MCP browser state.
Live sites and random demo data can change, so this is opt-in, not an external-network
CI gate. Missing connectivity is recorded separately from proposal rejection.

Local evidence:

- Initial four-target run: `.mcp-runs/real-tables-7a8da409-0e38-4bce-b5b8-de2fd06f967e/`.
- Four-target run with later snapshots and separate diagnostics:
  `.mcp-runs/real-tables-7e3f7b05-f937-4303-a362-e4919e05b374/`.
- AG Grid diagnostic follow-up after waiting for cells:
  `.mcp-runs/real-tables-c4ccf82e-f1e1-4f89-b220-bb655f887148/`.

Each directory has a summary and per-target transcript. Raw external-page data and
machine-specific output remain ignored by Git. All model baselines and host-agent
reasoning evaluations remain deferred; the current coding assistant authored and
ran these scripted integration checks.
