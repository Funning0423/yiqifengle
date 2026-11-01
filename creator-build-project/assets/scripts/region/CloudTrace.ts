/** fix-cloud-sit (GGbot): test-only trace of env_cloud_layer world position (?cloudTrace=1 with QA hooks, or
 *  globalThis.__QF_CLOUD_TRACE_ON=true). Off: one boolean check, no allocation. On: every frame records the position after all
 *  writers (EVENT_BEFORE_DRAW) and warns once per jump > CLOUD_JUMP_M, so a Mac recording can be checked against
 *  globalThis.__QF_CLOUD_TRACE {frames, jumps}. Never console.error (Console Error stays 0). No 'cc' import. */
import {qaQuery, qaSkipAllowed} from '../world-r2/QaSkip';
export const CLOUD_JUMP_M=5;
/** Query read once per host (develop/trial/web only; WeChat release never). */
export function cloudTraceOn(host:any=globalThis):boolean{
 try{if(host?.__QF_CLOUD_TRACE_ON===true)return true;
  if(host.__QF_CLOUD_TRACE_Q===undefined)host.__QF_CLOUD_TRACE_Q=qaSkipAllowed(host)&&/(?:^|[?&])cloudTrace=1(?:&|$)/.test(qaQuery(host)||'');
  return host.__QF_CLOUD_TRACE_Q===true;}catch{return false;}
}
export function traceCloudLayer(x:number,y:number,z:number,writer:string,host:any=globalThis):void{
 if(!cloudTraceOn(host))return;
 const t=host.__QF_CLOUD_TRACE||(host.__QF_CLOUD_TRACE={frames:0,jumps:[] as any[],last:null as number[]|null});
 t.frames++;const l=t.last;
 if(l){const d=Math.hypot(x-l[0],y-l[1],z-l[2]);if(d>CLOUD_JUMP_M){if(t.jumps.length<200)t.jumps.push({frame:t.frames,d,writer,from:l.slice(),to:[x,y,z]});console.warn('[QF_CLOUD_TRACE] env_cloud_layer jump '+d.toFixed(1)+' m frame '+t.frames+' ('+writer+')');}}
 t.last=[x,y,z];
}
