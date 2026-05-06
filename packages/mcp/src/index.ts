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
import { z } from 'zod';


import { inspectTable, getInspectTableInputSchema } from './tools/inspectTable.js';
import { generateConfig, GenerateConfigInputSchema } from './tools/generateConfig.js';
import { inspectAndGenerate } from './tools/inspectAndGenerate.js';
import { fetchGitHubModels, getLastState, saveLastState } from './utils/githubModels.js';
import { launchBrowser, closeBrowser } from './browser/launcher.js';



dotenv.config();

function registerTools(server: McpServer, models: string[], lastState: any) {
  const inputSchema = getInspectTableInputSchema(models, lastState);

  // Helper for multi-model runs to avoid multiple browser launches and pickers
  async function runMultiModelInspection(input: any, toolFn: (input: any, ctx: any) => Promise<any>) {
    saveLastState(input);
    const modelsToRun = [input.options?.model1 || 'gpt-4o'];
    if (input.options?.model2 && input.options.model2 !== "") {
      modelsToRun.push(input.options.model2);
    }

    let launched = null;
    try {
      // Launch once
      launched = await launchBrowser({
        headless: input.options?.headless ?? true,
        storageStatePath: input.options?.authMode === 'storageState' ? input.options.storageStatePath : undefined,
      });
      const page = await launched.context.newPage();
      await page.goto(input.url, { waitUntil: 'networkidle' });

      // RUN INSPECTION ONCE TO GET SELECTORS (if interactive)
      // We'll call the first model first to trigger the picker, then reuse results
      const firstFindings = await toolFn({ ...input, options: { ...input.options, model: modelsToRun[0] } } as any, { page });
      
      // Extract manual overrides if any
      const ctx = { 
        page, 
        tableSelector: typeof firstFindings === 'object' ? (firstFindings as any).manualOverrides?.table : undefined,
        manualOverrides: typeof firstFindings === 'object' ? (firstFindings as any).manualOverrides : undefined
      };

      const results = await Promise.all(
        modelsToRun.map(async (m, i) => {
          // If it's the first model, we already have it (unless it returned a string config)
          if (i === 0 && typeof firstFindings !== 'string') {
             return { type: 'text' as const, text: `### Model: ${m}\n${JSON.stringify(firstFindings, null, 2)}` };
          }
          const res = await toolFn({ ...input, options: { ...input.options, model: m } } as any, ctx);
          return { type: 'text' as const, text: `### Model: ${m}\n${typeof res === 'string' ? res : JSON.stringify(res, null, 2)}` };
        })
      );
      return { content: results };
    } finally {
      if (launched) await closeBrowser(launched);
    }
  }

  const inspectTableSchema = {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'The URL of the page to inspect' },
      testUrl: { type: 'string', description: 'A pre-defined test URL' },
      tableSelector: { type: 'string', description: 'CSS selector for the target table' },
      options: {
        type: 'object',
        properties: {
          authMode: { type: 'string' },
          storageStatePath: { type: 'string' },
          llm: { type: 'boolean' },
          model1: { type: 'string' },
          model2: { type: 'string' },
          generateSnapshot: { type: 'boolean' },
          verbosity: { type: 'string' },
          headless: { type: 'boolean' },
          interactive: { type: 'boolean' },
        },
      },
    },
    // The "Nuclear Option": make it look like a Zod object to bypass SDK checks
    _def: { typeName: 'ZodObject' } as any,
    parse: (v: any) => v,
    safeParse: (v: any) => ({ success: true, data: v }),
  };

  const generateConfigSchema = {
    type: 'object',
    properties: {
      findings: { type: 'object' },
    },
    required: ['findings'],
    _def: { typeName: 'ZodObject' } as any,
    parse: (v: any) => v,
    safeParse: (v: any) => ({ success: true, data: v }),
  };

  // ── Tool: inspect_table ─────────────────────────────────────────────────────
  server.tool(
    'inspect_table',
    'Navigates to a URL, inspects the table DOM, and returns structured findings.',
    inspectTableSchema as any,
    async (input: any) => {
      try {
        return await runMultiModelInspection(input, inspectTable);
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
          isError: true,
        };
      }
    },
  );

  // ── Tool: generate_config ───────────────────────────────────────────────────
  server.tool(
    'generate_config',
    'Generates a playwright-smart-table configuration snippet from inspection findings.',
    generateConfigSchema as any,
    async (input: any) => {
      try {
        const config = await generateConfig(input as any);
        return { content: [{ type: 'text' as const, text: config }] };
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
          isError: true,
        };
      }
    },
  );

  // ── Tool: inspect_and_generate ──────────────────────────────────────────────
  server.tool(
    'inspect_and_generate',
    'All-in-one tool: Navigates to a URL, inspects the table, and returns a config snippet.',
    inspectTableSchema as any,
    async (input: any) => {
      try {
        return await runMultiModelInspection(input, inspectAndGenerate);
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
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
    registerTools(server, models, getLastState());
    
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('MCP Server (Stdio) running');
  }
}






main().catch(err => {
  console.error('Fatal error starting MCP server:', err);
  process.exit(1);
});

