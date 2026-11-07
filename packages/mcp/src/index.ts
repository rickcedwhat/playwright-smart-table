#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { readFileSync } from 'node:fs';
import { createServer } from './server.js';

if (process.argv.includes('--http')) {
    const app = createMcpExpressApp({ host: '127.0.0.1' });
    app.get('/health', (_req, res) => { res.json({ status: 'ok', milestone: 0 }); });
    app.get('/fixtures/mui-datagrid', (_req, res) => {
        res.type('html').send(readFileSync(new URL('../tests/fixtures/mui-datagrid-mock.html', import.meta.url), 'utf8'));
    });
    app.post('/mcp', async (req, res) => {
        const server = createServer();
        const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
        res.on('close', () => { void transport.close(); void server.close(); });
        try {
            await server.connect(transport);
            await transport.handleRequest(req, res, req.body);
        } catch {
            if (!res.headersSent) res.status(500).json({ error: 'MCP request failed' });
        }
    });
    app.all('/mcp', (_req, res) => { res.status(405).end(); });
    const port = Number(process.env.MCP_PORT ?? 3001);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid MCP_PORT');
    const http = app.listen(port, '127.0.0.1', () => { console.error(`MCP listening at http://127.0.0.1:${port}/mcp`); });
    http.on('error', error => { console.error(error.message); process.exitCode = 1; });
} else {
    await createServer().connect(new StdioServerTransport());
}
