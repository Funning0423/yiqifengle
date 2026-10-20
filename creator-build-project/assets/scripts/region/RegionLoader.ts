import {assetManager,AssetManager,Prefab,Node,instantiate,isValid} from 'cc';
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
  }
  return model;
}
