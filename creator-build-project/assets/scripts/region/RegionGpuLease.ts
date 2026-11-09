import {MeshRenderer,assetManager,director} from 'cc';
/** Refcounted GPU release for region bundles. Leaving a region drops its ref; at 0, assets with no other
 *  owner are released and their GPU textures destroyed. The next loadRegionPrefab / loadBundle reloads them,
 *  so a return does not show a missing texture. region_skycity stays while the board holds a ref. */
const holds=new Map<string,number>();
const dirtyBundles=new Set<string>();
const TEX_PROPS=['mainTexture','normalMap','emissiveMap','occlusionMap','pbrMap','specularMap','albedoMap'];
function gfxTexture(asset:any):any{
 if(!asset)return null;
 try{if(typeof asset.getGFXTexture==='function'){const g=asset.getGFXTexture();if(g)return g;}}catch{/* */}
 return asset._gfxTexture||asset._texture||null;
}
/** QF_GPU `des` counts the destroy wrapped around device.createTexture. releaseAsset drops the
 *  asset-manager entry (regions.total) and leaves that GPU texture alive. */
function destroyTextureAsset(tex:any):number{
 const gfxTex=gfxTexture(tex);
 if(gfxTex&&typeof gfxTex.destroy==='function'){try{gfxTex.destroy();}catch{/* already */}}
 else if(tex&&typeof tex.destroy==='function'){try{tex.destroy();}catch{/* already */}}
 try{if(typeof tex.decRef==='function'&&Number(tex.refCount)>0)tex.decRef(false);}catch{/* */}
 try{assetManager.releaseAsset?.(tex);}catch{/* */}
 return gfxTex?1:0;
}
function texturesOf(node:any,into:Set<any>):void{
 if(!node||typeof node.getComponentsInChildren!=='function')return;
 let rs:any[]=[];try{rs=node.getComponentsInChildren(MeshRenderer);}catch{rs=[];}
 for(let i=0;i<rs.length;i++){
  const mats=rs[i]&&rs[i].sharedMaterials||[];
  for(let m=0;m<mats.length;m++){
   const mat=mats[m];if(!mat||typeof mat.getProperty!=='function')continue;
   for(let k=0;k<TEX_PROPS.length;k++){let v:any=null;try{v=mat.getProperty(TEX_PROPS[k]);}catch{v=null;}if(v&&gfxTexture(v))into.add(v);}
  }
 }
}
function isUnder(node:any,root:any):boolean{for(let n=node;n;n=n.parent)if(n===root)return true;return false;}
/** Destroy GPU textures used only by this subtree. Textures still sampled elsewhere are kept (no magenta). */
export function releaseSubtreeGpu(root:any):number{
 if(!root)return 0;
 const mine=new Set<any>();texturesOf(root,mine);
 const scene=root.scene||(director.getScene&&director.getScene());
 if(scene){
  let rs:any[]=[];try{rs=scene.getComponentsInChildren(MeshRenderer);}catch{rs=[];}
  for(let i=0;i<rs.length;i++){
   if(isUnder(rs[i].node,root))continue;
   const keep=new Set<any>();texturesOf(rs[i].node,keep);
   keep.forEach(t=>{mine.delete(t);});
  }
 }
 let n=0;const bundles=REGION_GPU_SWEEP;
 mine.forEach(tex=>{
  n+=destroyTextureAsset(tex);
  try{
   const uuid=String(tex&&(tex._uuid||tex.uuid)||'');
   const am:any=assetManager;
   if(uuid&&am&&typeof am.getBundle==='function'){
    for(let i=0;i<bundles.length;i++){const b=am.getBundle(bundles[i]);if(b&&b.getAssetInfo&&b.getAssetInfo(uuid))dirtyBundles.add(bundles[i]);}
   }
  }catch{/* bundle lookup optional */}
 });
 return n;
}
/** Next load of a bundle whose textures were destroyed must not reuse the dead asset. */
export function prepareRegionBundle(name:string):Promise<void>{
 if(!dirtyBundles.has(name))return Promise.resolve();
 dirtyBundles.delete(name);
 const am:any=assetManager;
 const bundle=am&&typeof am.getBundle==='function'?am.getBundle(name):null;
 try{if(bundle&&typeof bundle.releaseAll==='function')bundle.releaseAll();}catch{/* */}
 try{if(bundle&&typeof am.removeBundle==='function')am.removeBundle(bundle);}catch{/* */}
 return Promise.resolve();
}
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
   try{if(gfxTexture(asset))destroyed+=destroyTextureAsset(asset);}catch{/* texture optional */}
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
