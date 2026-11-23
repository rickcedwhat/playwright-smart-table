import { execFileSync } from 'node:child_process';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { chromium } from '@playwright/test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

// Explicit public demos only. This is an exploratory integration trial, not a model
// baseline or a stable external-network CI test. No DOM/application data is patched.
const targets = [
  { name: 'datatables', url: 'https://datatables.net/examples/core/basic_init/zero_configuration.html', selector: '#example', grid: false },
  { name: 'mui-quickstart', url: 'https://mui.com/x/react-data-grid/quickstart/', selector: '[role="grid"]', grid: true },
  { name: 'ag-grid', url: 'https://www.ag-grid.com/example/', selector: '[role="grid"]', grid: true },
  { name: 'html-table', url: 'https://www.w3schools.com/html/html_tables.asp', selector: '#customers', grid: false },
];
const targetName = process.argv.find(arg => arg.startsWith('--target='))?.slice('--target='.length);
const selected = targetName ? targets.filter(target => target.name === targetName) : targets;
if (!selected.length) throw new Error('Unknown target; use one of: ' + targets.map(target => target.name).join(', '));
if (!process.argv.includes('--run')) {
  console.log(JSON.stringify({ status: 'not-run', kind: 'exploratory-real-tables', modelRuns: 'deferred', targets: selected, instruction: 'Prepare/build first, then run with --run. Visits public demos and saves local transcripts. External network checks are not CI gates.' }, null, 2));
} else {
  const runId = randomUUID();
  const directory = fileURLToPath(new URL(`../.mcp-runs/real-tables-${runId}/`, import.meta.url));
  mkdirSync(directory, { recursive: true });
  const launcher = fileURLToPath(new URL('../host.mjs', import.meta.url));
  const spec = JSON.parse(execFileSync(process.execPath, [launcher, '--config'], { encoding: 'utf8' })).mcpServers['smart-table-dev'];
  const diagnosticBrowser = await chromium.launch();
  const client = new Client({ name: 'manual-real-table-trials', version: '1' });
  const summary = { kind: 'exploratory-real-tables', runId, observedAt: new Date().toISOString(), modelRuns: 'deferred', node: process.versions.node, groundTruth: 'none: no independent full-dataset oracle, no fixture verdict', targets: [] };
  try {
    await client.connect(new StdioClientTransport({ command: spec.command, args: spec.args, env: spec.env, cwd: tmpdir(), stderr: 'inherit' }));
    summary.server = client.getServerVersion();
    for (const target of selected) {
      const transcript = [], record = { ...target, outcome: 'not-run', transcript: target.name + '.json' };
      let session;
      async function call(name, args) {
        const result = await client.callTool({ name, arguments: args }, undefined, { timeout: 125000 });
        transcript.push({ name, args, result });
        if (result.isError) {
          let error; try { error = JSON.parse(result.content[0].text); } catch { error = { code: 'TOOL_ERROR', message: result.content[0].text }; }
          return { error };
        }
        return { value: result.structuredContent };
      }
      try {
        const opened = await call('open_session', { url: target.url, timeoutMs: 20000 });
        if (opened.error) { record.outcome = 'open-failed'; record.error = opened.error; continue; }
        session = opened.value;
        await call('get_investigation_guide', { aspect: target.grid ? 'virtualization' : 'structure' });
        const observed = await call('inspect_table', { sessionId: session.id, tableSelector: target.selector, budget: { timeoutMs: 15000, maxRows: 25, maxOutputBytes: 65536 } });
        function describe(value) {
          return { url: value.evidence.url, headers: value.headers, mountedRows: value.mountedRowCount, returnedRows: value.records.length, missingIds: value.records.filter(row => row.id === null).length, declaredRows: value.declaredRowCount, coverage: value.coverage, preset: value.preset.value };
        }
        if (observed.value) record.observation = describe(observed.value);
        else record.inspectionError = observed.error;
        if (target.grid) {
          const grid = await call('inspect_virtualization', { sessionId: session.id, tableSelector: target.selector });
          record.virtualization = grid.value ?? grid.error;
          // Record a later snapshot separately: the first may precede hydration.
          const later = await call('inspect_table', { sessionId: session.id, tableSelector: target.selector, budget: { timeoutMs: 15000, maxRows: 25, maxOutputBytes: 65536 } });
          record.laterObservation = later.value ? describe(later.value) : later.error;
        }
        // Separate read-only DOM diagnostic, not an MCP success or dataset oracle.
        // Fresh browser state may differ; use attributes to investigate rejection,
        // never to retrofit/inject metadata into the inspected page.
        const diagnostic = await diagnosticBrowser.newPage();
        try {
          await diagnostic.goto(target.url, { waitUntil: 'domcontentloaded', timeout: 20000 });
          await diagnostic.locator(target.selector).first().waitFor({ timeout: 10000 });
          await diagnostic.locator(target.selector).locator('td, [role="gridcell"], [role="rowheader"], [role="cell"]').first().waitFor({ state: 'attached', timeout: 10000 });
          record.domDiagnostic = await diagnostic.locator(target.selector).evaluateAll(roots => roots.slice(0, 3).map(root => {
            const allRows = [...root.querySelectorAll('tbody tr, [role="row"]')];
            const rows = allRows.filter(row => row.querySelector('td, [role="gridcell"], [role="rowheader"], [role="cell"]'));
            const count = attribute => rows.filter(row => row.hasAttribute(attribute)).length;
            const cells = [...root.querySelectorAll('[role="gridcell"], [role="rowheader"], [role="cell"]')];
            return { tag: root.tagName, id: root.id || null, role: root.getAttribute('role'), ariaBusy: root.getAttribute('aria-busy'), revision: root.getAttribute('data-revision'), declaredRows: root.getAttribute('aria-rowcount'),
              theadHeaders: root.querySelectorAll('thead th').length, allTh: root.querySelectorAll('th').length, allRoleRows: allRows.length, dataRows: rows.length,
              rowAttributes: Object.fromEntries(['data-id', 'row-id', 'data-index', 'aria-rowindex'].map(attribute => [attribute, count(attribute)])),
              cellRoles: Object.fromEntries(['gridcell', 'rowheader', 'cell'].map(role => [role, cells.filter(cell => cell.getAttribute('role') === role).length])),
              nestedScrollers: [...root.querySelectorAll('*')].filter(el => el.scrollHeight > el.clientHeight + 1 && el.clientHeight > 0 && ['auto', 'scroll'].includes(getComputedStyle(el).overflowY)).length };
          }));
        } catch (error) { record.domDiagnostic = { error: String(error) }; }
        finally { await diagnostic.close(); }
        const proposed = await call('propose_config', { sessionId: session.id, tableSelector: target.selector });
        if (proposed.error) { record.outcome = 'proposal-rejected'; record.error = proposed.error; continue; }
        const proposal = proposed.value.proposal;
        // Only the server's constrained proposal is used; no guessed IDs/selectors
        // or arbitrary JS is injected to manufacture a successful execution.
        const probe = await call(proposal.virtualization ? 'probe_virtualization' : 'probe_pagination', { sessionId: session.id, proposal, budget: { maxActions: 6, maxPages: 3, timeoutMs: 15000 } });
        record.probe = probe.value ? { status: probe.value.status, traversal: probe.value.traversal } : probe.error;
        if (probe.error || probe.value.status !== 'tested' || probe.value.traversal.restoration === 'failed') { record.outcome = 'probe-incomplete'; continue; }
        const validated = await call('validate_config', { sessionId: session.id, proposal, budget: { maxActions: 6, maxPages: 3, maxRows: 100, timeoutMs: 60000 } });
        record.validation = validated.value ? { status: validated.value.status, records: validated.value.records.length, checks: validated.value.checks, library: validated.value.library, fullDatasetVerified: validated.value.fullDatasetVerified } : validated.error;
        record.outcome = validated.value ? 'runtime-' + validated.value.status : 'validation-rejected';
      } catch (error) { record.outcome = 'transport-or-run-failed'; record.error = { message: String(error) }; }
      finally {
        if (session) await call('close_session', { sessionId: session.id }).catch(error => { record.cleanupError = String(error); });
        summary.targets.push(record);
        writeFileSync(join(directory, target.name + '.json'), JSON.stringify({ target, transcript }, null, 2));
        writeFileSync(join(directory, 'summary.json'), JSON.stringify(summary, null, 2));
        console.log(target.name, record.outcome, record.error?.code ?? '', JSON.stringify(record.observation ?? record.inspectionError ?? {}));
      }
    }
  } finally { await client.close(); await diagnosticBrowser.close(); }
  console.log('Exploratory artifacts:', directory);
}
