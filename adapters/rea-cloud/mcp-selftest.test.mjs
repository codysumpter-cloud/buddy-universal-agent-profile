import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { runReaSelfTest } from './mcp-selftest.mjs';

test('REA self-test completes initialized, session-bound MCP tools/call', async () => {
  let initialized = false;
  const session = 'fake-test-session';
  const upstream = http.createServer(async (req, res) => {
    let body = '';
    for await (const part of req) body += part;
    const rpc = JSON.parse(body);
    assert.match(req.headers.accept, /text\/event-stream/);
    if (rpc.method !== 'initialize') assert.equal(req.headers['mcp-session-id'], session);
    if (rpc.method === 'initialize') {
      res.setHeader('mcp-session-id', session);
      res.setHeader('content-type', 'text/event-stream');
      res.end('event: message\ndata: ' + JSON.stringify({jsonrpc:'2.0',id:rpc.id,
        result: {serverInfo:{name:'rea'},protocolVersion:'2025-11-25',capabilities:{}} })+'\n\n');
    } else if (rpc.method === 'notifications/initialized') {
      initialized = true; res.writeHead(202); res.end();
    } else if (rpc.method === 'tools/list') {
      assert.equal(initialized, true);
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({jsonrpc:'2.0',id:rpc.id,
        result:{tools:[{name:'inspect_analysis_settings'}]}}));
    } else if (rpc.method === 'tools/call') {
      assert.equal(rpc.params.name, 'inspect_analysis_settings');
      res.setHeader('content-type', 'text/event-stream');
      res.end('data: '+JSON.stringify({jsonrpc:'2.0',id:rpc.id,
        result:{content:[{type:'text',text:'success'}]}})+'\n\n');
    } else assert.fail('unexpected MCP method '+rpc.method);
  });
  await new Promise(resolve => upstream.listen(0,'127.0.0.1',resolve));
  try {
    assert.deepEqual(await runReaSelfTest(upstream.address().port),
      {initialized:true,toolCount:1,called:'inspect_analysis_settings',toolCallSucceeded:true});
  } finally {
    await new Promise(resolve => upstream.close(resolve));
  }
});
