import test from "node:test";
import assert from "node:assert/strict";
import {askHermes,hermesConfig,hermesStatus,probeHermes,validateHermesConfig,HERMES_FEATURES} from "../src/index.mjs";

const local = {baseUrl:"http://127.0.0.1:8642/v1",apiKey:"test-secret-never-print",model:"hermes-agent",remoteEnabled:false,allowedHosts:[]};
const response = (payload, init={})=>Response.json(payload,init);

test("defaults to localhost and does not pretend tools are verified",()=>{
  const c=hermesConfig({});
  assert.equal(c.baseUrl,"http://127.0.0.1:8642/v1");
  assert.equal(c.apiKey,"");
  const s=hermesStatus({});
  assert.equal(s.configured,false);
  assert.equal(s.apiReachable,"not_checked");
  assert.equal(s.toolsetsVerified,false);
  assert.ok(HERMES_FEATURES.some(x=>x.id==="cron_and_delivery" && x.status==="host-managed"));
});
test("requires API key to make requests",()=>{
  assert.throws(()=>validateHermesConfig({...local,apiKey:""}),/key is missing/);
  assert.equal(validateHermesConfig(local),local.baseUrl);
});
test("refuses remote HTTP, insecure URLs, unlisted hosts and credential-bearing URLs",()=>{
  const remote={...local,baseUrl:"https://hermes.example.test/v1"};
  assert.throws(()=>validateHermesConfig(remote),/Remote Hermes requires/);
  assert.throws(()=>validateHermesConfig({...remote,remoteEnabled:true,allowedHosts:["different.test"]}),/Remote Hermes requires/);
  assert.throws(()=>validateHermesConfig({...remote,baseUrl:"http://hermes.example.test/v1",remoteEnabled:true,allowedHosts:["hermes.example.test"]}),/Remote Hermes requires/);
  assert.equal(validateHermesConfig({...remote,remoteEnabled:true,allowedHosts:["hermes.example.test"]}),remote.baseUrl);
  assert.throws(()=>validateHermesConfig({...local,baseUrl:"http://user:pass@127.0.0.1:8642/v1"}),/credentials/);
  assert.throws(()=>validateHermesConfig({...local,baseUrl:"http://127.0.0.1:8642/v1?key=secret"}),/credentials/);
  assert.throws(()=>validateHermesConfig({...local,baseUrl:"file:///etc/passwd"}),/end in \/v1/);
  assert.throws(()=>validateHermesConfig({...local,baseUrl:"http://127.0.0.1:8642/not-v1"}),/end in \/v1/);
});
test("probe calls authenticated /models and proves connectivity only",async()=>{
  let calls=0;
  const result=await probeHermes(local,{fetchImpl:async(url,init)=>{
    calls++; assert.equal(url,"http://127.0.0.1:8642/v1/models");
    assert.equal(init.headers.authorization,"Bearer "+local.apiKey);
    assert.equal(init.redirect,"error");
    return response({data:[{id:"hermes-agent"}]});
  }});
  assert.deepEqual(result,{reachable:true,models:["hermes-agent"],toolsetsVerified:false});
  assert.equal(calls,1);
});
test("chat delegates exactly one authorized turn with BUAP system identity",async()=>{
  let calls=0;
  const out=await askHermes({prompt:"Summarize the repo",systemContext:"You are a BUAP Agent Profile.",config:local,fetchImpl:async(url,init)=>{
    calls++; assert.equal(url,"http://127.0.0.1:8642/v1/chat/completions");
    assert.equal(init.method,"POST");
    assert.equal(init.headers.authorization,"Bearer "+local.apiKey);
    assert.equal(init.redirect,"error");
    const body=JSON.parse(init.body);
    assert.equal(body.model,"hermes-agent");
    assert.equal(body.stream,false);
    assert.deepEqual(body.messages,[{role:"system",content:"You are a BUAP Agent Profile."},{role:"user",content:"Summarize the repo"}]);
    return response({id:"chatcmpl-one",model:"hermes-agent",choices:[{message:{content:"Reviewed the files."}}],usage:{total_tokens:12}});
  }});
  assert.equal(calls,1);
  assert.equal(out.text,"Reviewed the files.");
  assert.equal(out.completionId,"chatcmpl-one");
  assert.deepEqual(out.usage,{total_tokens:12});
});
test("supports structured text content",async()=>{
  const out=await askHermes({prompt:"Hi",config:local,fetchImpl:async()=>response({choices:[{message:{content:[{type:"text",text:"Hello"},{type:"image",data:"ignored"}]}}]})});
  assert.equal(out.text,"Hello");
});
test("fails closed on HTTP errors and never leaks server error body or key",async()=>{
  let calls=0;
  await assert.rejects(()=>askHermes({prompt:"Hi",config:local,fetchImpl:async()=>{calls++;return new Response("echo "+local.apiKey,{status:403})}}),e=>{
    assert.equal(calls,1);
    assert.match(e.message,/HTTP 403/);
    assert.ok(!e.message.includes(local.apiKey));
    return true;
  });
});
test("refuses malformed responses and empty assistant turns",async()=>{
  await assert.rejects(()=>probeHermes(local,{fetchImpl:async()=>new Response("{")} ),/invalid JSON/);
  await assert.rejects(()=>askHermes({prompt:"Hi",config:local,fetchImpl:async()=>response({choices:[{message:{content:""}}]})}),/no assistant text/);
});
test("refuses missing/oversized prompt and untrusted model names",async()=>{
  await assert.rejects(()=>askHermes({prompt:"",config:local,fetchImpl:async()=>{throw Error("must not call")}}),/prompt/);
  await assert.rejects(()=>askHermes({prompt:"x".repeat(100001),config:local,fetchImpl:async()=>{throw Error("must not call")}}),/100000/);
  assert.throws(()=>validateHermesConfig({...local,model:"../../../etc"}),/Invalid Hermes model name/);
});
test("network failures do not retry potentially side-effecting tools",async()=>{
  let calls=0;
  await assert.rejects(()=>askHermes({prompt:"test",config:local,fetchImpl:async()=>{calls++;throw Error("secret in exception")}}),e=>{
    assert.match(e.message,/connection failed/i);
    assert.ok(!e.message.includes("secret"));
    return true;
  });
  assert.equal(calls,1);
});
