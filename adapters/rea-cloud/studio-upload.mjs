import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {inspectWithRea} from './studio-audit.mjs';

export const MAX_SOURCES=24;
export const MAX_SOURCE_BYTES=1024*1024;
const MAX_FILE=256*1024;
const error=(status,message)=>Object.assign(new Error(message),{status});
const digest=content=>createHash('sha256').update(content).digest('hex');
function safePath(name){
 if(typeof name!=='string'||name.length>220||!/\.(?:js|mjs|ts|tsx|jsx)$/i.test(name)||name.includes('\\')||name.includes('..'))return false;
 const parts=name.split('/');
 return parts.length<=10&&parts.every(p=>p.length>=1&&p.length<=100&&/^[a-zA-Z0-9_-][a-zA-Z0-9_.-]*$/.test(p)&&!p.includes('..'));
}
function admit(input){
 if(input.files===undefined&&typeof input.name==='string'&&input.name.includes('/'))throw error(415,'Single-file names cannot contain directories.');
 const raw=input.files===undefined?[{path:input.name,content:input.content}]:input.files;
 if(!Array.isArray(raw)||raw.length<1||raw.length>MAX_SOURCES)throw error(413,'Select 1–24 source files.');
 if(input.files!==undefined&&(input.name!==undefined||input.content!==undefined))throw error(400,'Choose one upload representation.');
 const seen=new Set();let size=0;
 const files=raw.map(f=>{
  if(!safePath(f?.path))throw error(415,'Invalid JavaScript/TypeScript relative source path.');
  const canonical=f.path.toLowerCase();if(seen.has(canonical))throw error(409,'Duplicate source path.');seen.add(canonical);
  if(!Buffer.isBuffer(f.content)||!f.content.length||f.content.length>MAX_FILE)throw error(413,'Each source must be 1–256 KiB.');
  size+=f.content.length;if(size>MAX_SOURCE_BYTES)throw error(413,'Total source exceeds 1 MiB.');
  return {path:f.path,content:f.content,bytes:f.content.length,sha256:digest(f.content)};
 });
 return {files,size,sha256:digest(JSON.stringify(files.map(f=>({path:f.path,sha256:f.sha256,bytes:f.bytes}))))};
}
/** One owner-authorized job, one sequential REA call per source, never a fake whole-tree claim.
 * Each file stays separately bounded for Render free-instance transport and heap limits. */
export function createUploadAudit({runner=inspectWithRea,maxJobs=20}={}){
 if(typeof runner!=='function')throw Error('REA runner required');
 const jobs=new Map();let active=false;
 const view=j=>({id:j.id,name:j.name,size:j.size,fileCount:j.fileCount,sha256:j.sha256,
  createdAt:j.createdAt,authorization:j.authorization,status:j.status,engine:'rea-mcp-6.8',
  findings:j.findings||[],logs:j.logs||[],checklist:[],result:j.result||null,error:j.error||null,
  retention:'ephemeral-metadata-only'});
 return {
  list:()=>[...jobs.values()].map(view),
  get:id=>jobs.has(id)?view(jobs.get(id)):null,
  remove(id){const j=jobs.get(id);if(!j)return false;if(['queued','running'].includes(j.status))throw error(409,'Analysis still running');return jobs.delete(id);},
  start(input){
   if(typeof input.owner!=='string'||!input.owner.trim()||input.owner.length>120||
      typeof input.basis!=='string'||input.basis.trim().length<12||input.basis.length>1000||input.attested!==true)
    throw error(400,'Owner, authorization basis and explicit attestation required');
   if(active)throw error(429,'REA upload analysis already running');
   if(jobs.size>=maxJobs)throw error(409,'Job history limit reached; delete a completed receipt first');
   const admitted=admit(input),{files}=admitted;
   const job={id:randomUUID(),name:files.length===1?files[0].path:'Source batch ('+files.length+' files)',
    fileCount:files.length,size:admitted.size,sha256:admitted.sha256,createdAt:new Date().toISOString(),
    authorization:{owner:input.owner.trim(),basis:input.basis.trim(),attestedAt:new Date().toISOString()},
    status:'queued',findings:[],logs:[],result:null,error:null};
   jobs.set(job.id,job);active=true;
   void(async()=>{
    let root;const results=[];let processed=0;
    try{
     job.status='running';root=await fs.mkdtemp(path.join(os.tmpdir(),'rea-upload-'));
     // No paths from clients are ever used as absolute paths or allow traversal.
     for(const f of files){
      const target=path.resolve(root,f.path);
      if(!target.startsWith(root+path.sep))throw Error('Source path escaped analysis directory');
      await fs.mkdir(path.dirname(target),{recursive:true});
      await fs.writeFile(target,f.content,{flag:'wx',mode:0o600});
     }
     for(const f of files){
      // Each single-file call retains original REA heap/budget controls.
      try{
       const result=await runner({root,sourcePaths:[f.path],files:[{path:f.path,sha256:f.sha256,bytes:f.bytes}]});
       if(!result?.rawResultPresent)throw Error('REA returned no inspectable result');
       results.push({path:f.path,sha256:f.sha256,bytes:f.bytes,status:'completed',
        evidenceId:result.evidenceId||null,statistics:result.statistics||{},
        coverage:result.coverage||'partial',sourceSelection:result.sourceSelection||null});
      }catch(e){results.push({path:f.path,sha256:f.sha256,bytes:f.bytes,status:'failed',
       error:String(e?.message||e).slice(0,160)});}
      processed++;
      // The private receipt contains metadata only, updated for owner polling.
      job.result={tool:'analyze_javascript_application',fileCount:files.length,
       analyzed:results.filter(r=>r.status==='completed').length,processed,
       uninspected:files.length-processed,results:[...results],
       sourceSelection:{analyzed:results.filter(r=>r.status==='completed').map(r=>r.path),
        uninspected:files.filter(f=>!results.some(r=>r.path===f.path&&r.status==='completed')).map(f=>f.path)},
       rawResultPresent:results.some(r=>r.status==='completed'),
       ...(files.length===1?{evidenceId:results[0]?.evidenceId||null,statistics:results[0]?.statistics||{},coverage:results[0]?.coverage||'partial'}:{})};
     }

     if(!results.some(r=>r.status==='completed'))throw Error('REA did not analyze any submitted source');
     job.findings=results.map((r,index)=>({
      id:'rea-source-'+(index+1),title:r.path,
      evidence:JSON.stringify({statistics:r.statistics||{},coverage:r.coverage||'partial',error:r.error||null}).slice(0,1000),
      citation:r.evidenceId?'REA evidence '+r.evidenceId:'SHA-256 '+r.sha256,
      note:r.status==='completed'?'Render REA analyzed this source':'Source analysis failed'
     }));
     job.logs=[{at:new Date().toISOString(),message:'REA source analysis processed '+processed+' files; cleanup pending.'}];
    }catch(e){
     job.error=String(e?.message||e).slice(0,180);
     job.logs=[{at:new Date().toISOString(),message:'REA source analysis failed; cleanup pending.'}];
    }finally{
     let cleaned=true;
     try{if(root)await fs.rm(root,{recursive:true,force:true,maxRetries:3,retryDelay:100});}
     catch{cleaned=false;}
     if(!cleaned)job.error='REA temporary source cleanup failed';
     if(cleaned)job.logs.push({at:new Date().toISOString(),message:'Temporary source bytes deleted.'});
     job.status=job.error?'failed':'completed';
     active=false;
    }
   })();
   return view(job);
  }
 };
}
