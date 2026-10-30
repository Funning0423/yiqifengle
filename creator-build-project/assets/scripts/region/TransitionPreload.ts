import {Director,EffectAsset,JsonAsset,assetManager,director,type Node} from 'cc';
import {meadowSplitLoad,preloadMeadowForSail} from './SailPreload';
import {MEADOW_LEG_STAGES,PRELOAD_PLAN,SKY_LEG_STAGES,SKY_WARM_GAP_MS,logBundleLoad,type PreloadItem} from './TransitionChain';
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

/* full9c WindWipe: staged skycity-leg warm, armed by a journey that will continue past the meadow and started when the
 * island→meadow sail ride begins (after the sail prepare, so it never competes with it). Sequential, one load per stage
 * with SKY_WARM_GAP_MS between, so the sail keeps its frame rate. */
let skyArmed=false;let skyStaged:Promise<boolean>|null=null;
export function armSkycityWarmOnSailRide():void{skyArmed=true;}
export function sailRideStarted():void{if(!skyArmed)return;skyArmed=false;void warmSkycityLegStaged();}
function bundleAsset(bundleName:string,name:string,type:any):Promise<boolean>{
 return new Promise(ok=>assetManager.loadBundle(bundleName,(err,b)=>{if(err||!b||typeof (b as any).load!=='function'){ok(false);return;}b.load(name,type,(e:any,a:any)=>ok(!e&&!!a));}));
}
export function warmSkycityLegStaged(gap=SKY_WARM_GAP_MS):Promise<boolean>{
 if(skyStaged)return skyStaged;
 const wait=()=>new Promise<void>(r=>setTimeout(r,gap));
 const run:Record<string,()=>Promise<unknown>>={
  'bundle:region_skycity':()=>new Promise<void>((ok,fail)=>assetManager.loadBundle('region_skycity',e=>e?fail(e):ok())),
  'prefab:env_skycity+siblings':()=>loadRegionPrefab(REGIONS.skycity),
  'prefab:transport_balloon':()=>loadBundlePrefab('transport_balloon','region_transit_balloon'),
  'prefab:transit_clouds_merged':()=>loadBundlePrefab('transit_clouds_merged','region_transit_balloon'),
  'prefab:transit_night_dome':()=>loadBundlePrefab('transit_night_dome','region_transit_balloon'),
  'prefab:far_meadow_card':()=>loadBundlePrefab('far_meadow_card','region_transit_balloon'),
  'json:balloon_flightpath':()=>bundleAsset('region_transit_balloon','balloon_flightpath',JsonAsset),
  'effect:balloon-grade':()=>bundleAsset('region_transit_balloon','balloon-grade',EffectAsset),
 };
 skyStaged=(async()=>{
  let all=true;
  for(const st of SKY_LEG_STAGES){
   const t0=Date.now();let ok=true;try{await run[st.id]();}catch{ok=false;}all=all&&ok;
   try{console.info('[QF_PRELOAD_STAGE] '+JSON.stringify({target:'skycity',stage:st.id,ms:Date.now()-t0,budgetMs:st.ms,ok}));}catch{}
   await wait();
  }
  return all;
 })();
 return skyStaged;
}

/* P0 wipe: staged island→meadow warm (see MEADOW_LEG_STAGES). Each stage logs ms and the longest frame seen while it ran
 * (frameMaxMs) so the Mac run shows the island frame cost. Cached: repeated calls are free; a failed stage only logs. */
let meadowStaged:Promise<boolean>|null=null;
export function warmMeadowLegStaged(parent:Node,stable:()=>boolean|'gone',gap=SKY_WARM_GAP_MS):Promise<boolean>{
 if(meadowStaged)return meadowStaged;
 const wait=(ms:number)=>new Promise<void>(r=>setTimeout(r,ms));
 const run:Record<string,()=>Promise<unknown>>={
  'bundle:region_meadow':()=>bundle('region_meadow').then(ok=>{if(!ok)throw Error('bundle');}),
  'bundle:transport_sail':()=>bundle('transport_sail').then(ok=>{if(!ok)throw Error('bundle');}),
  'split:env_meadow':()=>meadowSplitLoad(stable),
  'prefab:env_meadow':()=>loadRegionPrefab(REGIONS.meadow),
  'mount:meadow-warm-rig':async()=>{let s;while((s=stable())===false)await wait(gap);if(s==='gone')throw Error('left-island');await preloadMeadowForSail(parent);},/* 'gone': she left the island side; the sail prepare mounts */
 };
 meadowStaged=(async()=>{let all=true;
  for(const st of MEADOW_LEG_STAGES){
   /*QF_PROBE_BEGIN*/let last=Date.now(),max=0;const tick=()=>{const n=Date.now();max=Math.max(max,n-last);last=n;};try{director.on(Director.EVENT_AFTER_DRAW,tick);}catch{}const t0=Date.now();/*QF_PROBE_END*/
   let ok=true;try{await run[st.id]();}catch{ok=false;}all=all&&ok;
   /*QF_PROBE_BEGIN*/try{director.off(Director.EVENT_AFTER_DRAW,tick);}catch{}try{console.info('[QF_PRELOAD_STAGE] '+JSON.stringify({target:'meadow',stage:st.id,ms:Date.now()-t0,budgetMs:st.ms,frameMaxMs:max,ok}));}catch{}/*QF_PROBE_END*/
   await wait(gap);}
  if(!all)meadowStaged=null;return all;})();
 return meadowStaged;
}
