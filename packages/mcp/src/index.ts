#!/usr/bin/env node
/**
 * playwright-smart-table MCP Inspector
 * Registers MCP tools and starts the stdio server.
 *
 * Usage:
 *   node packages/mcp/dist/index.js
 *
 * For interactive testing:
 *   npx @modelcontextprotocol/inspector node packages/mcp/dist/index.js
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { inspectTable, InspectTableInputSchema } from './tools/inspectTable.js';

const server = new McpServer({
  name: 'playwright-smart-table-inspector',
  version: '0.1.0',
});

// ── Tool: inspect_table ───────────────────────────────────────────────────────

server.tool(
  'inspect_table',
  'Navigates to a URL, inspects the table DOM, and returns structured findings: ' +
    'preset match (MUI DataGrid / MUI Table / RDG / Glide), virtualization signals, ' +
    'pagination type, and selector candidates.',
  {
    url: InspectTableInputSchema.shape.url,
    tableSelector: InspectTableInputSchema.shape.tableSelector,
    options: InspectTableInputSchema.shape.options,
  },
  async (input) => {
    try {
      const findings = await inspectTable(input);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(findings, null, 2),
          },
        ],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: 'text', text: `Error: ${message}` }],
        isError: true,
      };
    }
  },
);

// ── Start ─────────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
