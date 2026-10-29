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
 for(const name of ['../evil.js','evil.ts','evil/abc.js','a..b.js'])assert.throws(()=>jobs.start({...item,name}));
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
