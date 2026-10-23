import { spawn } from "node:child_process";

/**
 * Direct Hermes CLI adapter for hosts without the HTTP API.
 * Uses stdin so prompts do not appear in process argv, never spawns a shell.
 * Real tools, approval policies, model selection, memory and skills remain Hermes-owned.
 */
function checkCliCommand(command) {
  if (typeof command !== "string" || !command.trim() || /[\x00-\x1f\x7f]/.test(command))
    throw new Error("Invalid Hermes executable path.");
  return command;
}

function invokeHermes({args, input = "",command = process.env.BUAP_HERMES_CLI_COMMAND || "hermes",
  cwd,timeoutMs = 120000,spawnImpl = spawn} = {}) {
  checkCliCommand(command);
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 300000)
    throw new Error("Hermes CLI timeout must be 1000–300000 ms.");
  if (typeof input !== "string" || input.length > 120000)
    throw new Error("Hermes CLI input is invalid or too large.");
  if (cwd !== undefined && (typeof cwd !== "string" || !cwd.trim()))
    throw new Error("Invalid Hermes working directory.");
  return new Promise((resolve,reject)=>{
    let child,done=false,stdout="",outputBytes=0,timer;
    const finish=(error,value)=>{
      if(done) return;
      done=true;clearTimeout(timer);
      if(error) reject(error); else resolve(value);
    };
    try {
      child=spawnImpl(command,args,{cwd,stdio:["pipe","pipe","pipe"],shell:false,windowsHide:true});
    } catch { finish(new Error("Unable to start Hermes CLI. Check installation and executable path.")); return; }
    child.stdout.on("data",chunk=>{
      outputBytes+=Buffer.byteLength(chunk);
      if(outputBytes>2*1024*1024){child.kill();finish(new Error("Hermes CLI output exceeded 2 MiB."));return;}
      stdout+=chunk.toString();
    });
    // stderr may contain private Hermes configuration; drain but never mirror it.
    child.stderr.on("data",()=>{});
    child.on("error",()=>finish(new Error("Hermes CLI was not found or could not start.")));
    child.on("close",code=>{
      if(code!==0) return finish(new Error("Hermes CLI turn failed (exit code "+String(code)+"). Check Hermes logs locally."));
      if(!stdout.trim())return finish(new Error("Hermes CLI returned an empty response."));
      finish(null,stdout.trim());
    });
    timer=setTimeout(()=>{child.kill();finish(new Error("Hermes CLI timed out. The gateway might still be processing the task; do not retry blindly."));},timeoutMs);
    child.stdin.on("error",()=>{}); // process may exit before finishing input
    child.stdin.end(input);
  });
}

/** Read-only proof that the Hermes CLI is installed; not proof of configured model/tools. */
export async function probeHermesCli(options={}) {
  const version=await invokeHermes({...options,args:["--version"]});
  return {installed:true,version:version.slice(0,128),toolsetsVerified:false};
}

/** Delegate one Hermes turn with no shell and prompt passed on stdin. */
export async function askHermesCli({prompt,systemContext="",...options}={}) {
  if(typeof prompt!=="string"||!prompt.trim()||prompt.length>100000)throw new Error("Hermes CLI prompt must be nonempty and at most 100000 characters.");
  if(typeof systemContext!=="string"||systemContext.length>16000)throw new Error("Hermes CLI BUAP context exceeds 16000 characters.");
  const query=systemContext ? "BUAP agent identity/context (follow host safety policy):\n"+systemContext+"\n\nUser request:\n"+prompt : prompt;
  const text=await invokeHermes({...options,args:["chat","--oneshot","--query-file","-","--quiet"],input:query});
  return {text,source:"hermes-cli"};
}
