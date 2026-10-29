import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {rpc} from './mcp-selftest.mjs';

// User-provided private baseline: PokemonPrototypeDemo.pck from the original
// 2026-10-21 Library recovery archive. Only inspect matching published bytes.
const ORIGINAL_SHA256='ec80ffb97caea370bdab7604526f88800f59b8016978a5e9449cb65677324626';
const ORIGINAL_BYTES=31553628;
const ITCH_PAGE='https://thedaigan.itch.io/pba';
const ALLOWED=new Set(['thedaigan.itch.io','html.itch.zone','html-classic.itch.zone','html.itch.zone','html-classic.itch.zone','html2.itch.zone']);
const digest=b=>createHash('sha256').update(b).digest('hex');
const clean=e=>String(e?.message||e).replace(/[\r\n]/g,' ').slice(0,220);
function allowedUrl(uri){
 const u=new URL(uri);
 if(u.protocol!=='https:'||!ALLOWED.has(u.hostname)||u.username||u.password||u.port)return false;
 if(/\.pck$/i.test(u.pathname))return /\/html\/\d+\/[^/]+\.pck$/i.test(u.pathname);
 if(/\.html?$/i.test(u.pathname))return /\/html\/\d+\/[^/]+\.html?$/i.test(u.pathname);
 return u.href===ITCH_PAGE;
}
async function boundedFetch(url,max,fetcher,contentType){
 if(!allowedUrl(url))throw Error('Unapproved published-artifact URL');
 const res=await fetcher(url,{redirect:'error',signal:AbortSignal.timeout(80000)});
 if(!res.ok)throw Error('Published artifact unavailable: '+res.status);
 if(contentType==='html'&&!String(res.headers.get('content-type')||'').includes('text/html'))throw Error('Expected HTML document');
 const chunks=[];let size=0;
 for await(const part of res.body){size+=part.length;if(size>max)throw Error('Published artifact exceeds bound');chunks.push(Buffer.from(part));}
 return Buffer.concat(chunks,size);
}
function detectBrowserFrame(html){
 // itch's own authorized HTML5 game frame; never guess an upload identifier.
 const cleaned=html.replace(/&amp;/g,'&').replace(/\\\//g,'/');
 const m=cleaned.match(/https?:\\/\\/(?:html(?:-classic|2)?\\.)itch\\.zone\\/html\\/\\d+\\/index\\.html/i)
  ||cleaned.match(/\\/\\/(?:html(?:-classic|2)?\\.)itch\\.zone\\/html\\/\\d+\\/index\\.html/i);
 return m?new URL(m[0].startsWith('//')?'https:'+m[0]:m[0]).href:null;
}
function chosenArgument(schema,file){
 const props=schema?.properties||{},required=schema?.required||[];
 for(const key of ['input_path','path','file_path','artifact_path']){
  if(props[key]&&required.every(k=>k===key||props[k]?.default!==undefined))return {[key]:file};
 }
 return null;
}
function unpackRpc(msg){
 if(msg?.result?.error||!msg?.result?.result||msg?.result?.result?.isError){
  const m=msg?.result?.result?.content?.find(c=>c.type==='text')?.text;
  throw Error(String(m||msg?.result?.error?.message||'REA provider failed').slice(0,230));
 }
 const r=msg.result.result;let obj=r.structuredContent;
 if(!obj)try{obj=JSON.parse(r.content?.find(c=>c.type==='text')?.text||'{}');}catch{obj={};}
 return obj.normalized_result||obj.result?.normalized_result||obj;
}
export async function runPokemonPublishedArtifactAudit({fetcher=fetch,call=rpc,log=console.log,pckUrl=null}={}){
 let temporary=null,stage='locate';
 try{
  let uri=pckUrl;
  if(!uri){
   const site=await boundedFetch(ITCH_PAGE,1_700_000,fetcher,'html');
   const frame=detectBrowserFrame(site.toString('utf8'));
   if(!frame)throw Error('Author HTML5 embed URL not exposed; no private-source guessing');
   const frameHtml=await boundedFetch(frame,900_000,fetcher,'html');
   const match=frameHtml.toString('utf8').match(/(?:["'])([^"'<>\\s]+\\.pck)(?:["'])/i);
   if(!match)throw Error('Published browser page does not expose a PCK URL');
   uri=new URL(match[1],frame).href;
  }
  stage='download';
  const source=await boundedFetch(uri,45*1024*1024,fetcher);
  const actual=digest(source);
  log('[rea-pokemon-source]',JSON.stringify({sha256:actual,bytes:source.length,baselineMatch:actual===ORIGINAL_SHA256&&source.length===ORIGINAL_BYTES,sourceHost:new URL(uri).host,scope:'author-published browser file'}));
  if(actual!==ORIGINAL_SHA256||source.length!==ORIGINAL_BYTES)throw Error('Published PCK differs from original Library baseline; refusing version substitution');
  temporary=await fs.mkdtemp(path.join(os.tmpdir(),'rea-pokemon-pck-'));
  const target=path.join(temporary,'PokemonPrototypeDemo.pck');await fs.writeFile(target,source,{flag:'wx',mode:0o600});
  stage='rea-initialize';
  const init=await call(8765,{jsonrpc:'2.0',id:841,method:'initialize',params:{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'prismtek-pokemon-artifact-audit',version:'1.0.0'}}},undefined,30000);
  if(!init?.result?.result||!init.sessionId)throw Error('REA MCP initialize failed');
  await call(8765,{jsonrpc:'2.0',method:'notifications/initialized'},init.sessionId,15000);
  const discovered=unpackRpc(await call(8765,{jsonrpc:'2.0',id:842,method:'tools/list',params:{}},init.sessionId,30000));
  const tool=(discovered.tools||[]).find(t=>t.name==='open_binary');
  if(!tool)throw Error('REA open_binary not advertised');
  const args=chosenArgument(tool.inputSchema,target);
  if(!args)throw Error('REA open_binary schema has unsupported required arguments; refusing guessed invocation');
  stage='rea-open_binary';
  const result=unpackRpc(await call(8765,{jsonrpc:'2.0',id:843,method:'tools/call',params:{name:'open_binary',arguments:args}},init.sessionId,95000));
  const report={target:'PokemonPrototypeDemo.pck',sha256:actual,bytes:source.length,tool:'open_binary',
   evidenceId:result.evidence_id||result.parent_evidence_id||null,
   coverage:result.summary?.coverage||result.coverage||null,
   summary:result.summary?.statistics||result.statistics||null,
   limitations:['PCK static file examination does not demonstrate gameplay behavior','Original 145 source scripts still require per-feature reconstruction tests']};
  log('[rea-pokemon-result]',JSON.stringify(report).slice(0,3500));
  return report;
 }catch(error){log('[rea-pokemon-error]',JSON.stringify({stage,reason:clean(error)}));throw error;}
 finally{if(temporary)await fs.rm(temporary,{recursive:true,force:true,maxRetries:3});}
}
