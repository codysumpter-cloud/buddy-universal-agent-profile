import {test} from 'node:test';
import assert from 'node:assert/strict';
import {verifyCoreReadiness,openVerifiedGateway} from './readiness.mjs';
import {createGateway} from './gateway.mjs';
const token='owner-'+ 'x'.repeat(45);
test('REA readiness rejects a reachable socket without verified tool execution',async()=>{
 let tries=0,retries=0;
 const proof=await verifyCoreReadiness({
  verify:async()=>{
   tries++;
   if(tries===1)throw Error('ECONNREFUSED: REA still booting');
   if(tries===2)return {initialized:true,toolCallSucceeded:false,called:'inspect_analysis_settings'};
   return {initialized:true,toolCallSucceeded:true,called:'inspect_analysis_settings',toolCount:229};
  },pause:async()=>{},onRetry:()=>retries++
 });
 assert.equal(tries,3);assert.equal(retries,2);assert.equal(proof.toolCount,229);
});
test('REA readiness fails closed after retry limit and during shutdown',async()=>{
 await assert.rejects(verifyCoreReadiness({verify:async()=>{throw Error('MCP unavailable')},pause:async()=>{},maxAttempts:2}),/failed MCP verification after 2 attempts/);
 await assert.rejects(verifyCoreReadiness({verify:async()=>({initialized:true,toolCallSucceeded:true,called:'inspect_analysis_settings'}),isStopped:()=>true}),/stopped during readiness/);
});
test('gateway returns 503 until real proof is installed; bearer never bypasses readiness',async()=>{
 let ready=false;
 const gateway=createGateway({token,isUpstreamReady:()=>ready});
 await new Promise(resolve=>gateway.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+gateway.address().port;
 try{
  const pending=await fetch(base+'/healthz');assert.equal(pending.status,503);assert.equal((await pending.json()).ready,false);
  const denied=await fetch(base+'/mcp',{method:'POST',body:'{}'});assert.equal(denied.status,401);
  const blocked=await fetch(base+'/mcp',{method:'POST',headers:{authorization:'Bearer '+token},body:'{}'});assert.equal(blocked.status,503);
  ready=true;
  const healthy=await fetch(base+'/healthz');assert.equal(healthy.status,200);assert.equal((await healthy.json()).ready,true);
 }finally{await new Promise(resolve=>gateway.close(resolve))}
});

test('Render TCP listener remains closed until REA real proof resolves',async()=>{
 let resolveProof;
 const proof=new Promise(resolve=>{resolveProof=resolve});
 const gateway=createGateway({token});
 const started=openVerifiedGateway({gateway,port:0,host:'127.0.0.1',proof});
 assert.equal(gateway.listening,false,'cannot pass TCP health check during MCP verification');
 resolveProof({initialized:true,toolCallSucceeded:true,called:'inspect_analysis_settings'});
 const outcome=await started;
 assert.equal(outcome.called,'inspect_analysis_settings');
 assert.equal(gateway.listening,true);
 await new Promise(resolve=>gateway.close(resolve));
});
test('Failed proof cannot open the Render TCP listener',async()=>{
 const gateway=createGateway({token});
 await assert.rejects(openVerifiedGateway({gateway,port:0,proof:Promise.resolve({initialized:true,toolCallSucceeded:false})}),/proof missing/);
 assert.equal(gateway.listening,false);
});