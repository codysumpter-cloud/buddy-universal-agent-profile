import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {rpc} from './mcp-selftest.mjs';

/** Owner-authorized, single-file, 160 MiB REA inspection; no source execution.
 * Select a target with REA_ARENA_MODE_TARGET=menu|arena3d|squad, not a broad scan.
 * Never start if another heavy audit is selected; target bytes are ephemeral.
 */
const targets=Object.freeze({
 menu:'arena/src-b87385a6af/escenas/titulo.js',
 arena3d:'arena/pmd3d/arena3d-bridge.js',
 squad:'arena/src-b87385a6af/escenas/squad.js'
});
const origin='https://prismtek-poke-arena.pixellab.run/';
function unwrap(r){
 if(r?.result?.error||!r?.result?.result||r.result.result.isError)throw Error('REA tool returned an error');
 let o=r.result.result.structuredContent;
 if(!o)try{o=JSON.parse(r.result.result.content?.find(x=>x.type==='text')?.text||'{}')}catch{o={}}
 return o.result?.normalized_result||o.normalized_result||o;
}
export async function runArenaModeAudit({target='menu',fetcher=fetch,call=rpc,log=console.log}={}){
 if(!Object.hasOwn(targets,target))throw Error('Unknown owner Arena module');
 const rel=targets[target],url=origin+rel;
 let dir;
 try{
  const res=await fetcher(url,{redirect:'error',signal:AbortSignal.timeout(18000)});
  if(!res.ok||!String(res.headers.get('content-type')||'').includes('javascript'))throw Error('Original Arena module unavailable');
  const length=Number(res.headers.get('content-length')||0);
  if(length>65000)throw Error('Arena source exceeds safe limit');
  let size=0;const parts=[];
  for await(const chunk of res.body){size+=chunk.length;if(size>65000)throw Error('Arena module exceeded 65 KiB');parts.push(Buffer.from(chunk));}
  const bytes=Buffer.concat(parts),sha256=createHash('sha256').update(bytes).digest('hex');
  if(!size)throw Error('Source was empty');
  dir=await mkdtemp(path.join(tmpdir(),'rea-arena-mode-'));
  await writeFile(path.join(dir,'target.js'),bytes,{mode:0o600,flag:'wx'});
  log('[rea-arena-source]',JSON.stringify({target,source:url,sha256,bytes:size,retention:'ephemeral'}));
  const init=await call(8765,{jsonrpc:'2.0',id:950,method:'initialize',params:{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'prismtek-arena-mode-audit',version:'1.0'}}},undefined,18000);
  if(!init.sessionId||!init.result?.result)throw Error('REA MCP initialize unavailable');
  await call(8765,{jsonrpc:'2.0',method:'notifications/initialized'},init.sessionId,12000);
  const args={input_path:dir,format:'directory',source_paths:['target.js'],detail:'summary',
   max_semantic_nodes:64,max_semantic_nodes_per_file:64,max_semantic_unknowns:32,max_semantic_unknowns_per_file:32,
   max_heap_mb:160,analysis_timeout_ms:20000};
  const actual=unwrap(await call(8765,{jsonrpc:'2.0',id:951,method:'tools/call',params:{name:'analyze_javascript_application',arguments:args}},init.sessionId,52000));
  const report={target,sha256,bytes:size,tool:'analyze_javascript_application',evidenceId:actual.parent_evidence_id||actual.evidence_id||null,
   statistics:actual.summary?.statistics||actual.statistics||null,
   coverage:actual.summary?.coverage||actual.coverage||null,
   limitations:['One source module only','Static REA graph does not prove executed game behavior']};
  log('[rea-arena-evidence]',JSON.stringify(report).slice(0,4000));
  return report;
 }catch(e){
  log('[rea-arena-error]',JSON.stringify({target,reason:String(e?.message||e).slice(0,220)}));
  throw e;
 }finally{if(dir)await rm(dir,{recursive:true,force:true,maxRetries:2});}
}
