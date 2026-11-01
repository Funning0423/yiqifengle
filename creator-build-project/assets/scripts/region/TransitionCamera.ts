/** Continuous camera handoff for mainline transitions (replaces the WindWipe cover on island→meadow, meadow→skycity and
 *  skycity→lakeside; WindWipe stays for the player's own skip and return-to-island). Pure, no cc.
 *  A transition = level camera (live) → transition shot (keyframed or tracking her) → next level camera (live).
 *  Both blends mix two LIVE poses with a minimum-jerk weight (w' = w'' = 0 at both ends), so position, view direction and
 *  FOV stay C2-continuous whatever each side is doing; the written view yaw then passes the approved eased cap
 *  (standing ≤90°/s, ≤200°/s²; walking ≤120°/s, ≤300°/s²). Anchors come from data (场景设计部 paths drop in later). */
import type {Pose,Vec} from '../world-r1/WorldFlowCore';
export const TRANSITION_CAM=Object.freeze({blendInS:1.6,blendOutS:1.6,fovDeg:48,
 standYawDegS:90,standYawAccDegS2:200,walkYawDegS:120,walkYawAccDegS2:300,
 /** pitch / FOV / position caps of the written lens (eased, never a cut) */
 pitchDegS:40,fovDegS:12,minClearM:1.1,
 /** peak lens speed of a blend (m/s): a long gap gets a longer blend (min-jerk peak = 1.875·gap/T) */
 blendLensMS:5});
const blendFor=(base:number,gapM:number)=>Math.max(base,1.875*gapM/TRANSITION_CAM.blendLensMS);
/** End-of-shot camera state a caller hands over (T-02 continuation hook carries exactly this). vel in m/s, optional. */
export type CamState=Readonly<{pose:Pose;vel?:Vec;yawRateDegS?:number}>;
/** One authored key; `her` = keys are offsets from her feet (rotated by her yaw), so a path change keeps the framing. */
export type ShotKey=Readonly<{t:number;pos:Vec;look:Vec;fov?:number}>;
export type ShotSpec=Readonly<{id:string;keys:readonly ShotKey[];space?:'world'|'her';mode?:'stand'|'walk'|((t:number)=>'stand'|'walk');
 /** live shot (HerShot.followShot on her real path) instead of keys */source?:(t:number)=>Pose;blendInS?:number;blendOutS?:number;placeholder?:boolean}>;
export type HerState=Readonly<{feet:Vec;yawDeg:number}>;
const R=Math.PI/180;
export const minJerk=(u:number)=>{const x=Math.max(0,Math.min(1,u));return x*x*x*(10-15*x+6*x*x);};
const lerp=(a:number,b:number,u:number)=>a+(b-a)*u;
const lerp3=(a:readonly number[],b:readonly number[],u:number):Vec=>[lerp(a[0],b[0],u),lerp(a[1],b[1],u),lerp(a[2],b[2],u)];
const sub=(a:readonly number[],b:readonly number[]):Vec=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const len=(a:readonly number[])=>Math.hypot(a[0],a[1],a[2]);
const dist3=(a:readonly number[],b:readonly number[])=>len(sub(a,b));
export const wrap=(a:number)=>((a%360)+540)%360-180;
/** View yaw (° about +Y, atan2(x,z) of the forward) and pitch (°) of a pose. */
export function viewOf(p:Pose):{yaw:number;pitch:number;dist:number}{const f=sub(p.target,p.position),d=len(f)||1e-6;
 return {yaw:Math.atan2(f[0],f[2])/R,pitch:Math.asin(Math.max(-1,Math.min(1,f[1]/d)))/R,dist:d};}
function poseFromView(pos:Vec,yaw:number,pitch:number,dist:number,fov:number):Pose{const y=yaw*R,p=pitch*R;
 return {position:pos,target:[pos[0]+Math.sin(y)*Math.cos(p)*dist,pos[1]+Math.sin(p)*dist,pos[2]+Math.cos(y)*Math.cos(p)*dist],fovVerticalDeg:fov};}
/** Blend two poses: position linear, view direction by yaw/pitch (shortest way), look distance and FOV linear. */
export function blendPose(a:Pose,b:Pose,w:number):Pose{const va=viewOf(a),vb=viewOf(b);
 return poseFromView(lerp3(a.position,b.position,w),va.yaw+wrap(vb.yaw-va.yaw)*w,lerp(va.pitch,vb.pitch,w),lerp(va.dist,vb.dist,w),
  lerp(a.fovVerticalDeg??TRANSITION_CAM.fovDeg,b.fovVerticalDeg??TRANSITION_CAM.fovDeg,w));}
const rotY=(deg:number,p:readonly number[]):Vec=>{const t=deg*R,c=Math.cos(t),s=Math.sin(t);return [c*p[0]+s*p[2],p[1],-s*p[0]+c*p[2]];};
/** Sample an authored shot at t (Catmull-Rom on keys, clamped). Placeholder anchors are fine: only data changes later. */
export function sampleShot(spec:ShotSpec,t:number,her?:HerState):Pose{if(spec.source)return spec.source(t);const k=spec.keys;if(!k.length)throw Error('transition-shot-empty:'+spec.id);
 let i=0;while(i<k.length-2&&t>k[i+1].t)i++;const a=k[Math.max(0,i-1)],b=k[i],c=k[Math.min(k.length-1,i+1)],d=k[Math.min(k.length-1,i+2)];
 const u=c.t>b.t?Math.max(0,Math.min(1,(t-b.t)/(c.t-b.t))):0;
 const cr=(p0:readonly number[],p1:readonly number[],p2:readonly number[],p3:readonly number[]):Vec=>{const u2=u*u,u3=u2*u;
  return [0,1,2].map(j=>0.5*(2*p1[j]+(-p0[j]+p2[j])*u+(2*p0[j]-5*p1[j]+4*p2[j]-p3[j])*u2+(-p0[j]+3*p1[j]-3*p2[j]+p3[j])*u3)) as unknown as Vec;};
 let pos=cr(a.pos,b.pos,c.pos,d.pos),look=cr(a.look,b.look,c.look,d.look);const fov=lerp(b.fov??TRANSITION_CAM.fovDeg,c.fov??TRANSITION_CAM.fovDeg,u);
 if(spec.space==='her'){if(!her)throw Error('transition-shot-needs-her:'+spec.id);const m=(p:Vec):Vec=>{const r=rotY(her.yawDeg,p);return [r[0]+her.feet[0],r[1]+her.feet[1],r[2]+her.feet[2]];};pos=m(pos);look=m(look);}
 return {position:pos,target:look,fovVerticalDeg:fov};}
export const shotLength=(s:ShotSpec)=>s.keys.length?s.keys[s.keys.length-1].t:0;
/** Begin with an explicit spec (live HerShot source), not from the data table. */
export function beginTransitionSpec(spec:ShotSpec,from:CamState|((t:number)=>Pose)):TransitionRun{const src=typeof from==='function'?from:coastFrom(from);return new TransitionRun(spec,src,()=>undefined,typeof from==='function'?0:(from.yawRateDegS??0));}
type Source=(t:number)=>Pose;
/** Eased cap on the written view: yaw trapezoid (≤V, ≤A), pitch and FOV rate caps. Never jumps; converges on the target. */
export class ViewLimiter{
 yaw=0;pitch=0;fov:number=TRANSITION_CAM.fovDeg;vy=0;live=false;private lastRaw:number|null=null;
 reset(p:Pose,yawRateDegS=0){const v=viewOf(p);this.yaw=v.yaw;this.pitch=v.pitch;this.fov=p.fovVerticalDeg??TRANSITION_CAM.fovDeg;this.vy=yawRateDegS;this.lastRaw=v.yaw;this.live=true;}
 /** caught up with the raw view (safe to stop writing through the limiter) */
 settled=false;
 step(p:Pose,dt:number,mode:'stand'|'walk'):Pose{const v=viewOf(p);if(!this.live)this.reset(p);
  const t=Math.min(0.1,Math.max(0,dt));if(!(t>0))return poseFromView(p.position,this.yaw,this.pitch,v.dist,this.fov);
  const V=mode==='walk'?TRANSITION_CAM.walkYawDegS:TRANSITION_CAM.standYawDegS,A=mode==='walk'?TRANSITION_CAM.walkYawAccDegS2:TRANSITION_CAM.standYawAccDegS2;
  /* feed-forward: follow the raw view's own yaw rate, plus the eased catch-up on the error (else a moving target lags forever) */
  const ff=this.lastRaw===null?0:Math.max(-V,Math.min(V,wrap(v.yaw-this.lastRaw)/t));this.lastRaw=v.yaw;
  const d=wrap(v.yaw-this.yaw),want=Math.max(-V,Math.min(V,ff+Math.sign(d)*Math.min(Math.sqrt(2*A*Math.abs(d)),Math.abs(d)*8)/* linear near zero: no chatter */));
  const nv=this.vy+Math.max(-A*t,Math.min(A*t,want-this.vy));
  this.yaw+=nv*t;this.vy=nv;
  const pc=TRANSITION_CAM.pitchDegS*t;this.pitch+=Math.max(-pc,Math.min(pc,v.pitch-this.pitch));
  const fc=TRANSITION_CAM.fovDegS*t,fv=p.fovVerticalDeg??TRANSITION_CAM.fovDeg;this.fov+=Math.max(-fc,Math.min(fc,fv-this.fov));
  this.settled=Math.abs(wrap(v.yaw-this.yaw))<0.3&&Math.abs(v.pitch-this.pitch)<0.05&&Math.abs(fv-this.fov)<0.01;
  return poseFromView(p.position,this.yaw,this.pitch,v.dist,this.fov);}
}
/** Extrapolate a frozen end-of-shot state with its velocity, decaying to rest (so a moving T-02 / level lens never stops dead). */
export function coastFrom(s:CamState,tau=0.5):Source{const v=s.vel??[0,0,0];
 return t=>{const k=tau*(1-Math.exp(-Math.max(0,t)/tau));return {position:[s.pose.position[0]+v[0]*k,s.pose.position[1]+v[1]*k,s.pose.position[2]+v[2]*k],
  target:[s.pose.target[0]+v[0]*k,s.pose.target[1]+v[1]*k,s.pose.target[2]+v[2]*k],fovVerticalDeg:s.pose.fovVerticalDeg};};}
export type Phase='in'|'shot'|'out'|'done';
/** One transition run. step(dt) → the pose to write this frame. Clock is foreground seconds (caller passes dt). */
export class TransitionRun{
 t=0;phase:Phase='in';private outT0=-1;private next:Source|null=null;private lim=new ViewLimiter();
 constructor(readonly spec:ShotSpec,private from:Source,private her:()=>HerState|undefined=()=>undefined,startYawRateDegS=0){this.lim.reset(from(0),startYawRateDegS);
  this.blendIn=blendFor(spec.blendInS??TRANSITION_CAM.blendInS,dist3(from(0).position,this.shot(0).position));this.blendOut=spec.blendOutS??TRANSITION_CAM.blendOutS;}
 blendIn:number;blendOut:number;
 /** Hand to the next level camera (live source, sampled each frame from the moment of handoff). */
 handTo(next:Source){if(this.outT0<0){this.next=next;this.outT0=this.t;this.blendOut=blendFor(this.spec.blendOutS??TRANSITION_CAM.blendOutS,dist3(next(0).position,this.raw(this.t).position));}}
 shot(t:number){return sampleShot(this.spec,t,this.her());}
 raw(t:number):Pose{let p=this.shot(t);
  if(t<this.blendIn)p=blendPose(this.from(t),p,minJerk(t/this.blendIn));
  if(this.outT0>=0&&this.next){const u=(t-this.outT0)/this.blendOut;p=blendPose(p,this.next(t-this.outT0),minJerk(u));}
  return p;}
 step(dt:number):Pose{this.t+=Math.max(0,Math.min(0.1,dt));const t=this.t;
  const m=this.spec.mode,pose=this.lim.step(this.raw(t),dt,typeof m==='function'?m(t):m??'stand');
  /* done only once the blend is over AND the capped lens has caught up: the next writer then continues without a step */
  this.phase=this.outT0>=0?(t-this.outT0>=this.blendOut&&this.lim.settled?'done':'out'):t<this.blendIn?'in':'shot';
  return pose;}
}
/** Data: segments by id. Placeholder anchors are flagged so QA / 场景设计部 can see what is still provisional. */
export type TransitionData=Readonly<{format:'qf-transition-cam/1';segments:Readonly<Record<string,ShotSpec>>}>;
export const TRANSITION_SEGMENTS=['A1-dock-walk','A2-board','A3-setoff','A4A5-arrive-disembark','A6-meadow-first','B1-basket-in','B2-ignite','B3-flight','B4B5-skycity-out','C1-sky-basket-in','C2-lakeside-out'] as const;
let data:TransitionData|null=null;
export function setTransitionData(d:TransitionData|null){if(d&&d.format!=='qf-transition-cam/1')throw Error('transition-cam-format');data=d;}
export function transitionShot(id:string):ShotSpec|null{return data?.segments[id]??null;}
/** GGbot hooks (also on globalThis.__qfTransitionCam): begin from the live lens or a CamState, step each frame, handTo the
 *  next level camera, isDone. A segment with no data returns null → caller keeps its old path (WindWipe fallback). */
export function beginTransition(id:string,from:CamState|Source,her?:()=>HerState|undefined):TransitionRun|null{
 const s=transitionShot(id);if(!s)return null;const src=typeof from==='function'?from:coastFrom(from);
 return new TransitionRun(s,src,her,typeof from==='function'?0:(from.yawRateDegS??0));}
/** T-02 continuation hook: register this as its listener; it carries the end-of-shot CamState. */
export type ContinuationListener=(state:CamState)=>void;
const listeners:ContinuationListener[]=[];
export function onShotContinue(fn:ContinuationListener):()=>void{listeners.push(fn);return ()=>{const i=listeners.indexOf(fn);if(i>=0)listeners.splice(i,1);};}
export function fireShotContinue(state:CamState){for(const f of listeners.slice())f(state);}
try{(globalThis as any).__qfTransitionCam={setTransitionData,transitionShot,beginTransition,onShotContinue,fireShotContinue,blendPose,minJerk};}catch{}
