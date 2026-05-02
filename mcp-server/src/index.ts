#!/usr/bin/env node

/**
 * PST MCP Server
 *
 * Exposes a single tool — analyze_table — that launches a headless browser,
 * inspects a table or data grid at a given URL, and returns a plain-text
 * classification plus recommended playwright-smart-table config hints.
 *
 * Protocol: MCP over stdio (the client writes JSON to our stdin, we write
 * JSON to stdout; the SDK handles all framing).
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { chromium } from "playwright";

// ---------------------------------------------------------------------------
// Tool definition
// ---------------------------------------------------------------------------
// This is what the AI client sees when it asks "what tools do you have?".
// The description and parameter descriptions are read by the model — write
// them the way you'd write a function's JSDoc for a colleague.

const ANALYZE_TABLE_TOOL = {
  name: "analyze_table",
  description:
    "Navigate to a URL, find a table or data grid, and return a classification of its type (standard HTML table, MUI DataGrid, AG Grid, generic ARIA grid), row/column counts, detected pagination, virtualization hints, and a recommended playwright-smart-table useTable() config snippet.",
  inputSchema: {
    type: "object",
    properties: {
      url: {
        type: "string",
        description: "Full URL of the page containing the table.",
      },
      tableSelector: {
        type: "string",
        description:
          "CSS/ARIA selector to locate the table. Defaults to the PST standard: 'table, [role=\"grid\"], .MuiDataGrid-root, .ag-root-wrapper'.",
      },
    },
    required: ["url"],
  },
} as const;

// ---------------------------------------------------------------------------
// DOM recon — runs inside the browser page via page.evaluate()
// ---------------------------------------------------------------------------
// Everything in this function executes in the browser's JS context, not in
// Node. That means no imports, no TypeScript types, just plain JS that the
// browser engine runs. We return a plain object that Playwright serialises
// back over CDP for us.

interface ReconResult {
  tableType: string;
  selector: string;
  renderedRows: number;
  ariaRowCount: number | null;
  columns: string[];
  hasPagination: boolean;
  virtualizationLikely: boolean;
  notes: string[];
}

async function recon(
  page: Awaited<ReturnType<Awaited<ReturnType<typeof chromium.launch>>["newPage"]>>,
  selector: string
): Promise<ReconResult> {
  return page.evaluate((sel: string): ReconResult => {
    const notes: string[] = [];

    // --- find the table element ---
    const el = document.querySelector(sel);
    if (!el) throw new Error(`No element matched selector: ${sel}`);

    // --- classify the table type ---
    let tableType = "unknown";
    if (el.tagName.toLowerCase() === "table") {
      tableType = "html-table";
    } else if (el.classList.contains("MuiDataGrid-root")) {
      tableType = "mui-datagrid";
    } else if (
      el.classList.contains("ag-root-wrapper") ||
      el.classList.contains("ag-root")
    ) {
      tableType = "ag-grid";
    } else if (el.getAttribute("role") === "grid") {
      tableType = "aria-grid";
    } else if (el.getAttribute("role") === "treegrid") {
      tableType = "aria-treegrid";
    }

    // --- row count: rendered vs declared ---
    // aria-rowcount is set by virtualized grids to declare the *total* row
    // count even when only a subset is rendered in the DOM.
    const ariaRowCountAttr = el.getAttribute("aria-rowcount");
    const ariaRowCount = ariaRowCountAttr ? parseInt(ariaRowCountAttr, 10) : null;

    // Count actually rendered data rows (exclude header rows)
    const rowEls = el.querySelectorAll(
      '[role="row"]:not([aria-rowindex="1"]), tbody > tr'
    );
    const renderedRows = rowEls.length;

    const virtualizationLikely =
      ariaRowCount !== null && ariaRowCount > renderedRows + 5;
    if (virtualizationLikely) {
      notes.push(
        `aria-rowcount=${ariaRowCount} but only ${renderedRows} rows in DOM — virtual scrolling detected`
      );
    }

    // --- column headers ---
    const headerEls = el.querySelectorAll(
      '[role="columnheader"], thead > tr > th, thead > tr > td'
    );
    const columns = Array.from(headerEls)
      .map((h) => (h as HTMLElement).innerText?.trim() ?? "")
      .filter(Boolean);

    // --- pagination ---
    // Look both inside and near the table element.
    const root = el.closest("body") ?? document;
    const hasPagination = !!(
      root.querySelector(
        '.MuiTablePagination-root, [aria-label*="pagination" i], ' +
          '[aria-label*="page" i], nav[aria-label*="page" i], ' +
          '.ag-paging-panel, [class*="pagination"]'
      ) ||
      Array.from(root.querySelectorAll("button")).some((b) =>
        /next page|previous page|next|prev/i.test(
          b.getAttribute("aria-label") ?? b.innerText
        )
      )
    );

    // --- extra notes for specific grid types ---
    if (tableType === "mui-datagrid") {
      const isVirtualColumns = el.querySelector(".MuiDataGrid-virtualScroller");
      if (isVirtualColumns)
        notes.push("MuiDataGrid virtualScroller present — column virtualisation likely");
    }
    if (tableType === "ag-grid") {
      const viewport = el.querySelector(".ag-body-viewport");
      if (viewport) notes.push("AG Grid body viewport found");
    }

    return {
      tableType,
      selector: sel,
      renderedRows,
      ariaRowCount,
      columns,
      hasPagination,
      virtualizationLikely,
      notes,
    };
  }, selector);
}

// ---------------------------------------------------------------------------
// Build the human-readable + actionable response
// ---------------------------------------------------------------------------
// This is what gets returned to the AI assistant as the tool result.
// Keep it dense and actionable — the model will use this to write test code.

function buildReport(r: ReconResult, url: string): string {
  const lines: string[] = [];

  lines.push(`## Table analysis: ${url}`);
  lines.push("");
  lines.push(`**Type:** ${r.tableType}`);
  lines.push(`**Matched selector:** \`${r.selector}\``);
  lines.push(`**Rendered rows:** ${r.renderedRows}`);
  if (r.ariaRowCount !== null) {
    lines.push(`**aria-rowcount (total declared):** ${r.ariaRowCount}`);
  }
  lines.push(
    `**Columns (${r.columns.length}):** ${
      r.columns.length ? r.columns.join(", ") : "none detected"
    }`
  );
  lines.push(`**Pagination detected:** ${r.hasPagination ? "yes" : "no"}`);
  lines.push(
    `**Virtualisation likely:** ${r.virtualizationLikely ? "yes" : "no"}`
  );

  if (r.notes.length) {
    lines.push("");
    lines.push("**Notes:**");
    r.notes.forEach((n) => lines.push(`- ${n}`));
  }

  // --- recommended PST config snippet ---
  lines.push("");
  lines.push("---");
  lines.push("## Recommended `useTable` config");
  lines.push("");

  // Pick the right preset / strategy hints based on what we found
  const configLines: string[] = [];

  if (r.tableType === "mui-datagrid") {
    configLines.push(`import { muiDataGrid } from '@rickcedwhat/playwright-smart-table/presets/mui';`);
    configLines.push(``);
    configLines.push(`const table = useTable(page, muiDataGrid());`);
    if (r.virtualizationLikely) {
      configLines.push(`// MUI DataGrid with virtual scroll — muiDataGrid() preset handles this`);
    }
  } else if (r.tableType === "ag-grid") {
    configLines.push(`// No AG Grid preset yet — use manual config:`);
    configLines.push(`const table = useTable(page, {`);
    configLines.push(`  tableLocator: page.locator('.ag-root-wrapper'),`);
    configLines.push(`  rowLocator: (t) => t.locator('[role="row"]').filter({ hasNot: page.locator('[role="columnheader"]') }),`);
    configLines.push(`  cellLocator: (row, col) => row.locator(\`[col-id="\${col}"]\`),`);
    if (r.hasPagination) {
      configLines.push(`  // pagination: add AG Grid pagination strategy here`);
    }
    configLines.push(`});`);
  } else if (r.tableType === "html-table") {
    configLines.push(`const table = useTable(page, {`);
    configLines.push(`  tableLocator: page.locator('table'),`);
    if (r.hasPagination) {
      configLines.push(`  // pagination: add your pagination strategy here`);
      configLines.push(`  // e.g. Strategies.nextButton(page.locator('[aria-label="Next page"]'))`);
    }
    configLines.push(`});`);
  } else {
    configLines.push(`const table = useTable(page, {`);
    configLines.push(`  tableLocator: page.locator('[role="grid"]'),`);
    configLines.push(`  rowLocator: (t) => t.locator('[role="row"]'),`);
    configLines.push(`  cellLocator: (row, col) => row.locator(\`[aria-colindex]\`).nth(col),`);
    configLines.push(`});`);
  }

  lines.push("```typescript");
  lines.push(...configLines);
  lines.push("```");

  if (r.virtualizationLikely) {
    lines.push("");
    lines.push(
      "> **Virtualisation warning:** not all rows are in the DOM at once. " +
        "You'll need a viewport/scroll strategy — see PST docs on `viewportStrategies`."
    );
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// MCP server wiring
// ---------------------------------------------------------------------------
// Server: declares name + version, registers capability handlers.
// Transport: StdioServerTransport wires the server to stdin/stdout.
//
// Two handlers are required:
//   ListToolsRequestSchema  → what tools exist? (called once on connect)
//   CallToolRequestSchema   → run this tool with these args

const server = new Server(
  { name: "pst-mcp-server", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [ANALYZE_TABLE_TOOL],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name !== "analyze_table") {
    throw new Error(`Unknown tool: ${request.params.name}`);
  }

  const args = request.params.arguments as { url: string; tableSelector?: string };
  const url = args.url;
  const selector =
    args.tableSelector ??
    'table, [role="grid"], .MuiDataGrid-root, .ag-root-wrapper';

  let browser;
  try {
    // Launch headless Chromium — Playwright bundles its own browser, so
    // users don't need Chrome installed.
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
    await page.waitForSelector(selector, { timeout: 15_000 });

    const result = await recon(page, selector);
    const report = buildReport(result, url);

    return {
      content: [{ type: "text", text: report }],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: "text", text: `Error: ${message}` }],
      isError: true,
    };
  } finally {
    // Always close the browser — even if recon threw — so we don't leak
    // Chromium processes.
    await browser?.close();
  }
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
const transport = new StdioServerTransport();
await server.connect(transport);
// No console.log here — stdout is the MCP channel. Any stray output would
// corrupt the JSON protocol. Use stderr for debug logging if needed.
