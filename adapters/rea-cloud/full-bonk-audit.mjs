/** Whole deployed BONK browser game static analysis using the actual Render REA MCP.
 * Fixed public Cloudflare Pages revision: no arbitrary URLs or user code execution.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {rpc} from './mcp-selftest.mjs';

const ORIGIN='https://5f4b30ee.prismtek-site.pages.dev/prismcade/poke-arena-bonk/';
const COMMIT='6b6b83036804dcb203bccd0fcafad9732cafbe06';
const MODULES=['animation','combat-types','core','forest-art-direction','forest-layout',
 'forest-world-props','guardian-phases','input','main','meowth-shop','move-effects',
 'movement','national-dex','pmd-action-bridge','pmd-league-sheet-map','progression',
 'quaternius-nature','regional-wildlife','render3d','roster','run-stats','settings',
 'slide-momentum','species-types','stage-encounters','stage-props','survival-pacts',
 'terrace-reference','terrain-world','upgrade-assets'].map(n=>n+'.mjs');
const FILES=[...MODULES,'index.html','README.md','POKEAPI-LICENSE.md'];
const sha256=data=>createHash('sha256').update(data).digest('hex');
async function getBounded(url,{fetcher=fetch,maxBytes=2*1024*1024}={}){
 const response=await fetcher(url,{redirect:'error',signal:AbortSignal.timeout(18000),
  headers:{accept:'application/javascript,text/html,text/plain,*/*'}});
 if(!response.ok)throw Error('Deployed BONK resource returned '+response.status+' '+url.slice(-70));
 const reader=response.body?.getReader();if(!reader)throw Error('No response body');
 const chunks=[];let bytes=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;
  bytes+=value.byteLength;if(bytes>maxBytes)throw Error('Deployed game source file exceeds per-file budget');
  chunks.push(Buffer.from(value));}}
 finally{await reader.cancel().catch(()=>{});}
 return Buffer.concat(chunks,bytes);
}
export async function captureFullBonk({fetcher=fetch,rootPrefix=os.tmpdir()}={}){
 const base=await fs.mkdtemp(path.join(rootPrefix,'prismtek-rea-bonk-'));
 const root=path.join(base,'target');
 const relative='public/prismcade/poke-arena-bonk';
 try{
  await fs.mkdir(path.join(root,relative),{recursive:true});
  const files=[];let total=0;
  for(const name of FILES){
   const data=await getBounded(ORIGIN+name,{fetcher});
   total+=data.length;if(total>12*1024*1024)throw Error('Source capture exceeds total budget');
   await fs.writeFile(path.join(root,relative,name),data,{flag:'wx',mode:0o600});
   files.push({path:relative+'/'+name,bytes:data.length,sha256:sha256(data),type:name.endsWith('.mjs')?'javascript':'documentation'});
  }
  if(files.filter(x=>x.type==='javascript').length!==MODULES.length)throw Error('Incomplete runtime module selection');
  return {base,root,files,commit:COMMIT,sourceUrl:ORIGIN,
   codeFiles:MODULES.length,bytes:total,manifestSha256:sha256(JSON.stringify(files)),
   missingCoverage:['Cloudflare Worker implementation source is not served by Pages',
    'Assets loaded from R2/upstream are not embedded in the published JS',
    'Source-level tests are not published as browser runtime assets']};
 }catch(e){await fs.rm(base,{recursive:true,force:true}).catch(()=>{});throw e;}
}
function unwrappedError(response){
 if(response?.error)return response.error.message||'Protocol error';
 const inner=response?.result;
 if(inner?.isError){const text=inner.content?.find(x=>x.type==='text')?.text||'';
  try{const o=JSON.parse(text);return o?.error?.code||o?.code||text.slice(0,180);}catch{return text.slice(0,180);}}
 return null;
}
export async function inspectWholeBonk(snapshot,{port=8765,call=rpc}={}){
 const version='2025-11-25';
 const init=await call(port,{jsonrpc:'2.0',id:610,method:'initialize',
  params:{protocolVersion:version,capabilities:{},clientInfo:{name:'prismtek-bonk-whole-game-audit',version:'1.0'}}},undefined,25000);
 if(init.result?.error||!init.result?.result||!init.sessionId)throw Error('REA MCP session initialization failed');
 await call(port,{jsonrpc:'2.0',method:'notifications/initialized'},init.sessionId,15000);
 // No source_paths: REA must visit ALL captured gameplay source modules.
 const arguments_={input_path:snapshot.root,format:'directory',integrity_policy:'record-and-continue',
  max_semantic_nodes:6500,max_semantic_nodes_per_file:1200,
  max_semantic_unknowns:6000,max_semantic_unknowns_per_file:1100,
  max_heap_mb:256,analysis_timeout_ms:150000,detail:'summary'};
 const response=await call(port,{jsonrpc:'2.0',id:611,method:'tools/call',params:{
  name:'analyze_javascript_application',arguments:arguments_}},init.sessionId,200000);
 const problem=unwrappedError(response.result);
 if(problem)throw Error('REA analyze_javascript_application: '+String(problem).slice(0,160));
 const raw=response.result?.result?.structuredContent||{};
 const data=raw.normalized_result||raw.result?.normalized_result||raw;
 const summary=data?.summary||data;
 const evidenceId=data.parent_evidence_id||raw.evidence_id||raw.result?.evidence_id||null;
 if(!evidenceId)throw Error('REA did not return authenticated Evidence identity');
 return {tool:'analyze_javascript_application',evidenceId,
  statistics:summary.statistics||{},coverage:summary.coverage||{},
  limitations:(summary.limitations||raw.limitations||[]).slice(0,10),
  manifestSha256:snapshot.manifestSha256,commit:snapshot.commit,
  capturedModules:snapshot.codeFiles,capturedFiles:snapshot.files.length,
  missingCoverage:snapshot.missingCoverage};
}
export async function runFullBonkAudit({capture=captureFullBonk,inspect=inspectWholeBonk,log=console.log}={}){
 let artifact;
 try{
  log('[rea-bonk-full] starting static capture of all shipped game modules');
  artifact=await capture();
  log('[rea-bonk-full-manifest]',JSON.stringify({commit:artifact.commit,origin:artifact.sourceUrl,
   codeModules:artifact.codeFiles,files:artifact.files.length,bytes:artifact.bytes,
   manifestSha256:artifact.manifestSha256}));
  const result=await inspect(artifact);
  log('[rea-bonk-full-result]',JSON.stringify(result).slice(0,9500));
  return result;
 }catch(e){log('[rea-bonk-full-error]',String(e?.message||e).slice(0,350));throw e;}
 finally{if(artifact?.base)await fs.rm(artifact.base,{recursive:true,force:true});}
}