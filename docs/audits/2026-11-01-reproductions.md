# GBU reproduction evidence — 2026-11-01

Audited main: `da9fcc26039b1a74707ca5c59aa9e216763139eb`. These are isolated audit probes, not additions to the test suite. Run `pnpm run build` first, save each script to a temporary `.cjs` file, and run it from the repository root. The scripts load `dist` and the installed Playwright (1.64.0) and launch the locally installed Google Chrome (`channel: 'chrome'`); switch to plain `chromium.launch()` where the bundled browser is installed.

## 1. Regression check of the 2026-10-11 findings

Re-runs the probes from [the previous evidence file](2026-10-11-reproductions.md). The header-discovery oracle (U7/#517) is omitted because the strategy now reads headers through `evaluateAll`; the new browser spec `tests/header-discovery-order.spec.ts` covers the original scenario.

```javascript
// Re-run of the 2026-10-11 GBU probes against current dist.
const root = process.cwd();
const { chromium } = require(root + '/node_modules/@playwright/test');
const { useTable, Strategies } = require(root + '/dist');
const outputs = [];
async function bounded(promise, ms = 1000) {
  let timer;
  try {
    return await Promise.race([
      promise.then(value => ({ settled: true, value }), error => ({ settled: true, error: String(error).slice(0, 200) })),
      new Promise(resolve => { timer = setTimeout(() => resolve({ settled: false }), ms); }),
    ]);
  } finally { clearTimeout(timer); }
}
(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const html = '<table id="t"><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr data-index="0"><td>zero</td><td>b0</td></tr><tr data-index="1"><td>one</td><td>b1</td></tr></tbody></table>';
  const loading = { isHeaderLoading: Strategies.Loading.Headers.never };
  const base = { autoScroll: false, strategies: { loading } };
  async function fresh(h = html) { const page = await browser.newPage(); await page.setContent(h); return page; }

  { // U8 / #518
    const page = await fresh(); let detected = 0;
    const table = useTable(page.locator('#t'), { ...base, strategies: { ...base.strategies, pagination: { detectCurrentPage: async () => { detected++; return 2; } } } });
    const row = await table.findRow({ A: 'zero' }); await table.init();
    outputs.push({ probe: 'U8 #518 auto-init detectCurrentPage', expected: { detected: 1, currentPageIndex: 2 }, detected, currentPageIndex: table.currentPageIndex, rowPage: row.tablePageIndex });
    await page.close();
  }
  { // U2 / #512
    const page = await fresh();
    const table = useTable(page.locator('#t'), { ...base, concurrency: 'synchronized', strategies: { ...base.strategies, viewport: { getVisibleColumnRange: async () => ({ first: 0, last: 1 }) } } });
    const rows = await table.findRows();
    outputs.push({ probe: 'U2 #512 synchronized findRows, read first row only', result: await bounded(rows[0].toJSON()) });
    await page.close();
  }
  { // U1 / #511
    const page = await fresh();
    await page.locator('tbody tr').nth(1).evaluate(el => el.remove());
    const table = useTable(page.locator('#t'), { ...base, strategies: { ...base.strategies, resolveRowIndex: async row => Number(await row.getAttribute('data-index')), contentReady: async row => row.evaluate(el => { el.dataset.index = '9'; el.children[0].textContent = 'WRONG-ROW-9'; }) } });
    const row = await table.findRowByIndex(0);
    outputs.push({ probe: 'U1 #511 atomic target disappears during contentReady', expected: 'reject, never WRONG-ROW-9', result: await bounded(row.toJSON({ atomic: true })) });
    await page.close();
  }
  { // U9 / #519
    const page = await fresh();
    await page.locator('tbody tr').evaluateAll(rows => rows.forEach(r => r.removeAttribute('data-index')));
    const viewport = Strategies.Viewport.dataAttribute();
    const logs = []; const saved = console.error; console.error = (...args) => logs.push(args.join(' ').slice(0, 160));
    const context = { root: page.locator('#t'), page, config: { rowSelector: 'tbody tr', cellSelector: 'td', debug: { logLevel: 'error' }, strategies: {} }, resolve: (s, p) => p.locator(s) };
    const rows = await viewport.getVisibleRowRange(context); const columns = await viewport.getVisibleColumnRange(context);
    console.error = saved;
    outputs.push({ probe: 'U9 #519 missing dataAttribute attributes', rows, columns, logs });
    await page.close();
  }
  { // B1
    const page = await fresh(); let firstCalls = 0;
    const table = useTable(page.locator('#t'), { ...base, strategies: { ...base.strategies, pagination: { goNext: async () => false, goToFirst: async () => { firstCalls++; return true; } } } });
    const row = await table.findRow({ A: 'zero' }); await row.bringIntoView();
    outputs.push({ probe: 'B1 bringIntoView on current page without goToPage', expected: { firstCalls: 0 }, firstCalls, currentPageIndex: table.currentPageIndex });
    await page.close();
  }
  { // U4 / #514 row
    const page = await fresh();
    const table = useTable(page.locator('#t'), { ...base, strategies: { ...base.strategies, loading: { ...loading, isRowLoading: async () => new Promise(() => {}), rowLoadingTimeout: 50, onRowLoadingTimeout: 'throw' } } });
    outputs.push({ probe: 'U4 #514 rowLoadingTimeout=50, never-settling predicate', result: await bounded(table.findRows()) });
    await page.close();
  }
  { // U4 cell
    const page = await fresh();
    const table = useTable(page.locator('#t'), { ...base, strategies: { ...base.strategies, loading: { ...loading, isCellLoading: async () => new Promise(() => {}), cellLoadingTimeout: 50, onCellLoadingTimeout: 'throw' } } });
    await table.init();
    outputs.push({ probe: 'U4 #514 cellLoadingTimeout=50, never-settling predicate', result: await bounded(table.getRowByIndex(0).toJSON()) });
    await page.close();
  }
  { // U4 header
    const page = await fresh();
    const table = useTable(page.locator('#t'), { autoScroll: false, strategies: { loading: { isHeaderLoading: async () => new Promise(() => {}) } } });
    outputs.push({ probe: 'U4 #514 init timeout=50, never-settling header predicate', result: await bounded(table.init({ timeout: 50 })) });
    await page.close();
  }

  const page = await browser.newPage();
  { // U6 / #516 (byTopPosition deprecated in #525; behavior intentionally preserved)
    const h = '<table id="t"><thead><tr><th>Name</th></tr></thead><tbody><tr id="row"><td>A</td></tr></tbody></table>';
    await page.setContent(h); let n = 0;
    const saved = console.warn; const warns = []; console.warn = (...a) => warns.push(a.join(' ').slice(0, 140));
    const t = useTable(page.locator('#t'), { autoScroll: false, maxPages: 2, strategies: { loading, dedupe: Strategies.Dedupe.byTopPosition(), pagination: { goNext: async () => { if (n++) return false; await page.locator('#row td').evaluate(el => el.textContent = 'B'); return true; } } } });
    const actual = await t.map(({ row }) => row.getValue('Name'));
    console.warn = saved;
    outputs.push({ probe: 'U6 #516 byTopPosition recycled slot', expected: ['A', 'B'], actual, warns });
  }
  { // U3 / #513
    await page.setContent('<table id="t"><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr data-ri="100"><td>HUNDRED</td><td>other</td></tr></tbody></table>');
    const q = useTable(page.locator('#t'), { autoScroll: false, strategies: { loading, resolveRowIndex: async row => Number(await row.getAttribute('data-ri')) } }); await q.init();
    for (const atomic of [false, true]) {
      outputs.push({ probe: 'U3 #513 getRowByIndex(0) in window starting at logical 100', atomic, result: await bounded(q.getRowByIndex(0).toJSON({ atomic })) });
    }
  }
  { // U5 / #515
    await page.setContent('<table id="t"><thead><tr><th>Name</th></tr></thead><tbody><tr><td>A</td></tr><tr><td>B</td></tr></tbody></table>');
    let visible = [0]; let oracleCalls = 0;
    const c = useTable(page.locator('#t'), { autoScroll: false, strategies: { loading, viewport: { getVisibleRowIndices: async () => { oracleCalls++; return visible; } } } });
    const first = await c.map(({ row }) => row.getValue('Name'));
    visible = [0, 1]; await c.revalidate();
    const afterRevalidate = await c.map(({ row }) => row.getValue('Name'));
    await c.reset();
    const afterReset = await c.map(({ row }) => row.getValue('Name'));
    outputs.push({ probe: 'U5 #515 viewport cache lifecycle', first, afterRevalidate, afterReset, oracleCalls });
  }
  { // B2 synthetic chaining parity
    await page.setContent('<table id="t"><thead><tr><th>Name</th></tr></thead><tbody><tr><td>A</td></tr></tbody></table>');
    const synthetic = useTable(page.locator('#t'), { autoScroll: false, strategies: { loading }, syntheticColumns: { First: { compute: async row => row.getValue('Name') }, Second: { compute: async row => row.getValue('First') } } });
    await synthetic.init(); const s = synthetic.getRowByIndex(0);
    outputs.push({ probe: 'B2 synthetic chaining getValue', result: await bounded(s.getValue('Second')) });
    outputs.push({ probe: 'B2 synthetic chaining toJSON', result: await bounded(s.toJSON()) });
  }
  await browser.close();
  process.stdout.write(JSON.stringify(outputs, null, 2) + '\n');
})().catch(error => { console.error(error); process.exitCode = 1; });
```

Observed output:

```json
[
  {
    "probe": "U8 #518 auto-init detectCurrentPage",
    "expected": {
      "detected": 1,
      "currentPageIndex": 2
    },
    "detected": 0,
    "currentPageIndex": 0,
    "rowPage": 0
  },
  {
    "probe": "U2 #512 synchronized findRows, read first row only",
    "result": {
      "settled": true,
      "value": {
        "A": "zero",
        "B": "b0"
      }
    }
  },
  {
    "probe": "U1 #511 atomic target disappears during contentReady",
    "expected": "reject, never WRONG-ROW-9",
    "result": {
      "settled": true,
      "error": "Error: [SmartTable] toJSON({ atomic: true }): row 0 recycled out of the DOM and could not be recovered. Ensure a viewport.scrollToRow strategy can restore the row."
    }
  },
  {
    "probe": "U9 #519 missing dataAttribute attributes",
    "rows": {
      "first": 0,
      "last": 0
    },
    "columns": {
      "first": 0,
      "last": 0
    },
    "logs": []
  },
  {
    "probe": "B1 bringIntoView on current page without goToPage",
    "expected": {
      "firstCalls": 0
    },
    "firstCalls": 1,
    "currentPageIndex": 0
  },
  {
    "probe": "U4 #514 rowLoadingTimeout=50, never-settling predicate",
    "result": {
      "settled": true,
      "error": "Error: [SmartTable] Row 0 did not finish loading within 50ms"
    }
  },
  {
    "probe": "U4 #514 cellLoadingTimeout=50, never-settling predicate",
    "result": {
      "settled": true,
      "error": "Error: [SmartTable] Cell \"A\" (row 0) did not finish loading within 50ms"
    }
  },
  {
    "probe": "U4 #514 init timeout=50, never-settling header predicate",
    "result": {
      "settled": true,
      "error": "Error: Timed out waiting for headers after 50ms"
    }
  },
  {
    "probe": "U6 #516 byTopPosition recycled slot",
    "expected": [
      "A",
      "B"
    ],
    "actual": [
      "A"
    ],
    "warns": []
  },
  {
    "probe": "U3 #513 getRowByIndex(0) in window starting at logical 100",
    "atomic": false,
    "result": {
      "settled": true,
      "value": {
        "A": "HUNDRED",
        "B": "other"
      }
    }
  },
  {
    "probe": "U3 #513 getRowByIndex(0) in window starting at logical 100",
    "atomic": true,
    "result": {
      "settled": true,
      "value": {
        "A": "HUNDRED",
        "B": "other"
      }
    }
  },
  {
    "probe": "U5 #515 viewport cache lifecycle",
    "first": [
      "A"
    ],
    "afterRevalidate": [
      "A",
      "B"
    ],
    "afterReset": [
      "A",
      "B"
    ],
    "oracleCalls": 3
  },
  {
    "probe": "B2 synthetic chaining getValue",
    "result": {
      "settled": true,
      "error": "Error: [SmartTable] Synthetic column \"First\" cannot be read from inside another synthetic column's compute(). Synthetic columns may only reference real or override columns."
    }
  },
  {
    "probe": "B2 synthetic chaining toJSON",
    "result": {
      "settled": true,
      "value": {
        "Name": "A",
        "First": "A",
        "Second": "A"
      }
    }
  }
]
```

## 2. New issues (#533–#536) and new audit findings

```javascript
// New GBU probes (2026-11-01): open investigate issues + audit candidates.
const root = process.cwd();
const { chromium } = require(root + '/node_modules/@playwright/test');
const { useTable, Strategies } = require(root + '/dist');
const outputs = [];
async function settle(promise) {
  try { return { value: await promise }; } catch (e) { return { error: String(e.message || e).split('\n').slice(0, 4).join(' | ').slice(0, 400) }; }
}
(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage();
  const loading = { isHeaderLoading: Strategies.Loading.Headers.never };

  // ── #533: reset() records page 0 without rewinding ──
  const pagedHtml = '<table id="t"><thead><tr><th>Name</th></tr></thead><tbody><tr><td>A</td></tr></tbody></table>';
  const pages = ['A', 'B', 'C'];
  for (const variant of ['no goToFirst', 'goToFirst returns false', 'toArray() without goToFirst']) {
    await page.setContent(pagedHtml);
    let p = 0;
    const pagination = {
      goNext: async () => { if (p >= 2) return false; p++; await page.locator('td').evaluate((el, t) => el.textContent = t, pages[p]); return true; },
    };
    if (variant === 'goToFirst returns false') pagination.goToFirst = async () => false;
    const t = useTable(page.locator('#t'), { autoScroll: false, maxPages: 3, strategies: { loading, pagination } });
    if (variant.startsWith('toArray')) {
      await t.toArray();
    } else {
      await t.findRow({ Name: 'C' });
      await t.reset();
    }
    const visible = await page.locator('td').innerText();
    const again = await t.findRow({ Name: 'C' });
    outputs.push({ probe: `#533 reset (${variant})`, visibleAfter: visible, currentPageIndexAfter: 0 + t.currentPageIndex, rowCtablePageIndex: again.tablePageIndex, expectedRowCPage: 2 });
  }

  // ── #534: global/sticky RegExp filters on override + synthetic paths ──
  const statusHtml = '<table id="t"><thead><tr><th>Name</th><th>Status</th></tr></thead><tbody>' +
    '<tr><td>a</td><td>Active</td></tr><tr><td>b</td><td>Active</td></tr><tr><td>c</td><td>Active</td></tr></tbody></table>';
  await page.setContent(statusHtml);
  for (const flags of ['', 'g', 'y']) {
    const override = useTable(page.locator('#t'), { autoScroll: false, strategies: { loading }, columnOverrides: { Status: { read: async cell => (await cell.innerText()).trim() } } });
    const re = new RegExp('Active', flags);
    const first = (await override.findRows({ Status: re })).length;
    const second = (await override.findRows({ Status: re })).length;
    const counted = await override.countRows({ Status: re });
    const synthetic = useTable(page.locator('#t'), { autoScroll: false, strategies: { loading }, syntheticColumns: { S: { compute: async row => row.getValue('Status') } } });
    const re2 = new RegExp('Active', flags);
    const syn = (await synthetic.findRows({ S: re2 })).length;
    const dom = useTable(page.locator('#t'), { autoScroll: false, strategies: { loading } });
    const domCount = (await dom.findRows({ Status: new RegExp('Active', flags) })).length;
    outputs.push({ probe: `#534 RegExp /Active/${flags} (3 identical rows)`, overrideFindRows1: first, overrideFindRows2: second, overrideCountRows: counted, syntheticFindRows: syn, domFindRows: domCount, callerLastIndexAfter: re.lastIndex });
  }

  // ── #536: mapColumn<number> returns strings at runtime ──
  await page.setContent('<table id="t"><thead><tr><th>Count</th></tr></thead><tbody><tr><td>42</td></tr></tbody></table>');
  {
    const t = useTable(page.locator('#t'), { autoScroll: false, strategies: { loading } });
    const values = await t.mapColumn('Count');
    outputs.push({ probe: '#536 mapColumn<number>("Count") default path', values, runtimeTypeof: typeof values[0] });
  }

  // ── Audit: atomic toJSON ignores getCellLocator (column-virtualized row) ──
  {
    const heads = ['A', 'B', 'C', 'D', 'E', 'F'].map(h => `<th>${h}</th>`).join('');
    // Body renders only columns D–F (aria-colindex 4–6), like a horizontally scrolled virtualized grid.
    const cells = ['d1', 'e1', 'f1'].map((v, i) => `<td aria-colindex="${i + 4}">${v}</td>`).join('');
    await page.setContent(`<table id="t"><thead><tr>${heads}</tr></thead><tbody><tr>${cells}</tr></tbody></table>`);
    const t = useTable(page.locator('#t'), {
      autoScroll: false,
      strategies: { loading, getCellLocator: ({ row, columnIndex }) => row.locator(`[aria-colindex="${columnIndex + 1}"]`) },
    });
    await t.init();
    const row = t.getRowByIndex(0);
    const columns = ['D', 'E', 'F'];
    outputs.push({ probe: 'atomic vs live with getCellLocator (only D–F mounted)', columns, live: await settle(row.toJSON({ columns })), atomic: await settle(row.toJSON({ columns, atomic: true })), atomicAllColumns: await settle(row.toJSON({ atomic: true })) });
  }

  // ── Audit: ambiguous-row error samples use rowIndex 0 ──
  {
    await page.setContent('<table id="t"><thead><tr><th>Name</th><th>Id</th></tr></thead><tbody>' +
      ['Alice', 'Dup', 'Bob', 'Dup'].map((n, i) => `<tr data-index="${i}"><td>${n}</td><td>${i}</td></tr>`).join('') + '</tbody></table>');
    const t = useTable(page.locator('#t'), { autoScroll: false, strategies: { loading, resolveRowIndex: async row => Number(await row.getAttribute('data-index')) } });
    const r = await settle(t.findRow({ Name: 'Dup' }));
    outputs.push({ probe: 'ambiguous findRow sample rows (matches are Dup#1, Dup#3)', error: r.error });
  }

  // ── Audit: same-page identical dedupe keys depend on concurrency mode ──
  {
    await page.setContent('<table id="t"><thead><tr><th>Name</th></tr></thead><tbody><tr><td>X</td></tr><tr><td>X</td></tr><tr><td>Y</td></tr></tbody></table>');
    const res = {};
    for (const concurrency of ['sequential', 'parallel', 'synchronized']) {
      const t = useTable(page.locator('#t'), { autoScroll: false, concurrency, strategies: { loading, dedupe: async row => row.getCell('Name').innerText() } });
      res[concurrency] = await t.map(({ row }) => row.getValue('Name'));
    }
    outputs.push({ probe: 'dedupe: two simultaneous "X" rows by concurrency mode', ...res });
  }

  // ── Audit: horizontalScroll header discovery with a sticky first column (#529 follow-up) ──
  for (const withColIndex of [false, true]) {
    const ths = Array.from({ length: 8 }, (_, i) => {
      const sticky = i === 0 ? 'position:sticky;left:0;background:#fff;z-index:1;' : '';
      const ci = withColIndex ? ` aria-colindex="${i + 1}"` : '';
      return `<th${ci} style="min-width:150px;width:150px;${sticky}">${i === 0 ? 'Name' : 'Col' + i}</th>`;
    }).join('');
    const tds = Array.from({ length: 8 }, (_, i) => `<td style="${i === 0 ? 'position:sticky;left:0;background:#fff;' : ''}">v${i}</td>`).join('');
    await page.setContent(`<div class="scroller" style="width:400px;overflow-x:auto"><table id="t" style="table-layout:fixed;width:1200px"><thead><tr>${ths}</tr></thead><tbody><tr>${tds}</tr></tbody></table></div>`);
    const t = useTable(page.locator('#t'), { autoScroll: false, strategies: { loading, header: Strategies.Header.horizontalScroll({ selector: '.scroller', scrollAmount: 300 }) } });
    outputs.push({ probe: `horizontalScroll + sticky first header (aria-colindex: ${withColIndex})`, init: await settle(t.init().then(() => t.getHeaders())) });
  }

  await browser.close();
  process.stdout.write(JSON.stringify(outputs, null, 2) + '\n');
})().catch(error => { console.error(error); process.exitCode = 1; });
```

Observed output:

```json
[
  {
    "probe": "#533 reset (no goToFirst)",
    "visibleAfter": "C",
    "currentPageIndexAfter": 0,
    "rowCtablePageIndex": 0,
    "expectedRowCPage": 2
  },
  {
    "probe": "#533 reset (goToFirst returns false)",
    "visibleAfter": "C",
    "currentPageIndexAfter": 0,
    "rowCtablePageIndex": 0,
    "expectedRowCPage": 2
  },
  {
    "probe": "#533 reset (toArray() without goToFirst)",
    "visibleAfter": "C",
    "currentPageIndexAfter": 0,
    "rowCtablePageIndex": 0,
    "expectedRowCPage": 2
  },
  {
    "probe": "#534 RegExp /Active/ (3 identical rows)",
    "overrideFindRows1": 3,
    "overrideFindRows2": 3,
    "overrideCountRows": 3,
    "syntheticFindRows": 3,
    "domFindRows": 3,
    "callerLastIndexAfter": 0
  },
  {
    "probe": "#534 RegExp /Active/g (3 identical rows)",
    "overrideFindRows1": 2,
    "overrideFindRows2": 1,
    "overrideCountRows": 2,
    "syntheticFindRows": 2,
    "domFindRows": 3,
    "callerLastIndexAfter": 6
  },
  {
    "probe": "#534 RegExp /Active/y (3 identical rows)",
    "overrideFindRows1": 2,
    "overrideFindRows2": 1,
    "overrideCountRows": 2,
    "syntheticFindRows": 2,
    "domFindRows": 3,
    "callerLastIndexAfter": 6
  },
  {
    "probe": "#536 mapColumn<number>(\"Count\") default path",
    "values": [
      "42"
    ],
    "runtimeTypeof": "string"
  },
  {
    "probe": "atomic vs live with getCellLocator (only D–F mounted)",
    "columns": [
      "D",
      "E",
      "F"
    ],
    "live": {
      "value": {
        "D": "d1",
        "E": "e1",
        "F": "f1"
      }
    },
    "atomic": {
      "value": {}
    },
    "atomicAllColumns": {
      "value": {
        "A": "d1",
        "B": "e1",
        "C": "f1"
      }
    }
  },
  {
    "probe": "ambiguous findRow sample rows (matches are Dup#1, Dup#3)",
    "error": "Ambiguous Row: Found 2 rows matching {\"Name\":\"Dup\"} on page 0. Expected exactly one match. Try adding more filters to make your query unique. | Sample matching rows: |   1. {\"Name\":\"Alice\",\"Id\":\"0\"} |   2. {\"Name\":\"Alice\",\"Id\":\"0\"}"
  },
  {
    "probe": "dedupe: two simultaneous \"X\" rows by concurrency mode",
    "sequential": [
      "X",
      "Y"
    ],
    "parallel": [
      "X",
      "X",
      "Y"
    ],
    "synchronized": [
      "X",
      "X",
      "Y"
    ]
  },
  {
    "probe": "horizontalScroll + sticky first header (aria-colindex: false)",
    "init": {
      "error": "Initialization Error: Duplicate column names found: \"Name\". Use 'headerTransformer' to rename duplicate columns."
    }
  },
  {
    "probe": "horizontalScroll + sticky first header (aria-colindex: true)",
    "init": {
      "value": [
        "Name",
        "Col1",
        "Col2",
        "Col3",
        "Col4",
        "Col5",
        "Col6",
        "Col7"
      ]
    }
  }
]
```

## 3. #535 test contract

`npx vitest run tests/unit/dedupe-after-callback.test.ts` passes (4/4). The second case is titled "row whose callback returned recycled data does not burn the key", its setup comment says the later `alice` row "must NOT be skipped", and its assertion is `expect(results).toHaveLength(1)` — i.e. the later row *is* skipped. Row callbacks have no public skip/invalid signal: the `SKIP` symbol in `src/engine/tableIteration.ts` is module-private, so a `null` return is an ordinary successful value that registers the key.

## 4. #533 via `countRows()`

`countRows()` also calls `reset()` in its `finally` block (`src/engine/countRows.ts`), so a paginated table without `goToFirst` ends every count with metadata on page 0 and the DOM on the last page.

```javascript
const root = process.cwd();
const { chromium } = require(root + '/node_modules/@playwright/test');
const { useTable, Strategies } = require(root + '/dist');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage();
  await page.setContent('<table id="t"><thead><tr><th>Name</th></tr></thead><tbody><tr><td>A</td></tr></tbody></table>');
  const pages = ['A', 'B', 'C']; let p = 0;
  const t = useTable(page.locator('#t'), { autoScroll: false, maxPages: 3, strategies: { loading: { isHeaderLoading: Strategies.Loading.Headers.never }, pagination: { goNext: async () => { if (p >= 2) return false; p++; await page.locator('td').evaluate((el, x) => el.textContent = x, pages[p]); return true; } } } });
  const count = await t.countRows();
  console.log(JSON.stringify({ probe: '#533 countRows() without goToFirst', count, visibleAfter: await page.locator('td').innerText(), currentPageIndexAfter: t.currentPageIndex }));
  await browser.close();
})();
```

Observed output:

```json
{"probe":"#533 countRows() without goToFirst","count":3,"visibleAfter":"C","currentPageIndexAfter":0}
```
