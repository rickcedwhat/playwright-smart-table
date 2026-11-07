#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createServer } from './server.js';
import { SessionManager } from './sessions.js';
import { fixtureHtml } from './bench/fixtures.js';
import { evaluateSubmission } from './bench/evaluate.js';

if (process.argv.includes('--http')) {
    const app = createMcpExpressApp({ host: '127.0.0.1' });
    const clients = new Map<string, { transport: StreamableHTTPServerTransport; sessions: SessionManager; lastActive: number }>();
    let initializing = 0;
    const reaper = setInterval(() => {
        for (const client of clients.values()) if (Date.now() - client.lastActive > 300000) void client.transport.close();
    }, 10000);
    reaper.unref();
    app.get('/health', (_req, res) => { res.json({ status: 'ok', milestone: 1 }); });
    app.get('/fixtures/mui-datagrid', (_req, res) => {
        res.type('html').send(readFileSync(new URL('../tests/fixtures/mui-datagrid-mock.html', import.meta.url), 'utf8'));
    });
    app.get('/fixtures/:name', (req, res) => {
        const html = fixtureHtml(req.params.name, req.query.page);
        if (!html) { res.status(404).end(); return; }
        res.type('html').send(html);
    });
    app.post('/bench/evaluate', (req, res) => {
        try { res.json(evaluateSubmission(req.body.fixture, req.body.submission)); }
        catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : String(error) }); }
    });
    app.all('/mcp', async (req, res) => {
        const id = req.headers['mcp-session-id'];
        let client = typeof id === 'string' ? clients.get(id) : undefined;
        let pendingInitialization = false;
        try {
            if (!client && !id && req.method === 'POST' && isInitializeRequest(req.body)) {
                if (clients.size + initializing >= 8) { res.status(503).json({ error: 'MCP connection limit reached' }); return; }
                initializing++; pendingInitialization = true;
                const sessions = new SessionManager();
                const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: randomUUID, enableJsonResponse: true,
                    onsessioninitialized: id => { clients.set(id, client!); initializing--; pendingInitialization = false; },
                });
                client = { transport, sessions, lastActive: Date.now() };
                await createServer(sessions).connect(transport);
                const onclose = transport.onclose;
                transport.onclose = () => { onclose?.(); if (transport.sessionId) clients.delete(transport.sessionId); void sessions.dispose(); };
            }
            if (!client) { res.status(id ? 404 : 400).json({ error: 'Initialize a new MCP connection' }); return; }
            client.lastActive = Date.now();
            await client.transport.handleRequest(req, res, req.body);
        } catch { if (!res.headersSent) res.status(500).json({ error: 'MCP request failed' }); }
        finally {
            if (pendingInitialization) {
                initializing--;
                if (client) { await client.sessions.dispose(); await client.transport.close(); }
            }
        }
    });
    const port = Number(process.env.MCP_PORT ?? 3001);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid MCP_PORT');
    const http = app.listen(port, '127.0.0.1', () => { console.error(`MCP listening at http://127.0.0.1:${port}/mcp`); });
    http.on('error', error => { console.error(error.message); process.exitCode = 1; });
    const shutdown = async () => { clearInterval(reaper); await Promise.allSettled([...clients.values()].map(async client => { await client.sessions.dispose(); await client.transport.close(); })); http.close(); };
    process.once('SIGTERM', () => { void shutdown(); });
    process.once('SIGINT', () => { void shutdown(); });
} else {
    const sessions = new SessionManager();
    const server = createServer(sessions);
    server.server.onclose = () => { void sessions.dispose(); };
    const shutdown = async () => { await sessions.dispose(); await server.close(); };
    process.once('SIGTERM', () => { void shutdown(); });
    process.once('SIGINT', () => { void shutdown(); });
    await server.connect(new StdioServerTransport());
}
