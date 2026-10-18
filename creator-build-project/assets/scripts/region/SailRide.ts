import {Director, Mat4, MeshRenderer, Node, Quat, SkeletalAnimation, SkinnedMeshRenderer, Vec3, director, gfx, utils} from 'cc';
import type {Cancellation, CharacterAdapter, Pose, Vec, WorldLease} from '../world-r1/WorldFlowCore';
import {emitTransit, setTransitHidden} from './TransitAudioHooks';
import {beatAt, sailCamera, sailFollowCamera, sailPresentationT, sailVehicle, seatFromBench, type SailTimeline} from './TransportLeg';
import {attachRider, detachRider, placeBoat} from './TransportVehicle';
import type {SailArt} from './SailArt';
import {pushSailCue, pushSailFrame, sailQaEnabled} from './SailQaProbe';
function sailNight():boolean{try{const m=(globalThis as any).__worldDayNight?.snapshot?.()?.mode;return typeof m==='string'&&m.includes('night');}catch{return false;}}
const pathLen=(path:readonly Vec[])=>{let L=0;for(let i=1;i<path.length;i++)L+=Math.hypot(path[i][0]-path[i-1][0],path[i][1]-path[i-1][1],path[i][2]-path[i-1][2]);return L;};
type LockedJoint={node:Node;p:Vec3;r:Quat;s:Vec3};
/** Drives the sail from foreground frame steps. The journey controller calls `onFrame` while region-travel is active. */
export function createSailDriver(opts:{
 timeline:SailTimeline;route:readonly Vec[];shore:Vec[];boat:Node|null;sail:Node|null;seat:Node|null;rider:Node|null;riderHome:Node|null;
 art?:SailArt|null;
 screen:()=>{w:number;h:number};
 boardPose?:Pose|null;
}){
 let t=0,real=0,departAt:number|null=null,motionBudget=opts.timeline.speed.motionS,last=0,fade=0,attached=false;
 let phase:'sail'|'arrival'='sail';
 let arrivalPath:Vec[]=opts.shore,arrivalU=0,arrivalElapsed=0,arrivalDur=1,arrivalFrom:Pose|null=null,followYaw:{yaw:number|null}={yaw:null};
 const seatedPose:LockedJoint[]=[];
 const captureSeated=(root:Node)=>{
  seatedPose.length=0;
  const walk=(n:Node)=>{for(const c of n.children){seatedPose.push({node:c,p:c.position.clone(),r:c.rotation.clone(),s:c.scale.clone()});walk(c);}};
  walk(root);
 };
 const applySeatedPose=()=>{
  for(const j of seatedPose){
   if(!j.node.isValid)continue;
   j.node.setPosition(j.p);j.node.setRotation(j.r);j.node.setScale(j.s);
   (j.node as {isSkipTransformUpdate?:boolean}).isSkipTransformUpdate=false;
  }
 };
 /** Baked skinning ignores the locked joints and draws the bind pose after stop(). Keep sit_hold sampled and force realtime skinning. */
 const drawSeated=()=>{
  const skel=opts.rider?.getComponent(SkeletalAnimation)||opts.rider?.getComponentInChildren(SkeletalAnimation)||null;
  if(skel){
   if(skel.useBakedAnimation)skel.useBakedAnimation=false;
   const name=skel.defaultClip?.name||'sit_hold';
   const st=skel.getState(name);
   if(st){
    if(!st.isPlaying){try{skel.play(name);}catch{/* graph may reject */}}
    st.time=0;try{st.sample();}catch{/* curves not ready */}st.pause();
   }
  }
  if(opts.rider){
   for(const skin of opts.rider.getComponentsInChildren(SkinnedMeshRenderer)){
    try{skin.setUseBakedAnimation(false);}catch{/* model not attached yet */}
   }
  }
  applySeatedPose();
  try{opts.rider?.updateWorldTransform();}catch{/* node not in a scene yet */}
  freezeDrawnPose();
 };
 const frozenNodes:Node[]=[];
 const hiddenSkins:SkinnedMeshRenderer[]=[];
 let poseFrozen=false;
 /** The island long shot was still drawing the bind pose while the joint nodes sat. Bake the live skin once and draw that. */
 const freezeDrawnPose=()=>{
  if(poseFrozen||!opts.rider)return;
  const tmp=new Vec3(),acc=new Vec3(),local=new Vec3(),inv=new Mat4(),skinM=new Mat4();
  for(const skin of opts.rider.getComponentsInChildren(SkinnedMeshRenderer)){
   const mesh=skin.mesh,skelData=skin.skeleton,root=skin.skinningRoot||opts.rider;
   if(!mesh||!skelData||!skelData.joints.length)continue;
   const src=mesh.readAttribute(0,gfx.AttributeName.ATTR_POSITION);
   const joints=mesh.readAttribute(0,gfx.AttributeName.ATTR_JOINTS);
   const weights=mesh.readAttribute(0,gfx.AttributeName.ATTR_WEIGHTS);
   const indices=mesh.readIndices(0);
   if(!(src instanceof Float32Array)||!joints||!weights||!indices)continue;
   if(!Mat4.invert(inv,skin.node.worldMatrix))continue;
   const bones=skelData.joints.map(path=>root.getChildByPath(path));
   for(const bone of bones){try{bone?.updateWorldTransform();}catch{/* */}}
   let hipY:number|null=null,footY:number|null=null;
   const walkH=(n:Node)=>{
    if(/hips$/i.test(n.name))hipY=n.worldPosition.y;
    if(/foot/i.test(n.name))footY=footY==null?n.worldPosition.y:Math.min(footY,n.worldPosition.y);
    for(const c of n.children)walkH(c);
   };
   walkH(opts.rider);
   if(hipY==null||footY==null||hipY-footY>=0.5)continue;
   const binds=skelData.bindposes;
   const count=src.length/3;
   const jStride=joints.length/count,wStride=(weights as ArrayLike<number>).length/count;
   if(jStride<1||wStride<1)continue;
   const pos=new Float32Array(src.length);
   let minY=Infinity,maxY=-Infinity;
   for(let v=0;v<count;v++){
    acc.set(0,0,0);let wsum=0;
    const px=src[v*3],py=src[v*3+1],pz=src[v*3+2];
    const kn=Math.min(4,jStride,wStride);
    for(let k=0;k<kn;k++){
     const ji=(joints as ArrayLike<number>)[v*jStride+k]|0;
     const w=(weights as ArrayLike<number>)[v*wStride+k];
     const bone=bones[ji];
     if(!w||!bone||!binds[ji])continue;
     Mat4.multiply(skinM,bone.worldMatrix,binds[ji]);
     Vec3.transformMat4(tmp,new Vec3(px,py,pz),skinM);
     acc.x+=tmp.x*w;acc.y+=tmp.y*w;acc.z+=tmp.z*w;wsum+=w;
    }
    if(wsum<=0){pos[v*3]=px;pos[v*3+1]=py;pos[v*3+2]=pz;continue;}
    acc.x/=wsum;acc.y/=wsum;acc.z/=wsum;
    if(acc.y<minY)minY=acc.y;if(acc.y>maxY)maxY=acc.y;
    Vec3.transformMat4(local,acc,inv);
    pos[v*3]=local.x;pos[v*3+1]=local.y;pos[v*3+2]=local.z;
   }
   // A standing bind-pose bake is about 1.6 m. Sitting is about a metre. Keep the skin if this bake is still standing.
   if(!(maxY-minY>0.4&&maxY-minY<1.25))continue;
   const uvs=mesh.readAttribute(0,gfx.AttributeName.ATTR_TEX_COORD);
   const geo:any={positions:Array.from(pos),indices:Array.from(indices)};
   if(uvs)geo.uvs=Array.from(uvs as ArrayLike<number>);
   let baked;
   try{baked=utils.createMesh(geo,undefined,{calculateBounds:true});}
   catch{continue;}
   const node=new Node('sail_frozen_pose');
   skin.node.addChild(node);node.setPosition(0,0,0);node.setRotationFromEuler(0,0,0);node.setScale(1,1,1);
   const rend=node.addComponent(MeshRenderer);
   rend.mesh=baked;
   const shared=skin.sharedMaterials;
   for(let i=0;i<shared.length;i++)if(shared[i])rend.setSharedMaterial(shared[i],i);
   skin.enabled=false;
   frozenNodes.push(node);hiddenSkins.push(skin);
  }
  poseFrozen=frozenNodes.length>0;
 };
 const dropFrozenPose=()=>{
  for(const n of frozenNodes){if(n.isValid)n.destroy();}
  frozenNodes.length=0;
  for(const s of hiddenSkins){if(s.isValid)s.enabled=true;}
  hiddenSkins.length=0;poseFrozen=false;
 };
 const dropSeatedPose=()=>{try{director.off(Director.EVENT_BEFORE_DRAW,drawSeated);}catch{/* director not up */}seatedPose.length=0;dropFrozenPose();};
 const fired=new Set<string>();
 const viewSize=opts.screen;
 const sc=opts.timeline.beats.find(b=>b.id==='S-c')!,se=opts.timeline.beats.find(b=>b.id==='S-e')!;
 const seated=()=>attached&&(beatAt(opts.timeline,t).id==='S-c'||beatAt(opts.timeline,t).id==='S-d'||beatAt(opts.timeline,t).id==='S-e');
 const emitCrossed=(prevT:number,nextT:number)=>{
  for(const b of opts.timeline.beats){
   if(!b.cue||fired.has(b.id)||b.cue==='sail-board')continue;
   if(b.t0>prevT+1e-4&&b.t0<=nextT+1e-4){fired.add(b.id);emitTransit(b.cue as any,{t:nextT,region:'meadow',id:b.id});pushSailCue(b.cue,nextT);}
  }
  const sd=opts.timeline.beats.find(b=>b.id==='S-d')!;
  if(!fired.has('sail-cruise-loop-stop')&&prevT<sd.t1-1e-4&&nextT>=sd.t1-1e-4){fired.add('sail-cruise-loop-stop');emitTransit('sail-cruise-loop-stop',{t:nextT,region:'meadow'});pushSailCue('sail-cruise-loop-stop',nextT);}
 };
 const step=(dt:number,hidden:boolean)=>{
  if(hidden){setTransitHidden(true);return;}
  setTransitHidden(false);
  if(fade>0)fade=Math.max(0,fade-dt);
  if(phase==='arrival'){arrivalElapsed+=Math.max(0,dt);arrivalU=Math.min(1,arrivalElapsed/Math.max(1e-3,arrivalDur));return;}
  const prevT=t;
  real+=Math.max(0,dt);
  t=sailPresentationT(real,departAt,sc.t0,se.t1,opts.timeline.build05S,motionBudget);
  emitCrossed(prevT,t);
  const v=sailVehicle(opts.timeline,opts.route,t);
  if(opts.boat)placeBoat(opts.boat,v.pos,v.yaw,v.roll);
  if(seated()&&opts.rider){opts.rider.setPosition(0,0,0);opts.rider.setRotationFromEuler(0,0,0);drawSeated();}
  const pose=sailCamera(opts.timeline,opts.route,t,viewSize());
  opts.art?.sync(v,pose.position,dt,sailNight(),pose.target);
 };
 return {
  get t(){return t;},
  get real(){return real;},
  get phase(){return phase;},
  get arrivalU(){return arrivalU;},
  get arrivalElapsed(){return arrivalElapsed;},
  get departed(){return departAt!=null;},
  bindRider(node:Node){opts.rider=node;opts.riderHome=node.parent;},
  arm(){const b=opts.timeline.beats[0];if(!b?.cue||fired.has(b.id))return;fired.add(b.id);emitTransit(b.cue as any,{t:0,region:'meadow',id:b.id});pushSailCue(b.cue,0);},
  markBoard(){if(fired.has('S-b'))return;fired.add('S-b');emitTransit('sail-board',{t,region:'meadow',id:'S-b'});pushSailCue('sail-board',t);},
  /** Sit has finished. Attach her to the seat, then let the hull leave. `budget` is real seconds for S-c..S-e. */
  depart(budget:number){
   if(departAt!=null)return;
   motionBudget=budget;
   if(!opts.rider||!opts.seat){console.error('[QF_SAIL] cannot depart: rider or seat missing');throw Error('sail-rider-missing');}
   attachRider(opts.rider,opts.seat);opts.rider.setPosition(0,0,0);attached=true;
   captureSeated(opts.rider);
   const skel=opts.rider.getComponent(SkeletalAnimation)||opts.rider.getComponentInChildren(SkeletalAnimation);
   if(skel&&skel.useBakedAnimation)skel.useBakedAnimation=false;
   drawSeated();
   try{director.on(Director.EVENT_BEFORE_DRAW,drawSeated);}catch{/* draw hook is best-effort */}
   departAt=real;
  },
  releaseRider(){dropSeatedPose();const skel=opts.rider?.getComponent(SkeletalAnimation)||opts.rider?.getComponentInChildren(SkeletalAnimation);try{skel?.resume();}catch{/* already playing */}if(attached&&opts.rider&&opts.riderHome){detachRider(opts.rider,opts.riderHome);attached=false;}},
  beginArrival(path:Vec[],dur:number){
   phase='arrival';arrivalPath=path;arrivalU=0;arrivalElapsed=0;arrivalDur=Math.max(0.5,dur);followYaw={yaw:null};
   arrivalFrom=sailCamera(opts.timeline,opts.route,Math.min(t,opts.timeline.build05S),viewSize());
  },
  pose(screen:{w:number;h:number}):Pose{
   if(phase==='arrival'&&arrivalFrom){
    const board=opts.boardPose||arrivalFrom;
    return sailFollowCamera(arrivalPath,arrivalU,arrivalFrom,board,followYaw);
   }
   return sailCamera(opts.timeline,opts.route,t,screen);
  },
  onFrame(dt:number,hidden:boolean):Pose{
   const now=Date.now();if(last&&now-last>30000)fade=0.35;last=now;step(dt,hidden);
   const v=viewSize();
   if(phase==='arrival'&&arrivalFrom){
    const board=opts.boardPose||arrivalFrom;
    const pose=sailFollowCamera(arrivalPath,arrivalU,arrivalFrom,board,followYaw);
    const boat=sailVehicle(opts.timeline,opts.route,opts.timeline.build05S);
    opts.art?.sync(boat,pose.position,dt,sailNight(),pose.target);
    if(sailQaEnabled())pushSailFrame({t:arrivalElapsed,real,beat:'arrival',phase,yaw:boat.yaw,roll:boat.roll,boat:opts.boat,pose,departed:departAt!=null});
    return pose;
   }
   const pose=sailCamera(opts.timeline,opts.route,t,v);
   if(sailQaEnabled()){const sv=sailVehicle(opts.timeline,opts.route,t);pushSailFrame({t,real,beat:beatAt(opts.timeline,t).id,phase,yaw:sv.yaw,roll:sv.roll,boat:opts.boat,pose,departed:departAt!=null});}
   return pose;
  },
  get fade(){return fade;},
  seat(){const v=sailVehicle(opts.timeline,opts.route,t);return seatFromBench(v.pos,v.yaw);},
  shore(){return opts.shore;},
 };
}
export async function playSailBeats(driver:ReturnType<typeof createSailDriver>,actor:CharacterAdapter,world:WorldLease,token:Cancellation,plan:{
 total:number;approach:Vec[];deck:Vec[];disembark:Vec[];arrival:Vec[];sit:ReturnType<typeof seatFromBench>;stand:ReturnType<typeof seatFromBench>;
 boardS:number;arrivalS:number;boardPose?:Pose|null;
}):Promise<void>{
 const rider=(actor as {node?:Node}).node;
 if(!rider){console.error('[QF_SAIL] FlowReferenceStandin has no node; sail ride aborted');throw Error('sail-rider-missing');}
 driver.bindRider(rider);
 driver.arm();
 const wait=async()=>{token.check();if(world.wait)await world.wait(0.05,token);else driver.onFrame(1/60,!!world.isWorldVisible&&!world.isWorldVisible());};
 const until=async(time:number)=>{while(driver.t+1e-3<time)await wait();};
 const walk=(path:Vec[],stop:boolean)=>{const L=pathLen(path);const duration=Math.max(0.35,L/1.2);return actor.perform({kind:'walk',path,duration,stopAtEnd:stop} as any,token);};
 const board=[...plan.approach,plan.deck,plan.sit.position as unknown as Vec];
 await walk(board,true);
 driver.markBoard();
 await actor.perform({kind:'sit',seat:plan.sit},token);
 const standS=actor.actionSeconds?.('stand')||1.2;
 const offS=Math.max(0.35,pathLen(plan.disembark)/1.2);
 const sf=1;
 const used=driver.real;
 const motionBudget=Math.max(4,30.5-used-sf-standS-offS);
 driver.depart(motionBudget);
 await until(plan.total-plan.boardS);
 driver.releaseRider();
 await actor.perform({kind:'stand',seat:plan.stand},token);
 await walk(plan.disembark,true);
 await until(plan.total);
 if(plan.arrival.length>1){
  const dur=pathLen(plan.arrival)/1.2;
  driver.beginArrival(plan.arrival,dur);
  const walking=walk(plan.arrival,true);
  while(driver.arrivalU<1-1e-4)await wait();
  const held=driver.arrivalElapsed;
  while(driver.arrivalElapsed<held+2)await wait();
  await walking;
 }
}
