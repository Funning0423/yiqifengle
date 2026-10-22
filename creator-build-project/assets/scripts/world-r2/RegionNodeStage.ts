import {_decorator,Animation,Camera,Color,Component,Material,MeshRenderer,Node,Vec3,director,geometry,utils,view} from 'cc';
import {MINIGAME} from 'cc/env';
import {applyCameraPose,fromLookAt} from '../world-r1/CameraPose';
import type {Pose,Vec} from '../world-r1/WorldFlowCore';
import type {CharacterAdapter} from '../world-r1/WorldFlowCore';
import {BLEND_S,LENS_CLEAR_M,blendPose,finaleLook,finalePose,propFacingPose,ROBOT_FACING,PROP_CLEAR_M,followLookUp,followPose,mapPose,markersLook,retreatClear,type Aabb,type LensState} from '../region/ExploreCameraCore';
import {FreeOrbit,orbitColliderName,type OrbitBox,type OrbitPlace} from '../region/FreeOrbit';
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
 private region:RegionId='island';
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
 private walkToken=0;
 private shotNote='';
 private dragHome:Vec|null=null;
 private completed:readonly string[]=[];
 private readonly orbit=new FreeOrbit('island');
 private orbitBoxes:OrbitBox[]=[];
 private orbitBoxAt=0;

 attach(camera:Camera){this.camera=camera;}
 bindCharacter(character:CharacterAdapter|null){this.character=character;}
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
 private model(region:RegionId):Node|null{
  if(region==='island')return null;
  const rig=findDeep(director.getScene(),'RegionJourney-'+region);if(!rig)return null;
  return rig.children[0]||null;
 }
 private toWorld(region:RegionId,path:readonly Vec[]):Vec[]{
  const model=this.model(region);if(!model)return path.map(p=>[p[0],p[1],p[2]] as Vec);
  const m=model.worldMatrix,v=new Vec3();
  return path.map(p=>{Vec3.transformMat4(v,new Vec3(p[0],p[1],p[2]),m);return [v.x,v.y,v.z] as Vec;});
 }
 private place(region:RegionId):PathPlace{return path=>this.toWorld(region,path);}
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

 private showWorld(region:RegionId){
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
  for(const c of cams)c.enabled=false;
  if(rig)rig.active=true;
  this.flow()?.presentNodeWalkWorld(true);
  try{this.character?.setVisible(true);}catch{/* no adapter */}
  this.region=region;
 }
 private restoreBoard(){
  const c=this.cover;if(!c)return;this.cover=null;
  if(c.rig)c.rig.active=c.rigOn;
  this.flow()?.presentNodeWalkWorld(false);
  for(const x of c.cams)if(x.cam?.isValid)x.cam.enabled=x.on;
  if(c.host?.isValid)c.host.active=true;
  if(c.nav?.isValid)c.nav.active=true;
  try{this.character?.setVisible(false);}catch{/* level hides her */}
  this.lens='Board';this.exploring=false;setExploreEnabled(false);this.shotPhases=null;
  this.orbit.armBoard();
 }
 private async blend(seconds:number,from:Pose,to:()=>Pose){
  this.orbit.pause();
  const step=(t:number)=>this.writePose(t<=0?from:t>=seconds?to():blendPose(from,to(),t,seconds));
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
  await this.blend(BLEND_S.boardToFollow,board,()=>followPose(this.girl(),this.yaw(),w,h,followLookUp(spec.region,99)));
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
 private handOrbitBack(region:RegionId){
  const place:OrbitPlace=region;
  const was=this.orbit.engaged();
  if(this.orbit.place==='board'||this.orbit.mode==='board')this.orbit.disarm(place);
  else this.orbit.setPlace(place);
  if(!was){this.orbit.unlock();return;}
  this.orbit.beginReturn(this.readPose());
  this.writeOrbit(0);
 }
 private regionBounds():readonly [number,number,number,number]{return REGION_NODES[this.region].exploreBox;}
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
 private writeOrbit(dt:number){
  this.orbit.step(dt);
  const g=this.girl();
  this.refreshOrbitBoxes(g);
  this.writePose(this.guardOrbitGround(this.orbit.solve(g,this.orbitBoxes,g[1],this.regionBounds())),false);
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
 private aimOrbit(gesture:'drag'|'pinch'|'release',x:number,y:number){
  const {w,h}=this.viewport(),g=this.girl();
  this.orbit.setPlace(this.region);
  if(!this.orbit.seeded)this.orbit.seed(this.readPose(),g);
  if(gesture==='release'){this.orbit.release();return;}
  if(gesture==='pinch')this.orbit.pinch(x);
  else this.orbit.drag(x/Math.max(1,w),y/Math.max(1,h));
  this.writeOrbit(0);
 }
 openExplore(region:RegionId){
  this.region=region;this.exploring=true;this.lens='MapExplore';this.focus=this.girl();this.zoom=1.6;
  this.handOrbitBack(region);
  if(!this.orbit.shouldWrite()){const {w,h}=this.viewport();const g=this.girl();if(!this.orbit.seeded)this.orbit.seed(followPose(g,this.yaw(),w,h,0),g);this.writePose(this.orbit.rawPose(g),false);}
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
  const hits=this.projectNodes().filter(h=>Math.hypot(h.x-x,h.y-y)<=48);
  const id=pickMarker(hits.map(h=>({id:h.id,distancePt:Math.hypot(h.x-x,h.y-y),toGirl:h.toGirl})));
  const prop=this.projectProps().find(p=>Math.hypot(p.x-x,p.y-y)<=44);
  const tap=resolveTap({nodeId:id,nodePhase:id?this.phase(id):null,propId:prop?.id||null,groundM:prop||id?null:2,explore:true});
  if(!tap)return;
  if(tap.kind==='prop')this.pulse(tap.id,this.region);
  else if(tap.kind==='locked')emitTransitCue('node-locked-tap',{t:0,region:this.region,node:tap.id});
  else if(tap.walk&&this.character){const node=REGION_NODES[this.region].nodes.find(n=>n.key===tap.id);if(node)void this.walkTo(node.at);}
 }
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
  const nodes=REGION_NODES[this.region].nodes;
  const world=nodes.slice(0,3).map(n=>this.toWorld(this.region,[n.at])[0]);
  while(world.length<3)world.push(g);
  return markersLook(world[0],world[1],world[2]);
 }

 pulse(id:string,region:RegionId,hold=false){
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
  const g=this.girl(),out=new Vec3(),list=REGION_NODES[this.region].nodes;
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
  const nodes=REGION_NODES[this.region].nodes;
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
 update(dt:number){
  if(this.anim){this.anim.t+=dt;this.anim.sample(Math.min(this.anim.seconds,this.anim.t));if(this.anim.t>=this.anim.seconds){const d=this.anim.done;this.anim=null;d();}}
  if(this.holdPose){this.orbit.pause();this.writePose(this.holdPose,false);}
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
  if(!this.anim&&!this.holdPose&&(this.lens==='MapExplore'||this.lens==='FollowWalk')){
   if(this.orbit.shouldWrite())this.writeOrbit(dt);
   else if(this.lens==='FollowWalk'&&this.exploring){const {w,h}=this.viewport();this.writePose(followPose(this.girl(),this.yaw(),w,h,followLookUp(this.region,99)),false);}
  }
  if(this.lens==='MapExplore'||this.lens==='FollowWalk'){this.markerWait+=dt;if(this.markerWait>=0.25){this.markerWait=0;this.rebuildMarkers();}}
 }
}

