import { chromium } from '@playwright/test';
import { useTable } from '@rickcedwhat/playwright-smart-table';
import { createHash } from 'node:crypto';
import { readFile, writeFile, realpath } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { sep } from 'node:path';
import { readGrid } from './grid-dom.mjs';
import { createConfig, proposal } from './config.mjs';
const consumerPackage = await realpath(fileURLToPath(import.meta.resolve('@rickcedwhat/playwright-smart-table')));
if (!consumerPackage.startsWith(process.cwd()+sep)) throw new Error('Library resolved outside disposable consumer');
const input=JSON.parse(await readFile('input.json','utf8'));
const browser=await chromium.launch(), page=await browser.newPage();
page.setDefaultTimeout(2000);
let stopping=false;
for(const signal of ['SIGTERM','SIGINT'] as const)process.once(signal,()=>{stopping=true;void browser.close().finally(()=>process.exit(1));});
let actions=0,pages=0,termination='error',rewind='failed',configExecuted=false;
const records: {id:string;values:Record<string,string>}[]=[], diagnostics:string[]=[];
const checks={init:false,query:false,extraction:false,reset:false};
let start={url:input.url as string,ids:[] as string[],values:[] as Record<string,string>[],scroll:{top:0,left:0,maxTop:0,maxLeft:0}}, end=start;
let revision:string|null=null;
const identities=new Map<string,{index:number;values:string}>(), indices=new Map<number,string>(), windows=new Set<string>();
const selector={header:proposal.header,row:proposal.row,cell:proposal.cell,scroller:proposal.virtualization.scroller};
async function observe(track=true){
 const root=page.locator(proposal.root);
 const deadline=Date.now()+1500;
 let grid=await root.evaluate(readGrid,selector);
 while(!grid.ready && Date.now()<deadline){await page.waitForTimeout(25);grid=await root.evaluate(readGrid,selector);}
 if(!grid.ready)throw new Error('readiness-timeout');
 if(grid.issues.length)throw new Error('unsupported: '+grid.issues.join(' '));
 if(grid.identityUnknown)throw new Error('identity-unknown');
 if(revision!==null && revision!==grid.revision)throw new Error('state-changed');
 revision=grid.revision;
 for(const row of grid.entries){
  if(row.id===null || row.index===null)throw new Error('identity-unknown');
  const known=identities.get(row.id), value=JSON.stringify(row.values);
  if(known && (known.index!==row.index || known.values!==value))throw new Error('state-changed');
  if(indices.has(row.index) && indices.get(row.index)!==row.id)throw new Error('state-changed');
  if(track){identities.set(row.id,{index:row.index,values:value});indices.set(row.index,row.id);}
 }
 const key=JSON.stringify(grid.entries.map(row=>row.id));
 if(track && !windows.has(key)){if(windows.size>=input.budget.maxPages)throw new Error('page-budget');windows.add(key);pages=windows.size;}
 end={url:grid.url,ids:grid.entries.map(row=>row.id!),values:grid.entries.map(row=>row.values),scroll:grid.scroll};
 return grid;
}
try{
 await page.goto(input.url,{waitUntil:'domcontentloaded'});
 const initial=await observe(false);start=end;
 if(proposal.expectedState){
  const raw=await page.locator(proposal.root).evaluate(el=>JSON.stringify([el.outerHTML,el.scrollTop,el.scrollLeft]));
  if(createHash('sha256').update(raw).digest('hex')!==proposal.expectedState.fingerprint)throw new Error('state-changed');
 }
 const config=createConfig(page,async()=>{await observe(false);if(actions>=input.budget.maxActions)throw new Error('action-budget');actions++;});
 config.maxPages=input.budget.maxPages;configExecuted=true;
 const table=useTable(page.locator(proposal.root),config);
 await table.init();checks.init=true;
 await table.reset();
 if((await observe(false)).scroll.top!==0)throw new Error('Rewind failed');rewind='established';
 windows.clear();identities.clear();indices.clear();
 const first=await observe();
 const firstVisible=first.entries.find(row=>row.visible)!;
 const [column,value]=Object.entries(firstVisible.values)[0];
 const found=await table.findRows({[column]:value},{maxPages:1,exact:true});
 const wanted=first.entries.filter(row=>row.visible && row.values[column]===value).map(row=>row.id).sort();
 const actual=await Promise.all(found.map(row=>row.getAttribute('data-id')));
 checks.query=JSON.stringify(actual.sort())===JSON.stringify(wanted);
 if(!checks.query)throw new Error('Representative query lost record occurrences');
 const pagination=config.strategies!.pagination!, next=pagination.goNext!;
 pagination.goNext=async context=>{
  const before=await observe();
  if(before.scroll.top>=before.scroll.maxTop-1){termination='scroll-end';return false;}
  if(windows.size>=input.budget.maxPages)throw new Error('page-budget');
  const moved=await next(context);const after=await observe();
  if(!moved || after.scroll.top<=before.scroll.top)throw new Error('ineffective-control');
  return true;
 };
 await table.map(async({row})=>{
  await observe();
  if(records.length>=input.budget.maxRows)throw new Error('row-budget');
  const id=await row.getAttribute('data-id');if(!id)throw new Error('identity-unknown');
  const values=await row.toJSON({atomic:true});
  if(identities.get(id)?.values!==JSON.stringify(values))throw new Error('Library extraction disagrees with current grid');
  records.push({id,values});return id;
 },{maxPages:input.budget.maxPages,concurrency:'sequential'});
 const last=await observe();
 termination=last.scroll.top>=last.scroll.maxTop-1?'scroll-end':'page-budget';
 if(termination==='scroll-end' && identities.size!==last.count)throw new Error('unsupported: Declared row count contradicts the observed traversal');
 if(termination==='scroll-end' && records.length!==identities.size)throw new Error('Extraction omitted observed occurrences');
 checks.extraction=records.length>0;
 await table.reset();checks.reset=(await observe(false)).scroll.top===0;
 void initial;
}catch(error){const message=error instanceof Error?error.message:String(error);diagnostics.push(message);termination=['action-budget','page-budget','row-budget','state-changed','identity-unknown','readiness-timeout','ineffective-control'].includes(message)?message:message.startsWith('unsupported')?'unsupported':'error';}
finally{
 if(!stopping)await writeFile('result.json',JSON.stringify({consumerPackage,browserVersion:browser.version(),configExecuted,checks,records,diagnostics,
  status:termination==='scroll-end' && Object.values(checks).every(Boolean)?'tested':['action-budget','page-budget','row-budget'].includes(termination)?'partial':'failed',
  traversal:{start,end,actions,pages,rewind,restoration:'unchanged-original-session',termination}}));
 await browser.close();
}
