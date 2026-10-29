import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';

const requestHeaders = [
  'accept', 'content-type', 'mcp-session-id', 'mcp-protocol-version',
  'last-event-id', 'user-agent',
];
const responseHeaders = [
  'content-type', 'cache-control', 'mcp-session-id', 'mcp-protocol-version',
];

function validBearer(value, secret) {
  if (!value?.startsWith('Bearer ')) return false;
  const supplied = Buffer.from(value.slice(7));
  const expected = Buffer.from(secret);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

// Upstream REA has no authentication and can perform stateful operations. Do not
// expose its internal listener or provide an unauthenticated fallback.
export function createGateway({ token, upstreamPort = 8765, isUpstreamReady = () => true, auditHandler = null, discovery = null, studioHandler = null }) {
  if (typeof token !== 'string' || token.length < 32) {
    throw new Error('REA_GATEWAY_TOKEN must be at least 32 characters');
  }
  return http.createServer((req, res) => {
    const startTime = Date.now();
    // Log only protocol/status metadata, never credentials, payloads or session IDs.
    let upstreamStatus = null;
    let upstreamContentType = null;
    let reported = false;
    const report = (event) => {
      if (reported || (req.url !== '/mcp' && req.url !== '/healthz')) return;
      reported = true;
      console.log('[rea-gateway]', JSON.stringify({
        event, method: req.method, route: req.url, status: res.statusCode,
        upstreamStatus, upstreamContentType,
        ms: Date.now() - startTime,
        accept: String(req.headers.accept || '').slice(0, 96),
        protocol: String(req.headers['mcp-protocol-version'] || '').slice(0, 40),
        authorized: req.url === '/mcp' ? validBearer(req.headers.authorization, token) : null,
      }));
    };
    res.once('finish', () => report('finished'));
    res.once('close', () => report('closed'));
    // Owner Studio stays on this Render service, sharing REA's trusted origin.
    if ((req.url?.startsWith('/studio/') || req.url === '/studio' || req.url?.startsWith('/studio?')) && studioHandler) { Promise.resolve(studioHandler(req,res)).catch(()=>{if(!res.headersSent)res.writeHead(500,{'cache-control':'no-store'});res.end('Studio service unavailable');});return; }
    if ((req.url === '/healthz' || (process.env.MCP_URL && req.url === '/health')) && req.method === 'GET') {
      const up = isUpstreamReady();
      res.writeHead(up ? 200 : 503, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      res.end(JSON.stringify({ service: 'prismtek-rea-cloud', ready: up }));
      return;
    }
    if (req.url?.startsWith('/audit/')) {
      if (!validBearer(req.headers.authorization, token)) {res.writeHead(401, {'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify({error:'unauthorized'}));return;}
      if (!isUpstreamReady()) {res.writeHead(503, {'cache-control':'no-store'});res.end('REA is starting');return;}
      if (!auditHandler) {res.writeHead(404);res.end();return;}
      Promise.resolve(auditHandler(req,res)).catch(()=>{if(!res.headersSent)res.writeHead(500,{'cache-control':'no-store'});res.end('Private audit unavailable');});
      return;
    }
    if (req.url !== '/mcp' || !['POST', 'GET', 'DELETE'].includes(req.method)) {
      res.writeHead(404); res.end('Not found'); return;
    }
    // Manufact's deployment probe performs an anonymous MCP initialize POST.
    // Answer only that protocol handshake, never tools/list or tools/call.
    // Render does not inject MCP_URL and keeps its fully authenticated behavior.
    if (process.env.MCP_URL && req.method === 'POST' && !validBearer(req.headers.authorization, token)) {
      let raw = '';
      let size = 0;
      let rejected = false;
      req.on('data', chunk => {
        size += chunk.length;
        if (size > 4096) {
          rejected = true;
          res.writeHead(413, { 'cache-control': 'no-store' });
          res.end();
          req.pause();
        } else raw += chunk.toString();
      });
      req.on('end', () => {
        if (rejected) return;
        let message;
        try { message = JSON.parse(raw); } catch { message = null; }
        if (message?.jsonrpc === '2.0' && message.method === 'initialize' &&
            (typeof message.id === 'number' || typeof message.id === 'string') &&
            isUpstreamReady()) {
          const payload = JSON.stringify({ jsonrpc: '2.0', id: message.id, result: {
            protocolVersion: '2025-11-25', capabilities: {},
            serverInfo: { name: 'prismtek-rea-cloud', version: '6.8.0' }
          } });
          res.writeHead(200, { 'content-type': 'application/json',
            'cache-control': 'no-store', 'content-length': Buffer.byteLength(payload) });
          res.end(payload);
          return;
        }
        res.writeHead(401, { 'content-type': 'application/json', 'cache-control': 'no-store' });
        res.end(JSON.stringify({ error: 'unauthorized' }));
      });
      return;
    }
    if (!validBearer(req.headers.authorization, token)) {
      res.writeHead(401, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      res.end(JSON.stringify({ error: 'unauthorized' }));
      return;
    }
    if (!isUpstreamReady()) {
      res.writeHead(503); res.end('REA is starting'); return;
    }
    // Streamable HTTP allows POST-only servers to reject optional GET/SSE
    // with 405. The upstream REA server is single-session and its persistent
    // GET subscription can starve the concurrent POST capability scans made
    // by Cloudflare's MCP portal. Keep REA's upstream session for POSTs.
    if (req.method === 'GET') {
      res.writeHead(405, { 'allow': 'POST, DELETE', 'cache-control': 'no-store' });
      res.end();
      return;
    }
    // Pinned REA 6.8.0 catalog serves authenticated capability discovery immediately.
    // Real MCP tools/call still goes to the stateful REA server, unchanged.
    if (req.method === 'POST' && discovery && Number(req.headers['content-length']||0)>0 && Number(req.headers['content-length'])<=2048) {
      let raw = '';let bytes = 0;
      req.on('data', chunk => {bytes += chunk.length;if(bytes < 16385)raw += chunk;});
      req.on('end', () => {
        if(bytes > 16384){res.writeHead(413, {'cache-control':'no-store'});res.end();return;}
        let message;try{message=JSON.parse(raw);}catch{message=null;}
        const kind=message?.method;
        const items=kind==='tools/list'?discovery.tools:kind==='prompts/list'?discovery.prompts:null;
        if(items&&message.jsonrpc==='2.0'&&(['number','string'].includes(typeof message.id))&&(!message.params?.cursor)){
          const payload=JSON.stringify({jsonrpc:'2.0',id:message.id,result:kind==='tools/list'?{tools:items}:{prompts:items}});
          const headers={'content-type':'application/json','cache-control':'no-store','content-length':Buffer.byteLength(payload)};
          if(typeof req.headers['mcp-session-id']==='string')headers['mcp-session-id']=req.headers['mcp-session-id'];
          res.writeHead(200,headers);res.end(payload);return;
        }
        // Unsupported discovery request: forward the already buffered bytes without credentials.
        forward(Buffer.from(raw));
      });
      req.on('error',()=>{if(!res.headersSent)res.writeHead(400);res.end();});
      function forward(body){
        const headers={};for(const key of requestHeaders){if(req.headers[key])headers[key]=req.headers[key];}
        headers['content-length']=body.byteLength;
        const upstream=http.request({hostname:'127.0.0.1',port:upstreamPort,path:'/mcp',method:'POST',headers,timeout:5*60*1000},response=>{const safe={};for(const k of responseHeaders){if(response.headers[k])safe[k]=response.headers[k];}res.writeHead(response.statusCode||502,safe);response.pipe(res);});
        upstream.on('timeout',()=>upstream.destroy(new Error('Upstream timeout')));
        upstream.on('error',()=>{if(!res.headersSent)res.writeHead(502);res.end('REA upstream unavailable');});
        upstream.end(body);
      }
      return;
    }
    const headers = {};
    for (const key of requestHeaders) {
      if (req.headers[key]) headers[key] = req.headers[key];
    }
    // Never forward caller-supplied Authorization, cookies or Host to REA.
    console.log('[rea-gateway:start]', JSON.stringify({ method: req.method, route: '/mcp', accept: String(req.headers.accept || '').slice(0, 96), protocol: String(req.headers['mcp-protocol-version'] || '').slice(0, 40) }));
    const upstream = http.request({
      hostname: '127.0.0.1', port: upstreamPort, path: '/mcp', method: req.method,
      headers, timeout: 5 * 60 * 1000,
    }, response => {
      upstreamStatus = response.statusCode;
      upstreamContentType = String(response.headers['content-type'] || '').slice(0, 96);
      const safeHeaders = {};
      for (const key of responseHeaders) {
        if (response.headers[key]) safeHeaders[key] = response.headers[key];
      }
      res.writeHead(response.statusCode || 502, safeHeaders);
      response.pipe(res);
    });
    upstream.on('timeout', () => upstream.destroy(new Error('Upstream timeout')));
    upstream.on('error', () => {
      if (!res.headersSent) res.writeHead(502, { 'cache-control': 'no-store' });
      res.end('REA upstream unavailable');
    });
    req.on('aborted', () => upstream.destroy());
    req.pipe(upstream);
  });
}