import {Director, Mat3, Mat4, MeshRenderer, Node, Quat, SkeletalAnimation, SkinnedMeshRenderer, Vec3, director, gfx, utils} from 'cc';
import type {Cancellation, CharacterAdapter, Pose, Vec, WorldLease} from '../world-r1/WorldFlowCore';
import {emitTransit, setTransitHidden} from './TransitAudioHooks';
import {beatAt, sailCamera, sailFollowCamera, sailPresentationT, sailVehicle, seatFromBench, type SailTimeline} from './TransportLeg';
import {attachRider, detachRider, placeBoat} from './TransportVehicle';
import type {SailArt} from './SailArt';
import {stopEngineStates} from './EngineAnimStop';
import {chainMark,guardBeforeWalk} from './TransitionChain';
import {TRANSITION_DURATIONS} from './TransitionStaging';
import type {GangwayDriver} from './SailGangway';
import {pushSailCue, pushSailFrame, sailQaEnabled} from './SailQaProbe';
function sailNight():boolean{try{const m=(globalThis as any).__worldDayNight?.snapshot?.()?.mode;return typeof m==='string'&&m.includes('night');}catch{return false;}}
function sailCueRegion(cue:string):string{
 if(cue==='sail-dock'||cue==='node-arrive')return 'meadow';
 if(cue==='node-walk-start')return 'island';
 return 'sail';
}
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
 /** The island long shot was still drawing the bind pose while the joint nodes sat. Bake the live skin once and draw that.
  *  Every submesh keeps its own material. Normals are skinned (inverse-transpose) and vertex colors are copied:
  *  a static mesh with no a_color is (0,0,0) under USE_VERTEX_COLOR, which turned the torso pure black while the
  *  dress (no vertex color) stayed yellow-green. Morph deltas are applied in mesh space before skinning. */
 const freezeDrawnPose=()=>{
  if(poseFrozen||!opts.rider)return;
  let hipY:number|null=null,footY:number|null=null;
  const walkH=(n:Node)=>{
   if(/hips$/i.test(n.name))hipY=n.worldPosition.y;
   if(/foot/i.test(n.name))footY=footY==null?n.worldPosition.y:Math.min(footY,n.worldPosition.y);
   for(const c of n.children)walkH(c);
  };
  walkH(opts.rider);
  if(hipY==null||footY==null||hipY-footY>=0.5)return;
  const tmp=new Vec3(),nacc=new Vec3(),acc=new Vec3(),local=new Vec3(),inv=new Mat4(),toLocal=new Mat3();
  const bindP=new Vec3(),bindN=new Vec3();
  let bakedAny=false;
  for(const skin of opts.rider.getComponentsInChildren(SkinnedMeshRenderer)){
   try{(skin.mesh as any)?.initialize?.();}catch{}
   const mesh=skin.mesh as any,skelData=skin.skeleton,root=skin.skinningRoot||opts.rider;
   if(!mesh||!skelData||!skelData.joints.length)continue;
   const prims=mesh.struct?.primitives?.length||0;
   if(!prims||!Mat4.invert(inv,skin.node.worldMatrix))continue;
   Mat3.fromMat4(toLocal,inv);Mat3.transpose(toLocal,toLocal);
   const bones=skelData.joints.map((path:string)=>root.getChildByPath(path));
   for(const bone of bones){try{bone?.updateWorldTransform();}catch{/* */}}
   const binds=skelData.bindposes as Mat4[];
   const skinMs=binds.map((bind,i)=>{const m=new Mat4();if(bones[i]&&bind)Mat4.multiply(m,bones[i]!.worldMatrix,bind);return m;});
   const nrmMs=skinMs.map(m=>{const n=new Mat3();Mat3.fromMat4(n,m);if(Math.abs(Mat3.determinant(n))<1e-8||!Mat3.invert(n,n))return null;Mat3.transpose(n,n);return n;});
   const maps=mesh.struct.jointMaps as number[][]|undefined;
   const made:Node[]=[];
   let minY=Infinity,maxY=-Infinity,ok=true;
   for(let prim=0;prim<prims;prim++){
    const src=mesh.readAttribute(prim,gfx.AttributeName.ATTR_POSITION);
    const joints=mesh.readAttribute(prim,gfx.AttributeName.ATTR_JOINTS);
    const weights=mesh.readAttribute(prim,gfx.AttributeName.ATTR_WEIGHTS);
    const indices=mesh.readIndices(prim);
    if(!(src instanceof Float32Array)||!joints||!weights||!indices){ok=false;break;}
    const count=src.length/3;
    const jStride=joints.length/count,wStride=(weights as ArrayLike<number>).length/count;
    if(jStride<1||wStride<1){ok=false;break;}
    const pos=new Float32Array(src.length);
    const srcN=mesh.readAttribute(prim,gfx.AttributeName.ATTR_NORMAL);
    const nrm=new Float32Array(src.length);
    const morph=mesh.struct.morph?.subMeshMorphs?.[prim];
    const posAi=morph?morph.attributes.indexOf(gfx.AttributeName.ATTR_POSITION):-1;
    const nrmAi=morph?morph.attributes.indexOf(gfx.AttributeName.ATTR_NORMAL):-1;
    const morphW:{w:number;data:Float32Array|null;nd:Float32Array|null}[]=[];
    if(morph){
     const table=(skin as {_subMeshShapesWeights?:number[][]})._subMeshShapesWeights;
     for(let ti=0;ti<morph.targets.length;ti++){
      let w=0;
      if(table&&table[prim]&&ti<table[prim].length)w=table[prim][ti];
      else {try{w=skin.getWeight(prim,ti);}catch{w=morph.weights?.[ti]||0;}}
      if(!w)continue;
      const view=posAi>=0?morph.targets[ti].displacements[posAi]:null;
      const nview=nrmAi>=0?morph.targets[ti].displacements[nrmAi]:null;
      const data=view?new Float32Array(mesh.data.buffer,mesh.data.byteOffset+view.offset,view.count):null;
      const nd=nview?new Float32Array(mesh.data.buffer,mesh.data.byteOffset+nview.offset,nview.count):null;
      morphW.push({w,data,nd});
     }
    }
    const map=maps&&maps[prim];
    const kn=Math.min(4,jStride,wStride);
    for(let v=0;v<count;v++){
     bindP.set(src[v*3],src[v*3+1],src[v*3+2]);
     const hasN=srcN&&(srcN as ArrayLike<number>).length>=(v+1)*3;
     if(hasN)bindN.set((srcN as ArrayLike<number>)[v*3],(srcN as ArrayLike<number>)[v*3+1],(srcN as ArrayLike<number>)[v*3+2]);
     else bindN.set(0,1,0);
     for(const mw of morphW){
      const d=mw.data,nd=mw.nd,w=mw.w;
      if(d&&d.length>=(v+1)*3){bindP.x+=d[v*3]*w;bindP.y+=d[v*3+1]*w;bindP.z+=d[v*3+2]*w;}
      if(nd&&nd.length>=(v+1)*3){bindN.x+=nd[v*3]*w;bindN.y+=nd[v*3+1]*w;bindN.z+=nd[v*3+2]*w;}
     }
     acc.set(0,0,0);nacc.set(0,0,0);let wsum=0;
     for(let k=0;k<kn;k++){
      let ji=(joints as ArrayLike<number>)[v*jStride+k]|0;
      if(map&&ji<map.length)ji=map[ji];
      const w=(weights as ArrayLike<number>)[v*wStride+k];
      if(!w||!skinMs[ji]||!bones[ji])continue;
      Vec3.transformMat4(tmp,bindP,skinMs[ji]);
      acc.x+=tmp.x*w;acc.y+=tmp.y*w;acc.z+=tmp.z*w;wsum+=w;
      const nm=nrmMs[ji];
      if(nm){Vec3.transformMat3(tmp,bindN,nm);nacc.x+=tmp.x*w;nacc.y+=tmp.y*w;nacc.z+=tmp.z*w;}
     }
     if(wsum<=0){pos[v*3]=bindP.x;pos[v*3+1]=bindP.y;pos[v*3+2]=bindP.z;nrm[v*3]=bindN.x;nrm[v*3+1]=bindN.y;nrm[v*3+2]=bindN.z;continue;}
     acc.x/=wsum;acc.y/=wsum;acc.z/=wsum;
     if(acc.y<minY)minY=acc.y;if(acc.y>maxY)maxY=acc.y;
     Vec3.transformMat4(local,acc,inv);
     pos[v*3]=local.x;pos[v*3+1]=local.y;pos[v*3+2]=local.z;
     if(nacc.lengthSqr()>1e-8)nacc.normalize();else nacc.set(0,1,0);
     Vec3.transformMat3(tmp,nacc,toLocal);
     if(tmp.lengthSqr()>1e-8)tmp.normalize();else tmp.set(0,1,0);
     nrm[v*3]=tmp.x;nrm[v*3+1]=tmp.y;nrm[v*3+2]=tmp.z;
    }
    const uvs=mesh.readAttribute(prim,gfx.AttributeName.ATTR_TEX_COORD);
    const cols=mesh.readAttribute(prim,gfx.AttributeName.ATTR_COLOR);
    const geo:any={positions:pos,normals:nrm,indices:Array.from(indices as ArrayLike<number>)};
    if(uvs)geo.uvs=uvs;
    if(cols){
     const cc=(cols as ArrayLike<number>).length/count;
     const rgba=new Float32Array(count*4);
     for(let v=0;v<count;v++){
      rgba[v*4]=(cols as ArrayLike<number>)[v*cc];
      rgba[v*4+1]=cc>1?(cols as ArrayLike<number>)[v*cc+1]:1;
      rgba[v*4+2]=cc>2?(cols as ArrayLike<number>)[v*cc+2]:1;
      rgba[v*4+3]=cc>3?(cols as ArrayLike<number>)[v*cc+3]:1;
      if(rgba[v*4]>1.5){rgba[v*4]/=255;rgba[v*4+1]/=255;rgba[v*4+2]/=255;if(cc>3)rgba[v*4+3]/=255;}
     }
     geo.colors=rgba;
    }
    let baked;
    try{baked=utils.createMesh(geo,undefined,{calculateBounds:true});}
    catch{ok=false;break;}
    const node=new Node('sail_frozen_pose');
    node.layer=skin.node.layer;
    skin.node.addChild(node);node.setPosition(0,0,0);node.setRotationFromEuler(0,0,0);node.setScale(1,1,1);
    const rend=node.addComponent(MeshRenderer);
    rend.mesh=baked;
    rend.shadowCastingMode=skin.shadowCastingMode;
    const shared=skin.sharedMaterials;
    const mat=shared[prim]||shared[0];
    if(mat)rend.setSharedMaterial(mat,0);
    made.push(node);
   }
   // A standing bind-pose bake is about 1.6 m. Sitting is about a metre. Accessories (hat) are shorter.
   if(!ok||!(maxY-minY>0.05&&maxY-minY<1.25)){for(const n of made)n.destroy();continue;}
   for(const n of made)frozenNodes.push(n);
   skin.enabled=false;hiddenSkins.push(skin);bakedAny=true;
  }
  poseFrozen=bakedAny;
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
   if(b.t0>prevT+1e-4&&b.t0<=nextT+1e-4){fired.add(b.id);emitTransit(b.cue as any,{t:nextT,region:sailCueRegion(String(b.cue)),id:b.id});pushSailCue(b.cue,nextT);}
  }
  const sd=opts.timeline.beats.find(b=>b.id==='S-d')!;
  if(!fired.has('sail-cruise-loop-stop')&&prevT<sd.t1-1e-4&&nextT>=sd.t1-1e-4){fired.add('sail-cruise-loop-stop');emitTransit('sail-cruise-loop-stop',{t:nextT,region:sailCueRegion('sail-cruise-loop-stop')});pushSailCue('sail-cruise-loop-stop',nextT);}
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
  arm(){const b=opts.timeline.beats[0];if(!b?.cue||fired.has(b.id))return;fired.add(b.id);emitTransit(b.cue as any,{t:0,region:sailCueRegion(String(b.cue)),id:b.id});pushSailCue(b.cue,0);},
  markBoard(){if(fired.has('S-b'))return;fired.add('S-b');emitTransit('sail-board',{t,region:sailCueRegion('sail-board'),id:'S-b'});pushSailCue('sail-board',t);},
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
  // fix-cloud-sit: NOT resuming the SkeletalAnimation — that replayed the engine's own sit_hold state (play+pause by drawSeated), which then
  // overwrote the rig-driven stand_up / walk_loop every frame: she slid ashore and across the meadow seated. Stop every
  // engine-played state instead (same rule as the lakeside get-out, 1033173f).
  releaseRider(){dropSeatedPose();const skel=opts.rider?.getComponent(SkeletalAnimation)||opts.rider?.getComponentInChildren(SkeletalAnimation);stopEngineStates(skel as any,'sail disembark');if(attached&&opts.rider&&opts.riderHome){detachRider(opts.rider,opts.riderHome);attached=false;}},
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
 /** transitions-continuous (TransitionStaging): pier end + deck edge (A2 gangplank), shown props hidden on cue. */
 pier?:Vec[];plankOn?:Vec[];props?:{islandPlank?:Node|null;pier?:Node|null;meadowPlank?:Node|null;ramp?:Node|null;gangway?:GangwayDriver|null};
}):Promise<void>{
 const rider=(actor as {node?:Node}).node;
 if(!rider){console.error('[QF_SAIL] FlowReferenceStandin has no node; sail ride aborted');throw Error('sail-rider-missing');}
 driver.bindRider(rider);
 driver.arm();
 const wait=async()=>{token.check();if(world.wait)await world.wait(0.05,token);else driver.onFrame(1/60,!!world.isWorldVisible&&!world.isWorldVisible());};
 const until=async(time:number)=>{while(driver.t+1e-3<time)await wait();};
 const walk=(path:Vec[],stop:boolean,secs?:number)=>{const L=pathLen(path);const duration=secs&&secs>0?secs:Math.max(0.35,L/1.2);return actor.perform({kind:'walk',path,duration,stopAtEnd:stop} as any,token);};
 const anim0=(actor as any).anim||rider.getComponent(SkeletalAnimation)||rider.getComponentInChildren(SkeletalAnimation);
 const show=(n:Node|null|undefined,on:boolean)=>{try{if(n&&n.isValid&&n.active!==on)n.active=on;}catch{/* prop optional */}};
 show(plan.props?.pier,true);show(plan.props?.ramp,true);show(plan.props?.islandPlank,true);show(plan.props?.meadowPlank,false);
 const gw=plan.props?.gangway||null;try{gw?.swing('island',0.8)/* cand7: real gangway lowered onto island_dock while she walks to it */;}catch{}
 // A1: visible walk from the last island level to the pier (no cover); A2: over the gangplank onto the deck, sit.
 chainMark('sail','A1-pier-walk');guardBeforeWalk(anim0,'A1 pier walk');
 const D=TRANSITION_DURATIONS.seg1;let realI6=0;
 if(plan.pier&&plan.pier.length){await walk(plan.approach,true,D.nodeWalkI4toI6)/* level stop → new I6, visible now */;realI6=driver.real;guardBeforeWalk(anim0,'A1 dock walk');
  await walk([plan.approach[plan.approach.length-1],...plan.pier] as Vec[],true,D.a1DockWalk);chainMark('sail','A2-gangplank-board');guardBeforeWalk(anim0,'A2 gangplank');
  await walk([plan.pier[plan.pier.length-1],...(plan.plankOn||[]),plan.deck] as Vec[],true,D.a2Gangway);}
 else{await walk([...plan.approach,plan.deck,plan.sit.position as unknown as Vec],true);chainMark('sail','A2-gangplank-board');}
 driver.markBoard();
 await actor.perform({kind:'sit',seat:plan.sit},token);
 const standS=actor.actionSeconds?.('stand')||1.2;
 const offS=plan.pier?TRANSITION_DURATIONS.seg2.offBoat:Math.max(0.35,pathLen(plan.disembark)/1.2);
 const sf=1;
 const used=driver.real;
 // b19: the I4→I6 walk is now visible (not in the 30.5 s sail budget); boarding (+1.5 s) and the stand+gangway off (+2 s) grew,
 // so the sail motion keeps its d9423886 length instead of being squeezed.
 const motionBudget=Math.max(4,30.5-(used-realI6)-sf-standS-offS+(plan.pier?3.5:0));
 driver.depart(motionBudget);
 chainMark('sail','A3-sail');show(plan.props?.islandPlank,false)/* plank drawn back as she casts off */;try{gw?.swing('stowed-island',0.8);}catch{}
 await until(plan.total-plan.boardS);
 chainMark('sail','A4-dock');show(plan.props?.meadowPlank,true);try{gw?.swing('meadow',0.8)/* side swap happens upright (stowed→stowed), then lowers */;}catch{}
 show(plan.props?.pier,false);show(plan.props?.ramp,false)/* cand7: island left — island-side placeholders off */;
 driver.releaseRider();
 // fix-cloud-sit: guard again right before stand_up and before the disembark walk (the actor's anim = her SkeletalAnimation)
 const anim=(actor as any).anim||rider.getComponent(SkeletalAnimation)||rider.getComponentInChildren(SkeletalAnimation);
 stopEngineStates(anim,'sail stand');
 await actor.perform({kind:'stand',seat:plan.stand},token);
 chainMark('sail','A5-gangplank-off');guardBeforeWalk(anim,'A5 gangplank off');stopEngineStates(anim,'sail walk');
 await walk(plan.disembark,true,plan.pier?TRANSITION_DURATIONS.seg2.offBoat:undefined);
 await until(plan.total);
 if(plan.arrival.length>1){
  const dur=pathLen(plan.arrival)/1.2;
  driver.beginArrival(plan.arrival,dur);
  chainMark('sail','A6-meadow-first');guardBeforeWalk(anim,'A6 meadow first stop');
 const walking=walk(plan.arrival,true);
  while(driver.arrivalU<1-1e-4)await wait();
  const held=driver.arrivalElapsed;
  while(driver.arrivalElapsed<held+2)await wait();
  await walking;
 }
}
