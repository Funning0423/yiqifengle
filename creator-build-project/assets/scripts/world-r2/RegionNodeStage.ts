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
import {qaSkipTarget} from './QaSkip';
import {ISLAND_PROPS} from './IslandPropsLayout';
import {LensGuard,LENS_GUARD,guardEval,proxiesToWorld,type OccBox} from '../region/LensOcclusion';
import {LAKESIDE_DECK_ZONES,LAKESIDE_LENS_OCCLUDERS} from '../region/LakesideLensOccluders';
import {ISLAND_LENS_OCCLUDERS} from '../region/IslandLensOccluders';
import {SKYCITY_LENS_OCCLUDERS} from '../region/SkycityLensOccluders';
import {ArmSmoother} from '../region/ArmSmoother';
import {AVOID,LENS_PITCH_MAX_DEG,lensLevel,nearSphere} from '../region/LensAvoid';
import {nearestWalkable,walkPath,walkPathLengthM,walkRayHit,type WVec} from '../region/RegionWalkable';
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
 private avoid={sw:0,e:0,tsw:0,te:0,clear:0,wait:0};
 private walkToken=0;
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

 attach(camera:Camera){this.camera=camera;camTraceStart();if(qaSkipTarget()!==null){const G=globalThis as any;G.__qfTeleport=(key:string,yaw?:number,pitch?:number)=>this.qaTeleport(key,yaw,pitch);G.__qfAimAt=(name:string)=>this.qaAimAt(name);}}
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
  this.hideTree=true;this.treeVisible(false);
  const star=this.guardLens(this.starPose(this.girl(),w,h));
  await this.blend(0.6,this.readPose(),()=>star);
  this.hideTree=false;this.treeVisible(true);
  this.openExplore('skycity');
 }
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
  const boxes=this.lakesideOccluders();if(!boxes||!this.orbit.seeded){this.entry=null;return;}
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
 private skyAll:OccBox[]|null=null;private skyModel:Node|null=null;private skyNear:OccBox[]=[];private skyNearAt=0;
 private skycityOccluders():OccBox[]|null{
  const m=this.model('skycity');if(!m)return null;const now=Date.now();
  if(!this.skyAll||this.skyModel!==m){const W=m.worldMatrix,v=new Vec3(),src=new Vec3();
   this.skyAll=proxiesToWorld(SKYCITY_LENS_OCCLUDERS,p=>{src.set(p[0],p[1],p[2]);Vec3.transformMat4(v,src,W);return [v.x,v.y,v.z];});this.skyModel=m;this.skyNearAt=0;}
  if(now-this.skyNearAt>=400){const g=this.girl();this.skyNearAt=now;
   this.skyNear=this.skyAll.filter(b=>Math.hypot(Math.max(b.min[0]-g[0],0,g[0]-b.max[0]),Math.max(b.min[2]-g[2],0,g[2]-b.max[2]))<18);}
  return this.skyNear;
 }
 /** Lakeside + island (b17r13): LensGuard keeps the walk lens off the proxies (look-ahead plan, speed/accel-capped spring, floor). */
 private occlude(pose:Pose,dt:number):Pose{
  let boxes=this.lakesideOccluders();if(!boxes){this.lensPull.reset();return pose;}
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
  this.orbit.step(dt);
  const g=this.girl();
  this.refreshOrbitBoxes(g);
  const A=LENS_GUARD;
  let pose=this.clampArm(this.occlude(this.guardOrbitGround(this.clampArm(this.orbit.solve(g,this.orbitBoxes,g[1],this.regionBounds()),A.armMinM,A.armMaxM)),dt),A.armHardM,Infinity);
  // p0drag7: no single-frame arm jumps (Mac trace_lake_walkdrag 203.6/205.7/207.9 s: clearPose flipped 9.1 ↔ 5.7 m with the yaw), then never inside a proxy
  const e=this.entry,look=this.lookAt(g);
  if(this.region==='skycity')pose=this.clampArm(pose,A.armMinM,Infinity);/* p0drag8: the 1.6 m floor never wins over 3.5 m here */
  pose=e?(this.armSmooth.reset(this.armOf(pose,look)),pose):this.armAlong(pose,look,this.armSmooth.step(this.armOf(pose,look),dt));
  pose=this.outOfProxies(pose,look,e?0:dt);
  if(e){e.t+=Math.max(0,Math.min(0.1,dt||0));const u=Math.min(1,e.t/e.T),s=u*u*u*(u*(u*6-15)+10),L=(a:readonly number[],b:readonly number[])=>[a[0]+(b[0]-a[0])*s,a[1]+(b[1]-a[1])*s,a[2]+(b[2]-a[2])*s] as [number,number,number];
   pose={...pose,position:L(e.from.position,pose.position),target:L(e.from.target,pose.target)};if(u>=1)this.entry=null;}
  pose=this.clampPitch(pose,this.lookAt(this.girl()));
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
  const at=(sw:number,de:number):[number,number,number]=>{const y=y0+sw*R,e=Math.min(eMax,e0+de*R);return [look[0]+Math.sin(y)*Math.cos(e)*L,look[1]+Math.sin(e)*L,look[2]+Math.cos(y)*Math.cos(e)*L];};
  if(boxes&&boxes.length){
   const near=nearSphere(boxes,look,L+1);/* p0drag8 perf: sphere of the lens orbit */
   const lvl=(q:readonly number[])=>lensLevel(look,q,near,0.25);/* 0 clear, 1 lens outside but sight line blocked, 2 lens inside */
   if(lvl(at(0,0))===0){A.clear++;if(A.clear>=AVOID.backN||(A.tsw===0&&A.te===0)){A.tsw=0;A.te=0;}}
   else{A.clear=0;
    if(A.wait>0)A.wait--;/* p0drag8 perf: hold the current target between full searches (≤ searchEveryN frames of partial occlusion) */
    else if(lvl(at(A.tsw,A.te))!==0||(A.tsw===0&&A.te===0)){A.wait=AVOID.searchEveryN-1;let best:[number,number]|null=null,bestP:[number,number]|null=null,bc=1e9;
     for(const sw of AVOID.swings){if(Math.abs(sw)>bc)break;for(let de=sw?0:AVOID.stepDeg;e0*180/Math.PI+de<=LENS_PITCH_MAX_DEG+1e-6;de+=AVOID.stepDeg){
      const v=lvl(at(sw,de)),c=Math.abs(sw)+0.7*de+Math.abs(sw-A.tsw)*0.3+Math.abs(de-A.te)*0.3;
      if(v===0&&c<bc){bc=c;best=[sw,de];}else if(v===1&&!bestP)bestP=[sw,de];}}
     const pick=best??bestP;if(pick){A.tsw=pick[0];A.te=pick[1];}}}
  }
  const t=Number.isFinite(dt)&&dt>0?Math.min(0.1,dt):0,step=(c:number,g:number,r:number)=>c+Math.max(-r*t,Math.min(r*t,g-c));
  A.sw=step(A.sw,A.tsw,AVOID.yawDegS);A.e=step(A.e,A.te,AVOID.elevDegS);
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
  const first=!this.orbit.shouldWrite()&&!this.entry,from=first?this.readPose():null;
  if(gesture==='pinch')this.orbit.pinch(x);
  else this.orbit.drag(x/Math.max(1,w),y/Math.max(1,h));
  // r17: the first drag takes over from whatever lens was on screen (far finale / board lens): glide, never cut
  if(from&&this.orbit.shouldWrite()){const q=this.orbit.rawPose(g).position,d=Math.hypot(q[0]-from.position[0],q[1]-from.position[1],q[2]-from.position[2]);if(d>0.3)this.entry={from,t:0,T:Math.min(3,Math.max(0.5,1.9*d/LENS_GUARD.entryGlideMS))};}
  this.writeOrbit(0);
 }
 openExplore(region:StageRegion,fromLens=false,snapped=false){
  this.region=region;this.exploring=true;this.lens='MapExplore';this.lensPull.reset();this.focus=this.girl();this.zoom=1.6;this.armSmooth.clear();this.avoid={sw:0,e:0,tsw:0,te:0,clear:0,wait:0};
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
  const hit=walkRayHit(region,[o.x,o.y,o.z],[e.x-o.x,e.y-o.y,e.z-o.z]);
  (globalThis as any).__qfGroundTap={region,kind:hit.kind,at:hit.kind==='none'?null:hit.at,t:Date.now()};
  if(hit.kind!=='walk'){emitTransitCue('scene-tap',{t:0,region,id:hit.kind==='water'?'water':'none'});return;}
  void this.groundWalkTo(region,hit.at);
 }
 private async groundWalkTo(region:StageRegion,at:WVec){
  const m=this.walkMatrix(region);if(!m||!this.ensureCharacter())return;
  const inv=new Mat4();Mat4.invert(inv,m);
  const gw=this.girl(),g=new Vec3();Vec3.transformMat4(g,new Vec3(gw[0],gw[1],gw[2]),inv);
  const from=nearestWalkable(region,[g.x,g.y,g.z],1.6);if(!from)return;
  const local=walkPath(region,from.at,at);
  (globalThis as any).__qfGroundTap={...((globalThis as any).__qfGroundTap||{}),path:local?local.length:0,lengthM:local?+walkPathLengthM(local).toFixed(2):0};
  if(!local||local.length<2)return;
  const path=this.toWorld(region,local as unknown as Vec[]),dest=path[path.length-1],L=walkPathLengthM(local),duration=Math.max(.4,L/1.2);
  // lens stays MapExplore: the seeded orbit follows her feet (update), no cut to the follow lens
  const token=this.walkToken;this.groundWalking=true;
  const end=path[path.length-2],yaw=Math.atan2(dest[0]-end[0],dest[2]-end[2]);
  try{await performBounded(this.character,{kind:'walk',path,duration},dest,yaw,duration*1000+4000);}
  finally{this.groundWalking=false;}
  if(token!==this.walkToken)return;
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
  // p0drag8: 'sign' = island, the node nearest the return signpost, lens behind her aimed at it
  const sp=ISLAND_PROPS.signpost.position,sign=key==='sign';if(sign&&region!=='island')return {ok:false,reason:'sign-is-on-island'};
  const n=sign?nodes.slice().sort((a,b)=>Math.hypot(a.at[0]-sp[0],a.at[2]-sp[2])-Math.hypot(b.at[0]-sp[0],b.at[2]-sp[2]))[0]:nodes.find(x=>x.key===key);
  if(!n)return {ok:false,reason:'no-node-'+key+'-in-'+region};
  if(this.groundWalking)this.walkToken++;
  this.standAt(region,n.at);const {w,h}=this.viewport(),g=this.girl();
  this.orbit.forget();this.orbit.setPlace(region);this.orbit.seed(followPose(g,this.yaw(),w,h,0),g);this.entry=null;
  if(sign){const sw=this.toWorld('island',[[sp[0],sp[1],sp[2]]])[0];yawDeg=yawDeg??Math.atan2(g[0]-sw[0],g[2]-sw[2])*180/Math.PI;pitchDeg=pitchDeg??12;}
  this.qaOrbit(yawDeg,pitchDeg);this.writePose(this.orbit.rawPose(g),false);
  return {ok:true,region,at:n.at,yaw:this.orbit.yaw,pitch:this.orbit.pitch};
 }
 /** Test-only (?qfSkip gate): turn the explore lens so the named scene node sits in front of it (lens on the far side of her). */
 qaAimAt(name:string):{ok:boolean;reason?:string;yaw?:number;pitch?:number}{
  if(!this.exploring)return {ok:false,reason:'explore-not-open'};
  const find=(n:any):any=>{if(!n)return null;if(n.name===name)return n;for(const c of n.children??[]){const r=find(c);if(r)return r;}return null;};
  const t=find(director.getScene());if(!t)return {ok:false,reason:'no-node-'+name};const p=t.worldPosition,g=this.girl();
  this.qaOrbit(Math.atan2(g[0]-p.x,g[2]-p.z)*180/Math.PI,12);this.writePose(this.orbit.rawPose(g),false);
  return {ok:true,yaw:this.orbit.yaw,pitch:this.orbit.pitch};
 }
 private qaOrbit(yawDeg?:number,pitchDeg?:number){const L=ORBIT_LIMITS[this.orbit.place];
  if(Number.isFinite(yawDeg))this.orbit.yaw=yawDeg!;if(Number.isFinite(pitchDeg))this.orbit.pitch=Math.max(L?.pitchMinDeg??5,Math.min(L?.pitchMaxDeg??58,pitchDeg!));}

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
  await performBounded(this.character,{kind:'walk',path,duration:Math.max(0.4,Math.hypot(dest[0]-from[0],dest[2]-from[2])/1.2)},dest,0);
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
 private traceFrame(T:{frame:(s:object)=>void;round:(v:readonly number[])=>number[]}){
  const cam=this.camera,n=cam?.node?.isValid?cam.node:null,p=n?.worldPosition,f=n?.forward,lg=this.lensPull.last,o=this.orbit;
  const d=(this.character as any)?.diagnostics?.()?.motion;
  T.frame({region:this.region,lens:this.lens,exploring:this.exploring,
   cam:p?T.round([p.x,p.y,p.z]):null,yaw:f?Math.round(Math.atan2(-f.x,-f.z)*1800/Math.PI)/10:null,pitch:f?Math.round(Math.asin(Math.max(-1,Math.min(1,f.y)))*1800/Math.PI)/10:null,
   her:T.round(this.girl()),herYaw:d&&typeof d.yawDeg==='number'?Math.round(d.yawDeg*10)/10:null,walking:this.groundWalking,herState:d?.state??d?.phase??null,
   lg:lg?{cost:Math.round(lg.eval.cost*1000)/1000,head:lg.eval.head,chest:lg.eval.chest,inside:lg.eval.inside,clutter:lg.eval.clutter,up:lg.params.up,swing:lg.params.swing,share:lg.params.share}:null,
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

