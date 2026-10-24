export function probeHermesCli(options?:{
  command?:string;cwd?:string;timeoutMs?:number;spawnImpl?:Function;
}):Promise<{installed:true;version:string;toolsetsVerified:false}>;
export function askHermesCli(options?:{
  prompt:string;systemContext?:string;command?:string;cwd?:string;timeoutMs?:number;spawnImpl?:Function;
}):Promise<{text:string;source:"hermes-cli"}>;
