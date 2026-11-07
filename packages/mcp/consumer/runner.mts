import { chromium } from '@playwright/test';
import { useTable } from '@rickcedwhat/playwright-smart-table';
import { realpath } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { sep } from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import { createConfig, proposal } from './config.mjs';

const consumerPackage = await realpath(fileURLToPath(import.meta.resolve('@rickcedwhat/playwright-smart-table')));
if (!consumerPackage.startsWith(process.cwd() + sep)) throw new Error('Library resolved outside disposable consumer');
const input = JSON.parse(await readFile('input.json', 'utf8'));
const browser = await chromium.launch();
let stopping = false;
for (const signal of ['SIGTERM', 'SIGINT'] as const) process.once(signal, () => { stopping = true; void browser.close().finally(() => process.exit(1)); });
const page = await browser.newPage();
page.setDefaultTimeout(2000);
type RecordValue = { id: string; values: Record<string, string> };
let records: RecordValue[] = [], actions = 0, pages = 0;
let start = { url: input.url as string, ids: [] as string[], values: [] as Record<string, string>[] }, end = start;
let rewind = proposal.pagination ? 'failed' : 'not-needed';
let termination = 'error';
const diagnostics: string[] = [];
const checks = { init: false, query: false, extraction: false, reset: false };
const snapshot = async () => {
  const root = page.locator(proposal.root);
  if (await root.count() !== 1) throw new Error('Root is not unique');
  return root.evaluate((root, proposal) => {
    const headers = [...root.querySelectorAll(proposal.header)].map(el => (el.textContent ?? '').trim());
    const rows = [...root.querySelectorAll(proposal.row)];
    if (root.tagName !== 'TABLE' || root.querySelector('table') || root.hasAttribute('aria-rowcount') || root.querySelector('[colspan]:not([colspan="1"]), [rowspan]:not([rowspan="1"])') ||
        !headers.length || headers.some(value => !value || value.length > 120) || new Set(headers).size !== headers.length || rows.length > 1000) throw new Error('Unsupported layout');
    const ids = rows.map(row => row.getAttribute('data-id') ?? '');
    if (ids.some(id => !id || id.length > 200) || new Set(ids).size !== ids.length) throw new Error('Missing/repeated identity candidates');
    const values = rows.map(row => {
      const cells = [...row.querySelectorAll(proposal.cell)];
      if (cells.length !== headers.length || cells.some(cell => (cell.textContent ?? '').length > 1000)) throw new Error('Unsupported or oversized columns');
      return Object.fromEntries(cells.map((cell, i) => [headers[i], (cell.textContent ?? '').trim()]));
    });
    return { url: location.href, ids, values };
  }, proposal);
};
const seenPages = new Set<string>();
const identityPages = new Map<string, string>();
async function checkPage() {
  const current = await snapshot();
  const signature = JSON.stringify([current.ids, current.values]);
  if (!seenPages.has(signature)) {
    if (seenPages.size >= input.budget.maxPages) throw new Error('page-budget');
    for (const id of current.ids) {
      if (identityPages.has(id) && identityPages.get(id) !== signature) throw new Error('Identity candidate repeats on different pages');
      identityPages.set(id, signature);
    }
    seenPages.add(signature); pages = seenPages.size;
  }
  end = current; return current;
}
async function assertControl(selector: string, name: string) {
  const control = page.locator(selector);
  if (await control.count() !== 1 || !await control.isVisible() || !await control.evaluate((el, name) => el.tagName === 'BUTTON' && !(el as HTMLButtonElement).form && (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().toLowerCase() === name, name)) throw new Error('Unsupported control');
  return control;
}
try {
  await page.goto(input.url, { waitUntil: 'domcontentloaded' });
  start = await snapshot(); end = start;
  const config = createConfig(page, async (selector, name) => {
    await assertControl(selector, name);
    if (actions >= input.budget.maxActions) throw new Error('action-budget');
    actions++;
  });
  config.maxPages = input.budget.maxPages;
  // Rewind and traversal share action/time allowances; maxPages bounds the forward scan.
  const table = useTable(page.locator(proposal.root), config);
  await table.init(); checks.init = true;
  if (proposal.pagination) {
    await assertControl(proposal.pagination.previous, 'previous');
    await assertControl(proposal.pagination.next, 'next');
    await table.reset();
    if (!await page.locator(proposal.pagination.previous).isDisabled()) throw new Error('Rewind could not establish first page');
    rewind = 'established';
  }
  seenPages.clear(); identityPages.clear();
  const first = await checkPage();
  if (!first.ids.length) throw new Error('Empty initial page unsupported');
  const [column, value] = Object.entries(first.values[0])[0];
  const found = await table.findRows({ [column]: value }, { maxPages: 1, exact: true });
  const matching = first.ids.map((id, index) => ({ id, values: first.values[index] })).filter(row => row.values[column] === value);
  const foundRecords = await Promise.all(found.map(async row => ({ id: await row.getAttribute('data-id'), values: await row.toJSON() })));
  checks.query = JSON.stringify(foundRecords) === JSON.stringify(matching);
  if (!checks.query) throw new Error('Representative query returned wrong values');
  const pagination = config.strategies!.pagination;
  if (pagination?.goNext) {
    const goNext = pagination.goNext;
    pagination.goNext = async context => {
      await checkPage();
      const control = await assertControl(proposal.pagination!.next, 'next');
      if (await control.isDisabled()) { termination = 'terminal-control'; return false; }
      if (seenPages.size >= input.budget.maxPages) throw new Error('page-budget');
      const before = JSON.stringify(end.ids);
      const moved = await goNext(context);
      const current = await checkPage();
      if (!moved || JSON.stringify(current.ids) === before) throw new Error('ineffective-control');
      if (seenPages.has(JSON.stringify([current.ids, current.values])) && current.ids.some(id => records.some(row => row.id === id))) throw new Error('cycle');
      return true;
    };
  }
  await table.map(async ({ row }) => {
    await checkPage();
    if (records.length >= input.budget.maxRows) throw new Error('row-budget');
    const id = await row.getAttribute('data-id');
    if (!id) throw new Error('Missing identity candidate');
    const values = await row.toJSON();
    const expected = end.values[end.ids.indexOf(id)];
    if (JSON.stringify(values) !== JSON.stringify(expected)) throw new Error('Library extraction disagrees with current DOM');
    records.push({ id, values });
    return id;
  }, { maxPages: input.budget.maxPages, concurrency: 'sequential' });
  await checkPage();
  if (!proposal.pagination) termination = 'single-page';
  else if (await (await assertControl(proposal.pagination.next, 'next')).isDisabled()) termination = 'terminal-control';
  else termination = 'page-budget';
  if (records.length !== identityPages.size) throw new Error('Extraction omitted observed record occurrences');
  checks.extraction = records.length > 0;
  // Reset is independently exercised after scanning, including when already at page 1.
  await table.reset();
  checks.reset = !proposal.pagination || await page.locator(proposal.pagination.previous).isDisabled();
  end = await snapshot();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  diagnostics.push(message);
  termination = ['action-budget', 'page-budget', 'row-budget', 'ineffective-control', 'cycle'].includes(message) ? message : 'error';
} finally {
  if (!stopping) {
    const tested = ['single-page', 'terminal-control'].includes(termination) && Object.values(checks).every(Boolean);
    await writeFile('result.json', JSON.stringify({ consumerPackage, browserVersion: browser.version(), status: tested ? 'tested' : ['action-budget', 'page-budget', 'row-budget'].includes(termination) ? 'partial' : 'failed', checks, records, diagnostics,
      traversal: { start, end, actions, pages, rewind, restoration: 'unchanged-original-session', termination } }));
  }
  await browser.close();
}
