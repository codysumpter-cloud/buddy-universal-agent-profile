import http from 'node:http';

const version = '2025-11-25';
const limitBytes = 16 * 1024 * 1024;

// An authenticated gateway does not imply that a stateful upstream MCP session works.
// This private, read-only probe initializes REA and calls one safe inspection tool.
export function rpc(port, message, sessionId, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(message);
    const headers = {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      'mcp-protocol-version': version,
      'content-length': Buffer.byteLength(body),
    };
    if (sessionId) headers['mcp-session-id'] = sessionId;
    const req = http.request({
      hostname: '127.0.0.1', port, path: '/mcp', method: 'POST', headers,
    }, res => {
      const sid = res.headers['mcp-session-id'] || sessionId;
      console.log('[rea-mcp-http]', JSON.stringify({method:message.method,status:res.statusCode,type:String(res.headers['content-type']||'').slice(0,55)}));
      if (res.statusCode === 202 && !('id' in message)) {
        res.resume();
        resolve({ result: null, sessionId: sid });
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error('REA HTTP status ' + res.statusCode));
        return;
      }
      let buffer = '';
      let bytes = 0;
      let settled = false;
      const finish = (error, value) => {
        if (settled) return;
        settled = true;
        if (error) reject(error);
        else resolve({ result: value, sessionId: sid });
        res.destroy();
      };
      const sse = String(res.headers['content-type'] || '').includes('text/event-stream');
      res.on('data', chunk => {
        bytes += chunk.length;
        if (bytes > limitBytes) return finish(new Error('REA MCP response too large'));
        buffer += chunk.toString();
        if (!sse) return;
        const frames = buffer.split(/\r?\n\r?\n/);
        buffer = frames.pop() || '';
        for (const frame of frames) {
          const payload = frame.split(/\r?\n/).filter(x => x.startsWith('data:')).map(x => x.slice(5).trim()).join('\n');
          if (!payload) continue;
          try {
            const response = JSON.parse(payload);
            if (response.id === message.id) return finish(null, response);
          } catch { /* Not a JSON-RPC result frame. */ }
        }
      });
      res.on('end', () => {
        if (settled) return;
        try {
          const response = JSON.parse(buffer);
          if (response.id !== message.id) throw new Error('JSON-RPC ID mismatch');
          finish(null, response);
        } catch (error) { finish(error); }
      });
      res.on('error', error => finish(error));
    });
    req.setTimeout(timeoutMs, () => req.destroy(new Error('REA MCP request timed out')));
    req.on('error', reject);
    req.end(body);
  });
}

export async function runReaSelfTest(port = 8765) {
  console.log('[rea-core-stage] initialize:start');
  const init = await rpc(port, {
    jsonrpc: '2.0', id: 1, method: 'initialize',
    params: { protocolVersion: version, capabilities: {},
      clientInfo: { name: 'prismtek-rea-cloud-selftest', version: '1.0.0' } },
  });
  if (init.result?.error || !init.result?.result?.serverInfo)
    throw new Error('REA MCP initialize failed');
  console.log('[rea-core-stage] initialize:ok; notification:start');
  await rpc(port, { jsonrpc: '2.0', method: 'notifications/initialized' }, init.sessionId);
  console.log('[rea-core-stage] notification:ok; tools/list:start');
  const list = await rpc(port, { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }, init.sessionId);
  console.log('[rea-core-stage] tools/list:response');
  const tools = list.result?.result?.tools;
  if (!Array.isArray(tools) || list.result?.error)
    throw new Error('REA MCP tools/list failed');
  if (!tools.some(t => t.name === 'inspect_analysis_settings'))
    throw new Error('REA inspection tool missing');
  console.log('[rea-core-stage] tools/call:start');
  const called = await rpc(port, { jsonrpc: '2.0', id: 3, method: 'tools/call',
    params: { name: 'inspect_analysis_settings', arguments: {} } }, init.sessionId);
  if (!called.result?.result || called.result?.error || called.result?.result?.isError)
    throw new Error('REA inspect_analysis_settings failed');
  console.log('[rea-core-stage] tools/call:ok');
  return { initialized: true, toolCount: tools.length,
    called: 'inspect_analysis_settings', toolCallSucceeded: true };
}
