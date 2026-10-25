import './SharedBundles';
import { flowTestLayout, readFlowTestHost } from './world-r2/FlowTestLayout';
import { qaTransportEnabled } from './region/JourneyTransport';
import { qaSkipTarget, qaHooksEnabled, qaQuery } from './world-r2/QaSkip';
import { DEBUG, MINIGAME } from 'cc/env';
import {setScreenCover,setCoverContentHost,setCoverAudioHost,addCoverReadyCheck,coverContent} from './world-r1/ScreenCover';
import {IslandHomeInteraction} from './world-r2/IslandHomeInteraction';
import {IslandJourneyOverlay} from './world-r2/IslandJourneyOverlay';
import {IslandToast,LAKESIDE_NOT_READY_TEXT} from './ui/IslandToast';
import {DialogBubble} from './ui/DialogBubble';
import {DevPreviewMark} from './ui/DevPreviewMark';
import {LAKESIDE_LOAD_FAILED,prewarmLakesideAssets} from './region/LakesideBoardBackground';
import {CabinHint} from './world-r2/CabinHint';
import {cabinHintSeen,markCabinHintSeen} from './ui/UiPrefs';
import {applyJourneyNavigationSkin} from './ui/JourneyNavigationSkin';
import {ISLAND_NAV_IDS,worldNavigationLayout} from './world-r2/WorldNavigationLayout';
import {signRectOnScreen} from './world-r2/IslandPropsLayout';
import { RoomExploreOverlay } from './RoomExploreOverlay';
import { GlassSign } from './world-r1/GlassSign';
import { warmButton, WarmButton } from './WarmButton';
import { installPreTransition } from './world-r2/PreTransitionRun';
import {_decorator,Component,Prefab,assetManager,isValid,EffectAsset,JsonAsset,Camera,Node,Canvas,UITransform,Layers,Label,Graphics,Color,Vec3,view,ResolutionPolicy,director,instantiate,game,Game,MeshRenderer,Material,utils,primitives,profiler,SkeletalAnimation,AnimationClip,resources,ImageAsset,Texture2D,SpriteFrame,Sprite,UIOpacity} from 'cc';
import {WorldNativeComposition} from './world-r2/WorldNativeComposition';
import {IslandProps} from './world-r2/IslandProps';
import {emitPropTap,setPropTapLook,onPropTap} from './world-r2/IslandPropTaps';
import {CHARACTER_REFERENCE as REF} from './world-r1/CharacterReference';
import {pointOnPath,Cancelled} from './world-r1/WorldFlowCore';
import {CHARACTER_POSE_BLEND,CROSSFADE_S,WALK_JOIN_GRACE_S,WALK_YAW_LOOKAHEAD_M,WALK_YAW_SNAP_DEG,TURN_FOLD_MIN_S,foldedTurnDuration,CLIP_ROLES,MotionClock,YawFollower,parseAnimMeta,defaultMotionConfig,stopTail,chooseTurn,wrapAngle,globMatch,capture,writePose,blendPose,applyLayer,STRIDE,MorphDriver,morphWeights,SoleContactSolver,supportPose,
  planWalk,walkDistanceAt,stopCandidates,stopLateralAt,piecewise,restAheadFromRoutes,FOOT_DEDUPE_S,DEFAULT_NATIVE_SPEED} from './CharacterMotion';
import type {MotionConfig,FootEvent,Joint,Plan,WalkPlan,Body} from './CharacterMotion';
import {createFirstsliceRoutes} from './world-r1/FirstsliceRoutes';
import {FIRSTSLICE} from './world-r1/FirstsliceFacts';
import type {CharacterAdapter,Action,Cancellation,StablePose} from './world-r1/WorldFlowCore';
import {StartupReadyGate,StartupAttempt,StartupCancelled} from './world-r2/StartupReadyGate';
import {ManagedMobileBoardUI} from './ManagedMobileBoardUI';
import {StartupLoadingLayer} from './ui/StartupLoadingLayer';
import {ART as STARTUP_ART} from './ui/StartupLoadingLayout';
import {REGIONS,loadRegionPrefab,mountRegion} from './region/RegionLoader';
import {sailShotRequested,startSailShot} from './region/SailShot';
import {validateSkycity} from './region/RegionValidation';
import {runHomeTransition,HOME_FADE} from './world-r2/HomeTransition';
import {WindWipeView} from './ui/WindWipe';
import {EndingScreen,markJourneyComplete} from './ui/EndingScreen';
import {playEnding,endingToIsland,endingAvailable,type EndingHost} from './world-r2/EndingFlow';
import {runWindWipe,wipeContentFor} from './world-r2/WindWipeCore';
import {LakesideArrivalUI} from './ui/LakesideArrivalUI';
import {boardSafeInsets as arrivalSafeInsets} from './ui/BoardLayout';
import {ForegroundTimers} from './world-r2/ForegroundClock';
import {GameAudio} from './audio/GameAudio';
import {FootstepAudio} from './audio/FootstepAudio';
import {SCENE_TRACKS} from './audio/SceneMusic';
const {ccclass,property}=_decorator;
/** Claims fired in one turn share a single invoke. The busy gate would otherwise drop every call after the first. */
function enqueueResultBatch(start:(run:()=>Promise<any>)=>void):(fn:()=>any)=>void{
  let q:Array<()=>any>|null=null,running=false;
  return (fn:()=>any)=>{
    if(running)return;
    if(!q){
      const batch:Array<()=>any>=[];q=batch;
      // A microtask, not a timer: every claim fired by the same 全部领取 tap is already queued when it runs.
      void Promise.resolve().then(()=>{
        if(q!==batch)return;q=null;
        start(async()=>{
          running=true;
          try{
            let last:any={ok:true};
            for(let i=0;i<batch.length;i++){const r=await batch[i]();last=r;if(r&&r.ok===false&&r.reason!=='cancelled')return r;}
            return last;
          }finally{running=false;}
        });
      });
    }
    q.push(fn);
  };
}
/** end enqueueResultBatch */
/** R3: flow states in which the T9 signpost is hidden (everything except island-idle, level/skycity + loading, paused, error). */
const SIGN_AWAY_STATES=['idle','loading','home','standing','turning-out','walking-out','opening-door','crossing-out','walking-home','crossing-in','closing-door','walking-to-seat','sitting','region-loading','region-travel','meadow','lakeside'];
/** Island world art lives in the region_island Asset Bundle (subpackage or remote), never in the start scene's static deps. */

/** Explicit flow-reference stand-in. The calibrated flag certifies only these reference coordinates,
 * never B body/clothing/contact. No root motion/collision acceptance.
 * Walk driver (GGbot, docs/walk-driver.md): the controller moves the root along the path; the in-place walk clip's time
 * advances by distance (Δs / native_speed), keeps its phase across back-to-back walks, yaw follows the path tangent
 * rate-limited (WALK_YAW_MAX_DEG_S); onFoot from phase crossings; crossfades + masked wind layers (CHARACTER_POSE_BLEND);
 * apron morph targets (MorphDriver: anim_meta curves, written with setWeight after the pose, baked and blend paths alike). */
// Isolated handoff candidate. Per-frame evidence is opt-in; default never appends diagnostic global arrays.
class FlowReferenceStandin implements CharacterAdapter {
 readonly calibrated=true;
 readonly coordinates={units:'m' as const,up:'+Y' as const,forward:'+Z' as const,rootMotion:'controller-only' as const,standingRoot:REF.standingRoot,seatedRoot:REF.seatedRoot,seatYawRad:REF.seatYawRad,clearanceRadiusM:.15};
 private settleQueued:any=null;
 private support:SoleContactSolver|null=null;private job:any=null;private anim:SkeletalAnimation|null=null;private rig:AnimRig|null=null;private clock:MotionClock|null=null;private disposed=false;
 private motionConfig:MotionConfig=defaultMotionConfig();private pendingIdle=false;private pendingFor=0;private yaw=new YawFollower();private yawRad=0;
 private windSource:(()=>number|null)|null=null;private wind=0;private idleFor=0;private nextGust=-1;
 private restAhead:((path:readonly (readonly number[])[])=>number|null)|null=null;private lastFoot:Body|null=null;private lastFootEmit:{bone:string;clip:string;t:number}|null=null;private footDeduped=0;private motionT=0;
 private lastSpeed=0;private stopRoot:{clip:string;end:[number,number,number];yaw:number;S:number;scale:number;forward:Array<[number,number]>;lateral:Array<[number,number]>|null}|null=null;private stopHold=0;private lastPlan:any=null;
 private morphs:MorphDriver[]=[];private morphW:{[target:string]:number}={};private footListeners:Array<(e:FootEvent)=>void>=[];private apronListeners:Array<(strength:'full'|'soft',durationSec:number)=>void>=[];
 constructor(private node:Node){}
 private ninetyLandingSamples:any[]=[];private turnLandingSamples:any[]=[];private turnLandingIdle:any=null;private motionEvents:any[]=[];
 private logEvent(e:any){e.utc=new Date().toISOString();this.motionEvents.push(e);if(this.motionEvents.length>64)this.motionEvents.shift();}
 diagnostics(){const p=this.node.worldPosition,c=this.clock,ph=c?.phase()??null,plan=c?.plan()??null;
  return {clip:ph?.clip??'',time:ph?.time??null,duration:c?.base?.duration??null,loop:c?.base?.loop??false,manualClock:true,action:this.job?.action.kind??null,root:[p.x,p.y,p.z],disposed:this.disposed,availableClips:this.anim?.clips.filter(Boolean).map(x=>({name:x.name,duration:x.duration})),events:this.motionEvents.slice(-32),
   motion:{blend:!!this.rig?.blend,crossfadeS:CROSSFADE_S,phase:ph?ph.phase:null,cycle:ph?ph.cycle:null,fade:plan?.out??null,layers:plan?plan.layers.map(l=>({clip:l.clip,weight:l.weight,mode:l.mode})):[],walkProgress:this.walkProgress(),pendingIdle:this.pendingIdle,
    walkPlan:this.lastPlan,lastFoot:this.lastFoot,footDeduped:this.footDeduped,stopRoot:this.stopRoot?this.stopRoot.clip:null,yawDeg:this.yawRad*180/Math.PI,yawRateDegS:this.yaw.rate*180/Math.PI,wind:this.wind,flutterWeight:c?c.flutterWeight():0,apron:c?.apron?{time:c.apron.abs,lift:c.apron.lift,settle:c.apron.settle}:null,gust:c?.gust?{t:c.gust.t,d:c.gust.d}:null,
    apronLiftThreshold:this.motionConfig.apronLiftThreshold,metaSource:this.motionConfig.source,notes:c?c.notes.slice():[],joints:this.rig?.joints.length??0,repairedStates:this.rig?this.rig.repaired.slice():[],clipEval:this.rig&&ph?this.rig.evalStatus(ph.clip):null,morph:this.morphDiagnostics()}};}
 /** Morph binding + last written weights (docs/walk-driver.md §8): top level = the apron (morphMesh), meshes = every driven mesh
  *  (apron, yellow dress). status: unbound|ok|not-found|morph-disabled|no-morph|too-few-targets|error. */
 morphDiagnostics(){const ms=this.morphs;let d:any,all:any[];
  if(ms.length)all=ms.map(m=>m.diagnostics());else all=this.motionConfig.morphMeshes.map(b=>({status:'unbound',reason:'no visual bound',mesh:b.mesh,targets:b.targets,setWeightCalls:0}));
  d={};for(const k in all[0])if(Object.prototype.hasOwnProperty.call(all[0],k))d[k]=all[0][k];d.meshes=all;return d;}
 /** anim_meta.json (character/anim_meta in region_island) parsed before bindVisual; null/invalid = built-in defaults. */
 setAnimMeta(json:any){this.motionConfig=parseAnimMeta(json);this.support=new SoleContactSolver(json?.sole_contact);}
 /** Per-frame wind strength 0..1 (运镜bot WorldFlowComponent.getWindStrength); absent/null = 0. */
 setWindSource(fn:(()=>number|null)|null){this.windSource=fn;}
 /** Rest look-ahead (docs/walk-driver.md §9.2): metres still walked after this path before she rests; 0 = this walk ends at
  *  rest (stop clip inside it), > 0 = continuous chain (stride warp steers toward the stop), null = unknown (no stop planned).
  *  A walk action's own stopAtEnd (boolean) wins. Boot: restAheadFromRoutes(routes). None = never planned (old behaviour). */
 setWalkRestAhead(fn:((path:readonly (readonly number[])[])=>number|null)|null){this.restAhead=fn;}
 bindVisual(visual:Node){if(this.disposed)throw Error('Character disposed');this.anim=visual.getComponent(SkeletalAnimation)||visual.getComponentInChildren(SkeletalAnimation);if(!this.anim)throw Error('Character SkeletalAnimation missing');
  this.rig=new AnimRig(this.anim,CHARACTER_POSE_BLEND);this.clock=new MotionClock(this.motionConfig,this.rig);
  // Morph meshes (apron, yellow dress): renderer found by node / mesh name under the visual (SkinnedMeshRenderer is a MeshRenderer). Missing / no morph = status only.
  let rs:any[]=[];try{rs=typeof (visual as any).getComponentsInChildren==='function'?(visual as any).getComponentsInChildren(MeshRenderer)||[]:[];}catch{rs=[];}
  this.morphs=this.motionConfig.morphMeshes.map(b=>{const m=new MorphDriver(b.mesh,b.targets);m.bind(rs);return m;});
  if(this.rig.has('walk_turn_90_bodyL')){const saved=new Float64Array(this.rig.joints.length*STRIDE);capture(this.rig.joints,saved);const times=new Set<number>();for(const t of [.35,.75,1.3333333333333333])for(const dt of [-1/240,0,1/240])times.add(t+dt);for(const time of Array.from(times).sort((a,b)=>a-b)){if(time<.2)this.rig.apply({base:{clip:'walk_turn_90_bodyL',time,loop:false},out:{clip:CLIP_ROLES.idle,time,weight:1-time/.2},layers:[],morph:[]});else (this.rig as any).sample('walk_turn_90_bodyL',time);this.ninetyLandingSamples.push({time,pose:supportPose(this.rig.joints)});}(this.rig as any).sample(CLIP_ROLES.idle,0);this.turnLandingIdle=supportPose(this.rig.joints);writePose(this.rig.joints,saved);}
  if(this.rig.has('walk_turn_180_bodyR')){const saved=new Float64Array(this.rig.joints.length*STRIDE);capture(this.rig.joints,saved);const times=new Set<number>();for(const t of [.075,.38,.4,.98,1.02,1.4])for(const dt of [-1/240,0,1/240])times.add(t+dt);for(const time of Array.from(times).sort((a,b)=>a-b)){if(time<.2)this.rig.apply({base:{clip:'walk_turn_180_bodyR',time,loop:false},out:{clip:CLIP_ROLES.idle,time,weight:1-time/.2},layers:[],morph:[]});else (this.rig as any).sample('walk_turn_180_bodyR',time);this.turnLandingSamples.push({time,pose:supportPose(this.rig.joints)});}(this.rig as any).sample(CLIP_ROLES.idle,0);this.turnLandingIdle=supportPose(this.rig.joints);writePose(this.rig.joints,saved);}
  this.playNamed('sit_hold',true,0);}
 private requireClip(name:string){const anim=this.anim;const clip=anim?.clips.find(c=>c?.name===name);if(!anim||!clip)throw Error('Character clip missing: '+name);if(!Number.isFinite(clip.duration)||clip.duration<=0)throw Error('Invalid character clip duration: '+name);return clip.duration;}
 /** The controller is the sole clock (Creator 3.8.8: paused/unplayed states, public setTime/sample). keep: same clip stays at its phase. */
 private playNamed(name:string,loop:boolean,fade=-1,keep=false,time=0){if(this.disposed||!this.clock)return;
  if(this.stopHold>0&&this.clock.base&&name!==this.clock.base.clip){this.stopHold=0;this.clock.releaseHold();}
  const d=this.requireClip(name);
  if(this.clock.play(name,loop,{fade,keep,time}))this.logEvent({clip:name,duration:d,fade:fade<0?CROSSFADE_S:fade});this.render();return d;}
 private render(dt=0){if(!this.rig||!this.clock)return;const plan=this.clock.plan(),j=this.job;
  // A held outgoing pose was authored in the controller frame at action entry. Reproject it into the moving
  // controller frame before blending; otherwise the first 0.2 s of sit/stand drags the planted feet ~20 mm.
  // +Z forward, +Y up, unit-scale visual; translation is applied only to the outgoing root joint pose buffer.
  if(plan.out&&j&&(j.action.kind==='sit'||j.action.kind==='stand')){const p=this.node.worldPosition,dx=j.from[0]-p.x,dy=j.from[1]-p.y,dz=j.from[2]-p.z,sy=Math.sin(this.yawRad),cy=Math.cos(this.yawRad);
   plan.out.controllerOffset=[cy*dx-sy*dz,dy,sy*dx+cy*dz];
   // sit_down's root/hips/leg frame zero matches idle; keep its authored foot-lock chain intact.
   // Upper body still crossfades. Blending two articulated leg chains can slide feet even in one frame.
   plan.out.preserveIncomingLowerBody=(j.action.kind==='sit'&&plan.out.clip===CLIP_ROLES.idle||j.action.kind==='stand'&&plan.out.clip===CLIP_ROLES.sitHold);}
  this.rig.apply(plan);const p=this.node.worldPosition;this.support?.apply(this.rig.joints,[p.x,p.y,p.z],this.yawRad,!!plan.base&&(this.support.settling()||/^walk_(loop|start|stop_body[LR]|turn_180_bodyR|turn_90_bodyL)$/.test(plan.base.clip)||plan.base.clip===CLIP_ROLES.idle&&(this.support.hasContacts()||(plan.out?.clip==='walk_turn_180_bodyR'||plan.out?.clip==='walk_turn_90_bodyL'))),dt,plan);for(const bone of this.support?.takeSettleLandings()||[]){const body=bone==='foot.L'?'R':'L';this.noteSettle({def:{name:'settle:'+body,bone,body,type:'settle'},clip:plan.base?.clip});}this.applyMorph(plan);}
 /** After the pose write: same crossfade / layer weights as the pose (CharacterMotion.morphWeights), setWeight only on change. */
 private applyMorph(plan:Plan){const ms=this.morphs,c=this.clock;if(!c)return;let any=false;for(let i=0;i<ms.length;i++)if(ms[i].status==='ok')any=true;if(!any)return;
  try{morphWeights(c.cfg,plan,c.windDrive(),this.morphW);}catch(e){for(let i=0;i<ms.length;i++)if(ms[i].status==='ok'){ms[i].status='error';ms[i].reason=String(e);}return;}
  for(let i=0;i<ms.length;i++){const m=ms[i];if(m.status!=='ok')continue;try{m.apply(this.morphW);}catch(e){m.status='error';m.reason=String(e);}}}
 private setYaw(rad:number){this.yawRad=rad;this.node.setRotationFromEuler(0,rad*180/Math.PI,0);}
 playDoorReach(){if(this.disposed||this.job||!this.node.active||!this.rig?.has(CLIP_ROLES.doorReach))return false;this.pendingIdle=false;this.playNamed(CLIP_ROLES.doorReach,false);return true;}
 /** Optional WorldFlow contract. Missing door clip retains the legacy one-second door-only fallback. */
 doorReachTiming(){if(!this.rig?.has(CLIP_ROLES.doorReach))return null;const durationSec=this.rig.duration(CLIP_ROLES.doorReach),m=this.clock?.meta(CLIP_ROLES.doorReach),contact=m?.contactTime;
  return {durationSec,contactSec:contact!==undefined&&Number.isFinite(contact)?Math.max(0,Math.min(durationSec,contact)):0};}
 performDoorReach(token:Cancellation):Promise<void>{token.check();const timing=this.doorReachTiming();if(!timing)return Promise.reject(Error('Character clip missing: '+CLIP_ROLES.doorReach));
  if(!this.playDoorReach())return Promise.reject(Error('Character door reach unavailable'));
  return new Promise((resolve,reject)=>{const p=this.node.worldPosition,j:any={action:{kind:'door-reach'},duration:timing.durationSec,from:[p.x,p.y,p.z],elapsed:0,resolve,reject,off:()=>{}};this.job=j;
   j.off=token.onCancel(()=>{if(this.job===j)this.job=null;reject(new Cancelled());});});}
 private readWind():number {let v:any=0;try{v=this.windSource?this.windSource():0;}catch{v=0;}return typeof v==='number'&&v>0?(v<1?v:1):0;}
 /** One contact = one event: entry_contact events (the walk_loop heel strike a stop clip starts on, already emitted by
  *  walk_loop) and a same-bone event on another clip within FOOT_DEDUPE_S are skipped (logged as foot-dedupe). */
 private emitFoot(f:any){const def=f.def,prev=this.lastFootEmit;
  if(def.entryContact||prev&&prev.bone===def.bone&&prev.clip!==f.clip&&this.motionT-prev.t<FOOT_DEDUPE_S){this.footDeduped++;this.logEvent({kind:'foot-dedupe',event:def.name,clip:f.clip,reason:def.entryContact?'entry_contact':'same contact'});return;}
  this.lastFootEmit={bone:def.bone,clip:f.clip,t:this.motionT};this.lastFoot=def.body;
  const p=this.node.worldPosition;const e:FootEvent={event:def.name,bone:def.bone,body:def.body,clip:f.clip,phase:def.time/f.duration,time:def.time,cycle:f.cycle,pos:[p.x,p.y,p.z],type:def.type||'heel_strike'};
  this.logEvent({kind:'foot',type:e.type,event:e.event,bone:e.bone,body:e.body,clip:e.clip,phase:e.phase,cycle:e.cycle,pos:[p.x,p.z]});const list=this.footListeners.slice();for(let i=0;i<list.length;i++){try{list[i](e);}catch(err){console.warn('onFoot listener failed',String(err));}}}
 /** settle:* (stop clips: small step that brings the feet side by side, < 0.25 m): not a footstep, so not on onFoot
  *  (anim_meta: onFoot is foot:* only). It is the last foot to land, so it counts for lastFoot (180 choice), and is logged. */
 private noteSettle(f:any){const def=f.def;this.lastFoot=def.body;this.logEvent({kind:'settle',event:def.name,bone:def.bone,body:def.body,clip:f.clip,type:def.type||'settle'});}
 /** Delivered to onApronLift subscribers (Voice bot WindAudio subscribes to this adapter by itself). Fallback: direct
  *  globalThis.__voiceWind.notifyApronLift only while WindAudio reports no hooked subscriber (never both). */
 private emitApron(strength:'full'|'soft',durationSec:number){this.logEvent({kind:'apron-lift',strength,durationSec,wind:this.wind});const list=this.apronListeners.slice();
  for(let i=0;i<list.length;i++){try{list[i](strength,durationSec);}catch(err){console.warn('onApronLift listener failed',String(err));}}
  const vw=(globalThis as any).__voiceWind;if(vw&&typeof vw.notifyApronLift==='function'){let hooks=0;try{hooks=Number(vw.snapshot?.().hooks)||0;}catch{hooks=0;}if(!hooks){try{vw.notifyApronLift(strength,durationSec);}catch(err){console.warn('notifyApronLift failed',String(err));}}}}
 onFoot(cb:(e:FootEvent)=>void):()=>void {this.footListeners.push(cb);return ()=>{const i=this.footListeners.indexOf(cb);if(i>=0)this.footListeners.splice(i,1);};}
 onApronLift(cb:(strength:'full'|'soft',durationSec:number)=>void):()=>void {this.apronListeners.push(cb);return ()=>{const i=this.apronListeners.indexOf(cb);if(i>=0)this.apronListeners.splice(i,1);};}
 /** Soft idle gust (角色动画bot idle logic / anim_meta wind.idleGust): flutter envelope + onApronLift('soft', durationSec). Not while walking. */
 apronGust(durationSec=4):boolean {if(this.disposed||!this.clock||this.job&&this.job.action.kind==='walk')return false;const d=durationSec>0&&Number.isFinite(durationSec)?durationSec:4;this.clock.startGust(d);this.emitApron('soft',d);return true;}
 /** Walk-duration contract: distance fraction 0..1 of the CURRENT walk action (each segment from 0), null when not walking. */
 walkProgress():number|null {const j=this.job;if(!j||j.action.kind!=='walk'||!(j.duration>0))return null;const f=j.length>0?j.s/j.length:j.elapsed/j.duration;return f>0?(f<1?f:1):0;}
 private isWalkClip(name:string|undefined){return name===CLIP_ROLES.walk||name===CLIP_ROLES.walkStart||name===CLIP_ROLES.stopL||name===CLIP_ROLES.stopR;}
 private isStopClip(name:string|undefined){return name===CLIP_ROLES.stopL||name===CLIP_ROLES.stopR;}
 /** Walk ended without a planned stop (the walk was not known to end at rest): the stop clip's tail (CharacterMotion.stopTail:
  *  entered where its root travel ends, so no slide and no overshoot past the path end), crossfaded from the walk pose; no
  *  stop clip -> idle. Runs after WALK_JOIN_GRACE_S with nothing queued, or right away when a turn follows (perform). */
 private settleFromWalk(){
  const start=supportPose(this.rig!.joints),saved=new Float64Array(this.rig!.joints.length*STRIDE);capture(this.rig!.joints,saved);
  (this.rig as any).sample(CLIP_ROLES.idle,0);const end=supportPose(this.rig!.joints);writePose(this.rig!.joints,saved);this.support?.startSettle(start,end);
  const c=this.clock!;this.lastSpeed=0;const tail=stopTail(this.rig!,c.cfg,c.planted());this.stopRoot=null;
  if(!tail){this.playNamed(CLIP_ROLES.idle,true,-1,true);return;}
  if(tail.time>0)this.logEvent({kind:'stop-unplanned',clip:tail.clip,from:tail.time,plan:this.lastPlan});this.playNamed(tail.clip,false,-1,false,tail.time);
  const left=c.base?c.base.duration-c.localTime(c.base):0;
  // CMU stops have no static tail: hold the settled pose so the crossfade and a following small turn have something to fold into.
  if(left<TURN_FOLD_MIN_S){if(!this.support?.settling())this.noteTailSettle(tail.clip,tail.time);this.stopHold=this.support?.settleSeconds()||.12;c.holdBase();}}
 /** settle:* of a tail entered at the root-settle frame (CMU: the step is at 1.33 s, the root settles at 1.47 s, so the clock never crosses it). */
 private noteTailSettle(clip:string,time:number){const m=this.clock?.meta(clip);if(!m)return;
  for(let i=0;i<m.events.length;i++){const e=m.events[i];if((e.type==='settle'||e.name.indexOf('settle:')===0)&&e.time<=time+1e-3)this.noteSettle({def:e,clip});}}
 /** Keep the settled stop pose (still the stop clip) for at least TURN_FOLD_MIN_S after the clip's own frames run out. */
 private beginStopHold(){if(this.stopHold<TURN_FOLD_MIN_S)this.stopHold=TURN_FOLD_MIN_S;this.clock?.holdBase();}
 private tickStopHold(step:number){if(!(this.stopHold>0)||!this.clock)return;const j=this.job;let foldLeft=0;if(j&&j.action&&j.action.kind==='turn'&&j.foldS>0)foldLeft=Math.max(0,j.duration-j.elapsed);
  if(foldLeft>this.stopHold)this.stopHold=foldLeft;this.stopHold-=step;
  // The folded turn is created inside the walk resolve, before this decrement, so the hold leads elapsed by one frame.
  // 30/60 is just under 0.5, so a pose release on that frame would show idle while act is still turn.
  if(this.stopHold<=1e-4&&foldLeft>1e-6)this.stopHold=foldLeft;
  if(this.stopHold>1e-4)return;this.stopHold=0;this.clock.releaseHold();
  if(this.isStopClip(this.clock.base?.clip)){this.stopRoot=null;this.playNamed(CLIP_ROLES.idle,true,-1,true);}}
 private startsWalkStart(cur:string|undefined){return cur!==CLIP_ROLES.walk&&cur!==CLIP_ROLES.walkStart&&cur!==CLIP_ROLES.stopL&&cur!==CLIP_ROLES.stopR&&this.rig!.has(CLIP_ROLES.walkStart);}
 /** Root travel plan for this walk (CharacterMotion.planWalk): walk_start / stop forward curves inside the fixed duration. */
 private planFor(action:any,L:number):WalkPlan {const c=this.clock!,cfg=c.cfg,cur=c.base?.clip,rig=this.rig!;const wm=c.meta(CLIP_ROLES.walk);
  const sm=c.meta(CLIP_ROLES.walkStart),startCurve=this.startsWalkStart(cur)&&sm&&sm.root&&sm.root.forward?sm.root.forward:null,sd=rig.has(CLIP_ROLES.walkStart)?rig.duration(CLIP_ROLES.walkStart):0;
  let ahead:number|null=null;if(typeof action.stopAtEnd==='boolean')ahead=action.stopAtEnd?0:null;else if(this.restAhead){try{const a=this.restAhead(action.path);ahead=typeof a==='number'&&a>=0&&isFinite(a)?a:null;}catch{ahead=null;}}const rest=ahead===0;
  const plan=planWalk({L,D:action.duration,start:startCurve?{clip:CLIP_ROLES.walkStart,forward:startCurve,at:sm!.handoff&&sm!.handoff.at!==undefined?sm!.handoff.at:Math.max(0,sd-CROSSFADE_S),nextTime:sm!.handoff&&sm!.handoff.nextTime!==undefined?sm!.handoff.nextTime:0,crossfade:sm!.handoff&&sm!.handoff.crossfade!==undefined?sm!.handoff.crossfade:-1}:null,
   stops:ahead!==null&&cur!==CLIP_ROLES.walkStart?stopCandidates(rig,cfg):[],aheadM:ahead||0,walkCycle:rig.duration(CLIP_ROLES.walk),native:wm&&wm.nativeSpeed?wm.nativeSpeed:DEFAULT_NATIVE_SPEED,
   phase0:cur===CLIP_ROLES.walk&&c.base?c.localTime(c.base):null,v0:cur===CLIP_ROLES.walk&&this.lastSpeed>0?this.lastSpeed:null});
  this.lastPlan={L:+L.toFixed(4),D:+action.duration.toFixed(4),rest,aheadM:ahead,start:!!plan.start,startRate:plan.start?+plan.start.rate.toFixed(3):null,stop:plan.stop?plan.stop.clip:null,stopRate:plan.stop?+plan.stop.rate.toFixed(3):null,warp:+plan.rate.toFixed(5),stopScale:plan.stop?+plan.stop.scale.toFixed(5):null,cruiseMps:plan.cruise?+plan.cruise.vc.toFixed(4):+(L/action.duration).toFixed(4),notes:plan.notes.slice()};
  return plan;}
 private beginWalk(plan:WalkPlan):boolean {const c=this.clock!,cur=c.base?.clip;const continuing=this.pendingIdle||this.isWalkClip(cur);this.pendingIdle=false;this.stopRoot=null;
  if(cur===CLIP_ROLES.walk||cur===CLIP_ROLES.walkStart){if(cur===CLIP_ROLES.walk)c.setRate(plan.rate);return !continuing;} // phase continuity across back-to-back walks
  this.yaw.reset(this.yawRad);const sm=c.meta(CLIP_ROLES.walkStart);
  // walk_start with a forward curve only when the plan has room for it (else walk_loop: no slide); without a curve = old behaviour
  if(this.startsWalkStart(cur)&&(plan.start||!(sm&&sm.root&&sm.root.forward))){this.playNamed(CLIP_ROLES.walkStart,false);c.setRate(plan.start?plan.start.rate:1);}else{this.playNamed(CLIP_ROLES.walk,true);c.setRate(plan.rate);}return !continuing;}
 /** Root offset (her left, metres) of a stop clip's lateral_m curve at clip time t (CharacterMotion.stopLateralAt). */
 private stopLateral(t:number):number {const r=this.stopRoot;return r?stopLateralAt(r.lateral,r.forward,t):0;}
 /** Integrate pose, controller and contact together at <= 1/120 s. Consume the actual caller time
  * (including a partial final interval), rather than dropping long frames or solving only their endpoint. */
 advance(dt:number){if(!Number.isFinite(dt)||dt<=0)return;let left=dt;while(left>1e-10){const step=Math.min(left,1/120);this.advanceStep(step);left-=step;}}
 private advanceStep(dt:number){if(this.disposed||!Number.isFinite(dt)||dt<=0||!this.clock)return;const step=Math.min(dt,.1);const j=this.job;const c=this.clock;
  this.motionT+=step;
  if(this.pendingIdle&&!(j&&j.action.kind==='walk')){this.pendingFor+=step;if(j||this.pendingFor>=WALK_JOIN_GRACE_S){this.pendingIdle=false;if(!j)this.settleFromWalk();}}
  let ds:number|null=null;let entry:{dt1:number;ds1:number}|null=null;
  if(j){const before=j.elapsed;j.elapsed=Math.min(j.duration,j.elapsed+step);
   // Use the existing completion tolerance before evaluating the final root, so a resolved action
   // cannot retain a nearly-complete interpolation. Keep 120 Hz substeps and the full frame duration.
   if(j.elapsed+1e-6>=j.duration)j.elapsed=j.duration;let p=j.elapsed/j.duration;
   if(j.action.kind==='walk'){
    // root travel: plan distance (walk_start / stop forward curves, cruise ramps) or the old linear L*t/D
    const plan:WalkPlan|null=j.plan,sPrev=j.s;const s=plan?walkDistanceAt(plan,j.elapsed):j.length*p;j.s=s;if(j.length>0)p=s/j.length;
    const st=plan&&plan.stop;if(st&&!j.stopEntered&&j.elapsed>=st.tEntry-1e-9){j.stopEntered=true;entry={dt1:Math.max(0,Math.min(step,st.tEntry-before)),ds1:Math.max(0,st.sEntry-sPrev)};
     const e=j.action.path[j.action.path.length-1];this.stopRoot={clip:st.clip,end:[e[0],e[1],e[2]],yaw:this.yawRad,S:st.S,scale:st.scale,forward:st.forward,lateral:st.lateral};}
    const q=pointOnPath(j.action.path,p),at=[q[0],q[1],q[2]];
    if(st&&j.stopEntered){const lat=this.stopLateral((j.elapsed-st.tEntry)*st.rate);at[0]+=Math.cos(this.yawRad)*lat;at[2]-=Math.sin(this.yawRad)*lat;}
    this.node.setWorldPosition(at[0],at[1],at[2]);ds=s-sPrev;const used=j.elapsed-before;if(used>1e-6)this.lastSpeed=ds/used; // walk time actually used (the last frame of a walk is partial)
    // +Z is character forward. Damped, rate-limited follow of the direction to a look-ahead point (corners no longer snap);
    // aimed from the path point, not the root: a stop clip's lateral_m moves the root off the path (CMU stops ~0.1 m) and
    // aiming from there turns her toward the path end while a foot is planted.
    const ahead=pointOnPath(j.action.path,j.length>0?Math.min(1,p+WALK_YAW_LOOKAHEAD_M/j.length):1);
    const dx=ahead[0]-q[0],dz=ahead[2]-q[2];
    if(Math.hypot(dx,dz)>.01){const target=Math.atan2(dx,dz);
     if(j.fromRest&&before===0&&Math.abs(wrapAngle(target-this.yawRad))>WALK_YAW_SNAP_DEG*Math.PI/180){this.logEvent({kind:'yaw-snap',deg:wrapAngle(target-this.yawRad)*180/Math.PI});this.yaw.reset(target);this.setYaw(target);}
     else this.setYaw(this.yaw.step(target,j.elapsed-before));}
   }
   else if(j.action.kind==='turn'){this.lastSpeed=0;let u=p;if(j.foldS>0){u=Math.min(1,j.elapsed/j.foldS);u=u*u*(3-2*u);}this.setYaw(j.fromYaw+j.deltaYaw*u);this.yaw.reset(this.yawRad);}
   else if(j.action.kind==='stand'||j.action.kind==='sit'){const target=j.action.kind==='stand'?j.action.seat.standingControllerRoot:j.action.seat.seatedControllerRoot;this.node.setWorldPosition(...(p===1?target:j.from.map((v:number,i:number)=>v+(target[i]-v)*p)));}
  }
  if((!j||j.foldS>0)&&this.stopRoot&&c.base&&c.base.clip===this.stopRoot.clip){// walk resolved, stop clip still settling (also under a folded turn): rest of its root curves (lateral settle step)
   const r0=this.stopRoot,t=c.localTime(c.base),f=r0.scale*(piecewise(r0.forward,t)-r0.forward[0][1]-r0.S),lat=this.stopLateral(t),sy=Math.sin(r0.yaw),cy=Math.cos(r0.yaw);
   this.node.setWorldPosition(r0.end[0]+sy*f+cy*lat,r0.end[1],r0.end[2]+cy*f-sy*lat);}
  this.wind=this.readWind();let r;
  if(entry&&j&&j.plan&&j.plan.stop){// stop entry inside this frame: walk_loop up to the entry heel strike (exactly ON it), then the stop clip
   const st=j.plan.stop,b=c.base;let snap:number|undefined;
   if(b&&b.clip===CLIP_ROLES.walk){const C=b.duration,guess=b.abs+entry.ds1/b.nativeSpeed*b.rate,k=Math.round((guess-st.entryTime)/C);const sn=k*C+st.entryTime;snap=sn;if(Math.abs(sn-guess)>.05)this.logEvent({kind:'stop-snap',deltaS:sn-guess});}
   const r1=c.tick(entry.dt1,entry.ds1,this.wind,snap);this.playNamed(st.clip,false,st.crossfade,false,0);c.setRate(st.rate);const r2=c.tick(step-entry.dt1,null,this.wind);
   r={foot:r1.foot.concat(r2.foot),ended:r2.ended||r1.ended,apronLift:r1.apronLift||r2.apronLift};}
  else r=c.tick(step,ds,this.wind);
  for(let i=0;i<r.foot.length;i++){const def=r.foot[i].def;if(def.name.indexOf('foot:')===0)this.emitFoot(r.foot[i]);else if(def.type==='settle'||def.name.indexOf('settle:')===0)this.noteSettle(r.foot[i]);}
  if(r.apronLift)this.emitApron('full',r.apronLift.durationSec);
  const ph=c.phase();
  // walk_start handoff: next clip entered at next_time + the overshoot past at_s (phase stays locked to the root); handoff.crossfade_s honoured
  if(ph&&ph.clip===CLIP_ROLES.walkStart){const m=c.meta(CLIP_ROLES.walkStart),d=c.base!.duration,at=m?.handoff?.at??Math.max(0,d-CROSSFADE_S);
   if(ph.time>=at-1e-9){const next=m?.handoff?.next||CLIP_ROLES.walk;this.playNamed(next,true,m?.handoff?.crossfade??-1,false,(m?.handoff?.nextTime??0)+Math.max(0,ph.time-at));if(next===CLIP_ROLES.walk&&j&&j.plan)c.setRate(j.plan.rate);}}
  // a planned stop clip may end on the walk's last frame (CMU stops: root travel until the clip end) - idle anyway
  else if(r.ended&&(!this.job||this.job.foldS>0||this.isStopClip(r.ended))&&r.ended!==CLIP_ROLES.sitDown&&r.ended!==CLIP_ROLES.standUp){if(this.isStopClip(r.ended))this.beginStopHold();else{const hm=c.meta(r.ended);if(this.stopRoot&&this.stopRoot.clip===r.ended)this.stopRoot=null;this.playNamed(CLIP_ROLES.idle,true,hm&&hm.handoff&&hm.handoff.crossfade!==undefined?hm.handoff.crossfade:-1,true);}}
  this.idleGustTick(step);
  this.render(step);
  if(j&&j.elapsed===j.duration){if(j.action.kind==='turn'&&j.foldS>0){j.elapsed=j.duration;this.setYaw(j.fromYaw+j.deltaYaw);this.yaw.reset(this.yawRad);}const kind=j.action.kind;j.off();this.job=null;
   if(kind==='walk'){if(!j.stopEntered){this.pendingIdle=true;this.pendingFor=0;}} // keep the walk pose/phase; resolved next frame unless another walk starts (planned stop: already playing)
   else if(kind==='sit')this.playNamed(CLIP_ROLES.sitHold,true);else if(!(j.foldS>0&&this.isStopClip(c.base?.clip)))this.playNamed(CLIP_ROLES.idle,true,-1,true);
   j.resolve();}
  this.tickStopHold(step);this.resumeAfterSettle();
 }
 private idleGustTick(step:number){const g=this.motionConfig.idleGust,c=this.clock!;if(!g||this.job||c.base?.clip!==CLIP_ROLES.idle||this.wind>0||c.gust){this.idleFor=0;return;}
  if(this.nextGust<0)this.nextGust=g.minS+Math.random()*Math.max(0,g.maxS-g.minS);this.idleFor+=step;if(this.idleFor>=this.nextGust){this.idleFor=0;this.nextGust=-1;this.apronGust(g.durationS);}}
 /** T2+: stand/sit = the loaded clip's AnimationClip.duration (stand_up / sit_down, the same value perform() plays for);
  *  turn = the fixed 1.5 s used by perform(). undefined only when the clip is missing (perform() would throw). */
 actionSeconds(kind:'stand'|'sit'|'turn'){if(kind==='turn')return 1.5;const clip=this.anim?.clips.find(c=>c?.name===(kind==='stand'?CLIP_ROLES.standUp:CLIP_ROLES.sitDown));const d=clip?.duration;return Number.isFinite(d)&&d!>0?d:undefined;}
 /** T2+: seconds into sit_down where she is settled, when anim_meta exposes it (clips.sit_down settle_time_s | settleTime |
  *  settle_frame / fps), rescaled like the events when anim_meta's duration disagrees with the clip; clamped to the clip. */
 actionSettleSeconds(kind:'sit'){const d=this.actionSeconds(kind),m=this.motionConfig.clips[CLIP_ROLES.sitDown];let s=m?m.settleTime:undefined;
  if(d===undefined||s===undefined||!(s>0))return undefined;if(m!.duration&&Math.abs(m!.duration-d)>1e-3)s*=d/m!.duration;return Math.min(s,d);}
 private queueAfterSettle(action:Action,token:Cancellation):Promise<void>{
  if(this.settleQueued)return Promise.reject(Error('Character settle action already queued'));
  return new Promise((resolve,reject)=>{const q:any={action,token,resolve,reject,off:()=>{}};this.settleQueued=q;q.off=token.onCancel(()=>{if(this.settleQueued===q)this.settleQueued=null;reject(new Cancelled());});});}
 private clearSettleQueue(){const q=this.settleQueued;this.settleQueued=null;if(q){q.off();q.reject(new Cancelled());}this.support?.reset();}
 private resumeAfterSettle(){const q=this.settleQueued;if(!q||this.support?.settling())return;this.settleQueued=null;q.off();try{q.token.check();this.perform(q.action,q.token).then(q.resolve,q.reject);}catch(e){q.reject(e);}}
 perform(action:Action,token:Cancellation):Promise<void>{token.check();if(this.disposed)return Promise.reject(Error('Character disposed'));if(this.job)return Promise.reject(Error('Character action busy'));
  if(this.support?.settling())return this.queueAfterSettle(action,token);
  const turnBridgeStart=this.pendingIdle&&action.kind==='turn'?supportPose(this.rig!.joints):null;if(turnBridgeStart)this.pendingIdle=false;else if(this.pendingIdle&&action.kind!=='walk'){this.pendingIdle=false;this.settleFromWalk();if(this.support?.settling())return this.queueAfterSettle(action,token);}
  if(action.kind==='sit'){
   const from=this.yawRad,delta=wrapAngle(action.seat.yawRad-from);
   // Return routes end facing the chair. Turn in place before the original sit animation.
   if(Math.abs(delta)>.001)return this.perform({kind:'turn',controllerRoot:action.seat.standingControllerRoot,fromYawRad:from,toYawRad:from+delta,direction:'left'},token).then(()=>{token.check();return this.perform(action,token);});
  }
  let duration:number;const extra:any={};
  try{
   if(action.kind==='stand')duration=this.playNamed(CLIP_ROLES.standUp,false)!;
   else if(action.kind==='sit')duration=this.playNamed(CLIP_ROLES.sitDown,false)!;
   else if(action.kind==='walk'){this.requireClip(CLIP_ROLES.walk);duration=action.duration;let L=0;for(let i=1;i<action.path.length;i++){const a=action.path[i-1],b=action.path[i];L+=Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2]);}extra.length=L;
    extra.plan=Number.isFinite(duration)&&duration>0?this.planFor(action,L):null;extra.fromRest=this.beginWalk(extra.plan||{L,D:duration,start:null,stop:null,cruise:null,linear:true,rate:1,notes:[]});}
   else{// Start from where she actually faces (the walk's damped yaw may still trail the path end by a few degrees).
    const turn=action as Extract<Action,{kind:'turn'}>;extra.fromYaw=this.yawRad;extra.deltaYaw=wrapAngle(turn.toYawRad-this.yawRad);
    // the walk ended without a planned stop: the stop plays before the turn (r5: it was skipped whenever a task followed)
    if(this.pendingIdle){this.pendingIdle=false;this.settleFromWalk();}
    this.lastSpeed=0;const c=this.clock!,ch=chooseTurn(this.rig!,c.cfg,extra.deltaYaw,this.lastFoot);extra.deltaYaw=ch.deltaRad;duration=1.5;
    // < 45 deg (no turn clip): fold into the stop clip. CMU stops end with the root still moving, so the settled pose
    // is held (stopHold) and the yaw uses that hold. The action ends with the hold (not the 1.5 s WorldFlow budgets via
    // actionSeconds): otherwise idle_breathing_loop inherits act=turn for the rest of that 1.5 s.
    const b=c.base;let left=0;if(b&&!ch.role&&this.isStopClip(b.clip)){const authored=b.duration-c.localTime(b);left=authored>this.stopHold?authored:this.stopHold;
     if(left<TURN_FOLD_MIN_S){this.stopHold=this.support?.settleSeconds()||.12;c.holdBase();left=TURN_FOLD_MIN_S;}}
    extra.foldS=foldedTurnDuration(left,duration);if(extra.foldS>0)duration=extra.foldS;
    this.logEvent({kind:'turn-choice',clip:ch.role,deg:ch.deltaRad*180/Math.PI,lastFoot:this.lastFoot,reason:extra.foldS?'folded into '+b!.clip+' over '+extra.foldS.toFixed(3)+' s':ch.reason});
    if(ch.role==='walk_turn_90_bodyL'&&this.ninetyLandingSamples.length){const pos=this.node.worldPosition;this.support?.startNinetyLanding(supportPose(this.rig!.joints),this.ninetyLandingSamples,this.turnLandingIdle,this.yawRad,extra.deltaYaw,[pos.x,pos.y,pos.z]);}
    if(ch.role==='walk_turn_180_bodyR'&&c.base?.clip===CLIP_ROLES.idle&&this.turnLandingSamples.length){
     // Isolated phase30: only first-swing boundary cache; never advance formal clock or morph driver.
     const pre=c.plan(),incomingIdle=c.base,evidenceEnabled=(globalThis as any).__characterMotionEvidence===true;const evidenceNow=()=>typeof performance!=='undefined'&&typeof performance.now==='function'?performance.now():Date.now(),sampleStart=evidenceEnabled?evidenceNow():0;
     // A safe layer may be a descendant of hips (for example skirt). Reject only layers
     // writing a lower-body bone or an ancestor on its actual FK chain.
     const lowerDependencies=new Set<any>();for(const j of this.rig!.joints)if(/^(hips|thigh\.[LR]|shin\.[LR]|foot\.[LR])$/.test(j.name))for(let n:any=j.node;n;n=n.parent)lowerDependencies.add(n);
     const unsafeLayerBones:string[]=[];for(const layer of pre.layers)if(layer.weight>0)for(const i of (this.rig as any).mask(layer.clip,layer.mask))if(lowerDependencies.has(this.rig!.joints[i].node))unsafeLayerBones.push(this.rig!.joints[i].name);
     const entryPosition=this.node.worldPosition,shapeDomain=!!this.support?.canStartTurnLanding(this.yawRad,extra.deltaYaw,[entryPosition.x,entryPosition.y,entryPosition.z]);const eligible=shapeDomain&&!(unsafeLayerBones.length||incomingIdle.distance||!incomingIdle.loop||!(this.rig as any).blend);
     if(!eligible){this.support?.reset();this.logEvent({kind:'turn-support-domain-warning',clip:ch.role,reason:!shapeDomain?'outside verified right180 shape domain: original motion retained':'lower-body layer or unsupported track evaluator: original motion retained',fromYaw:this.yawRad,deltaYaw:extra.deltaYaw,root:[entryPosition.x,entryPosition.y,entryPosition.z],unsafeLayerBones});}
     else {
     const saved=new Float64Array(this.rig!.joints.length*STRIDE);capture(this.rig!.joints,saved);const abs=incomingIdle.abs,rate=incomingIdle.rate,samples=this.turnLandingSamples.slice(),times:number[]=[],outgoingTimes:number[]=[];
     try{for(const time of this.turnLandingSamples.map((x:any)=>x.time).filter((t:number)=>t<c.crossfadeS)){const idleTime=c.localTime({...incomingIdle,abs:abs+time*rate});this.rig!.apply({base:{clip:ch.role,time,loop:false},out:{clip:CLIP_ROLES.idle,time:idleTime,weight:Math.max(0,1-time/c.crossfadeS)},layers:pre.layers,morph:pre.morph});const entry={time,pose:supportPose(this.rig!.joints)},index=samples.findIndex((x:any)=>Math.abs(x.time-time)<1e-12);if(index<0)throw Error('phase30 boundary cache missing');samples[index]=entry;times.push(time);outgoingTimes.push(idleTime);}}
     finally{writePose(this.rig!.joints,saved);}
     if(evidenceEnabled){const restored=new Float64Array(saved.length);capture(this.rig!.joints,restored);let restoreMax=0;for(let i=0;i<saved.length;i++)restoreMax=Math.max(restoreMax,Math.abs(saved[i]-restored[i]));
     if((globalThis as any).__characterMotionEvidence===true) ((globalThis as any).__phase30Evidence ||= []).push({baseAbs:abs,rate,times,outgoingTimes,sampleCount:times.length,safeLayerClips:pre.layers.map((l:any)=>l.clip),unsafeLayerBones,samplingMs:evidenceNow()-sampleStart,restoreMax,clockAbsAfter:incomingIdle.abs,phasePlanUnchanged:JSON.stringify(pre)===JSON.stringify(c.plan())});}
     const pos=this.node.worldPosition;this.support?.startTurnLanding(supportPose(this.rig!.joints),samples,this.turnLandingIdle,this.yawRad,extra.deltaYaw,[pos.x,pos.y,pos.z]);}}

    if(ch.role){this.stopRoot=null;if(turnBridgeStart){const saved=new Float64Array(this.rig!.joints.length*STRIDE);capture(this.rig!.joints,saved);(this.rig as any).sample(ch.role,.65);const end=supportPose(this.rig!.joints);(this.rig as any).sample(CLIP_ROLES.idle,0);const flat=supportPose(this.rig!.joints);const predictions:any[]=[];for(let k=0;k<=16;k++){const time=.25+.4*k/16;(this.rig as any).sample(ch.role,time);const u=(time-.25)/.4,v=u*u*(3-2*u),h=turnBridgeStart.hip.map((x:number,i:number)=>x+(end.hip[i]-x)*v);if(time>.45&&time<.75)h[1]-=.0044*Math.sin(Math.PI*(time-.45)/.30)**2;const hips=this.rig!.joints.find(x=>x.name==='hips')!.node;hips.setPosition(h[0],h[1],h[2]);predictions.push({time,pose:supportPose(this.rig!.joints)});}writePose(this.rig!.joints,saved);this.support?.startTurnBridge(turnBridgeStart,end,this.yawRad,extra.deltaYaw,flat,predictions);}this.playNamed(ch.role,false);}else if(!extra.foldS){this.stopRoot=null;this.playNamed(CLIP_ROLES.idle,true,-1,true);}}
   if(!Number.isFinite(duration)||duration<=0)throw Error('Invalid character action duration');}catch(error){return Promise.reject(error);}
  return new Promise((resolve,reject)=>{const pos=this.node.worldPosition;const j:any={action,duration,from:[pos.x,pos.y,pos.z],elapsed:0,length:extra.length||0,s:0,plan:extra.plan||null,stopEntered:false,fromYaw:extra.fromYaw||0,deltaYaw:extra.deltaYaw||0,foldS:extra.foldS||0,fromRest:!!extra.fromRest,resolve,reject,off:()=>{}};this.job=j;
   j.off=token.onCancel(()=>{if(this.job===j){this.job=null;this.support?.reset();}reject(new Cancelled());});});
 }
 cancelAndReset(pose:StablePose){if(this.disposed)return;this.clearSettleQueue();this.stopHold=0;this.clock?.releaseHold();if(this.job){this.job.off();this.job.reject(new Cancelled());this.job=null;}
  const root=pose.kind==='seated'?pose.seat.seatedControllerRoot:pose.controllerRoot,yaw=pose.kind==='seated'?pose.seat.yawRad:pose.yawRad,p=this.node.worldPosition;
  // Stable arrival right after a walk (same spot): keep the pose and settle through stop/idle with a crossfade, no pop.
  const inPlace=Math.hypot(p.x-root[0],p.y-root[1],p.z-root[2])<.01;
  this.node.setWorldPosition(...root);this.setYaw(yaw);this.yaw.reset(yaw);
  if(!inPlace||pose.kind==='seated')this.stopRoot=null;
  if(pose.kind==='seated'){this.pendingIdle=false;this.playNamed(CLIP_ROLES.sitHold,true,0,inPlace);}
  else if(inPlace&&this.isWalkClip(this.clock?.base?.clip)){if((this.clock?.base?.clip===CLIP_ROLES.walk||this.clock?.base?.clip===CLIP_ROLES.walkStart)&&!this.pendingIdle){this.pendingIdle=true;this.pendingFor=0;}}
  else{this.pendingIdle=false;this.playNamed(CLIP_ROLES.idle,true,inPlace?-1:0,true);}}
 setVisible(v:boolean){if(!this.disposed)this.node.active=v;}
 dispose(){if(this.disposed)return;this.clearSettleQueue();this.disposed=true;if(this.job){this.job.off();this.job.reject(new Cancelled());this.job=null;}this.rig?.dispose();this.rig=null;this.clock=null;this.morphs=[];this.anim=null;this.footListeners=[];this.apronListeners=[];this.node.destroy();}
}
/** Cocos side of the pose pipeline. Blend mode (useBakedAnimation=false): the evaluator writes joint nodes synchronously
 * (AnimationClip.enableTrsBlending=false, states never played), so the driver samples, captures and mixes itself:
 * crossfade = slerp between two sampled poses; wind layers = additive/override on the masked joints only. Baked mode:
 * one clip, play+pause+setTime+sample (the original path), hard cuts, layers ignored. */
class AnimRig {
 readonly joints:Joint[]=[];private A:Float64Array;private B:Float64Array;private P:Float64Array;private L:Float64Array;private refs:{[clip:string]:Float64Array}={};private masks:{[clip:string]:number[]}={};private bakedName='';private rootJoint=-1;private Rest:Float64Array;private lowerBody:number[]=[];
 /** States rebuilt because they had no clip evaluator (created while baked; see repairStates). */
 readonly repaired:string[]=[];
 constructor(private anim:SkeletalAnimation,readonly blend:boolean){
  for(const c of anim.clips){if(c)anim.getState(c.name)?.stop();}
  if(blend){anim.useBakedAnimation=false;this.requireDirectTrsStates();this.repairStates();const walk=(n:Node)=>{const kids=n.children||[];for(let i=0;i<kids.length;i++){this.joints.push({name:kids[i].name,node:kids[i] as any});walk(kids[i]);}};walk(anim.node);this.rootJoint=this.joints.findIndex(j=>j.name==='root');for(let i=0;i<this.joints.length;i++)if(/^(root|hips|thigh\.[LR]|shin\.[LR]|foot\.[LR])$/.test(this.joints[i].name))this.lowerBody.push(i);}
  else anim.useBakedAnimation=true;
  const size=Math.max(1,this.joints.length)*STRIDE;this.A=new Float64Array(size);this.B=new Float64Array(size);this.P=new Float64Array(size);this.L=new Float64Array(size);this.Rest=new Float64Array(size);capture(this.joints,this.Rest);}
 /** Creator 3.8.8: a SkeletalAnimationState initialized while useBakedAnimation was true keeps _doNotCreateEval=true
  *  (skeletal-animation-state.ts:75-76); a later setUseBaked(false) re-runs AnimationState.initialize (:108-111) but the
  *  evaluator is only built when !_doNotCreateEval (animation-state.ts:370-379), so sample() writes no joints
  *  (_sampleCurves :546-552 needs _clipEval). Boot sets the flag before the girl enters the scene (mountWorld); this is the
  *  defensive net: any state still without an evaluator is removed and created again (createState -> _doCreateState ->
  *  initialize with the flag now false, animation-component.ts:284-288/:438-446). */
 /** Imported clips default to buffered TRS blending. This driver samples several clips synchronously,
  * captures their Node transforms, then blends itself, so every evaluator must bind directly to TRS.
  * Changing the clip flag after state creation is insufficient: rebuild those states once. */
 private requireDirectTrsStates(){const anim=this.anim;
  for(const clip of anim.clips){if(!clip||clip.enableTrsBlending!==true)continue;
   clip.enableTrsBlending=false;anim.getState(clip.name)?.stop();anim.removeState(clip.name);anim.createState(clip,clip.name);this.repaired.push(clip.name+':direct-trs');}}
 private repairStates(){const anim:any=this.anim;if(typeof anim.removeState!=='function'||typeof anim.createState!=='function')return;
  for(const c of this.anim.clips){if(!c)continue;const st:any=anim.getState(c.name);if(!st||st._clipEval)continue;try{st.stop();anim.removeState(c.name);anim.createState(c,c.name);this.repaired.push(c.name);}catch(e){console.warn('[walk-driver] state repair failed',c.name,String(e));}}
  if(this.repaired.length)console.warn('[walk-driver] rebuilt states without clip evaluator: '+this.repaired.join(','));}
 /** T0 anim:pose-live: does the state that drives the pose have a clip evaluator (non-baked) / is it the baked state. */
 evalStatus(name:string):{state:boolean;clipEval:boolean|null;baked:boolean} {const st:any=this.clip(name)?this.anim.getState(name):null;return {state:!!st,clipEval:st?!!st._clipEval:null,baked:!!this.anim.useBakedAnimation};}
 private clip(name:string){return this.anim.clips.find(c=>c?.name===name)||null;}
 has(name:string){const c=this.clip(name);return !!c&&Number.isFinite(c.duration)&&c.duration>0;}
 duration(name:string){const c=this.clip(name);return c&&c.duration>0?c.duration:0;}
 private state(name:string){const c=this.clip(name)!;return this.anim.getState(name)||this.anim.createState(c,name);}
 private sample(name:string,time:number){const s=this.state(name);
  // glTF clips omit rest-valued channels. Each sample must start from the imported defaults, not the last
  // clip's writes (notably seated skirt translations leaking into idle/walk after cancellation).
  if(this.blend)writePose(this.joints,this.Rest);s.setTime(time);s.sample();}
 private mask(clip:string,patterns:ReadonlyArray<string>){let m=this.masks[clip];if(!m){m=[];for(let i=0;i<this.joints.length;i++)if(globMatch(patterns,this.joints[i].name))m.push(i);this.masks[clip]=m;}return m;}
 apply(plan:Plan){const b=plan.base;if(!b)return;
  if(!this.blend){const anim=this.anim,clip=this.clip(b.clip)!;
   if(this.bakedName!==b.clip){for(const c of anim.clips){if(c)anim.getState(c.name)?.stop();}clip.wrapMode=b.loop?AnimationClip.WrapMode.Loop:AnimationClip.WrapMode.Normal;
    const st=this.state(b.clip);st.wrapMode=clip.wrapMode;st.repeatCount=b.loop?Infinity:1;anim.play(b.clip);st.pause();this.bakedName=b.clip;}
   this.sample(b.clip,b.time);return;}
  const n=this.joints.length;if(!plan.out&&!plan.layers.length){this.sample(b.clip,b.time);return;}
  if(plan.out){this.sample(plan.out.clip,plan.out.time);capture(this.joints,this.A);
   const shift=plan.out.controllerOffset;if(shift&&this.rootJoint>=0){const o=this.rootJoint*STRIDE;this.A[o]+=shift[0];this.A[o+1]+=shift[1];this.A[o+2]+=shift[2];}
   this.sample(b.clip,b.time);capture(this.joints,this.B);blendPose(this.A,this.B,1-plan.out.weight,this.P,n);if(plan.out.preserveIncomingLowerBody)for(let i=0;i<this.lowerBody.length;i++){const o=this.lowerBody[i]*STRIDE;for(let k=0;k<STRIDE;k++)this.P[o+k]=this.B[o+k];}}
  else{this.sample(b.clip,b.time);capture(this.joints,this.P);}
  for(let k=0;k<plan.layers.length;k++){const l=plan.layers[k],mask=this.mask(l.clip,l.mask);if(!mask.length)continue;let ref:Float64Array|null=null;
   if(l.mode==='additive'){ref=this.refs[l.clip]||null;if(!ref){ref=new Float64Array(this.P.length);this.sample(l.clip,l.referenceTime);capture(this.joints,ref,mask);this.refs[l.clip]=ref;}}
   this.sample(l.clip,l.time);capture(this.joints,this.L,mask);applyLayer(this.P,this.L,ref,mask,l.weight,l.mode,this.P);}
  writePose(this.joints,this.P);}
 dispose(){for(const c of this.anim.clips){if(c)this.anim.getState(c.name)?.stop();}this.joints.length=0;}
}
const RESULT_ACTION_IDS=['mainNext','chest','regionReward','next','claim'];
@ccclass('WorldIntegrationBoot')
export class WorldIntegrationBoot extends Component {
 private flowTestMenu=false;private flowTestMark:Label|null=null;

 @property validationScenario='';
 @property initialSeatedClip='sit_hold';
 private startup=new StartupReadyGate();private startupOwner:Node|null=null;private startupReference:Node|null=null;private loadingMask:Node|null=null;private startupGirl:Node|null=null;private characterAnimations:SkeletalAnimation[]=[];private selectedSeatedClip='';
 private loadingBackdrop:Node|null=null;private loadingLayer:StartupLoadingLayer|null=null;private transitionChairPrefab:Prefab|null=null;private transitionChairVisual:Node|null=null;private homeSeatedPrefab:Prefab|null=null;private homeSeatedVisual:Node|null=null;private characterPrefab:Prefab|null=null;private animMeta:any=null;private loadPhase='start';private loadProgress=0;private model:Prefab|null=null;private loading=false;private markerRenderer:MeshRenderer|null=null;@property(JsonAsset)smokeFixture:JsonAsset|null=null;
 private islandProps:IslandProps|null=null;private propSign=false;private footsteps:FootstepAudio|null=null;
 private islandHome:IslandHomeInteraction|null=null;private roomExplore:RoomExploreOverlay|null=null;private glassSign:GlassSign|null=null;private islandJourney:IslandJourneyOverlay|null=null;private cabinHint:CabinHint|null=null;private sawLevel=false;
 private composition!:WorldNativeComposition;private canvas!:Node;private controls=new Map<string,Node>();private resultActions:Record<string,()=>void>={};private enqueueResult:(fn:()=>any)=>void=()=>{};private status!:Label;private devMark:DevPreviewMark|null=null;
 /** Back from the background during a journey cutscene: resume it by itself (no 「继续」 tap). Set while the cutscene runs. */
 private cutsceneRunning=false;private cutsceneAutoResume=false;private ready=false;private busy=false;private lastState='';private hudState='';private suppressedStatus='';private islandEntrance=-1;private signEntrance=-1;private error='';private islandToast:IslandToast|null=null;private dialog:DialogBubble|null=null;
 start(){profiler.hideStats();if(typeof sailShotRequested==='function'&&sailShotRequested()){void this.presentSailShot();return;}if(!this.smokeFixture)throw Error('Bind existing fixture');const scene=director.getScene()!;
 this.createNavigation();this.resize();view.on('canvas-resize',this.resize,this);if(typeof window!=='undefined')window.addEventListener('resize',this.resize);
 (globalThis as any).__regionDebug={mount:(id:string)=>loadRegionPrefab(REGIONS[id]).then(p=>{const n=mountRegion(REGIONS[id],p,director.getScene()!);n.name='REGION_DEBUG_'+id;return {ok:true,node:n.name};},e=>({ok:false,error:String(e)}))};
 Array.from(this.controls.values()).forEach(n=>{n.active=false;});this.status.string='咦，起风了';if(this.loadingLayer)this.status.node.parent!.active=false;this.resize();
 (globalThis as any).__worldLoading={snapshot:()=>({phase:this.loadPhase,progress:this.loadProgress,error:this.error,approvedArt:true,backgroundSha256:STARTUP_ART.compositeSha256,art:this.loadingLayer?this.loadingLayer.diagnostics():null,gate:this.startup.snapshot(),initialClip:this.selectedSeatedClip,characterRoot:REF.seatedRoot,childOffset:[0,0,0]}),layout:()=>this.navLayout(),motion:()=>((this as any)._referenceAdapter)?.diagnostics()||null};
 void this.loadWorld();
 }
 /** QA still: bind the real stand-in on sit_hold, then frame the boat. Release WeChat never calls this. */
 private async presentSailShot(){
  const scene=director.getScene()!;
  try{
   if(!assetManager.getBundle('region_island'))await new Promise<void>((ok,fail)=>assetManager.loadBundle('region_island',(e,b)=>e||!b?fail(e||Error('region_island')):ok()));
   const loaded=await Promise.all([this.loadCharacter(),this.loadAnimMeta()]);
   const character=loaded[0],meta=loaded[1];
   const reference=new Node('FLOW_REFERENCE_PLACEHOLDER_NOT_B');this.startupReference=reference;scene.addChild(reference);
   const adapter=new FlowReferenceStandin(reference);(this as any)._referenceAdapter=adapter;
   const girl=instantiate(character);this.startupGirl=girl;girl.name='B_PASS2G_CURSOR';
   {const pre=girl.getComponentsInChildren(SkeletalAnimation);for(let i=0;i<pre.length;i++){pre[i].playOnLoad=false;pre[i].useBakedAnimation=!CHARACTER_POSE_BLEND;}}
   reference.addChild(girl);girl.setScale(1,1,1);girl.setPosition(0,0,0);girl.setRotationFromEuler(0,0,0);
   const animations=girl.getComponentsInChildren(SkeletalAnimation);
   const seated=animations.filter(a=>a.clips.some(clip=>clip?.name==='sit_hold'));
   if(!seated.length)throw Error('Required initial seated clip missing: sit_hold');
   this.selectedSeatedClip='sit_hold';this.characterAnimations=seated;
   for(const a of animations){a.playOnLoad=false;a.stop();}
   for(const a of seated){a.useBakedAnimation=!CHARACTER_POSE_BLEND;const clip=a.clips.find(x=>x?.name==='sit_hold')!;clip.wrapMode=AnimationClip.WrapMode.Loop;a.defaultClip=clip;}
   adapter.setAnimMeta(meta);adapter.bindVisual(girl);
   for(const a of seated){const state=a.getState('sit_hold');if(state){state.time=0;state.sample();}}
   girl.active=true;
   await startSailShot(scene,reference);
  }catch(error){console.error('Sail shot character failed',error);if(!(globalThis as any).__sailShot)await startSailShot(scene,null);}
 }
 /** The loading picture is startup only; actual dependencies and initial seated pose unlock the room. */
 private loadWorld():Promise<void>{
  const pending=this.startup.run(async attempt=>{
   this.loading=true;this.loadPhase='loading';this.loadProgress=0;this.error='';this.loadingLayer?.restart();this.setStatus('正在准备海岛',false);
   if(this.loadingBackdrop)this.loadingBackdrop.active=true;if(this.loadingMask)this.loadingMask.active=true;
   try{
    const prefab=await loadRegionPrefab(REGIONS.island);attempt.check();
    if(!assetManager.getBundle('region_island'))await new Promise<void>((ok,fail)=>assetManager.loadBundle('region_island',(e,b)=>e||!b?fail(e||Error('Dynamic character bundle missing')):ok()));attempt.check();
    this.loadingLayer?.setStage(1);this.setStatus('正在准备角色与动画',false);const loaded=await Promise.all([this.loadCharacter(),this.loadAnimMeta(),Promise.resolve(null),this.loadTransitionChair()]);attempt.check();const character=loaded[0];
    this.model=prefab;this.characterPrefab=character;this.animMeta=loaded[1];this.homeSeatedPrefab=loaded[2];this.transitionChairPrefab=loaded[3];this.loadingLayer?.setStage(2);this.setStatus('正在准备房间',false);
    await this.mountWorld(attempt);attempt.check();
    this.loadPhase='ready';this.loadProgress=1;this.loading=false;this.error='';
    this.revealRoom();this.paintNavigation();this.resize();
   }catch(error){this.releaseStartupMount();throw error;}
  });
  return pending.catch(error=>{if(error instanceof StartupCancelled||!isValid(this.node,true))return;
   this.loading=false;this.loadPhase='error';this.loadProgress=0;this.error='世界加载失败，点这里重试';
   console.error('World startup failed',error);this.setStatus(this.error,true);this.loadingLayer?.showError(this.error);
  });
 }
 private releaseStartupMount(){this.islandProps?.dispose();this.islandProps=null;this.propSign=false;setPropTapLook(false);this.islandJourney?.setPropMode(false);this.startupOwner?.destroy();this.startupOwner=null;this.homeSeatedVisual=null;this.transitionChairVisual=null;this.startupGirl?.destroy();this.startupGirl=null;this.startupReference?.destroy();this.startupReference=null;this.characterAnimations=[];this.selectedSeatedClip='';this.composition=null!;this.ready=false;delete(globalThis as any).__worldIntegration;}
 /** Ready: fade the startup layer out (OUTRO_FADE_S, ease-out) above everything; room hints wait (roomExplore allowed()).
  * Without the layer (unit-test stubs) it is the old immediate hide. update() finishes the fade and deactivates the nodes. */
 private revealRoom(){const l=this.loadingLayer;
  if(l&&this.loadingBackdrop&&this.loadingBackdrop.active){const n=this.canvas.children.length;this.loadingMask?.setSiblingIndex(n-1);this.loadingBackdrop.setSiblingIndex(n-1);l.startOutro();return;}
  if(this.loadingBackdrop)this.loadingBackdrop.active=false;if(this.loadingMask)this.loadingMask.active=false;}
 private tickLoading(dt:number){const l=this.loadingLayer,b=this.loadingBackdrop;if(!l||!b||!b.active)return;
  if(l.tick(dt)&&this.loadPhase==='ready'){b.active=false;if(this.loadingMask)this.loadingMask.active=false;l.releaseHandoff();}}
 private setStatus(text:string,retry:boolean){if(!this.status)return;this.status.string=text;const plate=this.status.node.parent!;plate.active=!this.loadingLayer;plate.off(Node.EventType.TOUCH_END,this.retryLoad,this);if(retry)plate.on(Node.EventType.TOUCH_END,this.retryLoad,this);}
 private retryLoad(){if(this.startup.snapshot().phase==='ready')return;this.status.node.parent!.off(Node.EventType.TOUCH_END,this.retryLoad,this);this.loadWorld();}
 /** E2 fix: the start scene no longer depends on the island GLB, so 'builtin-standard' may not be loaded yet at start().
  * Material creation by effect name is therefore deferred until the island prefab (and its effects) has loaded,
  * checks the effect is registered, falls back to builtin-unlit, and never blocks startup. */
 /** Optional walk-driver data (docs/walk-driver.md): region_island character/anim_meta.json. Never blocks or fails startup. */
 private loadAnimMeta(){return new Promise<any>(ok=>{try{const b:any=assetManager.getBundle('region_island');if(!b||typeof b.load!=='function')return ok(null);b.load('character/anim_meta',JsonAsset,(e:any,a:any)=>ok(e||!a?null:a.json));}catch{ok(null);}});}
 /** The fused heroine/stool is a stationary home visual, never a CharacterAdapter. */
 private loadHomeSeated(){return new Promise<Prefab>((ok,fail)=>{const b=assetManager.getBundle('static_seat_preview');if(!b)return fail(Error('Home seated bundle missing'));b.loadDir('actor',Prefab,(e,list:Prefab[])=>{if(e||list.length!==1)return fail(e||Error('Expected one static home prefab'));ok(list[0]);});});}
 private loadTransitionChair(){return new Promise<Prefab>((ok,fail)=>{const b=assetManager.getBundle('region_island');if(!b)return fail(Error('Transition support bundle missing'));b.loadDir('character_support',Prefab,(e,list:Prefab[])=>{if(e||list.length!==1)return fail(e||Error('Expected one independent transition chair'));ok(list[0]);});});}
 private syncHomeSeated(state:string,hidden:boolean){
  // Unified candidate stays visible through home, stand, walk and return. No static heroine substitution.
  if(this.homeSeatedVisual)this.homeSeatedVisual.active=false;
  if(this.transitionChairVisual)this.transitionChairVisual.active=true;
  if(this.startupGirl)for(const r of this.startupGirl.getComponentsInChildren(MeshRenderer))r.enabled=true;
 }
 private loadCharacter(){return new Promise<Prefab>((ok,fail)=>{const b=assetManager.getBundle('region_island');if(!b)return fail(Error('Character bundle missing'));b.loadDir('character',Prefab,(e,list:Prefab[])=>{if(e||list.length!==1)return fail(e||Error('Expected one interim character prefab'));ok(list[0]);});});}
 private applyMarkerMaterial(){const r=this.markerRenderer;if(!r||!isValid(r.node,true))return;
  try{const pick=(n:string)=>EffectAsset.get(n)?n:null;const effect=pick('builtin-standard')||pick('builtin-unlit');
   if(!effect){console.warn('Reference marker: no builtin effect loaded, marker stays hidden');return;}
   const mat=new Material();mat.initialize({effectName:effect});const c=new Color('#b278bb');
   if(effect==='builtin-standard'){mat.setProperty('albedo',c);mat.setProperty('roughness',1);}else mat.setProperty('mainColor',c);
   r.setMaterial(mat,0);r.node.active=true;}catch(e){console.error('Reference marker material failed (non-fatal)',e);}
 }
 private async mountWorld(attempt:StartupAttempt){attempt.check();const scene=director.getScene()!;const reference=new Node('FLOW_REFERENCE_PLACEHOLDER_NOT_B');this.startupReference=reference;scene.addChild(reference);(this as any)._referenceAdapter=new FlowReferenceStandin(reference);
 if(!this.characterPrefab)throw Error('Required character prefab missing');
 const girl=instantiate(this.characterPrefab);this.startupGirl=girl;girl.name='B_PASS2G_CURSOR';
 // Pose-blend mode needs every SkeletalAnimationState built NON-baked: states are created in SkeletalAnimation.onLoad
 // (animation-component.ts:162-163 clips setter -> createState -> initialize), which runs when the girl enters the active
 // scene below. Set the flag first (setter :144-146; no states yet), else the states never get an evaluator (AnimRig.repairStates).
 {const pre=girl.getComponentsInChildren(SkeletalAnimation);for(let i=0;i<pre.length;i++){pre[i].playOnLoad=false;pre[i].useBakedAnimation=!CHARACTER_POSE_BLEND;}}
 reference.addChild(girl);girl.setScale(1,1,1);
 // The parent owns seatedRoot/seatYaw. The old standing-minus-seated child offset kept B standing.
 girl.setPosition(0,0,0);girl.setRotationFromEuler(0,0,0);
 const animations=girl.getComponentsInChildren(SkeletalAnimation);const seated=animations.filter(a=>a.clips.some(clip=>clip?.name===this.initialSeatedClip));
 if(!seated.length)throw Error('Required initial seated clip missing: '+this.initialSeatedClip);
 this.selectedSeatedClip=this.initialSeatedClip;this.characterAnimations=seated;
 for(const a of animations){a.playOnLoad=false;a.stop();}
 for(const a of seated){a.useBakedAnimation=!CHARACTER_POSE_BLEND;const clip=a.clips.find(x=>x?.name===this.selectedSeatedClip)!;clip.wrapMode=AnimationClip.WrapMode.Loop;a.defaultClip=clip; /* bindVisual captures imported rest TRS before sampling the initial seated pose. */}
 (this as any)._referenceAdapter.setAnimMeta(this.animMeta);(this as any)._referenceAdapter.bindVisual(girl);
 const camera=scene.getComponentsInChildren(Camera)[0];if(!camera)throw Error('World camera missing');
 try{this.glassSign?.dispose();this.glassSign=new GlassSign(scene,camera,()=>{void this.invoke(()=>this.composition.worldCommands().leaveHome());});}catch(e){this.glassSign=null;console.warn('[GLASS_SIGN] unavailable',String(e));}
 const owner=new Node('IsolatedWorldComposition');this.startupOwner=owner;scene.addChild(owner);const composition=owner.addComponent(WorldNativeComposition);this.composition=composition;composition.firstsliceModel=this.model;composition.worldCamera=camera;composition.smokeFixture=this.smokeFixture;
 if(!this.transitionChairPrefab)throw Error('Required transition support missing');
 const chair=instantiate(this.transitionChairPrefab);this.transitionChairVisual=chair;chair.name='StationaryReferenceRoundStool';owner.addChild(chair);chair.active=false;
 for(const r of chair.getComponentsInChildren(MeshRenderer)){r.shadowCastingMode=MeshRenderer.ShadowCastingMode.ON;r.receiveShadow=MeshRenderer.ShadowReceivingMode.ON;}
 // Retain the existing independent stool transform; no fused static heroine is instantiated.
 const scale=1.2,sx=.00037,sz=-.09094,yaw=-2,a=FIRSTSLICE.anchors.seat_anchor.position;
 chair.setPosition(a[0]-scale*(Math.cos(yaw)*sx+Math.sin(yaw)*sz),.000126,a[2]-scale*(-Math.sin(yaw)*sx+Math.cos(yaw)*sz));chair.setRotationFromEuler(0,yaw*180/Math.PI,0);chair.setScale(scale,scale,scale);
 await composition.initializeWorld();attempt.check();
 const bound=composition.attachCalibratedCharacter((this as any)._referenceAdapter);if(!bound.ok)throw Error(bound.reason);
 // Walk driver wind input: 运镜bot WorldFlowComponent.getWindStrength() (0..1); missing = 0.
 {const ad=(this as any)._referenceAdapter;ad.setWindSource(()=>{/* b15 plan B: wind_flutter_loop only while she walks (seated / standing / indoor 0) */if(typeof ad.walkProgress==='function'&&ad.walkProgress()===null)return 0;const w=(composition as any).world;return w&&typeof w.getWindStrength==='function'?w.getWindStrength():null;});}
 // locomotion-v1: which walks end at rest (stop clip inside the walk). Same route data WorldFlowComponent builds (pure function).
 try{(this as any)._referenceAdapter.setWalkRestAhead(restAheadFromRoutes(createFirstsliceRoutes(FIRSTSLICE,REF)));}catch(e){console.warn('walk stop predicate unavailable',String(e));}
 // r4 exit footsteps (Voice Bot): steps on the stand-in's real foot plants. Read-only view of its motion clock + controller root;
 // the frozen stand-in is unchanged. Fed every world state below, ticked in lateUpdate (after the flow advanced her).
 try{const adapter=(this as any)._referenceAdapter;this.footsteps?.dispose();this.footsteps=null;this.footsteps=new FootstepAudio(()=>{if((this as any)._referenceAdapter!==adapter||!adapter.node||!isValid(adapter.node))return null;const p=adapter.node.worldPosition;const w=(composition as any).world,wind=w&&typeof w.getWindStrength==='function'?w.getWindStrength():0;return {clock:adapter.clock??null,x:p.x,z:p.z,yaw:typeof adapter.yawRad==='number'?adapter.yawRad:adapter.node.eulerAngles.y*Math.PI/180,wind:typeof wind==='number'&&isFinite(wind)?wind:0};});}catch(error){this.footsteps=null;console.warn('footsteps unavailable (world unaffected)',String(error));}
 if(composition.worldCommands().snapshot().state!=='home')throw Error('Initial world is not at home');
 for(const a of seated){const state=a.getState(this.selectedSeatedClip);if(!state)throw Error('Initial seated state lost');state.time=0;state.sample();}
 this.ready=true;girl.active=true;this.syncHomeSeated('home',false);this.error='';console.info('HOME_SEATED_VISUAL',{stationary:false,dynamicAdapter:'layer-clearance-task21-keeps-waist14-ankle13',visualAcceptance:false});
 // T9: optional 3D UI props (signpost / bag / journal / compass / beach palms). Never blocks startup; on failure the flat buttons stay.
 try{const props=new IslandProps(scene,camera);this.islandProps=props;void props.load().then(ok=>{if(this.islandProps!==props||!ok)return;this.islandJourney?.setPropMode(true);});}catch(e){this.islandProps=null;console.warn('[T9_PROPS] host unavailable, flat buttons stay',String(e));}
 (globalThis as any).__characterCandidateIdentity={candidate:'layer-clearance-task21',glbSHA256:'42ca2486ad1ecdfb5070d6e2991042b60476b90b609859f39398fbcbacebafec',metadataSHA256:'cefb3e4261592da20be40c9ada49a8f51354fc93f5557da7f178c79b40ea60e6',motionSHA256:'3ef288ff12a8f8512e07a3ea2f94819e984cc70a9d9d4a38b5a9c69e1523b657',prefabUUID:(this.characterPrefab as any)._uuid,metadataSource:((this as any)._referenceAdapter).diagnostics().motion.metaSource,visualName:girl.name,staticHomeInstantiated:!!this.homeSeatedVisual,meshNames:girl.getComponentsInChildren(MeshRenderer).map(r=>r.node.name),acceptance:'OPEN'};
 console.info('UNIFIED_CHARACTER_CANDIDATE_LOADED',(globalThis as any).__characterCandidateIdentity);
 console.info('WORLD_STARTUP_READY',{initialClip:this.selectedSeatedClip,controllerRoot:REF.seatedRoot,childOffset:[0,0,0],scale:1,motionAcceptance:false});
 (globalThis as any).__worldIntegration={snapshot:()=>this.composition.worldCommands().snapshot(),glassSign:()=>this.glassSign?.diagnostics()??null,props:()=>this.islandProps?.diagnostics()??null,onPropTap,hostResult:()=>this.composition.lastHostReply(),useTestFixture:(namespace:string,journeyNamespace:string)=>this.composition.useIsolatedTestProfile(namespace,journeyNamespace),board:()=>this.board()?.diagnostics()||null,layout:()=>this.navLayout(),select:(stageId:string,seed:number)=>this.select(stageId,seed),leave:()=>this.composition.worldCommands().leaveHome(),returnHome:()=>this.goHome(),hide:()=>game.emit(Game.EVENT_HIDE),show:()=>game.emit(Game.EVENT_SHOW),resume:()=>this.composition.resumeJourney(),journey:()=>this.composition.worldCommands().journeySnapshot(),lateEnd:(index:number)=>this.board()?.lateEnd(index),navigationStatus:()=>({error:this.error,text:this.status.string}),mainline:()=>this.composition.mainlineStatus(),mainlineStorage:()=>this.composition.mainlineStorage(),gates:()=>this.composition.challengeGates(),enterMainlineStage:(id:string,seed:number)=>this.composition.enterMainlineStage(id,seed),onFoot:(cb:(e:any)=>void)=>(this as any)._referenceAdapter.onFoot(cb),onApronLift:(cb:(strength:'full'|'soft',durationSec:number)=>void)=>(this as any)._referenceAdapter.onApronLift(cb),apronGust:(durationSec?:number)=>(this as any)._referenceAdapter.apronGust(durationSec),motion:()=>(this as any)._referenceAdapter.diagnostics().motion,morph:()=>(this as any)._referenceAdapter.morphDiagnostics(),previewBalloon:()=>this.composition.previewBalloonTransit(),scope:'Mainline new-player isolated Cocos storage; R5 isolated Cocos localStorage v1.2; read-only real mainline schema v1/v2/v3; missing or protected journey keeps new stages locked. OPEN layer-clearance task21 GLB SHA 42ca2486ad1ecdfb5070d6e2991042b60476b90b609859f39398fbcbacebafec; scale1; controller owns world movement; motion/contact acceptance requires runtime evidence.'};
 try{const q=qaQuery();/* location + DevTools 启动参数 */
  const skip=qaSkipTarget(q);if(skip){/* b17r10 test-only level skip: API + auto-run; no banner */const api=(globalThis as any).__worldIntegration;(globalThis as any).__QF_QA_SKIP_API=true;api.qaSkip=(t:any)=>this.composition.qaSkip(t);api.exitQaSkip=()=>this.composition.exitQaSkip();void this.composition.qaSkip(skip).then(r=>console.info('[QF_QA_SKIP] result '+JSON.stringify(r)));}
  if(skip!==null||qaHooksEnabled(q))(globalThis as any).__qfBackToBoard=()=>{if(!this.controls.get('mainline')?.active)return {ok:false,reason:'no-mainline-control'};void this.invoke(()=>this.composition.enterMainline());return {ok:true};};/* p0drag8 test-only: same action as the 继续旅程 sign / button */
  else if(q.includes('meadowGameplay=1')&&qaTransportEnabled()){if(this.canvas)this.canvas.active=false;void this.composition.previewMeadowGameplay();}
  else if(q.includes('balloonPreview=1')&&qaTransportEnabled()){if(this.canvas)this.canvas.active=false;void this.composition.previewBalloonTransit();}
  else if(q.includes('sailqa=1')&&qaTransportEnabled()){if(this.canvas)this.canvas.active=false;void this.composition.previewSailJourney();}
 }catch{}
 try{installPreTransition({composition:this.composition,board:()=>this.board(),control:id=>this.controls.get(id),call:async fn=>{if(this.busy)return {ok:false,reason:'busy'};this.busy=true;this.error='';try{return await fn();}finally{this.busy=false;}},idle:()=>!this.busy&&!this.loadingLayer?.fading,islandJourney:()=>this.islandJourney,glassSign:()=>this.glassSign,roomExplore:()=>this.roomExplore,frame:()=>this.navLayout(),signRect:()=>{if(!this.propSign||!this.islandProps)return null;const f=this.navLayout();return (this.islandProps as any).signRect?.(f.width,f.height)??null;},leave:()=>{void this.invoke(()=>this.composition.worldCommands().leaveHome());},enterMainline:()=>{void this.invoke(()=>this.composition.continueJourney());},returnHome:()=>{void this.invoke(()=>this.composition.worldCommands().returnHome());}});}catch(e){console.warn('[QF_PRE] install failed',String(e));}/* test-only pre-transition entry: gated inside (WeChat release never) */
 if(this.validationScenario==='skycity')this.scheduleOnce(()=>validateSkycity(this),3);
 if(!MINIGAME){try{const q=(globalThis as any).location?.search;if(typeof q==='string'&&/(?:^|[?&])qa=1(?:&|$)/.test(q)){const api=(globalThis as any).__worldIntegration;api.qaShot=(spec:any)=>this.composition.qaShot(spec);}}catch{/* no location */}}
 }
 private board(){return director.getScene()?.getComponentsInChildren(ManagedMobileBoardUI).find(x=>x.node.isValid)||null;}
 private select(stageId:string,seed:number){const r=this.composition.selectProvider({provider:'r5',stageId,seed});return r.ok?this.composition.enterSelectedLevel():r;}
 private async invoke(fn:()=>any){if(this.busy||this.board()?.hostModalOpen()||this.islandJourney?.isOpen()||this.dialog?.visible())return;this.busy=true;this.error='';try{const r=await fn();if(r&&!r.ok&&r.reason===LAKESIDE_LOAD_FAILED){this.islandToast?.show(LAKESIDE_NOT_READY_TEXT);this.logSuppressedStatus('lakeside',r.reason);}else if(r&&!r.ok&&r.reason!=='cancelled')this.error=({ 'meadow-scene-load-failed':'草原暂时加载失败，成绩与奖励已保留，请重试','stage-locked':'先完成对应地区的主线，再开启挑战','finish-or-discard-current-attempt':'请先继续或结束当前挑战','completion-unsaved':'请先保存当前成绩','preserved-storage-error':'记录暂时无法安全读取，请保留并稍后重试' } as any)[r.reason]||r.reason;else this.board()?.clearHostResultError();}catch(e){this.error=String(e);}finally{this.busy=false;if(this.error)this.board()?.showHostResultError(this.error);this.paintNavigation();}}
 private createNavigation(){setScreenCover((a,sec)=>this.fadeCover(a,sec));setCoverContentHost(c=>{if(!this.wipe)this.wipe=new WindWipeView(this.canvas);this.wipe.setContent(c);});
  setCoverAudioHost({out:sec=>{(GameAudio.instance as any)?.fadeTransition?.(0,sec);},in:sec=>{(GameAudio.instance as any)?.fadeTransition?.(1,sec);}});
  addCoverReadyCheck(()=>this.loadPhase==='ready'&&!this.loadingLayer?.fading);this.enqueueResult=enqueueResultBatch(run=>{void this.invoke(run);});this.canvas=new Node('WorldNavigationCanvas');this.canvas.layer=Layers.Enum.UI_2D;this.node.addChild(this.canvas);this.canvas.addComponent(UITransform);const c=this.canvas.addComponent(Canvas);c.alignCanvasWithScreen=false;const cn=new Node('WorldNavigationCamera');this.node.addChild(cn);cn.setPosition(0,0,1000);const cam=cn.addComponent(Camera);cam.projection=Camera.ProjectionType.ORTHO;cam.near=.1;cam.far=2000;cam.priority=60;cam.visibility=Layers.Enum.UI_2D;cam.clearFlags=Camera.ClearFlag.DEPTH_ONLY;c.cameraComponent=cam;
 this.createLoadingBackdrop();this.status=this.label('世界加载中',0,0,16,320);
 this.button('mainline','继续旅程  →',()=>this.composition.continueJourney());this.button('mainNext','主线下一关',()=>this.composition.advanceMainline());this.button('chest','打开本关宝箱',()=>this.composition.mainlineReward('openChest',this.board()?.hostPresentation().active.level));this.button('regionReward','领取主线地区奖励',()=>this.composition.claimRegionAndWalk(Math.floor(this.board()?.hostPresentation().active.level/4)));this.button('r4','原地区 · 潮汐',()=>this.composition.enterR4());this.button('leave','出门 · 选择地区',()=>this.composition.worldCommands().leaveHome());this.button('home','主页',()=>this.goHome());this.button('tide','潮汐小径',()=>this.composition.enterRegion('tide'));this.button('meadow','花粉草甸',()=>this.composition.enterRegion('meadow'));this.button('sky','天空回声',()=>this.composition.enterRegion('sky'));this.button('lake','风铃湖畔',()=>this.composition.enterRegion('lake'));this.button('skycity','天空城 · 看看',()=>this.composition.worldCommands().enterSkycity());this.button('returnIsland','返回小岛',()=>this.composition.worldCommands().exitSkycity());this.button('cancelVisit','取消前往',()=>this.composition.worldCommands().cancelTransition(),true);this.button('next','下一关',()=>this.composition.advanceRegistered());this.button('claim','领取地区印记',()=>this.composition.claimRegisteredMemento());this.button('ending','继续',()=>this.startEnding());this.button('resume','继续',()=>this.composition.resumeJourney());this.button('dayNight','晴昼',()=>this.composition.worldCommands().toggleDayNight());
 this.lakesideArrival=new LakesideArrivalUI(this.canvas,{now:()=>this.fg.now(),safe:(w,h)=>{const s=arrivalSafeInsets(w,h);return {top:s.top,bottom:s.bottom,capsuleBottom:s.capsule&&s.capsule.bottom>s.capsule.top?s.capsule.bottom:null};},
  wipeRide:(work,ready)=>{const audio=GameAudio.instance as any;return runWindWipe({now:this.fg.now,wait:this.fg.wait,frame:()=>this.fg.wait(1/60),cover:(a,sec)=>this.fadeCover(a,sec),content:c=>coverContent(c),audioOut:sec=>{audio?.fadeTransition?.(0,sec);},audioIn:sec=>{audio?.fadeTransition?.(1,sec);},
   log:(e,d)=>{(globalThis as any).__qfWindWipeLog=((globalThis as any).__qfWindWipeLog||[]).concat([{kind:'ride',e,d,t:this.fg.now()}]).slice(-60);}},{kind:'ride',content:wipeContentFor('lakeside',true),work,ready});}});
 this.islandToast=new IslandToast(this.canvas);this.dialog=new DialogBubble(this.canvas);this.devMark=new DevPreviewMark(this.canvas);
 (globalThis as any).__dialogDemo=(lines?:unknown)=>{if(lines===false){this.dialog?.close();return;}const demo=Array.isArray(lines)&&lines.length?lines:[{speaker:'阿芳',text:'风从海上来。'}];this.dialog?.play(demo as any);};
 this.islandJourney=new IslandJourneyOverlay(this.canvas,{prewarm:id=>{if(id==='lake')void prewarmLakesideAssets();},invoke:fn=>{void this.invoke(fn);},mainlineStatus:()=>this.composition.islandOverview(),gates:()=>this.composition.islandGates(),enterRegion:id=>this.composition.enterRegion(id),enterR4:()=>this.composition.enterR4(),enterSkycity:()=>this.composition.worldCommands().enterSkycity(),returnHome:()=>this.composition.worldCommands().returnHome(),toggleDayNight:()=>this.composition.worldCommands().toggleDayNight(),dayNight:()=>this.composition.worldCommands().dayNight()});
 this.roomExplore=new RoomExploreOverlay(this.canvas,()=>this.composition?.worldCommands()??null,()=>this.loadPhase==='ready'&&this.ready&&!this.busy&&!this.loadingLayer?.fading&&!this.board()?.hostModalOpen(),()=>{void this.invoke(()=>this.composition.worldCommands().leaveHome());},()=>this.glassSign);this.islandHome=new IslandHomeInteraction(this.canvas,{canUse:()=>this.loadPhase==='ready'&&this.ready&&!this.busy&&!this.loadingLayer?.fading&&!this.error&&!this.islandJourney?.isOpen(),hit:(x,y)=>this.composition.worldCommands().hitLighthouse(x,y),returnHome:()=>this.invoke(()=>this.composition.worldCommands().returnHome()),hitCabin:(x,y)=>this.composition.worldCommands().hitCabin(x,y),openCabin:()=>this.openCabin(),pull:(dy:number,scale:number)=>this.composition.worldCommands().pullIsland(dy,scale),orbit:(dx:number,dy:number,scale:number)=>this.composition.worldCommands().orbitIsland(dx,dy,scale),explore:()=>this.composition?.exploreFeed?.()??null});
 if(DEBUG){
 this.flowTestMark=this.label('测试包 · 独立地区流程',0,0,13,360);
 this.button('flowTests','地区流程测试',()=>{this.flowTestMenu=!this.flowTestMenu;});
 for(const n of [4,8,12])this.button('flowTest'+n,String(n).padStart(2,'0')+' · 最后一步',()=>{this.flowTestMenu=false;return this.composition.startRegionFlowTest(n);});
 this.button('flowTestExit','退出测试',()=>{const r=this.composition.exitRegionFlowTest();if(r.ok)this.flowTestMenu=false;return r;});
 }
 }
 /** Cabin tap: the island rest (海岛小憩). The first tap also retires the cabin hint for good. */
 private openCabin(){this.cabinHint?.dismiss();markCabinHintSeen();return this.islandJourney?.openRest()?{ok:true}:{ok:false,reason:'island-busy'};}
 /** Startup loading layer (ui/StartupLoadingLayer.ts): same picture + cover transform as build-templates/wechatgame/first-screen.js,
  * taken over synchronously from its decoded image (no resources bundle wait, no dark mask flash). */
 private createLoadingBackdrop(){const layer=new StartupLoadingLayer(this.canvas,()=>this.retryLoad());this.loadingLayer=layer;this.loadingMask=layer.mask;this.loadingBackdrop=layer.root;}
 private label(text:string,x:number,y:number,size:number,w:number){const n=new Node('LabelPlate');n.layer=Layers.Enum.UI_2D;this.canvas.addChild(n);n.setPosition(x,y,0);n.addComponent(UITransform).setContentSize(w,size+10);const bg=n.addComponent(Graphics);bg.fillColor=new Color('#123233');bg.roundRect(-w/2,-(size+10)/2,w,size+10,10);bg.fill();const t=new Node('VisibleLabel');t.layer=Layers.Enum.UI_2D;n.addChild(t);t.addComponent(UITransform).setContentSize(w,size+10);const l=t.addComponent(Label);l.string=text;l.fontSize=size;l.lineHeight=size+4;l.color=new Color('#fff2cf');l.horizontalAlign=Label.HorizontalAlign.CENTER;l.verticalAlign=Label.VerticalAlign.CENTER;return l;}
 private button(id:string,text:string,fn:()=>any,interrupt=false){const n=new Node(id);n.layer=Layers.Enum.UI_2D;this.canvas.addChild(n);n.addComponent(UITransform).setContentSize(240,46);const surface=warmButton(n,240,46);const l=this.label(text,0,0,17,230);const plate=l.node.parent!;plate.removeFromParent();plate.getComponent(Graphics)!.clear();n.addChild(plate);surface.addContent(plate);const blocked=()=>!!(this.board()?.hostModalOpen()||this.islandJourney?.isOpen()||this.busy&&!interrupt);
 if(id==='mainline')n.on(Node.EventType.TOUCH_START,()=>emitPropTap('signpost','press',blocked())); // T9: IslandPropTaps (signpost hosts mainline)
 this.resultActions[id]=()=>{if(!blocked())this.enqueueResult(fn);};
 surface.bind(()=>{if(id==='mainline')emitPropTap('signpost','confirm',blocked());if(blocked())return false;if(interrupt){const r=fn();if(r&&!r.ok)this.error=r.reason;this.paintNavigation();return;}void this.invoke(fn);});this.controls.set(id,n);}
 private resize=()=>{if(!this.canvas)return;const f=typeof window!=='undefined'?{width:window.innerWidth,height:window.innerHeight}:view.getFrameSize();view.setDesignResolutionSize(f.width,f.height,ResolutionPolicy.EXACT_FIT);if(game.canvas)director.root?.resize(game.canvas.width,game.canvas.height);this.canvas.getComponent(UITransform)!.setContentSize(f.width,f.height);this.canvas.getComponent(Canvas)!.cameraComponent!.orthoHeight=f.height/2;this.status.node.parent!.setPosition(0,this.loadPhase==='ready'?f.height/2-130:-f.height/2+172,0);this.loadingLayer?.layout(f.width,f.height);let i=0;for(const [k,n]of Array.from(this.controls)){n.setPosition(0,70-(i++)*56,0);}this.controls.get('leave')!.setPosition(0,-f.height/2+115,0);this.controls.get('resume')!.setPosition(0,-f.height/2+115,0);
 // T2: bake the FINAL island button size/skin while it is still hidden. Otherwise the first island frame resizes the
 // button, the WarmButtonSkin cache starts a new offscreen bake and the Graphics fallback surface shows until it lands.
 const islandNav=worldNavigationLayout(f.width,f.height);for(const id of ISLAND_NAV_IDS){const n=this.controls.get(id);if(n)this.placeNavigationControl(n,islandNav.buttons[id]);}
 };
 private navLayout(){const f=typeof window!=='undefined'?{width:window.innerWidth,height:window.innerHeight}:view.getFrameSize();return {width:f.width,height:f.height,room:this.roomExplore?.diagnostics()??null,targets:Object.fromEntries(Array.from(this.controls).filter(([_,n])=>n.active).map(([k,n])=>[k,{x:n.worldPosition.x+f.width/2,y:f.height/2-n.worldPosition.y}])),targetRects:Object.fromEntries(Array.from(this.controls).filter(([_,n])=>n.active).map(([k,n])=>{const t=n.getComponent(UITransform)!;return [k,{x:n.worldPosition.x+f.width/2-t.width/2,y:f.height/2-n.worldPosition.y-t.height/2,width:t.width,height:t.height}]})),managedBoards:director.getScene()?.getComponentsInChildren(ManagedMobileBoardUI).filter(x=>x.node.isValid).length||0};}
 private placeNavigationControl(n:Node,r:{x:number;y:number;width:number;height:number}){const t=n.getComponent(UITransform)!;
  if(t.width!==r.width||t.height!==r.height){t.setContentSize(r.width,r.height);n.getComponent(WarmButton)!.configure(r.width,r.height);for(const label of n.getComponentsInChildren(Label))if(label.node.name==='VisibleLabel'){label.fontSize=15;label.lineHeight=20;label.node.getComponent(UITransform)!.setContentSize(r.width-12,25);label.node.parent!.getComponent(UITransform)!.setContentSize(r.width-12,25);}
  if(n.name==='mainline')applyJourneyNavigationSkin(n,'primary',r.width,r.height);}
  n.setScale(1,1,1);n.setPosition(r.x,r.y,0);
 }
 /** Funning 2026-10-11: the top status plate is HIDDEN during outbound/return transitions and slides back in (position
  * animation, no opacity fade) once the character is still and operable.
  * SUPERSEDED (Funning final, 2026-10-11): the top status bar is REMOVED. It never appears in the ready world (home,
  * cutscenes, island, errors, skycity); see docs/HUD-status-api.md. No hide/slideIn calls remain; this only starts the
  * T2 island button entrance. */
 private trackTransitionHud(state:string){const prev=this.hudState;if(state===prev)return;this.hudState=state;
  try{(GameAudio.instance as any)?.onWorldState?.(state);}catch(error){console.warn('exit audio state feed failed',String(error));}   // B5.5 出门音轨
  try{this.footsteps?.onWorldState(state);}catch(error){console.warn('footstep state feed failed',String(error));}   // r4 exit footsteps
  if(state==='island'&&prev==='crossing-out')this.islandEntrance=0;
 }
 /** Status bar removed: its text is console-only. Logs once per change, errors and the skycity hint only. */
 private logSuppressedStatus(kind:string,text:string){const key=kind+'|'+text;if(key===this.suppressedStatus)return;this.suppressedStatus=key;
  if(text)console.info('[OI_HUD] suppressed '+JSON.stringify({kind,text}));}
 /** T2: island buttons enter with a 0.25 s slide (24 px) + scale (0.94->1). Position/scale only: no opacity, so the
  * scene is never masked. Applied after placeNavigationControl, which rewrites the base pose every frame.
  * T9 signpost mode: the transparent mainline hit area tracks the signpost projection, so it is NOT moved/scaled here;
  * instead the signpost enters as the next step of the same sequence, after the buttons: same 0.25 s, same cubic
  * ease-out, rising the same 24 px out of the water while fading in (IslandProps.setSignEntrance). */
 private applyIslandEntrance(dt:number,mainline:Node|null){if(this.islandEntrance<0&&this.signEntrance<0)return;const step=Math.max(0,Math.min(dt,.1))/.25;
  if(this.islandEntrance<0){this.signEntrance=Math.min(1,this.signEntrance+(this.signFadeS>0?Math.max(0,Math.min(dt,.1))/this.signFadeS:step));const e=1-Math.pow(1-this.signEntrance,3);this.setSign(e,24*(1-e));if(this.signEntrance>=1){this.signEntrance=-1;this.signFadeS=0;}return;}
  this.islandEntrance=Math.min(1,this.islandEntrance+step);const e=1-Math.pow(1-this.islandEntrance,3),k=.94+.06*e,dy=-24*(1-e);
  if(mainline?.active&&!this.propSign){const p=mainline.position;mainline.setPosition(p.x,p.y+dy,p.z);mainline.setScale(k,k,1);}
  const dock=this.canvas?.getChildByName('IslandJourneyOverlay')?.getChildByName('IslandUtilityDock');if(dock){dock.setPosition(0,dy,0);dock.setScale(k,k,1);}
  if(this.islandEntrance>=1){this.islandEntrance=-1;if(this.propSign)this.signEntrance=0;}
 }
 /** T9 + R3 (Mac r3: the board floated near the shore on the walk home, seen from behind, text mirrored): the signpost
  * (board, lamp + its light/glows, label, water shadow/ripples; IslandProps.setSignEntrance) exists ONLY in island-idle.
  * - Away states (the whole outbound/return path: crossing-out, walking-home incl. the crane, crossing-in, door, seat,
  *   home...): hidden. Leaving island-idle with the sign on screen (return walk start) fades it out with the mirror of
  *   the entrance (same 0.25 s, cubic, sinking the same 24 px); anything else snaps to 0 (the sign is not on screen).
  * - island: hidden while the buttons enter, then the existing entrance step (applyIslandEntrance). It also (re)starts on
  *   ANY arrival in island with the sign not fully shown (cancelled return, resume), so it never pops in.
  * - level/skycity (+ their loading) and paused: unchanged (the island behind the board keeps its sign; no flicker on
  *   a level round trip). */
 private signShown=1;private signOut=-1;private signPrev='';
 private signRetry=0;private signRetryAt=0;/** v2.3：重试成功时的淡入时长（0 = 用常规 0.25 s 入场） */private signFadeS=0;
 private setSign(e:number,risePx:number){const ok=this.islandProps?.setSignEntrance(e,risePx);if(ok!==false)this.signShown=e;} // b16-fix P1: props not ready -> signShown unchanged, so the entrance replays once they are
 private gateSignEntrance(state:string,dt=0){const p=this.islandProps,prev=this.signPrev;this.signPrev=state;if(!p?.ready)return;
  if(SIGN_AWAY_STATES.indexOf(state)>=0){this.signEntrance=-1;
   if(this.signShown<=0){this.signOut=-1;this.setSign(0,0);return;}
   if(this.signOut<0){if(prev!=='island'){this.setSign(0,0);return;}this.signOut=1-Math.pow(1-this.signShown,1/3);}
   this.signOut=Math.max(0,this.signOut-Math.max(0,Math.min(dt,.1))/.25);const e=1-Math.pow(1-this.signOut,3);this.setSign(e,24*(1-e));if(this.signOut<=0)this.signOut=-1;return;}
  this.signOut=-1;if(state!=='island')return;
  if(this.islandEntrance>=0&&this.propSign){this.setSign(0,0);return;}
  if(this.signEntrance<0&&this.signShown<1)this.signEntrance=1-Math.pow(1-this.signShown,1/3);
 }
 /** T9: drive the 3D props and, while the signpost is on screen, make the (invisible) mainline control its hit area. */
 private syncIslandProps(s:any,f:{width:number;height:number}){
  const p=this.islandProps,m=this.controls.get('mainline')!;let sign=null as null|{x:number;y:number;width:number;height:number};
  if(p?.ready){let dn:any=null;try{dn=this.composition.worldCommands().dayNight();}catch{}
   const dock=this.canvas?.getChildByName('IslandJourneyOverlay')?.getChildByName('IslandUtilityDock');
   p.sync({exterior:!!dn?.exteriorVisible,night:dn?.mode==='night',journey:s.state==='region-travel',buttons:!!this.islandJourney?.dockVisible(),width:f.width,height:f.height,dock:dock?{dy:dock.position.y,k:dock.scale.x}:undefined});
   if(s.state==='island'&&m.active){sign=p.signRect(f.width,f.height);if(!signRectOnScreen(sign,f.width,f.height))sign=null;}} // p0drag8: off-screen sign (explore orbit facing away) -> visible flat 继续旅程 button
  const was=this.propSign;this.propSign=!!sign;setPropTapLook(!!p?.ready&&(this.propSign||!!this.islandJourney?.dockVisible()));
  // b16-fix P1 (build05 全流程测试 P1-1)：入场已结束但木牌并不可见时，不能留一个看不见的点击区。先重放一次入场；仍不可见就退回可见的平面「继续旅程」按钮。
  // v2.2（验收 E）：退回平面按钮后不放弃 3D 木牌：平面按钮保持可见可点，每 1 s 在后台把木牌直接设为完全显示再查一次，一旦可见就切回木牌；离开小岛清零重来。
  if(s.state!=='island')this.signRetry=0;
  if(sign&&p&&this.islandEntrance<0&&this.signEntrance<0&&typeof (p as any).signVisible==='function'&&!(p as any).signVisible()){
   if(this.signRetry<1){this.signRetry++;this.signShown=0;this.signEntrance=0;}
   else{const now=Date.now();if(now-this.signRetryAt>=1000){this.signRetryAt=now;this.signRetry++;this.setSign(1,0);}if(!(p as any).signVisible())sign=null;else{this.setSign(0,0);this.signEntrance=0;this.signFadeS=.2;// v2.4：探测时木牌被设成完全显示，确认可见后当帧先归零再淡入，避免闪一帧
   sign={x:sign.x,y:sign.y,width:0,height:0};}}}
  else if(sign&&this.islandEntrance<0&&this.signEntrance<0)this.signRetry=0;
  this.propSign=!!sign;setPropTapLook(!!p?.ready&&(this.propSign||!!this.islandJourney?.dockVisible()));
  if(sign&&(this.islandEntrance>=0||this.signEntrance>=0))sign={x:sign.x,y:sign.y,width:0,height:0}; // hit area live only once the signpost entrance finished
  if(sign){const op=m.getComponent(UIOpacity)||m.addComponent(UIOpacity);op.opacity=0;const t=m.getComponent(UITransform)!;if(t.width!==sign.width||t.height!==sign.height)t.setContentSize(sign.width,sign.height);m.setScale(1,1,1);m.setPosition(sign.x,sign.y,0);}
  else if(was){const op=m.getComponent(UIOpacity);if(op)op.opacity=255;this.placeNavigationControl(m,worldNavigationLayout(f.width,f.height).buttons.mainline);} // p0drag8: back to its own slot, not the last sign spot
 }
 private paintNavigation(dt=0){this.status.node.parent!.active=false; // status bar removed (Funning final): never on screen once ready, any early return included
 let s:any;try{s=this.composition.worldCommands().snapshot();}catch{return;}if(s.state==='home'&&!this.ready){const r=this.composition.attachCalibratedCharacter((this as any)._referenceAdapter);if(!r.ok){this.error=r.reason;this.logSuppressedStatus('error',this.error);return;}this.ready=true;}
 this.syncHomeSeated(s.state,!!s.hidden||!!s.needsResume);
 // 0007 v1.3 (GGbot): home camera is pose DATA now (world-r1/RegionCameraData.ts homePoseSource='oi-interim-standing', same -1.1,1.5,-2.4 -> .1,.86,-4.35, fov 55); only CameraPose.applyCameraPose writes the camera.
 this.status.string='';
 this.logSuppressedStatus(this.error?'error':s.state==='skycity'?'skycity':'',this.error||(s.state==='skycity'?'天空城 · 轻点机器人或庭院':''));
 const board=this.board(),b=board?.hostPresentation();const registered=s.state==='level'&&!s.needsResume&&b?.provider==='regional-r05'&&b.state==='result.saved'&&b.result?.completionRecorded;
 // Funning (Mac, 09a1b8e): the journey cutscene has no 「暂停旅程」 button and no caption strip under it (the old notice plate:
 // 正在准备… / 快到了… and the paused/failed lines). Nothing covers the picture; tapping it does nothing (no tap-to-pause).
 // Background is the only pause: WorldFlow.hide() suspends the journey; on return it resumes by itself (same path as 「继续」).
 // (WeChat may stop the frame loop while hidden, so the hidden frame itself is never painted: needsResume is the mark.)
 if(!s.needsResume)this.cutsceneRunning=!s.hidden&&['region-loading','region-travel'].includes(s.state);
 else if(this.cutsceneRunning){this.cutsceneRunning=false;this.cutsceneAutoResume=s.state!=='error';}
 if(this.cutsceneAutoResume&&!s.hidden){if(!s.needsResume||s.state==='error')this.cutsceneAutoResume=false;else if(!this.busy&&!board?.hostModalOpen()&&!this.islandJourney?.isOpen()){this.cutsceneAutoResume=false;void this.invoke(()=>this.composition.resumeJourney());}}
 for(const [k,n]of Array.from(this.controls)){if(k.startsWith('flowTest'))continue;n.active=k==='cancelVisit'?!s.needsResume&&s.state==='skycity-loading':k==='returnIsland'?!s.needsResume&&s.state==='skycity'&&s.journey?.region!=='skycity':k==='resume'?s.needsResume&&!board?.hostModalOpen()&&!this.cutsceneAutoResume:k==='mainNext'?!!(s.state==='level'&&b?.provider==='mainline-v33'&&b.state==='result.saved'&&b.result?.completionRecorded&&b.nextStageId):k==='chest'?!!(s.state==='level'&&b?.provider==='mainline-v33'&&b.state==='result.saved'&&b.result?.completionRecorded&&!b.readOnly&&b.journey.chests?.find((x:any)=>x.level===b.active.level)?.earned):k==='regionReward'?!!(s.state==='level'&&b?.provider==='mainline-v33'&&b.state==='result.saved'&&b.result?.completionRecorded&&!b.readOnly&&b.journey.regionRewards?.find((x:any)=>x.region===Math.floor(b.active.level/4))?.unlocked):k==='next'?!!(registered&&b.nextStageId):k==='ending'?endingAvailable(s,b):k==='claim'?!!(registered&&!b.nextStageId&&Object.keys(b.progress.records).filter(id=>id.startsWith('r05-'+b.active.region+'-')).length===4):!s.needsResume&&(k==='leave'?s.state==='home':k==='mainline'?(['island','meadow','lakeside'].includes(s.state)||s.state==='skycity'&&s.journey?.region==='skycity'):k==='home'?(s.state==='meadow'||s.state==='lakeside'||s.state==='skycity'&&s.journey?.region==='skycity'):false);}
 const f=this.navLayout(),navigation=worldNavigationLayout(f.width,f.height);this.islandJourney?.sync(f.width,f.height,s.state==='island'&&!s.needsResume&&!this.busy);this.islandHome?.sync(f.width,f.height,s.state==='island'&&!s.hidden&&!s.needsResume&&!this.busy&&!this.error&&!this.islandJourney?.isOpen());if(this.islandJourney?.isOpen())this.controls.get('mainline')!.active=false;this.trackTransitionHud(s.state);this.syncIslandProps(s,f);if(['island','meadow','skycity','lakeside'].includes(s.state))for(const id of ISLAND_NAV_IDS)if(!(id==='mainline'&&this.propSign))this.placeNavigationControl(this.controls.get(id)!,navigation.buttons[id]);if(s.state==='island')this.applyIslandEntrance(dt,this.controls.get('mainline')??null);else if(this.islandEntrance>=0){this.islandEntrance=-1;const dock=this.canvas?.getChildByName('IslandJourneyOverlay')?.getChildByName('IslandUtilityDock');dock?.setPosition(0,0,0);dock?.setScale(1,1,1);}this.gateSignEntrance(s.state,dt);
 if(s.state==='level')this.sawLevel=true;if(s.state==='island'&&this.sawLevel&&!this.cabinHint&&!cabinHintSeen()){this.cabinHint=new CabinHint(this.canvas);this.cabinHint.start();}
 this.lakesideArrival?.update(dt,f.width,f.height);this.islandToast?.update(dt,f.width,f.height);this.dialog?.update(dt,f.width,f.height);this.devMark?.sync(f.width,f.height,['region-loading','region-travel'].includes(s.state)&&!s.hidden&&!s.needsResume);this.cabinHint?.update(dt,f.width,f.height,s.state==='island'&&!s.hidden&&!s.needsResume&&!this.islandJourney?.isOpen());
 for(const id of ['returnIsland','cancelVisit','home'])if(this.controls.get(id)!.active)this.placeNavigationControl(this.controls.get(id)!,navigation.back);
  if(s.state==='meadow'||s.state==='lakeside'||s.state==='skycity'&&s.journey?.region==='skycity')for(const id of ['mainline','home'] as const){const n=this.controls.get(id);if(n?.active)this.placeNavigationControl(n,navigation.region[id]);}
 // Result actions are drawn by the board's result page (ui/BoardPanels.openResult); the host only owns availability + commands.
 // Do not rebuild the result behind a live RewardPanel while the app is hidden.
 // Its dismissal callback owns that exact panel; on show the settled lease restores level before painting.
 if(board){const actions:any={};for(const k of [...RESULT_ACTION_IDS,'ending']/* TR9 L18 → ending */){const n=this.controls.get(k);actions[k]={visible:!!n?.active,run:this.resultActions[k]};if(n)n.active=false;}actions.afterClaims={visible:true,run:(then:()=>any)=>{if(this.busy){void then();return;}this.enqueueResult(()=>then());}};if(!s.hidden)board.setHostActions(actions);}
 const dn=this.controls.get('dayNight');if(dn){const view=this.composition.worldCommands().dayNight();dn.active=false; // Day/night belongs in the small settings panel, not the landscape.
dn.getComponentsInChildren(Label)[0].string=view.mode==='night'?'夜色':'晴昼';this.placeNavigationControl(dn,navigation.dayNight);}
 this.controls.get('leave')!.active=false;const roomFrame=this.navLayout();this.roomExplore?.sync(roomFrame.width,roomFrame.height);if(s.state!=='home')this.glassSign?.reset();this.glassSign?.sync(dt,s.state==='home'&&!s.hidden&&!s.needsResume&&!!this.roomExplore?.diagnostics().visible);
 if(DEBUG){const test=this.composition.regionFlowTestStatus(),outside=['home','island'].includes(s.state)&&!s.hidden&&!s.needsResume&&!this.busy;
 const testLayout=flowTestLayout(f.width,f.height,readFlowTestHost());
 const put=(id:string,r:{x:number;y:number;width:number;height:number},on:boolean)=>{const n=this.controls.get(id);if(n){n.active=on&&testLayout.supported;this.placeNavigationControl(n,r);}};
 put('flowTests',testLayout.entry,outside);for(const r of testLayout.stages)put(r.id,r,outside&&this.flowTestMenu);
 put('flowTestExit',testLayout.exit,outside&&this.flowTestMenu&&!!test);
 if(this.flowTestMark){const a=test?.lastAction,cell=(i:number)=>String(Math.floor(i/7)+1)+'行'+String(i%7+1)+'列';
 this.flowTestMark.string=test?'独立测试进度 · 主线 '+String(test.checkpoint).padStart(2,'0')+(b?.state==='run.ready'&&b?.active?.stageId==='mainline-'+String(test.checkpoint).padStart(2,'0')?' 最后一步 '+cell(a[1])+' ↔ '+cell(a[2]):''):'测试包 · 地区流程入口';
 const r=testLayout.mark,plate=this.flowTestMark.node.parent!;
 this.flowTestMark.node.getComponent(UITransform)!.setContentSize(r.width-12,r.height);this.flowTestMark.enableWrapText=true;this.flowTestMark.lineHeight=17;
 const ui=plate.getComponent(UITransform)!;if(ui.width!==r.width||ui.height!==r.height){ui.setContentSize(r.width,r.height);const bg=plate.getComponent(Graphics)!;bg.clear();bg.fillColor=new Color('#123233');bg.roundRect(-r.width/2,-r.height/2,r.width,r.height,10);bg.fill();}plate.active=testLayout.supported;
 plate.setPosition(r.x,r.y,0);this.flowTestMark.node.parent!.setSiblingIndex(this.canvas.children.length-1);}
 }
 // Character/door action timing belongs to WorldFlow, never to navigation paint frequency.

 }
 /** 「主页」 (Mac re-check 2607de6): from a journey region fade picture + region bgm/wind/sfx out (0.4 s), release the
  * journey and place her at home, resolve {ok:true} once the state is home, then fade in with the island bgm.
  * Island (no journey) keeps the walk home; both paths carry an overall timeout and always resolve. */
 /** r4.1b: the home watchdog, its waits and the cover ramps run on foreground time (not wall time): a background trip mid
  * walk home freezes the walk (WorldFlowCore.hide) and this clock with it, so it never times out or snaps on return. */
 private fg=new ForegroundTimers();
 private flowPaused():boolean{try{const s=this.composition?.worldCommands().snapshot() as any;return !!s&&(!!s.hidden||!!s.needsResume);}catch{return false;}}
 /** WindWipe (post-island SPEC §1): the shared cover is the 风云擦除 cloud band (ui/WindWipe.ts), never black. It is driven by the
  * legacy cover(alpha, seconds) ramps (ScreenCover) on foreground time; rising alpha = OUT sweep, falling = IN sweep. */
 private lakesideArrival:LakesideArrivalUI|null=null;
 private wipe:WindWipeView|null=null;private wipeDone:(()=>void)|null=null;
 /** TR9 L18 → ending and 回小岛 (world-r2/EndingFlow): both run through the shared WindWipe (runWindWipe). */
 private ending:EndingScreen|null=null;
 private endingHost():EndingHost{
  const audio=GameAudio.instance as any,cmd=()=>this.composition.worldCommands();
  return {
   wipe:o=>runWindWipe({now:this.fg.now,wait:this.fg.wait,frame:()=>this.fg.wait(1/60),cover:(a,sec)=>this.fadeCover(a,sec),content:c=>coverContent(c),
    audioOut:sec=>{audio?.fadeTransition?.(0,sec);},
    audioIn:sec=>{if(o.kind==='ending-home'){const t=SCENE_TRACKS.island;audio?.switchTrackAfterTransition?.(t.path,t.bundle);}else audio?.fadeTransition?.(1,sec);},
    log:(e,d)=>{(globalThis as any).__qfWindWipeLog=((globalThis as any).__qfWindWipeLog||[]).concat([{kind:o.kind,e,d,t:this.fg.now()}]).slice(-60);}},
    {kind:o.kind,content:o.content,work:o.work,ready:o.ready}),
   showEnding:()=>{this.ending?.dispose();this.ending=new EndingScreen(this.canvas,{home:()=>{void this.invoke(()=>endingToIsland(this.endingHost()));},safeBottom:(this.navLayout() as any).safe?.bottom??0});},
   hideEnding:()=>{this.ending?.dispose();this.ending=null;},
   endingShown:()=>!!this.ending?.ready(),
   exitLevel:()=>cmd().snapshot().state==='level'?cmd().exitLevel():{ok:true},
   toIsland:()=>{const c:any=cmd();return typeof c.abandonLakesideJourney==='function'?c.abandonLakesideJourney():{ok:false,reason:'no-island-route'};},
   state:()=>cmd().snapshot().state,islandMusic:()=>{},
   markComplete:()=>markJourneyComplete(),
  };
 }
 private startEnding(){return playEnding(this.endingHost()).then(r=>{(globalThis as any).__qfEnding={...r,shown:!!this.ending?.ready(),at:Date.now()};return r;});}
 goHome():Promise<{ok:boolean;reason?:string;seconds?:number}>{
  const cmd=this.composition.worldCommands(),s=cmd.snapshot() as any;
  const inRegion=s.state==='meadow'||s.state==='lakeside'||s.state==='skycity'&&s.journey?.region==='skycity'||!!(s.journey&&s.state==='island'&&['paused','failed'].includes(s.journey.phase));
  const wall=this.fg.now,wait=this.fg.wait;   // ticked by update (foreground time, no timers; r4.1b)
  if(!inRegion)return runHomeTransition({now:wall,wait,cover:()=>{},audioOut:()=>{},audioIn:()=>{},audioRestore:()=>{},act:()=>cmd.returnHome(),state:()=>cmd.snapshot().state},{outS:0,timeoutS:60});
  const audio=GameAudio.instance as any;
  return runHomeTransition({now:wall,wait,cover:(a,sec)=>this.fadeCover(a,sec),
   audioOut:sec=>typeof audio?.homeDuckOut==='function'?audio.homeDuckOut(sec,wait):audio?.fadeTransition?.(0,sec),
   audioIn:()=>{const t=SCENE_TRACKS.island;audio?.switchTrackAfterTransition?.(t.path,t.bundle);},
   audioRestore:()=>{audio?.fadeTransition?.(1,.2);},
   act:()=>cmd.returnHome(),state:()=>cmd.snapshot().state},HOME_FADE).then(r=>{(globalThis as any).__worldHomeTransition={...r,at:Date.now()};return r;});
 }
 private fadeCover(to:number,seconds:number):Promise<void>{
  if(!this.wipe)this.wipe=new WindWipeView(this.canvas);
  const w=this.wipe;w.node.setSiblingIndex(this.canvas.children.length-1);this.wipeDone?.();this.wipeDone=null;w.ramp(to,Math.max(0,seconds),this.fg.now());
  // b15 QA: qaShot frame() deactivates WorldNavigationCanvas (clean shots) and only the board lens reopens it; the cover
  // lives under that canvas, so a later home fade ran invisibly (no brightness drop). The screen cover must always show.
  if(this.canvas&&this.canvas.isValid&&!this.canvas.active)this.canvas.active=true;
  return new Promise<void>(r=>{this.wipeDone=r;this.tickCover(0);});
 }
 private tickCover(dt:number){this.fg.flush();const w=this.wipe;if(!w)return;const fin=w.tick(this.fg.now(),dt);
  (globalThis as any).__qfWindWipe=w.diagnostics();if(fin&&this.wipeDone){const d=this.wipeDone;this.wipeDone=null;d();}}
 update(dt:number){this.fg.tick(dt,this.flowPaused());this.tickCover(dt);this.tickLoading(dt);if(this.loadPhase!=='ready'||!this.composition)return;this.paintNavigation(dt);}
 /** r4 exit footsteps: after every update() of the frame (WorldFlowComponent has advanced the character). */
 lateUpdate(dt:number){try{this.footsteps?.tick(dt);}catch(error){console.warn('footsteps tick failed',String(error));}}
 onDestroy(){this.footsteps?.dispose();this.footsteps=null;this.lakesideArrival?.dispose();this.lakesideArrival=null;setScreenCover(null);setCoverContentHost(null);setCoverAudioHost(null);this.wipe?.dispose();this.wipe=null;this.ending?.dispose();this.ending=null;this.dialog?.dispose();this.dialog=null;delete (globalThis as any).__dialogDemo;this.islandToast?.dispose();this.islandToast=null;this.devMark?.dispose();this.devMark=null;this.glassSign?.dispose();this.glassSign=null;this.loadingLayer?.dispose();this.cabinHint?.dispose();this.cabinHint=null;this.islandProps?.dispose();this.islandProps=null;this.islandHome?.dispose();this.islandHome=null;this.islandJourney?.dispose();this.islandJourney=null;this.roomExplore?.dispose();this.roomExplore=null;this.startup.dispose();this.releaseStartupMount();delete (globalThis as any).__worldLoading;delete (globalThis as any).__regionDebug;view.off('canvas-resize',this.resize,this);if(typeof window!=='undefined')window.removeEventListener('resize',this.resize);delete(globalThis as any).__worldIntegration;}
}
