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
import * as dotenv from 'dotenv';
import { inspectTable, getInspectTableInputSchema } from './tools/inspectTable.js';
import { generateConfig, GenerateConfigInputSchema } from './tools/generateConfig.js';
import { inspectAndGenerate } from './tools/inspectAndGenerate.js';
import { fetchGitHubModels, getLastModel, saveLastModel } from './utils/githubModels.js';

dotenv.config();

// Redirect all console.log/info to stderr to avoid polluting stdout (MCP JSON stream)
const originalLog = console.log;
const originalInfo = console.info;
console.log = (...args) => console.error(...args);
console.info = (...args) => console.error(...args);

async function main() {
  const models = await fetchGitHubModels();
  const defaultModel = getLastModel();
  
  const server = new McpServer({
    name: 'playwright-smart-table-inspector',
    version: '0.1.0',
  });

  const inputSchema = getInspectTableInputSchema(models, defaultModel);

  // ── Tool: inspect_table ─────────────────────────────────────────────────────
  server.tool(
    'inspect_table',
    'Navigates to a URL, inspects the table DOM, and returns structured findings.',
    inputSchema.shape,
    async (input) => {
      try {
        if (input.options?.model) saveLastModel(input.options.model);
        const findings = await inspectTable(input as any);
        return {
          content: [{ type: 'text', text: JSON.stringify(findings, null, 2) }],
        };
      } catch (err) {
        return {
          content: [{ type: 'text', text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
          isError: true,
        };
      }
    },
  );

  // ── Tool: generate_config ───────────────────────────────────────────────────
  server.tool(
    'generate_config',
    'Generates a playwright-smart-table configuration snippet from inspection findings.',
    { findings: GenerateConfigInputSchema.shape.findings },
    async (input) => {
      try {
        const config = await generateConfig(input as any);
        return { content: [{ type: 'text', text: config }] };
      } catch (err) {
        return {
          content: [{ type: 'text', text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
          isError: true,
        };
      }
    },
  );

  // ── Tool: inspect_and_generate ──────────────────────────────────────────────
  server.tool(
    'inspect_and_generate',
    'All-in-one tool: Navigates to a URL, inspects the table, and returns a config snippet.',
    inputSchema.shape,
    async (input) => {
      try {
        if (input.options?.model) saveLastModel(input.options.model);
        const config = await inspectAndGenerate(input as any);
        return { content: [{ type: 'text', text: config }] };
      } catch (err) {
        return {
          content: [{ type: 'text', text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
          isError: true,
        };
      }
    },
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(err => {
  console.error('Fatal error starting MCP server:', err);
  process.exit(1);
});

