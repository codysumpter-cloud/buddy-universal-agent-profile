import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import {captureOwnedPreview,createPreviewAudit,createAuditHandler} from './studio-audit.mjs';
import {createGateway} from './gateway.mjs';
const fakeFetch=async url=>{
 const str=String(url);
 if(str==='https://rea.pixellab.run/')return new Response('<script type="module" src="./assets/app.js"></script>',{status:200});
 if(str==='https://rea.pixellab.run/assets/app.js')return new Response('const good=42; // module', {status:200});
 return new Response('not found',{status:404});
};
test('Cloud preview acquisition is restricted to approved project slugs, does not run source',async()=>{
 await assert.rejects(captureOwnedPreview('private-internal',{fetcher:fakeFetch}),/owner PixelLab project/);
 const saved=await captureOwnedPreview('rea',{fetcher:fakeFetch});
 try{assert.deepEqual(saved.sourcePaths,['assets/app.js']);assert.equal(saved.files.length,1);assert.equal(await fs.readFile(saved.root+'/assets/app.js','utf8'),'const good=42; // module');assert.match(saved.files[0].sha256,/^[0-9a-f]{64}$/);}finally{await fs.rm(saved.root,{recursive:true,force:true});}
});
test('Cloud REA preview job runs once, stores inspection receipt, redacts source',async()=>{
 let called=0;
 const manager=createPreviewAudit({fetcher:fakeFetch,runner:async artifact=>{called++;assert.equal(artifact.sourcePaths[0],'assets/app.js');return {tool:'analyze_javascript_application',evidenceId:'ev_test',statistics:{findings:1}};}});
 const job=manager.start('rea');assert.match(job.id,/^[0-9a-f-]{36}$/);
 await new Promise(resolve=>setTimeout(resolve,150));
 const completed=manager.get(job.id);assert.equal(completed.status,'completed');assert.equal(completed.result.evidenceId,'ev_test');assert.equal(called,1);assert.equal(completed.manifest.files[0].path,'assets/app.js');assert.equal(JSON.stringify(completed).includes('const good='),false);
 assert.throws(()=>manager.start('example.com'),/Unknown owner project/);
});
test('Cloud gateway refuses unauthorized audit endpoints and proxies only authenticated owner actions',async()=>{
 const bearer='q'.repeat(48);
 const manager=createPreviewAudit({fetcher:fakeFetch,runner:async()=>({tool:'analyze_javascript_application',evidenceId:'ev_mock'})});
 const gateway=createGateway({token:bearer,isUpstreamReady:()=>true,auditHandler:createAuditHandler(manager)});
 await new Promise(resolve=>gateway.listen(0,'127.0.0.1',resolve));
 try{
  const origin='http://127.0.0.1:'+gateway.address().port;
  const no=await fetch(origin+'/audit/preview',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({slug:'rea'})});
  assert.equal(no.status,401);
  const yes=await fetch(origin+'/audit/preview',{method:'POST',headers:{authorization:'Bearer '+bearer,'content-type':'application/json'},body:JSON.stringify({slug:'rea'})});
  assert.equal(yes.status,202);const job=await yes.json();
  const read=await fetch(origin+'/audit/jobs/'+job.id,{headers:{authorization:'Bearer '+bearer}});assert.equal(read.status,200);
  const noRead=await fetch(origin+'/audit/jobs/'+job.id);assert.equal(noRead.status,401);
 }finally{await new Promise(resolve=>gateway.close(resolve));}
});

test('Cloud audit executes the actual REA analyze_javascript_application MCP tool shape',async()=>{
 const {inspectWithRea}=await import('./studio-audit.mjs');
 const sid='audit-test-session';let ready=false;
 const upstream=http.createServer(async(req,res)=>{
  let body='';for await(const chunk of req)body+=chunk;
  const msg=JSON.parse(body);res.setHeader('content-type','application/json');
  if(msg.method!=='initialize')assert.equal(req.headers['mcp-session-id'],sid);
  if(msg.method==='initialize'){res.setHeader('mcp-session-id',sid);res.end(JSON.stringify({jsonrpc:'2.0',id:msg.id,result:{serverInfo:{name:'rea'},capabilities:{},protocolVersion:'2025-11-25'}}));}
  else if(msg.method==='notifications/initialized'){ready=true;res.writeHead(202);res.end();}
  else if(msg.method==='tools/call'){assert.equal(ready,true);assert.equal(msg.params.name,'analyze_javascript_application');assert.equal(msg.params.arguments.format,'directory');assert.deepEqual(msg.params.arguments.source_paths,['assets/app.js']);res.end(JSON.stringify({jsonrpc:'2.0',id:msg.id,result:{structuredContent:{evidence_id:'ev_mock',normalized_result:{statistics:{parsed_javascript_files:1,findings:7},coverage:{status:'partial'}}}}}));}
  else assert.fail('unrecognized MCP action');
 });
 await new Promise(resolve=>upstream.listen(0,'127.0.0.1',resolve));
 try{const outcome=await inspectWithRea({root:'/tmp/test-owned-preview',sourcePaths:['assets/app.js']},upstream.address().port);assert.equal(outcome.evidenceId,'ev_mock');assert.equal(outcome.statistics.findings,7);assert.equal(outcome.tool,'analyze_javascript_application');}finally{await new Promise(resolve=>upstream.close(resolve));}
});