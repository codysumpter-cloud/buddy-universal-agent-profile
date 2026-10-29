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
