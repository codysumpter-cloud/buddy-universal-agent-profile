import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {inspectWithRea} from './studio-audit.mjs';

// Pinned, independently authored JS from the owner's published Everything is Prismtek
// project. Retail assets/Unity binaries/private metadata are NOT fetched or copied.
const ORIGIN='https://everything-is-prismtek.pixellab.run';
export const CRAB_SOURCE_SPECS=Object.freeze([
 {file:'core.js',sha256:'109882bee5ed722279ca48cb627c95d7dfae4c755ecf00abb977a028888b0c8b'},
 {file:'evo-system.js',sha256:'4f062b651d4915d6447dcea05f01e6b57b39b3aff860b0d7aaaa2d9d9cde5f32'},
 {file:'game.js',sha256:'c3b79bc3f3b1bcf89a9426b5e86da0029e9da1ba8299a28f9449872aeb4a1120'},
 {file:'controller.js',sha256:'5eee1df8892570bc31109d4f3a4514b9ebc274ef5a4aaf5e20bff6ab1c91d025'},
 {file:'effects.js',sha256:'d3463f6bf3915445b8d6b8d39cab28389005f9347417867b3c8bde102a0b1862'},
 {file:'source-menus.js',sha256:'88eb5d1bf61f1b9a8a84c8cfeed31d56d3905fe65761c4cb59437fadbf496d07'}
]);
const hash=b=>createHash('sha256').update(b).digest('hex');
const short=e=>String(e?.message||e).replace(/[\r\n]/g,' ').slice(0,180);
const MAX_BYTES=80*1024;

async function readPinnedSource(spec,fetcher){
 if(!/^[a-z0-9-]+\.js$/.test(spec.file)||!/^[a-f0-9]{64}$/.test(spec.sha256))throw Error('Invalid pinned source declaration');
 const url=ORIGIN+'/crab-recovery/'+spec.file;
 const response=await fetcher(url,{redirect:'error',headers:{accept:'text/javascript,application/javascript'},signal:AbortSignal.timeout(15000)});
 if(!response.ok||response.url!==url)throw Error('Pinned source request rejected: '+spec.file+' (HTTP '+response.status+')');
 const type=String(response.headers.get('content-type')||'').toLowerCase();
 if(!/javascript|text\/plain/.test(type))throw Error('Unexpected source MIME type: '+spec.file);
 if(Number(response.headers.get('content-length')||0)>MAX_BYTES)throw Error('Source size limit exceeded: '+spec.file);
 const chunks=[];let total=0;
 if(!response.body)throw Error('Source response has no body');
 for await(const chunk of response.body){total+=chunk.byteLength;if(total>MAX_BYTES)throw Error('Source size limit exceeded: '+spec.file);chunks.push(Buffer.from(chunk));}
 if(total<16)throw Error('Source too small: '+spec.file);
 const bytes=Buffer.concat(chunks,total),digest=hash(bytes);
 if(digest!==spec.sha256)throw Error('Pinned SHA-256 mismatch: '+spec.file);
 return bytes;
}

/** One-shot opt-in REAL Render REA MCP analysis; never copies retail assets.
 * Six small JavaScript modules, each independently inspected using REA's
 * existing 256 MiB bounded tool call and sequential ephemeral cleanup.
 */
export async function runSafeCrabSourceAudit({
 fetcher=fetch,analyze=inspectWithRea,log=console.log,sources=CRAB_SOURCE_SPECS,
}={}){
 if(!Array.isArray(sources)||sources.length<1||sources.length>6)throw Error('Choose 1–6 pinned source files');
 let root;const results=[];const startedAt=new Date().toISOString();
 try{
  root=await fs.mkdtemp(path.join(os.tmpdir(),'rea-everything-is-prismtek-'));
  await fs.mkdir(path.join(root,'crab-recovery'),{recursive:true});
  for(const spec of sources){
   const relative='crab-recovery/'+spec.file;let filePath;
   try{
    const bytes=await readPinnedSource(spec,fetcher);
    filePath=path.join(root,relative);
    await fs.writeFile(filePath,bytes,{flag:'wx',mode:0o600});
    const file={path:relative,sha256:spec.sha256,bytes:bytes.length};
    log('[rea-crab-input]',JSON.stringify(file));
    const audit=await analyze({root,sourcePaths:[relative],files:[file]});
    if(!audit?.rawResultPresent||!audit.evidenceId)throw Error('REA did not return retained evidence');
    const receipt={...file,status:'completed',tool:audit.tool||'analyze_javascript_application',evidenceId:audit.evidenceId,
     statistics:audit.statistics||{},coverage:audit.coverage||'partial',sourceSelection:audit.sourceSelection||null};
    results.push(receipt);
    log('[rea-crab-evidence]',JSON.stringify(receipt).slice(0,3600));
   }catch(error){
    const receipt={path:relative,sha256:spec.sha256,status:'failed',error:short(error)};
    results.push(receipt);log('[rea-crab-failure]',JSON.stringify(receipt));
   }finally{if(filePath)await fs.rm(filePath,{force:true}).catch(()=>{});}
  }
  const report={project:'Everything is Prismtek',source:'published-reconstructed-game-JavaScript',
   sourceOrigin:ORIGIN,startedAt,finishedAt:new Date().toISOString(),requested:sources.length,
   completed:results.filter(r=>r.status==='completed').length,failed:results.filter(r=>r.status!=='completed').length,
   results,notAnalyzed:['Retail IL2CPP method bodies','private Unity assets','original Unity executable','full native-game behavioral parity'],
   limitations:['Static REA source inspection only','Pinned to 2026-10-29 public source snapshot','No permission to redistribute commercial Unity assets']};
  log('[rea-crab-report]',JSON.stringify(report).slice(0,15000));
  return report;
 }finally{if(root)await fs.rm(root,{recursive:true,force:true,maxRetries:3,retryDelay:100}).catch(e=>log('[rea-crab-cleanup-error]',short(e)));}
}
