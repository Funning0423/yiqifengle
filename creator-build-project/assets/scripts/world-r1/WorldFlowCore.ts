import type { RegionJourneyController, JourneyRegion, JourneySnapshot } from './RegionJourneyCore';
import { CameraTrackFailure } from './CameraPose';
import type { TrackOptions, WeightRamp } from './CameraPose';
/** Engine-independent orchestration. No scene graph, timers, persistence or browser globals. */
export type Vec = readonly [number, number, number];
export type Mode = 'fixed' | 'motion';
export type Place = 'home' | 'island' | 'meadow' | 'level' | 'skycity' | 'lakeside';
export type State = 'idle' | 'loading' | 'home' | 'standing' | 'turning-out' | 'walking-out' | 'opening-door' |
  'crossing-out' | 'island' | 'level-loading' | 'level' | 'skycity-loading' | 'skycity' | 'walking-home' | 'crossing-in' |
  'closing-door' | 'walking-to-seat' | 'sitting' | 'meadow' | 'lakeside' | 'region-loading' | 'region-travel' | 'paused' | 'error' | 'disposed';
/** Home-exit states (seat to island). r4.1: a background trip in one of them freezes the exit in place (see hide()). */
export const EXIT_STATES:readonly State[]=['standing','turning-out','walking-out','opening-door','crossing-out'];
/** r4.1: walk-home states (island to seat); a background trip freezes them in place too. */
export const RETURN_STATES:readonly State[]=['walking-home','crossing-in','closing-door','walking-to-seat','sitting'];
/** doorwayInterior (T2): keep only the interior renderers that can be seen through the open door/windows from the
 * island camera (adapter-owned subset), without interior lighting. Omitted = false (old behaviour). */
export type Layers = Readonly<{interior:boolean; exterior:boolean; door:boolean; backdrop:boolean; doorwayInterior?:boolean}>;
/** Authoring/look-at form. Converted to CameraPose (CameraPose.ts) and written ONLY by applyCameraPose. fovVerticalDeg omitted = keep current fov. */
export type Pose = Readonly<{position:Vec; target:Vec; progress?:number; fovVerticalDeg?:number}>;
export type Seat = Readonly<{position:Vec; back:Vec; yawRad:number; seatedFoot:Vec; standingFoot:Vec; seatedControllerRoot:Vec; standingControllerRoot:Vec}>;
export type StablePose = {kind:'seated'; seat:Seat} | {kind:'standing'; controllerRoot:Vec; yawRad:number};
export type Action = {kind:'stand'|'sit'; seat:Seat} | {kind:'turn'; controllerRoot:Vec; fromYawRad:number; toYawRad:number; direction:'left'} | {kind:'walk'; path:readonly Vec[]; duration:number; /** optional distance-vs-time curve (0…duration → 0…path length) for a driver that supports it (replaces its start/stop walk plan). The frozen FlowReferenceStandin ignores it until its reviewed patch lands (controller-integrity guard). */ distanceAt?:(time:number)=>number};
export class Cancelled extends Error { constructor() { super('World operation cancelled'); this.name='Cancelled'; } }
export class Cancellation {
  cancelled=false;
  private listeners = new Set<() => void>();
  check():void { if(this.cancelled) throw new Cancelled(); }
  onCancel(fn:()=>void):()=>void { if(this.cancelled) fn(); else this.listeners.add(fn); return ()=>this.listeners.delete(fn); }
  cancel():void { if(this.cancelled)return; this.cancelled=true; const list=Array.from(this.listeners);this.listeners.clear();for(const fn of list)fn(); }
  wait<T>(promise:Promise<T>):Promise<T> {
    if(this.cancelled) { promise.catch(()=>{}); return Promise.reject(new Cancelled()); }
    return new Promise<T>((resolve,reject)=>{
      const off=this.onCancel(()=>reject(new Cancelled()));
      promise.then(value=>{off();if(this.cancelled)reject(new Cancelled());else resolve(value);},err=>{off();reject(err);});
    });
  }
}
/** Adapter MUST synchronously stop all old writes in cancelAndReset; no root-motion clips. */
export interface CharacterAdapter {
  readonly calibrated:boolean;
  readonly coordinates:{units:'m';up:'+Y';forward:'+Z';rootMotion:'controller-only';standingRoot:Vec;seatedRoot:Vec;seatYawRad:number;clearanceRadiusM:number};
  advance(seconds:number):void; // sole tick source for controller/animation; no independent Update clock
  perform(action:Action, token:Cancellation):Promise<void>;
  cancelAndReset(pose:StablePose):void;
  setVisible(visible:boolean):void;
  dispose():void;
  /** T2+ optional: seconds the next stand/sit/turn will take (e.g. the stand_up clip length), so ONE camera move can be
   *  timed over stand + turn. Omitted/undefined = flow defaults (stand 1.0 s, turn 1.5 s). */
  actionSeconds?(kind:'stand'|'sit'|'turn'):number|undefined;
  /** T2+ optional: seconds into the sit clip where she is visually settled (anim_meta settle frame). The return-entry camera
   *  lands on cameraHome there; the clip still plays out before 'home'. Omitted/undefined = land at the clip end. */
  actionSettleSeconds?(kind:'sit'):number|undefined;
  /** Optional door action: contact is in clip seconds; its promise resolves only after the full recovery.
   *  Older adapters or assets without door_reach return null/omit these methods and retain the door-only flow. */
  doorReachTiming?():{durationSec:number;contactSec:number}|null;
  performDoorReach?(token:Cancellation):Promise<void>;
  /** Walk-duration contract (optional): distance-travelled fraction 0..1 of the CURRENT walk action, null/undefined when
   *  not walking. When present, camera track progress follows distance instead of elapsed time. */
  walkProgress?():number|null;
}
/** T2+: camera events for audio/debug/HUD sequencing (no logging here). crane-start: the outbound lens first faces her
 *  on the single exit arc (rotation, dolly and lift are already one move; this is not a second phase).
 *  settled: the camera is at the stable pose with zero speed and the character is still (fired right after restore()).
 *  The return door is not a camera event and, on the follow route (cameraEntry.doorSeconds <= 0), not a 'closing-door'
 *  state either: subscribers use WorldFlow.onDoorShut, which fires once when the leaf actually reaches 0. */
export type CameraEvent=Readonly<{kind:'crane-start';segment:'toIsland';progress:number;seconds:number}>|Readonly<{kind:'settled';place:'island'|'home'}>;
/** UI is granted commands/status only; never a world node or camera reference. */
export interface LevelLease {
  requestExit():Result; hide():void; showPaused():void; resume():Result; dispose():void;
  /** Saved terminal page has no gameplay to resume. Errors/unsaved/playing keep the explicit pause gate. */
  isSettledResult?():boolean;
  /** Resolves when the board may be shown: run.ready and able to take a finger, or a settled pause/result screen.
   *  Omitted = the lease is already playable when enter() resolves (older adapters). */
  whenPlayable?():Promise<void>;
  /** Puts the board on screen. Called only after the enter-level shot and whenPlayable. Omitted = already visible. */
  reveal?():void;
}
/** Enter-level push. Not the exit arc. Played whenever the world lease has playEnterLevel, including a device whose flow mode is not motion. */
export const ENTER_LEVEL_SHOT_S=0.78;
export interface LevelAdapter { enter(stageId:string, token:Cancellation):Promise<LevelLease>; }
/** A non-progressing region visit. No save, reward, level or character ownership. */
export interface RegionVisitLease { show():void; hide():void; dispose():void; }
export interface RegionVisitAdapter { enter(token:Cancellation):Promise<RegionVisitLease>; }
export interface WorldLease {
  setLayers(layers:Layers):void;
  setDoor(angleDeg:number):void;
  setCamera(pose:Pose):void;
  animateDoor(from:number,to:number,seconds:number,token:Cancellation):Promise<void>;
  /** options omitted = original linear keyed track. */
  /** progress (T2+, optional): track-timeline fraction 0..1 from a distance-travelled signal; null = use time. The lease
   *  keeps it monotone and ends on 1 with the job. */
  animateCamera(path:readonly Pose[],seconds:number,token:Cancellation,options?:TrackOptions,progress?:()=>number|null,onSample?:(keyProgress:number)=>void):Promise<void>;
  /** Optional enter-level shot from the live island camera. Must not run the exit arc. Omitted = no shot.
   *  WorldFlow plays it whenever it is present. Flow mode does not skip it. */
  playEnterLevel?(token:Cancellation):Promise<void>;
  // onSample (T2+, optional): called after every written sample with the eased track progress (the key-progress space of
  // `path`); drives the wind-strength channel. Leases that omit it simply never report wind (stays 0).
  /** T2+ optional: resolve after `seconds` of the same world job clock (used for timed camera marks). */
  wait?(seconds:number,token:Cancellation):Promise<void>;
  /** v3.3 optional full-screen black cover ramp (alpha 0..1 over seconds, wall clock); resolves at the target. Omitted = no fade. */
  fadeCover?(alpha:number,seconds:number):Promise<void>|void;
  cancelTransient():void;
  /** T5 room-light API (optional; owner GGbot; contract in render/RoomLightingRig.ts + docs/T5-material-swap.md "API").
   * WorldFlowCore itself never drives w; camera-segment owners call these. Older adapters may omit them. */
  setRoomLightWeight?(weight:number):boolean;
  getRoomLightWeight?():number;
  hasRoomLight?():boolean;
  isWorldVisible?():boolean;
  blendRoomLight?(from:number,to:number,seconds:number,token:Cancellation):Promise<void>;
  /** R3 exterior key (optional; owner GGbot; contract in render/RoomLightingRig.ts "R3 exterior key"). */
  setExteriorKey?(k:number):boolean;
  blendExteriorKey?(from:number,to:number,seconds:number,token:Cancellation):Promise<void>;
  assertStaticWorld():void;
  dispose():void;
}
export interface RouteConfig {
  seat:Seat;
  toDoor:readonly Vec[]; outCrossing:readonly Vec[]; toIsland:readonly Vec[];
  toThreshold:readonly Vec[]; inCrossing:readonly Vec[]; toSeat:readonly Vec[];
  cameraHome:Pose; cameraToDoor:readonly Pose[]; cameraInside:Pose; cameraOutside:Pose; cameraIsland:Pose;
  /** Optional position-only clearance keys; fallback preserves adapters with older route configs. */
  cameraHomeToDoor?:readonly Pose[]; cameraCrossOut?:readonly Pose[]; cameraCrossIn?:readonly Pose[];
  /** v2.3 girl framing, applied through the same camera track before the wide island pose. */
  cameraCharacter?:Pose;
  /** Exterior follow rails keep the moving actor framed without changing stable endpoint poses. */
  cameraToIsland?:readonly Pose[];
  cameraToThreshold?:readonly Pose[];
  /** T2/T3a: per-leg camera track shape/timing (see CameraPose.TrackOptions). Omitted = linear, no easing. */
  /** T2/T3a easing/interpolation per camera move. outbound spans crossOut+toIsland and inbound spans toThreshold+crossIn
   *  as ONE camera track (C1 across the walk junction); when absent, each walk keeps its own linear track (pre-T2). */
  cameraTracks?:Readonly<{homeToDoor?:TrackOptions;standTurn?:TrackOptions;toDoor?:TrackOptions;outbound?:TrackOptions;inbound?:TrackOptions;toIsland?:TrackOptions;toThreshold?:TrackOptions;crossIn?:TrackOptions;toSeat?:TrackOptions}>;
  /** T2+: ONE camera move over stand-up + turn (progress over that move; first key should be cameraHome). With
   *  cameraTracks.standTurn it replaces the static stand + 1 s homeToDoor + static turn of the original. */
  cameraStandTurn?:readonly Pose[];
  /** T2+: outbound exit arc. Without cameraSettle, cameraToIsland's LAST key (cameraIsland) is reached `settleSeconds`
   *  after she stops. With cameraSettle, the same arc is keyed on the settle clock (last key = cameraIsland) and
   *  cameraToIsland ends on the pose at the moment she stops. startProgress = her toIsland walk progress when the lens
   *  first faces her (wind is 1 there). Rotation, dolly and lift are one arc, not a later climb.
   *  returnLeadSeconds: the return crane-down starts this long before she turns/walks (mirror of settleSeconds).
   *  startSeconds: crane-start mark time from the start of crossing-out (precomputed by the route builder from the eased
   *  outbound track; WorldFlowCore stays free of CameraPose value imports). */
  crane?:Readonly<{startProgress:number;settleSeconds:number;returnLeadSeconds?:number;startSeconds?:number}>;
  /** T2+ outbound crane settle poses (progress on the settle clock, last key = cameraIsland). Omitted = one key at the end. */
  cameraSettle?:readonly Pose[];
  /** T2+ doorway-clean (island views): the door drifts from openDeg to islandDeg while she walks out (closeAfter s into
   *  toIsland, over closeSeconds), stays there on the island (restore), and reopens to openDeg during toThreshold
   *  (finishing openBefore s before crossing-in, over openSeconds). Smoothstep, sampled with the camera span (no job, no pop). */
  doorDrift?:Readonly<{islandDeg:number;closeAfter:number;closeSeconds:number;openBefore:number;openSeconds:number}>;
  /** T2+ return entry: ONE camera move from the doorway key (last cameraToThreshold key) over crossing-in, the door close
   *  (doorSeconds; the leaf closes by smoothstep over doorCloseFraction of it, sampled with the camera span), toSeat and
   *  the sit, ending exactly on cameraHome - continuing the inbound span (no stop at the threshold or for the door). Key
   *  progress per list: cross/seat = walk progress, door/sit = time fraction of that segment; sit ends with cameraHome.
   *  remapProgress (route builder, CameraPose) places these keys on the span clock. Omitted = original stop/close/toSeat. */
  cameraEntry?:Readonly<{cross:readonly Pose[];door:readonly Pose[];seat:readonly Pose[];sit:readonly Pose[];doorSeconds:number;doorCloseFraction:number;
    /** Mac r4 follow (RegionCameraData returnFollow). doorSeconds <= 0: she does not stop at the entrance; the leaf closes
     *  (smoothstep, doorClose.seconds of the span clock; may run on into the sit) from toSeat walk progress doorClose.from,
     *  behind the lens, and the layers go HOME once it is shut. */
    doorClose?:Readonly<{from:number;seconds:number}>;
    /** Follow mode: the lens stays behind her (it sees her back, lit by the authored sun), so the R3 exterior key (mirrored
     *  sun for a frontal lens, exteriorKey.toThreshold) is not run on the walk home; its mid-swing grazing sun was the dark
     *  dip of the r3 return. Room light w keeps the unchanged T5 path (interiorLighting ramps on the walks). */
    noExteriorKey?:boolean;
    /** Re-place EVERY key (not only those after the doorway key) with remapProgress, so each key is reached when she is at it. */
    remapAll?:boolean;
    /** Ease of the whole move in seconds (start from rest / landing on cameraHome); omitted = derived from cameraTracks.inbound. */
    easeInSeconds?:number;easeOutSeconds?:number}>;
  remapProgress?:(p:number,o?:TrackOptions)=>number;
  /** T3a: authored seat approach. Omitted = original [cameraInside,cameraHome]. Must end exactly on cameraHome. */
  cameraToSeat?:readonly Pose[];
  /** T2: interior-light weight ramps on the exterior walks (walk progress). Omitted = old on/off switching. */
  interiorLighting?:Readonly<{crossOut?:WeightRamp;toIsland?:WeightRamp;toThreshold?:WeightRamp;crossIn?:WeightRamp}>;
  openDeg:number; speed:number;
  /** T2+ wind strength channel on the outbound span: [span key progress, strength 0..1] keys, smoothstep between keys
   *  (C1, no overshoot); evaluated at the camera track's eased progress, so it follows the camera (and distance). */
  wind?:Readonly<{outbound?:ReadonlyArray<readonly [number,number]>}>;
  /** R3 exterior key ramp (WorldLease.blendExteriorKey, RoomLightingRig "R3 exterior key"): on the toThreshold walk, k
   *  holds `from` until walk progress `start`, then blends linearly to `to` by `end` (same job clock and duration as the
   *  walk, like interiorLighting). Placed on the crane-down while the lens looks down on her, before it turns to her
   *  front. restore() lands on k=0. Omitted = authored sun only (Mac r3: she walks home lit by ambient only). */
  exteriorKey?:Readonly<{toThreshold?:WeightRamp}>;
  /** Shared walk-duration contract (FirstsliceRoutes.walkDuration); absent = pathDuration(path,speed). */
  walkDuration?:(path:readonly Vec[])=>number;
  /** 0007 v1.2: character yaw at the island landing point (exit_path_17), from the pose data table. Default 0. */
  islandYawRad?:number;
}
export type Result={ok:true}|{ok:false;reason:string};
export type Snapshot=Readonly<{state:State;stable:Place;mode:Mode;hidden:boolean;needsResume:boolean;characterReady:boolean;error:string|null;journey?:JourneySnapshot}>;
const HOME:Layers={interior:true,exterior:false,door:true,backdrop:true};
const ISLAND:Layers={interior:false,exterior:true,door:true,backdrop:true,doorwayInterior:true};
const BOTH:Layers={interior:true,exterior:true,door:true,backdrop:true};
const NONE:Layers={interior:false,exterior:false,door:false,backdrop:false};
export const layerStates={HOME,ISLAND,BOTH,NONE};
export const distance=(a:Vec,b:Vec)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
export function pathDuration(path:readonly Vec[],speed:number):number {return path.slice(1).reduce((sum,p,i)=>sum+distance(path[i],p),0)/speed;}
/** Heading (yaw, +Z forward, atan2(dx,dz)) of a path at its start - toward the first point at least minDist (0.05 m, horizontal)
 *  from path[0] - or, atEnd, at its end - from the last point at least minDist before the end. Tiny lead-in/out segments
 *  (toThreshold's first segment is 3 mm and points backward) therefore never set a turn target. Falls back to the farthest point. */
export const HEADING_MIN_DIST=0.05;
export function pathHeading(path:readonly Vec[],atEnd=false,minDist=HEADING_MIN_DIST):number {
  const n=path.length;if(n<2)return 0;const o=atEnd?path[n-1]:path[0];let best=o,bd=0;
  for(let k=1;k<n;k++){const p=atEnd?path[n-1-k]:path[k],d=Math.hypot(p[0]-o[0],p[2]-o[2]);if(d>bd){bd=d;best=p;}if(d>=minDist){best=p;break;}}
  return atEnd?Math.atan2(o[0]-best[0],o[2]-best[2]):Math.atan2(best[0]-o[0],best[2]-o[2]);}
export function interpolate(a:Vec,b:Vec,t:number):Vec {return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];}
/** Arclength interpolation, rather than equal-time interpolation of uneven source samples. */
export function pointOnPath(path:readonly Vec[],t:number):Vec {
  if(!path.length)throw Error('Empty path');if(path.length===1)return path[0];
  const total=pathDuration(path,1);let remaining=Math.max(0,Math.min(1,t))*total;
  for(let i=1;i<path.length;i++){const d=distance(path[i-1],path[i]);if(remaining<=d && d>0)return interpolate(path[i-1],path[i],remaining/d);remaining-=d;}
  return path[path.length-1];
}
/** T2+ span segment: `seconds` of the span clock, optional camera keys (0..1 progress within the segment, omitted =
 *  evenly spaced), and the character/lighting work that runs for that segment. */
export type SpanSegment={seconds:number;walk?:boolean;cameras:readonly Pose[];run:(token:Cancellation)=>Promise<void>;state?:State};
/** Pure (T2+ wind): strength at key progress p from [progress,value] keys; smoothstep between neighbours, clamped ends. */
export function windAt(keys:ReadonlyArray<readonly [number,number]>,p:number):number {
  const n=keys.length;if(!n)return 0;if(p<=keys[0][0])return keys[0][1];if(p>=keys[n-1][0])return keys[n-1][1];
  for(let i=1;i<n;i++){const a=keys[i-1],b=keys[i];if(p<=b[0]){const u=b[0]>a[0]?(p-a[0])/(b[0]-a[0]):1,s=u*u*(3-2*u);return a[1]+(b[1]-a[1])*s;}}
  return keys[n-1][1];
}
/** Pure: re-time per-segment keys onto one 0..1 span track; a key at the same instant as the previous one is dropped. */
export function spanCameraKeys(segments:readonly {seconds:number;cameras:readonly Pose[]}[]):Pose[] {
  const total=segments.reduce((a,x)=>a+x.seconds,0);if(!(total>0))throw Error('Empty camera span');
  const keys:Pose[]=[];let offset=0;
  for(const seg of segments){const n=seg.cameras.length;seg.cameras.forEach((k,j)=>{const own=k.progress,p=own??(n>1?j/(n-1):1),at=(offset+p*seg.seconds)/total;
    if(keys.length&&Math.abs(((keys[keys.length-1] as any).progress as number)-at)<1e-9)return;keys.push({...k,progress:at});});offset+=seg.seconds;}
  if(keys.length<2)throw Error('Camera span needs two keys');
  keys[0]={...keys[0],progress:0};keys[keys.length-1]={...keys[keys.length-1],progress:1};return keys;
}
/** Lead-in pan from a user-dragged room view back to the stand-up framing: 0.5..2.0 s by view angle (75 deg/s). */
export function rejoinSeconds(from:Pose,home:Pose):number {
  const f=(p:Pose)=>{const d=[p.target[0]-p.position[0],p.target[1]-p.position[1],p.target[2]-p.position[2]],l=Math.hypot(d[0],d[1],d[2])||1;return d.map(v=>v/l);};
  const a=f(from),b=f(home),deg=Math.acos(Math.max(-1,Math.min(1,a[0]*b[0]+a[1]*b[1]+a[2]*b[2])))*180/Math.PI;
  return deg<.5?0:Math.max(.5,Math.min(2.0,deg/75));
}
export class WorldFlow {
  private state:State='idle'; private stable:Place='home'; private mode:Mode;
  private hidden=false; private needsResume=false; private error:string|null=null;
  private current:Cancellation|null=null; private world:WorldLease|null=null; private level:LevelLease|null=null;
  private character:CharacterAdapter|null; private readonly config:RouteConfig;
  private readonly journey:RegionJourneyController|undefined;private levelOrigin:JourneyRegion='island';
  private visit:RegionVisitLease|null=null; private readonly skycity:RegionVisitAdapter|undefined;
  private readonly levels:LevelAdapter; private readonly loadWorld:(token:Cancellation)=>Promise<WorldLease>;
  private readonly emit:(snapshot:Snapshot)=>void;
  private readonly cameraListeners=new Set<(event:CameraEvent)=>void>();
  private wind=0;private readonly windListeners=new Set<(strength:number)=>void>();
  /** T2+ wind strength 0..1 (per-frame getter; Voice bot + 角色动画bot). 0 indoors and whenever the flow is stable (island
   *  idle, home, levels, paused): restore() forces 0. Rises during the outbound frontal swing, 1 exactly at the frontal key. */
  getWindStrength():number {return this.wind;}
  /** T2+: subscribe to wind-strength changes (fired only when the value changes); returns unsubscribe. */
  onWindStrength(listener:(strength:number)=>void):()=>void {this.windListeners.add(listener);return ()=>{this.windListeners.delete(listener);};}
  private setWind(v:number):void {const w=v>0?Math.min(1,v):0;if(w===this.wind)return;this.wind=w;
    Array.from(this.windListeners).forEach(fn=>{try{fn(w);}catch(error){console.warn('wind listener failed',String(error));}});}
  /** T2+: subscribe to camera events; returns unsubscribe. Listener errors are contained. */
  onCameraEvent(listener:(event:CameraEvent)=>void):()=>void {this.cameraListeners.add(listener);return ()=>{this.cameraListeners.delete(listener);};}
  private cameraEvent(event:CameraEvent):void {for(const fn of Array.from(this.cameraListeners)){try{fn(event);}catch(error){console.warn('camera event listener failed',String(error));}}}
  private readonly doorShutListeners=new Set<()=>void>();
  private doorShutSent=false;
  /** Fires once per return when the door leaf actually reaches 0 (follow: during the walk, behind the lens; legacy
   *  stop: when the close channel / animateDoor finishes). Not when the 'closing-door' state begins — the follow route
   *  never enters that state. Returns unsubscribe. Listener errors are contained. */
  onDoorShut(listener:()=>void):()=>void {this.doorShutListeners.add(listener);return ()=>{this.doorShutListeners.delete(listener);};}
  private emitDoorShut():void {if(this.doorShutSent)return;this.doorShutSent=true;
    for(const fn of Array.from(this.doorShutListeners)){try{fn();}catch(error){console.warn('door shut listener failed',String(error));}}}
  constructor(options:{config:RouteConfig;mode?:Mode;character?:CharacterAdapter;levels:LevelAdapter;skycity?:RegionVisitAdapter;journey?:RegionJourneyController;loadWorld:(t:Cancellation)=>Promise<WorldLease>;onChange?:(s:Snapshot)=>void}) {
    this.journey=options.journey;this.config=options.config;this.mode=options.mode??'fixed';this.character=options.character??null;this.levels=options.levels;this.skycity=options.skycity;this.loadWorld=options.loadWorld;this.emit=options.onChange??(()=>{});
  }
  /** T2+: leaveHome({from}) starts the stand-up move on `from` (no rejoin cut needed by the caller). */
  get continuousLeave():boolean {const c=this.config;return this.mode==='motion'&&!!(c.cameraStandTurn&&c.cameraTracks?.standTurn);}
  snapshot():Snapshot {return Object.freeze({state:this.state,stable:this.stable,mode:this.mode,hidden:this.hidden,needsResume:this.needsResume,characterReady:this.characterReady(),error:this.error,...(this.journey?{journey:this.journey.snapshot()}:{})});}
  private change(state:State):void {this.state=state;this.emit(this.snapshot());}
  private characterReady():boolean {
    const a=this.character,c=a?.coordinates,s=this.config.seat;
    return !!(a?.calibrated&&c&&c.units==='m'&&c.up==='+Y'&&c.forward==='+Z'&&c.rootMotion==='controller-only'&&
      c.clearanceRadiusM>0&&c.clearanceRadiusM<=.18&&distance(c.standingRoot,s.standingControllerRoot)<1e-4&&
      distance(c.seatedRoot,s.seatedControllerRoot)<1e-4&&Math.abs(c.seatYawRad-s.yawRad)<1e-5);
  }
  private pose():StablePose {if(this.stable!=='home'&&this.journey?.position())return this.journey.position()!;return this.stable==='home'?{kind:'seated',seat:this.config.seat}:{kind:'standing',controllerRoot:this.config.toIsland[this.config.toIsland.length-1],yawRad:this.config.islandYawRad??0};}
  private restore():void {
    this.setWind(0); // stable poses (island idle, home, level, paused, after a cancel) are always wind 0
    if(!this.world)return;this.world.cancelTransient();this.world.setDoor(this.stable==='home'?0:this.islandDoorDeg());
    if(this.stable!=='home'&&this.journey?.hasCheckpoint()&&this.characterReady()){
      const visible=!this.hidden&&!this.needsResume&&this.stable!=='level';
      this.world.setLayers(visible?ISLAND:NONE);this.world.setRoomLightWeight?.(0);this.world.setExteriorKey?.(0);
      this.journey.restore(this.character!,this.world,visible);this.world.assertStaticWorld();return;
    }
    this.world.setCamera(this.stable==='home'?this.config.cameraHome:this.config.cameraIsland);
    this.world.setLayers(this.hidden||this.needsResume||this.stable==='level'||this.stable==='skycity'?NONE:this.stable==='home'?HOME:ISLAND);
    // Stable endpoints land on the full light set (home = room 1; island has the interior view off, rig ignores it).
    this.world.setRoomLightWeight?.(this.stable==='home'?1:0);
    this.world.setExteriorKey?.(0); // R3: no keyed sun outside a walk
    if(this.characterReady()&&!(this.character as any).__qfWalkTail)this.character!.cancelAndReset(this.pose())/* b15: a walk tail owns her */;this.character?.setVisible(this.characterReady()&&!this.hidden&&!this.needsResume&&this.stable!=='level'&&this.stable!=='skycity');this.world.assertStaticWorld();
    if(this.visit){if(this.stable==='skycity'&&!this.hidden&&!this.needsResume)this.visit.show();else this.visit.hide();}
  }
  private invalidate():void {this.seatedFrozen=false;this.frozen=false;const old=this.current;this.current=null;old?.cancel();this.world?.cancelTransient();}
  private async operate(initial:State,body:(token:Cancellation)=>Promise<void>):Promise<Result> {
    const token=new Cancellation();this.current=token;this.error=null;this.change(initial);
    try {await body(token);token.check();return {ok:true};}
    catch(err) {if(err instanceof Cancelled)return {ok:false,reason:'cancelled'};
      if(this.current===token && this.state!=='disposed'){if(err instanceof CameraTrackFailure){this.fault(String(err));}else{token.cancel();this.error=String(err);this.restore();this.change(this.world?this.stable:'error');}}
      return {ok:false,reason:String(err)};
    } finally {if(this.current===token)this.current=null;}
  }
  private blocked(expected:Place,character=false):Result|null {
    if(this.current)return {ok:false,reason:'busy'};
    if(this.state==='disposed')return {ok:false,reason:'disposed'};
    if(this.hidden||this.needsResume)return {ok:false,reason:'paused'};
    if(!this.world||this.state!==expected)return {ok:false,reason:'wrong-state'};
    if(character&&!this.characterReady())return {ok:false,reason:'character-adapter-not-calibrated'};
    return null;
  }
  async load():Promise<Result> {
    if(this.current||this.state==='disposed'||this.world||this.hidden||this.needsResume)return {ok:false,reason:'load-not-allowed'};
    return this.operate('loading',async token=>{
      // Late loads are disposed even when the loader ignores cancellation.
      const pending=this.loadWorld(token).then(lease=>{if(token.cancelled){lease.dispose();throw new Cancelled();}return lease;});
      const lease=await token.wait(pending);token.check();this.world=lease;this.stable='home';this.restore();this.change('home');
    });
  }
  bindCharacter(adapter:CharacterAdapter):Result {
    if(this.current||this.state!=='home'||this.hidden||this.needsResume)return {ok:false,reason:'bind-only-at-home'};
    if(!adapter.calibrated)return {ok:false,reason:'character-adapter-not-calibrated'};
    const previous=this.character;this.character=adapter;
    if(!this.characterReady()){this.character=previous;return {ok:false,reason:'character-coordinate-contract-mismatch'};}
    if(previous&&previous!==adapter)previous.dispose();this.restore();this.emit(this.snapshot());return {ok:true};
  }
  setMode(mode:Mode):Result {
    if(mode!=='fixed'&&mode!=='motion')return {ok:false,reason:'invalid-mode'};
    if(this.current||this.state==='disposed'||this.hidden||this.needsResume)return {ok:false,reason:'mode-change-not-allowed'};
    this.mode=mode;this.restore();this.emit(this.snapshot());return {ok:true};
  }
  private async action(action:Action,token:Cancellation):Promise<void> {token.check();await token.wait(this.character!.perform(action,token));token.check();}
  /** Per-walk options are looked up by path identity, so walk() keeps its original 3-argument shape (debug wrappers
   *  that forward (path,cameras,token) see identical behaviour). */
  private walkTrack(path:readonly Vec[]):TrackOptions|undefined {const c=this.config,t=c.cameraTracks;if(!t)return undefined;
    return path===c.toDoor?t.toDoor:path===c.toSeat?t.toSeat:path===c.toIsland?t.toIsland:path===c.toThreshold?t.toThreshold:path===c.inCrossing?t.crossIn:undefined;}
  private walkLight(path:readonly Vec[]):WeightRamp|undefined {const c=this.config,l=c.interiorLighting;if(!l)return undefined;
    return path===c.outCrossing?l.crossOut:path===c.toIsland?l.toIsland:path===c.toThreshold?l.toThreshold:path===c.inCrossing?l.crossIn:undefined;}
  /** cameras=null: character + lighting only (the camera is owned by an enclosing span track). */
  private async walk(path:readonly Vec[],cameras:readonly Pose[]|null,token:Cancellation):Promise<void> {
    const duration=this.walkSeconds(path),track=this.walkTrack(path),light=this.walkLight(path),byDistance=()=>this.walkFraction();
    // Both tracks use the same duration. Character adapter owns world displacement.
    // fixed mode used to leave the camera on cameraHome, so the girl walked out of the doorway frame.
    const camera=!cameras?Promise.resolve():this.mode==='motion'
      ? this.world!.animateCamera(cameras,duration,token,track,byDistance)
      : Promise.resolve(this.world!.setCamera(cameras[cameras.length-1]));
    // T2: lighting rides the same job clock and duration as the walk; the camera may ease, lighting follows walk progress.
    const lighting=light&&this.world!.blendRoomLight?this.roomLightRamp(light,duration,token):Promise.resolve();
    const k=path===this.config.toThreshold&&!this.config.cameraEntry?.noExteriorKey?this.config.exteriorKey?.toThreshold:undefined,key=k&&this.world!.blendExteriorKey?this.exteriorKeyRamp(k,duration,token):lighting; // no key: await lighting twice (harmless)
    await token.wait(Promise.all([this.action({kind:'walk',path,duration},token), camera, lighting, key]).then(()=>{}));token.check();
  }
  /** T2+ drives T5 w from the walk's (= camera segment's) progress: hold `from` until ramp.start, then the rig's linear
   *  cancellable blend to `to` by ramp.end (monotone, no step; Voice bot polls getRoomLightWeight every frame). */
  private async roomLightRamp(r:WeightRamp,duration:number,token:Cancellation):Promise<void> {
    const s=Math.max(0,Math.min(1,r.start)),e=Math.max(s,Math.min(1,r.end));
    await this.waitSeconds(s*duration,token);token.check();
    if(e>s)await token.wait(this.world!.blendRoomLight!(r.from,r.to,(e-s)*duration,token));else this.world!.setRoomLightWeight?.(r.to);
  }
  /** R3: exterior key k on the walk clock (hold `from` until start, linear to `to` by end). */
  private exteriorKeyRamp(r:WeightRamp,duration:number,token:Cancellation):Promise<void> {
    const s=Math.max(0,Math.min(1,r.start)),e=Math.max(s,Math.min(1,r.end));this.world!.setExteriorKey?.(r.from);
    return this.waitSeconds(s*duration,token).then(()=>{token.check();
      if(e>s)return token.wait(this.world!.blendExteriorKey!(r.from,r.to,(e-s)*duration,token)).then(()=>{});this.world!.setExteriorKey?.(r.to);});
  }
  /** T2+: ONE camera track over consecutive timed segments (walks, stand/turn, holds). Each segment's keys carry their
   *  own 0..1 progress; they are re-timed onto the span clock and a key at the same instant as the previous one is
   *  dropped (shared junction key). Characters/lighting run segment by segment on the same job clock. */
  /** extra (Mac r4): onDoorShut runs once when the door channel first reaches 0 at or after key progress shutAfter. */
  private async span(segments:readonly SpanSegment[],token:Cancellation,track:TrackOptions,mark?:{name:'crane-start';progress:number;seconds:number},wind?:ReadonlyArray<readonly [number,number]>,door?:ReadonlyArray<readonly [number,number]>,keyMap?:(keys:Pose[])=>Pose[],extra?:{onDoorShut?:()=>void;shutAfter?:number}):Promise<void> {
    const raw=spanCameraKeys(segments),keys=keyMap?keyMap(raw):raw,total=segments.reduce((a,x)=>a+x.seconds,0);
    let camera:Promise<void>=Promise.resolve();
    // Camera progress follows the character's travelled distance inside walk segments (keys are placed by path progress),
    // time elsewhere (stand/turn/hold) and whenever the adapter reports nothing.
    const cur={start:0,seconds:0,walk:false};
    const byDistance=()=>{if(!cur.walk||!(total>0))return null;const f=this.walkFraction();return f===null?null:(cur.start+f*cur.seconds)/total;};
    const hasWind=!!(wind&&wind.length),hasDoor=!!(door&&door.length),shutCb=extra?.onDoorShut,shutAfter=extra?.shutAfter??0;let shut=false;
    const onSample=hasWind||hasDoor?(e:number)=>{if(token.cancelled)return;if(hasWind)this.setWind(windAt(wind!,e));
      if(hasDoor){const d=windAt(door!,e);this.world!.setDoor(d);if(shutCb&&!shut&&e>=shutAfter&&d<=1e-9){shut=true;shutCb();}}}:undefined;
    if(this.mode==='motion'){camera=onSample?this.world!.animateCamera(keys,total,token,track,byDistance,onSample):this.world!.animateCamera(keys,total,token,track,byDistance);
      if(mark&&mark.seconds>=0&&mark.seconds<=total&&this.world!.wait){const seconds=mark.seconds;
        this.world!.wait(seconds,token).then(()=>{if(!token.cancelled)this.cameraEvent({kind:'crane-start',segment:'toIsland',progress:mark.progress,seconds});},()=>{});}}
    else this.world!.setCamera(keys[keys.length-1]);
    const characters=(async()=>{let start=0;for(const seg of segments){cur.start=start;cur.seconds=seg.seconds;cur.walk=!!seg.walk;if(seg.state)this.change(seg.state);await seg.run(token);token.check();start+=seg.seconds;cur.walk=false;}})();
    await token.wait(Promise.all([characters,camera]).then(()=>{}));token.check();
  }
  private waitSeconds(seconds:number,token:Cancellation):Promise<void> {
    if(!(seconds>0))return Promise.resolve();
    if(!this.world!.wait){console.warn('WorldLease.wait missing; camera span timing degrades');return Promise.resolve();}
    return token.wait(this.world!.wait(seconds,token));
  }
  private islandDoorDeg():number {const d=this.config.doorDrift;return d?Math.max(0,Math.min(this.config.openDeg,d.islandDeg)):this.config.openDeg;}
  /** Door keys [span progress, deg] for doorDrift: from deg `a` to `b` over [t0, t0+dur] seconds of a span of `total` s. */
  private doorKeys(total:number,t0:number,dur:number,a:number,b:number):ReadonlyArray<readonly [number,number]>|undefined {
    if(!(total>0)||a===b)return undefined;const p0=Math.max(0,Math.min(1,t0/total)),p1=Math.max(p0+1e-6,Math.min(1,(t0+dur)/total));return [[0,a],[p0,a],[p1,b],[1,b]];}
  private walkSegment(path:readonly Vec[],cameras:readonly Pose[],state?:State):SpanSegment {return {seconds:this.walkSeconds(path),cameras,state,walk:true,run:t=>this.walk(path,null,t)};}
  /** Shared walk-duration contract: RouteConfig.walkDuration (FirstsliceRoutes.walkDuration) or constant speed. */
  private walkSeconds(path:readonly Vec[]):number {const d=this.config.walkDuration?.(path);return typeof d==='number'&&Number.isFinite(d)&&d>0?d:pathDuration(path,this.config.speed);}
  /** Distance-travelled fraction of the current walk from the character adapter, or null (fall back to time). */
  private walkFraction():number|null {const f=this.character?.walkProgress?.();return typeof f==='number'&&Number.isFinite(f)?Math.max(0,Math.min(1,f)):null;}
  private turnSeconds():number {const s=this.character?.actionSeconds?.('turn');return s&&s>0&&Number.isFinite(s)?s:1.5;}
  /** from (T2+): the camera pose the user dragged to in the room; the stand-up move then starts by panning from it
   *  back to the girl (no rejoin cut). Omitted = start on cameraHome. */
  async leaveHome(options?:{from?:Pose}):Promise<Result> {
    const fail=this.blocked('home',true);if(fail)return fail;
    return this.operate('standing',async t=>{
      const c=this.config,turn:Action={kind:'turn',controllerRoot:c.seat.standingControllerRoot,fromYawRad:c.seat.yawRad,toYawRad:pathHeading(c.toDoor),direction:'left'};
      if(this.mode==='motion'&&c.cameraStandTurn&&c.cameraTracks?.standTurn){
        const stand=this.character?.actionSeconds?.('stand'),standS=stand&&stand>0&&Number.isFinite(stand)?stand:1.0,turnS=this.turnSeconds();
        const from=options?.from,lead=from?rejoinSeconds(from,c.cameraHome):0,segs:SpanSegment[]=[];
        if(lead>0)segs.push({seconds:lead,cameras:[{...from!,progress:0},{...c.cameraHome,progress:1}],run:tk=>this.waitSeconds(lead,tk)});
        segs.push({seconds:standS+turnS,cameras:c.cameraStandTurn,run:async tk=>{await this.action({kind:'stand',seat:c.seat},tk);tk.check();this.change('turning-out');await this.action(turn,tk);}});
        await this.span(segs,t,c.cameraTracks.standTurn);
      } else {
        await this.action({kind:'stand',seat:c.seat},t);
        if(this.mode==='motion'){const k=c.cameraHomeToDoor??[c.cameraHome,c.cameraToDoor[0]],o=c.cameraTracks?.homeToDoor;await t.wait(o?this.world!.animateCamera(k,1,t,o):this.world!.animateCamera(k,1,t));}
        t.check();this.change('turning-out');await this.action(turn,t);
      }
      this.change('walking-out');await this.walk(c.toDoor,c.cameraToDoor,t);
      // Sea backdrop is already on indoors. The island has to come on with the swing, or this second shows the sea through the open doorway.
      this.change('opening-door');this.world!.setLayers(BOTH);this.world!.setRoomLightWeight?.(1);
      const reach=this.character?.doorReachTiming?.();
      if(reach&&this.character?.performDoorReach&&Number.isFinite(reach.durationSec)&&reach.durationSec>0&&Number.isFinite(reach.contactSec)){
        // Touch-and-release: reach the closed handle before the leaf moves; no continuous hand pin after contact.
        // Await both the door and the entire arm recovery before the first step.
        const contact=Math.max(0,Math.min(reach.durationSec,reach.contactSec));
        await t.wait(Promise.all([this.character.performDoorReach(t),(async()=>{if(this.world!.wait)await this.waitSeconds(contact,t);else if(contact>0)await t.wait(this.world!.animateDoor(0,0,contact,t));t.check();await t.wait(this.world!.animateDoor(0,c.openDeg,1,t));})()]));
      }else await t.wait(this.world!.animateDoor(0,c.openDeg,1,t));t.check();
      this.change('crossing-out');
      const crossOut=c.cameraCrossOut??[c.cameraInside,c.cameraOutside],toIsland=c.cameraToIsland??(c.cameraCharacter?[c.cameraOutside,c.cameraCharacter,c.cameraIsland]:[c.cameraOutside,c.cameraIsland]);
      if(c.cameraTracks?.outbound){
        const end=c.toIsland[c.toIsland.length-1],settle=c.crane?.settleSeconds??0;
        const segs:SpanSegment[]=[this.walkSegment(c.outCrossing,crossOut),this.walkSegment(c.toIsland,settle>0&&!c.cameraSettle?toIsland.slice(0,-1):toIsland)];
        if(settle>0){const fromYaw=pathHeading(c.toIsland,true),toYaw=c.islandYawRad??0,turnS=this.turnSeconds();
          const turnNeeded=Math.abs(Math.atan2(Math.sin(toYaw-fromYaw),Math.cos(toYaw-fromYaw)))>.01&&turnS<=settle;
          segs.push({seconds:settle,cameras:c.cameraSettle??[{...toIsland[toIsland.length-1],progress:1}],run:async tk=>{
            if(turnNeeded){await this.action({kind:'turn',controllerRoot:end,fromYawRad:fromYaw,toYawRad:toYaw,direction:'left'},tk);await this.waitSeconds(settle-turnS,tk);}
            else await this.waitSeconds(settle,tk);}});}
        const cs=c.crane?.startSeconds;
        const dd=c.doorDrift,total=segs.reduce((x,g)=>x+g.seconds,0),door=dd?this.doorKeys(total,segs[0].seconds+dd.closeAfter,dd.closeSeconds,c.openDeg,this.islandDoorDeg()):undefined;
        await this.span(segs,t,c.cameraTracks.outbound,c.crane&&cs!==undefined?{name:'crane-start',progress:c.crane.startProgress,seconds:cs}:undefined,c.wind?.outbound,door);
      }
      else{await this.walk(c.outCrossing,crossOut,t);await this.walk(c.toIsland,toIsland,t);}
      // Weight is already 0 here and the camera is exactly cameraIsland with zero speed: restore() changes nothing visible.
      this.stable='island';this.restore();this.change('island');this.cameraEvent({kind:'settled',place:'island'});
    });
  }
  /** Real scene preparation can run over a settled result. A failed load leaves its lease and rewards intact. */
  async prepareRegion(target:JourneyRegion):Promise<Result>{
    if(!this.journey)return {ok:false,reason:'journey-unavailable'};
    if(this.journey.snapshot().region===target&&!this.journey.isInTransit())return {ok:true};
    const expected=this.stable,fail=this.blocked(expected,true);if(fail)return fail;
    if(!['island','meadow','skycity','lakeside','level'].includes(expected))return {ok:false,reason:'journey-wrong-origin'};
    if(expected==='level'&&!this.level?.isSettledResult?.())return {ok:false,reason:'journey-requires-settled-result'};
    return this.operate('region-loading',async token=>{
      const pose=this.pose();if(pose.kind!=='standing')throw Error('journey-needs-standing-origin');
      await this.journey!.prepare(target,pose.controllerRoot,token);token.check();this.change(this.stable);
    });
  }
  /** sail-blue: departure handoff (see RegionJourneyController.adoptLive). Level state only. */
  adoptJourneyLive(root:Vec|null,yawRad?:number):boolean{if(this.state!=='level'||!this.journey)return false;return this.journey.adoptLive(root,yawRad);}
  async travelRegion(target:JourneyRegion):Promise<Result>{
    if(!this.journey)return {ok:false,reason:'journey-unavailable'};
    if(this.journey.snapshot().region===target&&!this.journey.isInTransit())return {ok:true};
    const fail=this.blocked(this.stable,true);if(fail)return fail;
    if(!(this.stable==='island'||this.stable==='meadow'||this.stable==='skycity'))return {ok:false,reason:'journey-wrong-origin'};
    return this.operate('region-loading',async token=>{
      const pose=this.pose();if(pose.kind!=='standing')throw Error('journey-needs-standing-origin');
      (this.journey as any).bindWorld?.(this.world)/* transitions-continuous: the >3 s fallback cover */;
      await this.journey!.prepare(target,pose.controllerRoot,token);token.check();
      this.world!.setLayers(ISLAND);this.world!.setRoomLightWeight?.(0);this.character!.setVisible(true);
      this.change('region-travel');await this.journey!.walk(this.character!,this.world!,token);token.check();
      this.stable=target;this.restore();this.change(target);
    });
  }
  async enterSkycity():Promise<Result> {
    if(this.journey?.isInTransit())return {ok:false,reason:'finish-region-journey-first'};
    const fail=this.blocked('island');if(fail)return fail;
    if(!this.skycity)return {ok:false,reason:'skycity-unavailable'};
    return this.operate('skycity-loading',async token=>{
      const pending=this.skycity!.enter(token).then(lease=>{if(token.cancelled){lease.dispose();throw new Cancelled();}return lease;});
      const lease=await token.wait(pending);token.check();this.visit=lease;this.stable='skycity';
      try{this.restore();this.change('skycity');}
      catch(error){this.visit=null;this.stable='island';lease.dispose();throw error;}
    });
  }
  exitSkycity():Result {
    if(this.journey?.snapshot().region==='skycity')return {ok:false,reason:'return-route-not-yet-available'};
    const fail=this.blocked('skycity');if(fail)return fail;
    const visit=this.visit;this.visit=null;visit?.dispose();this.stable='island';this.restore();this.change('island');return {ok:true};
  }
  async enterLevel(stageId:string):Promise<Result> {
    const origin=this.journey?.snapshot().region??'island';
    if(this.journey?.isInTransit())return {ok:false,reason:'finish-region-journey-first'};
    const fail=this.blocked(origin);if(fail)return fail;
    if(!stageId.trim())return {ok:false,reason:'empty-stage'};
    return this.operate('level-loading',async t=>{
      const pending=this.levels.enter(stageId,t).then(lease=>{if(t.cancelled){lease.dispose();throw new Cancelled();}return lease;});
      // Shot overlaps the load. The board stays off screen until it can take a finger, then the shot's remaining time.
      // A fast load still plays the shot; a slow load does not add another wait after both are done.
      const cover=this.playEnterCover(t);void cover.then(()=>{},()=>{});
      let lease:LevelLease|null=null;
      try {
        lease=await t.wait(pending);t.check();
        if(lease.whenPlayable)await t.wait(lease.whenPlayable());
        t.check();await cover;t.check();
        lease.reveal?.();
        this.level=lease;this.levelOrigin=origin;this.stable='level';this.restore();this.change('level');
      } catch(error) {
        if(lease&&this.level!==lease){try{lease.dispose();}catch(disposeError){console.warn('enter-level dispose failed',String(disposeError));}}
        // A hung board must not stay on screen with input frozen. The island is still the stable place.
        const notReady=!!error&&typeof (error as {message?:unknown}).message==='string'&&(error as {message:string}).message==='enter-level-not-ready';
        if(notReady){t.cancel();console.warn('[enter-level] not ready; staying on the island');this.restore();this.change(this.stable);throw new Cancelled();}
        throw error;
      }
    });
  }
  /** The world lease plays the push-in whenever it has one. Mode is logged, not used as a gate:
   *  a device whose mode is not motion was cutting straight to the board. No playEnterLevel (tests) stays immediate. */
  private async playEnterCover(token:Cancellation):Promise<void> {
    const play=this.world?.playEnterLevel;
    console.info('[enter-level] cover', this.mode, !!play);
    if(!play)return;
    try{await token.wait(play(token));}
    catch(err){
      if(err instanceof Cancelled||token.cancelled)throw err instanceof Cancelled?err:new Cancelled();
      if(!(err instanceof CameraTrackFailure))throw err;
      console.warn('enter-level shot skipped',String(err));await this.waitSeconds(ENTER_LEVEL_SHOT_S,token);
    }
  }
  exitLevel():Result {
    const fail=this.blocked('level');if(fail)return fail;
    const accepted=this.level!.requestExit();if(!accepted.ok){this.error=accepted.reason;this.emit(this.snapshot());return accepted;}
    this.level?.dispose();this.level=null;this.stable=this.levelOrigin;this.restore();this.change(this.levelOrigin);return {ok:true};
  }
  /** 「主页」 must work wherever she stands. From an arrived meadow/skycity journey region (no walk-back route exists) or a
   *  paused/failed journey she is first set back on the island (journey scenes released, campaign save untouched), then
   *  walks home as usual. A journey that is actively running stays busy; the region-visit skycity keeps exitSkycity. */
  private leaveJourneyForIsland():Result|null {
    const j=this.journey;if(!j||this.current||this.visit||this.hidden||this.needsResume)return null;
    if(!['island','meadow','skycity','lakeside'].includes(this.state))return null;
    if(j.snapshot().region==='island'&&!j.isInTransit())return null;
    try{j.returnToIsland();}catch(error){return {ok:false,reason:String((error as Error)?.message??error)};}
    // Mac re-check 2607de6: walking island→home from a region took 44-48 s (day) / >127 s (night, frame-dt
    // capped at 0.1 s while fps<10). From a journey region the host covers the screen with a fade, so place
    // her straight at home (seated pose, home camera/layers) instead of replaying the walk.
    this.stable='home';this.restore();this.change('home');this.cameraEvent({kind:'settled',place:'home'});return {ok:true};
  }
  /** build05-next (风铃湖畔 fallback, toast 「湖畔暂时没准备好，先回小岛吧」): after a failed island→lakeside journey or a failed
   *  lakeside board, drop the lakeside journey scenes and stand her on the island (no retry state; saves untouched). */
  abandonLakesideJourney():Result {
    const j=this.journey;if(!j||this.state==='disposed')return {ok:false,reason:'journey-unavailable'};
    if(this.current)return {ok:false,reason:'busy'};
    const s=j.snapshot();if(s.target!=='lakeside'&&s.region!=='lakeside')return {ok:true};
    try{j.returnToIsland();}catch(error){return {ok:false,reason:String((error as Error)?.message??error)};}
    this.error=null;this.stable='island';this.restore();this.change('island');return {ok:true};
  }
  async returnHome():Promise<Result> {
    const left=this.leaveJourneyForIsland();if(left)return left;
    if(this.journey?.isInTransit())return {ok:false,reason:'finish-region-journey-first'};
    const fail=this.blocked('island',true);if(fail)return fail;
    return this.operate('walking-home',async t=>{
      this.doorShutSent=false; // this return may shut the leaf again
      // T2 (mirror): enter BOTH with exterior lighting (weight 0) so the first return frame matches the island frame.
      // Hold island light in the SAME frame the interior view turns on (the rig resets to room light on that switch).
      const c=this.config;this.world!.setLayers(BOTH);if(c.interiorLighting)this.world!.setRoomLightWeight?.(0);
      const toThreshold=c.cameraToThreshold??[c.cameraIsland,c.cameraOutside],crossIn=c.cameraCrossIn??[c.cameraOutside,c.cameraInside];
      if(c.cameraTracks?.inbound){
        // T2+: she first turns from islandYaw onto the path (the original snapped ~160 deg on the first walk frame);
        // the crane-down starts with the turn, so camera and girl start together.
        const a=c.toThreshold[0],fromYaw=c.islandYawRad??0,toYaw=pathHeading(c.toThreshold),turnS=this.turnSeconds();
        const segs:SpanSegment[]=[];let walkKeys=toThreshold;const lead=c.crane?.returnLeadSeconds??0;
        if(lead>0){segs.push({seconds:lead,cameras:[{...toThreshold[0],progress:0}],run:tk=>this.waitSeconds(lead,tk)});walkKeys=toThreshold.slice(1);}
        if(c.crane&&Math.abs(Math.atan2(Math.sin(toYaw-fromYaw),Math.cos(toYaw-fromYaw)))>.01){
          // The crane-down starts with the turn: the turn segment owns the start key and the walk drops its copy, so the
          // camera never holds then launches mid-ease (that was a C1-only start: 17 m/s^2 in one frame).
          segs.push({seconds:turnS,cameras:lead>0?[]:[{...toThreshold[0],progress:0}],run:tk=>this.action({kind:'turn',controllerRoot:a,fromYawRad:fromYaw,toYawRad:toYaw,direction:'left'},tk)});
          walkKeys=toThreshold.slice(1);}
        segs.push(this.walkSegment(c.toThreshold,walkKeys));
        if(c.cameraEntry&&this.mode==='motion'){await this.entrySpan(segs,t);return;}
        segs.push(this.walkSegment(c.inCrossing,crossIn,'crossing-in'));
        const dd=c.doorDrift,total=segs.reduce((x,g)=>x+g.seconds,0),ci=total-segs[segs.length-1].seconds;
        const door=dd&&this.mode==='motion'?this.doorKeys(total,ci-dd.openBefore-dd.openSeconds,dd.openSeconds,this.islandDoorDeg(),c.openDeg):undefined;
        if(dd&&!door)this.world!.setDoor(c.openDeg);
        await this.span(segs,t,c.cameraTracks.inbound,undefined,undefined,door);
      }
      else{if(c.doorDrift)this.world!.setDoor(c.openDeg);await this.walk(c.toThreshold,toThreshold,t);
        this.change('crossing-in');await this.walk(c.inCrossing,crossIn,t);}
      // No original concurrent door-close samples: stop inside, THEN close, THEN approach seat.
      // 'closing-door' still marks this legacy stop. The shut event waits until animateDoor has put the leaf at 0.
      this.change('closing-door');await t.wait(this.world!.animateDoor(c.openDeg,0,1,t));t.check();
      this.homeLayers();this.emitDoorShut();this.change('walking-to-seat');await this.walk(c.toSeat,c.cameraToSeat??[c.cameraInside,c.cameraHome],t);
      this.change('sitting');await this.action({kind:'sit',seat:c.seat},t);
      this.stable='home';this.restore();this.change('home');this.cameraEvent({kind:'settled',place:'home'});
    });
  }
  /** Door shut: interior-only layers on the full room light (T5: setLayers(interior) already lands on w=1). */
  private homeLayers():void {this.world!.setLayers(HOME);this.world!.setRoomLightWeight?.(1);}
  /** T2+ return entry (RouteConfig.cameraEntry): `segs` = the inbound segments up to the doorway key; appends crossing-in,
   *  door close, toSeat and sit and runs them as ONE span. The inbound ease-in keeps its absolute duration and the cruise
   *  speed is unchanged (easeIn' = easeIn*Tin/T with Tin = the old inbound span incl. crossing-in, easeIn'+easeOut' = easeIn+easeOut), so every frame up to the doorway is
   *  the same as the old inbound track's cruise; the old 0.9 s ease-out stop at the end of crossing-in is gone and the
   *  move eases out onto cameraHome instead. Entry keys (after the doorway key) are re-placed with remapProgress so the
   *  lens reaches each key when she is at it. */
  private async entrySpan(segs:SpanSegment[],t:Cancellation):Promise<void> {
    const c=this.config,E=c.cameraEntry!,dd=c.doorDrift,o=c.cameraTracks!.inbound!;
    // sit segment (camera clock) = turn + the RUNTIME sit_down length (or its settle point when exposed); 1.0 s only when the
    // adapter reports no clip at all (perform() then fails anyway).
    const sitClip=this.character?.actionSeconds?.('sit'),clipOk=!!sitClip&&sitClip>0&&Number.isFinite(sitClip),settle=clipOk?this.character?.actionSettleSeconds?.('sit'):undefined;
    const sitS=this.turnSeconds()+(clipOk?(settle!==undefined&&settle>0&&settle<=sitClip!?settle:sitClip!):1.0);
    const tIn=segs.reduce((x,g)=>x+g.seconds,0),crossS=this.walkSeconds(c.inCrossing),seatS=this.walkSeconds(c.toSeat);
    // Mac r4 follow: doorSeconds <= 0 = no stop at the entrance (the leaf closes behind the lens during toSeat).
    const stop=!(E.doorSeconds<=0),doorS=stop?(E.doorSeconds>0?E.doorSeconds:1):0;
    segs.push(this.walkSegment(c.inCrossing,E.cross,'crossing-in'));
    if(stop)segs.push({seconds:doorS,cameras:E.door,state:'closing-door',run:async tk=>{await this.waitSeconds(doorS,tk);tk.check();this.world!.setDoor(0);this.homeLayers();this.emitDoorShut();}});
    segs.push(this.walkSegment(c.toSeat,E.seat,'walking-to-seat'),
      {seconds:sitS,cameras:E.sit,state:'sitting',run:tk=>this.action({kind:'sit',seat:c.seat},tk)});
    const total=segs.reduce((x,g)=>x+g.seconds,0),a=Math.max(0,o.easeIn??0),b=Math.max(0,o.easeOut??0);
    let a2=a*(tIn+crossS)/total,b2=Math.max(0,Math.min(.5,a+b-a2));
    if(E.easeInSeconds!==undefined||E.easeOutSeconds!==undefined){a2=Math.max(0,Math.min(.5,(E.easeInSeconds??0)/total));b2=Math.max(0,Math.min(.5,(E.easeOutSeconds??0)/total));}
    const track:TrackOptions={...o,easeIn:a2,easeOut:b2},rm=c.remapProgress,at=(s:number)=>rm?rm(Math.max(0,Math.min(1,s/total)),track):Math.max(0,Math.min(1,s/total));
    const p0=E.remapAll?0:tIn/total,keyMap=(keys:Pose[]):Pose[]=>{if(!rm)return keys;
      const out=keys.map(k=>{const p=(k as any).progress as number;return p>p0+1e-9&&p<1?{...k,progress:rm(p,track)}:k;});
      for(let i=1;i<out.length;i++)if(!(((out[i] as any).progress as number)>((out[i-1] as any).progress as number))){console.warn('entry keys not monotone after retime; using span clock');return keys;}
      return out;};
    const seat0=tIn+crossS+doorS,clamp01=(v:number)=>Math.max(0,Math.min(1,v));
    // Door channel (key progress): drift reopen (doorDrift, island part) then the close.
    const open=c.openDeg,from=dd?this.islandDoorDeg():open,door:Array<readonly [number,number]>=[[0,from]];
    if(dd&&from!==open){const r1=tIn-dd.openBefore,r0=r1-dd.openSeconds;door.push([Math.max(0,r0/total),from],[Math.max(1e-6,r1/total),open]);}
    let shutAfter=1;
    if(stop){// the close starts 0.1 of the door segment after she stops (key-progress clock vs state change: never during crossing-in)
      const d0=tIn+crossS+.1*doorS,d1=tIn+crossS+doorS*Math.max(.2,Math.min(1,E.doorCloseFraction||1));shutAfter=at(d0);door.push([at(d0),open],[at(d1),0],[1,0]);}
    else{const dc=E.doorClose??{from:.7,seconds:2.4},c0=seat0+clamp01(dc.from)*seatS,s0=at(c0),s1=at(Math.min(total,c0+Math.max(.1,dc.seconds)));shutAfter=s0;door.push([s0,open],[s1,0],[1,0]);}
    for(let i=1;i<door.length;i++)if(!(door[i][0]>door[i-1][0]))door[i]=[door[i-1][0]+1e-6,door[i][1]];
    // Room light w: unchanged T5 path (walk ramps interiorLighting.toThreshold / crossIn on the walk clock, see the route builder).
    // onDoorShut: the leaf is at 0. Follow switches to HOME layers then; the stop path already does that at the end of
    // its closing-door segment. Either way the public shut event is this moment, not the 'closing-door' state change.
    await this.span(segs,t,track,undefined,undefined,door,keyMap,{onDoorShut:()=>{if(!stop)this.homeLayers();this.emitDoorShut();},shutAfter});
    this.stable='home';this.restore();this.change('home');this.cameraEvent({kind:'settled',place:'home'});
  }
  advance(seconds:number):void {
    if(this.state==='disposed'||this.state==='error'||this.hidden||this.needsResume)return;
    if(Number.isFinite(seconds)&&seconds>0&&this.characterReady()){try{(globalThis as any).__qfInstallPlayerAnim?.(this.character);}catch{}/* __QF_PLAYER_ANIM for QA (TransitionChain) */;this.character!.advance(Math.min(seconds,.1));if(this.state==='region-travel'&&this.world)this.journey?.observe(this.character!,this.world,Math.min(seconds,.1));}
  }
  /** r4.1 (Grok Bot, Mac evidence C_show_snapback_strip): a background trip during the home exit or the walk home no
   *  longer cancels it. V1 cancelled the transition (token + jobs), restore()d the stable pose (home = the seat) and on
   *  show() restarted leaveHome() from the chair: she snapped back to the seat and replayed the whole exit (exit track
   *  from 0, wind/waves hard-stopped by the 'standing' quiet). Now hide() FREEZES it: token, jobs, camera track, character
   *  action and state are kept untouched; hidden+needsResume stop both clocks (advance() here, the job loop in
   *  WorldFlowComponent.update), so position, clip time, camera progress, door angle, light ramps and wind hold exactly.
   *  show() lifts the freeze by itself (no 继续): the same walk continues from the same frame. Seated home also
   *  freezes in place; island, levels, journeys and sky visit keep the paused + resume() behaviour. */
  private seatedFrozen=false;
  private frozen=false;
  private freezable():boolean {return !!this.current&&!!this.world&&(EXIT_STATES.indexOf(this.state)>=0||RETURN_STATES.indexOf(this.state)>=0);}
  hide():void {
    if(this.state==='disposed'||this.hidden)return;
    // Only an already active seated home auto-resumes; cancelled transitions and errors keep their gate.
    if(this.state==='home'&&!this.needsResume&&!this.current&&this.world){this.seatedFrozen=true;this.hidden=true;this.needsResume=true;this.emit(this.snapshot());return;}
    if(this.freezable()){this.frozen=true;this.hidden=true;this.needsResume=true;this.emit(this.snapshot());return;}
    if(this.character&&this.world)this.journey?.suspend(this.character,this.world);this.hidden=true;this.needsResume=true;this.invalidate();
    this.level?.hide();this.visit?.hide();this.restore();this.change('paused');
  }
  /** Back from background: the place the player left is visible again, still paused until resume().
   *  Does not move the camera or replay the sit/stand pose (hide() already restored the stable pose).
   *  A frozen seated home / exit / walk home resumes by itself, from the frame it was hidden on. */
  show():void {
    if(this.state==='disposed'||!this.hidden)return;this.hidden=false;
    if(this.seatedFrozen){this.seatedFrozen=false;this.needsResume=false;this.emit(this.snapshot());return;}
    if(this.frozen){this.frozen=false;if(this.state!=='error'&&this.world){this.needsResume=false;if(!this.current)this.restore();this.emit(this.snapshot());return;}} // finished while hidden (last step resolved): land it visibly
    this.level?.showPaused();
    if(this.state!=='error'&&this.stable==='level'&&this.level?.isSettledResult?.()){
      this.needsResume=false;this.restore();this.change('level');return;
    }
    if(this.state!=='error')this.presentPausedView();this.emit(this.snapshot());
  }
  /** Home/island layers and the character, or the sky visit. A level keeps world layers NONE; the board is the screen. */
  private presentPausedView():void {
    if(!this.world)return;
    const place=this.stable;
    if(this.journey?.hasCheckpoint()&&place!=='home'&&place!=='level'){this.world.setLayers(ISLAND);this.journey.show(true);this.character?.setVisible(true);}
    else if(place==='home'||place==='island'){this.world.setLayers(place==='home'?HOME:ISLAND);if(this.characterReady())this.character?.setVisible(true);}
    else if(place==='skycity')this.visit?.show();
  }
  resume():Result {
    if(this.state==='disposed'||this.state==='error')return {ok:false,reason:'resume-not-allowed'};
    if(this.hidden)this.show();
    if(this.hidden||!this.needsResume)return {ok:false,reason:'resume-not-allowed'};
    if(this.stable==='level'){const result=this.level!.resume();if(!result.ok){this.error=result.reason;this.emit(this.snapshot());return result;}}
    this.needsResume=false;this.restore();this.change(this.world?this.stable:'idle');return {ok:true};
  }
  cancelTransition():Result {
    if(!this.current)return {ok:false,reason:'no-transition'};
    if(this.character&&this.world)this.journey?.suspend(this.character,this.world);
    this.invalidate();this.restore();this.change(this.world?this.stable:'idle');return {ok:true};
  }
  fault(message:string):void {
    if(this.state==='disposed')return;this.error=message;this.needsResume=true;this.invalidate();this.level?.hide();this.visit?.hide();this.character?.setVisible(false);this.world?.setLayers(NONE);this.change('error');
  }
  dispose():void {
    if(this.state==='disposed')return;this.setWind(0);this.windListeners.clear();this.doorShutListeners.clear();this.invalidate();this.level?.dispose();this.level=null;this.visit?.dispose();this.visit=null;
    this.journey?.dispose();this.character?.dispose();this.character=null;this.world?.dispose();this.world=null;this.change('disposed');
  }
}
