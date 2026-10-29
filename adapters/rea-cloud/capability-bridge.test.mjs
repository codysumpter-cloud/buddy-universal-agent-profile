import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createReaCapabilities} from './capability-bridge.mjs';

const catalog={info:{version:'6.8.0'},tools:[
 {name:'inspect_analysis_settings',annotations:{readOnlyHint:true,openWorldHint:false},description:'Read settings',inputSchema:{type:'object',properties:{}}},
 {name:'decompile_all',annotations:{readOnlyHint:false,destructiveHint:true},description:'Writes decompiled source',inputSchema:{type:'object',properties:{path:{type:'string'}}}},
 {name:'capture_browser_scenario',annotations:{openWorldHint:true},description:'Browser capture',inputSchema:{type:'object',properties:{url:{type:'string'}}}}
],prompts:[{}]};
function fixture(){
 let seq=[],resolveCall;
 const bridge=createReaCapabilities({catalog,send:async(port,message,session)=>{
  seq.push({method:message.method,params:message.params});
  if(message.method==='initialize')return {result:{result:{serverInfo:{name:'REA'}}},sessionId:'rea-session'};
  if(message.method==='notifications/initialized')return {result:null,sessionId:'rea-session'};
  if(message.method==='tools/call')return {result:{result:{isError:false,content:[{type:'text',text:'REAL REA'}]}},sessionId:'rea-session'};
 }});
 return {bridge,seq};
}
test('catalog advertises all tools and risk accurately without claiming installed dependencies',()=>{
 const {bridge}=fixture(),o=bridge.overview();
 assert.equal(o.count,3);assert.equal(o.prompts,1);
 assert.equal(bridge.detail('inspect_analysis_settings').risk,'read-only');
 assert.equal(bridge.detail('decompile_all').risk,'destructive');
 assert.equal(bridge.detail('capture_browser_scenario').risk,'external-effects');
 assert.equal(o.tools[0].mayNeedExternalDependencies,true);
 assert.throws(()=>bridge.detail('unknown'),/not found/);
});
test('two-step owner approval is mandatory; tools/call reaches real MCP envelope',async()=>{
 const {bridge,seq}=fixture();
 const p=bridge.prepare('decompile_all',{path:'/approved/owned'});
 assert.equal(p.requiresApproval,true);assert.equal(p.capability.risk,'destructive');
 await assert.rejects(bridge.invoke(p.ticket,false),/approval/);
 assert.equal(seq.length,0);
 const result=await bridge.invoke(p.ticket,true);
 assert.equal(result.tool,'decompile_all');
 assert.equal(result.reaResult.content[0].text,'REAL REA');
 assert.deepEqual(seq.map(x=>x.method),['initialize','notifications/initialized','tools/call']);
 assert.equal(seq[2].params.name,'decompile_all');
 await assert.rejects(bridge.invoke(p.ticket,true),/missing/);
});
test('schema inspection and malformed or oversized operation arguments fail closed',async()=>{
 const {bridge,seq}=fixture();
 assert.equal(bridge.detail('decompile_all').inputSchema.properties.path.type,'string');
 assert.throws(()=>bridge.prepare('nonexistent',{}),/Unknown/);
 assert.throws(()=>bridge.prepare('decompile_all',{extra:'x'.repeat(18000)}),/16 KiB/);
 assert.throws(()=>bridge.prepare('decompile_all',[]),/object/);
 assert.equal(seq.length,0);
});
test('REA tool errors do not claim a successful execution',async()=>{
 const bad=createReaCapabilities({catalog,send:async(port,m)=>m.method==='initialize'?{result:{result:{serverInfo:{name:'rea'}}},sessionId:'s'}:m.method==='notifications/initialized'?{result:null}:{result:{result:{isError:true,content:[]}}}});
 const p=bad.prepare('inspect_analysis_settings',{});
 await assert.rejects(bad.invoke(p.ticket,true),/tool error/);
});
test('expired approval ticket fails without invoking MCP',async()=>{
 let time=100;const {seq}=fixture();
 const x=createReaCapabilities({catalog,clock:()=>time,send:async()=>{seq.push(1);throw Error('not expected')}});
 const p=x.prepare('inspect_analysis_settings',{});
 time+=301000;
 await assert.rejects(x.invoke(p.ticket,true),/expired/);
 assert.equal(seq.length,0);
});