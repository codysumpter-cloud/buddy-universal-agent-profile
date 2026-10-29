import {createHash,randomUUID} from 'node:crypto';
import {rpc as defaultRpc} from './mcp-selftest.mjs';

const PROTOCOL='2025-11-25';
const MAX_ARGUMENTS=16*1024;
const MAX_OUTPUT=375*1024;
const MAX_PREPARED=12;
const EXPIRY_MS=5*60*1000;
const safeName=/^[a-z][a-z0-9_]{1,110}$/;
const bad=(status,message)=>Object.assign(new Error(message),{status});
const short=(s,n=200)=>String(s||'').slice(0,n);
function category(name){
 if(/decompil|rizin|gdb|jeb|cutter|native.function|wasm|managed|swift/.test(name))return 'Native binaries & decompilation';
 if(/android|adb|ios|mobile|device|apk/.test(name))return 'Mobile & devices';
 if(/web|browser|javascript|electron|playwright|screenshot/.test(name))return 'Web, JS & desktop apps';
 if(/packet|network|process|runtime|memory|trace|debug/.test(name))return 'Runtime & network capture';
 if(/reconstruction|compare|correlate|coverage|evidence|environment/.test(name))return 'Reconstruction & evidence';
 return 'Discovery & analysis';
}
function risk(tool){
 const a=tool.annotations||{};
 if(a.destructiveHint===true)return 'destructive';
 if(a.readOnlyHint===true&&a.openWorldHint!==true)return 'read-only';
 if(a.openWorldHint===true)return 'external-effects';
 return 'requires-review';
}
const display=t=>({name:t.name,title:short(t.title||t.name,110),description:short(t.description,260),category:category(t.name),risk:risk(t),requiresReview:risk(t)!=='read-only',mayNeedExternalDependencies:true});
/** Owner-only, reviewed, one-shot capability dispatch to existing REA MCP.
 * Catalog discovery never claims that a native binary/device is installed.
 * A call can be executed only after a separate explicit preparation step.
 */
export function createReaCapabilities({catalog,port=8765,send=defaultRpc,clock=()=>Date.now()}={}){
 if(!catalog?.tools||!Array.isArray(catalog.tools)||catalog.tools.length===0)throw Error('Pinned REA catalog required');
 const tools=new Map(catalog.tools.map(t=>[t.name,t]));
 const pending=new Map();let active=false,sequence=0,session=null;
 function prune(){for(const [id,p]of pending)if(clock()-p.created>EXPIRY_MS)pending.delete(id);}
 async function call(name,args){
  if(!session){
   const init=await send(port,{jsonrpc:'2.0',id:++sequence,method:'initialize',params:{protocolVersion:PROTOCOL,capabilities:{},clientInfo:{name:'prismtek-native-studio',version:'1.0.0'}}});
   if(init.result?.error||!init.result?.result?.serverInfo)throw Error('REA initialization unavailable');
   session=init.sessionId;
   await send(port,{jsonrpc:'2.0',method:'notifications/initialized'},session);
  }
  const reply=await send(port,{jsonrpc:'2.0',id:++sequence,method:'tools/call',params:{name,arguments:args}},session,90000);
  if(reply.result?.error||reply.result?.result?.isError)throw Error('REA returned a tool error');
  if(!reply.result?.result)throw Error('REA returned no tool result');
  const json=JSON.stringify(reply.result.result);
  if(json.length>MAX_OUTPUT)throw Error('REA result too large; use REA evidence storage/inspection instead');
  return reply.result.result;
 }
 return {
  overview(){
   const list=[...tools.values()].map(display);
   return {version:catalog.info?.version||'unknown',count:list.length,prompts:catalog.prompts?.length||0,tools:list,backend:'Existing private REA MCP on Render',limitations:'Advertised tool != installed device/target/dependency; execution must prove availability'};
  },
  detail(name){
   if(!safeName.test(name)||!tools.has(name))throw bad(404,'REA capability not found');
   const t=tools.get(name);
   return {...display(t),description:short(t.description,6000),inputSchema:t.inputSchema||{type:'object',properties:{}},annotations:t.annotations||{},notes:'All tools require a prepared, authorized owner invocation; some need target device, host dependencies or interactive consent.'};
  },
  prepare(name,args){
   prune();
   const t=tools.get(name);
   if(!safeName.test(name)||!t)throw bad(404,'Unknown REA capability');
   if(!args||typeof args!=='object'||Array.isArray(args))throw bad(400,'Arguments must be a JSON object');
   let serialized;try{serialized=JSON.stringify(args)}catch{throw bad(400,'Invalid arguments')}
   if(serialized.length>MAX_ARGUMENTS)throw bad(413,'REA arguments exceed 16 KiB');
   if(pending.size>=MAX_PREPARED)throw bad(429,'Too many awaiting approvals');
   // A one-time opaque nonce is issued only after checking exact tool identity.
   // The UI must present the risk and receive a distinct click before invocation.
   const id=randomUUID(),entry={name,args:JSON.parse(serialized),created:clock()};
   pending.set(id,entry);
   return {ticket:id,expiresInSeconds:300,capability:display(t),argumentsDigest:createHash('sha256').update(serialized).digest('hex'),warning:risk(t)==='read-only'?'Read-only hint from upstream; external target availability remains unverified.':'May change files/processes/devices or access external systems. Run only on targets you own or are authorized to analyze.',requiresApproval:true};
  },
  async invoke(ticket,approved){
   prune();
   if(typeof ticket!=='string'||!pending.has(ticket))throw bad(404,'Prepared operation expired or missing');
   if(approved!==true)throw bad(403,'Explicit approval is required');
   if(active)throw bad(429,'REA is busy; retry after the current operation finishes');
   const p=pending.get(ticket);pending.delete(ticket);
   active=true;
   try{
    const result=await call(p.name,p.args);
    return {status:'executed',tool:p.name,executedAt:new Date(clock()).toISOString(),reaResult:result,verifiedBy:'Real REA MCP tools/call; original target behavior not automatically verified'};
   }catch(error){session=null;throw bad(502,short(error?.message||error,220))}
   finally{active=false}
  }
 };
}