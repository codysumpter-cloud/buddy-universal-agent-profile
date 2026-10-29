import test from 'node:test';
import assert from 'node:assert/strict';
import {deflateRawSync} from 'node:zlib';
import {selectedZipEntries,runWorldfallPerspectiveAudit} from './perspective-mod-audit.mjs';
function zip(entries){
 let local=[],central=[],off=0;
 for(const [name,text] of entries){
  const n=Buffer.from(name),raw=Buffer.from(text),compressed=deflateRawSync(raw);
  const lh=Buffer.alloc(30);lh.writeUInt32LE(0x04034b50,0);lh.writeUInt16LE(8,8);lh.writeUInt32LE(compressed.length,18);lh.writeUInt32LE(raw.length,22);lh.writeUInt16LE(n.length,26);
  local.push(lh,n,compressed);
  const h=Buffer.alloc(46);h.writeUInt32LE(0x02014b50,0);h.writeUInt16LE(8,10);h.writeUInt32LE(compressed.length,20);h.writeUInt32LE(raw.length,24);h.writeUInt16LE(n.length,28);h.writeUInt32LE(off,42);central.push(h,n);
  off+=lh.length+n.length+compressed.length;
 }
 const dir=Buffer.concat(central),e=Buffer.alloc(22);e.writeUInt32LE(0x06054b50,0);e.writeUInt16LE(entries.length,8);e.writeUInt16LE(entries.length,10);e.writeUInt32LE(dir.length,12);e.writeUInt32LE(off,16);
 return Buffer.concat([...local,dir,e]);
}
test('strict, bounded archive select only takes DLL and license',()=>{
 const b=zip([['outside.txt','skip'],['nested/Worldfall.dll','metadata bytes'],['LICENSE.txt','Copyright 2026']]);
 const selected=selectedZipEntries(b);
 assert.deepEqual([...selected.keys()].sort(),['LICENSE.txt','Worldfall.dll']);
 assert.equal(selected.get('Worldfall.dll').toString(),'metadata bytes');
});
test('invalid and truncated archives are rejected',()=>{
 assert.throws(()=>selectedZipEntries(Buffer.alloc(12)),/ZIP bounds/);
 const b=zip([['Worldfall.dll','hi']]);
 assert.throws(()=>selectedZipEntries(b.subarray(0,22)),/ZIP directory|ZIP bounds/);
});
test('unverified downloads never reach REA',async()=>{
 let called=false;
 const fakeFetch=async()=>({ok:true,url:'https://github.com/s3cond2/worldfall/releases/download/beta-0.9.8.9/Worldfall.zip',
  body:(async function*(){yield zip([['Worldfall.dll','fake bytes'],['LICENSE.txt','Copyright 2026']]);})()});
 await assert.rejects(runWorldfallPerspectiveAudit({fetcher:fakeFetch,call:async()=>{called=true;throw Error('must not call')},log:()=>{}}),/SHA-256 mismatch/);
 assert.equal(called,false);
});
