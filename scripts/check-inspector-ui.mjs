import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

/** Same checks run against owned CI services or an already-running local bench. */
export async function checkInspectorUI({ screenshots } = {}) {
  const origin = `http://127.0.0.1:${process.env.MCP_PORT ?? 3001}`;
  const browser = await chromium.launch();
  let page;
  const errors = [];
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.addInitScript(() => { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { window.__copied = text; } } }); });
    page = await context.newPage(); page.setDefaultTimeout(30000); page.on('pageerror', error => errors.push(error.message));
    const click = name => page.getByRole('button', { name, exact: true }).click();
    const tab = async name => { if (name === 'Scorer lab') { const lab = page.locator('.advanced-lab'); if (!await lab.evaluate(el => el.open)) await lab.locator('summary').click(); } else await page.getByRole('tab', { name, exact: true }).click(); };
    const field = name => page.getByLabel(name, { exact: true });
    const waitRaw = name => page.getByRole('button', { name: 'Copy ' + name, exact: true }).waitFor();
    const raw = async name => JSON.parse(await field(name).textContent());
    const inspect = async fixture => { await field('Fixture').selectOption(fixture); await page.getByRole('button', { name: /^(Start investigation|Inspect again)$/ }).click(); await waitRaw('Inspection findings'); };
    const propose = async () => { await tab('Config'); await click('Generate config'); await waitRaw('Generated config'); };
    const validate = async () => { await tab('Results'); await click('Run validation'); await page.getByRole('button', { name: 'Copy Config validation', exact: true }).waitFor({ timeout: 125000 }); await page.locator('.working').waitFor({ state: 'hidden', timeout: 125000 }); };
    await page.goto('http://127.0.0.1:6274/'); await page.getByText('Connected', { exact: true }).waitFor();
    assert.equal(await page.getByRole('tab').count(), 0, 'No workflow tabs before an investigation');
    assert.equal(await page.getByRole('button', { name: 'Generate config', exact: true }).count(), 0);
    const controls = await page.locator('.controls').boundingBox(), results = await page.locator('.results').boundingBox();
    assert.ok(controls.x + controls.width < results.x, 'Controls belong beside results in the main body');
    await inspect('mui-datagrid'); assert.equal((await raw('Inspection findings')).mountedRowCount, 3);
    await page.locator('.target-advanced > summary').click();
    await field('Table selector').fill('['); await page.getByRole('button', { name: /^(Start investigation|Inspect again)$/ }).click(); await page.getByRole('alert').waitFor();
    assert.match(await page.getByRole('alert').innerText(), /selector|Unexpected/i);
    await field('Table selector').fill(''); await page.getByRole('button', { name: /^(Start investigation|Inspect again)$/ }).click(); await waitRaw('Inspection findings');
    await inspect('plain'); await propose();
    assert.equal(await page.locator('.controls .primary').innerText(), 'Test navigation');
    assert.ok(await page.getByLabel('Generated config', { exact: true }).isVisible());
    assert.ok(!await field('Config proposal').isVisible());
    await page.getByRole('tab', { name: 'Config', exact: true }).focus(); await page.keyboard.press('ArrowRight');
    assert.equal(await page.getByRole('tab', { name: 'Navigation', exact: true }).getAttribute('aria-selected'), 'true');
    await tab('Navigation'); await click('Test navigation'); await waitRaw('Navigation probe');
    assert.equal((await raw('Navigation probe')).status, 'tested');
    await validate(); await waitRaw('Trusted fixture evaluation'); assert.equal((await raw('Trusted fixture evaluation')).configValidated, true);
    await page.getByText('Config passed this fixture', { exact: true }).waitFor();
    await click('Copy run summary');
    const runSummary = JSON.parse(await page.evaluate(() => window.__copied));
    assert.equal(runSummary.recordsReturned, 6); assert.equal(runSummary.fixtureEvaluation.configValidated, true);
    assert.equal(runSummary.comparison, 'trusted-consumer-fixture');
    assert.equal(await page.getByRole('tab', { name: 'Scorer lab' }).count(), 0);
    assert.equal(await page.locator('.advanced-lab').getAttribute('open'), null);

    // Copy works without opening the raw data and without touching the system clipboard.
    const details = page.locator('.raw-result').filter({ has: page.getByRole('button', { name: 'Copy Trusted fixture evaluation', exact: true }) });
    assert.equal(await details.getAttribute('open'), null);
    await click('Copy Trusted fixture evaluation'); assert.equal(await details.getAttribute('open'), null);
    assert.equal(JSON.parse(await page.evaluate(() => window.__copied)).configValidated, true);
    await tab('Scorer lab');
    const submission = JSON.parse(await field('Evaluation submission').inputValue()); submission.records.pop(); submission.claim = 'complete';
    await field('Evaluation submission').fill(JSON.stringify(submission)); await click('Compare snapshot with fixture'); await waitRaw('Fixture evaluation');
    const comparison = await raw('Fixture evaluation'); assert.equal(comparison.passes, false); assert.equal(comparison.missing.length, 1);
    await tab('Results'); assert.equal((await raw('Trusted fixture evaluation')).configValidated, true);
    // Delayed old lab responses cannot attach to another target or interfere with a new inspection.
    await tab('Scorer lab'); let release, started;
    const hold = new Promise(resolve => { release = resolve; }), begun = new Promise(resolve => { started = resolve; });
    await page.route('**/bench/evaluate', async route => { started(); await hold; await route.continue(); });
    await click('Compare snapshot with fixture'); await begun; await inspect('paginated');
    const oldResponse = page.waitForResponse(response => response.url().endsWith('/bench/evaluate')); release(); await oldResponse; await page.waitForTimeout(100);
    await tab('Scorer lab'); assert.equal(await field('Fixture evaluation').count(), 0);
    await page.unroute('**/bench/evaluate');
    // A custom URL can pass runtime checks without claiming independent verification.
    await field('Target URL').fill(origin + '/fixtures/plain?unregistered=1'); await page.getByRole('button', { name: /^(Start investigation|Inspect again)$/ }).click(); await waitRaw('Inspection findings');
    await tab('Scorer lab'); assert.equal(await page.getByRole('button', { name: 'Compare snapshot with fixture', exact: true }).count(), 0);
    await propose(); await validate(); await page.getByText('Runtime checks passed · no independent verdict', { exact: true }).waitFor();
    assert.equal(await field('Trusted fixture evaluation').count(), 0);
    // Partial runtime output has an incomplete verdict, even when the fixture scorer rejects it too.
    await inspect('paginated'); await propose();
    await page.route('**/mcp', async route => {
      const request = route.request(), body = request.postDataJSON();
      if (body?.method === 'tools/call' && body.params.name === 'validate_config') { body.params.arguments.budget = { maxRows: 1 }; await route.continue({ postData: JSON.stringify(body) }); }
      else await route.continue();
    });
    await validate(); assert.equal((await raw('Config validation')).status, 'partial');
    await page.getByText('Validation is incomplete', { exact: true }).waitFor(); await page.unroute('**/mcp');
    await inspect('scrolled'); await page.locator('.advanced-controls').evaluate(el => { el.open = true; }); await click('Inspect virtualization'); await waitRaw('Virtualization findings');
    assert.equal((await raw('Virtualization findings')).status, 'observed'); await propose();
    await tab('Navigation'); await click('Test navigation'); await waitRaw('Navigation probe'); await validate();
    assert.equal((await raw('Config validation')).records.length, 20); assert.equal((await raw('Trusted fixture evaluation')).configValidated, true);
    if (screenshots) await page.screenshot({ path: screenshots + '/inspector-validated-desktop.png' });
    await tab('Scorer lab'); await click('Compare snapshot with fixture'); await waitRaw('Fixture evaluation');
    assert.equal((await raw('Fixture evaluation')).dataMatches, false, 'Initial six-row snapshot is intentionally partial');
    await tab('Config'); await page.locator('.proposal-editor > summary').click(); const proposal = await field('Config proposal').inputValue(); await field('Config proposal').fill(proposal + '\n');
    await tab('Navigation'); assert.equal(await field('Navigation probe').count(), 0); await tab('Results'); assert.equal(await field('Config validation').count(), 0);
    await validate(); assert.equal((await raw('Trusted fixture evaluation')).configValidated, true);
    await page.locator('.session-details > summary').click(); await click('Close browser session');
    await page.getByText('Browser closed · results retained', { exact: true }).waitFor();
    assert.equal((await raw('Trusted fixture evaluation')).configValidated, true); assert.ok(await page.getByRole('button', { name: 'Run validation', exact: true }).isDisabled());
    await click('Copy Trusted fixture evaluation'); assert.equal(JSON.parse(await page.evaluate(() => window.__copied)).passes, true);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(() => document.querySelector('[role=tablist]')?.getAttribute('aria-orientation') === 'horizontal');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'Mobile layout must not overflow the document');
    await page.getByRole('tab', { name: 'Config', exact: true }).focus(); await page.keyboard.press('ArrowRight'); assert.equal(await page.getByRole('tab', { name: 'Navigation', exact: true }).getAttribute('aria-selected'), 'true');
    await tab('Results'); if (screenshots) { await page.getByRole('tabpanel').scrollIntoViewIfNeeded(); await page.screenshot({ path: screenshots + '/inspector-validated-mobile.png' }); }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await inspect('ambiguous'); await page.locator('.advanced-controls').evaluate(el => { el.open = true; }); await click('Inspect virtualization'); await waitRaw('Virtualization findings'); await page.getByText('Grid identity is unknown', { exact: true }).waitFor();
    await tab('Config'); await click('Generate config'); // Unsupported identity must produce an actionable error.
    await page.getByRole('alert').waitFor(); assert.match(await page.getByRole('alert').innerText(), /IDENTITY_UNKNOWN/); assert.equal(await field('Generated config').count(), 0);
    assert.deepEqual(errors, []);
    console.log('Inspector UX passed: step gating, native/grid runs, partial/custom verdicts, independent lab state, stale-response protection, copying, retained results and mobile/keyboard navigation.');
  } finally {
    if (page && await page.locator('.session-details').count()) {
      await page.locator('.session-details').evaluate(el => { el.open = true; }).catch(() => undefined);
      const close = page.getByRole('button', { name: 'Close browser session', exact: true }); if (await close.count()) await close.click().catch(() => undefined);
    }
    await browser.close();
  }
}
