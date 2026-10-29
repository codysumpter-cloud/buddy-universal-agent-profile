import fs from 'node:fs';
import path from 'node:path';
import {createHash,timingSafeEqual} from 'node:crypto';
import {Readable} from 'node:stream';

const allowedMedia=/^\/studio\/(?:assets\/|atlases\/)([a-zA-Z0-9_.-]+(?:\/[a-zA-Z0-9_.-]+)*)\.(png|webp|jpe?g|json|woff2?|ttf|svg)$/;
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.jpeg':'image/jpeg','.ico':'image/x-icon','.woff2':'font/woff2','.ttf':'font/ttf','.svg':'image/svg+xml'};
const json=(res,code,data)=>{res.writeHead(code,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(JSON.stringify(data));};
function bearer(value,secret){if(!value?.startsWith('Bearer ')||typeof secret!=='string')return false;const a=Buffer.from(value.slice(7)),b=Buffer.from(secret);return a.length===b.length&&timingSafeEqual(a,b);}
const SAFE_ID=/^[a-f0-9-]{36}$/i;
function safePortion(req){return new URL(req.url||'/', 'https://render.internal').pathname;}
// Public frontend is the same compiled browser code already distributed by the owner PixelLab project;
// private source packages, user uploads, Warehouse files and source maps are not bundled.
export function createStudioHandler({token,root,isCoreReady=()=>false,proof=()=>null,audits,fetcher=fetch}){
 if(typeof token!=='string'||token.length<32)throw Error('Studio requires existing owner gateway secret');
 const base=path.resolve(root);
 return async(req,res)=>{
  const pathname=safePortion(req);
  if(pathname==='/studio'&&req.method==='GET'){
   const q=new URL(req.url||'/studio','https://render.internal').search;
   res.writeHead(302,{location:'/studio/'+q,'cache-control':'no-store'});res.end();return true;
  }
  if(!pathname.startsWith('/studio/'))return false;
  if(req.method!=='GET'&&req.method!=='POST'){json(res,405,{error:'Unsupported request method'});return true;}
  if(pathname==='/studio/api/rea/setup'&&req.method==='GET'){
   json(res,200,{ownerAccessConfigured:true,cloudBridgeConfigured:isCoreReady(),privateContentProtected:true,needsOperatorSetup:!isCoreReady(),backend:'Render REA 6.8.0'});return true;
  }
  if(pathname.startsWith('/studio/api/rea/')){
   if(!bearer(req.headers.authorization,token)){json(res,401,{error:'Owner authentication required'});return true;}
   if(!isCoreReady()){json(res,503,{error:'REA Core starting'});return true;}
   if(pathname==='/studio/api/rea/health'&&req.method==='GET'){
    const result=proof();
    json(res,200,result?.passed?{status:'core-verified',coreVerified:true,tool:result.tool||'inspect_analysis_settings',message:'Render core executed read-only REA tool successfully'}:{status:'checking',coreVerified:false,message:'REA core is ready; independent tool verification pending'});
    return true;
   }
   if(pathname==='/studio/api/rea/jobs'&&req.method==='GET'){json(res,200,{status:'configured-unverified',coreVerified:false,jobs:[]});return true;}
   if(pathname==='/studio/api/rea/cloud-scans'&&req.method==='GET'){json(res,200,{scans:audits.list(),note:'Render owns these bounded REA evidence receipts; process memory is ephemeral.'});return true;}
   if(pathname==='/studio/api/rea/cloud-scans'&&req.method==='POST'){
    if(!String(req.headers['content-type']||'').startsWith('application/json')){json(res,415,{error:'JSON required'});return true;}
    let bytes=0,body='';for await(const chunk of req){bytes+=chunk.length;if(bytes>512){json(res,413,{error:'Request too large'});return true;}body+=chunk;}
    let value;try{value=JSON.parse(body)}catch{json(res,400,{error:'Malformed JSON'});return true;}
    if(!value||Object.keys(value).length!==1||typeof value.slug!=='string'){json(res,400,{error:'Choose one authorized owner project'});return true;}
    try{const scan=audits.start(value.slug);json(res,202,{scan,coreTool:'analyze_javascript_application',scope:'bounded public preview; original private source not examined'});}
    catch(e){json(res,e.status||400,{error:String(e.message||e).slice(0,180)});}
    return true;
   }
   const id=pathname.match(/^\/studio\/api\/rea\/cloud-scans\/([a-f0-9-]{36})$/);
   if(id&&req.method==='GET'){const scan=audits.get(id[1]);json(res,scan?200:404,scan?{scan,retained:false}:{error:'Unknown REA scan'});return true;}
   json(res,503,{error:'Private source-library transfer or file intake is not configured on Render; use local import in Studio.'});return true;
  }
  if(req.method!=='GET'){json(res,405,{error:'Read-only Studio assets'});return true;}
  const rel=pathname==='/studio/'?'index.html':pathname.slice('/studio/'.length);
  if(!/^[a-zA-Z0-9_./-]+$/.test(rel)||rel.includes('..')){json(res,400,{error:'Invalid asset path'});return true;}
  const target=path.resolve(base,rel);
  if(!target.startsWith(base+path.sep)){json(res,403,{error:'Invalid path'});return true;}
  if(fs.existsSync(target)&&fs.statSync(target).isFile()){
   const ext=path.extname(target).toLowerCase();
   if(!mime[ext]){json(res,415,{error:'Unsupported asset'});return true;}
   res.writeHead(200,{'content-type':mime[ext], 'cache-control':rel==='index.html'?'no-store':'public, max-age=3600','x-content-type-options':'nosniff'});
   fs.createReadStream(target).pipe(res);return true;
  }
  // Existing publicly distributed image/atlas data is fetched from the unchanged owner preview.
  // Never proxy arbitrary URLs, private APIs, source maps or non-media files.
  if(!allowedMedia.test(pathname)){json(res,404,{error:'Not found'});return true;}
  try{
   const upstream=await fetcher('https://rea.pixellab.run/'+rel,{redirect:'error',headers:{accept:'image/*,application/json,font/*'},signal:AbortSignal.timeout(12000)});
   const ext=path.extname(rel).toLowerCase();const size=Number(upstream.headers.get('content-length')||0);
   if(!upstream.ok||size>2*1024*1024){json(res,502,{error:'Original public image unavailable'});return true;}
   const chunks=[];let count=0;for await(const chunk of Readable.fromWeb(upstream.body)){count+=chunk.length;if(count>2*1024*1024){json(res,413,{error:'Image exceeds proxy limit'});return true;}chunks.push(chunk);}
   res.writeHead(200,{'content-type':mime[ext]||'application/octet-stream','cache-control':'public, max-age=300','x-content-type-options':'nosniff'});res.end(Buffer.concat(chunks));
  }catch{json(res,502,{error:'Public asset retrieval unavailable'});}
  return true;
 };
}
