import {Node} from 'cc';
import {LIVE_UNLIT_MACROS,SETCAM_SHADOW_MACROS,TRANSITION_SHADER_WARM_ENABLED,shaderShowsSetcam,shaderShowsUnlitHot,withAssignMacros} from './TransitionShaderWarm';
/** One-shot setCamera / unlit compile for the balloon takeoff.
 *  PR #66 / b2b1146: TransitionShaderWarm's director_after_draw loop is the period-stutter ROOT HIT and stays default OFF.
 *  This prime never flips that flag and never registers director_after_draw. BalloonTransit steps it once per B1 frame, then stops. */
export type FlightPrimeKind='setcam'|'unlit';
type Job={pass:any;kind:FlightPrimeKind};
let jobs:Job[]=[];
let cursor=0;
export function compilePassOnce(pass:any,kind:FlightPrimeKind):boolean{
 if(!pass||TRANSITION_SHADER_WARM_ENABLED)return false;
 const bag=kind==='unlit'?LIVE_UNLIT_MACROS:SETCAM_SHADOW_MACROS;
 let ok=false;
 withAssignMacros(bag,()=>{
  try{
   if(typeof pass.tryCompile==='function')pass.tryCompile();
   if(typeof pass.getShaderVariant==='function'){
    const sh=pass.getShaderVariant(null);
    const name=String(sh&&(sh.name||(sh.shader&&(sh.shader.name||sh.shader._name)))||'');
    ok=kind==='unlit'?(shaderShowsUnlitHot(name)||name.length>0):(shaderShowsSetcam(name)||name.length>0);
   }else ok=true;
  }catch{ok=false;}
 });
 return ok;
}
function walk(node:any,out:Job[]):void{
 if(!node)return;
 const comps=node.components||node._components||[];
 for(let c=0;c<comps.length;c++){
  const r=comps[c];
  const mats=r&&r.sharedMaterials;
  if(!mats)continue;
  for(let s=0;s<mats.length;s++){
   const mat=mats[s];if(!mat||!mat.passes)continue;
   const effect=String(mat.effectName||(mat.effectAsset&&mat.effectAsset.name)||'');
   const unlit=effect.indexOf('unlit')>=0||effect.indexOf('planar')>=0;
   for(let p=0;p<mat.passes.length;p++){
    const pass=mat.passes[p];if(!pass)continue;
    out.push({pass,kind:unlit?'unlit':'setcam'});
   }
  }
 }
 const kids=node.children||[];
 for(let i=0;i<kids.length;i++)walk(kids[i],out);
}
/** Replace the queue with the passes under these roots. Idempotent. Does not draw and does not touch geometry. */
export function armFlightShaderPrime(roots:ReadonlyArray<Node|null>):number{
 jobs=[];cursor=0;
 for(let i=0;i<roots.length;i++)walk(roots[i],jobs);
 if(jobs.length>96)jobs.length=96;
 return jobs.length;
}
export function flightPrimePending():number{return Math.max(0,jobs.length-cursor);}
/** Compile at most one variant. Returns how many compiled this call (0 or 1). */
export function stepFlightShaderPrime():number{
 if(TRANSITION_SHADER_WARM_ENABLED)return 0;
 if(cursor>=jobs.length)return 0;
 const job=jobs[cursor++];
 try{compilePassOnce(job.pass,job.kind);}catch{/* miss stays off the flight frame */}
 return 1;
}
export function resetFlightShaderPrime():void{jobs=[];cursor=0;}
