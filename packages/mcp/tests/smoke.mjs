import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const fixture = readFileSync(new URL('./fixtures/mui-datagrid-mock.html', import.meta.url), 'utf8');
const http = createServer((req, res) => {
  res.setHeader('content-type', 'text/html');
  res.end(req.url === '/multiple' ? '<table><tr><th>A</th></tr></table><table><tr><th>B</th></tr></table>' : fixture);
});
await new Promise(resolve => http.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${http.address().port}`;
const client = new Client({ name: 'baseline-smoke', version: '0.1.0' });
try {
  await client.connect(new StdioClientTransport({ command: process.execPath, args: ['dist/index.js'], cwd: new URL('../', import.meta.url).pathname }));
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map(tool => tool.name), ['inspect_table']);
  const malformed = await client.callTool({ name: 'inspect_table', arguments: { url: 'not-a-url' } });
  assert.equal(malformed.isError, true);
  const result = await client.callTool({ name: 'inspect_table', arguments: { url } });
  assert.ok(!result.isError, JSON.stringify(result.content));
  assert.deepEqual(result.structuredContent.headers, ['Name', 'Department', 'Role', 'Status']);
  assert.equal(result.structuredContent.preset.value, 'mui-datagrid');
  assert.equal(result.structuredContent.preset.status, 'hypothesis');
  assert.equal(result.structuredContent.mountedRowCount, 3);
  assert.equal(result.structuredContent.declaredRowCount, 50);
  const ambiguous = await client.callTool({ name: 'inspect_table', arguments: { url: url + '/multiple' } });
  assert.equal(ambiguous.isError, true);
  assert.match(ambiguous.content[0].text, /Found 2 table roots/);
  const missing = await client.callTool({ name: 'inspect_table', arguments: { url, tableSelector: '#missing', timeoutMs: 100 } });
  assert.equal(missing.isError, true);
  // Another call after errors must still work, and stdout must remain valid MCP.
  const again = await client.callTool({ name: 'inspect_table', arguments: { url } });
  assert.ok(!again.isError);
  console.log('Stdio MCP smoke passed: discovery, schema rejection, browser inspection, ambiguity, timeout, recovery.');
} finally {
  await client.close();
  await new Promise(resolve => http.close(resolve));
}
