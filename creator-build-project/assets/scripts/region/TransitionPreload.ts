import {assetManager} from 'cc';
import {PRELOAD_PLAN,logBundleLoad,type PreloadItem} from './TransitionChain';
import {REGIONS,loadRegionPrefab} from './RegionLoader';
import {loadBundlePrefab} from './TransportVehicle';
/** transitions-continuous preload: at the start of a region's last level, load the next region's bundle (+ its prefab for
 *  skycity, cached by the asset manager so BalloonTransit's prepare is a cache hit) and the vehicle bundle. Nothing is
 *  instantiated or drawn (meadow keeps SailPreload's inactive rig). Each bundle logs [QF_PRELOAD] size + ms (Mac memory panel:
 *  budget ≈ +6 MB). A failure only logs a warn: the transition loads on demand (and the 3 s fallback rule still applies). */
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
 p=Promise.all(plan.items.map(i=>one(target,i))).then(r=>r.every(Boolean),()=>false);
 p.then(ok=>{if(!ok){warmed.delete(target);try{console.warn('[QF_PRELOAD] '+target+' warm incomplete; loads on demand');}catch{}}});
 warmed.set(target,p);return p;}
