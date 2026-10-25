import {_decorator,Animation,Camera,Color,Component,Mat4,Material,MeshRenderer,Node,Vec3,director,geometry,utils,view} from 'cc';
import {MINIGAME} from 'cc/env';
import {applyCameraPose,fromLookAt} from '../world-r1/CameraPose';
import type {Pose,Vec} from '../world-r1/WorldFlowCore';
import type {CharacterAdapter} from '../world-r1/WorldFlowCore';
import {BLEND_S,LENS_CLEAR_M,blendPose,finaleLook,finalePose,propFacingPose,ROBOT_FACING,PROP_CLEAR_M,followLookUp,followPose,mapPose,markersLook,retreatClear,type Aabb,type LensState} from '../region/ExploreCameraCore';
import {FreeOrbit,ORBIT_LIMITS,orbitColliderName,type OrbitBox,type OrbitPlace} from '../region/FreeOrbit';
import {setExploreEnabled} from '../region/ExploreGate';
import {REGION_NODES,type RegionId} from '../region/RegionNodes';
import {derive,walkPair,type NodePhase} from '../region/RegionNodeProgress';
import {planWalk} from '../region/NodeWalker';
import {performBounded,runRewardWalk,runSkyFinale,type PathPlace} from '../region/RegionNodePlay';
import {emitTransitCue} from '../region/TransitAudioHooks';
import {PROP_NODES,SCENE_PROPS,propFeedback,resolveTap,pickMarker,type Gesture} from './ExploreInput';
import {gemLocal,markerAnchor,footprints,routeHintVisible} from '../ui/NodeMarkers';
import {WorldFlowComponent} from '../world-r1/WorldFlowComponent';
import {SkycityRobotInteract} from '../region/SkycityRobotInteract';
import {EXIT_EXPLORE_REGIONS,exploreArm,exploreWanted,stageGraph,type ExploreRegion,type StageRegion} from '../region/LakesideExplore';
import {camTraceStart} from '../region/CamTrace';
import {bgCamHeld,bgCamHold,bgCamRelease,bgCamWanted} from '../region/BgCamGate';
import {qaHooksEnabled,qaYawFacing} from './QaSkip';
import {ISLAND_PROPS,signFrontView} from './IslandPropsLayout';
import {signShot} from '../region/SignShot';
import {SKY_FINALE,SKY_FINALE_POSE_LOCAL,skyFinaleApproach,skyFinaleApproachPose} from '../region/SkyFinaleShot';
import {onWipeCovered,onWipeRevealed,addWipeBeforeReveal} from '../world-r1/ScreenCover';
import {LensGuard,LENS_GUARD,guardEval,proxiesToWorld,type OccBox} from '../region/LensOcclusion';
import {LAKESIDE_DECK_ZONES,LAKESIDE_LENS_OCCLUDERS} from '../region/LakesideLensOccluders';
import {ISLAND_LENS_OCCLUDERS} from '../region/IslandLensOccluders';
import {SKYCITY_LENS_OCCLUDERS} from '../region/SkycityLensOccluders';
import {ArmSmoother} from '../region/ArmSmoother';
import {AVOID,LENS_PITCH_MAX_DEG,herOcclusion,lensLevel,nearSphere,toFrame,type FrameBox} from '../region/LensAvoid';
import {LENS_SMOOTH,OffsetSmoother,frameHer,posOf,sphOf,wrapDeg} from '../region/LensSmooth';
import {nearestWalkable,walkPath,walkTapPath,walkPathLengthM,walkRayHit,type WVec} from '../region/RegionWalkable';
const {ccclass}=_decorator;

type Cover={host:Node|null;nav:Node|null;cams:{cam:Camera;on:boolean}[];rig:Node|null;rigOn:boolean};
type Pulse={node:Node;sx:number;sy:number;sz:number;ey:number;left:number;motion:'sway'|'spin'|'pulse'};

function findDeep(n:Node|null,name:string):Node|null{
 if(!n)return null;if(n.name===name)return n;
 for(const c of n.children){const h=findDeep(c,name);if(h)return h;}
 return null;
}
function findAll(n:Node|null,name:string,out:Node[]){
 if(!n)return;if(n.name===name)out.push(n);
 for(const c of n.children)findAll(c,name,out);
}
/** Drives the live world camera, the girl, and one shared marker mesh. */
/** Test-only (qaHooksEnabled): first rendered mesh along the tap ray -> hitName / hitPath (up to 5 parents) / hitPoint (world) /
 *  hitDistM, for __qfGroundTap. Walking still uses the baked walk field; this only names what the finger visually touched. */
function qaFirstRenderHit(ray:geometry.Ray):{hitName:string|null;hitPath?:string;hitPoint?:number[];hitDistM?:number}{
 try{const scene=director.getScene();if(!scene)return {hitName:null};let best=Infinity,node:Node|null=null;
  for(const m of scene.getComponentsInChildren(MeshRenderer)){const md=(m as any).model;if(!m.enabledInHierarchy||!md||!md.worldBounds)continue;
   const t0=geometry.intersect.rayAABB(ray,md.worldBounds);const wb=md.worldBounds,c=wb.center,h=wb.halfExtents,inside=Math.abs(ray.o.x-c.x)<=h.x&&Math.abs(ray.o.y-c.y)<=h.y&&Math.abs(ray.o.z-c.z)<=h.z;
   if(!inside&&(!t0||t0>=best))continue;
   const t=geometry.intersect.rayModel(ray,md,{mode:geometry.ERaycastMode.CLOSEST,distance:Math.min(best,1000),doubleSided:true} as any);if(t&&t<best){best=t;node=m.node;}}
  if(!node)return {hitName:null};const path:string[]=[];for(let n:Node|null=node,i=0;n&&n.parent&&i<6;n=n.parent,i++)path.unshift(n.name);
  const r=(v:number)=>+v.toFixed(2);return {hitName:node.name,hitPath:path.join('/'),hitPoint:[r(ray.o.x+ray.d.x*best),r(ray.o.y+ray.d.y*best),r(ray.o.z+ray.d.z*best)],hitDistM:r(best)};
 }catch{return {hitName:null};}
}
@ccclass('RegionNodeStage')
export class RegionNodeStage extends Component{
 lens:LensState='Board';
 private camera:Camera|null=null;
 private character:CharacterAdapter|null=null;
 private cover:Cover|null=null;
 private exploring=false;
 private region:StageRegion='island';
 private groundWalking=false;
 private exploreCheck=0;
 private syncOpened:ExploreRegion|null=null;
 /** p0drag5: board-background cameras switched off while a sync-opened explore owns the view (restored on close). */
 private syncCams:{cam:Camera;region:StageRegion;model:Node|null}[]=[];
 private exploreArmed:Partial<Record<ExploreRegion,boolean>>={};
 private explorePrev:string|null=null;
 private focus:Vec=[0,0,0];
 private zoom=1.2;
 private markerNode:Node|null=null;
 private pulses:Pulse[]=[];
 private anim:{t:number;seconds:number;sample:(t:number)=>void;done:()=>void}|null=null;
 private shotPhases:Readonly<Record<string,NodePhase>>|null=null;
 private markerWait=0;
 private markerClock=0;
 private holdPulse=0;
 private hideTree=false;
 private occluders:MeshRenderer[]=[];
 private buried:Node[]=[];
 private savedLayers:{n:Node;layer:number}[]=[];
 private animHold:{c:Animation;on:boolean}[]=[];
 private holdPose:Pose|null=null;
 private armSmooth=new ArmSmoother();
 private avoid={sw:0,e:0,tsw:0,te:0,clear:0,wait:0,py:NaN,k:1,tk:1,hidT:0};private lensSmooth=new OffsetSmoother();private skyPrev:{yaw:number;el:number;arm:number}|null=null;private skyPrevW:[number,number,number]|null=null;private walkAim:number|null=null;private secC:{t:number;g:number[];el:number;arm:number;ok:boolean[];okr:boolean[];fr:boolean[];w:boolean}|null=null;private secT=0;private walkEndT=0;private wplan:{pts:Vec[];ss:number[];ys:number[];as:number[];d:number;raw0:number;s:number}|null=null;private secHoldY=NaN;private secSide=0;private secPg:{t:number;g:number[]}|null=null;private secPy=NaN;private walkAimPitch:number|null=null;private qaHold=false;private qaShot:Pose|null=null;private skyDetour=0;
 private walkToken=0;private walkCancel:(()=>void)|null=null;
 private shotNote='';
 private dragHome:Vec|null=null;
 private completed:readonly string[]=[];
 private readonly orbit=new FreeOrbit('island');
 private orbitBoxes:OrbitBox[]=[];
 /** b17r7 (运镜bot): lakeside free-walk lens occlusion. The lakeside is static-merged (renderer AABBs > 14 m are skipped by
  *  refreshOrbitBoxes), so the lens uses the generated tree/post/house proxies (LakesideLensOccluders) via LensPullIn. */
 private lensPull=new LensGuard();private islandBoxes:OccBox[]|null=null;private occBoxes:OccBox[]|null=null;private occAt=0;private occModel:Node|null=null;private deckZones:OccBox[]|null=null;
 /** P0 r16 explore entry glide: from the lens explore opened on to the pre-solved clear lens (no first-frame canopy). */
 private entry:{from:Pose;t:number;T:number}|null=null;
 private orbitBoxAt=0;

 attach(camera:Camera){this.camera=camera;camTraceStart();if(qaHooksEnabled()){const G=globalThis as any;G.__qfTeleport=(key:string,yaw?:number,pitch?:number)=>this.qaTeleport(key,yaw,pitch);G.__qfAimAt=(at:string|readonly number[]|{x:number;y:number;z:number})=>this.qaAimAt(at);}}
 bindCharacter(character:CharacterAdapter|null){this.character=character;}
 /** b17r12b: the composition's calibrated girl. A fresh save that leaves the island board before any reward walk never called bindCharacter, so explore/ground taps pull her from here. */
 characterSource:(()=>CharacterAdapter|null)|null=null;
 ensureCharacter():CharacterAdapter|null{if(!this.character&&this.characterSource){try{this.character=this.characterSource()||null;}catch{this.character=null;}}return this.character;}
 setCompleted(ids:readonly string[]){this.completed=ids;}

 private viewport(){const s=view.getVisibleSize();return {w:Math.max(1,s.width),h:Math.max(1,s.height)};}
 private girl():Vec{
  const d=(this.character as any)?.diagnostics?.();
  const r=d?.root;if(r&&r.length===3)return [r[0],r[1],r[2]];
  return this.focus;
 }
 private yaw():number{
  const m=(this.character as any)?.diagnostics?.()?.motion;
  return m&&typeof m.yawDeg==='number'?m.yawDeg*Math.PI/180:0;
 }
 private model(region:StageRegion):Node|null{
  if(region==='island')return null;
  if(region==='lakeside'){const rig=findDeep(director.getScene(),'RegionJourney-lakeside');return findDeep(rig,'LakesideJourneyScene')||rig?.children[0]||null;}
  const rig=findDeep(director.getScene(),'RegionJourney-'+region);if(!rig)return null;
  return rig.children[0]||null;
 }
 private toWorld(region:StageRegion,path:readonly Vec[]):Vec[]{
  const model=this.model(region);if(!model)return path.map(p=>[p[0],p[1],p[2]] as Vec);
  const m=model.worldMatrix,v=new Vec3();
  return path.map(p=>{Vec3.transformMat4(v,new Vec3(p[0],p[1],p[2]),m);return [v.x,v.y,v.z] as Vec;});
 }
 private place(region:StageRegion):PathPlace{return path=>this.toWorld(region,path);}
 private readPose():Pose{
  const cam=this.camera!;const n=cam.node,p=n.worldPosition,f=n.forward;
  return {position:[p.x,p.y,p.z],target:[p.x+f.x*10,p.y+f.y*10,p.z+f.z*10],fovVerticalDeg:cam.fov};
 }
 private writePose(pose:Pose,clear=false,clearM=LENS_CLEAR_M):Pose{
  const cam=this.camera;if(!cam?.node?.isValid)return pose;
  const next=clear?this.guardLens(pose,clearM):pose;
  const ok=applyCameraPose(cam,fromLookAt(next,next.fovVerticalDeg??cam.fov),'region.node-lens');
  if(!ok)this.shotNote=(this.shotNote?this.shotNote+' ':'')+'rejected';
  return next;
 }
 /** Finale and free-explore lenses: AABB retreat, then a 0.6 m ray so the near plane cannot enter a mesh. */
 private guardLens(pose:Pose,clear=LENS_CLEAR_M):Pose{
  const origDir=this.viewDir(pose);
  const boxes=this.sceneBoxes();
  let next=retreatClear(pose,boxes,clear);
  const scene=director.getScene();if(!scene)return next;
  const dir=this.viewDir(next);
  const ray=new geometry.Ray();
  const rends=scene.getComponentsInChildren(MeshRenderer);
  for(let step=0;step<8;step++){
   ray.o.set(next.position[0],next.position[1],next.position[2]);
   ray.d.set(dir[0],dir[1],dir[2]);
   let push=0;
   for(const r of rends){
    if(!r.enabled||!r.node.activeInHierarchy||!r.model||r.node===this.markerNode)continue;
    const t=geometry.intersect.rayModel(ray,r.model,{mode:geometry.ERaycastMode.CLOSEST,distance:clear,doubleSided:true});
    if(t>0&&t<clear)push=Math.max(push,clear-t+0.05);
   }
   if(push<=0)break;
   const p=next.position;
   next={position:[p[0]-dir[0]*push,p[1]-dir[1]*push,p[2]-dir[2]*push],target:[0,0,0],fovVerticalDeg:next.fovVerticalDeg};
   next.target=[next.position[0]+dir[0]*10,next.position[1]+dir[1]*10,next.position[2]+dir[2]*10];
  }
  // A lens still aimed into a mesh (sky stairs, island lip) climbs instead of sliding under it.
  for(let up=0;up<8;up++){
   if(this.clearAhead(next,2)&&this.clearUp(next,1.2))break;
   const p=next.position,t=next.target;
   next=retreatClear({position:[p[0],p[1]+1.6,p[2]],target:t,fovVerticalDeg:next.fovVerticalDeg},boxes,clear);
  }
  // A map lens that slid under a stair flight ends up looking up through the treads. Put it back above the subject.
  const lifted=this.viewDir(next);
  if(origDir[1]<-0.25&&lifted[1]>0.05){
   const rise=Math.max(4,pose.position[1]-pose.target[1]);
   const p=next.position,t=next.target;
   next=retreatClear({position:[p[0],t[1]+rise,p[2]],target:t,fovVerticalDeg:next.fovVerticalDeg},boxes,clear);
  }
  return next;
 }
 /** True when nothing hangs within `distance` metres straight above the lens. */
 private clearUp(pose:Pose,distance:number):boolean{
  return this.rayClear(pose,[0,1,0],distance);
 }
 private clearAhead(pose:Pose,distance:number):boolean{
  return this.rayClear(pose,this.viewDir(pose),distance);
 }
 private rayClear(pose:Pose,dir:Vec,distance:number):boolean{
  const scene=director.getScene();if(!scene)return true;
  const ray=new geometry.Ray();
  ray.o.set(pose.position[0],pose.position[1],pose.position[2]);ray.d.set(dir[0],dir[1],dir[2]);
  for(const r of scene.getComponentsInChildren(MeshRenderer)){
   if(!r.enabled||!r.node.activeInHierarchy||!r.model||r.node===this.markerNode)continue;
   if(/greattree/.test(r.node.name))continue;
   const t=geometry.intersect.rayModel(ray,r.model,{mode:geometry.ERaycastMode.CLOSEST,distance,doubleSided:true});
   if(t>0&&t<distance)return false;
  }
  return true;
 }
 private viewDir(pose:Pose):Vec{
  const d=[pose.target[0]-pose.position[0],pose.target[1]-pose.position[1],pose.target[2]-pose.position[2]];
  const L=Math.hypot(d[0],d[1],d[2])||1;return [d[0]/L,d[1]/L,d[2]/L];
 }
 private sceneBoxes():Aabb[]{
  const scene=director.getScene();if(!scene)return [];
  const out:Aabb[]=[];
  for(const r of scene.getComponentsInChildren(MeshRenderer)){
   if(!r.node.activeInHierarchy||r.node===this.markerNode||!r.model?.worldBounds)continue;
   const b=r.model.worldBounds,c=b.center,h=b.halfExtents;
   out.push({min:[c.x-h.x,c.y-h.y,c.z-h.z],max:[c.x+h.x,c.y+h.y,c.z+h.z]});
  }
  return out;
 }
 private flow(){return director.getScene()?.getComponentInChildren(WorldFlowComponent)||null;}

 private showWorld(region:StageRegion){
  if(this.cover&&this.region===region)return;
  if(this.region!==region)this.orbit.forget();
  if(this.cover)this.restoreBoard();
  const scene=director.getScene();if(!scene)return;
  const host=findDeep(scene,'ManagedNativeBoardHost');
  const nav=findDeep(scene,'WorldNavigationCanvas');
  const cams=scene.getComponentsInChildren(Camera).filter(c=>/BackgroundCamera$/.test(c.node.name));
  const rig=region==='island'?null:findDeep(scene,'RegionJourney-'+region);
  this.cover={host,nav,cams:cams.map(cam=>({cam,on:cam.enabled})),rig,rigOn:!!rig?.active};
  if(host)host.active=false;
  for(const c of cams)bgCamHold(c,'cover');/* p0drag6: a hold the owner's setVisible respects (BgCamGate), not a raw toggle */
  if(rig)rig.active=true;
  this.flow()?.presentNodeWalkWorld(true);
  try{this.character?.setVisible(true);}catch{/* no adapter */}
  this.region=region;
 }
 private restoreBoard(){
  const c=this.cover;if(!c){this.releaseSyncCams();return;}this.cover=null;
  if(c.rig)c.rig.active=c.rigOn;
  this.flow()?.presentNodeWalkWorld(false);
  for(const x of c.cams)if(x.cam?.isValid)bgCamRelease(x.cam,true,'cover',x.on);/* owner's current want wins; x.on only for ungated cameras */
  if(c.host?.isValid)c.host.active=true;
  if(c.nav?.isValid)c.nav.active=true;
  try{this.character?.setVisible(false);}catch{/* level hides her */}
  this.releaseSyncCams();
  this.lens='Board';this.exploring=false;setExploreEnabled(false);this.shotPhases=null;
  this.orbit.armBoard();
 }
 private async blend(seconds:number,from:Pose,to:()=>Pose){
  this.orbit.pause();
  const step=(t:number)=>((globalThis as any).__qfCamTraceSub?.('blend'),this.writePose(t<=0?from:t>=seconds?to():blendPose(from,to(),t,seconds)));
  await new Promise<void>(resolve=>{
   let settled=false;const done=()=>{if(settled)return;settled=true;step(seconds);resolve();};
   this.anim={t:0,seconds,sample:step,done};
   setTimeout(done,seconds*1000+80);
  });
 }

 async playReward(character:CharacterAdapter,fromStage:string,toStage:string){
  await (character as any).__qfWalkTail?.done/* b15: never cut her exit walk */;
  this.character=character;
  const spec=walkPair(fromStage,toStage);
  this.showWorld(spec.region);
  const start=this.toWorld(spec.region,planWalk(spec.region,spec.from,spec.to).segments[0].path)[0];
  try{character.cancelAndReset({kind:'standing',controllerRoot:[start[0],start[1],start[2]],yawRad:0});}catch{/* still blend */}
  const {w,h}=this.viewport();
  const board=this.readPose();
  this.lens='BoardToFollow';setExploreEnabled(false);
  /* b17r13: the reward close-up is held for her walk, so it blends to the occlusion-planned pose (Mac r13b: a stone pillar filled its right half) */
  const held=this.occludeHeld(followPose(this.girl(),this.yaw(),w,h,followLookUp(spec.region,99)));
  await this.blend(BLEND_S.boardToFollow,board,()=>held);
  this.lens='FollowWalk';setExploreEnabled(true);
  this.handOrbitBack(spec.region);
  try{await runRewardWalk(character,fromStage,toStage,undefined,this.place(spec.region));}
  finally{setExploreEnabled(false);}
  const arrived=this.readPose();
  this.lens='FollowToBoard';
  await this.blend(BLEND_S.followToBoard,arrived,()=>board);
  this.restoreBoard();
 }
 async playFinale(character:CharacterAdapter){
  await (character as any).__qfWalkTail?.done;
  this.character=character;
  this.showWorld('skycity');
  const start=this.toWorld('skycity',planWalk('skycity','S4','S6').segments[0].path)[0];
  try{character.cancelAndReset({kind:'standing',controllerRoot:[start[0],start[1],start[2]],yawRad:0});}catch{/* continue */}
  const {w,h}=this.viewport();
  const board=this.readPose();
  this.lens='BoardToFollow';
  await this.blend(BLEND_S.boardToFollow,board,()=>followPose(this.girl(),this.yaw(),w,h,8));
  this.lens='FollowWalk';setExploreEnabled(true);
  this.handOrbitBack('skycity');
  try{await runSkyFinale(character,this.place('skycity'));}finally{setExploreEnabled(false);}
  this.lens='FollowWalk';
  /* T-02 (Grok Bot approved Oct 25): the old 0.6 s blend to the 26 m star pose (mostly empty sky, she ≈ 3 %) is replaced by a low side
   * angle 7 m from her (SkyFinaleShot: her ≈ 26 % of the frame, the star-ring arc across the top, the city between, ≥ 1.1 m clear),
   * reached in an eased blend timed to the standing cap (≤ 90°/s, ≤ 200°/s²). Held until a drag/tap, or auto-continue (armFinaleContinue). */
  const shot=this.skyFinalePose(),from=this.readPose(),g=this.girl();
  /* the way round + time are judged in the skycity model frame (proxies are model-local, see skycityOccluders); rigid, so the
   * world path below keeps the same way round */
  const all=this.skycityAllOccluders(),L=this.skyL,loc=(p:Pose)=>({position:toFrame(L!,p.position) as Vec,target:toFrame(L!,p.target) as Vec,fovVerticalDeg:p.fovVerticalDeg});
  const ap=all&&L?skyFinaleApproach(loc(from),{...SKY_FINALE_POSE_LOCAL},toFrame(L,g),all.map(b=>({min:b.min,max:b.max}))):skyFinaleApproach(from,shot,g,[]);this.finaleApproachS=ap.T;
  await this.blendPath(ap.T,t=>skyFinaleApproachPose(from,shot,g,t,ap.T,ap.dir))/* orbits round her the clear way, never a straight cut */;
  this.openExplore('skycity');
 }
 /** T-02: the baked S6 shot (skycity model-local → world). */
 skyFinalePose():Pose{const [p,t]=this.toWorld('skycity',[SKY_FINALE_POSE_LOCAL.position as Vec,SKY_FINALE_POSE_LOCAL.target as Vec]);return {position:p,target:t,fovVerticalDeg:SKY_FINALE_POSE_LOCAL.fovVerticalDeg};}
 finaleApproachS=0;
 private async blendPath(seconds:number,at:(t:number)=>Pose){
  this.orbit.pause();
  const step=(t:number)=>this.writePose(at(Math.min(seconds,Math.max(0,t))));
  await new Promise<void>(resolve=>{let settled=false;const done=()=>{if(settled)return;settled=true;step(seconds);resolve();};this.anim={t:0,seconds,sample:step,done};setTimeout(done,seconds*1000+80);});
 }
 /** T-02 auto-continue: armed by the composition once the region reward is claimed; any drag / pinch / tap disarms it; after
  * SKY_FINALE.holdS of no input it calls `go` (the same handler as the 继续旅程 button). The lake set-off's WindWipe covers the
  * hand-off: covered → disarm; beforeReveal waits for any blend of ours to finish; revealed → nothing of ours stays on screen. */
 private finaleArm:{at:number;go:()=>void;timer:any}|null=null;
 armFinaleContinue(go:()=>void,now=Date.now()){this.disarmFinale();if(this.region!=='skycity'||!this.exploring)return false;
  const a={at:now,go,timer:null as any};a.timer=setInterval(()=>{if(this.finaleArm!==a)return;if(Date.now()-a.at>=SKY_FINALE.holdS*1000){this.disarmFinale();try{go();}catch(e){console.error('finale-continue',e);}}},100);this.finaleArm=a;
  if(!this.wipeHooks.length)this.wipeHooks.push(onWipeCovered(()=>this.disarmFinale()),addWipeBeforeReveal(()=>!this.anim),onWipeRevealed(()=>this.disarmFinale()));return true;}
 disarmFinale(){const a=this.finaleArm;this.finaleArm=null;if(a&&a.timer)clearInterval(a.timer);}
 finaleArmed(){return !!this.finaleArm;}
 private wipeHooks:(()=>void)[]=[];
 onDestroy(){this.disarmFinale();for(const u of this.wipeHooks.splice(0))try{u();}catch{}}
 private named(name:string):Node|null{const nodes:Node[]=[];findAll(director.getScene(),name,nodes);return nodes.find(n=>n.activeInHierarchy)||nodes[0]||null;}
 /** Great-tree canopy sits on the finale sightline. Hide it by name, and drop the mesh the lens ray hits before the ring. */
 private treeVisible(on:boolean){
  const scene=director.getScene();if(!scene)return;
  const visit=(n:Node)=>{
   const mesh=n.getComponent(MeshRenderer)?.mesh as {name?:string}|null;
   if(n.name==='env_sky_greattree_canopy'||n.name==='env_sky_greattree_canopy_cards'||/greattree|canopy/.test(n.name+' '+(mesh?.name||'')))this.bury(n,on);
   for(const c of n.children)visit(c);
  };
  visit(scene);
  if(!on){this.quietSky(true);this.buryCrown();}
  if(on)this.restoreOccluders();
 }
 /** The brown crown is the mesh above the star ring, whether or not its node kept the glTF name. */
 private buryCrown(){
  const scene=director.getScene();if(!scene)return;
  const ring=this.named('env_sky_starring');if(!ring)return;
  const rp=ring.worldPosition;
  for(const r of scene.getComponentsInChildren(MeshRenderer)){
   if(!r.node.activeInHierarchy||!r.model?.worldBounds||r.node===this.markerNode)continue;
   if(/starring|state_ring|palette|FLOW_REFERENCE|GGbot|girl/.test(r.node.name))continue;
   const b=r.model.worldBounds,h=b.halfExtents,span=Math.max(h.x,h.y,h.z)*2;
   if(!(span>20&&span<80))continue;
   if(Math.hypot(b.center.x-rp.x,b.center.z-rp.z)>28)continue;
   if(b.center.y<rp.y+6)continue;
   this.bury(r.node,false);
  }
 }
 private hiddenLayer():number{
  const vis=this.camera?.visibility??0;
  for(let i=1;i<30;i++){const bit=1<<i;if((vis&bit)===0)return bit;}
  return 1<<30;
 }
 /** The sky loop writes the canopy transform every frame, so scale/active alone do not stick. Stop that clip and move the mesh off the camera's layers. */
 private quietSky(hide:boolean){
  if(!hide){for(const a of this.animHold)if(a.c.isValid)a.c.enabled=a.on;this.animHold.length=0;return;}
  if(this.animHold.length)return;
  const scene=director.getScene();if(!scene)return;
  for(const c of scene.getComponentsInChildren(Animation)){
   let sky=false;for(let p:Node|null=c.node;p;p=p.parent)if(/skycity|RegionJourney-skycity|Skycity/.test(p.name)){sky=true;break;}
   if(!sky)continue;
   this.animHold.push({c,on:c.enabled});c.enabled=false;
  }
 }
 private bury(n:Node,on:boolean){
  if(!on){
   if(this.buried.indexOf(n)<0)this.buried.push(n);
   if(!this.savedLayers.some(s=>s.n===n))this.savedLayers.push({n,layer:n.layer});
   n.layer=this.hiddenLayer();
   n.active=false;n.setScale(0,0,0);
   const r=n.getComponent(MeshRenderer);if(r){r.enabled=false;if(this.occluders.indexOf(r)<0)this.occluders.push(r);}
   return;
  }
  n.active=true;n.setScale(1,1,1);
  const r=n.getComponent(MeshRenderer);if(r)r.enabled=true;
 }
 private restoreOccluders(){
  this.quietSky(false);
  for(const s of this.savedLayers)if(s.n.isValid)s.n.layer=s.layer;
  this.savedLayers.length=0;
  for(const n of this.buried)if(n.isValid){n.active=true;n.setScale(1,1,1);}
  this.buried.length=0;
  for(const r of this.occluders)if(r.isValid)r.enabled=true;
  this.occluders.length=0;
 }
 /** Canopy span is ~45 m and is the first hit (~26 m). Hide that mesh even when its node name differs; never the island palette. */
 private stripFinaleOccluders(pose:Pose){
  const scene=director.getScene();if(!scene)return;
  const dir=this.viewDir(pose),ray=new geometry.Ray();
  let n=0;
  for(let pass=0;pass<4;pass++){
   ray.o.set(pose.position[0],pose.position[1],pose.position[2]);ray.d.set(dir[0],dir[1],dir[2]);
   let best:MeshRenderer|null=null,bestT=50;
   for(const r of scene.getComponentsInChildren(MeshRenderer)){
    if(!r.enabled||!r.node.activeInHierarchy||!r.model||r.node===this.markerNode)continue;
    const label=r.node.name+' '+((r.mesh as {name?:string}|null)?.name||'');
    if(/starring|state_ring|FLOW_REFERENCE|RegionNodeMarkers|palette|GGbot|girl/.test(label))continue;
    const h=r.model.worldBounds?.halfExtents;if(!h)continue;
    const span=Math.max(h.x,h.y,h.z)*2;if(!(span>15&&span<70))continue;
    const t=geometry.intersect.rayModel(ray,r.model,{mode:geometry.ERaycastMode.CLOSEST,distance:50,doubleSided:true});
    if(t>0&&t<bestT){best=r;bestT=t;}
   }
   if(!best)break;
   this.bury(best.node,false);n++;
  }
  const p=pose.position;
  this.shotNote='occluders:'+n+' buried:'+this.buried.length+' cam:'+p[0].toFixed(1)+','+p[1].toFixed(1)+','+p[2].toFixed(1);
 }
 private starPose(g:Vec,w:number,h:number):Pose{
  const base=finalePose(g,this.yaw(),w,h);
  const nodes:Node[]=[];findAll(director.getScene(),'env_sky_starring',nodes);
  const rig=findDeep(director.getScene(),'RegionJourney-skycity');
  const under=(n:Node,root:Node)=>{for(let p:Node|null=n;p;p=p.parent)if(p===root)return true;return false;};
  const ring=(rig&&nodes.find(n=>under(n,rig)))||nodes.find(n=>n.activeInHierarchy)||nodes[0];
  if(!ring)return base;
  const b=ring.getComponent(MeshRenderer)?.model?.worldBounds?.center;
  const p=b?[b.x,b.y,b.z] as Vec:[ring.worldPosition.x,ring.worldPosition.y,ring.worldPosition.z];
  return finaleLook(g,p);
 }
 /** Local metres inside the region GLB. Skinned bounds are not the prop (the robot mesh is authored in model space). */
 private propLocal(id:string):Vec|null{
  if(id==='robot')return [3.6,0.2,28.2];
  if(id==='bell')return [7,6.57,-22.5];
  if(id==='windchime')return [-22.41,11.73,30.52];
  return null;
 }
 private propSpan(id:string):number{return id==='robot'?6.5:id==='palm'?5.5:id==='bell'?3.2:2.6;}
 private propNode(id:string):Node|null{
  const name=id==='robot'?'anchor_robot_root':(PROP_NODES[id]||'');if(!name)return null;
  const nodes:Node[]=[];findAll(director.getScene(),name,nodes);
  const rig=findDeep(director.getScene(),'RegionJourney-'+this.region);
  const child=(n:Node,root:Node)=>{for(let p:Node|null=n;p;p=p.parent)if(p===root)return true;return false;};
  return (rig&&nodes.find(n=>child(n,rig)&&n.activeInHierarchy))||nodes.find(n=>n.activeInHierarchy)||nodes[0]||null;
 }
 private propPose(id:string,g:Vec,w:number,h:number):Pose{
  const base=followPose(g,this.yaw(),w,h,0);
  const node=this.propNode(id);
  const live=node?[node.worldPosition.x,node.worldPosition.y,node.worldPosition.z] as Vec:null;
  const local=this.propLocal(id);
  const baked=local?this.toWorld(this.region,[local])[0]:null;
  const p=live||baked;
  this.shotNote='prop:'+id+' live:'+(live?1:0);
  if(!p)return base;
  if(id==='bell'){
   const off=new Vec3(0.34,1.55,6.08),rot=new Vec3();
   const model=this.model(this.region);
   if(model)Vec3.transformQuat(rot,off,model.worldRotation);else rot.set(off);
   return {position:[p[0]+rot.x,p[1]+rot.y,p[2]+rot.z],target:[p[0],p[1]+1.2,p[2]],fovVerticalDeg:42};
  }
  if(id==='robot'){
   // front three-quarter from the robot's own facing (+Z of anchor_robot_root), not along the line to her
   const f=new Vec3(0,0,1);
   const q=node?node.worldRotation:this.model(this.region)?.worldRotation;
   if(q)Vec3.transformQuat(f,f,q);
   return propFacingPose(p,[f.x,f.y,f.z],g,ROBOT_FACING);
  }
  const dx=g[0]-p[0],dz=g[2]-p[2],L=Math.hypot(dx,dz)||1;
  const back=id==='robot'?12:id==='palm'?9:Math.max(4.2,this.propSpan(id)*1.7);
  const lift=id==='robot'?4.2:id==='palm'?3.2:this.propSpan(id)*0.55;
  const aim=id==='robot'?3:id==='palm'?2.2:this.propSpan(id)*0.35;
  return {position:[p[0]+dx/L*back,p[1]+lift,p[2]+dz/L*back],target:[p[0],p[1]+aim,p[2]],fovVerticalDeg:40};
 }
 /** Board and blends pause the orbit. Back on a walk, ease to the view she had, or stay on the follow lens. */
 private handOrbitBack(region:StageRegion){
  const place:OrbitPlace=region;
  const was=this.orbit.engaged();
  if(this.orbit.place==='board'||this.orbit.mode==='board')this.orbit.disarm(place);
  else this.orbit.setPlace(place);
  if(!was){this.orbit.unlock();return;}
  this.orbit.beginReturn(this.readPose());
  this.writeOrbit(0);
 }
 /** The lakeside graph box is model-local and the journey copy sits far off the origin, so no world xz clamp there (the walk itself stays on the baked area). */
 /** r17 P0: the graph box is MODEL-local like the nodes (toWorld); meadow / skycity copies sit far off the origin (meadow yaw 180), so
  *  the raw box made FreeOrbit.clearPose see the lens "outside" every frame and pull it to 0.8 m from her look point (the hat shot).
  *  Now the box corners go through toWorld (island: identity). Lakeside keeps no xz clamp.
  *  b17 skycity-walk-r2: the lens uses lensBox (baked floor extent) when the graph has one, else exploreBox. */
 private regionBounds():readonly [number,number,number,number]|undefined{
  if(this.region==='lakeside')return undefined;const G=stageGraph(this.region) as {exploreBox:readonly number[];lensBox?:readonly number[]},b=G.lensBox??G.exploreBox;
  const c=this.toWorld(this.region,[[b[0],0,b[1]],[b[2],0,b[1]],[b[0],0,b[3]],[b[2],0,b[3]]]);
  return [Math.min(c[0][0],c[1][0],c[2][0],c[3][0]),Math.min(c[0][2],c[1][2],c[2][2],c[3][2]),Math.max(c[0][0],c[1][0],c[2][0],c[3][0]),Math.max(c[0][2],c[1][2],c[2][2],c[3][2])];
 }
 /** r17 hard arm (lens → her look point) for the explore lens: [min, max] along the look ray. Whatever pulled it (clearPose boxes,
  *  a bad seed), the lens never sits in her hat nor 30 m out. */
 private clampArm(pose:Pose,min:number,max:number):Pose{
  const g=this.girl(),look=[g[0],g[1]+(ORBIT_LIMITS[this.orbit.place]?.lookM??1.15),g[2]],p=pose.position,v=[p[0]-look[0],p[1]-look[1],p[2]-look[2]],L=Math.hypot(v[0],v[1],v[2]);
  if(L>=min&&L<=max)return pose;
  let u=L>1e-4?[v[0]/L,v[1]/L,v[2]/L]:null;
  if(!u){const t=pose.target,d=[p[0]-t[0],p[1]-t[1],p[2]-t[2]],dl=Math.hypot(d[0],d[1],d[2])||1;u=[d[0]/dl,d[1]/dl,d[2]/dl];}
  const a=Math.max(min,Math.min(max,L)),np:[number,number,number]=[look[0]+u[0]*a,look[1]+u[1]*a,look[2]+u[2]*a];
  return {...pose,position:np};
 }
 /** AABB cache at 2.5 Hz, capped, so a drag does not walk every mesh on a 60 fps phone. */
 private refreshOrbitBoxes(g:Vec){
  const now=Date.now();if(now-this.orbitBoxAt<400&&this.orbitBoxes.length)return;
  this.orbitBoxAt=now;this.orbitBoxes.length=0;
  const scene=director.getScene();if(!scene)return;
  const ranked:{d:number;box:OrbitBox}[]=[];
  for(const r of scene.getComponentsInChildren(MeshRenderer)){
   if(!r.node.activeInHierarchy||r.node===this.markerNode||orbitColliderName(r.node.name)||!r.model?.worldBounds)continue;
   const b=r.model.worldBounds,c=b.center,h=b.halfExtents,span=Math.max(h.x,h.y,h.z)*2;
   if(span<0.3||span>14)continue;
   const d=Math.hypot(c.x-g[0],c.z-g[2]);if(d>28)continue;
   ranked.push({d,box:{min:[c.x-h.x,c.y-h.y,c.z-h.z],max:[c.x+h.x,c.y+h.y,c.z+h.z]}});
  }
  ranked.sort((a,b)=>a.d-b.d);
  const n=Math.min(32,ranked.length);
  for(let i=0;i<n;i++)this.orbitBoxes.push(ranked[i].box);
 }
 private lakesideOccluders():OccBox[]|null{
  if(this.region==='island'){if(!this.islandBoxes)this.islandBoxes=ISLAND_LENS_OCCLUDERS.map(r=>({min:[r[0],r[1],r[2]],max:[r[3],r[4],r[5]]}));return this.islandBoxes;}
  if(this.region==='skycity')return this.skycityOccluders();/* p0drag7 merge: union (cine + scene) set, 18 m cull, same LensGuard avoidance */
  if(this.region!=='lakeside')return null;const m=this.model(this.region);if(!m)return null;const now=Date.now();
  if(this.occBoxes&&this.occModel===m&&now-this.occAt<2000)return this.occBoxes;
  const W=m.worldMatrix,v=new Vec3(),src=new Vec3();
  const tw=(p:readonly number[]):[number,number,number]=>{src.set(p[0],p[1],p[2]);Vec3.transformMat4(v,src,W);return [v.x,v.y,v.z];};
  this.occBoxes=proxiesToWorld(LAKESIDE_LENS_OCCLUDERS,tw);this.deckZones=proxiesToWorld(LAKESIDE_DECK_ZONES,tw);this.occModel=m;this.occAt=now;return this.occBoxes;
 }
 /** P0 r16: on the boardwalk / arch bridge the lens keeps ≥ deckElevDeg (looks over the railings); 0 elsewhere. */
 private deckElev():number{
  if(this.region!=='lakeside'||!this.deckZones)return 0;const g=this.girl(),m=0.4;
  for(const z of this.deckZones)if(g[0]>=z.min[0]-m&&g[0]<=z.max[0]+m&&g[2]>=z.min[2]-m&&g[2]<=z.max[2]+m&&g[1]>=z.min[1]-0.5&&g[1]<=z.max[1]+0.5)return LENS_GUARD.deckElevDeg;
  return 0;
 }
 /** P0 r16 ①: explore opens on whatever lens the board exit left (on the lakeside often in a canopy, and nothing wrote the lens
  *  until she walked). Pick the clear orbit (yaw / pitch / arm nearest the seed whose designed lens has the lowest LensGuard
  *  cost), converge LensGuard on it, and glide there; MapExplore keeps writing through LensGuard while she stands. */
 private preSolveEntry(){
  if(this.region==='skycity'&&this.orbit.seeded){/* p0drag11: no LensGuard pre-solve on the frame boxes, but keep the entry glide (explore-arm A1: 40 m/s without it) */
   const from=this.readPose(),to=this.orbit.rawPose(this.girl()),d=Math.hypot(to.position[0]-from.position[0],to.position[1]-from.position[1],to.position[2]-from.position[2]);
   this.entry={from,t:0,T:Math.max(0.5,1.9*d/LENS_GUARD.entryGlideMS)};return;}
  const boxes=this.region==='skycity'?null:this.lakesideOccluders();if(!boxes||!this.orbit.seeded){this.entry=null;return;}/* p0drag11: skycity proxies are model-local frame boxes (LensGuard is world-AABB) and its lens avoids with outOfProxies */
  const o=this.orbit,her=this.girl(),y0=o.yaw,p0=o.pitch,d0=o.dist,R=d0+LENS_GUARD.nearM+LENS_GUARD.clearM+2;
  const near=boxes.filter(b=>{const ax=Math.max(b.min[0]-her[0],0,her[0]-b.max[0]),az=Math.max(b.min[2]-her[2],0,her[2]-b.max[2]);return ax*ax+az*az<=R*R;});
  const cur=this.readPose(),base={up:0,swing:0,share:1};let best:[number,number,number]=[y0,p0,d0],bc=1e9;
  const L=ORBIT_LIMITS[o.place],dl=Math.min(L.distMax,Math.max(L.distMin,9));
  for(let k=0;k<=12;k++)for(const sg of k?[1,-1]:[1])for(const pi of [p0,22,32,42])for(const di of [d0,dl]){
   o.yaw=y0+sg*k*30;o.pitch=Math.max(L.pitchMinDeg,Math.min(L.pitchMaxDeg,pi));o.dist=di;
   const rp=o.rawPose(her),q=rp.position,mv=Math.hypot(q[0]-cur.position[0],q[1]-cur.position[1],q[2]-cur.position[2]);
   const c=guardEval(rp,her,near,base).cost+0.02*k*30+0.04*Math.abs(o.pitch-p0)+0.3*Math.abs(di-d0)+0.8*mv;
   if(c<bc){bc=c;best=[o.yaw,o.pitch,o.dist];}}
  o.yaw=best[0];o.pitch=best[1];o.dist=best[2];
  this.lensPull.warm(o.rawPose(her),her,boxes,this.deckElev());
  const from=this.readPose(),to=this.lensPull.apply(o.rawPose(her),her,boxes,0,undefined,undefined,false,this.deckElev());
  const d=Math.hypot(to.position[0]-from.position[0],to.position[1]-from.position[1],to.position[2]-from.position[2]);
  this.entry={from,t:0,T:Math.max(0.5,1.9*d/LENS_GUARD.entryGlideMS)};
 }
 /** b17 skycity-walk-r2 (p0drag6): the sky houses / walls are merged meshes over the 14 m orbit-box cap, so the explore lens went
  *  into the blue-roof house east of S3. Model-local proxies (SkycityLensOccluders) -> world; only the ones within 18 m of her. */
 private skyAll:OccBox[]|null=null;private skyL:number[]|null=null;private skyModel:Node|null=null;private skyNear:OccBox[]=[];private skyNearAt=0;
 /** p0drag11 item 2 (Mac p0drag10 day nook: the walk ended at (11.8,8.2) with a grey pillar over the whole screen). At a skycity walk end:
  *  if the lens at her new spot is inside a box or her face / chest is hidden, turn the orbit to the nearest clear yaw (±15° steps to
  *  180°, same pitch / arm). The written lens does NOT jump: the smoother's yaw offset takes −Δ, so the eased offset (≤ yaw cap,
  *  critically damped) carries the lens round. Returns the turn or null. Test: test_p0drag11 Q2. */
 /** p0drag12 (Mac p0drag11 nook walk: the lens stood still at the hooked yaw/pitch for the whole 2–5 s walk, face/chest hidden ~2 s): a walk
  *  is the player's own input — it ends the QA-hook hold (like a drag), so avoidance swings while she walks. */
 walkStarted(region:StageRegion,path:unknown){this.qaHold=false;this.qaShot=null;this.walkAim=null;this.walkAimPitch=null;
  /* p0drag12 (r7 nook stop (11.4, 7.8): visible only from a ~100° yaw sector): the destination is known at walk start — aim the orbit
   * early at the nearest yaw from which she will be clear (and the lens out of every box) where she stops; avoidance rides on top */
  this.wplan=null;const p=path as readonly (readonly number[])[]|null;if(region!=='skycity'||!p||p.length<2||!this.orbit.seeded)return;
  this.planWalk?.(p);if(this.wplan)return;/* p0drag13: the plan replaces the orbit steer (and its pitch raise) */
  const w=this.toWorld(region,[p[p.length-1] as unknown as Vec])[0],p0=this.orbit.pitch;let ys:number[]=[],pa=p0;
  /* a low orbit may see nothing there (night stop (11.8, 8.2): 1 clear yaw at 12–15°) — then also raise the orbit, ≤ +24° */
  for(const dp of [0,8,16,24]){pa=Math.min(LENS_PITCH_MAX_DEG,p0+dp);ys=this.clearYaws(w,pa);if(ys.length>=18)break;}if(!ys.length)return;this.walkAimPitch=pa>p0+0.1?pa:null;
  const y0=this.orbit.yaw;let best=ys[0],bd=1e9;for(const y of ys){const d=Math.abs(wrapDeg(y-y0));if(d<bd){bd=d;best=y;}}
  /* into the sector: centre of the run that holds `best`, at most 30° past its edge */
  const inRun=(y:number)=>ys.some(q=>Math.abs(wrapDeg(q-y))<2.6);let a=best,b=best;while(inRun(a-5)&&Math.abs(wrapDeg(a-5-best))<180)a-=5;while(inRun(b+5)&&Math.abs(wrapDeg(b+5-best))<180)b+=5;
  const c=(a+b)/2,aim=Math.abs(wrapDeg(c-best))>60?best+60*Math.sign(wrapDeg(c-best)):c;this.walkAim=wrapDeg(aim);}
 /** Orbit yaws (5° steps) from which her chest/face at `g` are clear and the raw lens is outside every box (skycity). */
 clearYaws(g:readonly number[],pitch=this.orbit.pitch):number[]{
  const bx=this.skycityOccluders();if(!bx||!bx.length)return [];const O=this.orbit,y0=O.yaw,p0=O.pitch,look=this.lookAt(g as Vec),near=nearSphere(bx,look,O.dist+1),out:number[]=[];O.pitch=pitch;
  for(let y=0;y<360;y+=5){O.yaw=y;const q=O.rawPose(g as Vec).position;if(lensLevel(look,q,near,0)!==2&&!((o)=>o.face||o.chest)(herOcclusion(q,g as Vec,near)))out.push(y);}O.yaw=y0;O.pitch=p0;return out;}
 /** While walking: turn the orbit toward walkAim (eased, ≤ 45°/s) — the written lens follows through the smoother + no-entry guard. */
 steerWalk(dt:number){if(!this.groundWalking||!(dt>0))return;if(this.walkAimPitch!=null){const O=this.orbit,d=this.walkAimPitch-O.pitch;if(Math.abs(d)<0.2)this.walkAimPitch=null;else O.pitch+=Math.sign(d)*Math.min(Math.abs(d),3*Math.min(0.1,dt));}if(this.walkAim==null)return;const O=this.orbit,d=wrapDeg(this.walkAim-O.yaw);if(Math.abs(d)<0.5){this.walkAim=null;return;}
  const v=Math.sign(d)*Math.min(Math.abs(d),60*Math.min(0.1,dt),Math.max(6*Math.min(0.1,dt),Math.abs(d)*3*Math.min(0.1,dt)));O.yaw=wrapDeg(O.yaw+v);}
 /** p0drag13 (Mac p0drag12 ro at 12°: she is visible from one half of the circle only): the eased offset goes to its target the
  *  way that keeps her visible (and the lens out of boxes) — the long way round if the short way crosses the hidden half. 0 = short. */
 private visRoute(look:readonly number[],r:{yaw:number;el:number;arm:number},S:OffsetSmoother,ty:number,bx:OccBox[]|null):number{
  if(!bx||!bx.length||!S.live)return 0;const d=wrapDeg(ty-S.y);if(Math.abs(d)<20)return 0;const g=this.girl(),near=nearSphere(bx,look,r.arm+Math.abs(S.a)+1);
  const bad=(k:number)=>{const p=posOf(look,{yaw:r.yaw+S.y+k,el:r.el+S.e,arm:r.arm+S.a});return lensLevel(look,p,near,0)===2||((o)=>o.face||o.chest)(herOcclusion(p,g,near));};
  const blocked=(dir:number,span:number)=>{for(let k=10;k<span;k+=10)if(bad(dir*k))return true;return false;};
  const sd=Math.sign(d);if(!blocked(sd,Math.abs(d)))return 0;return blocked(-sd,360-Math.abs(d))?0:-sd;}
 /** p0drag13 (Mac p0drag12: automatic swing 379–507°/s; ro at 12° hidden 0.62 s): skycity yaw policy — the clear yaws about her
  *  (5° grid, lens at the player's own pitch/arm, outside every box, face+chest visible; refreshed when she moves / every 0.25 s).
  *  The player's yaw (and where his drag takes it in 0.4 s) clear → follow it (offset 0). Else stay in the clear run the lens is in,
  *  at the point nearest the player's yaw (it eases to the edge and waits there, never swings out and back). Lens hidden → the
  *  nearest clear yaw. The offset itself moves on the eased, capped smoother (≤ 90°/s, ≤ 240°/s²). */
 private sectorTarget(look:readonly number[],r:{yaw:number;el:number;arm:number},S:OffsetSmoother,g:readonly number[],bx:OccBox[]|null,dt:number):{ty:number;dir:number;route?:boolean;ta?:number}|null{
  /* the QA-hook hold keeps its yaw while the orbit stays put (p0drag10 Q2); once the player turns the orbit ≥ 2° away it ends, like a drag */
  if(this.qaHold){if(!Number.isFinite(this.secHoldY))this.secHoldY=r.yaw;if(Math.abs(wrapDeg(r.yaw-this.secHoldY))<2)return null;this.qaHold=false;}this.secHoldY=NaN;
  if(!bx||!bx.length||!S.live||this.groundWalking)return null;/* walking: the avoider (arm pull-in past walls) on the same eased cap */const now=(this.secT=(this.secT||0)+Math.max(0,Math.min(0.1,dt||0)));
  const C=this.secC;if(!C||now-C.t>0.25||Math.hypot(g[0]-C.g[0],g[2]-C.g[2])>0.6||Math.abs(r.el-C.el)>3||Math.abs(r.arm-C.arm)>0.5||C.w!==this.groundWalking){
   const near=nearSphere(bx,look,r.arm+1),ok:boolean[]=[],fre:boolean[]=[];
   /* walking: also where she will be in 0.5 s (her velocity) — the lens heads for yaws that stay clear, instead of chasing a sector that keeps moving */
   const pv=this.secPg,vt=pv&&now>pv.t?Math.min(3,0.5/(now-pv.t)):0,gA=pv&&this.groundWalking?[g[0]+(g[0]-pv.g[0])*vt,g[1],g[2]+(g[2]-pv.g[2])*vt]:null,dA=gA?[gA[0]-g[0],0,gA[2]-g[2]]:null;
   const okA:boolean[]=[];for(let i=0;i<72;i++){const p=posOf(look,{yaw:i*5,el:r.el,arm:r.arm});const fr=lensLevel(look,p,near,0.25)!==2;fre.push(fr);const v=fr&&!((o)=>o.face||o.chest)(herOcclusion(p,g as Vec,near));ok.push(v);
    okA.push(!gA||!v?v:!((o)=>o.face||o.chest)(herOcclusion([p[0]+dA![0],p[1],p[2]+dA![2]] as Vec,gA as Vec,near)));}
   if(okA.some((v,i)=>v&&okA[(i+71)%72]&&okA[(i+1)%72]))for(let i=0;i<72;i++)ok[i]=okA[i];
   this.secPg={t:now,g:[g[0],g[1],g[2]]};
   const er=ok.map((v,i)=>v&&ok[(i+71)%72]&&ok[(i+1)%72]);/* 5° margin *//* 5° margin each side */this.secC={t:now,g:[g[0],g[1],g[2]],el:r.el,arm:r.arm,ok:er,okr:ok,fr:fre,w:this.groundWalking};}
  const ok=this.secC!.ok,idx=(y:number)=>((Math.round(y/5)%72)+72)%72,clear=(y:number)=>ok[idx(y)];if(!ok.some(v=>v))return null;
  const ry=r.yaw,rate=Number.isFinite(this.secPy!)&&dt>0?wrapDeg(ry-this.secPy!)/dt:0;this.secPy=ry;
  const pred=ry+Math.max(-40,Math.min(40,rate*0.4)),cw=ry+S.y;
  const frr=this.secC!.fr,cost=(D:number)=>{let h=0;const n=Math.ceil(Math.abs(D)/5);for(let k=1;k<n;k++){const y=cw+Math.sign(D)*5*k;if(!frr[idx(y)])return 1e9;if(!clear(y))h+=5;}return h;};
  /* rejoin the player's yaw only along a way that stays out of boxes and hides her ≤ 30° (≈ 0.35 s at 90°/s); else wait in the lens's own clear run */
  if(clear(ry)&&clear(pred)){const D=wrapDeg(ry-cw);if(Math.abs(D)<7.5)return {ty:0,dir:0};const D2=D-360*Math.sign(D),c1=cost(D),c2=cost(D2);
   if(Math.min(c1,c2)<=30)return c1<=c2?{ty:0,dir:Math.abs(D)>=150?Math.sign(D):0,route:true}:{ty:0,dir:Math.sign(D2),route:true};
}
  const run=(y:number,dir:number)=>{let k=0;while(k<72&&clear(y+dir*5*(k+1)))k++;return k*5;};/* clear degrees from y going dir */
  /* lens on / in a box margin (p0drag10 ro after the walk: the avoider's target lay across the box → pinned 23 s): leave by the side
   * that gets out of the box first, then to the first yaw outside it from which she is seen (the visible-run rule takes it from there) */
  if(!this.secC!.fr[idx(cw)]){const fr=this.secC!.fr;let bestK=1e9,bestSd=0;
   let bestX=1e9;for(const sg of [1,-1]){let ex=0;for(let k=5;k<=180;k+=5){const y=cw+sg*k,f=fr[idx(y)];if(!f){if(ex)break;continue;}if(!ex)ex=k;if(this.secC!.okr[idx(y)]){if(ex<bestX||(ex===bestX&&k<bestK)){bestX=ex;bestK=k;bestSd=sg*k;}break;}}}/* the side that leaves the box first */
   return bestK<1e9?{ty:wrapDeg(S.y+bestSd),dir:0,route:true}:null;}
  /* p0drag13 (p0drag10 pock: lens on the 5° margin of a narrow visible run went the long way through the hidden band): while she is seen
   * (un-eroded set), move only INSIDE that visible run — to its nearest eroded-clear yaw, else the run's centre */
  if(!clear(cw)&&this.secC!.okr[idx(cw)]){const okr=this.secC!.okr,vis=(y:number)=>okr[idx(y)];let best:number|null=null;
   for(let k=5;k<=180&&best===null;k+=5)for(const sd of [k,-k]){let all=true;for(let q=5;q<=k;q+=5)if(!vis(cw+Math.sign(sd)*q)){all=false;break;}if(all&&clear(cw+sd)){best=sd;break;}}
   if(best===null){let lo=0,hi=0;while(lo<180&&vis(cw-lo-5))lo+=5;while(hi<180&&vis(cw+hi+5))hi+=5;best=(hi-lo)/2;}
   return {ty:wrapDeg(S.y+best),dir:0,route:true};}
  if(clear(cw))this.secSide=0;
  if(clear(cw)){const lo=cw-run(cw,-1),hi=cw+run(cw,1);/* the run holding the lens; nearest point of it to the player's yaw */
   const d=wrapDeg(pred-cw);let t=cw+d;{const m=Math.min(this.groundWalking?10:5,(hi-lo)/2);if(t>hi-m)t=hi-m;if(t<lo+m)t=lo+m;}if(hi-lo>=355)t=cw+d;return {ty:wrapDeg(S.y+t-cw),dir:Math.abs(t-cw)>170?Math.sign(t-cw):0};}/* stays inside the run: never the long way round */
  const fr=this.secC!.fr,free=(y:number)=>fr[idx(y)];let opn=[true,true];/* a direction ends at the first in-box pose (the no-entry guard would pin the lens there) */
  /* hysteresis: keep heading to the side chosen while she stays hidden (refreshed sectors flipped it: skn_pock1 1 s hidden) */
  const side=this.secSide,hit=(sg:number)=>{for(let k=5;k<=180;k+=5){const sd=sg*k;if(!free(cw+sd))return null;if(clear(cw+sd))return sd;}return null;};
  if(side){const sd=hit(side);if(sd!==null)return {ty:wrapDeg(S.y+sd+side*(clear(cw+sd+side*10)?10:clear(cw+sd+side*5)?5:0)),dir:0,route:true};}
  for(let k=5;k<=180;k+=5)for(const [j,sd] of [[0,k],[1,-k]] as [number,number][]){if(!opn[j])continue;if(!free(cw+sd)){opn[j]=false;continue;}if(clear(cw+sd)&&(this.secSide=Math.sign(sd),true))return {ty:wrapDeg(S.y+sd+Math.sign(sd)*(clear(cw+sd+Math.sign(sd)*10)?10:clear(cw+sd+Math.sign(sd)*5)?5:0)),dir:Math.abs(sd)>=150?Math.sign(sd):0,route:true};}
  for(let k=5;k<=180;k+=5)for(const sd of [k,-k])if(clear(cw+sd))return {ty:wrapDeg(S.y+sd),dir:0};return null;}
 /** p0drag13 walk plan (GGbot p0drag12: walk-start view jump + white pillar; nook walks hidden up to 3 s). Built at the tap, before she
  *  moves, from the real walk path: her look point every ~0.75 m along it (and the stop), the lens yaws (5° grid, the player's pitch/arm)
  *  that keep her face+chest clear and stay out of every box there. A DP picks ONE turning direction and a monotone yaw curve from the
  *  lens's yaw now through those sets (≤ 0.8 × 120°/s between samples at 1.2 m/s, the stop weighted ×3); the lens follows it by path
  *  progress, 0.35 s ahead, on the eased walk cap (≤ 120°/s, ≤ 300°/s²). A drag (orbit yaw moved ≥ 5°) drops the plan. */
 private planWalk(local:readonly (readonly number[])[]){this.wplan=null;
  const bx=this.skycityAllOccluders?.()??this.skycityOccluders();/* the whole route, not the 18 m set around her start */if(!bx||!bx.length||local.length<2||!this.orbit.seeded)return;
  const W=this.toWorld('skycity',local as unknown as Vec[]),O=this.orbit,g0=this.girl(),raw=sphOf(O.rawPose(g0).position,this.lookAt(g0));
  const pts:Vec[]=[W[0]],ss:number[]=[0];let acc=0;for(let i=1;i<W.length;i++){const L=Math.hypot(W[i][0]-W[i-1][0],W[i][2]-W[i-1][2]),m=Math.max(1,Math.ceil(L/0.5));
   for(let j=1;j<=m;j++){const t=j/m;pts.push([W[i-1][0]+(W[i][0]-W[i-1][0])*t,W[i-1][1]+(W[i][1]-W[i-1][1])*t,W[i-1][2]+(W[i][2]-W[i-1][2])*t] as Vec);ss.push(acc+L*t);}acc+=L;}/* every ≤ 0.75 m */
  const P=this.skyPrev,y0=P?P.yaw:raw.yaw,n=pts.length,G=72,STEP=5,maxU=270/STEP,AK=[1,0.8,0.62].filter(q=>raw.arm*q>=3.6),NA=AK.length;
  /* vis/free[k][a][j]: sample k, arm level a (pull-in past walls, as the avoider's armK), yaw y0 + 5j */
  const vis:boolean[][][]=[],fre:boolean[][][]=[];for(const q of pts){const look=this.lookAt(q),near=nearSphere(bx,look,raw.arm+1),V:boolean[][]=[],F:boolean[][]=[];
   for(const ak of AK){const v:boolean[]=[],f:boolean[]=[];for(let j=0;j<G;j++){const p=posOf(look,{yaw:y0+j*STEP,el:raw.el,arm:raw.arm*ak});const fr=lensLevel(look,p,near,0.25)!==2;f.push(fr);v.push(fr&&!((o)=>o.face||o.chest)(herOcclusion(p,q,near)));}V.push(v);F.push(f);}
   vis.push(V);fre.push(F);}
  const at=(d:number,u:number)=>((d*u)%G+G)%G,NS=(maxU+1)*NA;let best:{c:number;d:number;us:number[];as:number[]}|null=null;
  for(const d of [1,-1]){let C=new Array(NS).fill(Infinity);const B:number[][]=[];C[0]=0;/* state u·NA + a; start: lens yaw now, full arm */
   for(let k=0;k<n;k++){const dtk=k?(ss[k]-ss[k-1])/1.2:0,mx=k?Math.max(1,Math.floor(0.95*LENS_SMOOTH.yawWalkDegS*dtk/STEP)):0,N=new Array(NS).fill(Infinity),bk=new Array(NS).fill(0);
    for(let u=0;u<=maxU;u++)for(let a=0;a<NA;a++){let m=Infinity,bi=0;
     for(let a2=Math.max(0,a-(k?1:0));a2<=Math.min(NA-1,a+(k?1:0));a2++)for(let w=u;w>=Math.max(0,u-mx);w--){if(w<u&&(!fre[k][a][at(d,w)]||!fre[k-1][a2][at(d,w)]))break;/* the swept arc stays out of boxes */
      const c=C[w*NA+a2];if(c<m){m=c;bi=w*NA+a2;}}
     if(m===Infinity)continue;const j=at(d,u),wt=k===n-1?3:1;
     N[u*NA+a]=m+(fre[k][a][j]?0:50)+(vis[k][a][j]?0:wt*Math.max(0.2,dtk))+0.0005*(u-Math.floor(bi/NA))+0.02*a;bk[u*NA+a]=bi;}
    C=N;B.push(bk);}
   let e=0;for(let x=0;x<NS;x++)if(C[x]<C[e])e=x;const st:number[]=new Array(n);st[n-1]=e;for(let k=n-1;k>0;k--)st[k-1]=B[k][st[k]];
   if(!best||C[e]<best.c-1e-9)best={c:C[e],d,us:st.map(x=>Math.floor(x/NA)),as:st.map(x=>AK[x%NA])};}
  if(!best)return;this.wplan={pts,ss,ys:best.us.map(u=>y0+best!.d*u*STEP),as:best.as.map(q=>raw.arm*(q-1)),d:best.d,raw0:O.yaw,s:0};this.walkAim=null;this.walkAimPitch=null;}
 /** Walk-plan yaw target as an offset from the raw yaw (null = no plan / dropped). */
 private walkTarget(r:{yaw:number},S:OffsetSmoother,g:readonly number[]):{ty:number;dir:number;route?:boolean;ta?:number}|null{
  const W=this.wplan;if(!W||!this.groundWalking)return null;if(Math.abs(wrapDeg(this.orbit.yaw-W.raw0))>=5){this.wplan=null;return null;}
  let bs=W.s,bd=Infinity;for(let k=0;k+1<W.pts.length;k++){const a=W.pts[k],b=W.pts[k+1],vx=b[0]-a[0],vz=b[2]-a[2],L2=vx*vx+vz*vz||1e-9,t=Math.max(0,Math.min(1,((g[0]-a[0])*vx+(g[2]-a[2])*vz)/L2)),
   d=Math.hypot(a[0]+vx*t-g[0],a[2]+vz*t-g[2]),s=W.ss[k]+t*(W.ss[k+1]-W.ss[k]);if(d<bd-1e-6&&s>=W.s-0.5){bd=d;bs=s;}}W.s=Math.max(W.s,bs);
  const s=Math.min(W.ss[W.ss.length-1],W.s+1.2*0.35);let k=0;while(k+1<W.ss.length-1&&W.ss[k+1]<s)k++;
  const k2=Math.min(k+1,W.ss.length-1),f=k2===k?0:(s-W.ss[k])/((W.ss[k2]-W.ss[k])||1),y=W.ys[k]+(W.ys[k2]-W.ys[k])*f;
  const cw=r.yaw+S.y,D=wrapDeg(y-cw);/* the plan is monotone: never turn back against its direction by more than 2° */
  const step=Math.abs(D)<=2||Math.sign(D)===W.d?D:0,ta=Math.min(W.as[k],W.as[k2]);/* arm: the nearer of the two samples */return {ty:wrapDeg(S.y+step),dir:0,route:true,ta};}
 walkEndView(region:StageRegion):{from:number;to:number}|null{
  if(region!=='skycity'||!this.exploring||!this.orbit.seeded||!this.lensSmooth.live)return null;
  const bx=this.skycityOccluders();if(!bx||!bx.length)return null;
  const g=this.girl(),O=this.orbit,y0=O.yaw,look=this.lookAt(g),near=nearSphere(bx,look,O.dist+1);
  const bad=(y:number)=>{O.yaw=y;const p=O.rawPose(g).position;O.yaw=y0;return lensLevel(look,p,near,0)===2||((o)=>o.face||o.chest)(herOcclusion(p,g,near));};
  const cur=this.skyPrev?posOf(look,this.skyPrev):null;
  if(!bad(y0)&&!(cur&&(lensLevel(look,cur,near,0)===2||((o)=>o.face||o.chest)(herOcclusion(cur,g,near)))))return null;
  /* p0drag12: the eased turn goes round, never through a box — every 5° of the arc (raw lens at that yaw) must be outside */
  const arcIn=(sd:number)=>{for(let k=5;k<Math.abs(sd);k+=5){O.yaw=y0+Math.sign(sd)*k;const q=O.rawPose(g).position;O.yaw=y0;if(lensLevel(look,q,near,0)===2)return true;}return false;};
  for(let d=15;d<=180;d+=15)for(const sd of d===180?[d]:[d,-d]){if(bad(y0+sd)||arcIn(sd))continue;
   O.yaw=wrapDeg(y0+sd);this.lensSmooth.y-=sd;this.qaHold=false;this.walkEndT=1;/* the walk's end turn still runs on the walk cap */this.avoid={sw:0,e:0,tsw:0,te:0,clear:0,wait:0,py:NaN,k:1,tk:1,hidT:0};
   (globalThis as any).__qfWalkEndView={from:y0,to:O.yaw,at:g.slice()};return {from:y0,to:O.yaw};}
  return null;
 }
 /** Every skycity proxy (model-local frame boxes) — the walk plan looks along the whole route. */
 private skycityAllOccluders():OccBox[]|null{this.skycityOccluders();return this.skyAll??null;}
 private skycityOccluders():OccBox[]|null{
  const m=this.model('skycity');if(!m)return null;const now=Date.now();
  // p0drag11: the proxies stay MODEL-LOCAL and carry the world→local affine (LensAvoid FrameBox); every skycity test (avoid, no-entry,
  // camTrace occ) runs in that frame. World AABBs of the ~118°-yawed rows were up to 9× too big (Mac p0drag10 phantom occlusion).
  if(!this.skyAll||this.skyModel!==m){const I=new Mat4();Mat4.invert(I,m.worldMatrix);
   const l=[I.m00,I.m01,I.m02,I.m04,I.m05,I.m06,I.m08,I.m09,I.m10,I.m12,I.m13,I.m14];this.skyL=l;
   this.skyAll=SKYCITY_LENS_OCCLUDERS.map(r=>({min:[r[0],r[1],r[2]],max:[r[3],r[4],r[5]],l}) as FrameBox);this.skyModel=m;this.skyNearAt=0;}
  if(now-this.skyNearAt>=400){const g=toFrame(this.skyL!,this.girl());this.skyNearAt=now;
   this.skyNear=this.skyAll.filter(b=>Math.hypot(Math.max(b.min[0]-g[0],0,g[0]-b.max[0]),Math.max(b.min[2]-g[2],0,g[2]-b.max[2]))<18);}
  return this.skyNear;
 }
 /** Lakeside + island (b17r13): LensGuard keeps the walk lens off the proxies (look-ahead plan, speed/accel-capped spring, floor). */
 private occlude(pose:Pose,dt:number):Pose{
  let boxes=this.lakesideOccluders();if(!boxes||this.region==='skycity'){this.lensPull.reset();return pose;}/* p0drag9: skycity has ONE avoider (outOfProxies, swing-first, eased) — LensGuard's own climb/swing stacked on it (Mac sx2d: offset −78° yaw / +41° elevation) */
  if(this.region==='skycity'){const lk=this.lookAt(this.girl());boxes=nearSphere(boxes,lk,this.armOf(pose,lk)+1.5);}/* p0drag8 perf: 2112-box set → only boxes the lens orbit can touch */
  const r=this.lensPull.apply(pose,this.girl(),boxes,dt,undefined,undefined,this.orbit.engaged()&&(this.orbit.shouldWrite()||this.groundWalking),this.deckElev(),!this.groundWalking&&this.lens!=='FollowWalk');return {...pose,position:[r.position[0],r.position[1],r.position[2]],target:[r.target[0],r.target[1],r.target[2]]};
 }
 /** Held / blended-to follow lens (reward close-up): the planned clear pose, no spring (the blend is the ease). */
 private occludeHeld(pose:Pose):Pose{
  const proxies=this.lakesideOccluders();if(!proxies)return pose;
  // + the live scene's own renderer AABBs (≤ 14 m across, ≥ 0.5 m tall): props placed at runtime (signpost, palms, the r13b
  //   reward pillar) that no generated proxy knows about. Her own box contains her chest, so LensGuard skips it.
  const live=this.sceneBoxes().filter(b=>Math.max(b.max[0]-b.min[0],b.max[2]-b.min[2])<=14&&b.max[1]-b.min[1]>=0.5).map(b=>({min:[b.min[0],b.min[1],b.min[2]],max:[b.max[0],b.max[1],b.max[2]]}) as OccBox);
  const boxes=[...proxies,...live];
  const r=new LensGuard().solveStatic(pose,this.girl(),boxes);return {...pose,position:[r.position[0],r.position[1],r.position[2]],target:[r.target[0],r.target[1],r.target[2]]};
 }
 private writeOrbit(dt:number){
  /* p0drag11: the QA 'sign' shot is held as placed until a drag (from the text side every lens has her hidden by the island rocks, so the
   * occlusion guard would lift / pull it — Mac p0drag10 ended with the sign behind the lens); the drag glides back to the orbit (entry blend) */
  if(this.qaShot){if(this.qaHold){this.writePose(this.qaShot,false);return;}this.entry={from:this.qaShot,t:0,T:0.6};this.qaShot=null;}
  this.orbit.step(dt);this.steerWalk?.(dt);
  const g=this.girl();
  this.refreshOrbitBoxes(g);
  const A=LENS_GUARD;
  const raw=this.clampArm(this.orbit.solve(g,this.orbitBoxes,g[1],this.regionBounds()),A.armMinM,A.armMaxM);
  let pose=this.clampArm(this.occlude(this.guardOrbitGround(raw),dt),A.armHardM,Infinity);
  // p0drag7: no single-frame arm jumps (Mac trace_lake_walkdrag 203.6/205.7/207.9 s: clearPose flipped 9.1 ↔ 5.7 m with the yaw), then never inside a proxy
  const e=this.entry,look=this.lookAt(g);
  if(this.region==='skycity')pose=this.clampArm(pose,A.armMinM,Infinity);/* p0drag8: the 1.6 m floor never wins over 3.5 m here */
  pose=e?(this.armSmooth.reset(this.armOf(pose,look)),pose):this.armAlong(pose,look,this.armSmooth.step(this.armOf(pose,look),dt));
  pose=this.outOfProxies(pose,look,e?0:dt);
  // p0drag9 (Mac sx2d ro4→5 / ro9→10: LensGuard swing −30 → up 24 in ONE frame, pitch −31 → −54°, +1.8 m): skycity eases the whole
  // avoidance offset (LensGuard + proxies) about her look point — critically damped, elevation ≤ 22°/s, yaw ≤ 80°/s, arm ≤ 2.2 m/s.
  if(this.region==='skycity'){const r=sphOf(raw.position,look),q=sphOf(pose.position,look);
   const S=this.lensSmooth,cur=posOf(look,{yaw:r.yaw+S.y,el:r.el+S.e,arm:r.arm+S.a}),bx=this.lakesideOccluders();
   const P0=this.skyPrev,inBox=S.live&&!!bx&&bx.length>0&&lensLevel(look,this.groundWalking&&this.skyPrevW?this.skyPrevW:P0?posOf(look,P0):cur,nearSphere(bx,look,r.arm+S.a+1),0)===2;/* p0drag12: while walking, where the lens really was (her-relative is carried into walls → false ×insideBoost climbs) *//* p0drag10: judged on last frame's written lens (raw + old offset after a drag was inside while the lens was not → ×2.5 rate) */
   const wt=this.walkTarget?.(r,S,g)??null,sec=wt??this.sectorTarget?.(look,r,S,g,bx,e?0:dt)??null;S.capV=this.groundWalking||(this.walkEndT??0)>0?LENS_SMOOTH.yawWalkDegS:0;S.capA=S.capV?LENS_SMOOTH.yawWalkAccDegS2:0;this.walkEndT=Math.max(0,(this.walkEndT??0)-(e?0:dt));/* p0drag13: eased sector policy (null = avoider) */
   const ty=sec?sec.ty:wrapDeg(q.yaw-r.yaw),te=sec?0:q.el-r.el,ta=sec?(sec.ta??0):q.arm-r.arm,hid=!!P0&&!!bx&&bx.length>0&&((o)=>o.face||o.chest)(herOcclusion(posOf(look,P0),g,nearSphere(bx,look,r.arm+S.a+1))),dv=wrapDeg(ty-S.y),det=sec&&(sec.dir||sec.route)?sec.dir:(this.visRoute?.(look,r,S,ty,bx)??0)||(this.skyDetour&&hid&&Math.abs(dv)>20?this.skyDetour:0),ya=S.step(ty,te,ta,e?0:dt,inBox?LENS_SMOOTH.insideBoost:1,hid?LENS_SMOOTH.hiddenYawBoost:1,LENS_SMOOTH.boostLensMS*180/Math.PI/Math.max(1,(r.arm+S.a)*Math.cos(Math.min(80,Math.max(0,r.el+S.e))*Math.PI/180))/* arc speed on the horizontal circle */,det);let [y,el,a]=ya;
   let gy=y,ge=el;const P=this.skyPrev,near=bx&&bx.length?nearSphere(bx,look,r.arm+Math.max(0,a)+1):null;
   /* p0drag10 (Mac p0drag9 skxd ro/pock: 18–53 frames with the lens inside a house while the eased offset swept back through it): the
    * eased lens may never ENTER a box — if this frame's step would, keep last frame's yaw (world) and only ease the elevation, else
    * climb at the elevation cap, else hold last frame's lens. Leaving a box (last frame's lens inside) stays free; judged on last frame's WORLD lens, not raw + old offset (a drag moves the raw). */
   /* p0drag12 (Mac nook walk replay: lens carried 21–24 frames through an 11 m wall while she walked): "last frame's lens" is also judged
    * where it really was (world) — walking carries the her-relative lens into walls, which then counted as "leaving" and went unguarded */
   const W0=this.groundWalking&&this.skyPrevW&&Math.hypot(this.skyPrevW[0]-look[0],this.skyPrevW[1]-look[1],this.skyPrevW[2]-look[2])<=r.arm+Math.abs(S.a)+3?this.skyPrevW:null;
   const out0=!!P&&(lensLevel(look,posOf(look,P),near??[],0)!==2||(!!W0&&lensLevel(look,W0,near??[],0)!==2));
   if(near&&P&&!e&&out0&&lensLevel(look,posOf(look,{yaw:r.yaw+y,el:r.el+el,arm:r.arm+a}),near,0)===2){
    const py=wrapDeg(P.yaw-r.yaw),pe=P.el-r.el,cl=pe+LENS_SMOOTH.elevDegS*Math.min(0.1,dt>0?dt:0);
    const ok=(yy:number,ee:number)=>lensLevel(look,posOf(look,{yaw:r.yaw+yy,el:r.el+ee,arm:r.arm+a}),near,0)!==2;
    const cy=r.el+pe+LENS_SMOOTH.elevDegS*Math.min(0.1,dt>0?dt:0)<=LENS_PITCH_MAX_DEG?cl:pe,hold=Math.abs(py)<=LENS_SMOOTH.holdMaxDeg;
    /* world fallback: from last frame's real lens, step toward this frame's target, sliding along the box faces (axis by axis) */
    let ga=a,wsel:{yaw:number;el:number;arm:number}|null=null;
    if(W0){const D=posOf(look,{yaw:r.yaw+y,el:r.el+el,arm:r.arm+a}),mx=LENS_SMOOTH.boostLensMS*Math.min(0.1,dt>0?dt:0),v=[D[0]-W0[0],D[1]-W0[1],D[2]-W0[2]],n=Math.hypot(v[0],v[1],v[2]),k=n>mx?mx/n:1,hy=4.5*Math.min(0.1,dt>0?dt:0),u=[v[0]*k,Math.max(-hy,Math.min(hy,v[1]*k)),v[2]*k];/* height ≤ 4.5 m/s */
     const pl=[look[0]-W0[0],look[1]-W0[1],look[2]-W0[2]],pn=Math.hypot(pl[0],pl[1],pl[2])||1,pu=[pl[0]/pn*mx,Math.max(-hy,Math.min(hy,pl[1]/pn*mx)),pl[2]/pn*mx];/* pull in toward her look point (keeps the elevation) */
     for(const m of [[1,1,1],[1,0,1],[1,0,0],[0,0,1],[1,1,0],[0,1,1],[0,1,0],[2,2,2],[0,0,0]]){const P2=m[0]===2,c:[number,number,number]=P2?[W0[0]+pu[0],W0[1]+pu[1],W0[2]+pu[2]]:[W0[0]+u[0]*m[0],W0[1]+u[1]*m[1],W0[2]+u[2]*m[2]];
      const w=sphOf(c,look);if(w.arm<A.armMinM-0.01||Math.abs(w.el-P.el)>LENS_SMOOTH.elevDegS*Math.min(0.1,dt>0?dt:0)*0.9||lensLevel(look,c,near,0)===2)continue;wsel=w;break;}}
    if(ok(y,cy)){ge=cy;}else if(hold&&ok(py,el)){gy=py;}else if(hold&&ok(py,cy)){gy=py;ge=cy;}else if(wsel){gy=wrapDeg(wsel.yaw-r.yaw);ge=wsel.el-r.el;ga=wsel.arm-r.arm;}else{gy=py;ge=pe;}/* p0drag12 (L1 skn ro 12°: 4 frames in a house — an offset past holdMaxDeg went in): the last resort always keeps last frame's lens */
    if(gy!==y||ge!==el||ga!==a)S.pin(gy,ge,ga);a=ga;
    /* p0drag11 (replay skn ro: pinned 0.4 s against a wall while she was hidden): go round the other way */
    if(gy!==y&&hid&&!this.skyDetour)this.skyDetour=Math.sign(wrapDeg(ty-gy))>0?-1:1;}
   if(!hid&&this.skyDetour){this.skyDetour=0;if(true){const Av=this.avoid;Av.sw=Av.tsw=wrapDeg(gy);Av.clear=0;Av.wait=AVOID.searchEveryN;}}/* p0drag12 (r7 nook replay): a detour that shows her again stays there (walking) — heading back to the old target crossed the hidden band again */
   this.skyPrev={yaw:r.yaw+gy,el:r.el+ge,arm:r.arm+a};this.skyPrevW=posOf(look,this.skyPrev);
   if(sec||Math.abs(gy-ty)+Math.abs(ge-te)+Math.abs(a-ta)>1e-7)pose={...pose,position:posOf(look,{yaw:r.yaw+gy,el:r.el+ge,arm:r.arm>=A.armMinM?Math.max(A.armMinM,r.arm+a):r.arm+a})};}
  else{this.lensSmooth.clear();this.skyPrev=null;this.skyPrevW=null;this.skyDetour=0;}
  if(e){e.t+=Math.max(0,Math.min(0.1,dt||0));const u=Math.min(1,e.t/e.T),s=u*u*u*(u*(u*6-15)+10),L=(a:readonly number[],b:readonly number[])=>[a[0]+(b[0]-a[0])*s,a[1]+(b[1]-a[1])*s,a[2]+(b[2]-a[2])*s] as [number,number,number];
   pose={...pose,position:L(e.from.position,pose.position),target:L(e.from.target,pose.target)};if(u>=1)this.entry=null;}
  {const ft=frameHer(pose.position,pose.target,pose.fovVerticalDeg,g);if(ft!==pose.target)pose={...pose,target:ft as [number,number,number]};}/* p0drag9: her body inside the safe margins on all 7 screens */
  pose=this.clampPitch(pose,this.lookAt(this.girl()));
  /* p0drag9: framing first, then the pitch cap (it re-aims at her look point if it has to move anything) */
  (globalThis as any).__qfCamTraceSub?.(e?'orbit+entry':'orbit');
  this.writePose(pose,false);
 }
 private lookAt(g:Vec):[number,number,number]{return [g[0],g[1]+(ORBIT_LIMITS[this.orbit.place]?.lookM??1.15),g[2]];}
 private armOf(pose:Pose,look:readonly number[]):number{const p=pose.position;return Math.hypot(p[0]-look[0],p[1]-look[1],p[2]-look[2]);}
 private armAlong(pose:Pose,look:readonly number[],a:number):Pose{const p=pose.position,L=this.armOf(pose,look);if(L<1e-4||Math.abs(a-L)<1e-6)return pose;const k=a/L;
  return {...pose,position:[look[0]+(p[0]-look[0])*k,look[1]+(p[1]-look[1])*k,look[2]+(p[2]-look[2])*k]};}
 /** p0drag7 (Mac p0drag6 skycity east: lens in a house wall / single-colour frames): if the look→lens segment enters a proxy box (one
  *  that does not hold her look point), the lens stops OCC_FRONT_M in front of it. Skycity only (lakeside / island: LensGuard). */
 /** p0drag8 (Mac p0drag7 skycity east platform: lens 0.8 m on her head for 25 s, 0.8↔7.4 m single-frame jumps, pitch −68…−75°).
  *  Skycity: keep the arm (≥ armMinM); if a proxy blocks the look→lens segment, pick an avoidance offset (climb ≤ LENS_PITCH_MAX_DEG,
  *  then the least yaw swing ±90°) that is clear; sticky (the current offset is kept while it stays clear; going back to the raw
  *  pose needs AVOID.backN clear frames); the applied offset moves rate-limited (yaw / elevation °/s) — so a refreshed box set or a
  *  flicker of one box never makes a jump. No clear candidate: lens outside every box with partial occlusion; never a hat close-up. */
 private outOfProxies(pose:Pose,look:readonly number[],dt=0):Pose{
  const A=this.avoid;if(this.region!=='skycity'){A.sw=A.e=A.tsw=A.te=0;A.clear=0;return pose;}
  const boxes=this.lakesideOccluders();if(!boxes||!boxes.length){A.tsw=A.te=0;}
  const p=pose.position,d=[p[0]-look[0],p[1]-look[1],p[2]-look[2]],L=Math.max(LENS_GUARD.armMinM,Math.hypot(d[0],d[1],d[2]));
  const R=Math.PI/180,y0=Math.atan2(d[0],d[2]),e0=Math.asin(Math.max(-1,Math.min(1,d[1]/(Math.hypot(d[0],d[1],d[2])||1)))),eMax=LENS_PITCH_MAX_DEG*R;
  // p0drag9 (item 3): look ahead along the user's own turn (raw yaw rate × AVOID.aheadS) so avoidance starts before the raw lens reaches a wall
  const ydeg=y0/R,dts=Number.isFinite(dt)&&dt>0?Math.min(0.1,dt):0,rate=dts>0&&Number.isFinite(A.py)?wrapDeg(ydeg-A.py)/dts:0;if(dts>0)A.py=ydeg;/* p0drag10: dt = 0 writes do not eat the turn rate */
  const ah=Math.max(-AVOID.aheadMaxDeg,Math.min(AVOID.aheadMaxDeg,rate*AVOID.aheadS));
  if(!(A.k>0))A.k=1;if(!(A.tk>0))A.tk=1;
  // p0drag11: candidates may also pull the lens in (arm × k, never under the 3.5 m floor) — in front of the post / bush instead of around it
  const at=(sw:number,de:number,ahead=0,k=A.k):[number,number,number]=>{const y=y0+(sw+ahead)*R,e=Math.min(eMax,e0+de*R),Lk=Math.max(Math.min(L,AVOID.armFloorM),L*k);return [look[0]+Math.sin(y)*Math.cos(e)*Lk,look[1]+Math.sin(e)*Lk,look[2]+Math.cos(y)*Math.cos(e)*Lk];};
  if(boxes&&boxes.length){
   const near=nearSphere(boxes,look,L+1);/* p0drag8 perf: sphere of the lens orbit */
   const g=this.girl(),fc=[g[0],g[1]+1.45,g[2]],ch=[g[0],g[1]+1.05,g[2]];
   const lvl1=(q:readonly number[])=>{const v=lensLevel(look,q,near,0.25);return v!==0?v:((o)=>o.face||o.chest)(herOcclusion(q,g,near))?1:0;};/* p0drag11: the same test as the hidden timer (was a 0.1 m-shrunk sight line — said clear while she stayed hidden 3 s in replay p0drag9 R1) *//* p0drag11: face OR chest hidden counts (Mac measures each) *//* 0 clear, 1 lens outside but sight line blocked, 2 lens inside; p0drag10: the look line alone missed face+chest both hidden (Mac skxd 0.97–1.4 s runs) */
   const lvlAt=(sw:number,de:number,k=A.k)=>{const v=lvl1(at(sw,de,0,k));if(v===2||Math.abs(ah)<1)return v;const f=lvl1(at(sw,de,ah,k));return Math.max(v,f===2?2:f);};/* now, and where the player's drag takes it in aheadS: not inside a box — p0drag13: and her visible there too (anticipate: start the eased swing before she is hidden) */
   // p0drag10 (Mac skxd ro: the eased lens swept back to the clear raw THROUGH a house): a target is only taken if the arc from where
   // the lens is now (A.sw/A.e → sw, at the higher of the two elevations) keeps the lens out of every box
   const LS0=this.lensSmooth,S0=LS0.live?LS0.y:A.sw,E0=LS0.live?LS0.e:A.e,arc=(sw:number,de:number,kk=A.k)=>{const e=Math.max(de,E0),n=Math.ceil(Math.abs(sw-S0)/AVOID.stepDeg),km=Math.min(kk,A.k);
    for(let k=1;k<n;k++)if(lensLevel(look,at(S0+(sw-S0)*k/n,e,0,km),near,0)===2)return false;return true;};
   /* p0drag12 (r7 nook replay: lens swung back to the clear raw THROUGH the hidden band, 0.4–0.6 s hidden each way): going back to the
    * raw also needs her visible along the way (every stepDeg of the arc), else the current clear offset is kept */
   const arcVis=(sw:number)=>{const n=Math.ceil(Math.abs(sw-S0)/AVOID.stepDeg);for(let k=1;k<n;k++)if(lvl1(at(S0+(sw-S0)*k/n,Math.max(0,E0),0,A.k))!==0)return false;return true;};
   if(lvlAt(0,0,1)===0&&(A.tsw===0&&A.te===0&&A.tk===1||(arc(0,0,1)&&(!this.groundWalking||lvlAt(A.tsw,A.te,A.tk)!==0||arcVis(0))))){A.clear++;if(A.clear>=AVOID.backN||(A.tsw===0&&A.te===0&&A.tk===1)){A.tsw=0;A.te=0;A.tk=1;}}
   else{A.clear=0;
    if(A.wait>0)A.wait--;/* p0drag8 perf: hold the current target between full searches (≤ searchEveryN frames of partial occlusion) */
    else if(lvlAt(A.tsw,A.te,A.tk)!==0||(A.tsw===0&&A.te===0&&A.tk===1)||!arc(A.tsw,A.te,A.tk)){A.wait=AVOID.searchEveryN-1;let best:[number,number,number]|null=null,bestP:[number,number,number]|null=null,bestQ:[number,number,number]|null=null,bc=1e9;
     for(const sw of this.qaHold?[0]:AVOID.swings){if(Math.abs(sw)>90&&(A.hidT||0)<AVOID.armAfterS&&Math.abs(A.sw)<=90)continue;/* p0drag11: the wide swings (120–180°) only once she has been hidden > armAfterS */for(let de=sw?0:AVOID.stepDeg;e0*180/Math.PI+de<=LENS_PITCH_MAX_DEG+1e-6;de+=AVOID.stepDeg){
      for(const k of AVOID.armK){if(k<1&&(L*k<AVOID.armFloorM-1e-6||(A.hidT||0)<AVOID.armAfterS))continue;/* p0drag11: pull in only after she has been hidden > armAfterS */
      const v=lvlAt(sw,de,k),c=0.6*Math.abs(sw)+1.6*de+AVOID.armCost*(1-k)+/* p0drag9: prefer a swing to a steep climb */Math.abs(wrapDeg(sw-A.sw))*AVOID.stayW+Math.abs(de-A.e)*AVOID.stayW+Math.abs(k-A.k)*AVOID.armCost*AVOID.stayW/* p0drag9: stay near where the lens IS (no 180° sweep through walls) */;
      if(v===0&&c<bc&&arc(sw,de,k)){bc=c;best=[sw,de,k];}else if(v===1&&!bestP&&arc(sw,de,k))bestP=[sw,de,k];else if(v===1&&!bestQ)bestQ=[sw,de,k];}}}
     const pick=best??(lvlAt(0,0,1)!==2&&arc(0,0,1)?[0,0,1] as [number,number,number]:null)??bestP??bestQ;/* p0drag11: nothing clear → no detour at all (replay p0drag9 R1: a 30° climb held 3 s without ever showing her) *//* p0drag11: a partial pick must also keep a box-free arc (Mac/replay skn ro: pinned 0.4 s against a wall) */if(pick){A.tsw=pick[0];A.te=pick[1];A.tk=pick[2];}}}
  }
  const t=Number.isFinite(dt)&&dt>0?Math.min(0.1,dt):0,step=(c:number,g:number,r:number)=>c+Math.max(-r*t,Math.min(r*t,g-c));
  // p0drag8 (roots / house ground spot): while the swing is still passing through a box (lens inside), ×insideBoost — still continuous
  const kIn=boxes&&boxes.length&&lensLevel(look,at(A.sw,A.e),nearSphere(boxes,look,L+1),0)===2?AVOID.insideBoost:1;
  const g2=this.girl(),hid=kIn===1&&!!boxes&&boxes.length>0&&((o)=>o.face||o.chest)(herOcclusion(at(A.sw,A.e),g2,nearSphere(boxes,look,L+1)));A.hidT=hid?(A.hidT||0)+t:0;/* p0drag10: swing ×2 while she is hidden (yaw only) */
  A.sw=step(A.sw,A.tsw,AVOID.yawDegS*(hid?LENS_SMOOTH.hiddenYawBoost:kIn));/* the written lens speed is capped in LensSmooth (boostLensMS) */A.e=step(A.e,A.te,AVOID.elevDegS*kIn);A.k=step(A.k,A.tk,AVOID.armMS/Math.max(1,L));/* p0drag11: arm pull-in at ≤ armMS */
  return {...pose,position:at(A.sw,A.e)};
 }
 /** p0drag8: final written pose never looks down steeper than LENS_PITCH_MAX_DEG (lens elevation about her look point, and the view). */
 private clampPitch(pose:Pose,look:readonly number[]):Pose{
  const p=pose.position,d=[p[0]-look[0],p[1]-look[1],p[2]-look[2]],L=Math.hypot(d[0],d[1],d[2]),R=Math.PI/180;if(L<1e-4)return pose;
  const t=pose.target,v=[t[0]-p[0],t[1]-p[1],t[2]-p[2]],vl=Math.hypot(v[0],v[1],v[2])||1,vp=-Math.asin(Math.max(-1,Math.min(1,v[1]/vl)))/R;
  const e=Math.asin(Math.max(-1,Math.min(1,d[1]/L)))/R,over=Math.max(e-LENS_PITCH_MAX_DEG,vp-LENS_PITCH_MAX_DEG);if(over<=1e-6)return pose;
  const ne=(e-over)*R,h=Math.hypot(d[0],d[2])||1e-4,ux=h>1e-3?d[0]/h:0,uz=h>1e-3?d[2]/h:1;
  return {...pose,position:[look[0]+ux*Math.cos(ne)*L,look[1]+Math.sin(ne)*L,look[2]+uz*Math.cos(ne)*L],target:[look[0],look[1],look[2]]};
 }
 /** Sky stairs live in large merged meshes excluded from orbit AABBs. Sample from ABOVE the mesh,
  * so even a lens already below a tread (or returning from a cinematic) is lifted onto its top. */
 private guardOrbitGround(pose:Pose):Pose{
  if(this.region!=='skycity')return pose;
  const model=this.model(this.region);if(!model)return pose;
  const p=pose.position,dir=this.viewDir(pose),nearM=0.2;
  let y=p[1];
  const ray=new geometry.Ray();ray.d.set(0,-1,0);
  for(const r of model.getComponentsInChildren(MeshRenderer)){
   if(!r.enabled||!r.node.activeInHierarchy||!r.model?.worldBounds)continue;
   if(!/^(env_sky_(static_palette|static_rock_strata|ruins|floor_seal)|state_(bridge|court)_(before|after))$/.test(r.node.name))continue;
   const b=r.model.worldBounds,c=b.center,h=b.halfExtents;
   for(const offset of [0,nearM]){
    const x=p[0]+dir[0]*offset,z=p[2]+dir[2]*offset;
    if(x<c.x-h.x||x>c.x+h.x||z<c.z-h.z||z>c.z+h.z)continue;
    const top=c.y+h.y+1,distance=h.y*2+2;
    ray.o.set(x,top,z);
    const t=geometry.intersect.rayModel(ray,r.model,{mode:geometry.ERaycastMode.CLOSEST,distance,doubleSided:true});
    if(t>0&&t<=distance)y=Math.max(y,top-t+LENS_CLEAR_M+nearM);
   }
  }
  return y===p[1]?pose:{position:[p[0],y,p[2]],target:pose.target,fovVerticalDeg:pose.fovVerticalDeg};
 }
 /** Per-frame explore lens writer (the only one while explore is open; WorldFlow.settleOrbit stands down on exploreEnabled()). */
 private tickLens(dt:number){
  if(this.anim||this.holdPose||(this.lens!=='MapExplore'&&this.lens!=='FollowWalk'))return;
  if(this.orbit.shouldWrite()||(this.groundWalking&&this.orbit.seeded)||(this.entry&&this.orbit.seeded))this.writeOrbit(dt);
  else if(this.lens==='MapExplore'&&this.exploring&&this.orbit.seeded&&this.lakesideOccluders())this.writeOrbit(dt);
  else if(this.lens==='FollowWalk'&&this.exploring){const {w,h}=this.viewport();(globalThis as any).__qfCamTraceSub?.('follow');this.writePose(this.occlude(followPose(this.girl(),this.yaw(),w,h,followLookUp(this.region==='lakeside'?'island':this.region,99)),dt),false);}
 }
 private aimOrbit(gesture:'drag'|'pinch'|'release',x:number,y:number){
  const {w,h}=this.viewport(),g=this.girl();
  this.orbit.setPlace(this.region);
  if(!this.orbit.seeded)this.orbit.seed(this.readPose(),g);
  if(gesture==='release'){this.orbit.release();return;}
  if(gesture==='drag')this.qaHold=false;/* p0drag10: a manual drag ends the QA-hook hold (avoidance swings again) */
  const first=!this.orbit.shouldWrite()&&!this.entry,from=first?this.readPose():null;
  if(gesture==='pinch')this.orbit.pinch(x);
  else this.orbit.drag(x/Math.max(1,w),y/Math.max(1,h));
  // r17: the first drag takes over from whatever lens was on screen (far finale / board lens): glide, never cut
  if(from&&this.orbit.shouldWrite()){const q=this.orbit.rawPose(g).position,d=Math.hypot(q[0]-from.position[0],q[1]-from.position[1],q[2]-from.position[2]);if(d>0.3)this.entry={from,t:0,T:Math.min(3,Math.max(0.5,1.9*d/LENS_GUARD.entryGlideMS))};}
  this.writeOrbit(0);
 }
 openExplore(region:StageRegion,fromLens=false,snapped=false){
  this.region=region;this.exploring=true;this.lens='MapExplore';this.lensPull.reset();this.qaShot=null;this.focus=this.girl();this.zoom=1.6;this.armSmooth.clear();this.avoid={sw:0,e:0,tsw:0,te:0,clear:0,wait:0,py:NaN,k:1,tk:1};this.lensSmooth.clear();this.skyPrev=null;this.qaHold=false;
  this.handOrbitBack(region);
  /* p0drag7 (Mac p0drag6 skycity: she was snapped onto the nearest node, the lens stayed seeded on the board shot ~29 m away looking at
     the sky). After a snap: re-seat the orbit on her new spot (follow lens, as qaTeleport) and glide there from the shot on screen. */
  if(snapped){const g=this.girl(),{w,h}=this.viewport(),from=this.readPose();this.orbit.forget();this.orbit.setPlace(region);this.orbit.seed(followPose(g,this.yaw(),w,h,0),g);
   this.entry=null;if(this.lakesideOccluders())this.preSolveEntry();
   const to=this.orbit.rawPose(g),d=Math.hypot(to.position[0]-from.position[0],to.position[1]-from.position[1],to.position[2]-from.position[2]);
   this.entry=d>0.3?{from,t:0,T:Math.min(2.5,Math.max(0.5,1.9*d/LENS_GUARD.entryGlideMS))}:null;
   setExploreEnabled(true);emitTransitCue('explore-unlocked',{t:0,region});this.rebuildMarkers();return;}
  // board exit (and the lakeside): seed from the lens she already has, so opening explore never jumps the camera
  if(fromLens||region==='lakeside'){const g=this.girl();if(!this.orbit.seeded)this.orbit.seed(this.readPose(),g);}
  this.entry=null;if(!this.orbit.shouldWrite())this.preSolveEntry();
  else if(!this.orbit.shouldWrite()){const {w,h}=this.viewport();const g=this.girl();if(!this.orbit.seeded)this.orbit.seed(followPose(g,this.yaw(),w,h,0),g);this.writePose(this.orbit.rawPose(g),false);}
  setExploreEnabled(true);
  emitTransitCue('explore-unlocked',{t:0,region});
  this.rebuildMarkers();
 }

 /** QA frames only. The wechat player build constant-folds this body out (`MINIGAME`). */
 async frame(spec:{region?:RegionId;lens?:string;prop?:string}){
  if(MINIGAME)return;
  const region:RegionId=spec.region==='meadow'||spec.region==='skycity'?spec.region:'island';
  if(spec.lens==='board'){this.hideTree=false;this.holdPose=null;this.walkToken++;this.treeVisible(true);this.restoreBoard();return;}
  this.walkToken++;
  this.showWorld(region);
  this.hideTree=spec.lens==='finale'||spec.lens==='look';
  this.treeVisible(!this.hideTree);
  const nav=this.cover?.nav;if(nav)nav.active=false;
  const key=spec.lens==='finale'||spec.lens==='look'? (region==='skycity'?'S6':region==='meadow'?'M6':'I6') : (region==='meadow'?'M2':region==='skycity'?'S4':'I2');
  const nodes=REGION_NODES[region].nodes;
  const at=nodes.find(n=>n.key===key)?.at||nodes[0].at;
  const world=this.toWorld(region,[at])[0];
  if(spec.lens==='walk'){
   const edge=REGION_NODES[region].edges[0];
   const mid=this.toWorld(region,[edge.path[Math.floor(edge.path.length/2)]])[0];
   try{this.character?.cancelAndReset({kind:'standing',controllerRoot:[mid[0],mid[1],mid[2]],yawRad:0});}catch{/* pose only */}
  }else{
   try{this.character?.cancelAndReset({kind:'standing',controllerRoot:[world[0],world[1],world[2]],yawRad:0});}catch{/* pose only */}
  }
  try{this.character?.setVisible(true);}catch{/* optional */}
  const {w,h}=this.viewport();const g=this.girl();
  const follow=followPose(g,this.yaw(),w,h,region==='skycity'?8:0);
  let pose:Pose=follow;
  const lens=spec.lens||'';
  if(lens==='map'||lens==='tap')pose=mapPose(g,1.6,w,h);
  else if(lens==='finale'||lens==='look')pose=this.starPose(g,w,h);
  else if(lens==='prop')pose=this.propPose(spec.prop||SCENE_PROPS[region][0],g,w,h);
  else if(lens==='markers')pose=this.markerFrame(g);
  else if(lens==='blend'){
   const board:Pose={position:[follow.position[0],follow.position[1]+5,follow.position[2]+7],target:[g[0],g[1]+1,g[2]],fovVerticalDeg:48};
   pose=blendPose(board,follow,0.3,BLEND_S.boardToFollow);
  }
  const guarded=lens==='map'||lens==='tap'||lens==='markers';
  const applied=lens==='prop'&&(spec.prop||SCENE_PROPS[region][0])==='robot'?this.writePose(pose,true,PROP_CLEAR_M):this.writePose(pose,guarded);
  this.holdPose=lens==='prop'||lens==='finale'||lens==='look'?applied:null;
  if((globalThis as any).__qfCamTrace)this.traceFrame((globalThis as any).__qfCamTrace);
  if(this.hideTree){this.treeVisible(false);this.stripFinaleOccluders(applied);}
  this.lens=spec.lens==='map'||spec.lens==='tap'?'MapExplore':'FollowWalk';
  this.shotPhases={};
  const forced:Record<string,NodePhase>={};
  nodes.forEach((n,i)=>{forced[n.key]=i%3===0?'passed':i%3===1?'playable':'locked';});
  this.shotPhases=forced;
  if(spec.lens==='markers')this.markerClock=0.4;
  this.rebuildMarkers();
  if(spec.lens==='prop')this.pulse(spec.prop||SCENE_PROPS[region][0],region,true);
  if(spec.lens==='map'||spec.lens==='tap'){this.exploring=true;setExploreEnabled(true);}
  if(spec.lens==='tap'){
   const target=nodes.find(n=>this.phase(n.key)==='playable'&&n.key!==key);
   if(target)void this.walkTo(target.at);
  }
 }

 onGesture(gesture:Gesture,x:number,y:number){
  if(this.finaleArm&&(gesture==='drag'||gesture==='pinch'||gesture==='tap'))this.disarmFinale()/* T-02: the player took over */;
  const live=this.exploring&&!this.anim&&(this.lens==='MapExplore'||this.lens==='FollowWalk');
  if(!live){
   if(gesture==='tap'&&this.lens==='FollowWalk')this.skipWalk();
   return;
  }
  if(gesture==='drag'||gesture==='pinch'||gesture==='release'){this.dragHome=null;this.aimOrbit(gesture,x,y);return;}
  if(gesture!=='tap'||!this.camera)return;
  if(this.region==='lakeside'){this.groundTap(x,y);return;}
  const hits=this.projectNodes().filter(h=>Math.hypot(h.x-x,h.y-y)<=48);
  const id=pickMarker(hits.map(h=>({id:h.id,distancePt:Math.hypot(h.x-x,h.y-y),toGirl:h.toGirl})));
  const prop=this.projectProps().find(p=>Math.hypot(p.x-x,p.y-y)<=44);
  const tap=resolveTap({nodeId:id,nodePhase:id?this.phase(id):null,propId:prop?.id||null,groundM:prop||id?null:2,explore:true});
  if(!tap||tap.kind==='ground'){if(this.region==='meadow'||this.region==='skycity'||this.region==='island')this.groundTap(x,y);return;}
  if(tap.kind==='prop')this.pulse(tap.id,this.region);
  else if(tap.kind==='locked')emitTransitCue('node-locked-tap',{t:0,region:this.region,node:tap.id});
  else if(tap.walk&&this.ensureCharacter()){const node=stageGraph(this.region).nodes.find(n=>n.key===tap.id);if(node)void this.walkTo(node.at);}
 }
 /** RegionWalkable's model-local frame -> world. The island has no region model node: its walkable data is in world metres
  *  (docs/b16/walkable/API.md: island local = world), so identity. */
 private walkMatrix(region:StageRegion):Mat4|null{if(region==='island')return new Mat4();const model=this.model(region);return model?model.worldMatrix.clone():null;}
 /** Ground tap (island / meadow / skycity / lakeside): screen ray onto the baked walkable area (RegionWalkable). Water, walls, the
  *  other shore or no hit = no walk (cue only). __qfGroundTap keeps the last answer for QA. */
 groundTap(x:number,y:number){
  const region=this.region;
  const cam=this.camera,m=this.walkMatrix(region);if(!cam||!m||!this.ensureCharacter()||this.groundWalking)return;
  const ray=new geometry.Ray();cam.screenPointToRay(x,y,ray);
  const inv=new Mat4();Mat4.invert(inv,m);
  const o=new Vec3(),e=new Vec3();Vec3.transformMat4(o,ray.o,inv);Vec3.add(e,ray.o,ray.d);Vec3.transformMat4(e,e,inv);
  // b17 skycity-walk-r4 方案 C: her position lets a tap on the scene stop her on her side of it (fence / pocket), not 15 m round
  const gw=this.girl(),gl=new Vec3();Vec3.transformMat4(gl,new Vec3(gw[0],gw[1],gw[2]),inv);
  const hit=walkRayHit(region,[o.x,o.y,o.z],[e.x-o.x,e.y-o.y,e.z-o.z],160,.05,[gl.x,gl.y,gl.z]);
  (globalThis as any).__qfGroundTap={region,kind:hit.kind,at:hit.kind==='none'?null:hit.at,t:Date.now(),...(qaHooksEnabled()?qaFirstRenderHit(ray):{})};
  if(hit.kind!=='walk'){emitTransitCue('scene-tap',{t:0,region,id:hit.kind==='water'?'water':'none'});return;}
  // r7: leaves / a planter / a pillar right by her: she stays exactly where she is (no snap onto her cell)
  if(hit.stay){(globalThis as any).__qfGroundTap={...(globalThis as any).__qfGroundTap,path:0,lengthM:0,stay:true};return;}
  void this.groundWalkTo(region,hit.at);
 }
 private async groundWalkTo(region:StageRegion,at:WVec){
  const m=this.walkMatrix(region);if(!m||!this.ensureCharacter())return;
  const inv=new Mat4();Mat4.invert(inv,m);
  const gw=this.girl(),g=new Vec3();Vec3.transformMat4(g,new Vec3(gw[0],gw[1],gw[2]),inv);
  const from=nearestWalkable(region,[g.x,g.y,g.z],1.6);if(!from)return;
  const local=walkTapPath(region,from.at,at);
  (globalThis as any).__qfGroundTap={...((globalThis as any).__qfGroundTap||{}),path:local?local.length:0,lengthM:local?+walkPathLengthM(local).toFixed(2):0};
  if(!local||local.length<2)return;
  const path=this.toWorld(region,local as unknown as Vec[]),dest=path[path.length-1],L=walkPathLengthM(local),duration=Math.max(.4,L/1.2);
  // lens stays MapExplore: the seeded orbit follows her feet (update), no cut to the follow lens
  const token=this.walkToken;this.groundWalking=true;this.walkStarted(region,local);
  const end=path[path.length-2],yaw=Math.atan2(dest[0]-end[0],dest[2]-end[2]);
  try{await performBounded(this.character,{kind:'walk',path,duration},dest,yaw,duration*1000+4000,()=>token===this.walkToken,t=>{this.walkCancel=()=>{try{t.cancel();}catch{/* done */}};});}
  finally{if(token===this.walkToken){this.groundWalking=false;this.walkCancel=null;}}
  if(token!==this.walkToken)return;
  this.walkEndView(region);
  this.lens='MapExplore';this.focus=this.girl();
 }
 /** Poll (4 Hz): leaving a meadow / skycity / lakeside board (暂停 →「离开棋盘」/ result → exitLevel lands in that region) opens
  *  free explore there, seeded from the current lens; leaving the region closes it. Arrival / landing / transit shots are never
  *  touched (a region is armed only after one of its boards was open). Explore opened elsewhere (sky finale) is never closed here. */
 private syncExplore(dt:number){
  this.exploreCheck+=dt;if(this.exploreCheck<.25)return;this.exploreCheck=0;
  let s:any=null;try{s=this.flow()?.commands().snapshot();}catch{s=null;}
  for(const r of EXIT_EXPLORE_REGIONS)this.exploreArmed[r]=exploreArm(r,this.explorePrev,s,!!this.exploreArmed[r]);
  this.explorePrev=s?.state??null;
  if(this.syncOpened&&!exploreWanted(this.syncOpened,s)){
   const r=this.syncOpened;this.syncOpened=null;this.exploreArmed[r]=false;(globalThis as any).__qfExploreSync={region:r,open:false,at:Date.now()};
   this.releaseSyncCams();
   if(this.region===r&&!this.cover&&this.exploring){this.walkToken++;this.exploring=false;this.lens='Board';setExploreEnabled(false);this.orbit.forget();}
   return;
  }
  if(this.syncOpened||this.cover||this.anim||!this.ensureCharacter()||!this.camera)return;
  for(const r of EXIT_EXPLORE_REGIONS){
   if(!this.exploreArmed[r]||!exploreWanted(r,s)||(r==='island'?!s?.characterReady:!this.model(r)?.activeInHierarchy))continue;
   this.syncOpened=r;if(this.region!==r)this.orbit.forget();const shot=this.takeSyncView(r);if(shot)this.writePose(shot,false);const snapped=this.standOnWalk(r);this.openExplore(r,true,snapped);(globalThis as any).__qfExploreSync={region:r,open:true,at:Date.now()};return;
  }
 }
 /** p0d5sky (Mac r16d ?qfSkip=skycity-finale): explore opened with her 12.6 m off the skycity plateau (walk-local -18,1,57), so
  *  every ground ray missed the walkable grid (kind=none). Off the region's walkable area (> 1.6 m) = stand her on the nearest node. */
 private standOnWalk(region:StageRegion):boolean{try{return this.standOnWalkOrThrow(region);}catch{return false;/* lens only */}}
 private standOnWalkOrThrow(region:StageRegion):boolean{
  const nodes=(REGION_NODES as any)[region]?.nodes as {key:string;at:readonly number[]}[]|undefined,m=this.walkMatrix(region);if(!nodes||!m||this.character==null)return false;
  const inv=new Mat4();Mat4.invert(inv,m);const g=this.girl(),v=new Vec3();Vec3.transformMat4(v,new Vec3(g[0],g[1],g[2]),inv);
  if(nearestWalkable(region as any,[v.x,v.y,v.z],1.6))return false;
  let best=nodes[0],bd=Infinity;for(const n of nodes){const d=Math.hypot(n.at[0]-v.x,n.at[2]-v.z);if(d<bd){bd=d;best=n;}}
  this.standAt(region,best.at);return true;
 }
 private standAt(region:StageRegion,at:readonly number[]){
  const w=this.toWorld(region,[[at[0],at[1],at[2]]])[0];try{this.character?.cancelAndReset({kind:'standing',controllerRoot:[w[0],w[1],w[2]],yawRad:0});}catch{/* pose only */}
 }
 /** Test-only (registered only when ?qfSkip=… is allowed, see QaSkip): __qfTeleport('S3') stands her on that node of the open explore region. */
 qaTeleport(key:string,yawDeg?:number,pitchDeg?:number):{ok:boolean;reason?:string;region?:string;at?:readonly number[];yaw?:number;pitch?:number}{
  const region=this.region;if(!this.exploring)return {ok:false,reason:'explore-not-open'};
  const nodes=((REGION_NODES as any)[region]?.nodes as {key:string;at:readonly number[]}[]|undefined)??[];
  // p0drag8: 'sign' = island, the node nearest the return signpost (p0drag10: lens on the sign's text side, see below)
  const sp=ISLAND_PROPS.signpost.position,sign=key==='sign';if(sign&&region!=='island')return {ok:false,reason:'sign-is-on-island'};
  let n=sign?nodes.slice().sort((a,b)=>Math.hypot(a.at[0]-sp[0],a.at[2]-sp[2])-Math.hypot(b.at[0]-sp[0],b.at[2]-sp[2]))[0]:nodes.find(x=>x.key===key);
  // p0drag11 (Mac p0drag10: tpSign yaw 4.6°, the sign BEHIND the lens): spot + yaw + arm from the sign's front-face normal, judged in world
  // space on the orbit's own raw pose: lens ≥ 1.5 m in front of the panel, text ≤ 60° off, whole sign on screen, her sight line clear of it
  let sv:ReturnType<typeof signFrontView>=null,shot:ReturnType<typeof signShot>=null;
  if(sign&&nodes.length){const {w,h}=this.viewport(),O=this.orbit,keep=[O.yaw,O.pitch,O.dist],W=nodes.map(x=>this.toWorld('island',[[x.at[0],x.at[1],x.at[2]]])[0]);
   O.forget();O.setPlace('island');O.pitch=12;
   sv=signFrontView(nodes.length,(i,y,p,d)=>{O.yaw=y;O.pitch=p;O.dist=d;return O.rawPose(W[i]) as any;},[5,9,13,17,21,25],[12,10,8,6],w,h);
   [O.yaw,O.pitch,O.dist]=keep;if(sv)n=nodes[sv.i];
   /* p0drag12 (Mac p0drag11: sign 5.5 m away, left side cropped, she not in frame): her AND the whole sign on all 7 portrait screens needs
    * a ~26 m arm (QA shot only, held until a drag) — signShot (region/SignShot.ts). Test: test_p0drag12 S1. */
   shot=signShot(W,this.lakesideOccluders()??[],ORBIT_LIMITS.island.fovDeg,{textOnly:true,minClearM:1.1});/* p0drag13 option B: her + text panel only, 26.4 → 17.9 m */if(shot)n=nodes[shot.i];}
  if(!n)return {ok:false,reason:'no-node-'+key+'-in-'+region};
  /* p0drag11 (Mac p0drag10: night po stood at (8.77,8.14), the walk before the teleport still ran and re-stood her at its end): a teleport
   * always ends the walk — new token (the walk's end-of-segment re-stand and lens hand-off are skipped), its Cancellation fired, flag off */
  this.walkToken++;const wc=this.walkCancel;this.walkCancel=null;this.groundWalking=false;if(wc)wc();(globalThis as any).__qfGroundTap=null;
  this.standAt(region,n.at);const {w,h}=this.viewport(),g=this.girl();
  this.orbit.forget();this.orbit.setPlace(region);this.orbit.seed(followPose(g,this.yaw(),w,h,0),g);this.entry=null;
  // p0drag10 (Mac p0drag9: the 'sign' shot looked from her side at the panel's BACK, 继续旅程 mirrored): the sign faces the sea (GLB front
  // = +Z turned by signpost.yawDeg; every walkable island spot is 7.9–24 m BEHIND its front plane), so the lens goes past the sign along
  // her→sign at the 12 m orbit cap: it is then on the text side (front) looking back over the panel at her. Test: test_p0drag10 Q3.
  if(sign&&sv&&!shot){yawDeg=yawDeg??sv.yaw;pitchDeg=pitchDeg??sv.pitch;this.orbit.dist=sv.dist;}
  else if(sign){const sw=this.toWorld('island',[[sp[0],sp[1],sp[2]]])[0];yawDeg=yawDeg??qaYawFacing(sw,g);pitchDeg=pitchDeg??12;this.orbit.dist=ORBIT_LIMITS.island.distMax;}
  if(sign&&shot&&yawDeg===undefined){const P=shot.position;yawDeg=Math.atan2(P[0]-g[0],P[2]-g[2])*180/Math.PI;pitchDeg=pitchDeg??20;}
  this.qaOrbit(yawDeg,pitchDeg);let p0:Pose=this.orbit.rawPose(g);if(sign&&shot){p0={position:[...shot.position] as any,target:[...shot.target] as any,fovVerticalDeg:shot.fovVerticalDeg};this.qaShot=p0;}
  else if(sign&&sv&&yawDeg===sv.yaw){const lk=this.lookAt(g);p0={...p0,target:[lk[0]+sv.aim[0],lk[1]+sv.aim[1],lk[2]+sv.aim[2]]};this.qaShot=p0;}/* the view on the text centre, held until a drag */this.writePose(p0,false);
  return {ok:true,region,at:n.at,yaw:this.orbit.yaw,pitch:this.orbit.pitch,...(shot?{signShot:{armM:+shot.armM.toFixed(1),textDeg:+shot.textDeg.toFixed(1),minTextPx:+shot.minTextPx.toFixed(1)}}:{}),...(sv&&!shot?{signView:{dist:sv.dist,pitch:sv.pitch,frontM:+sv.frontM.toFixed(2),textDeg:+sv.textDeg.toFixed(1)}}:{})} as any;
 }
 /** Test-only (?qfSkip gate): turn the explore lens so the named scene node sits in front of it (lens on the far side of her). */
 /** Test-only (qfSkip / qfHooks gate): turn the explore lens so a world point sits beyond her in the middle of the view (lens on the far
  *  side of her). `at` = a scene node name, or WORLD coordinates [x,y,z] / {x,y,z} (metres, same space as camTrace cam/her). */
 qaAimAt(at:string|readonly number[]|{x:number;y:number;z:number}):{ok:boolean;reason?:string;yaw?:number;pitch?:number;point?:number[]}{
  if(!this.exploring)return {ok:false,reason:'explore-not-open'};let p:number[]|null=null;
  if(typeof at==='string'){const find=(n:any):any=>{if(!n)return null;if(n.name===at)return n;for(const c of n.children??[]){const r=find(c);if(r)return r;}return null;};
   const t=find(director.getScene());if(!t)return {ok:false,reason:'no-node-'+at};p=[t.worldPosition.x,t.worldPosition.y,t.worldPosition.z];}
  else if(Array.isArray(at)&&at.length>=3)p=[+at[0],+at[1],+at[2]];else if(at&&typeof at==='object'&&'x' in (at as any))p=[(at as any).x,(at as any).y,(at as any).z];
  if(!p||!p.every(Number.isFinite))return {ok:false,reason:'bad-point'};const g=this.girl();
  this.qaOrbit(qaYawFacing(g,p),12);this.writePose(this.orbit.rawPose(g),false);
  return {ok:true,yaw:this.orbit.yaw,pitch:this.orbit.pitch,point:p};
 }
 /** yaw / pitch in the FreeOrbit convention = camTrace `yaw` / −camTrace `pitch` (see QaSkip.ts qaYawFacing). p0drag9: the orbit is then
  *  ENGAGED (free, not held) like after a drag — before, it stayed un-engaged and the follow lens overwrote the yaw next frame. */
 private qaOrbit(yawDeg?:number,pitchDeg?:number){const L=ORBIT_LIMITS[this.orbit.place];
  if(Number.isFinite(yawDeg))this.orbit.yaw=yawDeg!;if(Number.isFinite(pitchDeg))this.orbit.pitch=Math.max(L?.pitchMinDeg??5,Math.min(L?.pitchMaxDeg??58,pitchDeg!));
  this.orbit.drag(0,0);this.orbit.release();this.lensSmooth.clear();this.skyPrev=null;this.skyPrevW=null;this.avoid={sw:0,e:0,tsw:0,te:0,clear:0,wait:0,py:NaN,k:1,tk:1};
  this.qaHold=true;this.qaShot=null;/* p0drag10 (Mac p0drag9: aimed −160° drifted to −135° and on — the avoidance swing eased in): the hooked yaw sticks; avoidance may only climb until a manual drag */}

 /** p0drag5 (Mac fc742aa2: lakeside explore = fixed wide shot until a ground tap). Leaving a board opens explore by poll, but the
  *  board's own live background camera (LakesideBackgroundCamera, priority 44, fixed) kept drawing over the stage camera; only the
  *  ground tap's cover switched it off, so the follow/orbit lens became visible only then. Switch those cameras off here and hand
  *  their pose to the stage camera, so the entry glide starts from the shot on screen (no cut). Returns that pose, or null. */
 private takeSyncView(region:StageRegion):Pose|null{
  this.releaseSyncCams();const scene=director.getScene();if(!scene)return null;let shot:Pose|null=null;
  // p0drag5b: only THIS region's background camera(s); other regions' cameras are their owners' business
  const name=region==='lakeside'?'LakesideBackgroundCamera':region==='meadow'?'MeadowBackgroundCamera':region==='skycity'?'SkycityBackgroundCamera':null;
  if(!name)return null;const model=this.model(region);
  for(const c of scene.getComponentsInChildren(Camera)){
   if(c===this.camera||!(c.enabled||bgCamHeld(c)&&bgCamWanted(c))||!c.node?.activeInHierarchy||c.node.name!==name)continue;
   if(!shot){const p=c.node.worldPosition,f=c.node.forward;shot={position:[p.x,p.y,p.z],target:[p.x+f.x*10,p.y+f.y*10,p.z+f.z*10],fovVerticalDeg:c.fov};}
   bgCamHold(c);this.syncCams.push({cam:c,region,model});
  }
  return shot;
 }
 /** Drop explore's hold. Re-enable only if the owner still wants the camera visible (bgCamWant, its setVisible is the truth) and
  *  we are still in the same region instance; otherwise the hold is dropped and the owner's next setVisible decides. */
 private releaseSyncCams(){for(const e of this.syncCams.splice(0))bgCamRelease(e.cam,this.region===e.region&&this.model(e.region)===e.model);}
 private skipWalk(){/* a tap during FollowWalk is swallowed until the segment timeout cuts it */}
 private async walkTo(at:Vec){
  if(!this.character)return;
  const token=this.walkToken;
  const from=this.girl();
  const dest=this.toWorld(this.region,[at])[0];
  const path=[from,dest] as [Vec,Vec];
  this.lens='FollowWalk';
  await performBounded(this.character,{kind:'walk',path,duration:Math.max(0.4,Math.hypot(dest[0]-from[0],dest[2]-from[2])/1.2)},dest,0,undefined,()=>token===this.walkToken);
  if(token!==this.walkToken)return;
  this.lens='MapExplore';
  this.focus=this.girl();
  if(!this.orbit.shouldWrite()){const {w,h}=this.viewport();const g=this.focus;if(!this.orbit.seeded)this.orbit.seed(followPose(g,this.yaw(),w,h,0),g);this.writePose(this.orbit.rawPose(g),false);}
 }
 private markerFrame(g:Vec):Pose{
  const nodes=stageGraph(this.region).nodes;
  const world=nodes.slice(0,3).map(n=>this.toWorld(this.region,[n.at])[0]);
  while(world.length<3)world.push(g);
  return markersLook(world[0],world[1],world[2]);
 }

 pulse(id:string,region:StageRegion,hold=false){
  const name=id==='robot'?'anchor_robot_root':PROP_NODES[id];if(!name)return;
  const nodes:Node[]=[];findAll(director.getScene(),name,nodes);
  const live=nodes.filter(n=>n.activeInHierarchy);
  const fb=propFeedback(id);
  for(const node of (live.length?live:nodes)){
   const s=node.scale,e=node.eulerAngles;
   this.pulses.push({node,sx:s.x,sy:s.y,sz:s.z,ey:e.y,left:fb.seconds,motion:fb.motion});
  }
  if(id==='robot'&&!hold){const rig=director.getScene()?.getComponentInChildren(SkycityRobotInteract);try{rig?.playGesture?.('robot_give_flower');}catch{/* clip optional */}}
  if(hold)this.holdPulse=0.85;
  emitTransitCue('scene-tap',{t:0,region,id});
  const hook=(globalThis as any).__worldIntegration;if(typeof hook?.onSceneTap==='function')hook.onSceneTap(id);
 }
 private phase(id:string):NodePhase{
  if(this.shotPhases&&this.shotPhases[id])return this.shotPhases[id];
  return derive({completed:this.completed},null).nodes[id]||'locked';
 }
 private projectNodes(){
  const cam=this.camera;if(!cam)return [] as {id:string;x:number;y:number;toGirl:number}[];
  const g=this.girl(),out=new Vec3(),list=stageGraph(this.region).nodes;
  const hits:{id:string;x:number;y:number;toGirl:number}[]=[];
  for(const n of list){const w=this.toWorld(this.region,[n.at])[0];cam.worldToScreen(new Vec3(w[0],w[1]+0.8,w[2]),out);
   hits.push({id:n.key,x:out.x,y:out.y,toGirl:Math.hypot(w[0]-g[0],w[2]-g[2])});}
  return hits;
 }
 private projectProps(){
  const cam=this.camera;if(!cam)return [] as {id:string;x:number;y:number}[];
  const out=new Vec3(),hits:{id:string;x:number;y:number}[]=[];
  for(const id of SCENE_PROPS[this.region]){const name=PROP_NODES[id];const nodes:Node[]=[];findAll(director.getScene(),name,nodes);
   const node=nodes.find(n=>n.activeInHierarchy)||nodes[0];if(!node)continue;cam.worldToScreen(node.worldPosition,out);hits.push({id,x:out.x,y:out.y});}
  return hits;
 }
 private rebuildMarkers(){
  if(this.region==='lakeside'){if(this.markerNode)this.markerNode.active=false;return;}
  if(this.lens!=='FollowWalk'&&this.lens!=='MapExplore'&&this.lens!=='BoardToFollow'&&this.lens!=='FollowToBoard'){if(this.markerNode)this.markerNode.active=false;return;}
  const scene=director.getScene();if(!scene)return;
  if(!this.markerNode?.isValid){
   const n=new Node('RegionNodeMarkers');scene.addChild(n);const r=n.addComponent(MeshRenderer);
   const mat=new Material();mat.initialize({effectName:'builtin-unlit',technique:0,defines:{USE_VERTEX_COLOR:true}});mat.setProperty('mainColor',new Color(255,255,255,255));
   r.setMaterial(mat,0);this.markerNode=n;
  }
  try{this.paintMarkers();}catch(error){console.warn('region-markers',error);}
 }
 private paintMarkers(){
  const scene=director.getScene();if(!scene||!this.markerNode)return;
  this.markerNode.active=true;
  const positions:number[]=[],normals:number[]=[],colors:number[]=[],indices:number[]=[];
  const nodes=stageGraph(this.region).nodes;
   const pushGem=(at:Vec,phase:NodePhase,foot=false)=>{
   const gem=gemLocal(phase,this.markerClock,foot),o=positions.length/3;
   const anchor=foot?at:markerAnchor(at,this.girl());
   for(let i=0;i<gem.positions.length;i+=3){positions.push(anchor[0]+gem.positions[i],anchor[1]+gem.positions[i+1],anchor[2]+gem.positions[i+2]);normals.push(gem.normals[i],gem.normals[i+1],gem.normals[i+2]);colors.push(gem.colors[i/3*4],gem.colors[i/3*4+1],gem.colors[i/3*4+2],gem.colors[i/3*4+3]);}
   for(const ix of gem.indices)indices.push(o+ix);
  };
  for(const n of nodes)pushGem(this.toWorld(this.region,[n.at])[0],this.phase(n.key));
  const states=derive({completed:this.completed},null);
  const next=nodes.find(n=>this.phase(n.key)==='playable');
  if(next&&routeHintVisible(this.lens==='MapExplore'?'MapExplore':'FollowWalk',states.explore[this.region],true)){
   const from=this.girl();
   for(const p of footprints(from,this.toWorld(this.region,[next.at])[0]).slice(0,24))pushGem(p,'passed',true);
  }
  const mesh=utils.createMesh({positions,normals,colors,indices});
  const renderer=this.markerNode.getComponent(MeshRenderer)!;renderer.mesh=mesh;
 }
 /** ?camTrace=1 only (CamTrace.ts). */
 /** p0drag10: camTrace occFace / occChest — her face / chest hidden from the lens by a proxy box (LensAvoid.herOcclusion, the same
  *  slab raycast the replay test scores); null when the region has no proxy set. */
 private traceOcc(cam:readonly number[]|null):{occFace:boolean|null;occChest:boolean|null}{
  const b=cam&&this.exploring?this.lakesideOccluders():null;if(!cam||!b||!b.length)return {occFace:null,occChest:null};
  const g=this.girl(),o=herOcclusion(cam,g,nearSphere(b,g,Math.hypot(cam[0]-g[0],cam[1]-g[1],cam[2]-g[2])+2));return {occFace:o.face,occChest:o.chest};}
 private traceFrame(T:{frame:(s:object)=>void;round:(v:readonly number[])=>number[]}){
  const cam=this.camera,n=cam?.node?.isValid?cam.node:null,p=n?.worldPosition,f=n?.forward,lg=this.lensPull.last,o=this.orbit;
  const d=(this.character as any)?.diagnostics?.()?.motion;
  T.frame({region:this.region,lens:this.lens,exploring:this.exploring,
   cam:p?T.round([p.x,p.y,p.z]):null,yaw:f?Math.round(Math.atan2(-f.x,-f.z)*1800/Math.PI)/10:null,pitch:f?Math.round(Math.asin(Math.max(-1,Math.min(1,f.y)))*1800/Math.PI)/10:null,
   her:T.round(this.girl()),herYaw:d&&typeof d.yawDeg==='number'?Math.round(d.yawDeg*10)/10:null,walking:this.groundWalking,herState:d?.state??d?.phase??null,
   lg:lg?{cost:Math.round(lg.eval.cost*1000)/1000,head:lg.eval.head,chest:lg.eval.chest,inside:lg.eval.inside,clutter:lg.eval.clutter,up:lg.params.up,swing:lg.params.swing,share:lg.params.share}:null,
   ...this.traceOcc(p?[p.x,p.y,p.z]:null),
   fo:{mode:o.mode,place:o.place,engaged:o.engaged(),write:o.shouldWrite(),seeded:o.seeded,yaw:Math.round(o.yaw*10)/10,pitch:Math.round(o.pitch*10)/10,arm:Math.round(o.dist*100)/100},
   entry:this.entry?Math.round(this.entry.t/this.entry.T*100)/100:null,hold:!!this.holdPose,anim:!!this.anim});
 }
 update(dt:number){
  this.syncExplore(dt);
  if(this.anim){this.anim.t+=dt;this.anim.sample(Math.min(this.anim.seconds,this.anim.t));if(this.anim.t>=this.anim.seconds){const d=this.anim.done;this.anim=null;d();}}
  if(this.holdPose){this.orbit.pause();(globalThis as any).__qfCamTraceSub?.('hold');this.writePose(this.holdPose,false);}
  if(this.hideTree){this.treeVisible(false);if(this.holdPose)this.stripFinaleOccluders(this.holdPose);}
  this.markerClock+=dt;
  if(this.holdPulse>0)this.holdPulse=Math.max(0,this.holdPulse-dt);
  for(let i=this.pulses.length-1;i>=0;i--){
   const p=this.pulses[i];if(!p.node.isValid){this.pulses.splice(i,1);continue;}
   if(this.holdPulse<=0)p.left-=dt;
   const u=this.holdPulse>0?0.5:1-Math.max(0,p.left)/0.45;const wave=Math.sin(Math.max(0,Math.min(1,u))*Math.PI);
   const grow=1+0.35*wave;
   p.node.setScale(p.sx*grow,p.sy*grow,p.sz*grow);
   if(p.motion==='spin')p.node.setRotationFromEuler(0,p.ey+wave*50,0);
   else if(p.motion!=='pulse')p.node.setRotationFromEuler(wave*28,p.ey+wave*36,0);
   if(p.left<=0){p.node.setScale(p.sx,p.sy,p.sz);p.node.setRotationFromEuler(0,p.ey,0);this.pulses.splice(i,1);}
  }
  this.tickLens(dt);
  /* p0drag7 (Mac p0drag6 item 5: 0 frames in explore): one camTrace row per frame while ?camTrace=1 is on */
  {const T=(globalThis as any).__qfCamTrace;if(T)this.traceFrame(T);}
  if(this.lens==='MapExplore'||this.lens==='FollowWalk'){this.markerWait+=dt;if(this.markerWait>=0.25){this.markerWait=0;this.rebuildMarkers();}}
 }
}

