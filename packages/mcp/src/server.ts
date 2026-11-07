import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { budgetSchema, observationSchema, sessionSchema, urlSchema, successResult, InspectorError } from './contracts.js';
import { inspectTable } from './inspect.js';
import { SessionManager } from './sessions.js';

/** The transport owner, not individual HTTP requests, owns browser sessions. */
export function createServer(sessions: SessionManager) {
    const server = new McpServer({ name: 'smart-table-inspector', version: '0.1.0' });
    const reply = async (operation: () => Promise<object>) => {
        try { return successResult(await operation()); }
        catch (error) { return { isError: true, content: [{ type: 'text' as const, text: JSON.stringify({ code: error instanceof InspectorError ? error.code : 'INSPECTION_FAILED', message: error instanceof Error ? error.message : String(error) }) }] }; }
    };
    server.registerTool('open_session', {
        description: 'Open an isolated, server-owned browser at an HTTP(S) URL. Limit 3 per MCP connection; expires after 5 idle minutes. No authentication state is inherited.',
        inputSchema: z.object({ url: urlSchema, timeoutMs: z.number().int().min(100).max(30000).default(10000) }).strict(),
        outputSchema: sessionSchema,
    }, (input, extra) => reply(() => sessions.open(input.url, input.timeoutMs, extra.signal)));
    server.registerTool('inspect_table', {
        description: 'Observe mounted data in an open browser session. Read-only: no pagination actions. Evidence is revision-scoped; it does not prove identity or completeness. Cancellation/time budget closes this browser session.',
        inputSchema: z.object({ sessionId: z.string().uuid(), tableSelector: z.string().trim().min(1).max(1000).optional(), budget: budgetSchema.prefault({}) }).strict(),
        outputSchema: observationSchema,
    }, (input, extra) => reply(() => inspectTable(sessions, input.sessionId, input.tableSelector, input.budget, extra.signal)));
    server.registerTool('close_session', {
        description: 'Close an owned browser session and discard its state. Safe to repeat; in-flight inspection is cancelled.',
        inputSchema: z.object({ sessionId: z.string().uuid() }).strict(),
        outputSchema: z.object({ closed: z.boolean() }).strict(),
    }, input => reply(() => sessions.close(input.sessionId)));
    return server;
}
