import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { checkInspectorUI } from './check-inspector-ui.mjs';

const mcpPort = Number(process.env.MCP_PORT ?? 3001);
const mcpOrigin = `http://127.0.0.1:${mcpPort}`;
// Refuse occupied ports rather than reusing or terminating someone else's services.
for (const port of [mcpPort, 6274]) {
  const probe = createServer();
  await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(port, '127.0.0.1', resolve); });
  await new Promise(resolve => probe.close(resolve));
}
const bench = spawn(process.execPath, ['scripts/start-inspector.mjs'], { stdio: 'inherit' });
try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (bench.exitCode !== null) throw new Error('Inspector exited before startup');
    try {
      const health = await fetch(mcpOrigin + '/health', { signal: AbortSignal.timeout(500) });
      const ui = await fetch('http://127.0.0.1:6274/', { signal: AbortSignal.timeout(500) });
      if (health.ok && ui.ok) { ready = true; break; }
    } catch { /* services are starting */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  if (!ready) throw new Error('Inspector startup timed out');
  await checkInspectorUI();
  await new Promise((resolve, reject) => {
    const tests = spawn(process.execPath, ['packages/mcp/tests/http.mjs'], { stdio: 'inherit' });
    tests.on('error', reject); tests.on('exit', code => code === 0 ? resolve() : reject(new Error(`HTTP tests exited ${code}`)));
  });
  console.log('Inspector workflow UX and HTTP integration checks passed.');
} finally {
  bench.kill('SIGTERM');
  if (bench.exitCode === null) await new Promise(resolve => bench.once('exit', resolve));
}
