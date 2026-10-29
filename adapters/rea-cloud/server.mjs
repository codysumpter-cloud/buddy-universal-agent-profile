import { spawn } from 'node:child_process';
import {readFileSync} from 'node:fs';
import { createGateway } from './gateway.mjs';
import { runReaSelfTest } from './mcp-selftest.mjs';
import {createReaCapabilities} from './capability-bridge.mjs';
import { verifyCoreReadiness, openVerifiedGateway } from './readiness.mjs';
import {createPreviewAudit,createAuditHandler} from './studio-audit.mjs';
import {createStudioHandler} from './studio-web.mjs';
import {createUploadAudit} from './studio-upload.mjs';
import {runFullBonkAudit} from './full-bonk-audit.mjs';
import {runWorldfallPerspectiveAudit} from './perspective-mod-audit.mjs';

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
const reaCapabilities=discovery?createReaCapabilities({catalog:discovery}):null;
const studioHandler=createStudioHandler({token,studioProxyToken:process.env.REA_STUDIO_PROXY_TOKEN,root:new URL('./studio-public/',import.meta.url).pathname,isCoreReady:()=>status.ready,proof:()=>coreProof,audits:previewAudits,uploads:uploadAudits,capabilities:reaCapabilities});
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
  if(gateway.listening)gateway.close();
  process.exitCode = code || 1;
});
// Do not publish HTTP/MCP readiness until the actual MCP initialize,
// tools/list and an owner-safe tools/call have all succeeded.
void openVerifiedGateway({
 gateway,port:externalPort,host:'0.0.0.0',isStopped:()=>upstream.exitCode!==null||upstream.killed,
 proof:verifyCoreReadiness({
 verify:()=>runReaSelfTest(internalPort),
 isStopped:()=>upstream.exitCode!==null||upstream.killed,
 onRetry:(attempt,error)=>{
  if(attempt===1||attempt%10===0)console.warn('[rea-core-readiness]',JSON.stringify({attempt,retry:true,reason:String(error?.message||error).slice(0,140)}));
 }
})
}).then(result=>{
 if(upstream.exitCode!==null||upstream.killed)return;
 coreProof={passed:true,tool:'inspect_analysis_settings'};
 status.ready=true;
 console.log('[rea-core-verified]',JSON.stringify(result));
 console.log('REA gateway listening on '+externalPort+' after tool verification');
 // Owner-requested whole-game source investigation, opt-in and source-bounded.
 // Uses the real internal REA MCP process, never the PixelLab REA dashboard.
 // REA's stateful MCP is shared. The two audits run sequentially.
 // Each audit uses the actual internal REA tools/call; no model-generated substitute.
 if(process.env.REA_RUN_FULL_BONK_AUDIT==='1'||process.env.REA_RUN_WORLDFALL_AUDIT==='1'){
  void(async()=>{
   if(process.env.REA_RUN_FULL_BONK_AUDIT==='1'){
    try{await runFullBonkAudit();}catch(error){console.error('[rea-bonk-audit-failed]',String(error?.message||error).slice(0,350));}
   }
   if(process.env.REA_RUN_WORLDFALL_AUDIT==='1'){
    try{await runWorldfallPerspectiveAudit();}catch(error){console.error('[rea-worldfall-audit-failed]',String(error?.message||error).slice(0,350));}
   }
  })();
 }
 // REA Core maintains one stateful MCP session. Do not run the unrelated
 // racing preview smoke alongside the whole BONK analysis.
 if(process.env.REA_RUN_PREVIEW_SMOKE==='1'&&process.env.REA_RUN_FULL_BONK_AUDIT!=='1'&&process.env.REA_RUN_WORLDFALL_AUDIT!=='1'){
  try{
   const job=previewAudits.start('racing-game');
   console.log('[rea-preview-smoke-start]',JSON.stringify({id:job.id,slug:job.slug}));
   const check=setInterval(()=>{
    const current=previewAudits.get(job.id);
    if(!current||current.status==='completed'||current.status==='failed'){
     clearInterval(check);
     console.log('[rea-preview-smoke-end]',JSON.stringify({status:current?.status,evidenceId:current?.result?.evidenceId||null,statistics:current?.result?.statistics||null,error:current?.error||null}));
    }
   },3000);
   check.unref();
  }catch(error){console.error('[rea-preview-smoke-error]',String(error.message).slice(0,160));}
 }
}).catch(error=>console.error('[rea-core-unverified]',String(error.message).slice(0,180)));
// Render's TCP health check sees the port only after MCP is verified.
function shutdown(signal) {
  status.ready = false;
  if(gateway.listening)gateway.close();
  upstream.kill(signal);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));