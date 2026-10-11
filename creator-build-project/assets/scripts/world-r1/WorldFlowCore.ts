import { CameraTrackFailure } from './CameraPose';
/** Engine-independent orchestration. No scene graph, timers, persistence or browser globals. */
export type Vec = readonly [number, number, number];
export type Mode = 'fixed' | 'motion';
export type Place = 'home' | 'island' | 'level' | 'skycity';
export type State = 'idle' | 'loading' | 'home' | 'standing' | 'turning-out' | 'walking-out' | 'opening-door' |
  'crossing-out' | 'island' | 'level-loading' | 'level' | 'skycity-loading' | 'skycity' | 'walking-home' | 'crossing-in' |
  'closing-door' | 'walking-to-seat' | 'sitting' | 'paused' | 'error' | 'disposed';
export type Layers = Readonly<{interior:boolean; exterior:boolean; door:boolean; backdrop:boolean}>;
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
  animateCamera(path:readonly Pose[],seconds:number,token:Cancellation):Promise<void>;
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
  openDeg:number; speed:number;
  /** 0007 v1.2: character yaw at the island landing point (exit_path_17), from the pose data table. Default 0. */
  islandYawRad?:number;
}
export type Result={ok:true}|{ok:false;reason:string};
export type Snapshot=Readonly<{state:State;stable:Place;mode:Mode;hidden:boolean;needsResume:boolean;characterReady:boolean;error:string|null}>;
const HOME:Layers={interior:true,exterior:false,door:true,backdrop:true};
const ISLAND:Layers={interior:false,exterior:true,door:true,backdrop:true};
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
  private async walk(path:readonly Vec[],cameras:readonly Pose[],token:Cancellation):Promise<void> {
    const duration=pathDuration(path,this.config.speed);
    // Both tracks use the same duration. Character adapter owns world displacement.
    // fixed mode used to leave the camera on cameraHome, so the girl walked out of the doorway frame.
    const camera=this.mode==='motion'
      ? this.world!.animateCamera(cameras,duration,token)
      : Promise.resolve(this.world!.setCamera(cameras[cameras.length-1]));
    await token.wait(Promise.all([this.action({kind:'walk',path,duration},token), camera]).then(()=>{}));token.check();
  }
  async leaveHome():Promise<Result> {
    const fail=this.blocked('home',true);if(fail)return fail;
    return this.operate('standing',async t=>{
      const c=this.config;await this.action({kind:'stand',seat:c.seat},t);
      if(this.mode==='motion')await t.wait(this.world!.animateCamera(c.cameraHomeToDoor??[c.cameraHome,c.cameraToDoor[0]],1,t));
      t.check();this.change('turning-out');
      await this.action({kind:'turn',controllerRoot:c.seat.standingControllerRoot,fromYawRad:c.seat.yawRad,toYawRad:Math.atan2(c.toDoor[1][0]-c.toDoor[0][0],c.toDoor[1][2]-c.toDoor[0][2]),direction:'left'},t);
      this.change('walking-out');await this.walk(c.toDoor,c.cameraToDoor,t);
      this.change('opening-door');await t.wait(this.world!.animateDoor(0,c.openDeg,1,t));t.check();
      this.world!.setLayers(BOTH);this.change('crossing-out');
      await this.walk(c.outCrossing,c.cameraCrossOut??[c.cameraInside,c.cameraOutside],t);
      await this.walk(c.toIsland,c.cameraToIsland??(c.cameraCharacter?[c.cameraOutside,c.cameraCharacter,c.cameraIsland]:[c.cameraOutside,c.cameraIsland]),t);
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
      const c=this.config;this.world!.setLayers(BOTH);
      await this.walk(c.toThreshold,c.cameraToThreshold??[c.cameraIsland,c.cameraOutside],t);
      this.change('crossing-in');await this.walk(c.inCrossing,c.cameraCrossIn??[c.cameraOutside,c.cameraInside],t);
      // No original concurrent door-close samples: stop inside, THEN close, THEN approach seat.
      this.change('closing-door');await t.wait(this.world!.animateDoor(c.openDeg,0,1,t));t.check();
      this.world!.setLayers(HOME);this.change('walking-to-seat');await this.walk(c.toSeat,[c.cameraInside,c.cameraHome],t);
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
