import test from "node:test";
import assert from "node:assert/strict";
import worker, { handleBuapMessage, remoteToolDefinitions } from "../index.mjs";

const env={ BUAP_MCP_TOKEN:"very-secret-test-token-32-characters", BUAP_GITHUB_REPOS:"codysumpter-cloud/buddy-universal-agent-profile" };
const rpc=(id,method,params)=>({jsonrpc:"2.0",id,method,...(params?{params}:{})});
const post=(payload, token=env.BUAP_MCP_TOKEN, headers={})=>new Request("https://buap-mcp.prismtek.dev/mcp",{method:"POST",headers:{"content-type":"application/json",authorization:"Bearer "+token,...headers},body:JSON.stringify(payload)});
test("health endpoint reveals no capability secrets",async()=>{
  const r=await worker.fetch(new Request("https://buap-mcp.prismtek.dev/healthz"),env);
  assert.equal(r.status,200);const x=await r.json();assert.equal(x.ready,true);assert(!JSON.stringify(x).includes(env.BUAP_MCP_TOKEN));
});
test("unauthenticated requests rejected and missing secret fail closed",async()=>{
  const payload=rpc(1,"tools/list");
  assert.equal((await worker.fetch(post(payload,"wrong"),env)).status,401);
  assert.equal((await worker.fetch(post(payload),{BUAP_GITHUB_REPOS:env.BUAP_GITHUB_REPOS})).status,503);
  assert.equal((await worker.fetch(new Request("https://buap-mcp.prismtek.dev/mcp",{method:"GET"}),env)).status,401);
});
test("remote streamable MCP initialize, tool discovery, and metadata calls",async()=>{
  const init=await worker.fetch(post(rpc(1,"initialize",{protocolVersion:"2025-06-18",clientInfo:{name:"test",version:"1"},capabilities:{}})),env);
  assert.equal(init.status,200);assert.equal((await init.json()).result.serverInfo.name,"buap");
  const l=await worker.fetch(post(rpc(2,"tools/list")),env);const tools=(await l.json()).result.tools.map(x=>x.name);
  assert(tools.includes("buap_self_test"));assert(tools.includes("buap_manifest"));assert(tools.includes("buap_capabilities"));
  assert(tools.includes("buap_github_repo"));assert(!tools.includes("buap_github_create_pr"));
  assert.equal(remoteToolDefinitions().length,3);
  const manifest=await worker.fetch(post(rpc(3,"tools/call",{name:"buap_manifest",arguments:{}})),env);
  assert.equal(JSON.parse((await manifest.json()).result.content[0].text).profile_contract,"contracts/prismtek-agent-profile-v1.md");
  const st=await worker.fetch(post(rpc(4,"tools/call",{name:"buap_self_test",arguments:{}})),env);
  const status=JSON.parse((await st.json()).result.content[0].text);
  assert.equal(status.write_tools_enabled,false);assert.equal(status.github_live_access,"not-tested-by-self-test");
});
test("write calls denied even if host mistakenly enables writes",async()=>{
  const privileged={...env,BUAP_GITHUB_WRITE_ENABLED:"1",BUAP_GITHUB_APPROVAL_CODE:"unsafe-enable"};
  const response=await handleBuapMessage(rpc(7,"tools/call",{name:"buap_github_create_pr",arguments:{repo:"codysumpter-cloud/buddy-universal-agent-profile"}}),privileged);
  assert.equal(response.error.code,-32602);
  const list=await handleBuapMessage(rpc(8,"tools/list"),privileged);
  assert(!list.result.tools.some(x=>x.name==="buap_github_create_pr"));
});
test("MCP notification 202 and defensive parsing",async()=>{
  const notification=await worker.fetch(post({jsonrpc:"2.0",method:"notifications/initialized"}),env);
  assert.equal(notification.status,202);
  const malformed=await worker.fetch(new Request("https://buap-mcp.prismtek.dev/mcp",{method:"POST",headers:{"content-type":"application/json",authorization:"Bearer "+env.BUAP_MCP_TOKEN},body:"{invalid"}),env);
  assert.equal((await malformed.json()).error.code,-32700);
  assert.equal((await worker.fetch(new Request("https://buap-mcp.prismtek.dev/mcp",{method:"POST",headers:{authorization:"Bearer "+env.BUAP_MCP_TOKEN,"content-type":"text/plain"},body:"hi"}),env)).status,415);
});
test("real GitHub call shares canonical source API, exact allowlist and network restrictions",async()=>{
  const seen=[];
  const fetchImpl=async(url,opts)=>{seen.push({url,opts});return Response.json({full_name:"codysumpter-cloud/buddy-universal-agent-profile",default_branch:"main",archived:false,private:false,html_url:"https://github.com/codysumpter-cloud/buddy-universal-agent-profile"});};
  const allowed=await handleBuapMessage(rpc(1,"tools/call",{name:"buap_github_repo",arguments:{repo:"codysumpter-cloud/buddy-universal-agent-profile"}}),env,fetchImpl);
  assert.equal(allowed.result.isError,false);
  assert.equal(seen.length,1);
  assert.equal(seen[0].url,"https://api.github.com/repos/codysumpter-cloud/buddy-universal-agent-profile");
  const denied=await handleBuapMessage(rpc(2,"tools/call",{name:"buap_github_repo",arguments:{repo:"elsewhere/private"}}),env,fetchImpl);
  assert.equal(denied.result.isError,true);assert.equal(seen.length,1);
});
