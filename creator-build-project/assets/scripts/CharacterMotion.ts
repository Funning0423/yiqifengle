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
export type MotionEventDef={time:number;name:string;body:Body;bone:string};
export type LayerMode='additive'|'override';
export type ClipMeta={duration?:number;nativeSpeed?:number;loop?:boolean;events:MotionEventDef[];
  /** walk_start: switch to `next` (default walk_loop) at clip time `at` (default duration-CROSSFADE_S), entering it at `nextTime` (default 0). */
  handoff?:{next?:string;at?:number;nextTime?:number};
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
  morphMesh:string;morphTargets:{[name:string]:number};windToMorphFlutter:ReadonlyArray<readonly [number,number]>|null;
  /** Every morph mesh to drive, [0] = morphMesh, all with the same per-name weights. Target index = the mesh's own target
   *  names (glTF mesh.extras.targetNames) unless morphTargets was given explicitly; targets (null = morphTargets) is the
   *  mapping used when the mesh carries no names. */
  morphMeshes:Array<{mesh:string;targets:{[name:string]:number}|null}>;morphTargetsExplicit:boolean;
  /** Target names whose weights are computed each frame (morphTargets, per-mesh targets, every clip curve). */
  morphNames:string[]};
export type FootEvent={event:string;bone:string;body:Body;clip:string;phase:number;time:number;cycle:number;pos:[number,number,number]|null};

const num=(v:any):number|undefined=>typeof v==='number'&&isFinite(v)?v:undefined;
/** Body side from an event: explicit `body` wins; else bone-name inference (bone L = body R, 角色动画bot rig note). */
export function eventBody(e:any):Body {const b=e&&e.body;if(b==='L'||b==='R')return b;const bone=String(e&&e.bone||e&&e.name||'');
  return /[.:_]L$/i.test(bone)||/left/i.test(bone)?'R':'L';}
function parseEvents(list:any,duration:number|undefined):MotionEventDef[] {const out:MotionEventDef[]=[];if(!Array.isArray(list))return out;
  for(let i=0;i<list.length;i++){const e=list[i];if(!e)continue;let t=num(e.time_s);if(t===undefined)t=num(e.time);if(t===undefined&&num(e.phase)!==undefined&&duration)t=e.phase*duration;if(t===undefined)continue;
    const name=String(e.name||'');const bone=String(e.bone||(name.indexOf(':')>0?'foot.'+name.split(':')[1]:''));out.push({time:t,name,bone,body:eventBody(e)});}
  out.sort((a,b)=>a.time-b.time);return out;}
function parseClip(c:any):ClipMeta {const duration=num(c.cycle_duration_s)??num(c.duration_s)??num(c.duration);
  const h=c.handoff||{};const lift=c.apron_lift||c;const layer=c.layer||{};
  return {duration,nativeSpeed:num(c.native_speed_mps)??num(c.nativeSpeed),loop:typeof c.loop==='boolean'?c.loop:undefined,events:parseEvents(c.events,duration),
    handoff:c.handoff?{next:typeof h.next==='string'?h.next:undefined,at:num(h.at_s)??num(h.at),nextTime:num(h.next_time_s)??num(h.nextTime)}:undefined,
    liftTime:num(lift.lift_time_s)??num(lift.liftTime)??(num(lift.lift_frame)!==undefined&&num(c.fps)?lift.lift_frame/c.fps:undefined),
    settleTime:num(lift.settle_time_s)??num(lift.settleTime)??(num(lift.settle_frame)!==undefined&&num(c.fps)?lift.settle_frame/c.fps:undefined),
    layerMode:(layer.mode||c.layer_mode)==='override'?'override':(layer.mode||c.layer_mode)==='additive'?'additive':undefined,
    mask:Array.isArray(layer.mask)?layer.mask.map(String):Array.isArray(c.mask)?c.mask.map(String):undefined,
    referenceTime:num(layer.reference_time_s)??num(c.reference_time_s),morph:parseMorph(c.morph)};}
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
  morphMesh:DEFAULT_MORPH_MESH,morphTargets:{curl:DEFAULT_MORPH_TARGETS.curl,flutter:DEFAULT_MORPH_TARGETS.flutter},windToMorphFlutter:null,
  morphMeshes:[{mesh:DEFAULT_MORPH_MESH,targets:null}],morphTargetsExplicit:false,morphNames:['curl','flutter']};}
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
  const t0=targetMap(mt);if(t0){cfg.morphTargets=t0;cfg.morphTargetsExplicit=true;}
  let mesh=typeof top.mesh==='string'?top.mesh:'';if(!mesh)for(const name in cfg.clips){const m=cfg.clips[name].morph;if(m&&m.mesh){mesh=m.mesh;break;}}if(mesh)cfg.morphMesh=mesh;
  // morph.meshes: more meshes driven by the same per-target weights, {name: {target: index} | null} or [name, ...]
  cfg.morphMeshes=[{mesh:cfg.morphMesh,targets:null}];const ms=top.meshes;
  const addMesh=(name:any,tg:any)=>{if(typeof name!=='string'||!name)return;const t=targetMap(tg&&typeof tg==='object'&&tg.targets?tg.targets:tg);
    for(let i=0;i<cfg.morphMeshes.length;i++)if(cfg.morphMeshes[i].mesh===name){if(t)cfg.morphMeshes[i].targets=t;return;}cfg.morphMeshes.push({mesh:name,targets:t});};
  if(Array.isArray(ms))for(let i=0;i<ms.length;i++)addMesh(ms[i],null);else if(ms&&typeof ms==='object')for(const k in ms)if(Object.prototype.hasOwnProperty.call(ms,k))addMesh(k,ms[k]);
  cfg.morphNames=morphNameList(cfg);
  return cfg;}
function targetMap(mt:any):{[name:string]:number}|null {if(!mt||typeof mt!=='object')return null;const t:{[name:string]:number}={};let n=0;
  for(const k in mt){if(!Object.prototype.hasOwnProperty.call(mt,k))continue;const i=num(mt[k]);if(i!==undefined&&i>=0&&Math.floor(i)===i){t[k]=i;n++;}}return n?t:null;}
/** morphTargets keys + per-mesh target keys + every clip curve name (stable order, no duplicates). */
export function morphNameList(cfg:{clips:{[name:string]:ClipMeta};morphTargets:{[name:string]:number};morphMeshes?:Array<{targets:{[name:string]:number}|null}>}):string[] {const out:string[]=[];
  const add=(o:any)=>{if(o)for(const k in o)if(Object.prototype.hasOwnProperty.call(o,k)&&out.indexOf(k)<0)out.push(k);};add(cfg.morphTargets);
  const ms=cfg.morphMeshes||[];for(let i=0;i<ms.length;i++)add(ms[i].targets);
  for(const name in cfg.clips)if(Object.prototype.hasOwnProperty.call(cfg.clips,name)){const m=cfg.clips[name].morph;if(m)add(m.curves);}return out;}
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
type Track={clip:string;abs:number;loop:boolean;distance:boolean;nativeSpeed:number;duration:number;endedReported:boolean};
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
      if(d>0&&m.duration&&Math.abs(m.duration-d)>1e-3){const k=d/m.duration;events=events.map(e=>({time:e.time*k,name:e.name,bone:e.bone,body:e.body}));this.notes.push(name+': anim_meta '+m.duration.toFixed(4)+'s != clip '+d.toFixed(4)+'s, events rescaled');}
      let morph=m.morph;if(morph&&d>0&&m.duration&&Math.abs(m.duration-d)>1e-3){const k=d/m.duration,cv:MorphCurves={};for(const t in morph.curves)if(Object.prototype.hasOwnProperty.call(morph.curves,t))cv[t]=morph.curves[t].map(p=>[p[0]*k,p[1]] as [number,number]);morph={mesh:morph.mesh,curves:cv};}
      clips[name]={duration:m.duration,nativeSpeed:m.nativeSpeed,loop:m.loop,events,handoff:m.handoff,liftTime:m.liftTime,settleTime:m.settleTime,layerMode:m.layerMode,mask:m.mask,referenceTime:m.referenceTime,morph};}
    const w=clips[CLIP_ROLES.walk],wd=info.has(CLIP_ROLES.walk)?info.duration(CLIP_ROLES.walk):0;
    if(w&&!w.events.length&&wd>0){w.events=[{time:0,name:'foot:R',bone:'foot.R',body:'L'},{time:wd/2,name:'foot:L',bone:'foot.L',body:'R'}];this.notes.push('walk_loop: default foot events (no anim_meta events)');}
    const morphMeshes=cfg.morphMeshes&&cfg.morphMeshes.length?cfg.morphMeshes:[{mesh:cfg.morphMesh,targets:null}];
    for(const name in clips)if(Object.prototype.hasOwnProperty.call(clips,name)){const mm=clips[name].morph;if(mm&&mm.mesh&&!morphMeshes.some(e=>e.mesh===mm.mesh))this.notes.push(name+': morph.mesh '+mm.mesh+' is not a bound morph mesh ('+morphMeshes.map(e=>e.mesh).join(',')+'; curves still applied to them by target name)');}
    this.cfg={clips,windToFlutter:cfg.windToFlutter,apronLiftThreshold:cfg.apronLiftThreshold,windMask:cfg.windMask,idleGust:cfg.idleGust,source:cfg.source,morphMesh:cfg.morphMesh,morphTargets:cfg.morphTargets,windToMorphFlutter:cfg.windToMorphFlutter,
      morphMeshes,morphTargetsExplicit:!!cfg.morphTargetsExplicit,morphNames:morphNameList({clips,morphTargets:cfg.morphTargets,morphMeshes})};}
  meta(name:string):ClipMeta|null {return this.cfg.clips[name]||null;}
  private track(name:string,loop:boolean,time:number):Track {const m=this.meta(name),d=this.info.duration(name);const ns=m&&m.nativeSpeed!==undefined?m.nativeSpeed:name===CLIP_ROLES.walk?DEFAULT_NATIVE_SPEED:0;
    return {clip:name,abs:Math.max(0,time),loop,distance:ns>0,nativeSpeed:ns,duration:d>0?d:1,endedReported:false};}
  /** keep=true: same clip already base -> nothing changes (phase continuity). fade<0: use crossfadeS. Returns true when switched. */
  play(name:string,loop:boolean,opts?:{fade?:number;time?:number;keep?:boolean}):boolean {const o=opts||{};
    if(o.keep!==false&&this.base&&this.base.clip===name&&this.base.loop===loop)return false;
    const fade=o.fade===undefined||o.fade<0?this.crossfadeS:o.fade;
    if(this.base&&fade>0&&this.base.clip!==name){this.out=this.base;this.fadeT=0;this.fadeS=fade;}else{this.out=null;}
    this.base=this.track(name,loop,o.time||0);return true;}
  localTime(t:Track):number {return t.loop?((t.abs%t.duration)+t.duration)%t.duration:Math.min(t.abs,t.duration);}
  /** ds: metres travelled this frame along the walk (null = not walking -> distance clips hold their phase). */
  tick(dt:number,ds:number|null,wind:number):TickResult {const res:TickResult={foot:[],ended:null,apronLift:null};const b=this.base;
    if(b){const prev=b.abs;b.abs+=b.distance?(ds!==null&&ds>0?ds/b.nativeSpeed:0):dt;const m=this.meta(b.clip);
      if(m&&m.events.length){const ev=crossedEvents(m.events,prev,b.abs,b.duration,b.loop);for(let i=0;i<ev.length;i++)res.foot.push({def:ev[i].def,cycle:ev[i].cycle,abs:ev[i].abs,clip:b.clip,duration:b.duration});}
      if(!b.loop&&b.abs>=b.duration&&!b.endedReported){b.endedReported=true;res.ended=b.clip;}}
    if(this.out){const o=this.out;o.abs+=o.distance?(ds!==null&&ds>0?ds/o.nativeSpeed:0):dt;this.fadeT+=dt;if(this.fadeT>=this.fadeS)this.out=null;}
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
/** In-place turn role: |delta| >= 135 deg -> walk_turn_180; >= 45 deg -> walk_turn_90_body{L|R} by turn side (positive yaw =
 *  turning to her left -> bodyL, the inside foot pivots); otherwise / missing clip -> null (idle + controller yaw). */
export function turnRole(info:ClipInfo,deltaRad:number):string|null {const a=Math.abs(deltaRad)*180/Math.PI;
  if(a>=135)return info.has(CLIP_ROLES.turn180)?CLIP_ROLES.turn180:null;if(a>=45){const r=deltaRad>0?CLIP_ROLES.turn90L:CLIP_ROLES.turn90R;return info.has(r)?r:null;}return null;}

/* ---------------- morph targets (blend shapes) ---------------- */
function curveAt(cfg:MotionConfig,clip:string,target:string,time:number):number {const m=cfg.clips[clip];const c=m&&m.morph&&m.morph.curves[target];return c&&c.length?piecewise(c,time):0;}
/** Per-target weights for this frame, the same blend as the pose:
 *   base  = curve(base clip, base time) x (1 - fade) + curve(outgoing clip, its time) x fade        (crossfade weights)
 *   layer = sum over layers (wind_flutter_loop, apron_lift) of layerWeight x curve(layer clip, layer time)
 *   clip  = base + layer;  a clip without a curve for that target contributes 0.
 *   flutter only: w = max(clip, windToMorphFlutter(windDrive))  -- MAX, not sum, so a flutter curve authored in
 *   wind_flutter_loop AND a wind mapping never double up; with only one of them it is exactly that one.
 *   Every result clamped 0..1. Targets = cfg.morphNames (morphTargets, per-mesh targets, clip curve names); every bound
 *   mesh picks the names it has. */
export function morphWeights(cfg:MotionConfig,plan:Plan,windDrive:number,out?:{[target:string]:number}):{[target:string]:number} {const res=out||{};const b=plan.base,o=plan.out;
  const names=cfg.morphNames||Object.keys(cfg.morphTargets);
  for(let ti=0;ti<names.length;ti++){const t=names[ti];let w=0;
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
 *  reaching exactly 0 / 1). Any problem = status + no-op; never throws into the frame.
 *  byName: when the mesh carries target names (glTF mesh.extras.targetNames), target name -> index comes from them. */
export class MorphDriver {
  status:MorphStatus='unbound';reason='';renderer:MorphRendererLike|null=null;node='';meshName='';subMeshes:number[]=[];targetCounts:number[]=[];targetNames:string[]|null=null;
  need=0;targets:{[name:string]:number}={};readonly last:{[target:string]:number}={};readonly weights:{[target:string]:number}={};calls=0;
  constructor(public mesh:string,public configured:{[name:string]:number},public byName=false){this.setTargets(configured);}
  private setTargets(t:{[name:string]:number}){this.targets=t;let need=0;for(const k in t)if(Object.prototype.hasOwnProperty.call(t,k)&&t[k]+1>need)need=t[k]+1;this.need=need;}
  bind(renderers:ReadonlyArray<any>|null|undefined):MorphStatus {this.renderer=null;this.subMeshes=[];this.targetCounts=[];this.targetNames=null;this.reason='';this.setTargets(this.configured);
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
      if(this.byName&&this.targetNames&&this.targetNames.length){const t:{[name:string]:number}={};for(let i=0;i<this.targetNames.length;i++)if(!(this.targetNames[i] in t))t[this.targetNames[i]]=i;this.setTargets(t);}
      for(let i=0;i<subs.length;i++){const n=subs[i]&&subs[i].targets?subs[i].targets.length:0;this.targetCounts.push(n);if(n>=this.need&&n>0)this.subMeshes.push(i);}
      if(!this.subMeshes.length){this.status='too-few-targets';this.reason='need '+this.need+' targets, sub-meshes have '+this.targetCounts.join(',');return this.status;}
      this.renderer=r;this.status='ok';return this.status;}catch(e){this.renderer=null;this.status='error';this.reason=String(e);return this.status;}}
  /** Writes weights (target name -> 0..1) to every bound sub-mesh. Returns the number of setWeight calls made. */
  apply(w:{[target:string]:number}):number {const r=this.renderer;if(!r||this.status!=='ok')return 0;let n=0;
    for(const t in this.targets){if(!Object.prototype.hasOwnProperty.call(this.targets,t))continue;const v=w[t]!==undefined?w[t]:0;this.weights[t]=v;const prev=this.last[t];
      if(prev!==undefined&&!(Math.abs(v-prev)>MORPH_EPS)&&!((v===0||v===1)&&v!==prev))continue;
      try{for(let k=0;k<this.subMeshes.length;k++){r.setWeight(v,this.subMeshes[k],this.targets[t]);n++;}this.last[t]=v;}catch(e){this.status='error';this.reason=String(e);this.renderer=null;this.calls+=n;return n;}}
    this.calls+=n;return n;}
  diagnostics(){return {status:this.status,reason:this.reason,mesh:this.mesh,node:this.node,meshName:this.meshName,targets:this.targets,byName:this.byName,need:this.need,subMeshes:this.subMeshes.slice(),targetCounts:this.targetCounts.slice(),targetNames:this.targetNames,weights:this.weights,setWeightCalls:this.calls};}
}
