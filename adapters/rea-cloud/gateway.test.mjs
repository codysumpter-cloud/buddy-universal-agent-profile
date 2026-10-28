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
