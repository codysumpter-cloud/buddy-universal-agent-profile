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
export function createStudioHandler({token,studioProxyToken,root,isCoreReady=()=>false,proof=()=>null,audits,uploads,fetcher=fetch}){
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
   if(pathname==='/studio/api/rea/jobs'&&req.method==='GET'){json(res,200,{status:'configured-unverified',coreVerified:false,jobs:uploads?.list()||[]});return true;}
   if(pathname==='/studio/api/rea/jobs'&&req.method==='POST'){
    if(!uploads){json(res,503,{error:'REA upload service unavailable'});return true;}
    const type=String(req.headers['content-type']||'');
    if(!type.startsWith('multipart/form-data;')){json(res,415,{error:'Multipart file required'});return true;}
    let total=0;const parts=[];
    try{for await(const chunk of req){total+=chunk.length;if(total>1150*1024){json(res,413,{error:'Upload exceeds 1150 KiB envelope'});return true;}parts.push(chunk);}}
    catch{json(res,400,{error:'Invalid upload stream'});return true;}
    let form;
    try{form=await new Request('http://localhost/rea-upload',{method:'POST',headers:{'content-type':type},body:Buffer.concat(parts)}).formData();}
    catch{json(res,400,{error:'Malformed multipart upload'});return true;}
    if([...form.keys()].some(k=>!['file','owner','basis','attest','paths'].includes(k))||
       form.getAll('owner').length!==1||form.getAll('basis').length!==1||
       form.getAll('attest').length!==1||form.getAll('paths').length>1){
      json(res,400,{error:'Unexpected or duplicate upload fields'});return true;
    }
    const files=form.getAll('file'),owner=form.get('owner'),basis=form.get('basis'),attest=form.get('attest');
    if(!files.length||files.length>24||files.some(file=>typeof file==='string'||typeof file.arrayBuffer!=='function')||
       typeof owner!=='string'||typeof basis!=='string'||attest!=='true'){
      json(res,400,{error:'1–24 source files, owner, basis and attestation required'});return true;
    }
    if(files.some(file=>file.size<1||file.size>256*1024)||
       files.reduce((sum,file)=>sum+file.size,0)>1024*1024){json(res,413,{error:'Source batch exceeds size limits'});return true;}
    let paths;
    if(form.has('paths')){
     try{paths=JSON.parse(form.get('paths'))}catch{json(res,400,{error:'Malformed relative paths JSON'});return true;}
     if(!Array.isArray(paths)||paths.length!==files.length||paths.some(p=>typeof p!=='string')){
      json(res,400,{error:'Source path manifest does not match selected files'});return true;
     }
    }else paths=files.map(file=>file.name);
    try{
     const input=files.length===1&&!form.has('paths')?
      {name:files[0].name,content:Buffer.from(await files[0].arrayBuffer()),owner,basis,attested:true}:
      {files:await Promise.all(files.map(async(file,i)=>({path:paths[i],content:Buffer.from(await file.arrayBuffer())}))),owner,basis,attested:true};
     const job=uploads.start(input);
     json(res,202,{job,status:'configured-unverified',coreVerified:false,scope:'Sequential, evidence-backed per-source REA analysis; incomplete files stay explicit.'});
    }catch(e){json(res,e.status||400,{error:String(e.message||e).slice(0,180)});}
    return true;
   }
   const uploadId=pathname.match(/
…(truncated — 9928 chars total; log/return less)