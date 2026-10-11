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
}
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
  /** T2 optional: 1 = room lighting, 0 = exterior lighting, only meaningful while layers.interior is on. */
  setInteriorWeight?(weight:number):void;
  /** T2 optional: drive the weight with the SAME job clock as the walk/camera of identical duration. */
  animateInteriorWeight?(ramp:WeightRamp,seconds:number,token:Cancellation):Promise<void>;
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
  cameraTracks?:Readonly<{homeToDoor?:TrackOptions;toDoor?:TrackOptions;outbound?:TrackOptions;inbound?:TrackOptions;toIsland?:TrackOptions;toThreshold?:TrackOptions;crossIn?:TrackOptions;toSeat?:TrackOptions}>;
  /** T3a: authored seat approach. Omitted = original [cameraInside,cameraHome]. Must end exactly on cameraHome. */
  cameraToSeat?:readonly Pose[];
  /** T2: interior-light weight ramps on the exterior walks (walk progress). Omitted = old on/off switching. */
  interiorLighting?:Readonly<{toIsland:WeightRamp;toThreshold:WeightRamp}>;
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
export class WorldFlow {
  private state:State='idle'; private stable:Place='home'; private mode:Mode;
  private hidden=false; private needsResume=false; private error:string|null=null;
  private current:Cancellation|null=null; private world:WorldLease|null=null; private level:LevelLease|null=null;
  private character:CharacterAdapter|null; private readonly config:RouteConfig;
  private visit:RegionVisitLease|null=null; private readonly skycity:RegionVisitAdapter|undefined;
  private readonly levels:LevelAdapter; private readonly loadWorld:(token:Cancellation)=>Promise<WorldLease>;
  private readonly emit:(snapshot:Snapshot)=>void;
  constructor(options:{config:RouteConfig;mode?:Mode;character?:CharacterAdapter;levels:LevelAdapter;skycity?:RegionVisitAdapter;loadWorld:(t:Cancellation)=>Promise<WorldLease>;onChange?:(s:Snapshot)=>void}) {
    this.config=options.config;this.mode=options.mode??'fixed';this.character=options.character??null;this.levels=options.levels;this.skycity=options.skycity;this.loadWorld=options.loadWorld;this.emit=options.onChange??(()=>{});
  }
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
    // T2: stable endpoints carry their own exact lighting weight (home=room 1, everything else=exterior 0).
    this.world.setInteriorWeight?.(this.stable==='home'?1:0);
    this.world.setLayers(this.hidden||this.needsResume||this.stable==='level'||this.stable==='skycity'?NONE:this.stable==='home'?HOME:ISLAND);
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
  private async walk(path:readonly Vec[],cameras:readonly Pose[],token:Cancellation,track?:TrackOptions,light?:WeightRamp):Promise<void> {
    const duration=pathDuration(path,this.config.speed);
    // Both tracks use the same duration. Character adapter owns world displacement.
    // fixed mode used to leave the camera on cameraHome, so the girl walked out of the doorway frame.
    const camera=this.mode==='motion'
      ? (track?this.world!.animateCamera(cameras,duration,token,track):this.world!.animateCamera(cameras,duration,token))
      : Promise.resolve(this.world!.setCamera(cameras[cameras.length-1]));
    // T2: lighting rides the same job clock and duration as the walk; the camera may ease, lighting follows walk progress.
    const lighting=light&&this.world!.animateInteriorWeight?this.world!.animateInteriorWeight(light,duration,token):Promise.resolve();
    await token.wait(Promise.all([this.action({kind:'walk',path,duration},token), camera, lighting]).then(()=>{}));token.check();
  }
  /** T2/T3a: one camera track over consecutive walks. Keys keep their per-walk progress and are re-timed onto the
   *  combined clock (the shared junction key appears once), so the camera never stops or kinks between the walks. */
  private async walkSpan(segments:readonly {path:readonly Vec[];cameras:readonly Pose[];light?:WeightRamp;state?:State}[],token:Cancellation,track:TrackOptions):Promise<void> {
    const durations=segments.map(x=>pathDuration(x.path,this.config.speed)),total=durations.reduce((a,b)=>a+b,0);
    const keys:Pose[]=[];let offset=0;
    segments.forEach((seg,i)=>{const n=seg.cameras.length;seg.cameras.forEach((k,j)=>{if(i>0&&j===0)return;
      const own=(k as any).progress as number|undefined,p=own??(n>1?j/(n-1):1);keys.push({...k,progress:(offset+p*durations[i])/total} as Pose);});offset+=durations[i];});
    (keys[0] as any).progress=0;(keys[keys.length-1] as any).progress=1;
    const camera=this.mode==='motion'?this.world!.animateCamera(keys,total,token,track):Promise.resolve(this.world!.setCamera(keys[keys.length-1]));
    const characters=(async()=>{for(let i=0;i<segments.length;i++){const seg=segments[i];if(seg.state)this.change(seg.state);
      const lighting=seg.light&&this.world!.animateInteriorWeight?this.world!.animateInteriorWeight(seg.light,durations[i],token):Promise.resolve();
      await token.wait(Promise.all([this.action({kind:'walk',path:seg.path,duration:durations[i]},token),lighting]).then(()=>{}));token.check();}})();
    await token.wait(Promise.all([characters,camera]).then(()=>{}));token.check();
  }
  async leaveHome():Promise<Result> {
    const fail=this.blocked('home',true);if(fail)return fail;
    return this.operate('standing',async t=>{
      const c=this.config;await this.action({kind:'stand',seat:c.seat},t);
      if(this.mode==='motion'){const k=c.cameraHomeToDoor??[c.cameraHome,c.cameraToDoor[0]],o=c.cameraTracks?.homeToDoor;await t.wait(o?this.world!.animateCamera(k,1,t,o):this.world!.animateCamera(k,1,t));}
      t.check();this.change('turning-out');
      await this.action({kind:'turn',controllerRoot:c.seat.standingControllerRoot,fromYawRad:c.seat.yawRad,toYawRad:Math.atan2(c.toDoor[1][0]-c.toDoor[0][0],c.toDoor[1][2]-c.toDoor[0][2]),direction:'left'},t);
      this.change('walking-out');await this.walk(c.toDoor,c.cameraToDoor,t,c.cameraTracks?.toDoor);
      this.change('opening-door');await t.wait(this.world!.animateDoor(0,c.openDeg,1,t));t.check();
      this.world!.setInteriorWeight?.(1);this.world!.setLayers(BOTH);this.change('crossing-out');
      const crossOut=c.cameraCrossOut??[c.cameraInside,c.cameraOutside],toIsland=c.cameraToIsland??(c.cameraCharacter?[c.cameraOutside,c.cameraCharacter,c.cameraIsland]:[c.cameraOutside,c.cameraIsland]);
      if(c.cameraTracks?.outbound)await this.walkSpan([{path:c.outCrossing,cameras:crossOut},{path:c.toIsland,cameras:toIsland,light:c.interiorLighting?.toIsland}],t,c.cameraTracks.outbound);
      else{await this.walk(c.outCrossing,crossOut,t);await this.walk(c.toIsland,toIsland,t,c.cameraTracks?.toIsland,c.interiorLighting?.toIsland);}
      // Weight is already 0 here and the camera is exactly cameraIsland with zero speed: restore() changes nothing visible.
      this.stable='island';this.restore();this.change('island');
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
      const c=this.config;if(c.interiorLighting)this.world!.setInteriorWeight?.(0);this.world!.setLayers(BOTH);
      const toThreshold=c.cameraToThreshold??[c.cameraIsland,c.cameraOutside],crossIn=c.cameraCrossIn??[c.cameraOutside,c.cameraInside];
      if(c.cameraTracks?.inbound)await this.walkSpan([{path:c.toThreshold,cameras:toThreshold,light:c.interiorLighting?.toThreshold},{path:c.inCrossing,cameras:crossIn,state:'crossing-in'}],t,c.cameraTracks.inbound);
      else{await this.walk(c.toThreshold,toThreshold,t,c.cameraTracks?.toThreshold,c.interiorLighting?.toThreshold);
        this.change('crossing-in');await this.walk(c.inCrossing,crossIn,t,c.cameraTracks?.crossIn);}
      // No original concurrent door-close samples: stop inside, THEN close, THEN approach seat.
      this.change('closing-door');await t.wait(this.world!.animateDoor(c.openDeg,0,1,t));t.check();
      this.world!.setInteriorWeight?.(1);this.world!.setLayers(HOME);this.change('walking-to-seat');await this.walk(c.toSeat,c.cameraToSeat??[c.cameraInside,c.cameraHome],t,c.cameraTracks?.toSeat);
      this.change('sitting');await this.action({kind:'sit',seat:c.seat},t);
      this.stable='home';this.restore();this.change('home');
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
