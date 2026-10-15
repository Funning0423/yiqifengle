import {assetManager,AssetManager,Prefab,Node,instantiate,isValid} from 'cc';
import {RegionAmbientAnimation} from './RegionAmbientAnimation';
import {SkycityRobotInteract} from './SkycityRobotInteract';
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
  // v0.4b has no sky_ambient_loop. These scenery loops replace it. Gestures stay one-shot.
  skycity:{bundle:'region_skycity',prefabUuid:'0694320f-9061-478a-8d1f-cdfb7537ab22@2eeae',prefabName:'env_skycity',ambientClips:['robot_idle','anim_birds_flock_0_orbit','anim_bird_0_0_flap','anim_bird_0_1_flap','anim_bird_0_2_flap','anim_bird_0_3_flap','anim_birds_flock_1_orbit','anim_bird_1_0_flap','anim_bird_1_1_flap','anim_bird_1_2_flap','anim_bird_1_3_flap','anim_butterfly_0_flutter','anim_butterfly_1_flutter','anim_butterfly_2_flutter','anim_butterfly_3_flutter','anim_flag_0_wave','anim_flag_0_tail_wave','anim_flag_1_wave','anim_flag_1_tail_wave','anim_petals_0_drift','anim_petals_1_drift','anim_wind_driver_move','anim_windchime_0_swing','anim_windchime_1_swing','anim_windchime_2_swing','anim_windmill_rotor_0_spin','anim_windmill_rotor_1_spin','anim_starring_rotate'],gestureClips:['robot_watering','robot_give_flower']},
};
function loadBundle(name:string){return new Promise<AssetManager.Bundle>((ok,fail)=>assetManager.loadBundle(name,(e,b)=>e||!b?fail(e||Error('no bundle '+name)):ok(b)));}
/** Loads the region's bundle and prefab. Rejects on failure so callers can show retry UI. */
export async function loadRegionPrefab(def:RegionDef,progress?:(fraction:number)=>void):Promise<Prefab>{
  progress?.(0);
  const bundle=await loadBundle(def.bundle);progress?.(.15);
  if(def.prefabUuid)return new Promise<Prefab>((ok,fail)=>assetManager.loadAny({uuid:def.prefabUuid!},{},(finished:number,total:number)=>progress?.(.15+.8*finished/Math.max(1,total)),(e:any,p:Prefab)=>{if(e||!p)fail(e||Error('no prefab'));else{progress?.(1);ok(p);}}));
  return new Promise<Prefab>((ok,fail)=>bundle.loadDir('',Prefab,(e,list:Prefab[])=>{
    if(e)return fail(e);const p=list.find(x=>x.name===def.prefabName)||(list.length===1?list[0]:null);
    p?ok(p):fail(Error(`prefab ${def.prefabName} not found in ${def.bundle}: ${list.map(x=>x.name).join(',')}`));}));
}
/** Instantiates a loaded region prefab under parent and starts its ambient loops. */
export function mountRegion(def:RegionDef,prefab:Prefab,parent:Node):Node{
  const model=instantiate(prefab);
  if(def.ambientClips?.length||def.ambientClipUuids?.length||def.gestureClips?.length){const a=model.addComponent(RegionAmbientAnimation);a.clipNames=def.ambientClips||[];a.clipUuids=def.ambientClipUuids||[];a.gestureNames=def.gestureClips||[];if(def.gestureClips?.length)model.addComponent(SkycityRobotInteract);}
  if(isValid(parent,true))parent.addChild(model);
  return model;
}
