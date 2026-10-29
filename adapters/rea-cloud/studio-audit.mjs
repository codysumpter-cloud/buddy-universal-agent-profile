import fs from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import {rpc} from './mcp-selftest.mjs';

const OWNER_PROJECTS=new Set(['prismtek-live-studio','rea','racing-game','media-maker','dude-creator','pocket-bird','slayblade','prismtek-world','necessities','prismtek-poke-arena','everything-is-prismtek','playground','super-tiny-life','pixel-sand-physics-and-destruction','world-of-pixelcraft','king-of-the-pirates','ninja-game','pokemon-fan-game','super-tiny-farm','wild-pixels','pixel-art-physics','solar-realm-2']);
const MAX_FILE=2*1024*1024,MAX_TOTAL=5*1024*1024,MAX_JS=6;
const CORS={'cache-control':'no-store','content-type':'application/json','x-content-type-options':'nosniff'};
const report=(res,code,data)=>{res.writeHead(code,CORS);res.end(JSON.stringify(data));};
const bad=(code,msg)=>Object.assign(new Error(msg),{status:code});
const safeName=s=>/^[a-zA-Z0-9_.-]+\.js$/.test(s)&&!s.includes('..');
async function readBounded(response,limit){
 const reader=response.body?.getReader();if(!reader)throw bad(502,'Remote response missing body');
 const chunks=[];let bytes=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>limit)throw bad(413,'Remote resource exceeds safe limit');chunks.push(Buffer.from(value));}}
 finally{await reader.cancel().catch(()=>{});}
 return Buffer.concat(chunks,bytes);
}
async function safeFetch(url,limit,fetcher){
 const response=await fetcher(url,{redirect:'error',signal:AbortSignal.timeout(15000),headers:{accept:'text/html,application/javascript,text/javascript,*/*'}});
 if(!response.ok)throw bad(502,'Owner preview resource returned '+response.status);
 return readBounded(response,limit);
}

/** Public production Studio audit. Bounded, read-only, no executable downloads. */
export async function captureLivePublicStudio({fetcher=fetch}={}){
 const page='https://prismtek.dev/pixel-studio/';
 const html=(await safeFetch(page,1024*1024,fetcher)).toString('utf8');
 const boot=html.match(/src=["']\/assets\/(index-[A-Za-z0-9_-]+\.js)["']/)?.[1];
 if(!boot)throw bad(422,'Live Studio page has no known main module');
 const manifest=(await safeFetch('https://prismtek.dev/assets/'+boot,750000,fetcher)).toString('utf8');
 const modules=[...new Set([...manifest.matchAll(/["']assets\/(prismStudio(?:ParticleFx|PhaserAuthoring)-[A-Za-z0-9_-]+\.js)["']/g)].map(m=>m[1]))].sort();
 if(modules.length!==2)throw bad(422,'Studio particle/engine modules not discoverable');
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'rea-live-studio-'));
 const files=[],sourcePaths=[];let total=0;
 try{
  await fs.mkdir(path.join(root,'assets'),{recursive:true});
  for(const name of modules){
   const bytes=await safeFetch('https://prismtek.dev/assets/'+name,65000,fetcher);
   if(!bytes.length)throw bad(422,'Published Studio source is empty');
   total+=bytes.length;if(total>130000)throw bad(413,'Live Studio intake exceeds 130 KiB budget');
   await fs.writeFile(path.join(root,'assets',name),bytes,{flag:'wx',mode:0o600});
   const relative='assets/'+name;sourcePaths.push(relative);
   files.push({path:relative,sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length});
  }
  return {root,sourcePaths,files,sha256:createHash('sha256').update(JSON.stringify(files)).digest('hex'),
   limitation:'Only two public runtime modules; the large Studio layout/renderer chunk and original private source are excluded.'};
 }catch(e){await fs.rm(root,{recursive:true,force:true});throw e;}
}

export async function captureOwnedPreview(slug,{fetcher=fetch}={}){
 if(slug==='prismtek-live-studio')return captureLivePublicStudio({fetcher});
 if(!OWNER_PROJECTS.has(slug))throw bad(400,'Only a listed owner PixelLab project can be scanned');
 const origin='https://'+slug+'.pixellab.run/';
 const html=(await safeFetch(origin,1024*1024,fetcher)).toString('utf8');
 const queue=[];
 const add=x=>{if(safeName(x)&&!queue.includes(x))queue.push(x);};
 for(const m of html.matchAll(/(?:src|href)=["'](?:\.\/|\/)?assets\/([a-zA-Z0-9_.-]+\.js)["']/g))add(m[1]);
 if(!queue.length)throw bad(422,'Preview HTML contains no directly referenceable JavaScript bundles');
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'prismtek-rea-preview-'));
 await fs.mkdir(path.join(root,'assets'),{recursive:true});
 let total=0;const selected=[],digests=[];
 try{
  for(let i=0;i<queue.length&&selected.length<MAX_JS;i++){
   const name=queue[i];
   const file=await safeFetch(origin+'assets/'+name,MAX_FILE,fetcher);
   total+=file.byteLength;
   if(total>MAX_TOTAL)throw bad(413,'Total preview JavaScript exceeds the analysis admission limit');
   await fs.writeFile(path.join(root,'assets',name),file,{flag:'wx'});
   selected.push('assets/'+name);
   digests.push({path:'assets/'+name,sha256:createHash('sha256').update(file).digest('hex'),bytes:file.byteLength});
   const source=file.toString('utf8');
   for(const m of source.matchAll(/(?:assets\/|\.\/)([a-zA-Z0-9_.-]+\.js)/g))if(queue.length<24)add(m[1]);
  }
  if(!selected.length)throw bad(422,'No JavaScript bundles could be admitted');
  return {root,sourcePaths:selected,files:digests,sha256:createHash('sha256').update(JSON.stringify(digests)).digest('hex')};
 }catch(e){await fs.rm(root,{recursive:true,force:true});throw e;}
}
/** Native REA MCP tool call. Does not execute downloaded target JavaScript. */
export async function inspectWithRea({root,sourcePaths,files=[]},port=8765){
 // The free Render host cannot safely retain 20k semantic nodes in the parent MCP heap.
 // Inspect the smallest source first; preserve the full captured manifest as unexamined scope.
 const listed=Array.isArray(files)?files.filter(f=>sourcePaths.includes(f.path)):[];
 const ordered=listed.length?[...listed].sort((a,b)=>a.bytes-b.bytes||a.path.localeCompare(b.path)).map(f=>f.path):sourcePaths;
 const selectedPaths=ordered.slice(0,1);
 if(!selectedPaths.length)throw Error('No JavaScript source to analyze');
 const version='2025-11-25';
 const init=await rpc(port,{jsonrpc:'2.0',id:301,method:'initialize',params:{protocolVersion:version,capabilities:{},clientInfo:{name:'prismtek-studio-owner-audit',version:'1.0.0'}}},undefined,25000);
 if(init.result?.error||!init.result?.result||!init.sessionId)throw Error('REA MCP initialize failed');
 await rpc(port,{jsonrpc:'2.0',method:'notifications/initialized'},init.sessionId,15000);
 const result=await rpc(port,{jsonrpc:'2.0',id:302,method:'tools/call',params:{name:'analyze_javascript_application',arguments:{input_path:root,format:'directory',source_paths:selectedPaths,max_semantic_nodes:256,max_semantic_nodes_per_file:128,max_semantic_unknowns:128,max_semantic_unknowns_per_file:64,max_heap_mb:256,analysis_timeout_ms:45000,detail:'summary'}}},init.sessionId,105000);
 if(result.result?.error||result.result?.result?.isError||!result.result?.result){
  const t=result.result?.result?.content?.find(x=>x.type==='text')?.text||'';
  let failure={};try{const obj=JSON.parse(t);failure=obj.error||obj;}catch{failure={message:t.slice(0,120)};}
  const details=failure.details||{};
  console.warn('[rea-preview-analysis-error]',JSON.stringify({code:String(failure.code||'unknown').slice(0,80),resource:String(details.resource||'unknown').slice(0,80),retryable:failure.retryable===true,reportedLimits:Object.fromEntries(Object.entries(details.reported_limits||{}).filter(([k,v])=>typeof v==='number'&&/memory|heap|budget|bytes|timeout/.test(k)).map(([k,v])=>[k,Math.round(v)]).slice(0,8)),remediationAction:String(failure.remediation?.action||'').slice(0,100)}));
  let diagnostic=String(failure.code||failure.message||'core-tool-failure');
  if(failure.code==='resource_constraint'&&details.resource==='transport'&&details.reported_limits?.evidence_reference){
   const ref=details.reported_limits.evidence_reference;
   const source=typeof ref==='string'?{kind:'retained-evidence',evidence_id:ref}:ref;
   const view=await rpc(port,{jsonrpc:'2.0',id:303,method:'tools/call',params:{name:'inspect_analysis_view',arguments:{source,view:{kind:'summary'}}}},init.sessionId,60000);
   if(!view.result?.error&&!view.result?.result?.isError&&view.result?.result){const v=view.result.result;let payload=v.structuredContent;try{if(!payload)payload=JSON.parse(v.content?.find(x=>x.type==='text')?.text||'{}');}catch{payload={};}const o=payload?.normalized_result||payload;const summary=o?.summary||o;return {tool:'analyze_javascript_application',evidenceId:o?.parent_evidence_id||source.evidence_id||null,statistics:summary?.statistics||{},coverage:summary?.coverage?.application?.status||'partial',limitations:(o?.limitations||[]).slice(0,8),rawResultPresent:true,projection:'retained-evidence-summary',sourceSelection:{analyzed:selectedPaths,uninspected:sourcePaths.filter(p=>!selectedPaths.includes(p))}};}
  }
  throw Error('REA analyze_javascript_application '+diagnostic.slice(0,140));
 }
 const response=result.result.result;
 let payload=response.structuredContent;
 if(!payload){const text=response.content?.find(x=>x.type==='text')?.text||'';try{payload=JSON.parse(text)}catch{payload={note:text.slice(0,600)}}}
 const resultBody=payload?.result||payload;
 const data=resultBody?.normalized_result||resultBody||{};
 const statistics=data?.summary?.statistics||data?.statistics||data?.summary?.normalized_result?.summary?.statistics||{};
 return {tool:'analyze_javascript_application',evidenceId:resultBody.evidence_id||data.evidence_id||null,statistics,coverage:data?.coverage?.status||data?.summary?.coverage?.application?.status||'partial',limitations:(data.limitations||resultBody.limitations||[]).slice(0,8),rawResultPresent:true,sourceSelection:{analyzed:selectedPaths,uninspected:sourcePaths.filter(p=>!selectedPaths.includes(p))}};
}
export function createPreviewAudit({runner=inspectWithRea,fetcher=fetch,limitJobs=12}={}){
 const jobs=new Map(),safeJob=job=>({id:job.id,slug:job.slug,status:job.status,stage:job.stage,createdAt:job.createdAt,finishedAt:job.finishedAt||null,manifest:job.manifest||null,result:job.result||null,error:job.error||null});
 let active=false;
 return {
  get:(id)=>jobs.has(id)?safeJob(jobs.get(id)):null,
  list:()=>[...jobs.values()].map(safeJob),
  start(slug){
   if(!OWNER_PROJECTS.has(slug))throw bad(400,'Unknown owner project slug');
   if(active)throw bad(429,'REA scan already in progress; poll its result before starting another');
   if(jobs.size>=limitJobs)throw bad(409,'REA job limit reached; restart/copy summaries before creating another');
   const job={id:randomUUID(),slug,status:'queued',stage:'admission',createdAt:new Date().toISOString()};
   jobs.set(job.id,job);active=true;
   void(async()=>{let capture;
    try{
     job.status='running';job.stage='capture-source';
     capture=await captureOwnedPreview(slug,{fetcher});
     job.manifest={sha256:capture.sha256,files:capture.files};
     job.stage='rea-mcp-analysis';
     job.result=await runner(capture);
     job.status='completed';job.stage='done';
    }catch(e){job.status='failed';job.stage='failed';job.error=typeof e?.status==='number'?'Admission '+e.status+': '+e.message:String(e?.message||e).slice(0,180);}
    finally{if(capture)await fs.rm(capture.root,{recursive:true,force:true}).catch(()=>{});job.finishedAt=new Date().toISOString();active=false;}
   })();
   return safeJob(job);
  }
 };
}
export function createAuditHandler(audit){
 return async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/audit/preview'&&req.method==='POST'){
   if(!String(req.headers['content-type']||'').startsWith('application/json'))return report(res,415,{error:'JSON request required'});
   const chunks=[];let size=0;
   for await(const chunk of req){size+=chunk.length;if(size>1024)return report(res,413,{error:'Request exceeds 1 KB'});chunks.push(chunk);}
   let data;try{data=JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{return report(res,400,{error:'Invalid JSON'});}
   try{return report(res,202,audit.start(data.slug));}catch(e){return report(res,e.status||500,{error:String(e.message).slice(0,180)});}
  }
  const match=url.pathname.match(/^\/audit\/jobs\/([a-f0-9-]{36})$/);
  if(match&&req.method==='GET'){const job=audit.get(match[1]);return job?report(res,200,job):report(res,404,{error:'Audit not found'});}
  return report(res,404,{error:'Not found'});
 };
}