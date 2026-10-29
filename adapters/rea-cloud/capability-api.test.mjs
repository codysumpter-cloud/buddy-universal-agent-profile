import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {createStudioHandler} from './studio-web.mjs';
import {createGateway} from './gateway.mjs';
import {createReaCapabilities} from './capability-bridge.mjs';
const token='t'.repeat(48),proxy='p'.repeat(48);
const catalog={info:{version:'6.8.0'},tools:[{name:'inspect_analysis_settings',description:'Read settings',annotations:{readOnlyHint:true},inputSchema:{type:'object',properties:{}}},{name:'decompile_all',description:'Potential write',annotations:{destructiveHint:true},inputSchema:{type:'object',properties:{path:{type:'string'}}}}],prompts:[]};
test('private full REA capability bridge exposes tool list and explicit two-step approval',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'rea-capabilities-test-'));fs.writeFileSync(path.join(root,'index.html'),'TEST');
 const calls=[];
 const capabilities=createReaCapabilities({catalog,send:async(port,m,session)=>{
  calls.push(m.method);
  if(m.method==='initialize')return{sessionId:'s',result:{result:{serverInfo:{name:'rea'}}}};
  if(m.method==='notifications/initialized')return{sessionId:'s',result:null};
  return {sessionId:'s',result:{result:{isError:false,content:[{type:'text',text:'ok'}]}}};
 }});
 const handler=createStudioHandler({token,studioProxyToken:proxy,root,isCoreReady:()=>true,proof:()=>({passed:true}),audits:{list:()=>[]},uploads:{list:()=>[]},capabilities});
 const gateway=createGateway({token,isUpstreamReady:()=>true,studioHandler:handler});
 await new Promise(ok=>gateway.listen(0,'127.0.0.1',ok));
 const base='http://127.0.0.1:'+gateway.address().port;
 const headers={authorization:'Bearer '+proxy,'content-type':'application/json'};
 try{
  assert.equal((await fetch(base+'/studio/api/rea/capabilities')).status,401);
  const ls=await(await fetch(base+'/studio/api/rea/capabilities',{headers})).json();
  assert.equal(ls.count,2);assert.equal(ls.tools[1].risk,'destructive');
  const detail=await(await fetch(base+'/studio/api/rea/capabilities/decompile_all',{headers})).json();
  assert.equal(detail.inputSchema.properties.path.type,'string');
  assert.equal((await fetch(base+'/studio/api/rea/capabilities/prepare',{method:'POST',headers,body:JSON.stringify({name:'decompile_all',arguments:{path:'/tmp/owned'}})})).status,200);
  const pre=await(await fetch(base+'/studio/api/rea/capabilities/prepare',{method:'POST',headers,body:JSON.stringify({name:'inspect_analysis_settings',arguments:{}})})).json();
  assert.equal(pre.requiresApproval,true);assert.equal(calls.length,0);
  const denied=await fetch(base+'/studio/api/rea/capabilities/invoke',{method:'POST',headers,body:JSON.stringify({ticket:pre.ticket,approved:false})});
  assert.equal(denied.status,403);
  const invoked=await(await fetch(base+'/studio/api/rea/capabilities/invoke',{method:'POST',headers,body:JSON.stringify({ticket:pre.ticket,approved:true})})).json();
  assert.equal(invoked.status,'executed');assert.equal(invoked.reaResult.content[0].text,'ok');
  assert.deepEqual(calls,['initialize','notifications/initialized','tools/call']);
  assert.equal((await fetch(base+'/studio/api/rea/capabilities/invoke',{method:'POST',headers,body:JSON.stringify({ticket:pre.ticket,approved:true})})).status,404);
 }finally{gateway.closeAllConnections();await new Promise(ok=>gateway.close(ok));fs.rmSync(root,{recursive:true,force:true});}
});