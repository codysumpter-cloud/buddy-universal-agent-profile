/** A listening TCP socket is not proof of a functioning REA MCP core. */
export async function verifyCoreReadiness({verify,isStopped=()=>false,pause=ms=>new Promise(resolve=>setTimeout(resolve,ms)),retryDelayMs=2000,maxAttempts=45,onRetry=()=>{}}){
 if(typeof verify!=='function'||!Number.isInteger(maxAttempts)||maxAttempts<1)throw Error('Invalid REA readiness configuration');
 for(let attempt=1;attempt<=maxAttempts;attempt++){
  if(isStopped())throw Error('REA process stopped during readiness');
  try{
   const proof=await verify();
   if(proof?.initialized!==true||proof?.toolCallSucceeded!==true||proof?.called!=='inspect_analysis_settings')throw Error('REA MCP tool self-test was incomplete');
   if(isStopped())throw Error('REA process stopped during readiness');
   return proof;
  }catch(error){
   if(isStopped())throw Error('REA process stopped during readiness');
   if(attempt===maxAttempts)throw Error('REA failed MCP verification after '+maxAttempts+' attempts: '+String(error?.message||error).slice(0,120));
   onRetry(attempt,error);
   await pause(retryDelayMs);
  }
 }
 throw Error('REA readiness verification exhausted');
}

/** Delay the public TCP listener until the real REA MCP handshake is proven.
 * Render's default TCP health check must not mark an unverified core live. */
export async function openVerifiedGateway({gateway,proof,port,host='0.0.0.0',isStopped=()=>false}){
 const result=await proof;
 if(result?.initialized!==true||result?.toolCallSucceeded!==true||result?.called!=='inspect_analysis_settings')throw Error('REA proof missing before gateway bind');
 if(isStopped())throw Error('REA process exited before gateway bind');
 await new Promise((resolve,reject)=>{
  const fail=error=>{gateway.off('error',fail);reject(error);};
  gateway.once('error',fail);
  gateway.listen(port,host,()=>{gateway.off('error',fail);resolve();});
 });
 if(isStopped()){
  await new Promise(resolve=>gateway.close(resolve));
  throw Error('REA process exited during gateway bind');
 }
 return result;
}