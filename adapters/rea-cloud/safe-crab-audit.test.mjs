import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {Readable} from 'node:stream';
import {readFile,access} from 'node:fs/promises';
import {runSafeCrabSourceAudit,CRAB_SOURCE_SPECS} from './safe-crab-audit.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');
const original='// owned example source\nexport const example = 42;\n';
const fixture={file:'example.js',sha256:sha(original)};
const okFetch=async url=>({ok:true,status:200,url,headers:new Headers({'content-type':'text/javascript'}),body:Readable.from([Buffer.from(original)])});
test('pinned six original authored JavaScript modules have complete SHA256s',()=>{
 assert.equal(CRAB_SOURCE_SPECS.length,6);
 assert.equal(new Set(CRAB_SOURCE_SPECS.map(x=>x.file)).size,6);
 for(const x of CRAB_SOURCE_SPECS)assert.match(x.sha256,/^[a-f0-9]{64}$/);
});
test('one real adapter invocation per source, with evidence, source cleaning and no assets',async()=>{
 let path,root,calls=0;const logs=[];
 const report=await runSafeCrabSourceAudit({sources:[fixture],fetcher:okFetch,log:(...x)=>logs.push(x),
  analyze:async input=>{
   calls++;path=input.sourcePaths[0];root=input.root;
   assert.equal(await readFile(root+'/'+path,'utf8'),original);
   assert.deepEqual(input.sourcePaths,['crab-recovery/example.js']);
   return {rawResultPresent:true,evidenceId:'ev_test_verified',tool:'analyze_javascript_application',statistics:{parsed_javascript_files:1}};
  }});
 assert.equal(calls,1);assert.equal(report.completed,1);
 assert.equal(report.results[0].evidenceId,'ev_test_verified');
 await assert.rejects(access(root));
 assert.ok(logs.some(x=>x[0]==='[rea-crab-report]'));
});
test('SHA mismatch fail-closed without calling REA',async()=>{
 let invoked=0;
 const report=await runSafeCrabSourceAudit({sources:[{file:'example.js',sha256:'a'.repeat(64)}],fetcher:okFetch,log:()=>{},analyze:async()=>{invoked++}});
 assert.equal(invoked,0);assert.equal(report.failed,1);
 assert.match(report.results[0].error,/SHA-256 mismatch/);
});
test('wrong HTML response cannot be passed to the analyzer',async()=>{
 const fetcher=async url=>({ok:true,status:200,url,headers:new Headers({'content-type':'text/html'}),body:Readable.from([Buffer.from(original)])});
 const report=await runSafeCrabSourceAudit({sources:[fixture],fetcher,log:()=>{},analyze:()=>{throw Error('should not execute')}});
 assert.equal(report.completed,0);assert.match(report.results[0].error,/MIME/);
});
