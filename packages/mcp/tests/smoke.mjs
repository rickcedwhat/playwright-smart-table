import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SessionManager } from '../dist/sessions.js';

const fixture = readFileSync(new URL('./fixtures/mui-datagrid-mock.html', import.meta.url), 'utf8');
const http = createServer((req, res) => {
  res.setHeader('content-type', 'text/html');
  res.end(req.url === '/spans' ? '<table><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td rowspan="2">a</td><td>b</td></tr><tr><td>shifted</td><td>extra</td></tr></tbody></table>' : req.url === '/reordered' ? '<table><thead><tr><th aria-colindex="1">A</th><th aria-colindex="2">B</th></tr></thead><tbody><tr><td aria-colindex="2">b</td><td aria-colindex="1">a</td></tr></tbody></table>' : req.url === '/multiple' ? '<table><tr><th>A</th></tr></table><table><tr><th>B</th></tr></table>' : req.url === '/unicode'
    ? `<table><thead><tr><th>Value</th></tr></thead><tbody>${Array.from({ length: 10 }, (_, i) => `<tr data-id="${i}"><td>${'界'.repeat(600)}</td></tr>`).join('')}</tbody></table>` : fixture);
});
await new Promise(resolve => http.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${http.address().port}`;
const client = new Client({ name: 'contract-smoke', version: '0.1.0' });
const call = (name, args, options) => client.callTool({ name, arguments: args }, undefined, options);
const inspect = (id, options = {}) => call('inspect_table', { sessionId: id, ...options });
try {
  await client.connect(new StdioClientTransport({ command: process.execPath, args: ['dist/index.js'], cwd: new URL('../', import.meta.url).pathname }));
  assert.deepEqual((await client.listTools()).tools.map(tool => tool.name), ['open_session', 'inspect_table', 'close_session', 'propose_config', 'probe_pagination', 'validate_config']);
  assert.equal((await call('open_session', { url: 'not-a-url' })).isError, true);
  const session = (await call('open_session', { url })).structuredContent;
  const first = (await inspect(session.id)).structuredContent;
  assert.deepEqual(first.headers, ['Name', 'Department', 'Role', 'Status']);
  assert.equal(first.mountedRowCount, 3); assert.equal(first.declaredRowCount, 50);
  assert.equal(first.evidence.sessionId, session.id); assert.equal(first.evidence.revision, 1);
  assert.deepEqual(first.preset.evidenceIds, [first.evidence.id]);
  assert.equal(first.coverage.fullDatasetVerified, false);
  const second = (await inspect(session.id, { budget: { maxRows: 1 } })).structuredContent;
  assert.equal(second.evidence.revision, 2); assert.notEqual(second.evidence.id, first.evidence.id);
  assert.equal(second.records.length, 1); assert.equal(second.coverage.truncated, true);
  assert.equal((await inspect(session.id, { budget: { maxActions: 1 } })).isError, true);
  const missing = await inspect(session.id, { tableSelector: '#missing', budget: { timeoutMs: 200 } });
  assert.equal(JSON.parse(missing.content[0].text).code, 'TIME_BUDGET');
  assert.equal(JSON.parse((await inspect(session.id)).content[0].text).code, 'STALE_SESSION');
  assert.equal((await call('close_session', { sessionId: session.id })).structuredContent.closed, false);
  const multiple = (await call('open_session', { url: url + '/multiple' })).structuredContent;
  const ambiguous = await inspect(multiple.id);
  assert.match(ambiguous.content[0].text, /Found 2 table roots/);
  await call('close_session', { sessionId: multiple.id });
  const reordered = (await call('open_session', { url: url + '/reordered' })).structuredContent;
  const unmapped = (await inspect(reordered.id)).structuredContent;
  assert.equal(unmapped.coverage.layoutUnsupported, true); assert.deepEqual(unmapped.records, []);
  await call('close_session', { sessionId: reordered.id });
  const spans = (await call('open_session', { url: url + '/spans' })).structuredContent;
  const spanned = (await inspect(spans.id)).structuredContent;
  assert.equal(spanned.coverage.layoutUnsupported, true); assert.deepEqual(spanned.records, []);
  await call('close_session', { sessionId: spans.id });
  const unicode = (await call('open_session', { url: url + '/unicode' })).structuredContent;
  const boundedResult = await inspect(unicode.id, { budget: { maxOutputBytes: 4096 } });
  const bounded = boundedResult.structuredContent;
  assert.ok(bounded, 'bounded observation should fit metadata');
  assert.ok(Buffer.byteLength(JSON.stringify(boundedResult)) <= 4096);
  assert.equal(bounded.coverage.truncated, true);
  await call('close_session', { sessionId: unicode.id });
  const cancelled = (await call('open_session', { url })).structuredContent;
  const controller = new AbortController();
  const pending = inspect(cancelled.id, { tableSelector: '#missing', budget: { timeoutMs: 30000 } });
  // Also verify explicit close interrupts an active operation, independent of host cancellation support.
  await new Promise(resolve => setTimeout(resolve, 50));
  const busy = await inspect(cancelled.id);
  assert.equal(JSON.parse(busy.content[0].text).code, 'SESSION_BUSY');
  await call('close_session', { sessionId: cancelled.id });
  assert.equal(JSON.parse((await pending).content[0].text).code, 'CANCELLED');
  const nativeCancelled = (await call('open_session', { url })).structuredContent;
  const nativePending = call('inspect_table', { sessionId: nativeCancelled.id, tableSelector: '#missing' }, { signal: controller.signal });
  setTimeout(() => controller.abort(), 50);
  await assert.rejects(nativePending);
  let stale = false;
  for (let i = 0; i < 20; i++) {
    const result = await inspect(nativeCancelled.id);
    if (result.isError && JSON.parse(result.content[0].text).code === 'STALE_SESSION') { stale = true; break; }
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  assert.ok(stale, 'native cancellation must close its browser session');
  await call('close_session', { sessionId: nativeCancelled.id }); // Wait for cancellation cleanup before testing empty capacity.
  const capacity = await Promise.all(Array.from({ length: 4 }, () => call('open_session', { url })));
  const openedAtCapacity = capacity.filter(result => !result.isError);
  assert.equal(openedAtCapacity.length, 3);
  assert.equal(JSON.parse(capacity.find(result => result.isError).content[0].text).code, 'SESSION_LIMIT');
  await Promise.all(openedAtCapacity.map(result => call('close_session', { sessionId: result.structuredContent.id })));
  const short = new SessionManager(50);
  try {
    const expired = await short.open(url, 10000, new AbortController().signal);
    await new Promise(resolve => setTimeout(resolve, 100));
    await assert.rejects(short.run(expired.id, 1000, new AbortController().signal, async () => true), error => error.code === 'STALE_SESSION');
  } finally { await short.dispose(); }
  console.log('Stdio contracts passed: schemas, scoped evidence/revisions, budgets, cancellation, expiry, close and recovery.');
} finally { await client.close(); await new Promise(resolve => http.close(resolve)); }
