import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {runPerspectiveBridgeAudit,SOURCES,SOURCE_COMMIT} from './perspective-bridge-audit.mjs';
const okay=(url)=>({ok:true,url,headers:new Headers({'content-type':'text/plain'}),body:(async function*(){yield Buffer.from('export const a=1;')})()});
test('audits only two pinned owner sources via the actual REA runner interface',async()=>{
 const seen=[],logs=[];
 const report=await runPerspectiveBridgeAudit({fetcher:async url=>okay(url),analyze:async payload=>{
  seen.push(payload.sourcePaths[0]);
  assert.equal((await fs.readFile(payload.root+'/'+payload.sourcePaths[0],'utf8')).trim(),'export const a=1;');
  return {rawResultPresent:true,tool:'analyze_javascript_application',evidenceId:'ev_fake_for_test',statistics:{},coverage:'partial'};
 },log:(...args)=>logs.push(args)});
 assert.deepEqual(seen,SOURCES);
 assert.equal(report.completed,2);
 assert.ok(logs.some(x=>x[0]==='[rea-perspective-result]'));
 assert.ok(logs.filter(x=>x[0]==='[rea-perspective-evidence]').length===2);
});
test('rejects redirection and oversized input',async()=>{
 await assert.rejects(runPerspectiveBridgeAudit({fetcher:async url=>({...okay(url),url:'https://attacker.test/a'}),log:()=>{},analyze:async()=>{throw Error('must not execute')}}),/Pinned/);
 await assert.rejects(runPerspectiveBridgeAudit({fetcher:async url=>({...okay(url),headers:new Headers({'content-length':'32769'})}),log:()=>{}}),/exceeds limit/);
});
test('failure receipts never claim REA success',async()=>{
 const r=await runPerspectiveBridgeAudit({fetcher:async url=>okay(url),analyze:async()=>{throw Error('REA budget')},log:()=>{}});
 assert.equal(r.completed,0);assert.equal(r.results.length,2);assert.ok(r.results.every(x=>x.status==='failed'&&!x.evidenceId));
 assert.ok(SOURCES.every(x=>x.endsWith('.ts')));
 assert.equal(SOURCE_COMMIT.length,40);
});
