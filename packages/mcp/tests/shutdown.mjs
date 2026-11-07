import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
const reservation = createServer();
await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve));
const port = reservation.address().port;
await new Promise(resolve => reservation.close(resolve));
const base = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, ['dist/index.js', '--http'], { cwd: new URL('../', import.meta.url), env: { ...process.env, MCP_PORT: String(port) }, stdio: ['ignore', 'ignore', 'pipe'] });
child.stderr.resume();
const exited = new Promise(resolve => child.once('exit', resolve));
const clients = [];
async function connect() {
  const client = new Client({ name: 'shutdown-race', version: '1' }); clients.push(client);
  await client.connect(new StreamableHTTPClientTransport(new URL(base + '/mcp')));
  await client.callTool({ name: 'open_session', arguments: { url: base + '/fixtures/plain' } });
}
try {
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(base + '/health')).ok) break; } catch { /* starting */ }
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  await connect();
  const arrivals = Promise.allSettled([connect(), connect()]);
  await new Promise(resolve => setTimeout(resolve, 10));
  child.kill('SIGTERM');
  let timer;
  try { await Promise.race([exited, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Shutdown leaked an owned browser/initialization')), 8000); })]); }
  finally { clearTimeout(timer); }
  await arrivals;
  assert.equal(child.exitCode, 0);
  await assert.rejects(fetch(base + '/health'));
  console.log('HTTP shutdown passed with live browsers and concurrent initialization attempts.');
} finally { await Promise.allSettled(clients.map(client => client.close())); if (child.exitCode === null) { child.kill('SIGKILL'); await exited; } }
