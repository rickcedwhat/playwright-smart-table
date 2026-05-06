#!/usr/bin/env node

// Redirect all console.log/info to stderr to avoid polluting stdout (MCP JSON stream)
// MUST BE AT THE VERY TOP before any other imports that might log
console.log = console.error;
console.info = console.error;
console.warn = console.error;

// Deep redirect: capture process.stdout.write
const originalStdoutWrite = process.stdout.write.bind(process.stdout);
process.stdout.write = (chunk: any, encoding?: any, callback?: any): boolean => {
  const str = chunk.toString();
  // Only allow valid JSON (MCP messages) to pass through to stdout
  if (str.startsWith('{') || str.startsWith('[')) {
    return originalStdoutWrite(chunk, encoding, callback);
  }
  return process.stderr.write(chunk, encoding, callback);
};

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';


import { inspectTable, getInspectTableInputSchema } from './tools/inspectTable.js';
import { generateConfig, GenerateConfigInputSchema } from './tools/generateConfig.js';
import { inspectAndGenerate } from './tools/inspectAndGenerate.js';
import { fetchGitHubModels, getLastState, saveLastState } from './utils/githubModels.js';



dotenv.config();

function registerTools(server: McpServer, models: string[], lastState: any) {
  const inputSchema = getInspectTableInputSchema(models, lastState);

  // ── Tool: inspect_table ─────────────────────────────────────────────────────
  server.tool(
    'inspect_table',
    'Navigates to a URL, inspects the table DOM, and returns structured findings.',
    inputSchema.shape,
    async (input) => {
      try {
        saveLastState(input);
        const models = [input.options?.model1 || 'gpt-4o'];
        if (input.options?.model2) models.push(input.options.model2);

        const results = await Promise.all(
          models.map(async (m) => {
            const findings = await inspectTable({ ...input, options: { ...input.options, model: m } } as any);
            return { type: 'text' as const, text: `### Model: ${m}\n${JSON.stringify(findings, null, 2)}` };
          })
        );

        return { content: results };
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
        saveLastState(input);
        const models = [input.options?.model1 || 'gpt-4o'];
        if (input.options?.model2) models.push(input.options.model2);

        const results = await Promise.all(
          models.map(async (m) => {
            const config = await inspectAndGenerate({ ...input, options: { ...input.options, model: m } } as any);
            return { type: 'text' as const, text: `### Model: ${m}\n${config}` };
          })
        );

        return { content: results };
      } catch (err) {
        return {
          content: [{ type: 'text', text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
          isError: true,
        };
      }
    },
  );
}

async function main() {
  const models = await fetchGitHubModels();
  const isSse = process.argv.includes('--sse');

  if (isSse) {
    const app = express();
    app.use(cors());
    // app.use(express.json()); // Disabled: breaks SSEServerTransport stream
    const port = parseInt(process.env.MCP_PORT || '3001');


    const activeTransports: SSEServerTransport[] = [];

    app.get('/sse', async (req, res) => {
      console.error('New SSE connection request');

      // Create a fresh server instance for this session
      const server = new McpServer({
        name: 'playwright-smart-table-inspector',
        version: '0.1.0',
      });
      registerTools(server, models, getLastState());

      const transport = new SSEServerTransport('/message', res);
      activeTransports.push(transport);
      await server.connect(transport);
      
      transport.onclose = () => {
        console.error('SSE connection closed');
        const index = activeTransports.indexOf(transport);
        if (index > -1) activeTransports.splice(index, 1);
      };
    });

    app.post('/message', async (req, res) => {
      const sessionId = req.query.sessionId as string;
      const transport = activeTransports.find(t => t.sessionId === sessionId);
      
      if (transport) {
        await transport.handlePostMessage(req, res);
      } else {
        res.status(404).send('No active SSE transport found for this session');
      }
    });

    app.get('/health', (req, res) => {
      res.json({ status: 'ok', activeSessions: activeTransports.length });
    });

    app.listen(port, () => {
      console.error(`MCP Server (SSE) running at http://localhost:${port}/sse`);
    });
  } else {
    const server = new McpServer({
      name: 'playwright-smart-table-inspector',
      version: '0.1.0',
    });
    registerTools(server, models, lastState);
    
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('MCP Server (Stdio) running');
  }
}






main().catch(err => {
  console.error('Fatal error starting MCP server:', err);
  process.exit(1);
});

