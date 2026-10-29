import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {captureFullBonk,inspectWholeBonk,runFullBonkAudit} from './full-bonk-audit.mjs';
const fakeFetch=async url=>new Response('export const source="'+new URL(url).pathname+'";',{status:200});
test('whole BONK archive captures every runtime source, not one preview bundle',async()=>{
 const x=await captureFullBonk({fetcher:fakeFetch});
 try{
  assert.equal(x.codeFiles,30);assert.equal(x.files.length,33);
  assert.ok(x.files.some(f=>f.path.endsWith('/core.mjs')));
  assert.ok(x.files.some(f=>f.path.endsWith('/render3d.mjs')));
  assert.ok(x.files.every(f=>f.sha256.length===64));
  assert.ok(x.missingCoverage.some(f=>f.includes('Worker')));
 }finally{await fs.rm(x.base,{recursive:true,force:true})}
});
test('REA MCP request covers all captured source paths',async()=>{
 const messages=[];
 const call=async(port,m)=>{messages.push(m);
  if(m.method==='initialize')return {result:{result:{serverInfo:{name:'REA'}}},sessionId:'session'};
  if(m.method==='notifications/initialized')return {result:null};
  return { result: { result: { structuredContent: {
   evidence_id: 'ev_mock', normalized_result: { statistics: { parsed_javascript_files: 30 } }
  } } } };
 };
 const result=await inspectWholeBonk({root:'/tmp/bonk-full',codeFiles:30,files:Array(33),
  missingCoverage:[],commit:'a',manifestSha256:'digest'},{call});
 assert.equal(result.evidenceId,'ev_mock');
 assert.equal(messages[2].params.name,'analyze_javascript_application');
 assert.equal(messages[2].params.arguments.input_path,'/tmp/bonk-full');
 assert.equal('source_paths' in messages[2].params.arguments,false);
});
test('failed full REA job still cleans up the temporary source tree',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'rea-bonk-unit-'));
 await assert.rejects(runFullBonkAudit({capture:async()=>({base:root,root,files:[],
  codeFiles:30,commit:'a',sourceUrl:'https://fixture.invalid',bytes:0,
  manifestSha256:'digest'}),inspect:async()=>{throw Error('injected')},log:()=>{}}),/injected/);
 await assert.rejects(fs.access(root));
});
