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
export function createGateway({ token, upstreamPort = 8765, isUpstreamReady = () => true }) {
  if (typeof token !== 'string' || token.length < 32) {
    throw new Error('REA_GATEWAY_TOKEN must be at least 32 characters');
  }
  return http.createServer((req, res) => {
    if (req.url === '/healthz' && req.method === 'GET') {
      const up = isUpstreamReady();
      res.writeHead(up ? 200 : 503, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      res.end(JSON.stringify({ service: 'prismtek-rea-cloud', ready: up }));
      return;
    }
    if (req.url !== '/mcp' || !['POST', 'GET', 'DELETE'].includes(req.method)) {
      res.writeHead(404); res.end('Not found'); return;
    }
    if (!validBearer(req.headers.authorization, token)) {
      res.writeHead(401, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      res.end(JSON.stringify({ error: 'unauthorized' }));
      return;
    }
    if (!isUpstreamReady()) {
      res.writeHead(503); res.end('REA is starting'); return;
    }
    const headers = {};
    for (const key of requestHeaders) {
      if (req.headers[key]) headers[key] = req.headers[key];
    }
    // Never forward caller-supplied Authorization, cookies or Host to REA.
    const upstream = http.request({
      hostname: '127.0.0.1', port: upstreamPort, path: '/mcp', method: req.method,
      headers, timeout: 5 * 60 * 1000,
    }, response => {
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
