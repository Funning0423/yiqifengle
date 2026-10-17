import {_decorator,Camera,Color,Component,Material,MeshRenderer,Node,Vec3,director,utils,view} from 'cc';
import {applyCameraPose,fromLookAt} from '../world-r1/CameraPose';
import type {Pose,Vec} from '../world-r1/WorldFlowCore';
import type {CharacterAdapter} from '../world-r1/WorldFlowCore';
import {BLEND_S,blendPose,finalePose,followLookUp,followPose,mapPose,type LensState} from '../region/ExploreCameraCore';
import {setExploreEnabled} from '../region/ExploreGate';
import {REGION_NODES,type RegionId} from '../region/RegionNodes';
import {derive,walkPair,type NodePhase} from '../region/RegionNodeProgress';
import {planWalk} from '../region/NodeWalker';
import {performBounded,runRewardWalk,runSkyFinale,type PathPlace} from '../region/RegionNodePlay';
import {emitTransitCue} from '../region/TransitAudioHooks';
import {PROP_NODES,SCENE_PROPS,propFeedback,resolveTap,pickMarker,type Gesture} from './ExploreInput';
import {markerDraw,footprints,routeHintVisible} from '../ui/NodeMarkers';
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
function hex(fill:string):[number,number,number]{
 const n=parseInt(fill.slice(1),16);
 return [(n>>16)&255,(n>>8)&255,n&255];
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
 private dragHome:Vec|null=null;
 private completed:readonly string[]=[];

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
  return rig.children.find(c=>!c.name.startsWith('RainbowBridge'))||null;
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
 private writePose(pose:Pose){
  const cam=this.camera;if(!cam?.node?.isValid)return;
  applyCameraPose(cam,fromLookAt(pose,pose.fovVerticalDeg??cam.fov),'region.node-lens');
 }
 private flow(){return director.getScene()?.getComponentInChildren(WorldFlowComponent)||null;}

 private showWorld(region:RegionId){
  if(this.cover&&this.region===region)return;
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
 }
 private async blend(seconds:number,from:Pose,to:()=>Pose){
  const step=(t:number)=>this.writePose(t<=0?from:t>=seconds?to():blendPose(from,to(),t,seconds));
  await new Promise<void>(resolve=>{
   let settled=false;const done=()=>{if(settled)return;settled=true;step(seconds);resolve();};
   this.anim={t:0,seconds,sample:step,done};
   setTimeout(done,seconds*1000+80);
  });
 }

 async playReward(character:CharacterAdapter,fromStage:string,toStage:string){
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
  try{await runRewardWalk(character,fromStage,toStage,undefined,this.place(spec.region));}
  finally{setExploreEnabled(false);}
  const arrived=this.readPose();
  this.lens='FollowToBoard';
  await this.blend(BLEND_S.followToBoard,arrived,()=>board);
  this.restoreBoard();
 }
 async playFinale(character:CharacterAdapter){
  this.character=character;
  this.showWorld('skycity');
  const start=this.toWorld('skycity',planWalk('skycity','S4','S6').segments[0].path)[0];
  try{character.cancelAndReset({kind:'standing',controllerRoot:[start[0],start[1],start[2]],yawRad:0});}catch{/* continue */}
  const {w,h}=this.viewport();
  const board=this.readPose();
  this.lens='BoardToFollow';
  await this.blend(BLEND_S.boardToFollow,board,()=>followPose(this.girl(),this.yaw(),w,h,8));
  this.lens='FollowWalk';setExploreEnabled(true);
  try{await runSkyFinale(character,this.place('skycity'));}finally{setExploreEnabled(false);}
  this.lens='FollowWalk';
  await this.blend(0.6,this.readPose(),()=>finalePose(this.girl(),this.yaw(),w,h));
  this.openExplore('skycity');
 }
 openExplore(region:RegionId){
  this.region=region;this.exploring=true;this.lens='MapExplore';this.focus=this.girl();this.zoom=1.6;
  const {w,h}=this.viewport();this.writePose(mapPose(this.focus,this.zoom,w,h));
  setExploreEnabled(true);
  emitTransitCue('explore-unlocked',{t:0,region});
  this.rebuildMarkers();
 }

 /** QA frames only. No banner. */
 async frame(spec:{region?:RegionId;lens?:string;prop?:string}){
  const region:RegionId=spec.region==='meadow'||spec.region==='skycity'?spec.region:'island';
  if(spec.lens==='board'){this.restoreBoard();return;}
  this.showWorld(region);
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
  if(spec.lens==='map'||spec.lens==='tap')pose=mapPose(g,1.6,w,h);
  else if(spec.lens==='finale'||spec.lens==='look')pose=finalePose(g,0,w,h);
  else if(spec.lens==='blend'){
   const board:Pose={position:[follow.position[0],follow.position[1]+5,follow.position[2]+7],target:[g[0],g[1]+1,g[2]],fovVerticalDeg:48};
   pose=blendPose(board,follow,0.3,BLEND_S.boardToFollow);
  }
  this.writePose(pose);
  this.lens=spec.lens==='map'||spec.lens==='tap'?'MapExplore':'FollowWalk';
  this.shotPhases={};
  const forced:Record<string,NodePhase>={};
  nodes.forEach((n,i)=>{forced[n.key]=i%3===0?'passed':i%3===1?'playable':'locked';});
  this.shotPhases=forced;
  this.rebuildMarkers();
  if(spec.lens==='prop')this.pulse(spec.prop||SCENE_PROPS[region][0],region);
  if(spec.lens==='map'||spec.lens==='tap'){this.exploring=true;setExploreEnabled(true);}
  if(spec.lens==='tap'){
   const target=nodes.find(n=>this.phase(n.key)==='playable'&&n.key!==key);
   if(target)void this.walkTo(target.at);
  }
 }

 onGesture(gesture:Gesture,x:number,y:number){
  if(!this.exploring||this.lens!=='MapExplore'){
   if(gesture==='tap'&&this.lens==='FollowWalk')this.skipWalk();
   return;
  }
  const {w,h}=this.viewport();
  if(gesture==='drag'){if(!this.dragHome)this.dragHome=[this.focus[0],this.focus[1],this.focus[2]];this.focus=[this.dragHome[0]-x*0.02,this.focus[1],this.dragHome[2]+y*0.02];this.writePose(mapPose(this.focus,this.zoom,w,h));return;}
  this.dragHome=null;
  if(gesture==='pinch'){this.zoom=Math.max(0.7,Math.min(1.6,this.zoom+(y>x?0.04:-0.04)));this.writePose(mapPose(this.focus,this.zoom,w,h));return;}
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
  const from=this.girl();
  const dest=this.toWorld(this.region,[at])[0];
  const path=[from,dest] as [Vec,Vec];
  this.lens='FollowWalk';
  await performBounded(this.character,{kind:'walk',path,duration:Math.max(0.4,Math.hypot(dest[0]-from[0],dest[2]-from[2])/1.2)},dest,0);
  this.lens='MapExplore';
  const {w,h}=this.viewport();this.focus=this.girl();this.writePose(mapPose(this.focus,this.zoom,w,h));
 }

 pulse(id:string,region:RegionId){
  const name=PROP_NODES[id];if(!name)return;
  const nodes:Node[]=[];findAll(director.getScene(),name,nodes);
  const fb=propFeedback(id);
  for(const node of nodes){
   const s=node.scale,e=node.eulerAngles;
   this.pulses.push({node,sx:s.x,sy:s.y,sz:s.z,ey:e.y,left:fb.seconds,motion:fb.motion});
  }
  if(id==='robot'){const rig=director.getScene()?.getComponentInChildren(SkycityRobotInteract);try{rig?.playGesture?.('robot_give_flower');}catch{/* clip optional */}}
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
  const pushGem=(at:Vec,phase:NodePhase,scale:number)=>{
   const c=hex(markerDraw(phase,this.anim?.t||0).fill),o=positions.length/3;
   const s=0.42*scale;const pts=[[0,s,0],[s,0,0],[0,0,s],[-s,0,0],[0,0,-s],[0,-s*0.6,0]];
   for(const p of pts){positions.push(at[0]+p[0],at[1]+0.9+p[1],at[2]+p[2]);normals.push(0,1,0);colors.push(c[0],c[1],c[2],255);}
   const faces=[[0,1,2],[0,2,3],[0,3,4],[0,4,1],[5,2,1],[5,3,2],[5,4,3],[5,1,4]];
   for(const f of faces)indices.push(o+f[0],o+f[1],o+f[2]);
  };
  for(const n of nodes)pushGem(this.toWorld(this.region,[n.at])[0],this.phase(n.key),this.phase(n.key)==='playable'?1.04:1);
  const states=derive({completed:this.completed},null);
  const next=nodes.find(n=>this.phase(n.key)==='playable');
  if(next&&routeHintVisible(this.lens==='MapExplore'?'MapExplore':'FollowWalk',states.explore[this.region],true)){
   const from=this.girl();
   for(const p of footprints(from,this.toWorld(this.region,[next.at])[0]).slice(0,24))pushGem(p,'passed',0.28);
  }
  const mesh=utils.createMesh({positions,normals,colors,indices});
  const renderer=this.markerNode.getComponent(MeshRenderer)!;renderer.mesh=mesh;
 }
 update(dt:number){
  if(this.anim){this.anim.t+=dt;this.anim.sample(Math.min(this.anim.seconds,this.anim.t));if(this.anim.t>=this.anim.seconds){const d=this.anim.done;this.anim=null;d();}}
  for(let i=this.pulses.length-1;i>=0;i--){
   const p=this.pulses[i];if(!p.node.isValid){this.pulses.splice(i,1);continue;}
   p.left-=dt;const u=1-Math.max(0,p.left)/0.45;const wave=Math.sin(u*Math.PI);
   if(p.motion==='spin')p.node.setRotationFromEuler(0,p.ey+wave*40,0);
   else if(p.motion==='pulse')p.node.setScale(p.sx*(1+0.12*wave),p.sy*(1+0.12*wave),p.sz*(1+0.12*wave));
   else p.node.setRotationFromEuler(wave*12,p.ey,0);
   if(p.left<=0){p.node.setScale(p.sx,p.sy,p.sz);p.node.setRotationFromEuler(0,p.ey,0);this.pulses.splice(i,1);}
  }
  if(this.lens==='MapExplore'||this.lens==='FollowWalk'){this.markerWait+=dt;if(this.markerWait>=0.25){this.markerWait=0;this.rebuildMarkers();}}
 }
}

