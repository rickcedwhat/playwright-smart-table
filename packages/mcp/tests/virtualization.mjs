import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
const reservation=createServer();await new Promise(resolve=>reservation.listen(0,'127.0.0.1',resolve));const port=reservation.address().port;await new Promise(resolve=>reservation.close(resolve));
const origin=`http://127.0.0.1:${port}`;
const server=spawn(process.execPath,['dist/index.js','--http'],{cwd:new URL('../',import.meta.url),env:{...process.env,MCP_PORT:String(port)},stdio:['ignore','ignore','pipe']});server.stderr.resume();
const exited=new Promise(resolve=>server.once('exit',resolve));
const client=new Client({name:'virtualization-regression',version:'1'}), transport=new StreamableHTTPClientTransport(new URL(origin+'/mcp'));
const transcript=[];let browser;
const expected=JSON.parse(readFileSync(new URL('./bench/recycling-oracle.json',import.meta.url),'utf8')).records;
async function call(name,args,options){const result=await client.callTool({name,arguments:args},undefined,{timeout:125000,...options});transcript.push({name,args,result});if(result.isError)throw new Error(result.content[0].text);return result.structuredContent;}
async function open(name){return call('open_session',{url:origin+'/fixtures/'+name});}
const close=id=>call('close_session',{sessionId:id});
try{
 for(let i=0;i<100;i++){try{if((await fetch(origin+'/health')).ok)break;}catch{}await new Promise(resolve=>setTimeout(resolve,25));}
 await client.connect(transport);
 browser=await chromium.launch();const page=await browser.newPage();
 await page.goto(origin+'/fixtures/recycling');await page.waitForFunction(()=>document.querySelector('[role=grid]')?.getAttribute('aria-busy')==='false');
 assert.equal(await page.locator('[role=row]').count(),6);
 assert.ok(!(await page.content()).includes('Sol'));
 const row=await page.locator('[data-slot="0"]').elementHandle(), before=await row.getAttribute('data-id');
 await page.locator('#recycling').evaluate(el=>{el.scrollTop=320;});
 await page.waitForFunction(()=>document.querySelector('[data-slot="0"]')?.getAttribute('data-index')==='7');
 assert.notEqual(await row.getAttribute('data-id'),before,'Same DOM node must represent a different record after scroll');
 assert.equal(await page.locator('[role=row]').count(),6);
 for(const fixture of ['recycling','recycling?start=8','recycling-delayed','recycling-hostile']){
  const session=await open(fixture), proposed=await call('propose_config',{sessionId:session.id});
  const observed=await call('inspect_virtualization',{sessionId:session.id});assert.equal(observed.evidence.sessionId,session.id);assert.equal(observed.evidence.kind,'dom-snapshot');assert.equal(observed.status,'observed');assert.equal(observed.fullDatasetVerified,false);
  const probe=await call('probe_virtualization',{sessionId:session.id,proposal:proposed.proposal,budget:{maxPages:10,maxActions:20}});
  assert.equal(probe.status,'tested');assert.equal(probe.traversal.restoration,'restored');
  const result=await call('validate_config',{sessionId:session.id,proposal:proposed.proposal,budget:{maxPages:10,maxActions:20}});
  console.log(fixture,result.status,result.traversal.termination,result.records.length,result.diagnostics);
  assert.equal(result.status,'tested');assert.equal(result.traversal.rewind,'established');
  assert.deepEqual([...result.records].sort((a,b)=>a.id.localeCompare(b.id)),expected);
  assert.equal(result.fullDatasetVerified,false);
  const comparison=await fetch(origin+'/bench/validate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({runId:result.runId,fixture:fixture.split('?')[0]})});
  const scored=await comparison.json();assert.equal(scored.configValidated,true,JSON.stringify(scored));
  if(fixture.includes('start=8'))assert.ok(result.traversal.start.scroll.top>0);
  await close(session.id);
 }
 for(const fixture of ['recycling-no-id','recycling-missing','recycling-repeated']){
  const session=await open(fixture);await new Promise(resolve=>setTimeout(resolve,100));
  const result=await call('inspect_virtualization',{sessionId:session.id});assert.equal(result.identity,'unknown');assert.equal(result.status,'unknown');
  await assert.rejects(call('propose_config',{sessionId:session.id}),/IDENTITY_UNKNOWN/);await close(session.id);
 }
 for(const fixture of ['recycling-pinned','recycling-filler','recycling-horizontal','recycling-offscreen','recycling-contradictory','frame-table','shadow-table','canvas-table']){
  const session=await open(fixture);await new Promise(resolve=>setTimeout(resolve,100));
  const unsupported=await call('inspect_virtualization',{sessionId:session.id});
  assert.equal(unsupported.status,'unsupported',fixture);if(unsupported.mounted===0)assert.equal(unsupported.identity,'unknown');
  await assert.rejects(call('propose_config',{sessionId:session.id}),/UNSUPPORTED/);
  if(fixture==='shadow-table')await assert.rejects(call('validate_config',{sessionId:session.id,proposal:{root:'table',header:'thead th',row:'tbody tr',cell:'td',idAttribute:'data-id'}}),/Unsupported table layout/);
  await close(session.id);
 }
 for(const fixture of ['recycling-local-ids','recycling-changing']){
  const session=await open(fixture),{proposal}=await call('propose_config',{sessionId:session.id});
  const result=await call('validate_config',{sessionId:session.id,proposal,budget:{maxPages:10,maxActions:20}});
  assert.equal(result.status,'failed');assert.equal(result.traversal.termination,'state-changed');await close(session.id);
 }
 const contradictory=await open('recycling-wrong-count'), badCount=await call('propose_config',{sessionId:contradictory.id});
 const contradicted=await call('validate_config',{sessionId:contradictory.id,proposal:badCount.proposal,budget:{maxPages:10,maxActions:20}});
 assert.equal(contradicted.status,'failed');assert.equal(contradicted.traversal.termination,'unsupported');
 const rejected=await fetch(origin+'/bench/validate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({runId:contradicted.runId,fixture:'recycling-wrong-count'})});
 const rejectedScore=await rejected.json();assert.equal(rejectedScore.dataMatches,true);assert.equal(rejectedScore.configValidated,false);await close(contradictory.id);
 const never=await open('recycling-never-ready');await assert.rejects(call('propose_config',{sessionId:never.id}),/READINESS_UNKNOWN/);await close(never.id);
 const stale=await open('recycling-auto-sort'), old=await call('propose_config',{sessionId:stale.id});
 await new Promise(resolve=>setTimeout(resolve,1300));
 await assert.rejects(call('probe_virtualization',{sessionId:stale.id,proposal:old.proposal}),/STALE_EVIDENCE/);
 await assert.rejects(call('validate_config',{sessionId:stale.id,proposal:old.proposal}),/STALE_EVIDENCE/);
 const sortedProposal=await call('propose_config',{sessionId:stale.id});
 const unreproducible=await call('validate_config',{sessionId:stale.id,proposal:sortedProposal.proposal,budget:{maxPages:10,maxActions:20}});
 assert.equal(unreproducible.status,'failed');assert.equal(unreproducible.configExecuted,false);assert.equal(unreproducible.traversal.termination,'state-changed');
 await close(stale.id);
 const partial=await open('recycling'),{proposal}=await call('propose_config',{sessionId:partial.id});
 const limited=await call('validate_config',{sessionId:partial.id,proposal,budget:{maxPages:1}});assert.equal(limited.status,'partial');assert.equal(limited.traversal.termination,'page-budget');
 await close(partial.id);
 console.log('Virtualization cases passed: exact occurrences/values, recycling, overscan, nonzero start, delayed readiness, ambiguity, unsupported surfaces and state changes.');
}finally{
 const directory=new URL('../.mcp-runs/',import.meta.url);mkdirSync(directory,{recursive:true});writeFileSync(new URL('virtualization-'+Date.now()+'.json',directory),JSON.stringify({kind:'deterministic-regression',model:null,transcript},null,2));
 await browser?.close();await transport.terminateSession().catch(()=>undefined);await client.close();server.kill('SIGTERM');await exited;
}
