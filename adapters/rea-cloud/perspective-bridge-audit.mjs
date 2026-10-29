import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {inspectWithRea} from './studio-audit.mjs';

// Immutable, owner-authored GitHub source revision. Do not fetch mod binaries.
const REPO='codysumpter-cloud/prismtek-site';
export const SOURCE_COMMIT='7b73760d21e93148499d8607662c18ca5e08fc50';
export const SOURCES=Object.freeze([
 'src/prismStudioPerspectiveBridge.ts',
 'src/prismStudioAuthoredWorldImport.ts'
]);
const LIMIT=32*1024;
const sha256=b=>createHash('sha256').update(b).digest('hex');
const short=e=>String(e?.message||e).replace(/[\r\n]/g,' ').slice(0,180);

/** Bounded, read-only REA analysis of two immutable first-party source modules. */
export async function runPerspectiveBridgeAudit({fetcher=fetch,analyze=inspectWithRea,log=console.log}={}){
 let root;
 const results=[];
 try{
  root=await fs.mkdtemp(path.join(os.tmpdir(),'rea-perspective-bridge-'));
  for(const relative of SOURCES){
   const url=`https://raw.githubusercontent.com/${REPO}/${SOURCE_COMMIT}/${relative}`;
   const response=await fetcher(url,{redirect:'error',signal:AbortSignal.timeout(15000),headers:{accept:'text/plain'}});
   if(!response.ok||response.url!==url)throw Error('Pinned GitHub source unavailable');
   const length=Number(response.headers.get('content-length')||0);
   if(length>LIMIT)throw Error('Perspective module exceeds limit');
   const chunks=[];let size=0;
   for await(const chunk of response.body){size+=chunk.length;if(size>LIMIT)throw Error('Perspective module exceeds limit');chunks.push(Buffer.from(chunk));}
   if(!size)throw Error('Empty Perspective module');
   const content=Buffer.concat(chunks,size),file=path.join(root,relative);
   await fs.mkdir(path.dirname(file),{recursive:true});
   await fs.writeFile(file,content,{flag:'wx',mode:0o600});
   const manifest={path:relative,sha256:sha256(content),bytes:size,sourceCommit:SOURCE_COMMIT};
   log('[rea-perspective-source]',JSON.stringify(manifest));
   try{
    // inspectWithRea calls the actual internal REA 6.8.0 MCP one file at a time.
    const analysis=await analyze({root,sourcePaths:[relative],files:[manifest]});
    if(!analysis?.rawResultPresent||!analysis.evidenceId)throw Error('REA produced no evidence ID');
    const receipt={...manifest,status:'completed',tool:analysis.tool,evidenceId:analysis.evidenceId,
     statistics:analysis.statistics,coverage:analysis.coverage,
     limitations:['Static source analysis only; no executable target or runtime parity proven']};
    results.push(receipt);
    log('[rea-perspective-evidence]',JSON.stringify(receipt).slice(0,3600));
   }catch(e){const receipt={...manifest,status:'failed',error:short(e)};
    results.push(receipt);log('[rea-perspective-failure]',JSON.stringify(receipt));}
  }
  const report={sourceRepo:REPO,sourceCommit:SOURCE_COMMIT,results,
   completed:results.filter(x=>x.status==='completed').length,requested:SOURCES.length,
   notExamined:['Worldfall gameplay hooks','Project Viewpoint binary','live simulation and 3D physics parity']};
  log('[rea-perspective-result]',JSON.stringify(report).slice(0,7500));
  return report;
 }catch(e){log('[rea-perspective-error]',short(e));throw e;}
 finally{if(root)await fs.rm(root,{recursive:true,force:true,maxRetries:3});}
}
