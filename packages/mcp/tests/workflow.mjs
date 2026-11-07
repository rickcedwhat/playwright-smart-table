import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createServer } from 'node:http';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fixtureHtml } from '../dist/bench/fixtures.js';
const host = createServer((req, res) => {
  const url = new URL(req.url, 'http://local');
  res.setHeader('content-type', 'text/html');
  res.end(fixtureHtml(url.pathname.slice(1), url.searchParams.get('page')) ?? '<table><thead><tr><th>Name</th></tr></thead><tbody><tr><td>No identity</td></tr></tbody></table>');
});
await new Promise(resolve => host.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${host.address().port}`;
const transcript = [];
const expectedRecords = JSON.parse(readFileSync(new URL('./bench/people-oracle.json', import.meta.url), 'utf8')).records;
const client = new Client({ name: 'workflow-smoke', version: '1' });
async function call(name, args, options) {
  const result = await client.callTool({ name, arguments: args }, undefined, options);
  transcript.push({ name, args, result });
  if (result.isError) throw new Error(result.content[0].text);
  return result.structuredContent;
}
try {
  await client.connect(new StdioClientTransport({ command: process.execPath, args: ['dist/index.js'], env: { TMPDIR: tmpdir() }, cwd: new URL('../', import.meta.url).pathname }));
  assert.equal((await client.listResources()).resources.length, 2);
  const resource = await client.readResource({ uri: 'smart-table://playbooks/pagination/v1' });
  assert.match(resource.contents[0].text, /later-page/);
  assert.equal((await client.listPrompts()).prompts.length, 2);
  assert.match((await client.getPrompt({ name: 'investigate-structure' })).messages[0].content.text, /visible text/);
  for (const [path, expected, status] of [['plain', 6, 'tested'], ['paginated', 6, 'tested'], ['paginated?page=1', 6, 'tested'], ['broken-next', 2, 'failed'], ['holdout', 4, 'tested']]) {
    const oracle = path === 'holdout' ? JSON.parse(readFileSync(new URL('./bench/inventory-oracle.json', import.meta.url), 'utf8')).records : expectedRecords;
    const session = await call('open_session', { url: origin + '/' + path });
    const proposed = await call('propose_config', { sessionId: session.id });
    assert.equal(proposed.status, 'proposed');
    const probed = await call('probe_pagination', { sessionId: session.id, proposal: proposed.proposal });
    assert.equal(probed.fullDatasetVerified, false);
    assert.equal(probed.traversal.restoration, path === 'plain' ? 'not-attempted' : 'restored');
    const validated = await call('validate_config', { sessionId: session.id, proposal: proposed.proposal }, { timeout: 120000 });
    console.log(path, validated.status, validated.traversal.termination, validated.records.length, 'records');
    assert.equal(validated.status, status);
    assert.equal(validated.records.length, expected);
    assert.equal(validated.fullDatasetVerified, false);
    if (status === 'tested') {
      assert.deepEqual(validated.records, oracle);
      assert.ok(Object.values(validated.checks).every(Boolean));
      assert.deepEqual(validated.records.map(row => row.id).sort(), oracle.map(row => row.id).sort());
      assert.equal(Object.values(validated.records[0].values)[0], Object.values(validated.records[1].values)[0]);
      assert.notEqual(validated.records[0].id, validated.records[1].id);
    } else assert.equal(validated.traversal.termination, 'ineffective-control');
    if (path.includes('page=1')) {
      assert.deepEqual(validated.traversal.start.ids, ['r3', 'r4']);
      assert.equal(validated.traversal.rewind, 'established');
      const unchanged = await call('inspect_table', { sessionId: session.id });
      assert.deepEqual(unchanged.records.map(row => row.id), ['r3', 'r4']);
    }
    await call('close_session', { sessionId: session.id });
  }
  const session = await call('open_session', { url: origin + '/paginated' });
  const { proposal } = await call('propose_config', { sessionId: session.id });
  const limited = await call('validate_config', { sessionId: session.id, proposal, budget: { maxPages: 1 } });
  assert.equal(limited.status, 'partial'); assert.equal(limited.traversal.termination, 'page-budget');
  const noActions = await call('probe_pagination', { sessionId: session.id, proposal, budget: { maxActions: 0 } });
  assert.equal(noActions.traversal.actions, 0); assert.equal(noActions.status, 'partial');
  const malformed = await client.callTool({ name: 'validate_config', arguments: { sessionId: session.id, proposal: { ...proposal, code: 'process.exit()' } } });
  assert.equal(malformed.isError, true);
  const limitedActions = await call('validate_config', { sessionId: session.id, proposal, budget: { maxActions: 0 } });
  assert.equal(limitedActions.status, 'partial'); assert.equal(limitedActions.traversal.actions, 0);
  const limitedRows = await call('validate_config', { sessionId: session.id, proposal, budget: { maxRows: 1 } });
  assert.equal(limitedRows.status, 'partial'); assert.equal(limitedRows.traversal.termination, 'row-budget');
  const unrestored = await call('probe_pagination', { sessionId: session.id, proposal, budget: { maxActions: 2 } });
  assert.equal(unrestored.status, 'partial'); assert.equal(unrestored.traversal.restoration, 'failed');
  await call('close_session', { sessionId: session.id });
  const cancelled = await call('open_session', { url: origin + '/plain' });
  const native = await call('propose_config', { sessionId: cancelled.id });
  const beforeDirectories = new Set(readdirSync(tmpdir()).filter(name => name.startsWith('pst-mcp-consumer-')));
  const controller = new AbortController();
  const pending = client.callTool({ name: 'validate_config', arguments: { sessionId: cancelled.id, proposal: native.proposal } }, undefined, { signal: controller.signal });
  for (let i = 0; i < 80; i++) {
    if (readdirSync(tmpdir()).some(name => name.startsWith('pst-mcp-consumer-') && !beforeDirectories.has(name))) break;
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  controller.abort(); await assert.rejects(pending);
  let cleaned = false;
  for (let i = 0; i < 100; i++) {
    if (!readdirSync(tmpdir()).some(name => name.startsWith('pst-mcp-consumer-') && !beforeDirectories.has(name))) { cleaned = true; break; }
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  assert.ok(cleaned, 'Cancelled consumer directory and process must be cleaned up');
  await assert.rejects(call('inspect_table', { sessionId: cancelled.id }), /STALE_SESSION/);
  const closing = await call('open_session', { url: origin + '/plain' });
  const closingRun = assert.rejects(call('validate_config', { sessionId: closing.id, proposal: native.proposal }), /CANCELLED/);
  for (let i = 0; i < 80; i++) {
    if (readdirSync(tmpdir()).some(name => name.startsWith('pst-mcp-consumer-') && !beforeDirectories.has(name))) break;
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  await call('close_session', { sessionId: closing.id });
  await closingRun;
  assert.ok(!readdirSync(tmpdir()).some(name => name.startsWith('pst-mcp-consumer-') && !beforeDirectories.has(name)));
  const timed = await call('open_session', { url: origin + '/plain' });
  await assert.rejects(call('validate_config', { sessionId: timed.id, proposal: native.proposal, budget: { timeoutMs: 100 } }), /TIME_BUDGET/);
  await assert.rejects(call('inspect_table', { sessionId: timed.id }), /STALE_SESSION/);
  const unsupported = await call('open_session', { url: origin + '/unsupported' });
  await assert.rejects(call('propose_config', { sessionId: unsupported.id }), /UNSUPPORTED_STRUCTURE/);
  await call('close_session', { sessionId: unsupported.id });
  console.log('Workflow passed: guidance discovery, proposals, real installed consumer, duplicates, rewind, broken controls and limits.');
} finally {
  const artifacts = new URL('../.mcp-runs/', import.meta.url); mkdirSync(artifacts, { recursive: true });
  writeFileSync(new URL('deterministic-' + Date.now() + '.json', artifacts), JSON.stringify({ kind: 'deterministic-regression', model: null, transcript }, null, 2));
  await client.close(); await new Promise(resolve => host.close(resolve)); }
