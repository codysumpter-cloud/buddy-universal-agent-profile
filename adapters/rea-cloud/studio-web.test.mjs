import {test} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createGateway} from './gateway.mjs';
import {createStudioHandler} from './studio-web.mjs';
import {createUploadAudit} from './studio-upload.mjs';
const TOKEN='r'.repeat(48),STUDIO_PROXY_TOKEN='s'.repeat(48);
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'rea-studio-test-'));
fs.mkdirSync(path.join(tmp,'assets'));fs.writeFileSync(path.join(tmp,'index.html'),'<html>Owner Studio</html>');fs.writeFileSync(path.join(tmp,'assets','app.js'),'export const studio=true;');
const audits={
 list:()=>[{id:'11111111-1111-1111-1111-111111111111',slug:'rea',status:'completed',result:{evidenceId:'ev_confirmed'}}],
 start:slug=>{if(slug!=='rea')throw Object.assign(Error('Unknown project'),{status:400});return {id:'22222222-2222-2222-2222-222222222222',slug,status:'queued'};},
 get:id=>id==='11111111-1111-1111-1111-111111111111'?audits.list()[0]:null
};
async function host(){
 const uploads=createUploadAudit({runner:async()=>({rawResultPresent:true,evidenceId:'ev-upload',statistics:{files:1},coverage:'partial'})});
 const studioHandler=createStudioHandler({token:TOKEN,studioProxyToken:STUDIO_PROXY_TOKEN,root:tmp,isCoreReady:()=>true,proof:()=>({passed:true,tool:'inspect_analysis_settings'}),audits,uploads,fetcher:async()=>new Response('none',{status:404})});
 const gateway=createGateway({token:TOKEN,isUpstreamReady:()=>true,studioHandler});
 await new Promise(r=>gateway.listen(0,'127.0.0.1',r));
 return {gateway,url:'http://127.0.0.1:'+gateway.address().port};
}
const headers={authorization:'Bearer '+TOKEN};
test('Render Studio serves same-origin app and metadata without exposing private source',async()=>{
 const {gateway,url}=await host();
 try{
  const redir=await fetch(url+'/studio?view=rea',{redirect:'manual'});assert.equal(redir.status,302);assert.equal(redir.headers.get('location'),'/studio/?view=rea');
  const app=await fetch(url+'/studio/');assert.equal(app.status,200);assert.match(await app.text(),/Owner Studio/);
  const js=await fetch(url+'/studio/assets/app.js');assert.equal(js.status,200);assert.match(await js.text(),/studio=true/);
  const setup=await(await fetch(url+'/studio/api/rea/setup')).json();assert.equal(setup.ownerAccessConfigured,true);assert.equal(setup.cloudBridgeConfigured,true);
  assert.equal(await fetch(url+'/studio/assets/../../studio-web.mjs').then(x=>x.status),404);
  assert.equal(await fetch(url+'/studio/api/rea/assets').then(x=>x.status),401);
 }finally{gateway.closeAllConnections();await new Promise(r=>gateway.close(r));}
});
test('Render Studio requires owner bearer and invokes actual authorized audit manager',async()=>{
 const {gateway,url}=await host();
 try{
  assert.equal((await fetch(url+'/studio/api/rea/health')).status,401);
  const h=await(await fetch(url+'/studio/api/rea/health',{headers})).json();
  assert.equal(h.coreVerified,true);assert.equal(h.tool,'inspect_analysis_settings');
  const existing=await(await fetch(url+'/studio/api/rea/cloud-scans',{headers})).json();
  assert.equal(existing.scans[0].result.evidenceId,'ev_confirmed');
  const scan=await fetch(url+'/studio/api/rea/cloud-scans',{method:'POST',headers:{...headers,'content-type':'application/json'},body:JSON.stringify({slug:'rea'})});
  assert.equal(scan.status,202);assert.equal((await scan.json()).scan.status,'queued');
  const bad=await fetch(url+'/studio/api/rea/cloud-scans',{method:'POST',headers:{...headers,'content-type':'application/json'},body:JSON.stringify({slug:'external'})});assert.equal(bad.status,400);
  const missing=await fetch(url+'/studio/api/rea/assets/summary',{headers});assert.equal(missing.status,503);
  assert.equal((await missing.json()).error.includes('not configured'),true);
 }finally{gateway.closeAllConnections();await new Promise(r=>gateway.close(r));}
});

test('private browser file uploads execute through Render REA job manager, not Worker',async()=>{
 const {gateway,url}=await host();
 try{
  const data=new FormData();
  data.set('file',new Blob(['const pixel=7;'],{type:'text/javascript'}),'source.js');
  data.set('owner','Prismtek');data.set('basis','Owner original JavaScript source analysis');data.set('attest','true');
  assert.equal((await fetch(url+'/studio/api/rea/jobs',{method:'POST',body:data})).status,401);
  const started=await fetch(url+'/studio/api/rea/jobs',{method:'POST',headers,body:data});
  assert.equal(started.status,202);
  const {job}=await started.json();assert.equal(job.engine,'rea-mcp-6.8');
  let latest;
  for(let i=0;i<100;i++){
   const received=await fetch(url+'/studio/api/rea/jobs/'+job.id,{headers});
   assert.equal(received.status,200);
   latest=(await received.json()).job;
   if(latest.status==='completed')break;
   await new Promise(r=>setTimeout(r,10));
  }
  assert.equal(latest.status,'completed');
  assert.equal(latest.result.evidenceId,'ev-upload');
  const listing=await(await fetch(url+'/studio/api/rea/jobs',{headers})).json();
  assert.equal(listing.jobs.length,1);
  assert.equal(listing.jobs[0].sha256.length,64);
  assert.equal((await fetch(url+'/studio/api/rea/jobs/'+job.id,{method:'DELETE',headers})).status,200);
  assert.equal((await fetch(url+'/studio/api/rea/jobs/'+job.id,{headers})).status,404);
  const bad=new FormData();bad.set('file',new Blob(['bad']),'unsupported.exe');bad.set('owner','Prismtek');bad.set('basis','Owner original JavaScript source analysis');bad.set('attest','true');
  assert.equal((await fetch(url+'/studio/api/rea/jobs',{method:'POST',headers,body:bad})).status,415);
 }finally{gateway.closeAllConnections();await new Promise(r=>gateway.close(r));}
});

test('first-party website proxy uses a distinct Studio bearer and preserves MCP gateway protection',async()=>{
 const {gateway,url}=await host();
 try{
  const studioHeaders={authorization:'Bearer '+STUDIO_PROXY_TOKEN};
  const authorized=await fetch(url+'/studio/api/rea/health',{headers:studioHeaders});
  assert.equal(authorized.status,200);
  const denied=await fetch(url+'/studio/api/rea/health',{headers:{authorization:'Bearer '+'x'.repeat(48)}});
  assert.equal(denied.status,401);
  const upstreamMcp=await fetch(url+'/mcp',{headers:studioHeaders});
  assert.equal(upstreamMcp.status,401);
 }finally{gateway.closeAllConnections();await new Promise(r=>gateway.close(r));}
});
