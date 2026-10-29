import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createUploadAudit} from './studio-upload.mjs';
const until=async(fn)=>{for(let i=0;i<100;i++){if(fn())return;await new Promise(r=>setTimeout(r,10));}throw Error('job did not settle');};
const item={name:'demo.js',content:Buffer.from('const x=42;'),owner:'owner',basis:'Authorized original source analysis',attested:true};
test('runner receives temporary file; source is deleted afterward',async()=>{
 let folder;
 const jobs=createUploadAudit({runner:async capture=>{
  folder=capture.root;
  assert.deepEqual(capture.sourcePaths,['demo.js']);
  assert.equal(await fs.readFile(folder+'/demo.js','utf8'),'const x=42;');
  return {rawResultPresent:true,evidenceId:'ev-test',statistics:{parsedFiles:1},coverage:'partial'};
 }});
 const first=jobs.start(item);
 await until(()=>jobs.get(first.id)?.status==='completed');
 assert.equal(jobs.get(first.id).engine,'rea-mcp-6.8');
 assert.equal(jobs.get(first.id).findings[0].citation,'REA evidence ev-test');
 await assert.rejects(()=>fs.access(folder));
 assert.equal(jobs.remove(first.id),true);
 assert.equal(jobs.get(first.id),null);
});
test('rejects unauthorized input and filenames',()=>{
 const jobs=createUploadAudit({runner:async()=>({rawResultPresent:true})});
 for(const name of ['../evil.js','evil.exe','evil/abc.js','a..b.js'])assert.throws(()=>jobs.start({...item,name}));
 assert.throws(()=>jobs.start({...item,attested:false}),/attestation/);
 assert.throws(()=>jobs.start({...item,basis:'short'}),/authorization basis/);
 assert.throws(()=>jobs.start({...item,content:Buffer.alloc(262145)}),/256 KiB/);
});
test('only one active upload; metadata does not retain source',async()=>{
 let resolve;
 const jobs=createUploadAudit({runner:()=>new Promise(r=>{resolve=r})});
 const job=jobs.start(item);
 await until(()=>typeof resolve==='function');
 assert.throws(()=>jobs.start({...item,name:'other.js'}),/already running/);
 assert.throws(()=>jobs.remove(job.id),/still running/);
 resolve({rawResultPresent:true,evidenceId:'e2'});
 await until(()=>jobs.get(job.id)?.status==='completed');
 assert.equal(JSON.stringify(jobs.get(job.id)).includes('const x=42'),false);
});

test('Render REA accepts original TypeScript modules for analysis',async()=>{
 let received;
 const manager=createUploadAudit({runner:async input=>{received=input.sourcePaths;return{rawResultPresent:true,evidenceId:'ev-ts',statistics:{parsed_javascript_files:1}};}});
 const job=manager.start({...item,name:'editor.ts',content:Buffer.from('export const scene = 1;')});
 await until(()=>manager.get(job.id)?.status==='completed');
 assert.deepEqual(received,['editor.ts']);
 assert.equal(manager.get(job.id)?.result?.evidenceId,'ev-ts');
});

test('batch source import preserves module paths, provenance, and per-file evidence',async()=>{
 const seen=[];let folder;
 const manager=createUploadAudit({runner:async({root,sourcePaths,files})=>{
  folder=root;seen.push(sourcePaths[0]);
  assert.equal(sourcePaths.length,1);
  assert.equal(files[0].sha256.length,64);
  assert.match(await fs.readFile(root+'/'+sourcePaths[0],'utf8'),/export/);
  return {rawResultPresent:true,evidenceId:'ev-'+seen.length,statistics:{parsed_javascript_files:1},coverage:'partial'};
 }});
 const files=[
  {path:'src/studio/editor.ts',content:Buffer.from('export const editor=1;')},
  {path:'src/studio/portable.ts',content:Buffer.from('export const portable=2;')},
  {path:'src/rea/core.mjs',content:Buffer.from('export const core=3;')}
 ];
 const j=manager.start({files,owner:'Prismtek',basis:'Authorized owner original Studio sources',attested:true});
 await until(()=>manager.get(j.id)?.status==='completed');
 assert.deepEqual(seen,files.map(f=>f.path));
 const receipt=manager.get(j.id);
 assert.equal(receipt.fileCount,3);
 assert.equal(receipt.result.analyzed,3);
 assert.equal(receipt.result.uninspected,0);
 assert.equal(receipt.result.results[2].evidenceId,'ev-3');
 assert.equal(JSON.stringify(receipt).includes('export const'),false);
 await assert.rejects(fs.access(folder));
});
test('file-count, total-size, path-traversal and case-folding limits fail closed',()=>{
 const manager=createUploadAudit({runner:async()=>({rawResultPresent:true})});
 const base={owner:'Prismtek',basis:'Authorized owner original Studio sources',attested:true};
 const file=(name,data='export const x=1;')=>({path:name,content:Buffer.from(data)});
 for(const path of ['../x.ts','/etc/passwd.ts','foo\\bar.ts','a//b.ts','a/./b.ts','a/../b.ts','src/.env.ts','evil.exe']){
  assert.throws(()=>manager.start({...base,files:[file(path)]}),/Invalid.*path|size limits/i,path);
 }
 assert.throws(()=>manager.start({...base,files:[file('A.ts'),file('a.ts')]}),/Duplicate/);
 assert.throws(()=>manager.start({...base,files:Array.from({length:25},(_,i)=>file('f'+i+'.ts'))}),/1–24/);
 assert.throws(()=>manager.start({...base,files:Array.from({length:5},(_,i)=>file('f'+i+'.ts','x'.repeat(225000)))}),/1 MiB/);
});
test('partial analysis is not mistaken for complete reconstruction',async()=>{
 let folder;
 const manager=createUploadAudit({runner:async({root,sourcePaths})=>{
  folder=root;
  if(sourcePaths[0]==='b.ts')throw Error('MCP resource_constraint');
  return {rawResultPresent:true,evidenceId:'ev-a',coverage:'partial'};
 }});
 const j=manager.start({files:[{path:'a.ts',content:Buffer.from('export const a=1;')},{path:'b.ts',content:Buffer.from('export const b=2;')}],
  owner:'Prismtek',basis:'Authorized original source',attested:true});
 await until(()=>manager.get(j.id)?.status==='partial');
 const receipt=manager.get(j.id);
 assert.equal(receipt.result.analyzed,1);
 assert.deepEqual(receipt.result.sourceSelection.uninspected,['b.ts']);
 assert.equal(receipt.result.results[1].status,'failed');
 assert.equal(receipt.status,'partial');
 await assert.rejects(fs.access(folder));
});