import { spawn } from 'node:child_process';
import http from 'node:http';
import { createGateway } from './gateway.mjs';
import { runReaSelfTest } from './mcp-selftest.mjs';
import {createPreviewAudit,createAuditHandler} from './studio-audit.mjs';

const token = process.env.REA_GATEWAY_TOKEN;
const externalPort = Number(process.env.PORT || 10000);
const internalPort = 8765;
// Fail closed before starting a server if configuration is incomplete.
const status = { ready: false };
const previewAudits=createPreviewAudit();
const gateway = createGateway({ token, upstreamPort: internalPort, isUpstreamReady: () => status.ready, auditHandler:createAuditHandler(previewAudits) });
const upstream = spawn(process.execPath, [
  'node_modules/rea-agents/scripts/rea.mjs', 'mcp', '--http',
  '--host', '127.0.0.1', '--port', String(internalPort),
], { cwd: import.meta.dirname, stdio: ['ignore', 'ignore', 'pipe'], env: process.env });
upstream.stderr.on('data', (data) => {
  const message = data.toString().trim();
  if (message) console.error('[rea]', message.slice(0, 2000));
});
upstream.on('exit', (code, signal) => {
  status.ready = false;
  console.error('REA exited:', code, signal);
  gateway.close();
  process.exitCode = code || 1;
});
let retries = 0;
const probe = () => {
  if (status.ready || upstream.exitCode !== null) return;
  const req = http.request({ hostname: '127.0.0.1', port: internalPort, path: '/mcp', method: 'GET', timeout: 500 }, (res) => {
    res.resume(); status.ready = true;
    // Run a real, read-only REA tool call on the Render host, not the user's computer.
    setTimeout(() => {
      runReaSelfTest(internalPort)
        .then(result => console.log('[rea-core-verified]', JSON.stringify(result)))
        .catch(error => console.error('[rea-core-unverified]', String(error.message).slice(0, 160)));
    }, 500);
  });
  req.on('error', () => { if (++retries < 120) setTimeout(probe, 1000); });
  req.on('timeout', () => req.destroy());
  req.end();
};
probe();
gateway.listen(externalPort, '0.0.0.0', () => console.log('REA gateway listening on ' + externalPort));
function shutdown(signal) {
  status.ready = false;
  gateway.close();
  upstream.kill(signal);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));