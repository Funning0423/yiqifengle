import {Director,Mesh,Node,Texture2D,assetManager,director} from 'cc';
import {splitNextBatch} from './TransitionChain';
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
   await meadowSplitLoad();const prefab=await loadRegionPrefab(REGIONS.meadow);
   if(warm)return warm;
   const rig=new Node('SailWarm-meadow');rig.active=false;parent.addChild(rig);
   const model=mountRegion(REGIONS.meadow,prefab,rig);model.active=true;warm=model;return model;
  },
 }).then(()=>{},(error)=>{if(warming===job)warming=null;try{console.warn('[QF_SAIL] '+JSON.stringify({event:'preload-retry-exhausted',transport:'sail',reason:String((error as Error)?.message||error)}));}catch{/* ignore */}});
 warming=job;
 return job;
}

/* P0 wipe r2: meadow sub-assets (meshes, textures under env_meadow/) one batch per frame before the prefab load, so the prefab
 * load finds them cached. Work per batch = wall ms of the synchronous completion (onLoaded→initialize runs inside it). */
let split:Promise<void>|null=null;
export function meadowSplitLoad():Promise<void>{
 if(split)return split;
 split=(async()=>{
  const b:any=await new Promise(ok=>{try{assetManager.loadBundle(REGIONS.meadow.bundle,(e:any,x:any)=>ok(e?null:x));}catch{ok(null);}});
  if(!b||typeof b.getDirWithPath!=='function')return;
  const infos:any[]=[...b.getDirWithPath('env_meadow',Mesh),...b.getDirWithPath('env_meadow',Texture2D)];
  const frame=()=>new Promise<void>(r=>{try{director.once(Director.EVENT_AFTER_DRAW,()=>r());}catch{setTimeout(r,16);}});
  /*QF_PROBE_BEGIN*/const pr={n:infos.length,frames:0,maxFrameWorkMs:0,maxItem:'',maxItemMs:0,over:[] as string[]};/*QF_PROBE_END*/
  let k=1,i=0,last=Date.now(),prev=last;const onDraw=()=>{prev=last;last=Date.now();};try{director.on(Director.EVENT_AFTER_DRAW,onDraw);}catch{}
  while(i<infos.length){
   const batch=infos.slice(i,i+k);i+=batch.length;let work=0;
   await Promise.all(batch.map(inf=>new Promise<void>(r=>{try{b.load(inf.path,inf.ctor,()=>{r();});}catch{r();}}).then(()=>{})));
   // frame work = length of the frame that ran the completion (onLoaded→initialize) minus a 60 fps frame
   await frame();work=Math.max(0,last-prev-17);
   /*QF_PROBE_BEGIN*/pr.frames++;if(work>pr.maxFrameWorkMs)pr.maxFrameWorkMs=work;if(batch.length===1&&work>pr.maxItemMs){pr.maxItemMs=work;pr.maxItem=batch[0].path;}if(batch.length===1&&work>4)pr.over.push(batch[0].path+':'+work);/*QF_PROBE_END*/
   k=splitNextBatch(k,work);
  }
  try{director.off(Director.EVENT_AFTER_DRAW,onDraw);}catch{}
  /*QF_PROBE_BEGIN*/try{console.info('[QF_MEADOW_SPLIT] '+JSON.stringify(pr));}catch{}/*QF_PROBE_END*/
 })().catch(()=>{});
 return split;
}
