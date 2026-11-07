import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const base = `http://127.0.0.1:${process.env.MCP_PORT ?? 3001}`;
const clients = [];
async function connect() {
  const client = new Client({ name: 'http-contract-smoke', version: '0.1.0' });
  const transport = new StreamableHTTPClientTransport(new URL(base + '/mcp'));
  await client.connect(transport); clients.push({ client, transport }); return client;
}
const call = (client, name, args) => client.callTool({ name, arguments: args });
const evaluate = async (fixture, submission) => {
  const response = await fetch(base + '/bench/evaluate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ fixture, submission }) });
  assert.equal(response.status, 200); return response.json();
};
let browser;
try {
  const a = await connect(), b = await connect();
  const tools = (await a.listTools()).tools.map(tool => tool.name);
  assert.deepEqual(tools, ['open_session', 'inspect_table', 'close_session', 'propose_config', 'probe_pagination', 'validate_config']);
  assert.ok(!tools.some(name => /oracle|evaluat/.test(name)));
  assert.equal((await fetch(base + '/tests/bench/people-oracle.json')).status, 404);
  const opened = (await call(a, 'open_session', { url: base + '/fixtures/plain' })).structuredContent;
  const stolen = await call(b, 'inspect_table', { sessionId: opened.id });
  assert.equal(JSON.parse(stolen.content[0].text).code, 'STALE_SESSION');
  const observed = (await call(a, 'inspect_table', { sessionId: opened.id })).structuredContent;
  assert.equal(observed.records.length, 6);
  assert.equal(observed.records[0].values.Name, observed.records[1].values.Name);
  assert.notEqual(observed.records[0].id, observed.records[1].id);
  const correct = await evaluate('plain', { records: observed.records, claim: 'partial', navigation: [] });
  assert.equal(correct.passes, true); assert.equal(correct.configValidated, false);
  const falseClaim = await evaluate('plain', { records: observed.records, claim: 'complete', navigation: [] });
  assert.equal(falseClaim.dataMatches, true); assert.equal(falseClaim.passes, false);
  const proposed = (await call(a, 'propose_config', { sessionId: opened.id })).structuredContent;
  const validationReply = await a.callTool({ name: 'validate_config', arguments: { sessionId: opened.id, proposal: proposed.proposal } }, undefined, { timeout: 120000 });
  assert.ok(!validationReply.isError, JSON.stringify(validationReply.content));
  const validated = validationReply.structuredContent;
  assert.equal(validated.status, 'tested');
  const trustedResponse = await fetch(base + '/bench/validate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ runId: validated.runId, fixture: 'plain' }) });
  const trusted = await trustedResponse.json();
  assert.equal(trusted.passes, true); assert.equal(trusted.configValidated, true);
  assert.equal((await fetch(base + '/bench/validate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ runId: 'invented', fixture: 'plain' }) })).status, 400);
  await call(a, 'close_session', { sessionId: opened.id });
  browser = await chromium.launch();
  const page = await browser.newPage();
  const ids = () => page.locator('tbody tr').evaluateAll(rows => rows.map(row => row.getAttribute('data-id')));
  await page.goto(base + '/fixtures/paginated');
  const firstHtml = await page.content();
  assert.ok(!firstHtml.includes('Eve')); assert.ok(!firstHtml.includes('oracleVersion'));
  assert.deepEqual(await ids(), ['r1', 'r2']);
  await page.locator('#next').click(); await page.waitForURL(/\?page=1$/);
  assert.deepEqual(await ids(), ['r3', 'r4']);
  await page.goto(base + '/fixtures/paginated?page=1');
  assert.deepEqual(await ids(), ['r3', 'r4']);
  await page.locator('#previous').click(); await page.waitForURL(/\?page=0$/);
  assert.deepEqual(await ids(), ['r1', 'r2']);
  await page.goto(base + '/fixtures/broken-next');
  const beforeIds = await ids(); await page.locator('#next').click();
  const afterIds = await ids(); assert.deepEqual(beforeIds, afterIds);
  const failed = await evaluate('broken-next', { records: observed.records, claim: 'partial', navigation: [{ beforeIds, afterIds, claimedMoved: true }] });
  assert.deepEqual(failed.ineffectiveNavigation, [0]);
  const other = (await call(b, 'open_session', { url: base + '/fixtures/paginated?page=1' })).structuredContent;
  const live = (await call(a, 'open_session', { url: base + '/fixtures/plain' })).structuredContent;
  const interrupted = a.callTool({ name: 'inspect_table', arguments: { sessionId: live.id, tableSelector: '#missing' } }).then(value => value.isError === true, () => true);
  await new Promise(resolve => setTimeout(resolve, 50));
  await clients[0].transport.terminateSession();
  assert.ok(await interrupted, 'Terminating A must interrupt its live browser operation');
  const stillOpen = (await call(b, 'inspect_table', { sessionId: other.id })).structuredContent;
  assert.deepEqual(stillOpen.records.map(row => row.id), ['r3', 'r4']);
  const controller = new AbortController();
  const pending = b.callTool({ name: 'inspect_table', arguments: { sessionId: other.id, tableSelector: '#missing' } }, undefined, { signal: controller.signal });
  setTimeout(() => controller.abort(), 50);
  await assert.rejects(pending);
  let stale = false;
  for (let i = 0; i < 20; i++) {
    const result = await call(b, 'inspect_table', { sessionId: other.id });
    if (result.isError && JSON.parse(result.content[0].text).code === 'STALE_SESSION') { stale = true; break; }
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  assert.ok(stale, 'HTTP cancellation must invalidate its browser session');
  console.log('HTTP ownership, isolated browser cleanup, real paginated/broken fixtures, oracle separation and comparison passed.');
} finally {
  await browser?.close();
  for (const { client, transport } of clients) { await transport.terminateSession().catch(() => undefined); await client.close(); }
}
