import {assetManager} from 'cc';
import {PRELOAD_PLAN,logBundleLoad,type PreloadItem} from './TransitionChain';
import {REGIONS,loadRegionPrefab} from './RegionLoader';
import {loadBundlePrefab} from './TransportVehicle';
import {prewarmLakesideAssets} from './LakesideBoardBackground';
/** transitions-continuous preload: at the start of a region's last level, load the next region's bundle (+ its prefab for
 *  skycity, cached by the asset manager so BalloonTransit's prepare is a cache hit) and the vehicle bundle. Nothing is
 *  instantiated or drawn (meadow keeps SailPreload's inactive rig). Each bundle logs [QF_PRELOAD] size + ms (Mac memory panel:
 *  budget ≈ +6 MB). A failure only logs a warn: the transition loads on demand (and the 3 s fallback rule still applies). */
/** L12 board + skycity finale can outlast the 120 s default; held until the journey/board takes its own refs (or this passes). */
export const LAKESIDE_L12_HOLD_MS=600000;
const warmed=new Map<string,Promise<boolean>>();
const bundle=(name:string)=>new Promise<boolean>(ok=>{try{assetManager.loadBundle(name,(e:any)=>ok(!e));}catch{ok(false);}});
async function one(target:string,item:PreloadItem):Promise<boolean>{
 const t0=Date.now();let ok=await bundle(item.bundle);
 try{if(ok&&target==='skycity'&&item.bundle==='region_skycity')await loadRegionPrefab(REGIONS.skycity);
  if(ok&&item.prefab)ok=!!(await loadBundlePrefab(item.prefab,item.bundle));}catch{ok=false;}
 logBundleLoad(target,item,Date.now()-t0,ok);return ok;}
export function warmTransition(target:string):Promise<boolean>{
 const plan=PRELOAD_PLAN[target];if(!plan)return Promise.resolve(false);
 let p=warmed.get(target);if(p)return p;
 /* full6 fallback (Mac S3 WindWipe lakeside prepare-slow 3.05 s): the lakeside warm only loaded the bundle + balloon, so the tap paid
  * for transforms + ~48 LK glb prefabs inside the 3 s budget. The L12 start now also runs the lakeside asset prewarm (refs held 120 s). */
 if(target==='lakeside')void prewarmLakesideAssets(LAKESIDE_L12_HOLD_MS);
 p=Promise.all(plan.items.map(i=>one(target,i))).then(r=>r.every(Boolean),()=>false);
 p.then(ok=>{if(!ok){warmed.delete(target);try{console.warn('[QF_PRELOAD] '+target+' warm incomplete; loads on demand');}catch{}}});
 warmed.set(target,p);return p;}
