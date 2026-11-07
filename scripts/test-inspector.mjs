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
      const health = await fetch('http://127.0.0.1:3001/health', { signal: AbortSignal.timeout(500) });
      const ui = await fetch('http://127.0.0.1:6274/', { signal: AbortSignal.timeout(500) });
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
  await page.getByLabel('Fixture', { exact: true }).selectOption('plain');
  await page.getByRole('button', { name: 'Run inspection' }).click();
  await output.waitFor();
  await page.getByRole('button', { name: 'Compare with fixture' }).click();
  const comparison = page.getByLabel('Fixture evaluation');
  await comparison.waitFor();
  assert.equal(JSON.parse(await comparison.innerText()).dataMatches, true);
  assert.equal(JSON.parse(await comparison.innerText()).configValidated, false);
  const submission = JSON.parse(await page.getByLabel('Evaluation submission').inputValue());
  submission.records.pop(); submission.claim = 'complete';
  await page.getByLabel('Evaluation submission').fill(JSON.stringify(submission));
  await page.getByRole('button', { name: 'Compare with fixture' }).click();
  await comparison.waitFor();
  const failedComparison = JSON.parse(await comparison.innerText());
  assert.equal(failedComparison.passes, false); assert.equal(failedComparison.missing.length, 1);
  assert.equal(failedComparison.unsupportedClaims.length, 1);
  let releaseComparison, comparisonStarted;
  const hold = new Promise(resolve => { releaseComparison = resolve; });
  const started = new Promise(resolve => { comparisonStarted = resolve; });
  await page.route('**/bench/evaluate', async route => { comparisonStarted(); await hold; await route.continue(); });
  await page.getByRole('button', { name: 'Compare with fixture' }).click();
  await started;
  await page.getByLabel('Fixture', { exact: true }).selectOption('paginated');
  await page.getByRole('button', { name: 'Run inspection' }).click();
  await output.waitFor();
  const oldResponse = page.waitForResponse(response => response.url().endsWith('/bench/evaluate'));
  releaseComparison(); await oldResponse;
  await page.waitForTimeout(100);
  assert.equal(await comparison.count(), 0, 'An old comparison cannot be attached to a new observation');
  await page.unroute('**/bench/evaluate');
  await page.getByRole('button', { name: 'Close browser session' }).click();
  await new Promise((resolve, reject) => {
    const tests = spawn(process.execPath, ['packages/mcp/tests/http.mjs'], { stdio: 'inherit' });
    tests.on('error', reject); tests.on('exit', code => code === 0 ? resolve() : reject(new Error(`HTTP tests exited ${code}`)));
  });
  assert.deepEqual(errors, []);
  console.log('Inspector UI smoke passed: connection, real MCP inspection, error display, retry.');
} finally {
  await browser?.close();
  bench.kill('SIGTERM');
  if (bench.exitCode === null) await new Promise(resolve => bench.once('exit', resolve));
}
