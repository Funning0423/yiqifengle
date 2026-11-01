import {assetManager,AssetManager,Prefab,Node,instantiate,isValid,MeshRenderer,Material} from 'cc';
import {setMooringRopes} from './SkyMooringRopes';
import {RegionAmbientAnimation} from './RegionAmbientAnimation';
import {SkycityPennantWind} from './SkycityPennantWind';
import {SkycityRobotInteract} from './SkycityRobotInteract';
import {SkycityCloudsea} from './SkycityCloudsea';
/**
 * One entry point for region art: every region model lives in its own Asset Bundle
 * (subpackage or remote on COS) and is loaded at runtime, never referenced by a scene.
 */
export interface RegionDef {
  bundle:string;
  /** Prefab sub-asset UUID of the glTF (preferred, exact). Fill in after the editor imports the GLB. */
  prefabUuid?:string;
  /** Fallback when no UUID yet: prefab name inside the bundle (glTF scene prefab is named after the file). */
  prefabName?:string;
  /** Ambient clips to loop with RegionAmbientAnimation. Empty = none. */
  ambientClips?:string[];
  /** One-shot clips. Registered on the animator but not started until a real interaction. */
  gestureClips?:string[];
  /** Extra clip UUIDs if the prefab's SkeletalAnimation carries no clips. */
  ambientClipUuids?:string[];
}
export const REGIONS:Record<string,RegionDef>={
  // Exact current GLB derivative; use its sole named scene until Creator generates the subasset UUID.
  meadow:{bundle:'region_meadow',prefabName:'env_meadow'},
  island:{bundle:'static_seat_preview',prefabUuid:'61fa04e2-644b-5997-bfd1-812b61d3586b@f06f9',ambientClipUuids:['61fa04e2-644b-5997-bfd1-812b61d3586b@f2bf2']},
  // Exact prefab UUID from Creator 3.8.8 import; the .glb.meta is committed.
  skycity:{bundle:'region_skycity',prefabUuid:'0694320f-9061-478a-8d1f-cdfb7537ab22@2eeae',prefabName:'env_skycity',ambientClips:['sky_ambient_loop','robot_idle'],gestureClips:['robot_watering','robot_give_flower']},
  transitBalloon:{bundle:'region_transit_balloon',prefabName:'transport_balloon'},
};
function loadBundle(name:string){return new Promise<AssetManager.Bundle>((ok,fail)=>assetManager.loadBundle(name,(e,b)=>e||!b?fail(e||Error('no bundle '+name)):ok(b)));}
const cloudseaPrefabs=new WeakMap<Prefab,Prefab>();
/** b19 dock models: optional sky-city mooring props (landing deck sky_mooring_deck + posts/rope, 5a stakes/rope/stool). Missing = no props, never blocks. */
const mooringPrefabs=new WeakMap<Prefab,Prefab|null>();
export const SKY_MOORING_PREFAB='sky_mooring_props';
/** Loads the region's bundle and prefab. Rejects on failure so callers can show retry UI. */
async function loadPrefab(def:RegionDef,progress?:(fraction:number)=>void):Promise<Prefab>{
  progress?.(0);
  const bundle=await loadBundle(def.bundle);progress?.(.15);
  if(def.prefabUuid)return new Promise<Prefab>((ok,fail)=>assetManager.loadAny({uuid:def.prefabUuid!},{},(finished:number,total:number)=>progress?.(.15+.8*finished/Math.max(1,total)),(e:any,p:Prefab)=>{if(e||!p)fail(e||Error('no prefab'));else{progress?.(1);ok(p);}}));
  return new Promise<Prefab>((ok,fail)=>bundle.loadDir('',Prefab,(e,list:Prefab[])=>{
    if(e)return fail(e);const p=list.find(x=>x.name===def.prefabName)||(!def.prefabName&&list.length===1?list[0]:null);
    p?ok(p):fail(Error(`prefab ${def.prefabName} not found in ${def.bundle}: ${list.map(x=>x.name).join(',')}`));}));
}
/** Prepare the sibling asset before publishing the sky-city prefab as ready. */
export async function loadRegionPrefab(def:RegionDef,progress?:(fraction:number)=>void):Promise<Prefab>{
  const prefab=await loadPrefab(def,progress);
  if(def.bundle==='region_skycity'&&!isValid(cloudseaPrefabs.get(prefab),true)){
    const soft=await loadPrefab({bundle:def.bundle,prefabName:'env_sky_cloudsea_soft'});
    cloudseaPrefabs.set(prefab,soft);
  }
  if(def.bundle==='region_skycity'&&!mooringPrefabs.has(prefab)){
    let m:Prefab|null=null;try{m=await loadPrefab({bundle:def.bundle,prefabName:SKY_MOORING_PREFAB});}catch(e){console.warn('[SKY_MOORING] props unavailable',String(e));}
    mooringPrefabs.set(prefab,m);
  }
  return prefab;
}
/** Instantiates a loaded region prefab under parent and starts its ambient loops. */
export function mountRegion(def:RegionDef,prefab:Prefab,parent:Node):Node{
  const model=instantiate(prefab);
  if(def.ambientClips?.length||def.ambientClipUuids?.length||def.gestureClips?.length){const a=model.addComponent(RegionAmbientAnimation);a.clipNames=def.ambientClips||[];a.clipUuids=def.ambientClipUuids||[];a.gestureNames=def.gestureClips||[];if(def.gestureClips?.length)model.addComponent(SkycityRobotInteract);}
  if(def.bundle==='region_skycity')model.addComponent(SkycityPennantWind); // R5 S3: pennants follow GlobalWind
  if(isValid(parent,true))parent.addChild(model);
  if(def.bundle==='region_skycity'){
    const soft=cloudseaPrefabs.get(prefab);
    try{
      if(!soft||!isValid(soft,true))throw Error('skycity-cloudsea-not-prepared');
      model.addComponent(SkycityCloudsea).mount(soft);
    }catch(error){model.destroy();throw error;}
    mountSkyMooring(model,mooringPrefabs.get(prefab)||null);
  }
  return model;
}

/** Mounts sky_mooring_props under the sky-city model (authored in skycity-local coordinates) and rebinds its renderers to the
 *  model's own M_sky_palette material (the prop glb carries an untextured stand-in of the same name, no new texture). */
export function mountSkyMooring(model:Node,prefab:Prefab|null):Node|null{
  if(!prefab||!isValid(prefab,true))return null;
  let palette:Material|null=null;
  for(const r of model.getComponentsInChildren(MeshRenderer)){for(const m of r.sharedMaterials){if(m&&m.name.startsWith('M_sky_palette')&&!m.name.includes('emissive')){palette=m;break;}}if(palette)break;}
  const n=instantiate(prefab);n.name=SKY_MOORING_PREFAB;model.addChild(n);
  setMooringRopes(n,'landing',false);setMooringRopes(n,'5a',false)/* cand7: ropes stowed until a basket is moored */;
  if(palette)for(const r of n.getComponentsInChildren(MeshRenderer)){const c=Math.max(1,r.sharedMaterials.length);for(let i=0;i<c;i++)r.setSharedMaterial(palette,i);}
  else console.warn('[SKY_MOORING] M_sky_palette not found; props keep the imported stand-in');
  return n;
}

/* ===== perf-r1 #3 region asset release ===== */
/** perf-r1 item 3 (memory only grows on device: textures 92→111 MB, buffers 15→51 MB on b3394140).
 *  On a region change, release the PREVIOUS region's bundle assets so GPU textures/buffers go back near baseline.
 *  Only frees memory: no content file is touched, and the bundle is removed from the cache so a later visit reloads
 *  it from the package exactly as on the first visit (assetManager.loadBundle/getBundle in RegionLoader.loadPrefab).
 *  Safety: a region is released only when (a) it is not the target, (b) it is not the warmed next target (preload),
 *  (c) the caller says nothing of it is still mounted (live nodes reference its meshes/materials). Shared bundles
 *  (island seat preview, balloon/sail transit, board art) are never released here.
 *  Lives in RegionLoader.ts (no new script .meta). Hook: one call after ensureRegion() arrives (WorldNativeComposition is frozen — see outbox memory-release.diff.PROPOSED). */
export const REGION_RELEASE_BUNDLES: Readonly<Record<string, readonly string[]>> = {
  meadow: ['region_meadow'], skycity: ['region_skycity'], lakeside: ['region_lakeside'],
};
export interface ReleaseHost { getBundle(name: string): { releaseAll(): void } | null | undefined; removeBundle(b: any): void }
export interface ReleaseOptions { keep: readonly string[]; mounted: (region: string) => boolean; host?: ReleaseHost }
/** Pure plan: which regions' bundles may go now. */
export function planRegionRelease(target: string, opts: { keep?: readonly string[]; mounted: (region: string) => boolean }): string[] {
  const keep = new Set([target, ...(opts.keep || [])]);
  return Object.keys(REGION_RELEASE_BUNDLES).filter(r => !keep.has(r) && !opts.mounted(r));
}
/** Releases the planned regions' bundles. Returns the bundles actually released. Never throws (a failed release only logs). */
export function releaseRegionsExcept(target: string, opts: ReleaseOptions): string[] {
  const host: ReleaseHost = opts.host || (assetManager as any), out: string[] = [];
  let regions: string[] = [];
  try { regions = planRegionRelease(target, opts); } catch { return out; }
  for (const r of regions) for (const name of REGION_RELEASE_BUNDLES[r]) {
    try { const b = host.getBundle(name); if (!b) continue; b.releaseAll(); host.removeBundle(b); out.push(name); }
    catch (e) { console.warn('[QF_REGION_RELEASE]', name, String(e)); }
  }
  if (out.length) console.log('[QF_REGION_RELEASE]', target, out.join(','));
  return out;
}
