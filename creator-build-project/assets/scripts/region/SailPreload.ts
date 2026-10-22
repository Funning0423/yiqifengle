import {Node} from 'cc';
import {REGIONS,loadRegionPrefab,mountRegion} from './RegionLoader';
import {awaitVehicle} from './TransportWait';
/** Meadow art warmed while mainline-04 is on screen. The rig stays inactive (0 DC) until the sail adopts it.
 * A slow or failed load retries on the sail. */
let warm:Node|null=null;
let warming:Promise<void>|null=null;
export function sailWarmNode():Node|null{return warm;}
export function takeSailWarm():Node|null{const n=warm;warm=null;if(n?.parent)n.parent.removeChild(n);return n;}
export function resetSailWarm():void{warm=null;warming=null;}
export function preloadMeadowForSail(parent:Node):Promise<void>{
 if(warm)return Promise.resolve();
 if(warming)return warming;
 const job=awaitVehicle({
  kind:'sail',
  load:async()=>{
   const prefab=await loadRegionPrefab(REGIONS.meadow);
   if(warm)return warm;
   const rig=new Node('SailWarm-meadow');rig.active=false;parent.addChild(rig);
   const model=mountRegion(REGIONS.meadow,prefab,rig);model.active=true;warm=model;return model;
  },
 }).then(()=>{},(error)=>{if(warming===job)warming=null;try{console.warn('[QF_SAIL] '+JSON.stringify({event:'preload-retry-exhausted',transport:'sail',reason:String((error as Error)?.message||error)}));}catch{/* ignore */}});
 warming=job;
 return job;
}
