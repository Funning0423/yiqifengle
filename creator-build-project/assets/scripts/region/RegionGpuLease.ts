import {assetManager} from 'cc';
/** Refcounted GPU release for region bundles. Leaving a region drops its ref; at 0, assets with no other
 *  owner are released and their GPU textures destroyed. The next loadRegionPrefab / loadBundle reloads them,
 *  so a return does not show a missing texture. region_skycity stays while the board holds a ref. */
const holds=new Map<string,number>();
export function holdRegionGpu(bundle:string):void{holds.set(bundle,(holds.get(bundle)||0)+1);}
export function dropRegionGpu(bundle:string):void{const n=(holds.get(bundle)||0)-1;if(n>0)holds.set(bundle,n);else holds.delete(bundle);}
export function regionGpuHolds():Record<string,number>{const out:Record<string,number>={};holds.forEach((v,k)=>{out[k]=v;});return out;}
export function sweepUnreferenced(bundles:readonly string[]):{released:number;destroyed:number;skipped:number}{
 let released=0,destroyed=0,skipped=0;
 const am:any=assetManager;
 if(!am||typeof am.getBundle!=='function')return {released,destroyed,skipped};
 for(let i=0;i<bundles.length;i++){
  const name=bundles[i];
  if((holds.get(name)||0)>0){skipped++;continue;}
  const bundle=am.getBundle(name);
  if(!bundle)continue;
  const drop:any[]=[];
  try{am.assets.forEach((asset:any,uuid:string)=>{try{if(bundle.getAssetInfo&&bundle.getAssetInfo(uuid))drop.push(asset);}catch{/* skip */}});}catch{/* no asset map */}
  let kept=false;
  for(let a=0;a<drop.length;a++){
   const asset=drop[a];
   const rc=Number(asset&&asset.refCount||0);
   if(rc>1){kept=true;skipped++;continue;}
   try{
    const tex=asset&&(asset._texture||(typeof asset.getGFXTexture==='function'?asset.getGFXTexture():null));
    if(tex&&typeof tex.destroy==='function'){tex.destroy();destroyed++;}
   }catch{/* texture optional */}
   try{if(typeof am.releaseAsset==='function'){am.releaseAsset(asset);released++;}}catch{/* already gone */}
  }
  if(!kept){try{if(typeof am.removeBundle==='function')am.removeBundle(bundle);}catch{/* bundle optional */}}
 }
 return {released,destroyed,skipped};
}
/** Reload a bundle that sweep removed. loadRegionPrefab already calls loadBundle; this is the explicit return path. */
export function ensureRegionBundle(name:string):Promise<boolean>{
 return new Promise(ok=>{
  try{
   const am:any=assetManager;
   if(!am||typeof am.loadBundle!=='function'){ok(false);return;}
   if(typeof am.getBundle==='function'&&am.getBundle(name)){ok(true);return;}
   am.loadBundle(name,(err:any,bundle:any)=>ok(!err&&!!bundle));
  }catch{ok(false);}
 });
}
export const REGION_GPU_SWEEP:readonly string[]=['region_meadow','transport_sail','region_transit_balloon','region_island'];
