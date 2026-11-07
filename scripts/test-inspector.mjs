import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { chromium } from '@playwright/test';

// Refuse occupied ports rather than reusing or terminating someone else's services.
for (const port of [3001, 6274]) {
  const probe = createServer();
  await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(port, '127.0.0.1', resolve); });
  await new Promise(resolve => probe.close(resolve));
}
const bench = spawn(process.execPath, ['scripts/start-inspector.mjs'], { stdio: 'inherit' });
let browser;
try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (bench.exitCode !== null) throw new Error('Inspector exited before startup');
    try {
      const health = await fetch('http://127.0.0.1:3001/health');
      const ui = await fetch('http://127.0.0.1:6274/');
      if (health.ok && ui.ok) { ready = true; break; }
    } catch { /* services are starting */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  if (!ready) throw new Error('Inspector startup timed out');
  browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:6274/');
  await page.getByText('Connected', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Run inspection' }).click();
  const output = page.getByLabel('Inspection findings');
  await output.waitFor();
  const findings = JSON.parse(await output.innerText());
  assert.equal(findings.mountedRowCount, 3);
  assert.equal(findings.preset.value, 'mui-datagrid');
  await page.getByLabel('Table selector', { exact: true }).fill('[');
  await page.getByRole('button', { name: 'Run inspection' }).click();
  await page.getByRole('alert').waitFor();
  assert.match(await page.getByRole('alert').innerText(), /selector|Unexpected/i);
  await page.getByLabel('Table selector', { exact: true }).fill('');
  await page.getByRole('button', { name: 'Run inspection' }).click();
  await output.waitFor();
  assert.equal(JSON.parse(await output.innerText()).status, 'observed');
  assert.deepEqual(errors, []);
  console.log('Inspector UI smoke passed: connection, real MCP inspection, error display, retry.');
} finally {
  await browser?.close();
  bench.kill('SIGTERM');
  if (bench.exitCode === null) await new Promise(resolve => bench.once('exit', resolve));
}
