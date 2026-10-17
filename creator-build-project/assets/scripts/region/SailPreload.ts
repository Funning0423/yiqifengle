import {Node} from 'cc';
import {REGIONS,loadRegionPrefab,mountRegion} from './RegionLoader';
import {noteSailPreloadFallback} from './JourneyTransport';
/** Meadow art warmed while mainline-04 is on screen. The rig stays inactive (0 DC) until the sail adopts it.
 * A 6 s timeout records a bridge fallback and does not block the board. */
const TIMEOUT_S=6;
let warm:Node|null=null;
let warming:Promise<void>|null=null;
export function sailWarmNode():Node|null{return warm;}
export function takeSailWarm():Node|null{const n=warm;warm=null;if(n?.parent)n.parent.removeChild(n);return n;}
export function resetSailWarm():void{warm=null;warming=null;}
export function preloadMeadowForSail(parent:Node):Promise<void>{
 if(warm||warming)return warming||Promise.resolve();
 const started=Date.now();
 warming=new Promise<void>((ok)=>{
  const timer=setTimeout(()=>{if(!warm)noteSailPreloadFallback('timeout-6s');ok();},TIMEOUT_S*1000);
  loadRegionPrefab(REGIONS.meadow).then(prefab=>{
   if(Date.now()-started>TIMEOUT_S*1000){noteSailPreloadFallback('timeout-6s');clearTimeout(timer);ok();return;}
   const rig=new Node('SailWarm-meadow');rig.active=false;parent.addChild(rig);
   const model=mountRegion(REGIONS.meadow,prefab,rig);model.active=true;warm=model;
   clearTimeout(timer);ok();
  },(error)=>{noteSailPreloadFallback(String(error&&error.message||error));clearTimeout(timer);ok();});
 });
 return warming;
}
export const SAIL_PRELOAD_TIMEOUT_S=TIMEOUT_S;
