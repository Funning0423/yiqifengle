import { CameraTrackFailure } from './CameraPose';
import type { TrackOptions, WeightRamp } from './CameraPose';
/** Engine-independent orchestration. No scene graph, timers, persistence or browser globals. */
export type Vec = readonly [number, number, number];
export type Mode = 'fixed' | 'motion';
export type Place = 'home' | 'island' | 'level' | 'skycity';
export type State = 'idle' | 'loading' | 'home' | 'standing' | 'turning-out' | 'walking-out' | 'opening-door' |
  'crossing-out' | 'island' | 'level-loading' | 'level' | 'skycity-loading' | 'skycity' | 'walking-home' | 'crossing-in' |
  'closing-door' | 'walking-to-seat' | 'sitting' | 'paused' | 'error' | 'disposed';
/** doorwayInterior (T2): keep only the interior renderers that can be seen through the open door/windows from the
 * island camera (adapter-owned subset), without interior lighting. Omitted = false (old behaviour). */
export type Layers = Readonly<{interior:boolean; exterior:boolean; door:boolean; backdrop:boolean; doorwayInterior?:boolean}>;
/** Authoring/look-at form. Converted to CameraPose (CameraPose.ts) and written ONLY by applyCameraPose. fovVerticalDeg omitted = keep current fov. */
export type Pose = Readonly<{position:Vec; target:Vec; progress?:number; fovVerticalDeg?:number}>;
export type Seat = Readonly<{position:Vec; back:Vec; yawRad:number; seatedFoot:Vec; standingFoot:Vec; seatedControllerRoot:Vec; standingControllerRoot:Vec}>;
export type StablePose = {kind:'seated'; seat:Seat} | {kind:'standing'; controllerRoot:Vec; yawRad:number};
export type Action = {kind:'stand'|'sit'; seat:Seat} | {kind:'turn'; controllerRoot:Vec; fromYawRad:number; toYawRad:number; direction:'left'} | {kind:'walk'; path:readonly Vec[]; duration:number};
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
}
/** T2+: camera events for audio/debug/HUD sequencing (no logging here). crane-start: the outbound crane leaves the rail;
 *  settled: the camera is at the stable pose with zero speed and the character is still (fired right after restore()). */
export type CameraEvent=Readonly<{kind:'crane-start';segment:'toIsland';progress:number;seconds:number}>|Readonly<{kind:'settled';place:'island'|'home'}>;
/** UI is granted commands/status only; never a world node or camera reference. */
export interface LevelLease { requestExit():Result; hide():void; showPaused():void; resume():Result; dispose():void; }
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
  animateCamera(path:readonly Pose[],seconds:number,token:Cancellation,options?:TrackOptions):Promise<void>;
  /** T2+ optional: resolve after `seconds` of the same world job clock (used for timed camera marks). */
  wait?(seconds:number,token:Cancellation):Promise<void>;
  cancelTransient():void;
  /** T5 room-light API (optional; owner GGbot; contract in render/RoomLightingRig.ts + docs/T5-material-swap.md "API").
   * WorldFlowCore itself never drives w; camera-segment owners call these. Older adapters may omit them. */
  setRoomLightWeight?(weight:number):boolean;
  getRoomLightWeight?():number;
  hasRoomLight?():boolean;
  isWorldVisible?():boolean;
  blendRoomLight?(from:number,to:number,seconds:number,token:Cancellation):Promise<void>;
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
  /** T2+: outbound crane. cameraToIsland's LAST key (cameraIsland) is reached `settleSeconds` after she stops (camera
   *  eases to rest while she turns to islandYaw); startProgress = toIsland walk progress of the crane's first key.
   *  returnLeadSeconds: the return crane-down starts this long before she turns/walks (mirror of settleSeconds).
   *  startSeconds: crane-start mark time from the start of crossing-out (precomputed by the route builder from the eased
   *  outbound track; WorldFlowCore stays free of CameraPose value imports). */
  crane?:Readonly<{startProgress:number;settleSeconds:number;returnLeadSeconds?:number;startSeconds?:number}>;
  /** T3a: authored seat approach. Omitted = original [cameraInside,cameraHome]. Must end exactly on cameraHome. */
  cameraToSeat?:readonly Pose[];
  /** T2: interior-light weight ramps on the exterior walks (walk progress). Omitted = old on/off switching. */
  interiorLighting?:Readonly<{crossOut?:WeightRamp;toIsland?:WeightRamp;toThreshold?:WeightRamp;crossIn?:WeightRamp}>;
  openDeg:number; speed:number;
  /** 0007 v1.2: character yaw at the island landing point (exit_path_17), from the pose data table. Default 0. */
  islandYawRad?:number;
}
export type Result={ok:true}|{ok:false;reason:string};
export type Snapshot=Readonly<{state:State;stable:Place;mode:Mode;hidden:boolean;needsResume:boolean;characterReady:boolean;error:string|null}>;
const HOME:Layers={interior:true,exterior:false,door:true,backdrop:true};
const ISLAND:Layers={interior:false,exterior:true,door:true,backdrop:true,doorwayInterior:true};
const BOTH:Layers={interior:true,exterior:true,door:true,backdrop:true};
const NONE:Layers={interior:false,exterior:false,door:false,backdrop:false};
export const layerStates={HOME,ISLAND,BOTH,NONE};
export const distance=(a:Vec,b:Vec)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
export function pathDuration(path:readonly Vec[],speed:number):number {return path.slice(1).reduce((sum,p,i)=>sum+distance(path[i],p),0)/speed;}
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
export type SpanSegment={seconds:number;cameras:readonly Pose[];run:(token:Cancellation)=>Promise<void>;state?:State};
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
  private visit:RegionVisitLease|null=null; private readonly skycity:RegionVisitAdapter|undefined;
  private readonly levels:LevelAdapter; private readonly loadWorld:(token:Cancellation)=>Promise<WorldLease>;
  private readonly emit:(snapshot:Snapshot)=>void;
  private readonly cameraListeners=new Set<(event:CameraEvent)=>void>();
  /** T2+: subscribe to camera events; returns unsubscribe. Listener errors are contained. */
  onCameraEvent(listener:(event:CameraEvent)=>void):()=>void {this.cameraListeners.add(listener);return ()=>{this.cameraListeners.delete(listener);};}
  private cameraEvent(event:CameraEvent):void {for(const fn of Array.from(this.cameraListeners)){try{fn(event);}catch(error){console.warn('camera event listener failed',String(error));}}}
  constructor(options:{config:RouteConfig;mode?:Mode;character?:CharacterAdapter;levels:LevelAdapter;skycity?:RegionVisitAdapter;loadWorld:(t:Cancellation)=>Promise<WorldLease>;onChange?:(s:Snapshot)=>void}) {
    this.config=options.config;this.mode=options.mode??'fixed';this.character=options.character??null;this.levels=options.levels;this.skycity=options.skycity;this.loadWorld=options.loadWorld;this.emit=options.onChange??(()=>{});
  }
  /** T2+: leaveHome({from}) starts the stand-up move on `from` (no rejoin cut needed by the caller). */
  get continuousLeave():boolean {const c=this.config;return this.mode==='motion'&&!!(c.cameraStandTurn&&c.cameraTracks?.standTurn);}
  snapshot():Snapshot {return Object.freeze({state:this.state,stable:this.stable,mode:this.mode,hidden:this.hidden,needsResume:this.needsResume,characterReady:this.characterReady(),error:this.error});}
  private change(state:State):void {this.state=state;this.emit(this.snapshot());}
  private characterReady():boolean {
    const a=this.character,c=a?.coordinates,s=this.config.seat;
    return !!(a?.calibrated&&c&&c.units==='m'&&c.up==='+Y'&&c.forward==='+Z'&&c.rootMotion==='controller-only'&&
      c.clearanceRadiusM>0&&c.clearanceRadiusM<=.18&&distance(c.standingRoot,s.standingControllerRoot)<1e-4&&
      distance(c.seatedRoot,s.seatedControllerRoot)<1e-4&&Math.abs(c.seatYawRad-s.yawRad)<1e-5);
  }
  private pose():StablePose {return this.stable==='home'?{kind:'seated',seat:this.config.seat}:{kind:'standing',controllerRoot:this.config.toIsland[this.config.toIsland.length-1],yawRad:this.config.islandYawRad??0};}
  private restore():void {
    if(!this.world)return;this.world.cancelTransient();this.world.setDoor(this.stable==='home'?0:this.config.openDeg);
    this.world.setCamera(this.stable==='home'?this.config.cameraHome:this.config.cameraIsland);
    this.world.setLayers(this.hidden||this.needsResume||this.stable==='level'||this.stable==='skycity'?NONE:this.stable==='home'?HOME:ISLAND);
    // Stable endpoints land on the full light set (home = room 1; island has the interior view off, rig ignores it).
    this.world.setRoomLightWeight?.(this.stable==='home'?1:0);
    if(this.characterReady())this.character!.cancelAndReset(this.pose());this.character?.setVisible(this.characterReady()&&!this.hidden&&!this.needsResume&&this.stable!=='level'&&this.stable!=='skycity');this.world.assertStaticWorld();
    if(this.visit){if(this.stable==='skycity'&&!this.hidden&&!this.needsResume)this.visit.show();else this.visit.hide();}
  }
  private invalidate():void {const old=this.current;this.current=null;old?.cancel();this.world?.cancelTransient();}
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
    const duration=pathDuration(path,this.config.speed),track=this.walkTrack(path),light=this.walkLight(path);
    // Both tracks use the same duration. Character adapter owns world displacement.
    // fixed mode used to leave the camera on cameraHome, so the girl walked out of the doorway frame.
    const camera=!cameras?Promise.resolve():this.mode==='motion'
      ? (track?this.world!.animateCamera(cameras,duration,token,track):this.world!.animateCamera(cameras,duration,token))
      : Promise.resolve(this.world!.setCamera(cameras[cameras.length-1]));
    // T2: lighting rides the same job clock and duration as the walk; the camera may ease, lighting follows walk progress.
    const lighting=light&&this.world!.blendRoomLight?this.roomLightRamp(light,duration,token):Promise.resolve();
    await token.wait(Promise.all([this.action({kind:'walk',path,duration},token), camera, lighting]).then(()=>{}));token.check();
  }
  /** T2+ drives T5 w from the walk's (= camera segment's) progress: hold `from` until ramp.start, then the rig's linear
   *  cancellable blend to `to` by ramp.end (monotone, no step; Voice bot polls getRoomLightWeight every frame). */
  private async roomLightRamp(r:WeightRamp,duration:number,token:Cancellation):Promise<void> {
    const s=Math.max(0,Math.min(1,r.start)),e=Math.max(s,Math.min(1,r.end));
    await this.waitSeconds(s*duration,token);token.check();
    if(e>s)await token.wait(this.world!.blendRoomLight!(r.from,r.to,(e-s)*duration,token));else this.world!.setRoomLightWeight?.(r.to);
  }
  /** T2+: ONE camera track over consecutive timed segments (walks, stand/turn, holds). Each segment's keys carry their
   *  own 0..1 progress; they are re-timed onto the span clock and a key at the same instant as the previous one is
   *  dropped (shared junction key). Characters/lighting run segment by segment on the same job clock. */
  private async span(segments:readonly SpanSegment[],token:Cancellation,track:TrackOptions,mark?:{name:'crane-start';progress:number;seconds:number}):Promise<void> {
    const keys=spanCameraKeys(segments),total=segments.reduce((a,x)=>a+x.seconds,0);
    let camera:Promise<void>=Promise.resolve();
    if(this.mode==='motion'){camera=this.world!.animateCamera(keys,total,token,track);
      if(mark&&mark.seconds>=0&&mark.seconds<=total&&this.world!.wait){const seconds=mark.seconds;
        this.world!.wait(seconds,token).then(()=>{if(!token.cancelled)this.cameraEvent({kind:'crane-start',segment:'toIsland',progress:mark.progress,seconds});},()=>{});}}
    else this.world!.setCamera(keys[keys.length-1]);
    const characters=(async()=>{for(const seg of segments){if(seg.state)this.change(seg.state);await seg.run(token);token.check();}})();
    await token.wait(Promise.all([characters,camera]).then(()=>{}));token.check();
  }
  private waitSeconds(seconds:number,token:Cancellation):Promise<void> {
    if(!(seconds>0))return Promise.resolve();
    if(!this.world!.wait){console.warn('WorldLease.wait missing; camera span timing degrades');return Promise.resolve();}
    return token.wait(this.world!.wait(seconds,token));
  }
  private walkSegment(path:readonly Vec[],cameras:readonly Pose[],state?:State):SpanSegment {return {seconds:pathDuration(path,this.config.speed),cameras,state,run:t=>this.walk(path,null,t)};}
  private turnSeconds():number {const s=this.character?.actionSeconds?.('turn');return s&&s>0&&Number.isFinite(s)?s:1.5;}
  /** from (T2+): the camera pose the user dragged to in the room; the stand-up move then starts by panning from it
   *  back to the girl (no rejoin cut). Omitted = start on cameraHome. */
  async leaveHome(options?:{from?:Pose}):Promise<Result> {
    const fail=this.blocked('home',true);if(fail)return fail;
    return this.operate('standing',async t=>{
      const c=this.config,turn:Action={kind:'turn',controllerRoot:c.seat.standingControllerRoot,fromYawRad:c.seat.yawRad,toYawRad:Math.atan2(c.toDoor[1][0]-c.toDoor[0][0],c.toDoor[1][2]-c.toDoor[0][2]),direction:'left'};
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
      this.change('opening-door');await t.wait(this.world!.animateDoor(0,c.openDeg,1,t));t.check();
      this.world!.setLayers(BOTH);this.world!.setRoomLightWeight?.(1);this.change('crossing-out');
      const crossOut=c.cameraCrossOut??[c.cameraInside,c.cameraOutside],toIsland=c.cameraToIsland??(c.cameraCharacter?[c.cameraOutside,c.cameraCharacter,c.cameraIsland]:[c.cameraOutside,c.cameraIsland]);
      if(c.cameraTracks?.outbound){
        const end=c.toIsland[c.toIsland.length-1],prev=c.toIsland[c.toIsland.length-2]??end,settle=c.crane?.settleSeconds??0;
        const segs:SpanSegment[]=[this.walkSegment(c.outCrossing,crossOut),this.walkSegment(c.toIsland,settle>0?toIsland.slice(0,-1):toIsland)];
        if(settle>0){const fromYaw=Math.atan2(end[0]-prev[0],end[2]-prev[2]),toYaw=c.islandYawRad??0,turnS=this.turnSeconds();
          const turnNeeded=Math.abs(Math.atan2(Math.sin(toYaw-fromYaw),Math.cos(toYaw-fromYaw)))>.01&&turnS<=settle;
          segs.push({seconds:settle,cameras:[{...toIsland[toIsland.length-1],progress:1}],run:async tk=>{
            if(turnNeeded){await this.action({kind:'turn',controllerRoot:end,fromYawRad:fromYaw,toYawRad:toYaw,direction:'left'},tk);await this.waitSeconds(settle-turnS,tk);}
            else await this.waitSeconds(settle,tk);}});}
        const cs=c.crane?.startSeconds;
        await this.span(segs,t,c.cameraTracks.outbound,c.crane&&cs!==undefined?{name:'crane-start',progress:c.crane.startProgress,seconds:cs}:undefined);
      }
      else{await this.walk(c.outCrossing,crossOut,t);await this.walk(c.toIsland,toIsland,t);}
      // Weight is already 0 here and the camera is exactly cameraIsland with zero speed: restore() changes nothing visible.
      this.stable='island';this.restore();this.change('island');this.cameraEvent({kind:'settled',place:'island'});
    });
  }
  async enterSkycity():Promise<Result> {
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
    const fail=this.blocked('skycity');if(fail)return fail;
    const visit=this.visit;this.visit=null;visit?.dispose();this.stable='island';this.restore();this.change('island');return {ok:true};
  }
  async enterLevel(stageId:string):Promise<Result> {
    const fail=this.blocked('island');if(fail)return fail;
    if(!stageId.trim())return {ok:false,reason:'empty-stage'};
    return this.operate('level-loading',async t=>{
      const pending=this.levels.enter(stageId,t).then(lease=>{if(t.cancelled){lease.dispose();throw new Cancelled();}return lease;});
      const lease=await t.wait(pending);t.check();this.level=lease;this.stable='level';this.restore();this.change('level');
    });
  }
  exitLevel():Result {
    const fail=this.blocked('level');if(fail)return fail;
    const accepted=this.level!.requestExit();if(!accepted.ok){this.error=accepted.reason;this.emit(this.snapshot());return accepted;}
    this.level?.dispose();this.level=null;this.stable='island';this.restore();this.change('island');return {ok:true};
  }
  async returnHome():Promise<Result> {
    const fail=this.blocked('island',true);if(fail)return fail;
    return this.operate('walking-home',async t=>{
      // T2 (mirror): enter BOTH with exterior lighting (weight 0) so the first return frame matches the island frame.
      // Hold island light in the SAME frame the interior view turns on (the rig resets to room light on that switch).
      const c=this.config;this.world!.setLayers(BOTH);if(c.interiorLighting)this.world!.setRoomLightWeight?.(0);
      const toThreshold=c.cameraToThreshold??[c.cameraIsland,c.cameraOutside],crossIn=c.cameraCrossIn??[c.cameraOutside,c.cameraInside];
      if(c.cameraTracks?.inbound){
        // T2+: she first turns from islandYaw onto the path (the original snapped ~160 deg on the first walk frame);
        // the crane-down starts with the turn, so camera and girl start together.
        const a=c.toThreshold[0],b=c.toThreshold.find(p=>Math.hypot(p[0]-a[0],p[2]-a[2])>1e-6)??a,fromYaw=c.islandYawRad??0,toYaw=Math.atan2(b[0]-a[0],b[2]-a[2]),turnS=this.turnSeconds();
        const segs:SpanSegment[]=[];let walkKeys=toThreshold;const lead=c.crane?.returnLeadSeconds??0;
        if(lead>0){segs.push({seconds:lead,cameras:[{...toThreshold[0],progress:0}],run:tk=>this.waitSeconds(lead,tk)});walkKeys=toThreshold.slice(1);}
        if(c.crane&&Math.abs(Math.atan2(Math.sin(toYaw-fromYaw),Math.cos(toYaw-fromYaw)))>.01){
          // The crane-down starts with the turn: the turn segment owns the start key and the walk drops its copy, so the
          // camera never holds then launches mid-ease (that was a C1-only start: 17 m/s^2 in one frame).
          segs.push({seconds:turnS,cameras:lead>0?[]:[{...toThreshold[0],progress:0}],run:tk=>this.action({kind:'turn',controllerRoot:a,fromYawRad:fromYaw,toYawRad:toYaw,direction:'left'},tk)});
          walkKeys=toThreshold.slice(1);}
        segs.push(this.walkSegment(c.toThreshold,walkKeys),this.walkSegment(c.inCrossing,crossIn,'crossing-in'));
        await this.span(segs,t,c.cameraTracks.inbound);
      }
      else{await this.walk(c.toThreshold,toThreshold,t);
        this.change('crossing-in');await this.walk(c.inCrossing,crossIn,t);}
      // No original concurrent door-close samples: stop inside, THEN close, THEN approach seat.
      this.change('closing-door');await t.wait(this.world!.animateDoor(c.openDeg,0,1,t));t.check();
      this.world!.setLayers(HOME);this.world!.setRoomLightWeight?.(1);this.change('walking-to-seat');await this.walk(c.toSeat,c.cameraToSeat??[c.cameraInside,c.cameraHome],t);
      this.change('sitting');await this.action({kind:'sit',seat:c.seat},t);
      this.stable='home';this.restore();this.change('home');this.cameraEvent({kind:'settled',place:'home'});
    });
  }
  advance(seconds:number):void {
    if(this.state==='disposed'||this.state==='error'||this.hidden||this.needsResume)return;
    if(Number.isFinite(seconds)&&seconds>0&&this.characterReady())this.character!.advance(Math.min(seconds,.1));
  }
  hide():void {
    if(this.state==='disposed'||this.hidden)return;this.hidden=true;this.needsResume=true;this.invalidate();
    this.level?.hide();this.visit?.hide();this.restore();this.change('paused');
  }
  show():void {if(this.state==='disposed'||!this.hidden)return;this.hidden=false;this.level?.showPaused();this.emit(this.snapshot());}
  resume():Result {
    if(this.state==='disposed'||this.state==='error'||this.hidden||!this.needsResume)return {ok:false,reason:'resume-not-allowed'};
    if(this.stable==='level'){const result=this.level!.resume();if(!result.ok){this.error=result.reason;this.emit(this.snapshot());return result;}}
    this.needsResume=false;this.restore();this.change(this.world?this.stable:'idle');return {ok:true};
  }
  cancelTransition():Result {
    if(!this.current)return {ok:false,reason:'no-transition'};
    this.invalidate();this.restore();this.change(this.world?this.stable:'idle');return {ok:true};
  }
  fault(message:string):void {
    if(this.state==='disposed')return;this.error=message;this.needsResume=true;this.invalidate();this.level?.hide();this.visit?.hide();this.character?.setVisible(false);this.world?.setLayers(NONE);this.change('error');
  }
  dispose():void {
    if(this.state==='disposed')return;this.invalidate();this.level?.dispose();this.level=null;this.visit?.dispose();this.visit=null;
    this.character?.dispose();this.character=null;this.world?.dispose();this.world=null;this.change('disposed');
  }
}
