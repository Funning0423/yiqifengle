import {Component,MeshRenderer,Node,Quat,SkeletalAnimation,Vec3,director,instantiate,isValid} from 'cc';
/** r4-prep B (lead): she stays in frame after landing. While 风铃湖畔's board shows, the world layers (and she) are off and only the
 *  board camera (LAKESIDE_LAYER) draws, so she vanished from the board background. The board lease now carries a frozen copy of
 *  her: taken when the lease is made (enterLevel, after the landing hook: she has stopped), placed in the board scenery at the
 *  spot where she stands in the journey copy (local = journeyScene⁻¹ × her world transform; the board scenery is the same
 *  r5h3 scene, so board camera + copy = the journey's view of her), on the board layer, joints as they are (same pose), every
 *  animation/script component off (nothing moves her). Her own renderers only: the original is hidden by WorldFlow during the
 *  level, so the draw count is hers, not doubled. Destroyed exactly once with the lease. Lakeside only: meadow / sky-city board
 *  cameras see their own layer and never showed her (by design there). */
export const LAKESIDE_GUEST_SOURCE='FLOW_REFERENCE_PLACEHOLDER_NOT_B';
export const LAKESIDE_GUEST_JOURNEY_SCENE='LakesideJourneyScene';
export const LAKESIDE_GUEST_NODE='LakesideBoardGuest';
export type LakesideGuest={node:Node;renderers:number;dispose():void};
function findDeep(n:Node|null|undefined,name:string):Node|null{if(!n)return null;if(n.name===name)return n;const k=n.children;for(let i=0;i<k.length;i++){const hit=findDeep(k[i],name);if(hit)return hit;}return null;}
function setLayer(n:Node,layer:number){n.layer=layer;const k=n.children;for(let i=0;i<k.length;i++)setLayer(k[i],layer);}
/** Pure: her transform in the lakeside scene's own frame from her world transform and the journey scene's world transform (scale 1). */
export function lakesideGuestLocal(scenePos:Readonly<Vec3>,sceneRot:Readonly<Quat>,pos:Readonly<Vec3>,rot:Readonly<Quat>):{pos:Vec3;rot:Quat}{
 const inv=new Quat();Quat.invert(inv,sceneRot);const d=new Vec3(pos.x-scenePos.x,pos.y-scenePos.y,pos.z-scenePos.z),p=new Vec3();Vec3.transformQuat(p,d,inv);
 const r=new Quat();Quat.multiply(r,inv,rot);return {pos:p,rot:r};}
/** Mounts her copy under `scenery` (the board lease's scene root); null when she or the journey scene is not there (no copy,
 *  board unchanged). Never throws. */
export function mountLakesideGuest(scenery:Node,layer:number):LakesideGuest|null{
 let copy:Node|null=null;
 try{const scene=director.getScene(),src=scene?scene.getChildByName(LAKESIDE_GUEST_SOURCE):null,journey=findDeep(scene as any,LAKESIDE_GUEST_JOURNEY_SCENE);
  if(!src||!isValid(src,true)||!journey||!isValid(journey,true)||!isValid(scenery,true))return null;
  const local=lakesideGuestLocal(journey.worldPosition,journey.worldRotation,src.worldPosition,src.worldRotation),scale=src.worldScale;
  copy=instantiate(src) as Node;copy.name=LAKESIDE_GUEST_NODE;
  // before it enters the scene: nothing plays or ticks (joint nodes keep the pose they were copied with)
  const anims=copy.getComponentsInChildren(SkeletalAnimation);for(let i=0;i<anims.length;i++){anims[i].playOnLoad=false;(anims[i] as any).useBakedAnimation=false;anims[i].enabled=false;}
  const comps=copy.getComponentsInChildren(Component);for(let i=0;i<comps.length;i++)if(!(comps[i] instanceof MeshRenderer))comps[i].enabled=false;
  setLayer(copy,layer);copy.setPosition(local.pos);copy.setRotation(local.rot);copy.setScale(scale.x,scale.y,scale.z);copy.active=true;scenery.addChild(copy);
  const renderers=copy.getComponentsInChildren(MeshRenderer).length,node=copy;let dead=false;
  try{if((globalThis as any).__worldFlowLog)console.info('[QF_LAKESIDE] '+JSON.stringify({event:'board-guest',renderers,pos:[local.pos.x,local.pos.y,local.pos.z]}));}catch{}
  return {node,renderers,dispose(){if(dead)return;dead=true;if(isValid(node,true))node.destroy();}};
 }catch(error){try{if(copy&&isValid(copy,true))copy.destroy();}catch{}try{console.warn('[QF_LAKESIDE] '+JSON.stringify({event:'board-guest-skipped',error:String((error as any)?.message||error)}));}catch{}return null;}
}
