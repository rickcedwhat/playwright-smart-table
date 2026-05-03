# Plan: playwright-smart-table MCP Inspector

**Status:** Planning  
**Tracking issue:** (https://github.com/rickcedwhat/playwright-smart-table/issues/108)  
**Location when built:** `packages/mcp` (monorepo subpackage)

---

## What it does

An MCP server that an AI assistant (Claude, Copilot, etc.) calls while a developer is writing tests. Given a URL and an optional table selector hint, it inspects the table DOM and returns either:
- Structured findings (preset match, virtualization signals, pagination type, selector candidates)
- A ready-to-paste `useTable()` config TypeScript string

---

## Two-phase approach

### Phase 1 — Heuristic detection (fast, deterministic)
Run cheap DOM checks to answer the high-confidence questions:
- Does this match a known preset (MUI DataGrid / MUI Table / RDG / Glide)?
- Is row/column virtualization present?
- What type of pagination is used?
- Are there loading overlays or skeleton rows?

### Phase 2 — LLM-assisted selector discovery (robust, handles anything)
Send a stripped DOM snapshot + the `useTable()` TypeScript typings to a model. Ask it to return ranked selector candidates for each slot. This mirrors what works well in practice: pasting HTML + library typings to an LLM produces better selectors than regex heuristics on messy real-world tables.

Both phases run together by default. Phase 1 findings are included in the Phase 2 prompt as context ("we believe this is an RDG grid — does the DOM confirm this?").

#### Solving the chicken-and-egg problem (no selectors yet → how to extract sample rows?)

Phase 1 already tries common row patterns (`tr`, `[role="row"]`, `[data-rowindex]`, etc.) and scores them by count and structure. Use the top Phase 1 candidate — even a low-confidence one — to pull 3–5 sample elements. If Phase 1 finds nothing, fall back to the most-repeated direct children of the table root (whatever element type appears most frequently at depth 2 is almost certainly rows).

#### DOM stripping (before sending to LLM)

Strip aggressively to keep the total snapshot under **8 KB (UTF-8 bytes)**. This budget covers the table root, sample rows, headers, and trimmed typings combined — not per-element. The stripping rules below exist to stay within it:
- SVG `<path>` elements → replace with `<path … />`
- Tailwind / utility class lists → strip `class` entirely if preset is already identified; otherwise keep only non-utility-looking class names
- Inline `style` → strip unless it contains `transform` or `display` (virtualization signals)
- `data-*` attributes → keep all (useful signal even if purpose is unknown)
- `aria-*` → keep all (high signal)
- Duplicate subtrees → show first 2, replace rest with `<!-- +N more similar -->`

---

## Architecture

```text
packages/mcp/
  src/
    index.ts                  ← MCP server entry, registers tools
    browser/
      launcher.ts             ← Playwright setup + teardown
      auth.ts                 ← storageState + interactive auth modes
    detectors/
      preset.ts               ← fingerprint MUI / RDG / Glide / unknown
      virtualization.ts       ← row + column virtualization signals
      pagination.ts           ← button / infinite-scroll / none
      loading.ts              ← overlay / skeleton detection
    tools/
      inspectTable.ts         ← MCP tool: structured findings JSON
      generateConfig.ts       ← MCP tool: findings → useTable() config string
    llm/
      domSnapshot.ts          ← extract + truncate relevant DOM chunk
      selectorPrompt.ts       ← build prompt with DOM + typings
      githubModels.ts         ← call GitHub Models API (GITHUB_TOKEN)
    types.ts
  package.json
```

---

## MCP tools

### `inspect_table(url, tableSelector?, options?)`

```ts
interface InspectTableOptions {
  authMode?: 'storageState' | 'interactive';
  storageStatePath?: string;  // required when authMode === 'storageState'
  llm?: boolean;              // default: true; set false to skip GitHub Models call
}
```

Input validation: if `authMode === 'storageState'` and `storageStatePath` is absent or the path does not exist on disk, the tool must throw a descriptive error before launching the browser.

Returns:
```ts
{
  preset: {
    value:      'mui-datagrid' | 'mui-table' | 'rdg' | 'glide' | null,
    confidence: number,   // ratio of matched signals to total expected signals
    signals:    string[]  // e.g. [".MuiDataGrid-root ✓", "data-rowindex ✓", ".MuiDataGrid-row ✓"]
  },
  virtualization: {
    rows:    { detected: boolean, confidence: number, signals: string[] },
    columns: { detected: boolean, confidence: number, signals: string[] },
  },
  pagination: {
    type:     { value: 'buttons' | 'infinite-scroll' | 'none', confidence: number },
    signals:  string[],
    // One entry per PaginationPrimitive — null if not detected
    primitives: {
      goNext:            { selector: string | null, confidence: number },
      goPrevious:        { selector: string | null, confidence: number },
      goNextBulk:        { selector: string | null, confidence: number },
      goPreviousBulk:    { selector: string | null, confidence: number },
      goToFirst:         { selector: string | null, confidence: number },
      goToLast:          { selector: string | null, confidence: number },
      goToPage:          { selector: string | null, confidence: number },  // e.g. page number input
      getTotalPages:     { selector: string | null, confidence: number },  // e.g. "of N" text
      detectCurrentPage: { selector: string | null, confidence: number },  // e.g. active page indicator
    }
  },
  loading: {
    // Mirrors LoadingStrategy in useTable config
    isTableLoading:  { detected: boolean, confidence: number, signal: string | null },
    isRowLoading:    { detected: boolean, confidence: number, signal: string | null },
    isHeaderLoading: { detected: boolean, confidence: number, signal: string | null },
  },
  selectorCandidates: {
    row:    [{ selector: string, confidence: number, reason: string }],  // top 3
    cell:   [{ selector: string, confidence: number, reason: string }],
    header: [{ selector: string, confidence: number, reason: string }],
  }
}
```

### `generate_config(url, tableSelector?, hints?, options?)`

Accepts the same `InspectTableOptions` as `inspect_table` (see above).

`hints` lets the developer correct findings before config generation:
```ts
{ paginationType: 'infinite-scroll', rowSelector: '[data-row]' }
```

Returns a formatted TypeScript string, paste-ready, with inline comments explaining each decision:

```ts
// Detected: RDG grid (confidence: 0.94)
// Rows are NOT virtualized — no dedupe strategy needed
// Pagination: button-based (next: '[aria-label="Go to next page"]')

const table = useTable(page, {
  ...Plugins.RDG.config(),
  strategies: {
    pagination: Strategies.Pagination.click('[aria-label="Go to next page"]'),
  },
});
```

---

## Auth modes

### Mode 1: `storageState` (headless, recommended)

User exports their browser session once:
```bash
npx playwright open --save-storage=session.json https://your-app.com
```

Then passes the file path when calling the tool:
```ts
inspect_table("https://your-app.com/table", undefined, { authMode: "storageState", storageStatePath: "./session.json" })
```

Playwright loads the session and the page renders as authenticated. No re-login needed.

### Mode 2: Interactive (non-headless, escape hatch)

For SSO/MFA/SAML flows where cookie export is impractical:
1. Tool launches a visible browser window
2. User logs in manually
3. User signals "ready" (via MCP response or CLI prompt)
4. Inspection runs in the authenticated session
5. Browser closes

Opt-in only. Adds ~30s to the flow but handles anything.

---

## Preset fingerprinting signals

| Preset | Required signals |
|---|---|
| MUI DataGrid | `.MuiDataGrid-root` + `.MuiDataGrid-row` + `data-rowindex` |
| MUI Table | `.MuiTable-root` + `.MuiTableRow-root` |
| RDG | `[role="grid"].rdg` + `.rdg-row` + `[aria-colindex]` |
| Glide | `canvas` inside `.dvn-scroll-container` + `gdg-input` textarea |

All signals must match for a confident preset ID. Partial matches returned with lower confidence.

---

## Virtualization detection signals

**Row virtualization:**
- `transform: translateY(Xpx)` on row elements
- `aria-rowcount` on grid root > actual DOM row count
- `data-rowindex` values non-contiguous after scroll
- Visible row count << implied total row count

**Column virtualization:**
- `aria-colcount` on grid root > DOM cell count per row
- `transform: translateX(Xpx)` on cells
- Header count < `aria-colcount`

---

## LLM integration (GitHub Models)

Uses the `GITHUB_TOKEN` already available in the developer's environment — no extra API key needed.

The DOM snapshot sent to the model is assembled within the total **8 KB (UTF-8 bytes)** budget (same budget enforced by the DOM stripping rules above):
- The table root element (outer HTML, after stripping)
- 3–5 representative rows (deduplicated)
- All visible header elements
- The `useTable()` TypeScript types (trimmed to the config shape)

The prompt asks the model to return ranked selector candidates for `rowSelector`, `cellSelector`, and `headerSelector`, and to confirm or correct the heuristic preset guess.

This is optional but on by default. Disable with `{ llm: false }` if offline or rate-limited.

### Secret redaction (GITHUB_TOKEN)

The `GITHUB_TOKEN` value is used only as an `Authorization` header in the HTTP call to the GitHub Models endpoint. It must **never** appear in:
- The prompt or payload sent to the model
- Any log output or debug traces
- Telemetry or error reports

Implementation requirements:
- A central `redactSecrets(str: string): string` utility must mask any string matching the `GITHUB_TOKEN` env var value before it is logged or included in an error message
- The payload assembled in `selectorPrompt.ts` must not include env vars or the token value
- A runtime assertion before every `llm: true` call must verify the serialized prompt does not contain the literal token value; if it does, throw rather than send

---

## Repo structure

Lives in `packages/mcp` inside the existing repo — not a separate repository. Reasons:
- The inspector imports library types, preset fingerprints, and strategy names directly; keeping them together means a single PR when the library changes
- Published as a separate npm package (`@rickcedwhat/playwright-smart-table-mcp`) with its own version number — repo structure doesn't dictate publish structure
- No full monorepo migration needed; just add `packages/mcp/` alongside `src/`. Root `package.json` must exclude `packages/` from the library dist

---

## Testing

### Unit tests (Vitest, no browser)

Detectors are pure functions — they take a DOM-like structure and return findings. Fast, no Playwright needed.

```ts
// preset detector
expect(detectPreset({ classes: ['.MuiDataGrid-root', '.MuiDataGrid-row'], attributes: ['data-rowindex'] }))
  .toEqual({ value: 'mui-datagrid', confidence: 1.0, signals: [...] })

// DOM stripping
expect(stripSnapshot('<path d="M 0 0 L 100 100"/>')).toBe('<path … />')

// config generation
expect(generateConfig({ preset: { value: 'rdg', confidence: 0.95 }, ... }))
  .toContain('...Plugins.RDG.config()')
```

### Integration tests (Playwright, fixture pages)

Static HTML fixtures in `packages/mcp/tests/fixtures/` representing each detectable case — no framework, just hand-crafted HTML with the right signals. A simple `http.createServer` serves them during the test run.

```text
packages/mcp/
  tests/
    fixtures/
      plain-table.html          ← basic <table>, no pagination
      paginated-buttons.html    ← next/prev buttons, page indicator
      virtualized-rows.html     ← aria-rowcount, translateY on rows
      infinite-scroll.html      ← sentinel div at bottom
      mui-datagrid-mock.html    ← MUI class names + data-rowindex
    inspect-table.spec.ts       ← runs inspect_table against each fixture
    generate-config.spec.ts     ← asserts paste-ready TS output
```

These slot into a `test-mcp` job in `pr-checks.yml` alongside `test-a`/`test-b`. Auth flows (storageState, interactive) are **not** tested in CI — manual only.

### MCP protocol tests

Verify tools are registered with correct schemas and input validation rejects bad payloads. Uses `@modelcontextprotocol/sdk` test utilities. Runs in CI as part of `test-mcp`.

### Manual testing

**MCP Inspector UI** — primary tool during development:
```bash
npx @modelcontextprotocol/inspector node packages/mcp/dist/index.js
# → opens http://localhost:5173, call tools interactively, see raw JSON in/out
```

**Claude Desktop** — for real-world validation against live tables:
```json
// ~/Library/Application Support/Claude/claude_desktop_config.json
{
  "mcpServers": {
    "smart-table-inspector": {
      "command": "node",
      "args": ["/path/to/packages/mcp/dist/index.js"]
    }
  }
}
```
Then ask Claude: *"inspect the table at https://mui.com/x/react-data-grid/"*

### Test coverage summary

| Layer | Tool | CI |
|---|---|---|
| Detector logic, DOM stripping, config generation | Vitest unit tests | ✅ `test-mcp` |
| Full `inspect_table` + `generate_config` flow | Playwright + fixture HTML | ✅ `test-mcp` |
| MCP protocol / schema validation | SDK test utilities | ✅ `test-mcp` |
| Auth flows (storageState, interactive) | Manual only | ❌ |
| Real-world tables | Claude Desktop + MCP Inspector UI | ❌ |

---

## Out of scope (for now)

- Sorting strategy detection (backburner in the main library too)
- Auto-generating fill/write strategies
- Supporting non-Playwright browsers

---

## Implementation order

1. Browser launcher + `inspect_table` with preset fingerprinting only — delivers immediate value for MUI/RDG/Glide users
2. Virtualization + pagination detection
3. DOM snapshot + LLM selector discovery via GitHub Models
4. `generate_config` tool outputting paste-ready TypeScript
5. Auth: `storageState` mode
6. Auth: interactive mode
