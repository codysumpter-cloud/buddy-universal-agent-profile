import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash, randomUUID} from 'node:crypto';
import {inspectWithRea} from './studio-audit.mjs';

const MAX_FILE=256*1024;
const safeName=name=>typeof name==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,100}\.(?:js|mjs|ts|tsx|jsx)$/.test(name)&&!name.includes('..');
const error=(status,message)=>Object.assign(new Error(message),{status});

/** Ephemeral receipts; source bytes are never retained once analysis finishes. */
export function createUploadAudit({runner=inspectWithRea,maxJobs=20}={}){
 if(typeof runner!=='function')throw Error('REA runner required');
 const jobs=new Map(); let active=false;
 const view=job=>({id:job.id,name:job.name,createdAt:job.createdAt,size:job.size,sha256:job.sha256,
  authorization:job.authorization,status:job.status,engine:'rea-mcp-6.8',findings:job.findings||[],
  logs:job.logs||[],checklist:[],result:job.result||null,error:job.error||null,retention:'ephemeral-metadata-only'});
 return {
  list:()=>[...jobs.values()].map(view),
  get:id=>jobs.has(id)?view(jobs.get(id)):null,
  remove(id){const job=jobs.get(id);if(!job)return false;if(['queued','running'].includes(job.status))throw error(409,'Analysis still running');return jobs.delete(id);},
  start({name,content,owner,basis,attested}){
   if(!safeName(name))throw error(415,'Upload one JavaScript or TypeScript source file with a safe filename');
   if(!Buffer.isBuffer(content)||!content.length||content.length>MAX_FILE)throw error(413,'Source file must be 1–256 KiB');
   if(typeof owner!=='string'||!owner.trim()||owner.length>120||typeof basis!=='string'||basis.trim().length<12||basis.length>1000||attested!==true)throw error(400,'Owner, authorization basis and explicit attestation required');
   if(active)throw error(429,'REA upload analysis already running');
   if(jobs.size>=maxJobs)throw error(409,'Job history limit reached; delete a completed receipt first');
   const sha256=createHash('sha256').update(content).digest('hex');
   const job={id:randomUUID(),name,size:content.length,sha256,createdAt:new Date().toISOString(),authorization:{owner:owner.trim(),basis:basis.trim(),attestedAt:new Date().toISOString()},status:'queued',findings:[],logs:[]};
   jobs.set(job.id,job);active=true;
   void(async()=>{
    let root;
    try{
     job.status='running';root=await fs.mkdtemp(path.join(os.tmpdir(),'rea-upload-'));
     await fs.writeFile(path.join(root,name),content,{flag:'wx',mode:0o600});
     job.result=await runner({root,sourcePaths:[name],files:[{path:name,sha256,bytes:content.length}]});
     if(!job.result?.rawResultPresent)throw Error('REA returned no inspectable result');
     job.status='completed';
     job.findings=[{id:'rea-result',title:'REA Core analysis receipt',
       evidence:JSON.stringify({statistics:job.result.statistics||{},coverage:job.result.coverage||'partial'}).slice(0,1200),
       citation:job.result.evidenceId?'REA evidence '+job.result.evidenceId:'SHA-256 '+sha256,
       note:'Render REA analyzed one owner-authorized source file. Results may have partial coverage.'}];
     job.logs=[{at:new Date().toISOString(),message:'REA analysis completed; source bytes discarded.'}];
    }catch(e){job.status='failed';job.error=String(e?.message||e).slice(0,180);job.logs=[{at:new Date().toISOString(),message:'REA analysis failed; upload bytes discarded.'}];}
    finally{if(root)await fs.rm(root,{recursive:true,force:true}).catch(()=>{});active=false;}
   })();return view(job);
  }
 };
}
