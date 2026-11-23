import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fixtureHtml } from '../dist/bench/fixtures.js';

// Deterministic host-shaped regression, not evidence of agent/model usefulness.
const launcher = fileURLToPath(new URL('../host.mjs', import.meta.url));
const root = fileURLToPath(new URL('../../../', import.meta.url));
const directory = mkdtempSync(join(tmpdir(), 'pst-host-cwd-'));
const config = JSON.parse(execFileSync(process.execPath, [launcher, '--config'], { cwd: directory, encoding: 'utf8' }));
const spec = config.mcpServers['smart-table-dev'];
const transcript = [];
const fixture = createServer((req, res) => {
  const url = new URL(req.url, 'http://local');
  res.setHeader('content-type', 'text/html');
  res.end(fixtureHtml(url.pathname.slice(1), url.searchParams.get('page')) ?? 'Not found');
});
await new Promise(resolve => fixture.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${fixture.address().port}`;
const oracle = JSON.parse(readFileSync(new URL('./bench/people-oracle.json', import.meta.url), 'utf8')).records;
const client = new Client({ name: 'host-installation-check', version: '1' });
async function call(name, args) {
  const result = await client.callTool({ name, arguments: args }, undefined, { timeout: 125000 });
  transcript.push({ name, args, result });
  assert.ok(!result.isError, JSON.stringify(result));
  return result.structuredContent;
}
try {
  // Explicit config paths only; no login shell, repo cwd or provider credentials.
  await client.connect(new StdioClientTransport({ command: spec.command, args: spec.args, cwd: directory, env: { ...spec.env, TMPDIR: tmpdir() }, stderr: 'pipe' }));
  assert.match(client.getInstructions(), /get_investigation_guide/);
  const tools = (await client.listTools()).tools;
  assert.equal(tools.length, 9);
  assert.match(tools.find(tool => tool.name === 'propose_config').description, /vertical DOM grid/);
  for (const aspect of ['structure', 'pagination', 'virtualization']) {
    const guide = await call('get_investigation_guide', { aspect });
    const resource = await client.readResource({ uri: guide.uri });
    const prompt = await client.getPrompt({ name: 'investigate-' + aspect });
    assert.equal(guide.text, resource.contents[0].text);
    assert.equal(guide.text, prompt.messages[0].content.text);
  }
  for (const path of ['plain', 'paginated?page=1']) {
    const session = await call('open_session', { url: origin + '/' + path });
    const observation = await call('inspect_table', { sessionId: session.id });
    assert.equal(observation.records.length, path === 'plain' ? 6 : 2);
    const { proposal } = await call('propose_config', { sessionId: session.id });
    const probe = await call('probe_pagination', { sessionId: session.id, proposal });
    assert.equal(probe.status, 'tested');
    const run = await call('validate_config', { sessionId: session.id, proposal });
    assert.equal(run.status, 'tested'); assert.deepEqual(run.records, oracle);
    assert.equal(run.fullDatasetVerified, false);
    assert.ok(Object.values(run.checks).every(Boolean));
    await call('close_session', { sessionId: session.id });
  }
  const abandoned = await call('open_session', { url: origin + '/plain' });
  await client.close();
  // Reconnection must discard all former session identities and rediscover guidance.
  const second = new Client({ name: 'host-reconnect-check', version: '1' });
  try {
    await second.connect(new StdioClientTransport({ command: spec.command, args: spec.args, cwd: directory, env: spec.env, stderr: 'pipe' }));
    assert.equal((await second.listTools()).tools.length, 9);
    const stale = await second.callTool({ name: 'inspect_table', arguments: { sessionId: abandoned.id } });
    assert.equal(stale.isError, true); assert.match(stale.content[0].text, /STALE_SESSION/);
    assert.match(second.getInstructions(), /unauthenticated/);
  } finally { await second.close(); }
  console.log('Host installation checks passed: unrelated cwd, explicit runtime paths, nine tools, shared guidance, native/later-page validation and reconnect; no model runs.');
} finally {
  await client.close(); await new Promise(resolve => fixture.close(resolve)); rmSync(directory, { recursive: true, force: true });
  mkdirSync(join(root, 'packages/mcp/.mcp-runs'), { recursive: true });
  writeFileSync(join(root, 'packages/mcp/.mcp-runs/host-installation.json'), JSON.stringify({ kind: 'deterministic-host-installation', modelRuns: 'deferred', transcript }, null, 2));
}
