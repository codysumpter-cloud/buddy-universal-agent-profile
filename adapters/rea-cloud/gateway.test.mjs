import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createGateway } from './gateway.mjs';

const token = 'test-' + 'x'.repeat(64);
const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
const close = server => new Promise(resolve => server.close(resolve));

test('requires a sufficiently strong token', () => {
  assert.throws(() => createGateway({ token: 'short' }), /32 characters/);
});

test('proxies MCP only with valid owner bearer; strips sensitive headers', async () => {
  const upstream = http.createServer((req,res) => {
    assert.equal(req.url, '/mcp');
    assert.equal(req.headers.authorization, undefined);
    assert.equal(req.headers.cookie, undefined);
    res.writeHead(200, { 'content-type': 'application/json', 'mcp-session-id': 'session-1' });
    res.end(JSON.stringify({ jsonrpc: '2.0', result: { tools: [] }, id: 1 }));
  });
  const upstreamPort = await listen(upstream);
  const gateway = createGateway({ token, upstreamPort });
  const port = await listen(gateway);
  try {
    const base = 'http://127.0.0.1:' + port;
    const health = await fetch(base + '/healthz');
    assert.equal(health.status, 200);
    const denied = await fetch(base + '/mcp', { method: 'POST', body: '{}'});
    assert.equal(denied.status, 401);
    const wrong = await fetch(base + '/mcp', { headers: { Authorization: 'Bearer wrong' }});
    assert.equal(wrong.status, 401);
    const noSse = await fetch(base + '/mcp', {
      headers: { Authorization: 'Bearer ' + token, Accept: 'text/event-stream' },
    });
    assert.equal(noSse.status, 405);
    assert.equal(noSse.headers.get('allow'), 'POST, DELETE');
    const allowed = await fetch(base + '/mcp', {
      method: 'POST', headers: {
        Authorization: 'Bearer ' + token, Cookie: 'sensitive',
        'Content-Type': 'application/json', Accept: 'application/json',
      }, body: '{}',
    });
    assert.equal(allowed.status, 200);
    assert.equal(allowed.headers.get('mcp-session-id'), 'session-1');
    assert.deepEqual((await allowed.json()).result.tools, []);
    assert.equal((await fetch(base + '/unknown')).status, 404);
  } finally { await close(gateway); await close(upstream); }
});

test('pinned REA capability catalog is served privately and actual tool calls remain upstream',async()=>{
 let calls=0;const upstream=http.createServer(async(req,res)=>{calls++;let raw='';for await(const c of req)raw+=c;const msg=JSON.parse(raw);assert.equal(req.headers.authorization,undefined);assert.equal(msg.method,'tools/call');res.setHeader('content-type','application/json');res.end(JSON.stringify({jsonrpc:'2.0',id:msg.id,result:{content:[{type:'text',text:'actual REA tool ran'}]}}));});
 const upPort=await listen(upstream),catalog={tools:[{name:'inspect_analysis_settings',inputSchema:{type:'object'}}],prompts:[{name:'investigate_feature'}]};
 const gateway=createGateway({token,upstreamPort:upPort,discovery:catalog}),port=await listen(gateway),base='http://127.0.0.1:'+port+'/mcp';
 const send=(msg,authenticated=true)=>fetch(base,{method:'POST',headers:{'content-type':'application/json','accept':'application/json, text/event-stream',...(authenticated?{authorization:'Bearer '+token}:{})},body:JSON.stringify(msg)});
 try{
  const list={jsonrpc:'2.0',id:1,method:'tools/list',params:{}};
  assert.equal((await send(list,false)).status,401);
  const tools=await send(list);assert.equal(tools.status,200);assert.deepEqual((await tools.json()).result.tools,catalog.tools);
  const prompts=await(await send({jsonrpc:'2.0',id:2,method:'prompts/list',params:{}})).json();assert.deepEqual(prompts.result.prompts,catalog.prompts);
  assert.equal(calls,0);
  const called=await(await send({jsonrpc:'2.0',id:3,method:'tools/call',params:{name:'inspect_analysis_settings',arguments:{}}})).json();assert.equal(called.result.content[0].text,'actual REA tool ran');
  const large={jsonrpc:'2.0',id:4,method:'tools/call',params:{name:'inspect_analysis_settings',arguments:{padding:'x'.repeat(3000)}}};
  const big=await(await send(large)).json();assert.equal(big.result.content[0].text,'actual REA tool ran');assert.equal(calls,2);
 }finally{await close(gateway);await close(upstream);}
});

test('Manufact anonymous initialization is read-only; all other MCP methods require bearer',async()=>{
 const previous=process.env.MCP_URL;
 process.env.MCP_URL='https://test.run.mcp-use.com/mcp';
 const gateway=createGateway({token,isUpstreamReady:()=>true});
 const port=await listen(gateway),base='http://127.0.0.1:'+port+'/mcp';
 const send=msg=>fetch(base,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(msg)});
 try{
  const init=await send({jsonrpc:'2.0',id:7,method:'initialize',params:{protocolVersion:'2025-11-25',capabilities:{}}});
  assert.equal(init.status,200);
  const value=await init.json();
  assert.equal(value.result.serverInfo.name,'prismtek-rea-cloud');
  assert.equal(value.id,7);
  for(const method of ['tools/list','tools/call','prompts/list','notifications/initialized']){
   const denied=await send({jsonrpc:'2.0',id:8,method});
   assert.equal(denied.status,401,method);
  }
  const deniedGet=await fetch(base);assert.equal(deniedGet.status,401);
 }finally{
  await close(gateway);
  if(previous===undefined)delete process.env.MCP_URL;else process.env.MCP_URL=previous;
 }
});
