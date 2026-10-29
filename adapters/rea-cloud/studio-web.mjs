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
export function createStudioHandler({token,studioProxyToken,root,isCoreReady=()=>false,proof=()=>null,audits,uploads,capabilities=null,fetcher=fetch}){
 if(typeof token!=='string'||token.length<32)throw Error('Studio requires existing owner gateway secret');
 const base=path.resolve(root);
 return async(req,res)=>{
  const pathname=safePortion(req);
  if(pathname==='/studio'&&req.method==='GET'){
   const q=new URL(req.url||'/studio','https://render.internal').search;
   res.writeHead(302,{location:'/studio/'+q,'cache-control':'no-store'});res.end();return true;
  }
  if(!pathname.startsWith('/studio/'))return false;
  if(req.method!=='GET'&&req.method!=='POST'&&req.method!=='DELETE'){json(res,405,{error:'Unsupported request method'});return true;}
  if(pathname==='/studio/api/rea/setup'&&req.method==='GET'){
   json(res,200,{ownerAccessConfigured:true,cloudBridgeConfigured:isCoreReady(),privateContentProtected:true,needsOperatorSetup:!isCoreReady(),backend:'Render REA 6.8.0'});return true;
  }
  if(pathname.startsWith('/studio/api/rea/')){
   if(!bearer(req.headers.authorization,token)&&!bearer(req.headers.authorization,studioProxyToken)){json(res,401,{error:'Owner authentication required'});return true;}
   if(!isCoreReady()){json(res,503,{error:'REA Core starting'});return true;}
   if(pathname==='/studio/api/rea/health'&&req.method==='GET'){
    const result=proof();
    json(res,200,result?.passed?{status:'core-verified',coreVerified:true,tool:result.tool||'inspect_analysis_settings',message:'Render core executed read-only REA tool successfully'}:{status:'checking',coreVerified:false,message:'REA core is ready; independent tool verification pending'});
    return true;
   }
   // Owner-only native Studio access to the complete pinned REA tool catalogue.
   // Discovery is not evidence that a particular platform or debugger exists.
   if(pathname==='/studio/api/rea/capabilities'&&req.method==='GET'){
    json(res,capabilities?200:503,capabilities?capabilities.overview():{error:'REA full catalogue unavailable'});return true;
   }
   const capabilityPath=pathname.match(/^\/studio\/api\/rea\/capabilities\/([a-z][a-z0-9_]{1,110})$/);
   if(capabilityPath&&req.method==='GET'){
    if(!capabilities){json(res,503,{error:'REA capabilities unavailable'});return true;}
    try{json(res,200,capabilities.detail(capabilityPath[1]));}catch(e){json(res,e.status||400,{error:String(e.message).slice(0,180)});}return true;
   }
   if((pathname==='/studio/api/rea/capabilities/prepare'||pathname==='/studio/api/rea/capabilities/invoke')&&req.method==='POST'){
    if(!capabilities){json(res,503,{error:'REA capabilities unavailable'});return true;}
    if(!String(req.headers['content-type']||'').startsWith('application/json')){json(res,415,{error:'JSON required'});return true;}
    const size=Number(req.headers['content-length']||0);
    if(size>20*1024){json(res,413,{error:'REA operation exceeds 20 KiB'});return true;}
    let bytes=0,body='';
    for await(const chunk of req){bytes+=chunk.length;if(bytes>20*1024){json(res,413,{error:'REA operation exceeds 20 KiB'});return true;}body+=chunk;}
    let input;try{input=JSON.parse(body);}catch{json(res,400,{error:'Malformed JSON'});return true;}
    if(!input||typeof input!=='object'||Array.isArray(input)){json(res,400,{error:'Invalid operation'});return true;}
    try{
     if(pathname.endsWith('/prepare')){
      if(Object.keys(input).some(k=>!['name','arguments'].includes(k))){json(res,400,{error:'Unexpected REA operation fields'});return true;}
      json(res,200,capabilities.prepare(input.name,input.arguments||{}));
     }else{
      if(Object.keys(input).some(k=>!['ticket','approved'].includes(k))){json(res,400,{error:'Unexpected approval fields'});return true;}
      const output=await capabilities.invoke(input.ticket,input.approved);
      json(res,200,output);
     }
    }catch(e){json(res,e.status||400,{error:String(e.message||e).slice(0,200)});}return true;
   }
   if(pathname==='/studio/api/rea/jobs'&&req.method==='GET'){json(res,200,{status:'configured-unverified',coreVerified:false,jobs:uploads?.list()||[]});return true;}
   if(pathname==='/studio/api/rea/jobs'&&req.method==='POST'){
    if(!uploads){json(res,503,{error:'REA upload service unavailable'});return true;}
    const type=String(req.headers['content-type']||'');
    if(!type.startsWith('multipart/form-data;')){json(res,415,{error:'Multipart file required'});return true;}
    let total=0;const parts=[];
    try{for await(const chunk of req){total+=chunk.length;if(total>1150*1024){json(res,413,{error:'Upload exceeds 1150 KiB envelope'});return true;}parts.push(chunk);}}
    catch{jso
…(truncated — 12212 chars total; log/return less)