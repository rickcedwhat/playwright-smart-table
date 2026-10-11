# GBU reproduction evidence — 2026-10-11

Audited main: `0d74239c7a4e42c1f5ba708fc6f5422a59f07984`. These are isolated audit probes, not additions to the test suite. Run `pnpm run build` first. Save each fenced script to a temporary `.cjs` file and run it from the repository root; it loads `dist` and the installed Playwright. Browser launch requires an installed Chromium. Watchdogs detect pending operations; they do not cancel underlying work.

## Lifecycle, snapshot, and loading probes

```javascript
const root = process.cwd();
const { chromium } = require(root + '/node_modules/@playwright/test');
const { useTable, Strategies } = require(root + '/dist');
const outputs = [];
async function bounded(promise, ms=300) {
  let timer;
  try { return await Promise.race([promise.then(value=>({settled:true,value}),error=>({settled:true,error:String(error)})), new Promise(resolve=>{timer=setTimeout(()=>resolve({settled:false}),ms);})]); }
  finally { clearTimeout(timer); }
}
(async () => {
 const browser=await chromium.launch();
 const html='<table id="t"><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr data-index="0"><td>zero</td><td>b0</td></tr><tr data-index="1"><td>one</td><td>b1</td></tr></tbody></table>';
 const base={autoScroll:false,strategies:{loading:{isHeaderLoading:Strategies.Loading.Headers.never}}};
 async function fresh(){ const page=await browser.newPage(); await page.setContent(html); return page; }
 {
  const page=await fresh(); let detected=0;
  const table=useTable(page.locator('#t'), {...base, strategies:{...base.strategies,pagination:{detectCurrentPage:async()=>{detected++;return 2;}}}});
  const row=await table.findRow({A:'zero'}); await table.init();
  outputs.push({probe:'auto-init detectCurrentPage',detected,currentPageIndex:table.currentPageIndex,rowPage:row.tablePageIndex});
  await page.close();
 }
 {
  const page=await fresh();
  const table=useTable(page.locator('#t'), {...base,concurrency:'synchronized',strategies:{...base.strategies,viewport:{getVisibleColumnRange:async()=>({first:0,last:1})}}});
  const rows=await table.findRows();
  outputs.push({probe:'findRows synchronized then read only first row',rowCount:rows.length,result:await bounded(rows[0].toJSON())});
  await page.close();
 }
 {
  const page=await fresh();
  await page.locator('tbody tr').nth(1).evaluate(el=>el.remove());
  const table=useTable(page.locator('#t'), {...base,strategies:{...base.strategies,resolveRowIndex:async row=>Number(await row.getAttribute('data-index')),contentReady:async row=>row.evaluate(el=>{el.dataset.index='9';el.children[0].textContent='WRONG-ROW-9';})}});
  const row=await table.findRowByIndex(0);
  outputs.push({probe:'atomic target disappears during contentReady',expectedIndex:0,result:await bounded(row.toJSON({atomic:true}))});
  await page.close();
 }
 {
  const page=await fresh();
  await page.locator('tbody tr').evaluateAll(rows=>rows.forEach(r=>r.removeAttribute('data-index')));
  const viewport=Strategies.Viewport.dataAttribute();
  const logs=[]; const saved=console.error; console.error=(...args)=>logs.push(args.join(' '));
  const context={root:page.locator('#t'),page,config:{rowSelector:'tbody tr',cellSelector:'td',debug:{logLevel:'error'},strategies:{}},resolve:(selector,parent)=>parent.locator(selector)};
  const rows=await viewport.getVisibleRowRange(context); const columns=await viewport.getVisibleColumnRange(context);
  console.error=saved;
  outputs.push({probe:'missing dataAttribute attributes',rows,columns,logs});
  await page.close();
 }
 {
  const page=await fresh(); let firstCalls=0;
  const table=useTable(page.locator('#t'), {...base,strategies:{...base.strategies,pagination:{goNext:async()=>false,goToFirst:async()=>{firstCalls++;return true;}}}});
  const row=await table.findRow({A:'zero'}); await row.bringIntoView();
  outputs.push({probe:'bringIntoView already on target page without goToPage',firstCalls,currentPageIndex:table.currentPageIndex});
  await page.close();
 }
 {
  const page=await fresh();
  const table=useTable(page.locator('#t'), {...base,strategies:{...base.strategies,loading:{...base.strategies.loading,isRowLoading:async()=>new Promise(()=>{}),rowLoadingTimeout:50,onRowLoadingTimeout:'throw'}}});
  outputs.push({probe:'rowLoadingTimeout=50 with never-settling predicate',result:await bounded(table.findRows())});
  await page.close();
 }
 {
  const page=await fresh();
  const table=useTable(page.locator('#t'), {...base,strategies:{...base.strategies,loading:{...base.strategies.loading,isCellLoading:async()=>new Promise(()=>{}),cellLoadingTimeout:50,onCellLoadingTimeout:'throw'}}});
  await table.init();
  outputs.push({probe:'cellLoadingTimeout=50 with never-settling predicate',result:await bounded(table.getRowByIndex(0).toJSON())});
  await page.close();
 }
 {
  const page=await fresh();
  const table=useTable(page.locator('#t'), {autoScroll:false,strategies:{loading:{isHeaderLoading:async()=>new Promise(()=>{})}}});
  outputs.push({probe:'init timeout=50 with never-settling header predicate',result:await bounded(table.init({timeout:50}))});
  await page.close();
 }
 await browser.close();
 process.stdout.write(JSON.stringify(outputs,null,2)+'\n');
})().catch(error=>{console.error(error);process.exitCode=1;});
```

Observed output:

```json
[
  {
    "probe": "auto-init detectCurrentPage",
    "detected": 0,
    "currentPageIndex": 0,
    "rowPage": 0
  },
  {
    "probe": "findRows synchronized then read only first row",
    "rowCount": 2,
    "result": {
      "settled": false
    }
  },
  {
    "probe": "atomic target disappears during contentReady",
    "expectedIndex": 0,
    "result": {
      "settled": true,
      "value": {
        "A": "WRONG-ROW-9",
        "B": "b0"
      }
    }
  },
  {
    "probe": "missing dataAttribute attributes",
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
    "probe": "bringIntoView already on target page without goToPage",
    "firstCalls": 1,
    "currentPageIndex": 0
  },
  {
    "probe": "rowLoadingTimeout=50 with never-settling predicate",
    "result": {
      "settled": false
    }
  },
  {
    "probe": "cellLoadingTimeout=50 with never-settling predicate",
    "result": {
      "settled": false
    }
  },
  {
    "probe": "init timeout=50 with never-settling header predicate",
    "result": {
      "settled": false
    }
  }
]

```

## Dedupe, mounted index, cache, and synthetic probes

```javascript
const root=process.cwd();
const { chromium }=require(root+'/node_modules/@playwright/test');
const { useTable,Strategies }=require(root+'/dist');
(async()=>{
 const browser=await chromium.launch(); const results=[];
 const page=await browser.newPage();
 const html='<table id="t"><thead><tr><th>Name</th></tr></thead><tbody><tr id="row"><td>A</td></tr></tbody></table>';
 const loading={isHeaderLoading:Strategies.Loading.Headers.never};
 await page.setContent(html); let n=0;
 const t=useTable(page.locator('#t'),{autoScroll:false,maxPages:2,strategies:{loading,dedupe:Strategies.Dedupe.byTopPosition(),pagination:{goNext:async()=>{if(n++)return false;await page.locator('#row td').evaluate(el=>el.textContent='B');return true;}}}});
 results.push({probe:'byTopPosition recycled slot with different record',expected:['A','B'],actual:await t.map(({row})=>row.getValue('Name'))});
 await page.setContent('<table id="t"><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr data-ri="100"><td>HUNDRED</td><td>other</td></tr></tbody></table>');
 const q=useTable(page.locator('#t'),{autoScroll:false,strategies:{loading,resolveRowIndex:async row=>Number(await row.getAttribute('data-ri'))}});await q.init();
 for(const atomic of [false,true]){try{results.push({probe:'getRowByIndex(0) read in logical-index-100 window',atomic,result:await q.getRowByIndex(0).toJSON({atomic})});}catch(e){results.push({probe:'getRowByIndex(0) read in logical-index-100 window',atomic,error:e.message});}}
 await page.setContent('<table id="t"><thead><tr><th>Name</th></tr></thead><tbody><tr><td>A</td></tr><tr><td>B</td></tr></tbody></table>');
 let visible=[0];let oracleCalls=0;
 const c=useTable(page.locator('#t'),{autoScroll:false,strategies:{loading,viewport:{getVisibleRowIndices:async()=>{oracleCalls++;return visible;}}}});
 results.push({probe:'viewport cache first scan',result:await c.map(({row})=>row.getValue('Name'))});
 visible=[0,1];await c.revalidate();results.push({probe:'viewport cache scan after revalidate',result:await c.map(({row})=>row.getValue('Name')),oracleCalls});
 await c.reset();results.push({probe:'viewport cache scan after reset',result:await c.map(({row})=>row.getValue('Name')),oracleCalls});
 await page.setContent(html);
 const synthetic=useTable(page.locator('#t'),{autoScroll:false,strategies:{loading},syntheticColumns:{First:{compute:async row=>row.getValue('Name')},Second:{compute:async row=>row.getValue('First')}}});await synthetic.init();const s=synthetic.getRowByIndex(0);
 try{await s.getValue('Second');}catch(e){results.push({probe:'synthetic chaining getValue',error:e.message});}
 results.push({probe:'synthetic chaining toJSON',result:await s.toJSON()});
 await browser.close();console.log(JSON.stringify(results,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
```

Observed output:

```json
[
  {
    "probe": "byTopPosition recycled slot with different record",
    "expected": [
      "A",
      "B"
    ],
    "actual": [
      "A"
    ]
  },
  {
    "probe": "getRowByIndex(0) read in logical-index-100 window",
    "atomic": false,
    "error": "[SmartTable] toJSON: row 0 recycled out of the DOM mid-read and could not be recovered — the returned object would mix fields from different rows. Ensure a viewport.scrollToRow can restore the row."
  },
  {
    "probe": "getRowByIndex(0) read in logical-index-100 window",
    "atomic": true,
    "error": "[SmartTable] toJSON({ atomic: true }): row 0 recycled out of the DOM and could not be recovered. Ensure a viewport.scrollToRow strategy can restore the row."
  },
  {
    "probe": "viewport cache first scan",
    "result": [
      "A"
    ]
  },
  {
    "probe": "viewport cache scan after revalidate",
    "result": [
      "A"
    ],
    "oracleCalls": 1
  },
  {
    "probe": "viewport cache scan after reset",
    "result": [
      "A"
    ],
    "oracleCalls": 1
  },
  {
    "probe": "synthetic chaining getValue",
    "error": "[SmartTable] Synthetic column \"First\" cannot be read from inside another synthetic column's compute(). Synthetic columns may only reference real or override columns."
  },
  {
    "probe": "synthetic chaining toJSON",
    "result": {
      "Name": "A",
      "First": "A",
      "Second": "A"
    }
  }
]

```

## Header discovery from a nonzero starting position

This deterministic scrolling oracle isolates the shared header strategy. It models an eight-column strip, 100 px columns, three mounted headers, initial offset 400 px, and 300 px steps. It demonstrates the missing reset-window collection without browser timing.

```javascript
const { Strategies } = require(process.cwd() + "/dist");
const el = { scrollLeft: 400 };
const handle = { evaluate: async (fn, arg) => fn(el, arg) };
const context = {
  root: { evaluateHandle: async () => handle },
  config: { headerSelector: ".header" },
  page: { waitForTimeout: async () => {} },
  resolve: () => ({ allInnerTexts: async () =>
    Array.from({ length: 3 }, (_, i) => String(Math.floor(el.scrollLeft / 100) + i))
      .filter(n => Number(n) < 8) }),
};
Strategies.Header.horizontalScroll({ selector: ".scroller", scrollAmount: 300 })(context)
  .then(console.log);
// Expected: ["0", "1", "2", "3", "4", "5", "6", "7"]
// Actual:   ["4", "5", "6", "3", "7"]
```
