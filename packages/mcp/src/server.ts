import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { inspectShape, inspectTable } from './inspect.js';

/** Build the same tool surface for stdio, HTTP, and protocol tests. */
export function createServer() {
    const server = new McpServer({ name: 'smart-table-inspector', version: '0.1.0' });
    server.registerTool('inspect_table', {
        description: 'Observe one table\'s mounted DOM and experimental preset fingerprint. Does not verify pagination, identity, or completeness.',
        inputSchema: inspectShape,
    }, async input => {
        try {
            const findings = await inspectTable(input);
            return { content: [{ type: 'text', text: JSON.stringify(findings, null, 2) }], structuredContent: findings };
        } catch (error) {
            return { isError: true, content: [{ type: 'text', text: error instanceof Error ? error.message : String(error) }] };
        }
    });
    return server;
}
