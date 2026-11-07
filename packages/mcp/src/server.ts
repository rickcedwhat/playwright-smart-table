import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { budgetSchema, observationSchema, sessionSchema, urlSchema, successResult, InspectorError } from './contracts.js';
import { inspectTable } from './inspect.js';
import { proposeConfig } from './structure.js';
import { probePagination } from './probe.js';
import { validateConfig } from './validate.js';
import { proposalSchema, workflowBudgetSchema, proposalResultSchema, probeResultSchema, validationResultSchema } from './workflow-contracts.js';
import { readFileSync } from 'node:fs';
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
    server.registerTool('propose_config', {
        description: 'Observe native HTML structure and propose a constrained selector/strategy config. Proposal only, not validation. Requires data-id candidates; virtualization is unsupported.',
        inputSchema: z.object({ sessionId: z.string().uuid(), tableSelector: z.string().trim().min(1).max(500).optional() }).strict(), outputSchema: proposalResultSchema,
    }, (input, extra) => reply(() => proposeConfig(sessions, input.sessionId, input.tableSelector, extra.signal)));
    const workflowInput = z.object({ sessionId: z.string().uuid(), proposal: proposalSchema, budget: workflowBudgetSchema.prefault({}) }).strict();
    server.registerTool('probe_pagination', {
        description: 'Explicitly click the proposed native Next/Previous controls within action/page/time budgets. Forward scan from current position, best-effort restoration sharing that budget. No config execution or completeness proof.',
        inputSchema: workflowInput, outputSchema: probeResultSchema,
    }, (input, extra) => reply(() => probePagination(sessions, input.sessionId, input.proposal, input.budget, extra.signal)));
    server.registerTool('validate_config', {
        description: 'Type-check and execute a constrained config in a disposable consumer of the prepared library tarball. Fresh unauthenticated browser, original session unchanged. No arbitrary JS. Runtime checks and traversal witness, not an oracle comparison.',
        inputSchema: workflowInput, outputSchema: validationResultSchema,
    }, (input, extra) => reply(() => validateConfig(sessions, input.sessionId, input.proposal, input.budget, extra.signal)));
    for (const name of ['structure', 'pagination']) {
        const uri = `smart-table://playbooks/${name}/v1`;
        const text = readFileSync(new URL(`../playbooks/${name}.md`, import.meta.url), 'utf8');
        server.registerResource(`${name}-playbook`, uri, { description: `Version 1 ${name} investigation guidance`, mimeType: 'text/markdown' }, async () => ({ contents: [{ uri, text, mimeType: 'text/markdown' }] }));
        server.registerPrompt(`investigate-${name}`, { description: `Load version 1 ${name} guidance` }, async () => ({ messages: [{ role: 'user', content: { type: 'text', text } }] }));
    }
    return server;
}
