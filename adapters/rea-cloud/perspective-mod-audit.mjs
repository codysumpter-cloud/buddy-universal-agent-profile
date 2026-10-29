import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {inflateRawSync} from 'node:zlib';
import {rpc} from './mcp-selftest.mjs';

// Read-only, source-bounded examination on Render. Never execute target code.
const URL='https://github.com/s3cond2/worldfall/releases/download/beta-0.9.8.9/Worldfall.zip';
const ZIP_SHA='29ecd204f6e009a570a121d25455363327957ee2fd6e86bc88190a7270202588';
const DLL_SHA='6ed462670ced8b33cce6c5a639c50158aac85dc99ff03d0b1b7669302db12770';
const sha=b=>createHash('sha256').update(b).digest('hex');
const short=e=>String(e?.message||e).replace(/[\r\n]/g,' ').slice(0,180);
export function selectedZipEntries(buf){
 if(!Buffer.isBuffer(buf)||buf.length<22||buf.length>66*1024*1024)throw Error('ZIP bounds invalid');
 let end=-1;for(let i=buf.length-22;i>=Math.max(0,buf.length-65557);i--){if(buf.readUInt32LE(i)===0x06054b50){end=i;break;}}
 if(end<0)throw Error('ZIP directory missing');
 const n=buf.readUInt16LE(end+10),start=buf.readUInt32LE(end+16),size=buf.readUInt32LE(end+12);
 if(n>5000||start+size>buf.length)throw Error('ZIP directory out of bounds');
 let pos=start;const result=new Map();
 for(let i=0;i<n;i++){
  if(pos+46>buf.length||buf.readUInt32LE(pos)!==0x02014b50)throw Error('ZIP central header invalid');
  const flags=buf.readUInt16LE(pos+8),method=buf.readUInt16LE(pos+10);
  const packed=buf.readUInt32LE(pos+20),unpacked=buf.readUInt32LE(pos+24);
  const nameLen=buf.readUInt16LE(pos+28),extra=buf.readUInt16LE(pos+30),comment=buf.readUInt16LE(pos+32),offset=buf.readUInt32LE(pos+42);
  if(pos+46+nameLen+extra+comment>buf.length)throw Error('ZIP member truncated');
  const name=buf.subarray(pos+46,pos+46+nameLen).toString('utf8').split('/').at(-1);
  pos+=46+nameLen+extra+comment;
  if(!['Worldfall.dll','LICENSE.txt'].includes(name)||result.has(name))continue;
  if(flags&1||![0,8].includes(method)||packed>66*1024*1024||unpacked>72*1024*1024)throw Error('Selected member rejected');
  if(offset+30>buf.length||buf.readUInt32LE(offset)!==0x04034b50)throw Error('ZIP local header invalid');
  const at=offset+30+buf.readUInt16LE(offset+26)+buf.readUInt16LE(offset+28);
  if(at+packed>buf.length)throw Error('ZIP member out of bounds');
  const data=method===8?inflateRawSync(buf.subarray(at,at+packed),{maxOutputLength:72*1024*1024}):buf.subarray(at,at+packed);
  if(data.length!==unpacked)throw Error('ZIP size mismatch');
  result.set(name,data);
 }
 return result;
}
async function download(fetcher){
 const response=await fetcher(URL,{signal:AbortSignal.timeout(90000)});
 if(!response.ok)throw Error('Official release HTTP '+response.status);
 const host=new URL(response.url).hostname;
 if(!['github.com','release-assets.githubusercontent.com','objects.githubusercontent.com'].includes(host))throw Error('Unexpected release host');
 let size=0;const chunks=[];
 for await(const part of response.body){size+=part.length;if(size>66*1024*1024)throw Error('Archive limit exceeded');chunks.push(Buffer.from(part));}
 return Buffer.concat(chunks,size);
}
function unpackRpc(r){
 if(r?.result?.error)throw Error(short(r.result.error));
 const out=r?.result?.result;
 if(!out||out.isError)throw Error(short(out?.content?.find(c=>c.type==='text')?.text||'No REA result'));
 return out.structuredContent||out;
}
const receipt=(name,d)=>{
 const inner=d.normalized_result||d.result?.normalized_result||d;
 return {tool:name,evidenceId:inner.parent_evidence_id||inner.evidence_id||d.evidence_id||null,
  statistics:inner.summary?.statistics||inner.statistics||null,
  coverage:inner.summary?.coverage||inner.coverage||null,
  limitations:(inner.summary?.limitations||inner.limitations||[]).slice(0,6)};
};
/** Only a narrowly scoped, static investigation of the downloaded official DLL. */
export async function runWorldfallPerspectiveAudit({fetcher=fetch,call=rpc,log=console.log}={}){
 let dir;let stage='capture';
 try{
  const zip=await download(fetcher);
  if(sha(zip)!==ZIP_SHA)throw Error('Official published ZIP SHA-256 mismatch');
  const members=selectedZipEntries(zip),dll=members.get('Worldfall.dll');
  if(!dll||sha(dll)!==DLL_SHA)throw Error('Published DLL SHA-256 mismatch');
  if(!/copyright|license|licence/i.test(members.get('LICENSE.txt')?.toString('utf8')||''))throw Error('Expected license missing');
  dir=await fs.mkdtemp(path.join(os.tmpdir(),'rea-worldfall-'));
  const file=path.join(dir,'Worldfall.dll');await fs.writeFile(file,dll,{flag:'wx',mode:0o600});
  log('[rea-worldfall-manifest]',JSON.stringify({version:'0.9.8.9',source:URL,sha256:sha(dll),bytes:dll.length,retention:'ephemeral'}));
  stage='initialize';
  const init=await call(8765,{jsonrpc:'2.0',id:701,method:'initialize',params:{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'prismtek-worldfall-investigation',version:'1.0'}}},undefined,30000);
  if(!init?.result?.result||!init?.sessionId)throw Error('REA MCP initialize failed');
  await call(8765,{jsonrpc:'2.0',method:'notifications/initialized'},init.sessionId,15000);
  const list=unpackRpc(await call(8765,{jsonrpc:'2.0',id:702,method:'tools/list',params:{}},init.sessionId,30000));
  const available=new Set((list.tools||[]).map(t=>t.name));
  if(!available.has('inspect_managed_artifact'))throw Error('REA managed-code engine absent');
  const results=[];let id=703;
  for(const name of ['inspect_managed_artifact','inspect_managed_members','inspect_managed_native_boundaries']){
   if(!available.has(name)){results.push({tool:name,status:'not advertised'});continue;}
   stage=name;
   try{const d=unpackRpc(await call(8765,{jsonrpc:'2.0',id:id++,method:'tools/call',params:{name,arguments:{path:file,detail:'summary'}}},init.sessionId,155000));
    const note={...receipt(name,d),status:'success'};results.push(note);
    log('[rea-worldfall-evidence]',JSON.stringify(note).slice(0,2200));
   }catch(e){const note={tool:name,status:'failed',reason:short(e)};results.push(note);log('[rea-worldfall-coverage]',JSON.stringify(note));}
  }
  const report={target:'Worldfall 0.9.8.9',source:URL,sha256:sha(dll),analysis:'REA 6.8.0 managed metadata/CIL static',results,
   notExamined:['WorldBox host runtime and Unity hooks','actual 3D movement and camera synchronization in-game','Project Viewpoint (different Steam Workshop artifact)']};
  log('[rea-worldfall-result]',JSON.stringify(report).slice(0,8500));return report;
 }catch(e){log('[rea-worldfall-error]',JSON.stringify({stage,error:short(e)}));throw e;}
 finally{if(dir)await fs.rm(dir,{recursive:true,force:true,maxRetries:3});}
}
