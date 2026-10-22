import {Cancellation,type Action,type Vec} from '../world-r1/WorldFlowCore';
import type {CharacterAdapter} from '../world-r1/WorldFlowCore';
import {emitTransitCue} from './TransitAudioHooks';
import {transportFor,type TransportKind} from './JourneyTransport';
import {walkPair} from './RegionNodeProgress';
import {planWalk,type WalkPlan} from './NodeWalker';

export type WalkResult=Readonly<{transport:TransportKind|'walk';departure:boolean;segments:number;region:string;to:string;timedOut:boolean}>;
/** One segment must finish or be cut. A stuck `perform` must not freeze advanceMainline. */
export const WALK_SEGMENT_TIMEOUT_MS=12000;
export type PathPlace=(path:readonly Vec[])=>Vec[];
function heading(path:readonly Vec[]):number{
 const a=path.length>1?path[path.length-2]:path[0],b=path[path.length-1];
 return Math.atan2(b[0]-a[0],b[2]-a[2]);
}
/** Resolves even when `perform` never returns. The girl is stood at the segment end. */
export async function performBounded(character:Pick<CharacterAdapter,'perform'|'cancelAndReset'>,action:Action,end:Vec,yawRad:number,timeoutMs=WALK_SEGMENT_TIMEOUT_MS):Promise<'done'|'timeout'>{
 const token=new Cancellation();
 let mode:''|'done'|'timeout'='';
 let timer:ReturnType<typeof setTimeout>|undefined;
 const work=character.perform(action,token).then(()=>{if(!mode)mode='done';},()=>{if(!mode)mode='timeout';});
 const limit=new Promise<void>(resolve=>{timer=setTimeout(()=>{if(!mode)mode='timeout';try{token.cancel();}catch{/* already finished */}resolve();},timeoutMs);});
 await Promise.race([work,limit]);
 if(timer)clearTimeout(timer);
 if(mode!=='done'){
  try{token.cancel();}catch{/* ignore */}
  try{character.cancelAndReset({kind:'standing',controllerRoot:[end[0],end[1],end[2]],yawRad});}catch{/* caller still continues */}
  return 'timeout';
 }
 return 'done';
}
async function runPlan(character:Pick<CharacterAdapter,'perform'|'cancelAndReset'>,plan:WalkPlan,region:string,to:string,place?:PathPlace,timeoutMs=WALK_SEGMENT_TIMEOUT_MS):Promise<boolean>{
 let timedOut=false;
 emitTransitCue('node-walk-start',{t:0,region,node:to});
 for(let i=0;i<plan.segments.length;i++){
  const raw=plan.segments[i].path;
  const path=place?place(raw):raw.slice();
  const end=path[path.length-1];
  const yaw=heading(path);
  if(i>0)character.cancelAndReset({kind:'standing',controllerRoot:[path[0][0],path[0][1],path[0][2]],yawRad:yaw});
  const action:Action={kind:'walk',path,duration:plan.segments[i].duration};
  const status=await performBounded(character,action,end,yaw,timeoutMs);
  if(status==='timeout')timedOut=true;
 }
 emitTransitCue('node-arrive',{t:0,region,node:to});
 return timedOut;
}
/** Issue the clipped walk on the bound adapter. A stuck perform is cut to the segment end. */
export async function runRewardWalk(character:Pick<CharacterAdapter,'perform'|'cancelAndReset'>,fromStage:string,toStage:string,token?:Cancellation,place?:PathPlace,timeoutMs=WALK_SEGMENT_TIMEOUT_MS):Promise<WalkResult>{
 void token;
 await (character as any).__qfWalkTail?.done/* b15: a walk tail finishes first */;
 const spec=walkPair(fromStage,toStage);
 const plan=planWalk(spec.region,spec.from,spec.to);
 const timedOut=await runPlan(character,plan,spec.region,spec.to,place,timeoutMs);
 const transport:TransportKind|'walk'=spec.departure&&spec.nextRegion?transportFor(spec.region,spec.nextRegion):'walk';
 return {transport,departure:spec.departure,segments:plan.segments.length,region:spec.region,to:spec.to,timedOut};
}
/** After mainline-12 she leaves the stair top and walks north to the star-ring terrace. */
export async function runSkyFinale(character:Pick<CharacterAdapter,'perform'|'cancelAndReset'>,place?:PathPlace,timeoutMs=WALK_SEGMENT_TIMEOUT_MS):Promise<WalkResult>{
 const plan=planWalk('skycity','S4','S6');
 const timedOut=await runPlan(character,plan,'skycity','S6',place,timeoutMs);
 return {transport:'walk',departure:false,segments:plan.segments.length,region:'skycity',to:'S6',timedOut};
}
