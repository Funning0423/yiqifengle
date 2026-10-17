import type {Action,Cancellation,CharacterAdapter} from '../world-r1/WorldFlowCore';
import {emitTransitCue} from './TransitAudioHooks';
import {transportFor,type TransportKind} from './JourneyTransport';
import {walkPair} from './RegionNodeProgress';
import {planWalk} from './NodeWalker';

export type WalkResult=Readonly<{transport:TransportKind;departure:boolean;segments:number;region:string;to:string}>;
/** Issue the clipped walk on the bound adapter. A busy adapter rejects; the caller keeps the old route. */
export async function runRewardWalk(character:Pick<CharacterAdapter,'perform'|'cancelAndReset'>,fromStage:string,toStage:string,token?:Cancellation):Promise<WalkResult>{
 const spec=walkPair(fromStage,toStage);
 const plan=planWalk(spec.region,spec.from,spec.to);
 const cancel=token||({cancelled:false,check(){}} as Cancellation);
 emitTransitCue('node-walk-start',{t:0,region:spec.region,node:spec.to});
 for(let i=0;i<plan.segments.length;i++){
  const seg=plan.segments[i];
  if(plan.cut&&i>0){const p=seg.path[0];character.cancelAndReset({kind:'standing',controllerRoot:[p[0],p[1],p[2]],yawRad:0});}
  const action:Action={kind:'walk',path:seg.path,duration:seg.duration};
  await character.perform(action,cancel);
 }
 emitTransitCue('node-arrive',{t:0,region:spec.region,node:spec.to});
 const transport:TransportKind=spec.departure&&spec.nextRegion?transportFor(spec.region,spec.nextRegion):'bridge';
 return {transport,departure:spec.departure,segments:plan.segments.length,region:spec.region,to:spec.to};
}
