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
const FALLBACK_ORIGIN='https://feat-bonk-survival-pacts-202.prismtek-site.pages.dev/prismcade/poke-arena-bonk/';
// SHA-256 pinned to the immutable Cloudflare Pages revision above.
const EXPECTED_SHA256={"animation.mjs":"be602a78872ec1e48fdb258f5a5c395905a6c2ab827814f5db4b25f05d99e349","combat-types.mjs":"13f533147bd4f00f591337986f9e80b072562b5e079c71b7470ce6c5af74c28e","core.mjs":"a522801a896b2f9323c5657ed2e16a9016775e74e93948d0289081e3ada495c6","forest-art-direction.mjs":"6b85eff8164c3779804f5dc37cb562ac76b8641eded4c3488fbc76a5c0ee3d42","forest-layout.mjs":"080ce6783dde653522283c1cd59f66c1e5ed874ecd2813dac1ee8c4a3dc43bf5","forest-world-props.mjs":"9d43277bc9276070d249b0892b6cdba5672559254f4291d5ae65b3fc99193719","guardian-phases.mjs":"a287cc4b2fef41468d87b530c9e150f4bff85209353028ccc6d175835e3c600f","input.mjs":"5ae8cc0eb2642cf117518385c2a3e8bbe383b92f83fe16a6072879ed28b6c03f","main.mjs":"e016aa2e45bf13891ab471dde0c8e20a37432d291fd6ececcb381492e95e6bf1","meowth-shop.mjs":"36e18f430a3ad50eb68e6fd07e913ce384d11317779ae6dc4d586e4429b9c20e","move-effects.mjs":"7cb5fd0f1c5287d380de0b6c48419adaad61f3cc312127ffb4b9bbab9f4564bc","movement.mjs":"fe72649662993a2a1c8a50bd03536ad45a5aa325c4daced95081a485f1c7c230","national-dex.mjs":"aa949f9fb4d0bc5bba246024670caf8e3bb0881b1fce68f10cc956f8c350b0bf","pmd-action-bridge.mjs":"bbdbbe5bdf2f164747e3cb341325b66e2cdccf4f8f83bc797d42a540ec7d778c","pmd-league-sheet-map.mjs":"a8bcc8abb7dd9094ffa565969cbacdba7816829728dae6f0fa4f83650d294e8b","progression.mjs":"301f01b88bf121365f1cd99e860c620818b6917f2571fa33b04a5ebb220a10b4","quaternius-nature.mjs":"475ac5c8b0aa0ac917e572d1cfc3a7cf92f1b04263fccaf01fb4b1a1c9bb6dd9","regional-wildlife.mjs":"2304527184e87c6cee7296cc8892f913267777885e7d3a27cb1350b3331c571a","render3d.mjs":"9ece9a9398bb230a953cec7c8e051e6cbadef44726b5743ebdd37c71acfe122a","roster.mjs":"b557f303d2d1c7964314e0ad1113e5e55c04a723b803681d7c70d7f8a5c64718","run-stats.mjs":"abb5ce34c8979890d1b236481c6a2c541ab51b1e39f11d2db2c428ee467989a5","settings.mjs":"2b8895f6a99abdfce20290277a3fd19a168f4170e95de18e633de92d77ff4b00","slide-momentum.mjs":"d985049c6863b3dfd7d423274d5e7234c838cf4f4c488a02213ff4ddc5904d27","species-types.mjs":"6fdea09cf40b1eb4f80133a8f6dad2967119ecadc6f8952880a9521310f40f88","stage-encounters.mjs":"9f5ac7ede27388f2c2db0dc9a2504cf4c2c6b1717fb9eab3f8270aa3d7f7cbea","stage-props.mjs":"636f8cc31307ca3c338d5d0750c1facf7315ba43aaaecff7f57b117ee076576b","survival-pacts.mjs":"9131698491fe52e80905a7318dbfca906589823cbb6d9a17b76c9b4a5d370916","terrace-reference.mjs":"197e683bcca2e5c63ca0de76af89fc4dc4dd35355d441e01096a63c954a3c9bf","terrain-world.mjs":"cb6cedae31bb759d559fb178014fc7d60a90e72795dba0744de53be54c880148","upgrade-assets.mjs":"1a9315d7731f0041204cb0a3c9e546e6ed8c18570e425a504c955d6c1c9c05f8","index.html":"d398667b764c51dd4ab1288a07949bead81dbfd2c7968d02e491c9f4b4cc3355","README.md":"16098ab1d5e39359dc45a0abbaf57938cac9abd9cf17f4533555657b94cab93b","POKEAPI-LICENSE.md":"1c04595dc662981c20956ae4251dfa7b62b475c345eddf98bc9b904cb2373f2c"};
const MODULES=['animation','combat-types','core','forest-art-direction','forest-layout',
 'forest-world-props','guardian-phases','input','main','meowth-shop','move-effects',
 'movement','national-dex','pmd-action-bridge','pmd-league-sheet-map','progression',
 'quaternius-nature','regional-wildlife','render3d','roster','run-stats','settings',
 'slide-momentum','species-types','stage-encounters','stage-props','survival-pacts',
 'terrace-reference','terrain-world','upgrade-assets'].map(n=>n+'.mjs');
const FILES=[...MODULES,'index.html','README.md','POKEAPI-LICENSE.md'];
const sha256=data=>createHash('sha256').update(data).digest('hex');
async function getBounded(url,{fetcher=fetch,maxBytes=2*1024*1024}={}){
 let response;
 try{response=await fetcher(url,{redirect:'error',signal:AbortSignal.timeout(18000),
  headers:{accept:'application/javascript,text/html,text/plain,*/*'}});}
 catch(error){const code=error?.cause?.code||error?.code||'UNKNOWN';
  const reason=String(error?.cause?.message||error?.message||'network error').slice(0,150);
  throw Error('BONK source fetch '+new URL(url).hostname+' '+code+': '+reason);}
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
   let data,firstError=null;
   try{data=await getBounded(ORIGIN+(name==='index.html'?'':name),{fetcher});}
   catch(error){firstError=error;}
   if(!data){
    try{data=await getBounded(FALLBACK_ORIGIN+(name==='index.html'?'':name),{fetcher});}
    catch(error){throw Error('Pinned BONK source unreachable: '+String(firstError?.message||'').slice(0,170)+
     ' / fallback: '+String(error.message).slice(0,170));}
   }
   if(fetcher===fetch&&sha256(data)!==EXPECTED_SHA256[name])
    throw Error('Published BONK source digest mismatch: '+name+'; refusing mixed revisions');
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