export type HermesConfig = {
  baseUrl:string;apiKey:string;model:string;remoteEnabled:boolean;allowedHosts:string[];
};
export type HermesFeature = {id:string;status:string;requires:string};
export const HERMES_FEATURES: ReadonlyArray<HermesFeature>;
export function hermesConfig(env?:NodeJS.ProcessEnv): HermesConfig;
export function validateHermesConfig(config:HermesConfig,options?:{requireKey?:boolean}): string;
export function probeHermes(config?:HermesConfig, options?:{
  fetchImpl?:typeof fetch;timeoutMs?:number
}):Promise<{reachable:true;models:string[];toolsetsVerified:false}>;
export function askHermes(args?:{
  prompt:string;systemContext?:string;history?:Array<{role:"user"|"assistant";content:string}>;config?:HermesConfig;fetchImpl?:typeof fetch;timeoutMs?:number;
}):Promise<{text:string;model:string;usage:unknown;completionId:string|null}>;
export function hermesStatus(env?:NodeJS.ProcessEnv):{
  configured:boolean;endpointValid:boolean;keyPresent:boolean;model:string;baseUrl:string|null;
  issue:string|null;apiReachable:string;toolsetsVerified:boolean;capabilities:ReadonlyArray<HermesFeature>;
};
