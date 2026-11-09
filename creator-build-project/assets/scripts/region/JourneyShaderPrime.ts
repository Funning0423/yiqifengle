import {Node} from 'cc';
import {LIVE_UNLIT_MACROS,SETCAM_SHADOW_MACROS,TRANSITION_SHADER_WARM_ENABLED,withAssignMacros} from './TransitionShaderWarm';
/** Idle compile of the world.setCamera bag (the island→meadow residual was 94 shaders on that path).
 *  Same one-variant step the balloon takeoff used. Not TransitionShaderWarm's after_draw loop (#66 stays OFF). */
const CAP=120;
type Job={pass:any;unlit:boolean};
let jobs:Job[]=[];
let cursor=0;
let done=true;
let motionLeft=0;
function walk(node:any,out:Job[]):void{
 if(!node||out.length>=CAP)return;
 const comps=node.components||node._components||[];
 for(let c=0;c<comps.length&&out.length<CAP;c++){
  const mats=comps[c]&&comps[c].sharedMaterials;
  if(!mats)continue;
  for(let s=0;s<mats.length&&out.length<CAP;s++){
   const mat=mats[s];if(!mat||!mat.passes)continue;
   const effect=String(mat.effectName||'');
   const unlit=effect.indexOf('unlit')>=0||effect.indexOf('planar')>=0;
   for(let p=0;p<mat.passes.length&&out.length<CAP;p++)if(mat.passes[p])out.push({pass:mat.passes[p],unlit});
  }
 }
 const kids=node.children||[];
 for(let i=0;i<kids.length&&out.length<CAP;i++)walk(kids[i],out);
}
export function noteJourneyMotion(frames:number=8):void{
 if(frames<=0){motionLeft=0;return;}
 if(frames>motionLeft)motionLeft=frames|0;
}
export function beginJourneyShaderPrime(root:Node|null):void{
 try{(globalThis as any).__qfJourneyMotion=noteJourneyMotion;(globalThis as any).__qfJourneyPrime=beginJourneyShaderPrime;}catch{/* hook optional */}
 if(TRANSITION_SHADER_WARM_ENABLED){done=true;return;}
 jobs=[];cursor=0;done=false;motionLeft=0;
 walk(root,jobs);
 if(!jobs.length)done=true;
}
/** One compile on an idle frame. No-ops when the queue is empty or the lens is moving. */
export function stepJourneyPrime():number{
 if(done||TRANSITION_SHADER_WARM_ENABLED){done=true;return 0;}
 if(motionLeft>0){motionLeft--;return 0;}
 if(cursor>=jobs.length){done=true;jobs=[];return 0;}
 const job=jobs[cursor++];
 const bag=job.unlit?LIVE_UNLIT_MACROS:SETCAM_SHADOW_MACROS;
 withAssignMacros(bag,()=>{
  try{
   if(job.pass&&typeof job.pass.tryCompile==='function')job.pass.tryCompile();
   if(job.pass&&typeof job.pass.getShaderVariant==='function')job.pass.getShaderVariant(null);
  }catch{/* one miss does not retry forever */}
 });
 if(cursor>=jobs.length){done=true;jobs=[];}
 return 1;
}
export function journeyPrimePending():number{return done?0:Math.max(0,jobs.length-cursor);}
export function resetJourneyShaderPrime():void{jobs=[];cursor=0;done=true;motionLeft=0;}
