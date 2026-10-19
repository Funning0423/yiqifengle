import {Component,MeshRenderer,Node,Quat,SkeletalAnimation,Vec3,director,instantiate,isValid} from 'cc';
import type {LevelBackgroundFactory} from '../world-r2/LevelBackground';
import {stageRegionBoard,type BoardStaging} from './RegionBoardStaging';
/** r4-prep B (lead): she stays in frame after landing. While 风铃湖畔's board shows, the world layers (and she) are off and only the
 *  board camera (LAKESIDE_LAYER) draws, so she vanished from the board background. The board lease now carries a frozen copy of
 *  her: taken when the lease is made (enterLevel, after the landing hook: she has stopped), placed in the board scenery at the
 *  spot where she stands in the journey copy (local = journeyScene⁻¹ × her world transform; the board scenery is the same
 *  r5h3 scene, so board camera + copy = the journey's view of her), on the board layer, joints as they are (same pose), every
 *  animation/script component off (nothing moves her). Her own renderers only: the original is hidden by WorldFlow during the
 *  level, so the draw count is hers, not doubled. Destroyed exactly once with the lease. Meadow / sky-city live boards (own-layer
 *  cameras, she was absent too) use mountRegionBoardGuest; the island/tide board is a 2D painting (no 3D space to stand in). */
export const LAKESIDE_GUEST_SOURCE='FLOW_REFERENCE_PLACEHOLDER_NOT_B';
export const LAKESIDE_GUEST_JOURNEY_SCENE='LakesideJourneyScene';
export const LAKESIDE_GUEST_NODE='LakesideBoardGuest';
export type LakesideGuest={node:Node;renderers:number;morph:GuestMorphCopy;dispose():void};
export type GuestMorphCopy={renderers:number;morphRenderers:number;weights:number;mismatched:number};
/** r4-prep B2 (lead): the apron must not jump on the swap frame. CharacterMotion's MorphDriver writes the apron / dress shape
 *  weights with setWeight every frame; those runtime weights are not guaranteed to reach the copy's new model (morph instance re-created from the mesh), so the apron could snap to its rest shape.
 *  Pairs source/copy renderers by hierarchy order (same node name required) and copies, per renderer: every sub-mesh's every
 *  target weight (getWeight → setWeights), enableMorph, shared materials, shadow cast/receive flags. Pure over the renderer
 *  interface (getWeight/setWeights/mesh.struct.morph.subMeshMorphs); never throws per renderer. */
export function copyGuestRendererState(src:ReadonlyArray<any>,dst:ReadonlyArray<any>):GuestMorphCopy{
 const out:GuestMorphCopy={renderers:0,morphRenderers:0,weights:0,mismatched:0};
 for(let i=0;i<dst.length;i++){const a=src[i],b=dst[i];
  if(!a||!b||(a.node&&b.node&&a.node.name!==b.node.name)){out.mismatched++;continue;}out.renderers++;
  try{if(typeof a.enableMorph==='boolean')b.enableMorph=a.enableMorph;
   if(a.shadowCastingMode!==undefined)b.shadowCastingMode=a.shadowCastingMode;if(a.receiveShadow!==undefined)b.receiveShadow=a.receiveShadow;
   const mats=a.sharedMaterials;if(mats&&typeof b.setSharedMaterial==='function')for(let m=0;m<mats.length;m++)if(b.getSharedMaterial?.(m)!==mats[m])b.setSharedMaterial(mats[m],m);
   const subs=a.mesh&&a.mesh.struct&&a.mesh.struct.morph&&a.mesh.struct.morph.subMeshMorphs;
   if(!subs||!subs.length||typeof a.getWeight!=='function'||typeof b.setWeights!=='function')continue;let any=false;
   for(let s=0;s<subs.length;s++){const n=subs[s]&&subs[s].targets?subs[s].targets.length:0;if(!n)continue;const w:number[]=[];
    for(let t=0;t<n;t++){const v=Number(a.getWeight(s,t));w.push(Number.isFinite(v)?v:0);}b.setWeights(w,s);out.weights+=n;any=true;}
   if(any)out.morphRenderers++;}catch{out.mismatched++;}}
 return out;}
function findDeep(n:Node|null|undefined,name:string):Node|null{if(!n)return null;if(n.name===name)return n;const k=n.children;for(let i=0;i<k.length;i++){const hit=findDeep(k[i],name);if(hit)return hit;}return null;}
function setLayer(n:Node,layer:number){n.layer=layer;const k=n.children;for(let i=0;i<k.length;i++)setLayer(k[i],layer);}
/** Pure: her transform in the lakeside scene's own frame from her world transform and the journey scene's world transform (scale 1). */
export function lakesideGuestLocal(scenePos:Readonly<Vec3>,sceneRot:Readonly<Quat>,pos:Readonly<Vec3>,rot:Readonly<Quat>):{pos:Vec3;rot:Quat}{
 const inv=new Quat();Quat.invert(inv,sceneRot);const d=new Vec3(pos.x-scenePos.x,pos.y-scenePos.y,pos.z-scenePos.z),p=new Vec3();Vec3.transformQuat(p,d,inv);
 const r=new Quat();Quat.multiply(r,inv,rot);return {pos:p,rot:r};}
/** Mounts her copy under `scenery` (the board lease's scene root); null when she or the journey scene is not there (no copy,
 *  board unchanged). Never throws. */
export function mountLakesideGuest(scenery:Node,layer:number):LakesideGuest|null{
 const scene=director.getScene();return mountBoardGuest(scenery,layer,findDeep(scene as any,LAKESIDE_GUEST_JOURNEY_SCENE));}
/** r4-prep B (extended): the same for the meadow / sky-city live boards. Their board scene is the region model (mountRegion) and
 *  the journey copy is the same prefab instance under 'RegionJourney-<region>' (same node name), so her landed spot maps the
 *  same way. The board cameras are unchanged: she shows wherever that spot falls in their existing view. */
export function mountRegionBoardGuest(region:string,boardModel:Node,layer:number):LakesideGuest|null{
 try{const scene=director.getScene(),rig=scene?findDeep(scene as any,'RegionJourney-'+region):null;
  const journey=rig?rig.children.find(c=>c.name===boardModel.name)||null:null;return mountBoardGuest(boardModel,layer,journey);}catch{return null;}}
/** Shared: copy of her under `boardScene` at journeyScene⁻¹ × her world transform (scene scale honoured), board layer, frozen. */
export function mountBoardGuest(boardScene:Node,layer:number,journey:Node|null):LakesideGuest|null{
 let copy:Node|null=null;
 try{const scene=director.getScene(),src=scene?scene.getChildByName(LAKESIDE_GUEST_SOURCE):null;
  if(!src||!isValid(src,true)||!journey||!isValid(journey,true)||!isValid(boardScene,true))return null;
  const js=journey.worldScale,k=Number.isFinite(js?.x)&&js.x>0?js.x:1,local=lakesideGuestLocal(journey.worldPosition,journey.worldRotation,src.worldPosition,src.worldRotation),scale=src.worldScale;
  local.pos.x/=k;local.pos.y/=k;local.pos.z/=k;
  copy=instantiate(src) as Node;copy.name=LAKESIDE_GUEST_NODE;
  // before it enters the scene: nothing plays or ticks (joint nodes keep the pose they were copied with)
  const anims=copy.getComponentsInChildren(SkeletalAnimation);for(let i=0;i<anims.length;i++){anims[i].playOnLoad=false;(anims[i] as any).useBakedAnimation=false;anims[i].enabled=false;}
  const comps=copy.getComponentsInChildren(Component);for(let i=0;i<comps.length;i++)if(!(comps[i] instanceof MeshRenderer))comps[i].enabled=false;
  setLayer(copy,layer);copy.setPosition(local.pos);copy.setRotation(local.rot);copy.setScale(scale.x/k,scale.y/k,scale.z/k);copy.active=true;
  // morph weights + renderer state from the original, before (stored weights) and after (live morph instance) it enters the scene
  const srcR=src.getComponentsInChildren(MeshRenderer);copyGuestRendererState(srcR,copy.getComponentsInChildren(MeshRenderer));boardScene.addChild(copy);
  const morph=copyGuestRendererState(srcR,copy.getComponentsInChildren(MeshRenderer));
  const renderers=copy.getComponentsInChildren(MeshRenderer).length,node=copy;let dead=false;
  try{if((globalThis as any).__worldFlowLog)console.info('[QF_LAKESIDE] '+JSON.stringify({event:'board-guest',board:boardScene.name,renderers,morph,pos:[local.pos.x,local.pos.y,local.pos.z]}));}catch{}
  return {node,renderers,morph,dispose(){if(dead)return;dead=true;if(isValid(node,true))node.destroy();}};
 }catch(error){try{if(copy&&isValid(copy,true))copy.destroy();}catch{}try{console.warn('[QF_LAKESIDE] '+JSON.stringify({event:'board-guest-skipped',error:String((error as any)?.message||error)}));}catch{}return null;}
}
/** r4 sky-city figure: the region model's own ambient animation (sky city: the court's robot gardener chr_robot_gardener on
 *  robot_idle, and sky_ambient_loop's clouds / floating rocks / birds) runs on BOTH copies of the model, each from its own
 *  start, so on the swap frame the robot (and the sky props) jumped to another phase. When the board copy first shows, every
 *  clip that is playing on the journey copy is put on the same time on the board copy (and sampled), so the board frame
 *  continues the pose the journey last drew. Clips missing on either side are skipped. Returns the number of clips synced. */
export function syncRegionAmbient(journeyModel:Node|null,boardModel:Node|null):number{
 if(!journeyModel||!boardModel||!isValid(journeyModel,true)||!isValid(boardModel,true))return 0;
 const ja=journeyModel.getComponent(SkeletalAnimation),ba=boardModel.getComponent(SkeletalAnimation);if(!ja||!ba)return 0;let n=0;
 for(const clip of ba.clips){if(!clip)continue;const js=ja.getState(clip.name),bs=ba.getState(clip.name);
  if(!js||!bs||!js.isPlaying||!Number.isFinite(js.time))continue;if(!bs.isPlaying)bs.play();bs.setTime(js.time);bs.sample();n++;}
 return n;
}
/** r4-prep B (extended) without touching the meadow / sky-city lease files (运镜bot's 04→05 / 08→09 work; the 09 plaza file is
 *  SHA-frozen): wraps their factory. Once the lease is built, her copy goes under its region model (the rig child that has the
 *  same name as the journey copy's model) and is freed once with the lease (or with the rig, whichever comes first).
 *  r4 sky-city figure: on the first setVisible(true) the board model's ambient clips take the journey copy's times
 *  (syncRegionAmbient), so the robot on 星庭 and the sky props carry straight over the swap. */
export function withRegionBoardGuest(region:string,rigName:string,layer:number,factory:LevelBackgroundFactory):LevelBackgroundFactory{
 return async ctx=>{const lease=await factory(ctx);if(!lease)return lease;let guest:LakesideGuest|null=null,model:Node|null=null,journey:Node|null=null;
  let rigNode:Node|null=null;try{const scene=director.getScene(),jr=scene?findDeep(scene as any,'RegionJourney-'+region):null,rig=rigNode=ctx.parent.getChildByName(rigName);
   const names=new Set((jr?jr.children:[]).map(c=>c.name));model=rig?rig.children.find(c=>names.has(c.name))||null:null;
   journey=model&&jr?jr.children.find(c=>c.name===model!.name)||null:null;
   if(model)guest=mountRegionBoardGuest(region,model,layer);}catch{guest=null;}
  if(!guest&&!(model&&journey))return lease;const g=guest,dispose=lease.dispose,m=model,j=journey;let synced=false,ambient=0;
  // r5 G1: spread model creation + first-draw shader compiles over the level-loading frames (RegionBoardStaging); the reveal finishes it.
  let staging:BoardStaging|null=null;try{staging=stageRegionBoard(rigNode);}catch{staging=null;}
  return {frame:(p,l)=>lease.frame(p,l),
   setVisible:v=>{if(v&&staging)staging.finish('reveal');lease.setVisible(v);if(v&&!synced){synced=true;try{ambient=syncRegionAmbient(j,m);}catch{ambient=0;}
    try{if((globalThis as any).__worldFlowLog)console.info('[QF_REGION] '+JSON.stringify({event:'board-ambient-sync',region,clips:ambient}));}catch{}}},
   setPaused:v=>lease.setPaused?.(v),
   diagnostics:()=>({...(lease.diagnostics?lease.diagnostics():{}),guest:g?g.renderers:0,ambientSynced:ambient,staging:staging?staging.stats():null}),dispose:()=>{staging?.dispose();g?.dispose();dispose.call(lease);}};};
}
