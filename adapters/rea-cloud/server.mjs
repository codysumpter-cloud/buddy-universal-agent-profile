import { spawn } from 'node:child_process';
import http from 'node:http';
import {readFileSync} from 'node:fs';
import { createGateway } from './gateway.mjs';
import { runReaSelfTest } from './mcp-selftest.mjs';
import {createPreviewAudit,createAuditHandler} from './studio-audit.mjs';
import {createStudioHandler} from './studio-web.mjs';
import {createUploadAudit} from './studio-upload.mjs';

const token = process.env.REA_GATEWAY_TOKEN;
const externalPort = Number(process.env.PORT || 10000);
const internalPort = 8765;
// Fail closed before starting a server if configuration is incomplete.
const status = { ready: false };
const previewAudits=createPreviewAudit();
const uploadAudits=createUploadAudit();
// Only advertise the checked-in, pinned package catalog; never fabricate extra tools.
let discovery=null;
try{
 const catalog=JSON.parse(readFileSync(new URL('./node_modules/rea-agents/dist/mcp-catalog.json',import.meta.url),'utf8'));
 if(catalog?.info?.version==='6.8.0'&&catalog.tools?.length===229&&catalog.prompts?.length===6)discovery={tools:catalog.tools,prompts:catalog.prompts};
 else console.warn('[rea-discovery] pinned catalog did not match installed core; using normal MCP discovery');
}catch(e){console.warn('[rea-discovery] pinned catalog unavailable; using normal MCP discovery');}
let coreProof=null;
const studioHandler=createStudioHandler({token,root:new URL('./studio-public/',import.meta.url).pathname,isCoreReady:()=>status.ready,proof:()=>coreProof,audits:previewAudits,uploads:uploadAudits});
const gateway = createGateway({ token, upstreamPort: internalPort, isUpstreamReady: () => status.ready, auditHandler:createAuditHandler(previewAudits),discovery,studioHandler });
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
        .then(result => {
          coreProof={passed:true,tool:'inspect_analysis_settings'};
          console.log('[rea-core-verified]', JSON.stringify(result));
          if (process.env.REA_RUN_PREVIEW_SMOKE === '1') {
            try { const job=previewAudits.start('racing-game');
              console.log('[rea-preview-smoke-start]', JSON.stringify({id:job.id,slug:job.slug}));
              const check=setInterval(()=>{const current=previewAudits.get(job.id);if(!current||current.status==='completed'||current.status==='failed'){clearInterval(check);console.log('[rea-preview-smoke-end]',JSON.stringify({status:current?.status,evidenceId:current?.result?.evidenceId||null,statistics:current?.result?.statistics||null,error:current?.error||null}));}},3000);
              check.unref();
            } catch(error){console.error('[rea-preview-smoke-error]',String(error.message).slice(0,160));}
          }
        })
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
