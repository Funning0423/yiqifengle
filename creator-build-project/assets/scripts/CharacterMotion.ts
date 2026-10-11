/** Character walk driver core (GGbot). Engine-free: no 'cc' import, no timers, no globals. Used by FlowReferenceStandin
 * (WorldIntegrationBoot.ts), which owns the scene nodes and the Cocos animation states. Contract for 角色动画bot:
 * docs/walk-driver.md. ES5-safe on purpose (Cocos loose build): no for-of over Map/Set, no iterable spread. */

/** Pose blending master switch. true = SkeletalAnimation.useBakedAnimation=false and the driver blends poses itself
 *  (crossfades + masked wind layers). false = the old baked path: one clip at a time, hard cuts, wind layers no-op
 *  (foot / apron events, walkProgress, yaw smoothing and distance-driven time still work). See docs/walk-driver.md. */
export const CHARACTER_POSE_BLEND=true;
/** Crossfade between base clips (s). 0 disables crossfades even in blend mode. */
export const CROSSFADE_S=0.2;
/** Max character yaw rate while walking (deg/s); damped follow of the path tangent (time constant YAW_TAU_S). */
export const WALK_YAW_MAX_DEG_S=150;
export const YAW_TAU_S=0.12;
/** Yaw target = direction to the path point this far ahead (anticipates corners; ignores mm-long junk segments). */
export const WALK_YAW_LOOKAHEAD_M=0.2;
/** A walk that starts from rest facing more than this away from its path snaps (old behaviour) instead of walking
 *  backwards while turning. Route data should avoid it (see docs/walk-driver.md, toThreshold first segment). */
export const WALK_YAW_SNAP_DEG=100;
/** After a walk action ends, wait this long (walk pose held, phase frozen: no movement = no slide) for the next walk
 *  before settling to stop/idle. WorldFlow starts the next segment 1-2 frames later (returnHome toThreshold->inCrossing: 2). */
export const WALK_JOIN_GRACE_S=0.1;
/** apron_lift fires when wind strength crosses this upward (运镜bot: 0.95 ~0.2 s before the frontal key). anim_meta may override. */
export const APRON_LIFT_THRESHOLD=0.95;
/** The trigger re-arms only after the wind fell back to <= this (once per exit walk: wind is 0 at every stable pose). */
export const APRON_REARM_BELOW=0.05;
/** Used when anim_meta has no apron_lift lift/settle and no apron_lift clip exists. */
export const DEFAULT_APRON_LIFT_S=1.2;
/** wind strength -> wind_flutter_loop weight (piecewise linear). Funning: light sway from the first step outside. */
export const DEFAULT_WIND_TO_FLUTTER:ReadonlyArray<readonly [number,number]>=[[0,0],[0.04,0.18],[0.15,0.38],[0.5,0.7],[1,1]];
/** Default mask for the wind layers (name globs, '*' = any). */
export const DEFAULT_WIND_MASK:ReadonlyArray<string>=['skirt*','apron*','hair*'];
export const DEFAULT_NATIVE_SPEED=0.7;
/** locomotion-v1 (root_motion curves, docs/walk-driver.md §9). Within a walk of FIXED duration (WorldFlow walkDuration) the
 *  root follows walk_start's forward_m curve from rest and walk_stop_body{L,R}'s forward_m curve into the end; the cruise in
 *  between takes the remaining distance/time (speed ramps of PROFILE_RAMP_S at the clip joins). */
export const PROFILE_RAMP_S=0.4;
/** Cruise speed / native speed must stay within these, else the stop (then the start) curve is dropped for that walk. */
export const CRUISE_RATIO_MIN=0.75;export const CRUISE_RATIO_MAX=1.3;
/** Shortest cruise (m) between the start handoff and the stop entry. */
export const MIN_CRUISE_M=0.3;
/** walk_start may be played up to this much faster (clip clock and its forward_m curve together: feet stay locked, cadence
 *  +20% at most, inside CRUISE_RATIO_MAX) when a short walk from rest has no room for it at rate 1 (e.g. outCrossing
 *  1.99 m / 2.84 s). Tried in START_RATE_STEP steps, smallest rate first. */
export const START_RATE_MAX=1.2;export const START_RATE_STEP=0.05;
/** A turn below 45 deg (no turn clip) that starts while a stop clip is still settling keeps that clip and finishes its yaw
 *  (smoothstep) by the stop clip's end, at least over this many seconds; she never turns in place on the idle loop then. */
export const TURN_FOLD_MIN_S=0.5;
/** The stop must begin ON a walk_loop heel strike (clip frame 0 == walk_loop there). The phase at the stop entry is set by
 *  stretching the walk_loop clock over the whole cruise by at most this fraction. Slide budget: a warp w makes each planted
 *  foot drift |1-1/w| x native x flat stance; flat stance = heel strike..heel off = 0.37 cycle (anim_meta
 *  phases_fraction_of_cycle) = 0.42 s -> 15 mm (the walk driver's no-slide bound) at |w-1| = 0.05. */
export const STOP_WARP_MAX=0.05;
/** When the warp alone cannot reach the heel strike, the warp is clamped to STOP_WARP_MAX and the stop clip's forward_m
 *  curve is scaled to cover the rest (entry still exactly ON the heel strike, end exactly at L). Slide budget: the stop
 *  covers ~0.25 m with a planted foot, 15 mm -> |scale-1| <= 0.06. Beyond -> no planned stop (fallback). */
export const STOP_SCALE_MAX=0.06;
/** |turn| >= this: direction is free (both ways within 20 deg), the 180 variant is picked by the foot (chooseTurn). */
export const TURN180_FREE_DEG=170;
/** A foot event of the same bone within this many seconds of the previous one on ANOTHER clip is the same contact. */
export const FOOT_DEDUPE_S=0.1;
/** Morph targets (blend shapes) are driven HERE, never by animation-clip morph tracks (baked mode does not play them; the
 *  non-baked AnimRig samples several clips per frame, so the last-sampled clip would win and crossfades would jump).
 *  Default mesh (glTF node == mesh name in the character glb) and target index mapping; anim_meta may override both. */
export const DEFAULT_MORPH_MESH='LOD0_G2_APRON';
export const DEFAULT_MORPH_TARGETS:{readonly [name:string]:number}={curl:0,flutter:1};
/** setWeight is called only when a target weight moved by more than this since the last write (or reached exactly 0 / 1). */
export const MORPH_EPS=1e-3;
/** Agreed clip role names (all optional except the ones the old flow already required). */
export const CLIP_ROLES={walk:'walk_loop',walkStart:'walk_start',stopL:'walk_stop_bodyL',stopR:'walk_stop_bodyR',turn90L:'walk_turn_90_bodyL',turn90R:'walk_turn_90_bodyR',turn180:'walk_turn_180',idle:'idle_breathing_loop',sitHold:'sit_hold',sitDown:'sit_down',standUp:'stand_up',doorReach:'door_reach',flutter:'wind_flutter_loop',apronLift:'apron_lift'} as const;
export type Body='L'|'R';
/** type: 'heel_strike' (default) | 'settle' (small settling step, softer). entryContact: the contact that triggered this
 *  clip and was already emitted by the previous clip (stop clips, t=0) - never emitted again. */
export type MotionEventDef={time:number;name:string;body:Body;bone:string;type?:string;entryContact?:boolean};
/** Root motion curves in CLIP seconds, cumulative values (anim_meta root_motion.{forward_m,lateral_m,yaw_deg}). */
export type RootMotion={forward?:Array<[number,number]>;lateral?:Array<[number,number]>;yaw?:Array<[number,number]>};
export type LayerMode='additive'|'override';
export type ClipMeta={duration?:number;nativeSpeed?:number;loop?:boolean;events:MotionEventDef[];
  /** walk_start: switch to `next` (default walk_loop) at clip time `at` (default duration-CROSSFADE_S), entering it at `nextTime` (default 0). */
  handoff?:{next?:string;at?:number;nextTime?:number;crossfade?:number};
  /** locomotion-v1: root motion curves; stop clips: entry from walk_loop at the heel strike walkTime (s) of body; turns: turn_deg. */
  root?:RootMotion;entry?:{from?:string;atEvent?:string;body?:Body;walkTime?:number;crossfade?:number};turnDeg?:number;
  /** apron_lift: lift frame and settle frame (s). */
  liftTime?:number;settleTime?:number;
  /** layer clips: blend mode + mask (bone names / globs) + additive reference time (default 0 = first frame). */
  layerMode?:LayerMode;mask?:string[];referenceTime?:number;
  /** Morph weight curves keyed by target name, time in CLIP seconds: [[t,w],...] (piecewise linear, w clamped 0..1). */
  morph?:{mesh?:string;curves:MorphCurves}};
export type MorphCurves={[target:string]:Array<[number,number]>};
export type MotionConfig={clips:{[name:string]:ClipMeta};windToFlutter:ReadonlyArray<readonly [number,number]>;apronLiftThreshold:number;windMask:ReadonlyArray<string>;
  idleGust:{minS:number;maxS:number;durationS:number}|null;source:string;
  /** Morph: bound mesh (node or mesh name), target name -> morph target index, optional wind -> flutter weight mapping. */
  morphMesh:string;morphTargets:{[name:string]:number};windToMorphFlutter:ReadonlyArray<readonly [number,number]>|null};
export type FootEvent={event:string;bone:string;body:Body;clip:string;phase:number;time:number;cycle:number;pos:[number,number,number]|null;type:string};

const num=(v:any):number|undefined=>typeof v==='number'&&isFinite(v)?v:undefined;
/** Body side from an event: explicit `body` wins; else bone-name inference (bone L = body R, 角色动画bot rig note). */
export function eventBody(e:any):Body {const b=e&&e.body;if(b==='L'||b==='R')return b;const bone=String(e&&e.bone||e&&e.name||'');
  return /[.:_]L$/i.test(bone)||/left/i.test(bone)?'R':'L';}
function parseEvents(list:any,duration:number|undefined):MotionEventDef[] {const out:MotionEventDef[]=[];if(!Array.isArray(list))return out;
  for(let i=0;i<list.length;i++){const e=list[i];if(!e)continue;let t=num(e.time_s);if(t===undefined)t=num(e.time);if(t===undefined&&num(e.phase)!==undefined&&duration)t=e.phase*duration;if(t===undefined)continue;
    const name=String(e.name||'');const bone=String(e.bone||(name.indexOf(':')>0?'foot.'+name.split(':')[1]:''));const d:MotionEventDef={time:t,name,bone,body:eventBody(e)};
    if(typeof e.type==='string')d.type=e.type;if(e.entry_contact===true||e.entryContact===true)d.entryContact=true;out.push(d);}
  out.sort((a,b)=>a.time-b.time);return out;}
function parseClip(c:any):ClipMeta {const duration=num(c.cycle_duration_s)??num(c.duration_s)??num(c.duration);
  const h=c.handoff||{};const lift=c.apron_lift||c;const layer=c.layer||{};const en=c.entry&&typeof c.entry==='object'?c.entry:null;
  return {duration,nativeSpeed:num(c.native_speed_mps)??num(c.nativeSpeed),loop:typeof c.loop==='boolean'?c.loop:undefined,events:parseEvents(c.events,duration),
    handoff:c.handoff?{next:typeof h.next==='string'?h.next:undefined,at:num(h.at_s)??num(h.at),nextTime:num(h.next_time_s)??num(h.nextTime),crossfade:num(h.crossfade_s)??num(h.crossfade)}:undefined,
    root:parseRoot(c.root_motion),turnDeg:num(c.turn_deg)??num(c.turnDeg),
    entry:en?{from:typeof en.from==='string'?en.from:undefined,atEvent:typeof en.at_event==='string'?en.at_event:undefined,body:en.body==='L'||en.body==='R'?en.body:undefined,
      walkTime:num(en.walk_time_s)??num(en.walkTime),crossfade:num(en.crossfade_s)??num(en.crossfade)}:undefined,
    liftTime:num(lift.lift_time_s)??num(lift.liftTime)??(num(lift.lift_frame)!==undefined&&num(c.fps)?lift.lift_frame/c.fps:undefined),
    settleTime:num(lift.settle_time_s)??num(lift.settleTime)??(num(lift.settle_frame)!==undefined&&num(c.fps)?lift.settle_frame/c.fps:undefined),
    layerMode:(layer.mode||c.layer_mode)==='override'?'override':(layer.mode||c.layer_mode)==='additive'?'additive':undefined,
    mask:Array.isArray(layer.mask)?layer.mask.map(String):Array.isArray(c.mask)?c.mask.map(String):undefined,
    referenceTime:num(layer.reference_time_s)??num(c.reference_time_s),morph:parseMorph(c.morph)};}
/** [[t,v],...] with finite numbers, sorted by t, values NOT clamped (root motion); null when absent / malformed / < 2 keys. */
function rawCurve(v:any):Array<[number,number]>|null {if(!Array.isArray(v)||v.length<2)return null;const out:Array<[number,number]>=[];
  for(let i=0;i<v.length;i++){const p=v[i];if(!Array.isArray(p)||num(p[0])===undefined||num(p[1])===undefined)return null;out.push([p[0],p[1]]);}
  out.sort((a,b)=>a[0]-b[0]);return out;}
/** anim_meta root_motion: object {forward_m, lateral_m, yaw_deg} (camelCase forward/lateral/yaw also read). walk_loop's
 *  string value ("none (root bone static)...") and anything malformed = no root motion. */
function parseRoot(r:any):RootMotion|undefined {if(!r||typeof r!=='object'||Array.isArray(r))return undefined;const out:RootMotion={};let n=0;
  const f=rawCurve(r.forward_m||r.forward),l=rawCurve(r.lateral_m||r.lateral),y=rawCurve(r.yaw_deg||r.yaw);if(f){out.forward=f;n++;}if(l){out.lateral=l;n++;}if(y){out.yaw=y;n++;}return n?out:undefined;}
const scaleCurve=(c:Array<[number,number]>|undefined,k:number):Array<[number,number]>|undefined=>c?c.map(p=>[p[0]*k,p[1]] as [number,number]):undefined;
/** First key time at which the curve has reached its final value (end of the root's travel; e.g. stop forward 0.646 s). */
export function curveSettleTime(c:ReadonlyArray<readonly [number,number]>):number {const n=c.length;if(!n)return 0;const v=c[n-1][1];
  for(let i=0;i<n;i++)if(Math.abs(c[i][1]-v)<1e-6){let all=true;for(let j=i;j<n;j++)if(Math.abs(c[j][1]-v)>=1e-6){all=false;break;}if(all)return c[i][0];}return c[n-1][0];}
/** Slope (units/s) of the curve over its key segment containing t (one-sided at the ends). */
export function curveSlope(c:ReadonlyArray<readonly [number,number]>,t:number):number {const n=c.length;if(n<2)return 0;let i=1;while(i<n-1&&c[i][0]<t-1e-9)i++;
  if(t>=c[n-1][0]-1e-9)i=n-1;const a=c[i-1],b=c[i];return b[0]>a[0]?(b[1]-a[1])/(b[0]-a[0]):0;}
function curvePoints(v:any):Array<[number,number]>|null {if(!Array.isArray(v)||!v.length)return null;const out:Array<[number,number]>=[];
  for(let i=0;i<v.length;i++){const p=v[i];if(!Array.isArray(p)||num(p[0])===undefined||num(p[1])===undefined)return null;out.push([p[0],Math.max(0,Math.min(1,p[1]))]);}
  out.sort((a,b)=>a[0]-b[0]);return out;}
function parseMorph(m:any):{mesh?:string;curves:MorphCurves}|undefined {if(!m||typeof m!=='object')return undefined;const src=m.curves||{};const curves:MorphCurves={};let n=0;
  for(const k in src){if(!Object.prototype.hasOwnProperty.call(src,k))continue;const pts=curvePoints(src[k]);if(pts){curves[k]=pts;n++;}}
  return n||typeof m.mesh==='string'?{mesh:typeof m.mesh==='string'?m.mesh:undefined,curves}:undefined;}
/** Last key time over all curves (s); 0 when none. */
export function morphCurveEnd(m:{curves:MorphCurves}|undefined):number {let e=0;if(!m)return 0;for(const k in m.curves){if(!Object.prototype.hasOwnProperty.call(m.curves,k))continue;const c=m.curves[k];if(c.length&&c[c.length-1][0]>e)e=c[c.length-1][0];}return e;}
function points(v:any):Array<[number,number]>|null {if(!Array.isArray(v)||v.length<2)return null;const out:Array<[number,number]>=[];
  for(let i=0;i<v.length;i++){const p=v[i];if(!Array.isArray(p)||num(p[0])===undefined||num(p[1])===undefined)return null;out.push([p[0],Math.max(0,Math.min(1,p[1]))]);}
  out.sort((a,b)=>a[0]-b[0]);return out;}
/** Built-in defaults = walk-v1 contract expressed in cycle fractions, so the old 1.0 s walk_loop keeps working. */
export function defaultMotionConfig():MotionConfig {return {clips:{walk_loop:{nativeSpeed:DEFAULT_NATIVE_SPEED,loop:true,events:[]}},windToFlutter:DEFAULT_WIND_TO_FLUTTER,apronLiftThreshold:APRON_LIFT_THRESHOLD,windMask:DEFAULT_WIND_MASK,idleGust:null,source:'defaults',
  morphMesh:DEFAULT_MORPH_MESH,morphTargets:{curl:DEFAULT_MORPH_TARGETS.curl,flutter:DEFAULT_MORPH_TARGETS.flutter},windToMorphFlutter:null};}
/** Tolerant anim_meta.json reader (schema anim_meta/v1 field names + camelCase aliases). Unknown/invalid -> defaults. */
export function parseAnimMeta(json:any):MotionConfig {const cfg=defaultMotionConfig();if(!json||typeof json!=='object')return cfg;cfg.source=String(json.schema||'anim_meta');
  const clips=json.clips||{};for(const name in clips){if(!Object.prototype.hasOwnProperty.call(clips,name)||!clips[name])continue;cfg.clips[name]=parseClip(clips[name]);}
  const w=json.wind||{};const pts=points(w.windToFlutter||json.windToFlutter);if(pts)cfg.windToFlutter=pts;
  const th=num(w.apronLiftThreshold)??num(json.apronLiftThreshold);if(th!==undefined&&th>0&&th<=1)cfg.apronLiftThreshold=th;
  const mask=w.mask||json.windMask;if(Array.isArray(mask)&&mask.length)cfg.windMask=mask.map(String);
  const g=w.idleGust||json.idleGust;if(g&&num(g.min_s??g.minS)!==undefined)cfg.idleGust={minS:num(g.min_s??g.minS)!,maxS:num(g.max_s??g.maxS)??num(g.min_s??g.minS)!,durationS:num(g.duration_s??g.durationS)??4};
  // morph: wind.windToMorphFlutter | windToMorphFlutter; morphTargets | morph.targets; mesh = morph.mesh | first clip morph.mesh | default
  const mw=points(w.windToMorphFlutter||json.windToMorphFlutter);if(mw)cfg.windToMorphFlutter=mw;
  const top=json.morph&&typeof json.morph==='object'?json.morph:{};const mt=json.morphTargets||top.targets;
  if(mt&&typeof mt==='object'){const t:{[name:string]:number}={};let n=0;for(const k in mt){if(!Object.prototype.hasOwnProperty.call(mt,k))continue;const i=num(mt[k]);if(i!==undefined&&i>=0&&Math.floor(i)===i){t[k]=i;n++;}}if(n)cfg.morphTargets=t;}
  let mesh=typeof top.mesh==='string'?top.mesh:'';if(!mesh)for(const name in cfg.clips){const m=cfg.clips[name].morph;if(m&&m.mesh){mesh=m.mesh;break;}}if(mesh)cfg.morphMesh=mesh;
  return cfg;}
export function piecewise(pts:ReadonlyArray<readonly [number,number]>,x:number):number {const n=pts.length;if(!n)return 0;if(x<=pts[0][0])return pts[0][1];if(x>=pts[n-1][0])return pts[n-1][1];
  for(let i=1;i<n;i++){const a=pts[i-1],b=pts[i];if(x<=b[0]){const u=b[0]>a[0]?(x-a[0])/(b[0]-a[0]):1;return a[1]+(b[1]-a[1])*u;}}return pts[n-1][1];}
export function globMatch(patterns:ReadonlyArray<string>,name:string):boolean {for(let i=0;i<patterns.length;i++){const p=patterns[i];
  if(p.indexOf('*')<0){if(p===name)return true;continue;}const re=new RegExp('^'+p.split('*').map(s=>s.replace(/[.+?^${}()|[\]\\]/g,'\\$&')).join('.*')+'$');if(re.test(name))return true;}return false;}
/** Events with time t such that prevAbs < t + k*duration <= nextAbs (loop) or prevAbs < t <= nextAbs (one-shot). */
export function crossedEvents(events:ReadonlyArray<MotionEventDef>,prevAbs:number,nextAbs:number,duration:number,loop:boolean):{def:MotionEventDef;cycle:number;abs:number}[] {
  const out:{def:MotionEventDef;cycle:number;abs:number}[]=[];if(!(nextAbs>prevAbs)||!events.length||!(duration>0))return out;
  if(!loop){for(let i=0;i<events.length;i++){const t=events[i].time;if(t>prevAbs&&t<=nextAbs)out.push({def:events[i],cycle:0,abs:t});}return out;}
  const k0=Math.floor(prevAbs/duration),k1=Math.floor(nextAbs/duration);
  for(let k=k0;k<=k1;k++)for(let i=0;i<events.length;i++){const abs=events[i].time+k*duration;if(abs>prevAbs&&abs<=nextAbs)out.push({def:events[i],cycle:k,abs});}
  out.sort((a,b)=>a.abs-b.abs);return out;}
/** Body foot planted at local clip time t: the side of the last heel strike at or before t (wrapping), or null without events. */
export function plantedBody(events:ReadonlyArray<MotionEventDef>,t:number):Body|null {const feet=events.filter(e=>/^foot:/.test(e.name));if(!feet.length)return null;
  let last=feet[feet.length-1];for(let i=0;i<feet.length;i++)if(feet[i].time<=t+1e-9)last=feet[i];return last.body;}
export const wrapAngle=(a:number)=>Math.atan2(Math.sin(a),Math.cos(a));
/** Damped, rate-limited yaw follow: rate = delta/tau, clamped to +-maxDegS. No overshoot. */
export class YawFollower {yaw=0;rate=0;constructor(public maxDegS=WALK_YAW_MAX_DEG_S,public tau=YAW_TAU_S){}
  reset(yaw:number){this.yaw=wrapAngle(yaw);this.rate=0;}
  step(target:number,dt:number):number {const d=wrapAngle(target-this.yaw),max=this.maxDegS*Math.PI/180;let r=this.tau>0?d/this.tau:d/dt;if(r>max)r=max;if(r<-max)r=-max;
    let s=r*dt;if(Math.abs(s)>Math.abs(d))s=d;this.yaw=wrapAngle(this.yaw+s);this.rate=dt>0?s/dt:0;return this.yaw;}}
/** Fires once on an upward crossing of `threshold`; re-arms only after the strength fell to <= rearm. */
export class UpwardTrigger {private prev=0;private armed=true;constructor(public threshold=APRON_LIFT_THRESHOLD,public rearm=APRON_REARM_BELOW){}
  update(v:number):boolean {const x=v>0?(v<1?v:1):0;let fire=false;if(this.armed&&this.prev<this.threshold&&x>=this.threshold){fire=true;this.armed=false;}
    if(!this.armed&&x<=this.rearm)this.armed=true;this.prev=x;return fire;}
  reset(){this.prev=0;this.armed=true;}}
/** Soft idle gust envelope (matches WindAudio 'soft': 0 -> 0.5 at 45% -> 0, smooth). */
export function gustEnvelope(t:number,duration:number):number {if(!(duration>0)||t<0||t>=duration)return 0;const u=t/duration,peak=.45;const x=u<peak?u/peak:(1-u)/(1-peak);return .5*x*x*(3-2*x);}

/* ---------------- pose math (node-like joints; Cocos Node satisfies this structurally) ---------------- */
export type JointNode={position:{x:number;y:number;z:number};rotation:{x:number;y:number;z:number;w:number};scale:{x:number;y:number;z:number};
  setPosition(x:number,y:number,z:number):void;setRotation(x:number,y:number,z:number,w:number):void;setScale(x:number,y:number,z:number):void};
export type Joint={name:string;node:JointNode};
export const STRIDE=10;
export function capture(joints:ReadonlyArray<Joint>,out:Float64Array,only?:ReadonlyArray<number>):void {const n=only?only.length:joints.length;
  for(let k=0;k<n;k++){const i=only?only[k]:k,o=i*STRIDE,nd=joints[i].node,p=nd.position,r=nd.rotation,s=nd.scale;out[o]=p.x;out[o+1]=p.y;out[o+2]=p.z;out[o+3]=r.x;out[o+4]=r.y;out[o+5]=r.z;out[o+6]=r.w;out[o+7]=s.x;out[o+8]=s.y;out[o+9]=s.z;}}
export function writePose(joints:ReadonlyArray<Joint>,buf:Float64Array,only?:ReadonlyArray<number>):void {const n=only?only.length:joints.length;
  for(let k=0;k<n;k++){const i=only?only[k]:k,o=i*STRIDE,nd=joints[i].node;nd.setPosition(buf[o],buf[o+1],buf[o+2]);nd.setRotation(buf[o+3],buf[o+4],buf[o+5],buf[o+6]);nd.setScale(buf[o+7],buf[o+8],buf[o+9]);}}
const Q=[0,0,0,1],Q2=[0,0,0,1];
function slerp(ax:number,ay:number,az:number,aw:number,bx:number,by:number,bz:number,bw:number,t:number,out:number[]){let c=ax*bx+ay*by+az*bz+aw*bw;if(c<0){c=-c;bx=-bx;by=-by;bz=-bz;bw=-bw;}
  let k0=1-t,k1=t;if(c<.9995){const th=Math.acos(c),s=Math.sin(th);k0=Math.sin((1-t)*th)/s;k1=Math.sin(t*th)/s;}
  let x=ax*k0+bx*k1,y=ay*k0+by*k1,z=az*k0+bz*k1,w=aw*k0+bw*k1;const l=Math.sqrt(x*x+y*y+z*z+w*w)||1;out[0]=x/l;out[1]=y/l;out[2]=z/l;out[3]=w/l;}
function mul(ax:number,ay:number,az:number,aw:number,bx:number,by:number,bz:number,bw:number,out:number[]){out[0]=aw*bx+ax*bw+ay*bz-az*by;out[1]=aw*by-ax*bz+ay*bw+az*bx;out[2]=aw*bz+ax*by-ay*bx+az*bw;out[3]=aw*bw-ax*bx-ay*by-az*bz;}
/** out = lerp/slerp(a,b,w) per joint (crossfade). */
export function blendPose(a:Float64Array,b:Float64Array,w:number,out:Float64Array,count:number):void {for(let i=0;i<count;i++){const o=i*STRIDE;
  for(let k=0;k<10;k++)if(k<3||k>6)out[o+k]=a[o+k]+(b[o+k]-a[o+k])*w;slerp(a[o+3],a[o+4],a[o+5],a[o+6],b[o+3],b[o+4],b[o+5],b[o+6],w,Q);out[o+3]=Q[0];out[o+4]=Q[1];out[o+5]=Q[2];out[o+6]=Q[3];}}
/** Masked layer on top of `base` for joints `mask`. additive: rot = base * slerp(I, inv(ref)*layer, w), pos += (layer-ref)*w,
 *  scale = base (the walk's leg-driven skirt push is preserved). override: slerp(base, layer, w). */
export function applyLayer(base:Float64Array,layer:Float64Array,ref:Float64Array|null,mask:ReadonlyArray<number>,w:number,mode:LayerMode,out:Float64Array):void {
  for(let k=0;k<mask.length;k++){const o=mask[k]*STRIDE;
    if(mode==='override'||!ref){for(let j=0;j<3;j++)out[o+j]=base[o+j]+(layer[o+j]-base[o+j])*w;slerp(base[o+3],base[o+4],base[o+5],base[o+6],layer[o+3],layer[o+4],layer[o+5],layer[o+6],w,Q);}
    else{for(let j=0;j<3;j++)out[o+j]=base[o+j]+(layer[o+j]-ref[o+j])*w;
      mul(-ref[o+3],-ref[o+4],-ref[o+5],ref[o+6],layer[o+3],layer[o+4],layer[o+5],layer[o+6],Q2); // delta = inv(ref)*layer
      slerp(0,0,0,1,Q2[0],Q2[1],Q2[2],Q2[3],w,Q2);mul(base[o+3],base[o+4],base[o+5],base[o+6],Q2[0],Q2[1],Q2[2],Q2[3],Q);}
    out[o+3]=Q[0];out[o+4]=Q[1];out[o+5]=Q[2];out[o+6]=Q[3];for(let j=7;j<10;j++)out[o+j]=base[o+j];}}
/** Angle (deg) between two unit quaternions stored at joint i in two buffers. */
export function jointAngleDeg(a:Float64Array,b:Float64Array,i:number):number {const o=i*STRIDE;const c=Math.abs(a[o+3]*b[o+3]+a[o+4]*b[o+4]+a[o+5]*b[o+5]+a[o+6]*b[o+6]);return 2*Math.acos(Math.min(1,c))*180/Math.PI;}

/* ---------------- clip clock: which clips, at what time, with which weights ---------------- */
export interface ClipInfo {has(name:string):boolean;duration(name:string):number}
/** rate: distance clips advance rate x ds / nativeSpeed (1 = locked to the ground; != 1 only for the stop-entry stride warp). */
type Track={clip:string;abs:number;loop:boolean;distance:boolean;nativeSpeed:number;duration:number;endedReported:boolean;rate:number};
export type PlanLayer={clip:string;time:number;weight:number;mode:LayerMode;mask:ReadonlyArray<string>;referenceTime:number};
/** morph: every layer the morph curves read (same clip/time/weight as `layers`, plus a curve-only apron_lift timeline when the
 *  glb has no apron_lift clip yet but anim_meta has its morph curves). */
export type Plan={base:{clip:string;time:number;loop:boolean}|null;out:{clip:string;time:number;weight:number}|null;layers:PlanLayer[];morph:{clip:string;time:number;weight:number}[]};
export type TickResult={foot:{def:MotionEventDef;cycle:number;abs:number;clip:string;duration:number}[];ended:string|null;apronLift:{durationSec:number}|null};
/** Engine-free scheduler. Base clip time advances by distance (Δs / native_speed) for clips with a native speed (walk_loop,
 *  or any clip whose anim_meta has native_speed_mps), by time otherwise. Foot events come from phase crossings here,
 *  never from Cocos clip events. Outgoing clip of a crossfade keeps its own clock (distance clips freeze when not moving). */
export class MotionClock {
  base:Track|null=null;out:Track|null=null;fadeT=0;fadeS=0;wind=0;flutterAbs=0;
  apron:{abs:number;lift:number;settle:number;duration:number;emitted:boolean;virtual?:boolean}|null=null;gust:{t:number;d:number}|null=null;
  readonly trigger:UpwardTrigger;
  /** Notes for diagnostics (e.g. anim_meta duration != clip duration -> events rescaled to the clip). */
  readonly notes:string[]=[];
  constructor(public cfg:MotionConfig,public info:ClipInfo,public crossfadeS=CROSSFADE_S){this.trigger=new UpwardTrigger(cfg.apronLiftThreshold);
    const clips:{[name:string]:ClipMeta}={};for(const name in cfg.clips)if(Object.prototype.hasOwnProperty.call(cfg.clips,name)){const m=cfg.clips[name],d=info.has(name)?info.duration(name):0;let events=m.events;
      // The clip (its .meta split) is the source of truth for length; anim_meta event times are rescaled when they disagree.
      let root=m.root;
      if(d>0&&m.duration&&Math.abs(m.duration-d)>1e-3){const k=d/m.duration;events=events.map(e=>{const x:MotionEventDef={time:e.time*k,name:e.name,bone:e.bone,body:e.body};if(e.type)x.type=e.type;if(e.entryContact)x.entryContact=true;return x;});
        if(root)root={forward:scaleCurve(root.forward,k),lateral:scaleCurve(root.lateral,k),yaw:scaleCurve(root.yaw,k)};
        this.notes.push(name+': anim_meta '+m.duration.toFixed(4)+'s != clip '+d.toFixed(4)+'s, events'+(root?' + root_motion':'')+' rescaled');}
      let morph=m.morph;if(morph&&d>0&&m.duration&&Math.abs(m.duration-d)>1e-3){const k=d/m.duration,cv:MorphCurves={};for(const t in morph.curves)if(Object.prototype.hasOwnProperty.call(morph.curves,t))cv[t]=morph.curves[t].map(p=>[p[0]*k,p[1]] as [number,number]);morph={mesh:morph.mesh,curves:cv};}
      clips[name]={duration:m.duration,nativeSpeed:m.nativeSpeed,loop:m.loop,events,handoff:m.handoff,liftTime:m.liftTime,settleTime:m.settleTime,layerMode:m.layerMode,mask:m.mask,referenceTime:m.referenceTime,morph,root,entry:m.entry,turnDeg:m.turnDeg};}
    const w=clips[CLIP_ROLES.walk],wd=info.has(CLIP_ROLES.walk)?info.duration(CLIP_ROLES.walk):0;
    if(w&&!w.events.length&&wd>0){w.events=[{time:0,name:'foot:R',bone:'foot.R',body:'L'},{time:wd/2,name:'foot:L',bone:'foot.L',body:'R'}];this.notes.push('walk_loop: default foot events (no anim_meta events)');}
    for(const name in clips)if(Object.prototype.hasOwnProperty.call(clips,name)){const mm=clips[name].morph;if(mm&&mm.mesh&&mm.mesh!==cfg.morphMesh)this.notes.push(name+': morph.mesh '+mm.mesh+' != bound mesh '+cfg.morphMesh+' (one morph mesh per character; curves still applied to the bound mesh)');}
    this.cfg={clips,windToFlutter:cfg.windToFlutter,apronLiftThreshold:cfg.apronLiftThreshold,windMask:cfg.windMask,idleGust:cfg.idleGust,source:cfg.source,morphMesh:cfg.morphMesh,morphTargets:cfg.morphTargets,windToMorphFlutter:cfg.windToMorphFlutter};}
  meta(name:string):ClipMeta|null {return this.cfg.clips[name]||null;}
  private track(name:string,loop:boolean,time:number):Track {const m=this.meta(name),d=this.info.duration(name);const ns=m&&m.nativeSpeed!==undefined?m.nativeSpeed:name===CLIP_ROLES.walk?DEFAULT_NATIVE_SPEED:0;
    return {clip:name,abs:Math.max(0,time),loop,distance:ns>0,nativeSpeed:ns,duration:d>0?d:1,endedReported:false,rate:1};}
  /** Stride warp of the base distance clip (walk_loop, see STOP_WARP_MAX) or clock rate of a time clip (walk_start, START_RATE_MAX). */
  setRate(rate:number){if(this.base)this.base.rate=rate>0&&isFinite(rate)?rate:1;}
  /** keep=true: same clip already base -> nothing changes (phase continuity). fade<0: use crossfadeS. Returns true when switched. */
  play(name:string,loop:boolean,opts?:{fade?:number;time?:number;keep?:boolean}):boolean {const o=opts||{};
    if(o.keep!==false&&this.base&&this.base.clip===name&&this.base.loop===loop)return false;
    const fade=o.fade===undefined||o.fade<0?this.crossfadeS:o.fade;
    if(this.base&&fade>0&&this.base.clip!==name){this.out=this.base;this.fadeT=0;this.fadeS=fade;}else{this.out=null;}
    this.base=this.track(name,loop,o.time||0);return true;}
  localTime(t:Track):number {return t.loop?((t.abs%t.duration)+t.duration)%t.duration:Math.min(t.abs,t.duration);}
  /** ds: metres travelled this frame along the walk (null = not walking -> distance clips hold their phase). */
  /** snapAbs: set the base clock to exactly this absolute time (stop entry lands ON the heel strike; events crossed inclusive). */
  tick(dt:number,ds:number|null,wind:number,snapAbs?:number):TickResult {const res:TickResult={foot:[],ended:null,apronLift:null};const b=this.base;
    if(b){const prev=b.abs;if(snapAbs!==undefined&&snapAbs>=prev)b.abs=snapAbs;else b.abs+=b.distance?(ds!==null&&ds>0?ds/b.nativeSpeed*b.rate:0):dt*b.rate;const m=this.meta(b.clip);
      if(m&&m.events.length){const ev=crossedEvents(m.events,prev,b.abs,b.duration,b.loop);for(let i=0;i<ev.length;i++)res.foot.push({def:ev[i].def,cycle:ev[i].cycle,abs:ev[i].abs,clip:b.clip,duration:b.duration});}
      if(!b.loop&&b.abs>=b.duration&&!b.endedReported){b.endedReported=true;res.ended=b.clip;}}
    if(this.out){const o=this.out;o.abs+=o.distance?(ds!==null&&ds>0?ds/o.nativeSpeed*o.rate:0):dt*o.rate;this.fadeT+=dt;if(this.fadeT>=this.fadeS)this.out=null;}
    this.wind=wind>0?(wind<1?wind:1):0;this.flutterAbs+=dt;
    if(this.gust){this.gust.t+=dt;if(this.gust.t>=this.gust.d)this.gust=null;}
    if(this.trigger.update(this.wind))res.apronLift=this.startApron();
    else if(this.apron){const a=this.apron;a.abs+=dt;if(!a.emitted&&a.abs>=a.lift-1e-9){a.emitted=true;res.apronLift={durationSec:Math.max(.05,a.settle-a.lift)};}if(a.abs>=a.duration)this.apron=null;}
    return res;}
  /** Starts apron_lift from frame 0; the onApronLift event is emitted when the clip reaches its lift frame. */
  private startApron():{durationSec:number}|null {const name=CLIP_ROLES.apronLift,m=this.meta(name);
    if(!this.info.has(name)){const lift=m&&m.liftTime!==undefined?m.liftTime:0,settle=m&&m.settleTime!==undefined?m.settleTime:lift+DEFAULT_APRON_LIFT_S;
      // no clip: onApronLift fires now (unchanged); morph curves (if any) still run on a curve-only timeline from t=0
      const end=morphCurveEnd(m&&m.morph);this.apron=end>0?{abs:0,lift,settle,duration:end,emitted:true,virtual:true}:null;return {durationSec:Math.max(.05,settle-lift)};}
    const d=this.info.duration(name);const lift=Math.max(0,Math.min(d,m&&m.liftTime!==undefined?m.liftTime:0));const settle=Math.max(lift,Math.min(d,m&&m.settleTime!==undefined?m.settleTime:d));
    this.apron={abs:0,lift,settle,duration:d,emitted:false};
    if(lift<=0){this.apron.emitted=true;return {durationSec:Math.max(.05,settle-lift)};}return null;}
  startGust(durationSec:number){this.gust={t:0,d:durationSec>0?durationSec:4};}
  /** Wind drive 0..1 = max(wind strength, soft idle-gust envelope): input of windToFlutter and windToMorphFlutter. */
  windDrive():number {const g=this.gust?gustEnvelope(this.gust.t,this.gust.d):0;return Math.max(this.wind,g);}
  flutterWeight():number {return piecewise(this.cfg.windToFlutter,this.windDrive());}
  plan():Plan {const b=this.base,o=this.out;const layers:PlanLayer[]=[];
    const layer=(name:string,time:number,weight:number)=>{if(!(weight>1e-4)||!this.info.has(name))return;const m=this.meta(name);
      layers.push({clip:name,time,weight:weight>1?1:weight,mode:m&&m.layerMode?m.layerMode:'additive',mask:m&&m.mask&&m.mask.length?m.mask:this.cfg.windMask,referenceTime:m&&m.referenceTime!==undefined?m.referenceTime:0});};
    const fd=this.info.has(CLIP_ROLES.flutter)?this.info.duration(CLIP_ROLES.flutter):0;if(fd>0)layer(CLIP_ROLES.flutter,this.flutterAbs%fd,this.flutterWeight());
    if(this.apron)layer(CLIP_ROLES.apronLift,Math.min(this.apron.abs,this.apron.duration),1);
    const morph:{clip:string;time:number;weight:number}[]=[];for(let i=0;i<layers.length;i++)morph.push({clip:layers[i].clip,time:layers[i].time,weight:layers[i].weight});
    if(this.apron&&this.apron.virtual)morph.push({clip:CLIP_ROLES.apronLift,time:Math.min(this.apron.abs,this.apron.duration),weight:1});
    return {base:b?{clip:b.clip,time:this.localTime(b),loop:b.loop}:null,out:o&&this.fadeS>0?{clip:o.clip,time:this.localTime(o),weight:Math.max(0,1-this.fadeT/this.fadeS)}:null,layers,morph};}
  /** Current base phase (for diagnostics / stop-clip choice). */
  phase(){const b=this.base;if(!b)return null;const t=this.localTime(b);return {clip:b.clip,time:t,phase:t/b.duration,cycle:Math.floor(b.abs/b.duration),abs:b.abs};}
  planted():Body|null {const b=this.base,m=b&&this.meta(b.clip);return b&&m?plantedBody(m.events,this.localTime(b)):null;}
  reset(){this.base=null;this.out=null;this.apron=null;this.gust=null;this.trigger.reset();}
}
/** Stop-clip role for the planted body foot (null when that clip does not exist). */
export function stopRole(info:ClipInfo,planted:Body|null):string|null {if(!planted)return null;const r=planted==='L'?CLIP_ROLES.stopL:CLIP_ROLES.stopR;return info.has(r)?r:null;}
/** Unplanned stop (the walk was not known to end at rest): a stop clip with a forward_m curve is entered at the end of its
 *  root travel (curveSettleTime), so the root does not move: no slide, no overshoot past the path end. The variant is the
 *  one whose planted body foot at that time is the walk's planted foot (the crossfade moves the free foot only).
 *  In-place stop clips (no forward curve): stopRole, from frame 0 (old behaviour). null = no stop clip -> idle. */
export function stopTail(info:ClipInfo,cfg:MotionConfig,planted:Body|null):{clip:string;time:number}|null {if(!planted)return null;
  const names=[CLIP_ROLES.stopL,CLIP_ROLES.stopR];
  for(let i=0;i<names.length;i++){const n=names[i];if(!info.has(n))continue;const m=cfg.clips[n],f=m&&m.root&&m.root.forward;
    if(!f){if(n===stopRole(info,planted))return {clip:n,time:0};continue;}
    const t=Math.min(curveSettleTime(f),info.duration(n));if(plantedBody(m!.events,t)===planted)return {clip:n,time:t};}
  return null;}
/** In-place turn role: |delta| >= 135 deg -> walk_turn_180; >= 45 deg -> walk_turn_90_body{L|R} by turn side (positive yaw =
 *  turning to her left -> bodyL, the inside foot pivots); otherwise / missing clip -> null (idle + controller yaw). */
export function turnRole(info:ClipInfo,deltaRad:number):string|null {const a=Math.abs(deltaRad)*180/Math.PI;
  if(a>=135)return info.has(CLIP_ROLES.turn180)?CLIP_ROLES.turn180:null;if(a>=45){const r=deltaRad>0?CLIP_ROLES.turn90L:CLIP_ROLES.turn90R;return info.has(r)?r:null;}return null;}
/** 180 variants (docs/walk-driver.md §9.4). Names: walk_turn_180_bodyL / walk_turn_180_bodyR (planned) and the single
 *  walk_turn_180 (locomotion-v1 preview, authored to her left). Side = sign of anim_meta turn_deg (or the yaw_deg curve end),
 *  default + for bodyL / plain, - for bodyR. */
export const TURN180_VARIANTS=['walk_turn_180_bodyL','walk_turn_180_bodyR',CLIP_ROLES.turn180];
function firstFootBody(m:ClipMeta|null):Body|null {if(!m)return null;for(let i=0;i<m.events.length;i++)if(/^foot:/.test(m.events[i].name))return m.events[i].body;return null;}
function clipTurnSide(name:string,m:ClipMeta|null):number {const d=m&&m.turnDeg!==undefined?m.turnDeg:m&&m.root&&m.root.yaw&&m.root.yaw.length?m.root.yaw[m.root.yaw.length-1][1]:undefined;
  if(d!==undefined&&d!==0)return d>0?1:-1;return /bodyR$/.test(name)?-1:1;}
/** Turn clip + the yaw the controller actually turns (may go the long way round inside the free window).
 *  45..135 deg: walk_turn_90_body{L|R} by side (unchanged). >= 135: a 180 variant on the turn side; when |turn| >=
 *  TURN180_FREE_DEG either way is fine, so the foot decides: lastFoot = body of the last foot that landed (it just took the
 *  weight), pick the variant whose FIRST step is the other (free) foot, and turn that variant's way. */
export function chooseTurn(info:ClipInfo,cfg:MotionConfig,deltaRad:number,lastFoot:Body|null):{role:string|null;deltaRad:number;reason:string} {
  const a=Math.abs(deltaRad)*180/Math.PI;if(a<135)return {role:turnRole(info,deltaRad),deltaRad,reason:a>=45?'turn90 by side':'small turn'};
  const want=deltaRad>=0?1:-1;const cands:{name:string;side:number;first:Body|null}[]=[];
  for(let i=0;i<TURN180_VARIANTS.length;i++){const n=TURN180_VARIANTS[i];if(info.has(n)){const m=cfg.clips[n]||null;cands.push({name:n,side:clipTurnSide(n,m),first:firstFootBody(m)});}}
  if(!cands.length)return {role:null,deltaRad,reason:'no 180 clip'};
  if(a>=TURN180_FREE_DEG&&lastFoot){let best:{name:string;side:number;first:Body|null}|null=null;
    for(let i=0;i<cands.length;i++){const c=cands[i];if(c.first&&c.first!==lastFoot&&(!best||(best.side!==want&&c.side===want)))best=c;}
    if(best){const d=best.side===want?deltaRad:deltaRad-want*2*Math.PI;return {role:best.name,deltaRad:d,reason:'free 180: last foot '+lastFoot+' -> first step '+best.first+(best.side===want?'':' (other way round)')};}}
  for(let i=0;i<cands.length;i++)if(cands[i].side===want)return {role:cands[i].name,deltaRad,reason:'180 by side'};
  return {role:cands[0].name,deltaRad,reason:'180: no variant for this side, '+cands[0].name+' used with the controller yaw'};}

/* ---------------- locomotion-v1 walk profile (root_motion curves inside a fixed-duration walk) ---------------- */
export type StopCandidate={clip:string;entryTime:number;body:Body;forward:Array<[number,number]>;lateral:Array<[number,number]>|null;S:number;T:number;v1:number;crossfade:number};
export type WalkPlan={L:number;D:number;
  /** rate: walk_start clock rate (1 = authored; up to START_RATE_MAX): T = at / rate, root = forward_m(t x rate). */
  start:{clip:string;T:number;S:number;forward:Array<[number,number]>;nextTime:number;crossfade:number;v0:number;rate:number}|null;
  stop:(StopCandidate&{sEntry:number;tEntry:number;warp:number;phaseShiftS:number;scale:number})|null;
  cruise:{t0:number;t1:number;s0:number;s1:number;v0:number;v1:number;vc:number;r0:number;r1:number}|null;
  linear:boolean;rate:number;notes:string[]};
/** Stop variants usable for a planned stop: walk_stop_body{L,R} with a forward_m curve and an entry walk time
 *  (entry.walk_time_s, else the walk_loop heel strike of that body). */
export function stopCandidates(info:ClipInfo,cfg:MotionConfig):StopCandidate[] {const out:StopCandidate[]=[];const walk=cfg.clips[CLIP_ROLES.walk];const names=[CLIP_ROLES.stopL,CLIP_ROLES.stopR];
  for(let i=0;i<names.length;i++){const n=names[i],m=cfg.clips[n];if(!m||!info.has(n)||!m.root||!m.root.forward)continue;const body:Body=n===CLIP_ROLES.stopL?'L':'R';
    let e=m.entry&&m.entry.walkTime!==undefined?m.entry.walkTime:undefined;if(e===undefined&&walk){for(let k=0;k<walk.events.length;k++)if(walk.events[k].body===body&&/^foot:/.test(walk.events[k].name)){e=walk.events[k].time;break;}}
    if(e===undefined)continue;const f=m.root.forward,S=f[f.length-1][1]-f[0][1];if(!(S>0))continue;
    out.push({clip:n,entryTime:e,body,forward:f,lateral:m.root.lateral||null,S,T:curveSettleTime(f),v1:curveSlope(f,0),crossfade:m.entry&&m.entry.crossfade!==undefined?m.entry.crossfade:0});}
  return out;}
/** Root travel for one walk action of length L and fixed duration D (WorldFlow walkDuration):
 *   [0, start.T]        walk_start forward_m(t)                       (from rest, walk_start clip with a forward curve)
 *   [start.T, D-stop.T] cruise: ramps v0 -> vc -> v1 (PROFILE_RAMP_S), vc = remaining distance / remaining time
 *   [D-stop.T, D]       L - stop.S + stop forward_m(t - tEntry)        (walk ends at rest, stop clip with a forward curve)
 *  The stop variant is the one whose entry heel strike needs the smallest walk_loop phase shift at the entry distance;
 *  the shift is spread over the cruise as a stride warp (rate) <= STOP_WARP_MAX. Infeasible -> drop stop, then start.
 *  No start/stop and no speed change = linear (exactly the old L*t/D). */
export function planWalk(o:{L:number;D:number;start:{clip:string;forward:Array<[number,number]>;at:number;nextTime:number;crossfade:number}|null;
  stops:StopCandidate[];walkCycle:number;native:number;phase0:number|null;v0:number|null;
  /** metres still to walk AFTER this walk before the rest (continuous chain, e.g. outCrossing -> toIsland). > 0: no stop in
   *  this walk, but the stride warp already steers the phase toward the stop entry of the last walk. 0 / null: none. */
  aheadM?:number}):WalkPlan {
  const notes:string[]=[];const L=o.L,D=o.D,ns=o.native>0?o.native:DEFAULT_NATIVE_SPEED,C=o.walkCycle>0?o.walkCycle:1;
  const lin:WalkPlan={L,D,start:null,stop:null,cruise:null,linear:true,rate:1,notes};if(!(L>0)||!(D>0))return lin;
  const tryPlan=(useStart:boolean,useStop:boolean,k:number):WalkPlan|string=>{
    let t0=0,s0=0,v0=o.v0!==null&&o.v0>0?o.v0:L/D,start:WalkPlan['start']=null,ph0=o.phase0!==null?o.phase0:0;
    if(useStart&&o.start){const f=o.start.forward,at=Math.max(0,o.start.at),S=piecewise(f,at)-f[0][1];start={clip:o.start.clip,T:at/k,S,forward:f,nextTime:o.start.nextTime,crossfade:o.start.crossfade,v0:curveSlope(f,at)*k,rate:k};t0=start.T;s0=S;v0=start.v0;ph0=o.start.nextTime;}
    let t1=D,s1=L,v1=v0,stop:WalkPlan['stop']=null;const ahead=o.aheadM&&o.aheadM>0?o.aheadM:0;let steer=1,steerNote='';
    if(useStop&&o.stops.length){let best:WalkPlan['stop']=null;
      let bestCost=Infinity,worst='';
      for(let i=0;i<o.stops.length;i++){const c=o.stops[i],sE=L+ahead-c.S,tE=D-c.T,dist=sE-s0;if(!(dist>0))continue;const u=ph0+dist/ns;let d=((c.entryTime-u)%C+C)%C;if(d>C/2)d-=C;
        const need=1+d/(dist/ns);let warp=need,scale=1,sEntry=sE;
        // clip time to the entry heel strike = dist/ns + d; with the warp clamped it is reached at a shifted distance,
        // the stop curve is scaled to end exactly at L (steering walks only clamp: the last walk re-plans from its phase)
        if(Math.abs(need-1)>STOP_WARP_MAX){warp=1+(need>1?STOP_WARP_MAX:-STOP_WARP_MAX);if(!ahead){sEntry=s0+(dist/ns+d)*ns/warp;scale=(L-sEntry)/c.S;}}
        if(Math.abs(scale-1)>STOP_SCALE_MAX||!(sEntry>s0)){worst=c.clip+' warp '+(need-1).toFixed(4)+' > '+STOP_WARP_MAX+' and stop scale '+scale.toFixed(4);continue;}
        const cost=Math.abs(warp-1)+Math.abs(scale-1)*10;
        if(cost<bestCost){bestCost=cost;best={clip:c.clip,entryTime:c.entryTime,body:c.body,forward:c.forward,lateral:c.lateral,S:c.S,T:c.T,v1:c.v1*scale,crossfade:c.crossfade,sEntry,tEntry:tE,warp,phaseShiftS:d,scale};}}
      if(!best)return worst?'stop: stride warp + stop scale out of budget ('+worst+')':'stop: no room';
      if(ahead>0){steer=best.warp;steerNote='steering phase to '+best.clip+' '+ahead.toFixed(3)+' m ahead'+(Math.abs(best.warp-1)>=STOP_WARP_MAX-1e-12?' (warp clamped)':'');}
      else{stop=best;t1=best.tEntry;s1=best.sEntry;v1=best.v1;if(best.scale!==1)notes.push('stop '+best.clip+' forward scaled x'+best.scale.toFixed(4)+' (warp clamped)');}}
    const T=t1-t0,Db=s1-s0;if(!(T>0)||Db<(start||stop?MIN_CRUISE_M:0))return 'cruise too short ('+Db.toFixed(3)+' m / '+T.toFixed(3)+' s)';
    const rampIn=Math.abs(v0-Db/T)>1e-3,rampOut=!!stop;let r=Math.min(PROFILE_RAMP_S,T/3);const r0=rampIn?r:0,r1=rampOut?r:0;
    const den=T-r0/2-r1/2;const vc=(Db-v0*r0/2-v1*r1/2)/den;if(!(den>0)||!(vc>0))return 'cruise infeasible';
    if((start||stop)&&(vc/ns<CRUISE_RATIO_MIN||vc/ns>CRUISE_RATIO_MAX))return 'cruise '+vc.toFixed(3)+' m/s outside '+CRUISE_RATIO_MIN+'..'+CRUISE_RATIO_MAX+' x native';
    const linear=!start&&!stop&&!rampIn;if(steerNote)notes.push(steerNote);
    return {L,D,start,stop,cruise:linear?null:{t0,t1,s0,s1,v0,v1,vc,r0,r1},linear,rate:stop?stop.warp:steer,notes};};
  const order:Array<[boolean,boolean]>=[[true,true],[true,false],[false,true],[false,false]];const rates=[1];
  for(let n=1;1+n*START_RATE_STEP<=START_RATE_MAX+1e-9;n++)rates.push(1+n*START_RATE_STEP);
  for(let i=0;i<order.length;i++){if(order[i][0]&&!o.start||order[i][1]&&!o.stops.length)continue;const ks=order[i][0]?rates:[1];let first='';
    for(let q=0;q<ks.length;q++){const r=tryPlan(order[i][0],order[i][1],ks[q]);
      if(typeof r!=='string'){if(ks[q]!==1)notes.push('walk_start x'+ks[q].toFixed(2)+' (at rate 1: '+first+')');return r;}if(!q)first=r;}
    notes.push(first);}
  return lin;}
/** Distance along the path at walk time t (0..D) for a plan. */
export function walkDistanceAt(p:WalkPlan,t:number):number {const D=p.D,L=p.L;if(t<=0)return 0;if(t>=D)return L;if(p.linear)return L*t/D;
  if(p.start&&t<=p.start.T)return piecewise(p.start.forward,t*p.start.rate)-p.start.forward[0][1];
  if(p.stop&&t>=p.stop.tEntry)return Math.min(L,p.stop.sEntry+p.stop.scale*(piecewise(p.stop.forward,t-p.stop.tEntry)-p.stop.forward[0][1]));
  const c=p.cruise;if(!c)return L*t/D;const T=c.t1-c.t0,tau=t-c.t0;
  if(tau<c.r0)return c.s0+c.v0*tau+(c.vc-c.v0)*tau*tau/(2*c.r0);
  if(tau<=T-c.r1)return c.s0+(c.v0+c.vc)/2*c.r0+c.vc*(tau-c.r0);
  const u=T-tau;return c.s1-(c.v1*u+(c.vc-c.v1)*u*u/(2*c.r1));}
/** Seconds walkDuration would need on top of L/native so the cruise stays at native speed (start / stop curve slower than
 *  native). For the route owner (FirstsliceRoutes WALK-DURATION CONTRACT); the driver itself does not change durations. */
export function walkProfileExtraSeconds(cfg:MotionConfig,startsFromRest:boolean,endsAtRest:boolean,native=DEFAULT_NATIVE_SPEED):number {let x=0;
  const st=cfg.clips[CLIP_ROLES.walkStart];if(startsFromRest&&st&&st.root&&st.root.forward){const f=st.root.forward,at=st.handoff&&st.handoff.at!==undefined?st.handoff.at:f[f.length-1][0];x+=at-(piecewise(f,at)-f[0][1])/native;}
  const sp=cfg.clips[CLIP_ROLES.stopL]||cfg.clips[CLIP_ROLES.stopR];if(endsAtRest&&sp&&sp.root&&sp.root.forward){const f=sp.root.forward,T=curveSettleTime(f);x+=T-(f[f.length-1][1]-f[0][1])/native;}
  return x;}
/** Where she rests in WorldFlow (WorldFlowCore.returnHome/leaveHome): after toDoor (opening-door), toIsland (island),
 *  inCrossing ('stop inside, THEN close, THEN approach seat': closing-door waits in place; not on the follow return, see
 *  REST_CHAINS_FOLLOW) and toSeat (sit).
 *  outCrossing -> toIsland and toThreshold -> inCrossing are each one continuous walk split for camera bookkeeping. */
export const REST_CHAINS:ReadonlyArray<ReadonlyArray<string>>=[['toDoor'],['outCrossing','toIsland'],['toThreshold','inCrossing'],['toSeat']];
/** Follow return (运镜bot 0b6202e, RouteConfig.cameraEntry.doorSeconds <= 0, WorldFlowCore.entrySpan): she walks through the
 *  doorway without stopping (the leaf closes behind the lens during toSeat): toThreshold -> inCrossing -> toSeat is one walk. */
export const REST_CHAINS_FOLLOW:ReadonlyArray<ReadonlyArray<string>>=[['toDoor'],['outCrossing','toIsland'],['toThreshold','inCrossing','toSeat']];
/** Rest chains WorldFlow will actually run for these routes (motion mode). */
export function restChainsFor(routes:any):ReadonlyArray<ReadonlyArray<string>> {const e=routes&&routes.cameraEntry;
  return e&&routes.cameraTracks&&routes.cameraTracks.inbound&&typeof e.doorSeconds==='number'&&e.doorSeconds<=0?REST_CHAINS_FOLLOW:REST_CHAINS;}
const pathLength=(p:ReadonlyArray<ReadonlyArray<number>>)=>{let L=0;for(let i=1;i<p.length;i++)L+=Math.hypot(p[i][0]-p[i-1][0],p[i][1]-p[i-1][1],p[i][2]-p[i-1][2]);return L;};
/** Rest look-ahead from route data: for a path equal (same key count, first and last point) to a route of a chain, the metres
 *  that follow it in that chain before she rests (0 = this walk ends at rest; null = unknown path -> no stop planned). */
export function restAheadFromRoutes(routes:any,chains?:ReadonlyArray<ReadonlyArray<string>>):(path:ReadonlyArray<ReadonlyArray<number>>)=>number|null {const list=chains||restChainsFor(routes);const known:{p:ReadonlyArray<ReadonlyArray<number>>;ahead:number}[]=[];
  for(let i=0;i<list.length;i++){const ch=list[i];let ok=true;const ps:ReadonlyArray<ReadonlyArray<number>>[]=[];for(let k=0;k<ch.length;k++){const p=routes&&routes[ch[k]];if(!Array.isArray(p)||p.length<2){ok=false;break;}ps.push(p);}if(!ok)continue;
    for(let k=0;k<ps.length;k++){let a=0;for(let m=k+1;m<ps.length;m++)a+=pathLength(ps[m]);known.push({p:ps[k],ahead:a});}}
  const same=(a:ReadonlyArray<number>,b:ReadonlyArray<number>)=>Math.abs(a[0]-b[0])<1e-4&&Math.abs(a[1]-b[1])<1e-4&&Math.abs(a[2]-b[2])<1e-4;
  return path=>{if(!path||path.length<2)return null;for(let i=0;i<known.length;i++){const q=known[i].p;if(q.length===path.length&&same(q[0],path[0])&&same(q[q.length-1],path[path.length-1]))return known[i].ahead;}return null;};}

/* ---------------- morph targets (blend shapes) ---------------- */
function curveAt(cfg:MotionConfig,clip:string,target:string,time:number):number {const m=cfg.clips[clip];const c=m&&m.morph&&m.morph.curves[target];return c&&c.length?piecewise(c,time):0;}
/** Per-target weights for this frame, the same blend as the pose:
 *   base  = curve(base clip, base time) x (1 - fade) + curve(outgoing clip, its time) x fade        (crossfade weights)
 *   layer = sum over layers (wind_flutter_loop, apron_lift) of layerWeight x curve(layer clip, layer time)
 *   clip  = base + layer;  a clip without a curve for that target contributes 0.
 *   flutter only: w = max(clip, windToMorphFlutter(windDrive))  -- MAX, not sum, so a flutter curve authored in
 *   wind_flutter_loop AND a wind mapping never double up; with only one of them it is exactly that one.
 *   Every result clamped 0..1. Targets = keys of cfg.morphTargets. */
export function morphWeights(cfg:MotionConfig,plan:Plan,windDrive:number,out?:{[target:string]:number}):{[target:string]:number} {const res=out||{};const b=plan.base,o=plan.out;
  for(const t in cfg.morphTargets){if(!Object.prototype.hasOwnProperty.call(cfg.morphTargets,t))continue;let w=0;
    if(b){const fo=o?o.weight:0;w=curveAt(cfg,b.clip,t,b.time)*(1-fo);if(o)w+=curveAt(cfg,o.clip,t,o.time)*fo;}
    const ls=plan.morph||[];for(let i=0;i<ls.length;i++)w+=ls[i].weight*curveAt(cfg,ls[i].clip,t,ls[i].time);
    if(t==='flutter'&&cfg.windToMorphFlutter){const ww=piecewise(cfg.windToMorphFlutter,windDrive);if(ww>w)w=ww;}
    res[t]=w>0?(w<1?w:1):0;}
  return res;}
/** Structural subset of Cocos MeshRenderer / SkinnedMeshRenderer (3.8.8: setWeight(weight, subMeshIndex, shapeIndex)). */
export type MorphRendererLike={node?:{name?:string}|null;mesh?:any;enableMorph?:boolean;setWeight(weight:number,subMeshIndex:number,shapeIndex:number):void};
export type MorphStatus='unbound'|'ok'|'not-found'|'morph-disabled'|'no-morph'|'too-few-targets'|'error';
const meshName=(r:any):string=>{let n='';try{n=String(r&&r.mesh&&r.mesh.name||'');}catch{n='';}return n.replace(/\.mesh$/,'');};
/** Binds one renderer by node name (first) or mesh name and writes target weights only when they change (> MORPH_EPS, or
 *  reaching exactly 0 / 1). Any problem = status + no-op; never throws into the frame. */
export class MorphDriver {
  status:MorphStatus='unbound';reason='';renderer:MorphRendererLike|null=null;node='';meshName='';subMeshes:number[]=[];targetCounts:number[]=[];targetNames:string[]|null=null;
  readonly need:number;readonly last:{[target:string]:number}={};readonly weights:{[target:string]:number}={};calls=0;
  constructor(public mesh:string,public targets:{[name:string]:number}){let need=0;for(const t in targets)if(Object.prototype.hasOwnProperty.call(targets,t)&&targets[t]+1>need)need=targets[t]+1;this.need=need;}
  bind(renderers:ReadonlyArray<any>|null|undefined):MorphStatus {this.renderer=null;this.subMeshes=[];this.targetCounts=[];this.targetNames=null;this.reason='';
    try{let r:any=null;const list=renderers||[];
      for(let i=0;i<list.length&&!r;i++){const x=list[i];if(x&&x.node&&x.node.name===this.mesh)r=x;}
      for(let i=0;i<list.length&&!r;i++){const x=list[i];if(x&&meshName(x)===this.mesh)r=x;}
      if(!r){this.status='not-found';this.reason='no MeshRenderer on a node / mesh named '+this.mesh;return this.status;}
      this.node=String(r.node&&r.node.name||'');this.meshName=meshName(r);
      if(typeof r.setWeight!=='function'){this.status='error';this.reason='renderer has no setWeight';return this.status;}
      if(r.enableMorph===false){this.status='morph-disabled';this.reason='MeshRenderer.enableMorph=false';return this.status;}
      const morph=r.mesh&&r.mesh.struct&&r.mesh.struct.morph;const subs=morph&&morph.subMeshMorphs;
      if(!subs||!subs.length){this.status='no-morph';this.reason='mesh has no morph targets';return this.status;}
      if(Array.isArray(morph.targetNames))this.targetNames=morph.targetNames.map(String);
      for(let i=0;i<subs.length;i++){const n=subs[i]&&subs[i].targets?subs[i].targets.length:0;this.targetCounts.push(n);if(n>=this.need&&n>0)this.subMeshes.push(i);}
      if(!this.subMeshes.length){this.status='too-few-targets';this.reason='need '+this.need+' targets, sub-meshes have '+this.targetCounts.join(',');return this.status;}
      this.renderer=r;this.status='ok';return this.status;}catch(e){this.renderer=null;this.status='error';this.reason=String(e);return this.status;}}
  /** Writes weights (target name -> 0..1) to every bound sub-mesh. Returns the number of setWeight calls made. */
  apply(w:{[target:string]:number}):number {const r=this.renderer;if(!r||this.status!=='ok')return 0;let n=0;
    for(const t in this.targets){if(!Object.prototype.hasOwnProperty.call(this.targets,t))continue;const v=w[t]!==undefined?w[t]:0;this.weights[t]=v;const prev=this.last[t];
      if(prev!==undefined&&!(Math.abs(v-prev)>MORPH_EPS)&&!((v===0||v===1)&&v!==prev))continue;
      try{for(let k=0;k<this.subMeshes.length;k++){r.setWeight(v,this.subMeshes[k],this.targets[t]);n++;}this.last[t]=v;}catch(e){this.status='error';this.reason=String(e);this.renderer=null;this.calls+=n;return n;}}
    this.calls+=n;return n;}
  diagnostics(){return {status:this.status,reason:this.reason,mesh:this.mesh,node:this.node,meshName:this.meshName,targets:this.targets,need:this.need,subMeshes:this.subMeshes.slice(),targetCounts:this.targetCounts.slice(),targetNames:this.targetNames,weights:this.weights,setWeightCalls:this.calls};}
}
