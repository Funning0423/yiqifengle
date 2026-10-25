import type {Pose, Vec} from '../world-r1/WorldFlowCore';
import {REGION_JOURNEY_LAYOUT} from './RegionJourneyLayout';
import {meadowLocalToWorld, SAIL_LANDING_BERTH_LOCAL, sailArrivalWalkM} from './SailLanding';
import {CITY_ON_T, FLIGHT_DURATION, GRASS_OFF_T, LAND_T, MEADOW_OFF_T, S0_GAME, SEAM_T, STRATA_OFF_T, applyRigid, artCityInMeadow, flightDocument, mapFlightPoint, meadowFrameFromM6, postSeamFrame, sampleFlight, type Rigid} from './BalloonFlight';
/** Island south dock and the meadow bank, in each region's own coordinates (maps/nodes.json).
 * M0 is 3 m upstream of the published river node so the shore walk stays inside the 30.5 s budget. */
export const SAIL_I6:Vec=[-1.9,-0.6,10.1];
export const SAIL_M0_LOCAL:Vec=[0.2,1.4,17];
export const SAIL_M1_LOCAL:Vec=[2.6,2.2,11.6];
/** Drops the sail copy of the meadow so the sea covers its southern lowland. Bridge mode still uses meadowOffset. */
export const SAIL_MEADOW_SINK=1.35;
/** Boat waterline (= transit sea_plane). Kept at −0.91 to match art berth / sea_plane. */
export const SAIL_WATER_Y=-0.91;
export const SAIL_SEA_Y=-0.91;
/** Boat parks on the port side of the I6 pier so the hull does not sit inside the deck. */
export const SAIL_BERTH_X=1.85;
export const SAIL_LIMITS={totalS:30.5,accel:2.7,decel:2.5,yawDegS:20,cruiseMinS:6,clearM:0.6,chordM:52,riverM:12,dockClearM:2,walkMps:1.2,boardBlendS:0.8,saS:7.6,sfS:1.0,sbS:2.0} as const;
const lerp=(a:number,b:number,t:number)=>a+(b-a)*t;
const dist=(a:Vec,b:Vec)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
const smoother=(u:number)=>{const t=Math.min(1,Math.max(0,u));return t*t*t*(t*(t*6-15)+10);};
/** Meadow root after yaw 180 so the estuary sits `sailMeadowOffset` (default +Z 52 m) from I6. */
export function sailMeadowRoot(i6:Vec=SAIL_I6,m0:Vec=SAIL_M0_LOCAL,offset:Vec=REGION_JOURNEY_LAYOUT.sailMeadowOffset):Vec{
 const mouth:Vec=[i6[0]+offset[0],SAIL_WATER_Y+offset[1]+(m0[1]-SAIL_WATER_Y),i6[2]+offset[2]];
 return [mouth[0]+m0[0],mouth[1]-m0[1]-SAIL_MEADOW_SINK,mouth[2]+m0[2]];
}
export function rotY180(p:Vec,root:Vec):Vec{return [root[0]-p[0],root[1]+p[1],root[2]-p[2]];}
export function sailM0World(i6:Vec=SAIL_I6):Vec{return rotY180(SAIL_M0_LOCAL,sailMeadowRoot(i6));}
export function sailM1World(i6:Vec=SAIL_I6):Vec{return rotY180(SAIL_M1_LOCAL,sailMeadowRoot(i6));}
/** `landing_berth` in world space (boat waterline root). */
export function sailBerthWorld(i6:Vec=SAIL_I6):Vec{
 const p=meadowLocalToWorld(SAIL_LANDING_BERTH_LOCAL,sailMeadowRoot(i6));
 return [p[0],SAIL_WATER_Y,p[2]];
}
/** Legacy M0→M1 chord (board nodes). Arrival walk on the jetty is `sailArrivalWalkM`. */
export function shoreWalkM():number{return dist(SAIL_M0_LOCAL,SAIL_M1_LOCAL);}
/**
 * Gentle S (radius ≥ 25 m) then ~10 m straight into `landing_berth` on the waterline.
 * No climb onto M0 grass — that was the hull-in-meadow bug.
 */
export function sailRoute(i6:Vec=SAIL_I6,_m0:Vec=sailM0World(i6)):{samples:Vec[];length:number;minRadius:number}{
 const end=sailBerthWorld(i6);
 const z0=i6[2]+SAIL_LIMITS.dockClearM,z1=end[2],x0=i6[0]+SAIL_BERTH_X,span=Math.max(1e-3,z1-z0);
 // Last 10 m: straight into the berth. Lateral offset (~4.3 m) is taken over `align` m beforehand
 // so the turn radius stays ≥ 25 m (sagitta rule: L ≳ √(8·R·d)).
 const straight=10,align=30;
 const raw:Vec[]=[];
 const steps=Math.max(16,Math.ceil(Math.abs(span)/0.5));
 for(let i=0;i<=steps;i++){
  const u=i/steps,z=lerp(z0,z1,u),remain=z1-z;
  const swayEnv=remain<=straight+4?0:remain<straight+4+12?smoother((remain-(straight+4))/12):1;
  // Mild sway only: lateral berth offset already spends the curvature budget.
  const sway=Math.sin(u*Math.PI)*0.3*swayEnv;
  let center=x0;
  if(remain<=straight)center=end[0];
  else if(remain<straight+align)center=lerp(x0,end[0],smoother(1-(remain-straight)/align));
  raw.push([center+sway,SAIL_WATER_Y,z]);
 }
 raw[raw.length-1]=[end[0],SAIL_WATER_Y,end[2]];
 const samples:Vec[]=[raw[0]];
 for(let i=1;i<raw.length;i++)if(dist(samples[samples.length-1],raw[i])>=0.49)samples.push(raw[i]);
 if(dist(samples[samples.length-1],raw[raw.length-1])>1e-3)samples.push(raw[raw.length-1]);
 let length=0;for(let i=1;i<samples.length;i++)length+=dist(samples[i-1],samples[i]);
 let minRadius=1e9;
 for(let i=1;i<samples.length-1;i++){
  const a=samples[i-1],b=samples[i],c=samples[i+1];
  const ab=dist(a,b),bc=dist(b,c),ac=dist(a,c);
  const area=Math.abs((b[0]-a[0])*(c[2]-a[2])-(b[2]-a[2])*(c[0]-a[0]))*0.5;
  const r=area>1e-6?(ab*bc*ac)/(4*area):1e9;
  if(r<minRadius)minRadius=r;
 }
 return {samples,length,minRadius};
}
export type SailSpeed={v:number;accelS:number;cruiseS:number;decelS:number;aAcc:number;aDec:number;motionS:number;length:number};
/** Cover `length` at up to 3.6 m/s with a 2 s ease-in and a 2.2 s ease-out. */
export function sailSpeed(length:number,cruiseS:number=SAIL_LIMITS.cruiseMinS):SailSpeed{
 const accelS=2,decelS=2.2,cap=3.6;
 let cruise=cruiseS;
 let v=length/(cruise+accelS*0.5+decelS*0.5);
 if(v>cap){cruise=Math.max(6,length/cap-accelS*0.5-decelS*0.5);v=length/(cruise+accelS*0.5+decelS*0.5);}
 return {v,accelS,cruiseS:cruise,decelS,aAcc:v/accelS,aDec:v/decelS,motionS:accelS+cruise+decelS,length};
}
export function sailDistanceAt(sp:SailSpeed,t:number):number{
 const {v,accelS,cruiseS,decelS,length}=sp;
 if(t<=0)return 0;
 if(t>=sp.motionS)return length;
 if(t<accelS){const u=t/accelS;return v*accelS*u*u*0.5;}
 if(t<accelS+cruiseS)return v*accelS*0.5+v*(t-accelS);
 const u=(sp.motionS-t)/decelS;return length-v*decelS*u*u*0.5;
}
export function sailSpeedAt(sp:SailSpeed,t:number):number{
 if(t<=0||t>=sp.motionS)return 0;
 if(t<sp.accelS)return sp.v*(t/sp.accelS);
 if(t<sp.accelS+sp.cruiseS)return sp.v;
 return sp.v*((sp.motionS-t)/sp.decelS);
}
export type SailBeat={id:string;t0:number;t1:number;cue?:string};
export type SailTimeline={beats:SailBeat[];totalS:number;build05S:number;speed:SailSpeed;routeM:number;shoreM:number;shoreS:number;arrivalM:number;arrivalS:number};
/**
 * Sail clock ends when she steps onto the jetty deck (GBT §6).
 * Jetty→meadow path walk is `arrivalS` (≤ 12 s) and is not part of build05S.
 */
export function sailBeats(routeM:number,shoreM:number=shoreWalkM()):SailTimeline{
 const speed=sailSpeed(routeM);
 const arrivalM=sailArrivalWalkM(),arrivalS=arrivalM/SAIL_LIMITS.walkMps;
 const sb=SAIL_LIMITS.sbS,sc=speed.accelS,sd=speed.cruiseS,se=speed.decelS,sf=SAIL_LIMITS.sfS;
 // S-g: stand → port rail → landing_step (counted in the sail budget).
 const sg=SAIL_LIMITS.boardBlendS;
 const rest=sb+speed.motionS+sf+sg;
 const sa=Math.min(SAIL_LIMITS.saS,Math.max(5.9,30.5-rest));
 let t=0;const beats:SailBeat[]=[];
 const push=(id:string,dur:number,cue?:string)=>{beats.push({id,t0:t,t1:t+dur,cue});t+=dur;};
 push('S-a',sa,'node-walk-start');
 push('S-b',sb,'sail-board');
 push('S-c',sc,'sail-unfurl');
 push('S-d',sd,'sail-cruise-loop-start');
 push('S-e',se,'sail-dock');
 push('S-f',sf);
 push('S-g',sg,'node-arrive');
 return {beats,totalS:speed.motionS+sb+sf,build05S:t,speed,routeM,shoreM,shoreS:shoreM/SAIL_LIMITS.walkMps,arrivalM,arrivalS};
}
export function beatAt(tl:SailTimeline,t:number):SailBeat{return tl.beats.find(b=>t>=b.t0&&t<b.t1)||tl.beats[tl.beats.length-1];}
/** Real seconds → sail timeline. Wait for sitting, then preserve the designed hull speed even if boarding used up the budget. */
export function sailPresentationT(real:number,departAt:number|null,motionStart:number,_motionEnd:number,buildEnd:number,_motionBudget:number):number{
 if(departAt==null)return Math.min(Math.max(0,real),Math.max(0,motionStart-1e-4));
 const since=Math.max(0,real-departAt);
 return Math.min(buildEnd,motionStart+since);
}
function samplePoly(samples:readonly Vec[],distance:number):Vec{
 let left=Math.max(0,distance);
 for(let i=1;i<samples.length;i++){const d=dist(samples[i-1],samples[i]);if(d>0&&left<=d){const a=samples[i-1],b=samples[i],u=left/d;return [lerp(a[0],b[0],u),lerp(a[1],b[1],u),lerp(a[2],b[2],u)];}left-=d;}
 return samples[samples.length-1];
}
function heading(samples:readonly Vec[],distance:number):number{
 const a=samplePoly(samples,Math.max(0,distance-0.4)),b=samplePoly(samples,distance+0.4);
 const x=b[0]-a[0],z=b[2]-a[2];return Math.hypot(x,z)>1e-4?Math.atan2(x,z):0;
}
export type SailPose={pos:Vec;yaw:number;roll:number;sail:number;speed:number;distance:number};
/** Boat pose. `t` is Build05 time (0 = leaving the mainline-04 stand). The hull is still through S-b. */
export function sailVehicle(tl:SailTimeline,route:readonly Vec[],t:number):SailPose{
 const sc=tl.beats.find(b=>b.id==='S-c')!,se=tl.beats.find(b=>b.id==='S-e')!,sd=tl.beats.find(b=>b.id==='S-d')!;
 let distM=0,speed=0,sailOpen=0;
 if(t>=sc.t0&&t<se.t1){
  const local=t-sc.t0;distM=sailDistanceAt(tl.speed,local);speed=sailSpeedAt(tl.speed,local);
  const u=t<sc.t1?(t-sc.t0)/(sc.t1-sc.t0):t<se.t0?1:1-(t-se.t0)/(se.t1-se.t0);
  sailOpen=smoother(Math.min(1,Math.max(0,u)));
 }else if(t>=se.t1)distM=tl.speed.length;
 const pos=samplePoly(route,Math.min(tl.speed.length,distM));
 const yaw=heading(route,Math.min(tl.speed.length,distM));
 const roll=t>=sd.t0&&t<se.t0?Math.sin((t-sd.t0)/3.2*Math.PI*2)*4*Math.PI/180:0;
 const bob=0;
 return {pos:[pos[0],pos[1]+bob,pos[2]],yaw,roll,sail:sailOpen,speed,distance:distM};
}
export function sailMaxYawRateDeg(tl:SailTimeline,route:readonly Vec[]):number{
 let max=0,prev=sailVehicle(tl,route,tl.beats[2].t0).yaw;
 for(let t=tl.beats[2].t0;t<=tl.beats[4].t1;t+=0.05){
  const y=sailVehicle(tl,route,t).yaw;let d=y-prev;while(d>Math.PI)d-=Math.PI*2;while(d<-Math.PI)d+=Math.PI*2;
  max=Math.max(max,Math.abs(d)/0.05*180/Math.PI);prev=y;
 }
 return max;
}
export type SailScreen={w:number;h:number};
type SailOff={back:number;side:number;up:number;fov:number;look:number;orb:number};
const K1:SailOff={back:6.15,side:-4.76,up:4.3,fov:48,look:0.8,orb:0};
/**
 * Ahead of the bow, a little to starboard, looking back at the wake.
 * Portrait 390×844 is only ~25° wide, so a large side offset crops the hull
 * (the old side:-5.8 shot). Last 10% of S-c holds this pose for the K2 still.
 */
/** b16 item 4: S-a walk lens (her right, behind the jetty, aimed 6 m behind the bow at her path). */
const K0:SailOff={back:12,side:-4,up:4,fov:50,look:2,orb:0};
export const SAIL_K0_BLEND_S=5;
const K2:SailOff={back:-11,side:-1,up:5.2,fov:52,look:-6,orb:0};
/**
 * Beam on her starboard side (b11). The jib, main and boom all sit to port of the centreline (+X), so from
 * starboard they are behind her; K2 (starboard bow) → Kbeam → K3 (starboard quarter) never crosses the bow line.
 * Was side:10.2 (port): the swing off the bow looked through the jib and rig (chest hidden S-d u 0.02–0.06, 0.23).
 */
/** b16: up 5.1 → 7.0. Kbeam is now passed on one arc, and a higher pass keeps the jib off her port limbs (mast-occlusion cap). */
const Kbeam:SailOff={back:0.8,side:-10.2,up:7.0,fov:52,look:0.2,orb:0};
/**
 * Far-sea K3 (day) / K7 (night still). r5-sail-farsea: astern, a little to starboard, lower, aimed 3 m ahead
 * so the meadow windmill (≈80 m ahead, port of the heading) sits whole in the upper third above her.
 * fov stays 52 so the K7 star still keeps its pixel size.
 * Old (sail-k2k7): {back:8.2,side:7.8,up:5.0,fov:52,look:0.2}, port quarter, windmill ~6 ndc off the left edge.
 * b12 rework (K7 windmill whole, centred-upper; was back 10.5 side -2: blades cut at left edge): back 11.5 side -4.5.
 * Rollback: restore that line and SAIL_K3_IN back to 0.24.
 */
/** b16: side -4.5 → -2. K3 now holds ~11 m further up the route (eased arcs), where -4.5 put the windmill on the right edge. */
const K3:SailOff={back:11.5,side:-2,up:4.4,fov:52,look:3,orb:0};
/**
 * b16 S-c/S-d (Grok Bot decision 2026-10-22): the arcs round the boat stay, slower and eased. Camera clock τ = t − S-c.t0
 * (independent of the beat split, so the S-c/S-d boat clock and build05S are unchanged):
 *   A  K1→K2 bow arc  τ 0 … SAIL_ARC_A_S    eased cruise (sine ramps, no acceleration step)
 *      K2 hold         … +SAIL_K2_HOLD_S    (K2 still in the middle)
 *   B  K2→Kbeam→K3    … +SAIL_ARC_B_S      one continuous arc; Kbeam is passed, not stopped at
 *      K3 hold         … +SAIL_K3_HOLD_S    (windmill / K7 still)
 *   K3→K4, K4 hold, K4→K5, K5 as before but on τ.
 * Peak view turn ≤ 60°/s (route test C1setoff). Was: A in 1.8 s and B in two smootherstep legs (159°/s, 626°/s²).
 * Item 1 (palm, b16): env_prop_palm_lean_01 sits on her starboard side at the jetty. A starts at motion start so the
 * starboard pass sweeps west of her before her bearing to the palm comes round (old 1.8 s arc crossed it at 10.4 s),
 * and B reaches the astern K3 only once K3's lens is north of the palm (old K3 lens sat in its crown at 13.8 s).
 * The tree is not moved or hidden; the route test O1/O2 lock it.
 * Arc window for the 60°/s exception: τ ∈ [0, K3→K4 end] (sailArcWindow).
 */
export const SAIL_ARC_A0=0,SAIL_ARC_A_S=4.0,SAIL_K2_HOLD_S=0.15,SAIL_ARC_B_S=5.0,SAIL_K3_HOLD_S=0.4,SAIL_K34_S=1.2;
const SAIL_EASE_RAMP=0.3;
export const SAIL_ARC_A_LIFT=1.2;
/** Eased cruise 0→1: sine-shaped speed ramps over the first/last SAIL_EASE_RAMP, constant speed between. C2. */
export function sailEase(u:number,r:number=SAIL_EASE_RAMP):number{
 const x=Math.min(1,Math.max(0,u)),tot=1-r;
 const up=(v:number)=>v/2-r/(2*Math.PI)*Math.sin(Math.PI*v/r);
 if(x<r)return up(x)/tot;
 if(x>1-r)return 1-up(1-x)/tot;
 return (r/2+(x-r))/tot;
}
const B_IN=SAIL_ARC_A0+SAIL_ARC_A_S+SAIL_K2_HOLD_S,K3_IN_T=B_IN+SAIL_ARC_B_S,K3_OUT_T=K3_IN_T+SAIL_K3_HOLD_S;
/** Legacy S-d u marks on the default route (S-c 2 s, S-d 8.22 s). Prefer sailK3Window / sailArcWindow / sailStillTimes. */
export const SAIL_BEAM_IN=0.2615,SAIL_K3_IN=0.8697,SAIL_K3_OUT=0.9183;
export function sailArcWindow(tl:SailTimeline):{t0:number;t1:number}{const sc=tl.beats.find(x=>x.id==='S-c')!;return {t0:sc.t0,t1:sc.t0+K3_OUT_T+SAIL_K34_S};}
/** Build05 times of the K stills on the b16 arc clock (K1 S-b, K2 hold, K3/K7 hold, K4 end of K3→K4, K5 on the K4→K6 move). */
export function sailStillTimes(tl:SailTimeline):{k1:number;k2:number;k3:number;k4:number;k5:number}{
 const sb=tl.beats.find(x=>x.id==='S-b')!,sc=tl.beats.find(x=>x.id==='S-c')!,se=tl.beats.find(x=>x.id==='S-e')!,k4=sc.t0+K3_OUT_T+SAIL_K34_S;
 return {k1:sb.t0+(sb.t1-sb.t0)*0.55,k2:sc.t0+SAIL_ARC_A0+SAIL_ARC_A_S+SAIL_K2_HOLD_S/2,k3:sc.t0+(K3_IN_T+K3_OUT_T)/2,k4:k4+0.05,k5:k4+(se.t1-k4)*0.5};
}
export function sailK3Window(tl:SailTimeline):{in:number;out:number}{
 const sc=tl.beats.find(x=>x.id==='S-c')!,sd=tl.beats.find(x=>x.id==='S-d')!,D=sd.t1-sd.t0,off=sc.t1-sc.t0;
 return {in:(K3_IN_T-off)/D,out:(K3_OUT_T-off)/D};
}
/** Stay in the channel. side 5.2 put the lens inside rm_bank_left once the boat reaches the mouth. */
const K4:SailOff={back:9.2,side:1.05,up:6.2,fov:50,look:2.4,orb:0};
/** Channel centre: boat x≈−4.4, side≈0.9 → camera x≈−3.5, between the inner banks. */
const K5:SailOff={back:9.0,side:0.92,up:8.2,fov:48,look:2.2,orb:0};
/** Same channel, a little closer. The old side 4.2 still sat in the left bank. */
const K6:SailOff={back:8.4,side:0.85,up:10.0,fov:48,look:2.8,orb:0};
/** Blend on a constant-radius arc. A straight lerp from ahead of the bow to astern crosses the hull and guardOff then teleports. */
function orbitMix(a:SailOff,b:SailOff,u:number,ease:(x:number)=>number=smoother):SailOff{
 const s=ease(Math.min(1,Math.max(0,u)));
 let ang=Math.atan2(a.side,a.back),bng=Math.atan2(b.side,b.back),d=bng-ang;
 while(d>Math.PI)d-=Math.PI*2;while(d<-Math.PI)d+=Math.PI*2;
 const th=ang+d*s,r=lerp(Math.hypot(a.back,a.side),Math.hypot(b.back,b.side),s);
 return {back:Math.cos(th)*r,side:Math.sin(th)*r,up:lerp(a.up,b.up,s),fov:lerp(a.fov,b.fov,s),look:lerp(a.look,b.look,s),orb:lerp(a.orb,b.orb,s)};
}
/** Keep the lens outside the 4.2 m hull. A straight blend from astern to ahead would cross the mast. */
function guardOff(o:SailOff):SailOff{const r=Math.hypot(o.back,o.side);if(r>=7.2)return o;const k=7.2/Math.max(1e-3,r);return {...o,back:o.back*k,side:o.side*k};}
/**
 * b16 item 4: off the bow/stern axis the look point (metres along the hull) swings her sideways on screen; a 3 m look from a
 * beam lens put her past the right edge (S-c 11.1–12.7 s, S-d 14.8–15.4 s). Damp it by sin²(bearing), only inside an arc
 * (sin²(π·s) → the K-shot ends are untouched).
 */
const SAIL_SEAT_BACK=0.55;
function lookDamp(o:SailOff,s:number):SailOff{const th=Math.atan2(o.side,o.back),w=1-smoother(s/0.3)*smoother((1-s)/0.3)*Math.min(1,3*Math.abs(Math.sin(th)));return {...o,look:o.look*w-SAIL_SEAT_BACK*(1-w)};}
function orbitPath(a:SailOff,m:SailOff,b:SailOff,u:number):SailOff{
 // One arc a→b through m's bearing; the other fields follow the bearing with C1 joins at m.
 const s=sailEase(u),ang=(o:SailOff)=>Math.atan2(o.side,o.back);
 const unwrap=(x:number,ref:number)=>{while(x-ref>Math.PI)x-=Math.PI*2;while(x-ref<-Math.PI)x+=Math.PI*2;return x;};
 const t0=ang(a),tm=unwrap(ang(m),t0),t1=unwrap(ang(b),tm),th=lerp(t0,t1,s);
 const f=(k:'up'|'fov'|'look'|'orb'|'r')=>{const g=(o:SailOff)=>k==='r'?Math.hypot(o.back,o.side):o[k];
  const u1=(th-t0)/(tm-t0);
  // 'up' leads on the first half (rises off the bow quickly: the jib hides her port limbs from a low bow lens).
  if(u1<1)return lerp(g(a),g(m),k==='up'?smoother(Math.min(1,u1*1.6)):smoother(u1));
  return lerp(g(m),g(b),smoother((th-tm)/(t1-tm)));};
 const r=f('r');
 return lookDamp({back:Math.cos(th)*r,side:Math.sin(th)*r,up:f('up'),fov:f('fov'),look:f('look'),orb:f('orb')},s);
}
function sailOffset(tl:SailTimeline,b:SailBeat,t:number):SailOff{
 const sc=tl.beats.find(x=>x.id==='S-c')!,sd=tl.beats.find(x=>x.id==='S-d')!,tau=t-sc.t0;
 if(b.id==='S-a'){
  // b16 item 4: she walks from the island stand (≈0.5 m behind the K1 lens) to the bench through S-a. K0 stands further back
  // and higher, aimed at the jetty, so her whole walk is in frame; it eases to K1 over the last SAIL_K0_BLEND_S of S-a.
  const u=(t-(b.t1-SAIL_K0_BLEND_S))/SAIL_K0_BLEND_S;
  return u<=0?K0:u>=1?K1:orbitMix(K0,K1,u);
 }
 if(b.id==='S-b')return K1;
 if(b.id==='S-c'||b.id==='S-d'||b.id==='S-e'||b.id==='S-f'||b.id==='S-g'){
  const ez=(o:SailOff,p:SailOff,u:number)=>orbitMix(o,p,sailEase(u),(x)=>x);
  if(tau<SAIL_ARC_A0)return K1;
  if(tau<SAIL_ARC_A0+SAIL_ARC_A_S){
   // Lifted over the bow quarter (sin bump, zero slope at both ends): a low lens there sees her port limbs through the jib.
   const u=(tau-SAIL_ARC_A0)/SAIL_ARC_A_S,e=sailEase(u),o=lookDamp(ez(K1,K2,u),e);return {...o,up:o.up+SAIL_ARC_A_LIFT*Math.sin(Math.PI*e)**2};
  }
  if(tau<B_IN)return K2;
  if(tau<K3_IN_T)return orbitPath(K2,Kbeam,K3,(tau-B_IN)/SAIL_ARC_B_S);
  if(tau<K3_OUT_T)return K3;
  // The tail runs on τ into S-e (the slower arcs cost ~2.2 s; S-e's K5 hold absorbs it, build05S unchanged).
  // b16 (sail.C1ride): the K4→K5→K6 move ends with S-f (she is still seated; the lens is held through S-f/S-g), not S-e: squeezed
  // into ~1.6 s before the berth it reached 10.6 m/s² at 21.8 s.
  const sg=tl.beats.find(x=>x.id==='S-g')!,end=sg.t1-sc.t0,k4in=K3_OUT_T+SAIL_K34_S;
  if(tau<k4in)return orbitMix(K3,K4,sailEase((tau-K3_OUT_T)/SAIL_K34_S),(x)=>x);
  // One eased move K4→K6 shaped by K5 (quadratic Bézier; small bearings, so field-wise is fine).
  const s=sailEase((tau-k4in)/Math.max(0.3,end-k4in),.5)/* b16: full sine ramps (C1ride) */,w0=(1-s)*(1-s),w1=2*s*(1-s),w2=s*s;
  const bz=(k:keyof SailOff)=>w0*K4[k]+w1*K5[k]+w2*K6[k];
  return {back:bz('back'),side:bz('side'),up:bz('up'),fov:bz('fov'),look:bz('look'),orb:bz('orb')};
 }
 return K6;
}
/** K1–K7 in the boat frame (README §5), held outside the hull. Positive side is port (+X, her left). */
const routeCum=new WeakMap<readonly Vec[],number[]>();
function sailLensYaw(route:readonly Vec[],d:number,fallback:number):number{
 if(route.length<2)return fallback;
 let cum=routeCum.get(route);if(!cum){cum=[0];for(let i=1;i<route.length;i++)cum.push(cum[i-1]+dist(route[i-1],route[i]));routeCum.set(route,cum);}
 const a=polyMean(route,cum,d-2,1.5),b=polyMean(route,cum,d+2,1.5),x=b[0]-a[0],z=b[2]-a[2];
 return Math.hypot(x,z)>1e-4?Math.atan2(x,z):fallback;
}
export function sailCamera(tl:SailTimeline,route:readonly Vec[],t:number,screen:SailScreen={w:390,h:844}):Pose{
 const v=sailVehicle(tl,route,t),b=beatAt(tl,t);
 let o=guardOff(sailOffset(tl,b,t));
 if(b.id==='S-d'&&o.orb>8){
  if(screen.h<=520||(screen.w===375&&screen.h===667))o={...o,up:o.up+0.6};
  if(screen.w===768&&screen.h===1024)o={...o,back:o.back-(o.back>0?1.5:-1.5)};
 }
 const orb=o.orb*Math.PI/180;
 // b16: lens frame yaw from the C1 running-mean chord of the route (as sailFollowCamera); the hull's ±0.4 m heading
 // carries the sample polyline's kinks, which an 11 m lever turned into lens acceleration steps (≈50 m/s² per frame).
 const pyaw=sailLensYaw(route,v.distance,v.yaw)+orb,fx=Math.sin(pyaw),fz=Math.cos(pyaw),rx=fz,rz=-fx;
 const pos:Vec=[v.pos[0]-fx*o.back+rx*o.side,v.pos[1]+o.up,v.pos[2]-fz*o.back+rz*o.side];
 const look=o.look;
 return {position:pos,target:[v.pos[0]+fx*look,v.pos[1]+1.05,v.pos[2]+fz*look],fovVerticalDeg:o.fov};
}
/** Point at arc length d on the polyline; past either end it continues along the end segment. */
function polyAt(path:readonly Vec[],cum:readonly number[],d:number):Vec{
 const n=path.length;if(n<2)return path[0]||[0,0,0];
 let i=1;while(i<n-1&&cum[i]<d)i++;
 const L=cum[i]-cum[i-1],k=L>0?(d-cum[i-1])/L:0;
 return [lerp(path[i-1][0],path[i][0],k),lerp(path[i-1][1],path[i][1],k),lerp(path[i-1][2],path[i][2],k)];
}
/** Exact mean of the polyline over [d-W,d+W] (piecewise linear, so trapezoids between vertices are exact). */
function polyMean(path:readonly Vec[],cum:readonly number[],d:number,W:number):Vec{
 const a=d-W,b=d+W,cuts=[a];for(const c of cum)if(c>a&&c<b)cuts.push(c);cuts.push(b);
 const o:Vec=[0,0,0];
 for(let i=1;i<cuts.length;i++){const p=polyAt(path,cum,cuts[i-1]),q=polyAt(path,cum,cuts[i]),w=(cuts[i]-cuts[i-1])/2;for(let j=0;j<3;j++)o[j]+=(p[j]+q[j])*w;}
 return [o[0]/(2*W),o[1]/(2*W),o[2]/(2*W)];
}
/**
 * Shore walk lens. Stateless (b16 item 2): the anchor is the ±1.2 m running mean of the path and the yaw is
 * the ±1.5 m chord of that mean, so corners turn the lens smoothly. The old per-call 2.5° yaw clamp depended on the
 * call rate (pose() and onFrame() both stepped it) and the anchor followed the raw corners: jump 30.9 s, lurch 33.9 s.
 * `state` is kept for the call sites and ignored.
 */
export function sailFollowCamera(path:readonly Vec[],u:number,from:Pose,to:Pose,_state?:{yaw:number|null}):Pose{
 const uc=Math.min(1,Math.max(0,u)),s=smoother(uc);
 const cum=[0];for(let i=1;i<path.length;i++)cum.push(cum[i-1]+dist(path[i-1],path[i]));
 const L=cum[cum.length-1],W=1.2,dd=L*uc;
 const at=path.length<2?(path[0]||[0,0,0] as Vec):polyMean(path,cum,dd,W);
 // Yaw from the chord of the (C1) mean, so the yaw rate is continuous too: no lateral lurch at a vertex.
 const pa=path.length<2?at:polyMean(path,cum,dd-1.5,W),pb=path.length<2?at:polyMean(path,cum,dd+1.5,W);
 const hx=pb[0]-pa[0],hz=pb[2]-pa[2];
 const yaw=Math.hypot(hx,hz)>1e-6?Math.atan2(hx,hz):0;
 const back=4.8,side=1.35,up=3.3;
 const fx=Math.sin(yaw),fz=Math.cos(yaw),rx=fz,rz=-fx;
 const follow:Pose={
  position:[at[0]-fx*back+rx*side,at[1]+up,at[2]-fz*back+rz*side],
  target:[at[0],at[1]+1.1,at[2]],
  fovVerticalDeg:lerp(from.fovVerticalDeg||48,to.fovVerticalDeg||48,s),
 };
 const chase:Pose={
  position:[lerp(from.position[0],follow.position[0],s),lerp(from.position[1],follow.position[1],s),lerp(from.position[2],follow.position[2],s)],
  target:[lerp(from.target[0],follow.target[0],s),lerp(from.target[1],follow.target[1],s),lerp(from.target[2],follow.target[2],s)],
  fovVerticalDeg:follow.fovVerticalDeg,
 };
 // The second half eases onto the meadow board. At u=1 the pose is already the map lens, so the handoff is not a cut.
 const blendAt=0.5;
 const m=u<=blendAt?0:smoother(Math.min(1,(u-blendAt)/(1-blendAt)));
 return {
  position:[lerp(chase.position[0],to.position[0],m),lerp(chase.position[1],to.position[1],m),lerp(chase.position[2],to.position[2],m)],
  target:[lerp(chase.target[0],to.target[0],m),lerp(chase.target[1],to.target[1],m),lerp(chase.target[2],to.target[2],m)],
  fovVerticalDeg:lerp(chase.fovVerticalDeg,to.fovVerticalDeg||chase.fovVerticalDeg,m),
 };
}
/** Seated root on the hull at `pos` (waterline), matching `seated_root_anchor`. */
export function sailDockSeat(route:readonly Vec[]){
 const p=route[0],q=route[Math.min(route.length-1,3)];
 const yaw=Math.hypot(q[0]-p[0],q[2]-p[2])>1e-4?Math.atan2(q[0]-p[0],q[2]-p[2]):0;
 const fx=Math.sin(yaw),fz=Math.cos(yaw);
 return seatFromBench([p[0]+fx*-0.55,p[1]+0.06,p[2]+fz*-0.55],yaw);
}
export function sailJourneyPath(start:Vec,m0:Vec,m1:Vec,route:readonly Vec[]):{path:Vec[];bridgeStart:number;bridgeEnd:number}{
 const dock:Vec=[SAIL_I6[0],start[1],SAIL_I6[2]];
 const path:Vec[]=[start];
 const push=(p:Vec)=>{if(dist(path[path.length-1],p)>0.02)path.push(p);};
 if(dist(start,dock)>0.05)push(dock);
 for(const p of route)push(p);
 push(m0);push(m1);
 const bridgeStart=dist(start,dock)>0.05?dist(path[0],path[1]):0;
 let length=0;for(let i=1;i<path.length;i++)length+=dist(path[i-1],path[i]);
 const bridgeEnd=Math.min(length-0.05,bridgeStart+0.02);
 return {path,bridgeStart,bridgeEnd:Math.max(bridgeStart+0.01,bridgeEnd)};
}
export function sailMaxAccel(sp:SailSpeed):number{return Math.max(sp.aAcc,sp.aDec);}
export const SAIL_SCREENS:SailScreen[]=[{w:390,h:844},{w:414,h:896},{w:360,h:780},{w:375,h:667},{w:390,h:520},{w:320,h:568},{w:768,h:1024}];
export function chordM(i6:Vec=SAIL_I6,m0:Vec=sailM0World(i6)):number{return Math.hypot(m0[0]-i6[0],m0[2]-i6[2]);}
/** A killed sail never resumes at sea. mainline-04 already won → meadow board 05. */
export function sailResumeAfterKill(completedThrough:number):{atSea:false;region:'island'|'meadow';board:string}{
 if(completedThrough>=4)return {atSea:false,region:'meadow',board:'mainline-05'};
 const n=Math.max(1,Math.min(4,completedThrough+1));
 return {atSea:false,region:'island',board:'mainline-0'+n};
}
export function createSailClock(){
 let t=0,hiddenFor=0,fade=0,lastWall=0;
 return {
  get t(){return t;},get fade(){return fade;},get hiddenFor(){return hiddenFor;},
  hide(wallDt:number){hiddenFor+=Math.max(0,wallDt);},
  show(frameDt:number){const arm=hiddenFor>30;if(arm)fade=0.35;else if(fade>0)fade=Math.max(0,fade-frameDt);hiddenFor=0;t+=Math.max(0,frameDt);},
  gap(nowMs:number,frameDt:number){if(lastWall&&nowMs-lastWall>30000)fade=0.35;lastWall=nowMs;t+=Math.max(0,frameDt);},
 };
}
export function seatFromBench(worldPos:Vec,yawRad:number){
 const fx=Math.sin(yawRad),fz=Math.cos(yawRad);
 const foot:Vec=[worldPos[0],worldPos[1]-0.45,worldPos[2]];
 return {position:worldPos,back:[worldPos[0]-fx,worldPos[1],worldPos[2]-fz] as Vec,yawRad,seatedFoot:foot,standingFoot:[foot[0]+fx*0.4,foot[1],foot[2]+fz*0.4] as Vec,seatedControllerRoot:worldPos,standingControllerRoot:[worldPos[0]+fx*0.4,worldPos[1],worldPos[2]+fz*0.4] as Vec};
}
/** After sit_hold the controller does not rewrite worldPosition, so the bench child keeps its local offset. */
export function parentingErrorM(movedM:number,local:Vec=[0,0.02,0]):number{
 const child:Vec=[local[0],local[1],movedM+local[2]];
 const expected:Vec=[local[0],local[1],movedM+local[2]];
 return dist(child,expected);
}

export const BALLOON_CAM_SMOOTH_S=0.5;
/** Narrowest supported portrait aspect (360×780 / 390×844); the correction is screen-independent. */
const BALLOON_MIN_ASPECT=0.46,BALLOON_KEEP_NDC=0.40,BALLOON_HER_Y=0.95;
function softExcess(x:number,lim:number,k:number):number{const e=Math.abs(x)-lim;const s=e>6*k?e:k*Math.log1p(Math.exp(e/k));return Math.sign(x)*s;}
/**
 * b16 item 5: turn the aim towards her basket just enough that her centre stays within ±BALLOON_KEEP_NDC (box right edge ≤ 80 %),
 * softly (C1). Position untouched, so the route and reveal stay as authored.
 */
export function balloonKeepInFrame(pose:Pose,basket:Vec):Pose{
 const p=pose.position,her:Vec=[basket[0],basket[1]+BALLOON_HER_Y,basket[2]];
 let f:Vec=[pose.target[0]-p[0],pose.target[1]-p[1],pose.target[2]-p[2]];const dist=Math.hypot(f[0],f[1],f[2])||1;f=[f[0]/dist,f[1]/dist,f[2]/dist];
 const th=Math.tan((pose.fovVerticalDeg||48)*Math.PI/360),thx=th*BALLOON_MIN_ASPECT;
 const yawOf=(v:Vec)=>Math.atan2(v[0],v[2]),pitchOf=(v:Vec)=>Math.atan2(v[1],Math.hypot(v[0],v[2]));
 const h:Vec=[her[0]-p[0],her[1]-p[1],her[2]-p[2]];
 let dy=yawOf(h)-yawOf(f);while(dy>Math.PI)dy-=2*Math.PI;while(dy<-Math.PI)dy+=2*Math.PI;
 const dp=pitchOf(h)-pitchOf(f);
 const limY=Math.atan(BALLOON_KEEP_NDC*thx),limP=Math.atan(0.7*th);
 const cy=softExcess(dy,limY,0.02),cp=softExcess(dp,limP,0.02);
 const yaw=yawOf(f)+cy,pitch=pitchOf(f)+cp,cpch=Math.cos(pitch);
 return {position:p,target:[p[0]+Math.sin(yaw)*cpch*dist,p[1]+Math.sin(pitch)*dist,p[2]+Math.cos(yaw)*cpch*dist],fovVerticalDeg:pose.fovVerticalDeg};
}
/** b19: she rides SEATED (chest ≈ floor+0.75, rim ≈ floor+1.0). Raise the lens (position only, soft-max) so it sees her chest over the
 *  rim from ≥ BALLOON_SEATED_ELEV_DEG; no change where the authored lens is already higher (most of the flight). */
export const BALLOON_SEATED_CHEST_M=0.75,BALLOON_SEATED_ELEV_DEG=40;
export function balloonSeatedLift(pose:Pose,basket:Vec):Pose{const p=pose.position,d=Math.hypot(p[0]-basket[0],p[2]-basket[2]);
 const need=basket[1]+BALLOON_SEATED_CHEST_M+d*Math.tan(BALLOON_SEATED_ELEV_DEG*Math.PI/180),k=0.25,e=need-p[1];
 const lift=e>6*k?e:k*Math.log1p(Math.exp(e/k));if(lift<1e-4)return pose;return {position:[p[0],p[1]+lift,p[2]],target:[pose.target[0],pose.target[1]+lift*0.5,pose.target[2]],fovVerticalDeg:pose.fovVerticalDeg};}
/** Balloon meadow → sky city (§10). Pose is the shared WorldFlowCore camera pose already imported above. */
export type Beat={id:string;t0:number;t1:number};
export type VehicleSample={pos:Vec;yaw:number;roll:number};
export type Screen={w:number;h:number};
/** Meadow ground (terrain), not the windmill blade tip. +40 m is the §10 cap; see STATUS. */
export const BALLOON_LIFT_M=REGION_JOURNEY_LAYOUT.balloonSkyOffset.liftM;
export const BALLOON_RANGE_M=REGION_JOURNEY_LAYOUT.balloonSkyOffset.rangeM;
export const BALLOON_GROUND_CLEAR_M=REGION_JOURNEY_LAYOUT.balloonSkyOffset.groundClearM;
const balloonSmoother=(u:number)=>{const x=Math.max(0,Math.min(1,u));return x*x*x*(x*(x*6-15)+10);};
const balloonLerp=(a:Vec,b:Vec,t:number):Vec=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];
export const rotY=(deg:number,p:Vec):Vec=>{const t=deg*Math.PI/180,c=Math.cos(t),s=Math.sin(t);return [c*p[0]+s*p[2],p[1],-s*p[0]+c*p[2]];};
const add=(a:Vec,b:Vec):Vec=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const sub=(a:Vec,b:Vec):Vec=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const hypot2=(x:number,z:number)=>Math.hypot(x,z)||1;
/** Fixed beats. B-a / B-h shrink to the walked distance, never past these caps. Board blend is the last 0.8 s. */
export const BALLOON_CAP={a:7.6,b:1.8,c:4,d:8,e:5,f:3,g:1,h:7.2,board:0.8,limit:38.9} as const;
export type BalloonPlan={
 beats:Beat[];
 total:number;
 build05S:number;
 yawDeg:number;
 origin:Vec;
 s0:Vec;
 launch:Vec;
 court:Vec;
 cloudY:number;
 cloudAt:Vec;
 samples:Vec[];
 camera:(t:number,screen?:Screen)=>Pose;
 vehicle:(t:number)=>VehicleSample;
 routeAt:(t:number)=>Vec;
 /** Rock strata / island body: hidden until city-on, then shown until close land approach. */
 strataHideUntil:number;
 /** Hide rock belly + vines from this time so the land lens does not clip (06 only). */
 strataOffAt:number;
 /** Sky city mesh stays inactive until the cloud seam (11.6 s). */
 cityActiveAt:number;
 /** Meadow mesh is inactive from this time (11.2 s), before the city turns on. */
 meadowOffAt:number;
 grassOffAt:number;
 accelPeak:number;
 climbDeg:number;
 clearRadiusM:number;
};
function yawOf(from:Vec,to:Vec):number{return Math.atan2(to[0]-from[0],to[2]-from[2]);}
function balloonHeading(yaw:number):[number,number]{return [Math.sin(yaw),Math.cos(yaw)];}
/** City yaw so the lawn (S0 − court, local) faces back toward M6. Cocos Y matches RegionJourneyLayout's rotY. */
export function balloonCityPlacement(m6:Vec,s0Local:Vec,courtLocal:Vec,lift=BALLOON_LIFT_M,range=BALLOON_RANGE_M):{yawDeg:number;origin:Vec;s0:Vec;court:Vec}{
 const approach:[number,number]=[0,1];
 const s0:Vec=[m6[0]+approach[0]*range,m6[1]+lift+(s0Local[1]-courtLocal[1]),m6[2]+approach[1]*range];
 const worldOut:Vec=[-approach[0],0,-approach[1]];
 const lx=s0Local[0]-courtLocal[0],lz=s0Local[2]-courtLocal[2],lh=hypot2(lx,lz);
 const localHeading=Math.atan2(lx/lh,lz/lh),worldHeading=Math.atan2(worldOut[0],worldOut[2]);
 let yawDeg=(worldHeading-localHeading)*180/Math.PI;while(yawDeg>180)yawDeg-=360;while(yawDeg<-180)yawDeg+=360;
 const spun=rotY(yawDeg,s0Local);
 const origin:Vec=[s0[0]-spun[0],s0[1]-s0Local[1],s0[2]-spun[2]];
 const courtSpun=rotY(yawDeg,courtLocal);
 const court:Vec=[origin[0]+courtSpun[0],origin[1]+courtLocal[1],origin[2]+courtSpun[2]];
 return {yawDeg,origin,s0,court};
}
/** Landing 6 m from the lawn node toward the court, so S0→S1 stays ≤ 9.6 m (§10.2). */
export function balloonTouchdown(s0Local:Vec,courtLocal:Vec):Vec{
 const d=sub(courtLocal,s0Local),h=Math.hypot(d[0],d[2])||1,step=Math.min(6,h-1);
 return [s0Local[0]+d[0]/h*step,s0Local[1]+d[1]/h*step,s0Local[2]+d[2]/h*step];
}
function pushOutside(p:Vec,court:Vec,s0:Vec,radius:number):Vec{
 const dx=p[0]-court[0],dz=p[2]-court[2],dist=Math.hypot(dx,dz);
 const nearPad=Math.hypot(p[0]-s0[0],p[2]-s0[2])<10&&p[1]>=s0[1]-1;
 if(nearPad||dist>=radius||dist<1e-4)return p;
 const k=radius/dist;return [court[0]+dx*k,p[1],court[2]+dz*k];
}
function polyline(pts:Vec[],step=0.5):Vec[]{
 const out:Vec[]=[pts[0]];
 for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i],l=Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2]);
  const n=Math.max(1,Math.ceil(l/step));for(let k=1;k<=n;k++)out.push(balloonLerp(a,b,k/n));}
 return out;
}
function catmull(pts:Vec[],step=0.5):Vec[]{
 if(pts.length<2)return pts.slice();
 const p=(i:number)=>pts[Math.max(0,Math.min(pts.length-1,i))];
 const out:Vec[]=[pts[0]];
 for(let i=0;i<pts.length-1;i++){const p0=p(i-1),p1=p(i),p2=p(i+1),p3=p(i+2);
  const chord=Math.hypot(p2[0]-p1[0],p2[1]-p1[1],p2[2]-p1[2]);
  const n=Math.max(2,Math.ceil(chord/step));
  for(let k=1;k<=n;k++){const t=k/n,t2=t*t,t3=t2*t;
   const c=(a:number,b:number,c0:number,d:number)=>0.5*((2*b)+(-a+c0)*t+(2*a-5*b+4*c0-d)*t2+(-a+3*b-3*c0+d)*t3);
   out.push([c(p0[0],p1[0],p2[0],p3[0]),c(p0[1],p1[1],p2[1],p3[1]),c(p0[2],p1[2],p2[2],p3[2])]);}}
 return out;
}
function trapDistance(length:number,duration:number,aMax:number):(u:number)=>number{
 if(!(length>0)||!(duration>0))return ()=>0;
 const disc=aMax*duration*aMax*duration-4*aMax*length;
 const v=disc>0?Math.min(aMax*duration/2,(aMax*duration-Math.sqrt(disc))/2):aMax*duration/2;
 const ramp=Math.min(duration/2,v/aMax),cruise=Math.max(0,duration-2*ramp),peak=ramp>0?Math.min(v,aMax*ramp):0;
 const s=(t:number)=>{const x=Math.max(0,Math.min(duration,t));
  if(x<=ramp)return 0.5*aMax*x*x;
  if(x<=ramp+cruise)return 0.5*aMax*ramp*ramp+peak*(x-ramp);
  const d=x-(ramp+cruise);return 0.5*aMax*ramp*ramp+peak*cruise+peak*d-0.5*aMax*d*d;};
 const end=s(duration)||1;return u=>Math.max(0,Math.min(1,s(u*duration)/end));
}
function accelOf(fn:(t:number)=>Vec,t0:number,t1:number):number{
 let peak=0;const dt=0.2;for(let t=t0+dt;t<t1-dt;t+=0.05){const a=fn(t-dt),b=fn(t),c=fn(t+dt);
  const v1=Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2])/dt,v2=Math.hypot(c[0]-b[0],c[1]-b[1],c[2]-b[2])/dt;
  peak=Math.max(peak,Math.abs(v2-v1)/dt);}
 return peak;
}
function climbAngle(a:Vec,b:Vec):number{const h=Math.hypot(b[0]-a[0],b[2]-a[2]),dy=b[1]-a[1];return Math.atan2(dy,h)*180/Math.PI;}
export function balloonBeats(m6:Vec,s0Local:Vec,courtLocal:Vec,opts?:{launch?:Vec;walkInM?:number;walkOutM?:number;clearRadiusM?:number;strataLocalMinY?:number;meadowGroundMaxY?:number;cityFrame?:Rigid;meadowFrame?:Rigid}):BalloonPlan{
 const doc=flightDocument();
 const meadow=opts?.meadowFrame??meadowFrameFromM6(m6);
 const game:Rigid=opts?.cityFrame??artCityInMeadow(meadow);
 const map=(p:Vec,t:number,frame?:'meadow'|'world')=>mapFlightPoint(p,t,meadow,game,frame);
 const art=doc.beats.map(b=>({id:b.id.slice(0,3),t0:b.t0,t1:b.t1}));
 const beats:Beat[]=[{id:'B-a',t0:0,t1:0},...art,{id:'B-h',t0:FLIGHT_DURATION,t1:FLIGHT_DURATION},{id:'board',t0:FLIGHT_DURATION,t1:FLIGHT_DURATION}];
 const local=(time:number)=>sampleFlight(doc,time);
 const worldAt=(time:number):Vec=>{const s=local(time);return map(s.pos,time,s.frame);};
 const launch=map(doc.layout.takeoff,0,'meadow');
 const s0:Vec=doc.seam?.landing?.S0_game_world?([doc.seam.landing.S0_game_world[0],doc.seam.landing.S0_game_world[1],doc.seam.landing.S0_game_world[2]] as Vec):S0_GAME;
 const court=applyRigid(game,courtLocal);
 const vehicle=(time:number):VehicleSample=>{
  const s=local(time);const world=s.frame==='world'||time+1e-9>=SEAM_T;
  // Meadow keys are meadow-local; world yaw = Mw.yaw + key.yaw so the seam relative pose matches world keys.
  const yawDeg=world?s.yawDeg:meadow.yawDeg+s.yawDeg;
  return {pos:map(s.pos,time,s.frame),yaw:yawDeg*Math.PI/180,roll:s.rollDeg};
 };
 const rawCam=(time:number):Pose=>{const s=local(time);return {position:map(s.cam,time,s.frame),target:map(s.camLook,time,s.frame),fovVerticalDeg:48};};
 // b16 item 5: the 10 Hz keys are linearly interpolated, so every key is a velocity step (B-d |a| 142 m/s²). Smooth on the camera
 // side: a triangular window (±BALLOON_CAM_SMOOTH_S, = two box passes ≈ quadratic B-spline) inside each continuous segment
 // (never across the coordinate seam), then keep her basket inside the frame (balloonKeepInFrame). The flight file is unchanged.
 // Seam re-root as a rigid map (pre ↔ post world), from the vehicle on both sides, so the window may cross the seam.
 const vPre=vehicle(SEAM_T-1e-4),vPost=vehicle(SEAM_T),dYawDeg=(vPost.yaw-vPre.yaw)*180/Math.PI;
 const toSide=(x:Vec,fromPre:boolean,toPre:boolean):Vec=>{if(fromPre===toPre)return x;
  if(fromPre){const r=rotY(dYawDeg,[x[0]-vPre.pos[0],x[1]-vPre.pos[1],x[2]-vPre.pos[2]]);return [r[0]+vPost.pos[0],r[1]+vPost.pos[1],r[2]+vPost.pos[2]];}
  const r=rotY(-dYawDeg,[x[0]-vPost.pos[0],x[1]-vPost.pos[1],x[2]-vPost.pos[2]]);return [r[0]+vPre.pos[0],r[1]+vPre.pos[1],r[2]+vPre.pos[2]];};
 const camera=(time:number,_screen?:Screen):Pose=>{
  const pre=time<SEAM_T,edge=Math.min(time,FLIGHT_DURATION-time);
  const P:Vec=[0,0,0],Q:Vec=[0,0,0];let W=0;const N=8,h=BALLOON_CAM_SMOOTH_S*smoother(Math.max(0,edge)/(2*BALLOON_CAM_SMOOTH_S));
  for(let k=-N;k<=N;k++){const w=N+1-Math.abs(k),tt=Math.max(0,Math.min(FLIGHT_DURATION,time+k*h/N)),c=rawCam(tt),sp=tt<SEAM_T;
   const cp=toSide(c.position,sp,pre),ct=toSide(c.target,sp,pre);for(let j=0;j<3;j++){P[j]+=cp[j]*w;Q[j]+=ct[j]*w;}W+=w;}
  const pose:Pose={position:[P[0]/W,P[1]/W,P[2]/W],target:[Q[0]/W,Q[1]/W,Q[2]/W],fovVerticalDeg:48};
  const vp=vehicle(time).pos;return balloonKeepInFrame(balloonSeatedLift(pose,vp),vp);
 };
 const routeAt=(time:number)=>worldAt(Math.max(0,Math.min(FLIGHT_DURATION,time)));
 const deck=doc.layout.cloudDeckY,deckMid=(deck[0]+deck[1])/2;
 const cloudAt=map(local(4.3).pos,4.3,local(4.3).frame);
 const climbDeg=doc.layout.climbDeg;
 // Accel on continuous segments only — never across the coordinate seam.
 const accelPeak=Math.max(accelOf(t=>sampleFlight(doc,t).pos,1.8,SEAM_T-0.05),accelOf(t=>sampleFlight(doc,t).pos,SEAM_T,LAND_T));
 const samples=[launch,map(doc.layout.liftoffTop,5.8,'meadow'),applyRigid(postSeamFrame(doc),doc.layout.climbEnd),s0];
 return {beats,total:FLIGHT_DURATION,build05S:FLIGHT_DURATION,yawDeg:game.yawDeg,origin:game.origin,s0,launch,court,cloudY:map([0,deckMid,0],0,'meadow')[1],cloudAt,samples,camera,vehicle,routeAt,strataHideUntil:CITY_ON_T,strataOffAt:STRATA_OFF_T,cityActiveAt:CITY_ON_T,meadowOffAt:MEADOW_OFF_T,grassOffAt:GRASS_OFF_T,accelPeak,climbDeg,clearRadiusM:opts?.clearRadiusM??18};
}
export function strataClearsGround(originY:number,strataLocalMinY:number,meadowGroundMaxY:number,margin=BALLOON_GROUND_CLEAR_M):{ymin:number;need:number;ok:boolean}{
 const ymin=originY+strataLocalMinY,need=meadowGroundMaxY+margin;return {ymin,need,ok:ymin>need};
}
/** Seconds of foreground time. A hidden gap does not advance `t`. Gaps over 30 s request a 0.35 s fade on resume. */
/** Down-sampled balloon route. path[0] is the standing root the journey was prepared from. */
export function balloonRoutePoints(start:Vec,plan:BalloonPlan):Vec[]{
 const out:Vec[]=[start];
 const push=(p:Vec)=>{const q=out[out.length-1];if(Math.hypot(p[0]-q[0],p[1]-q[1],p[2]-q[2])>1.25)out.push([p[0],p[1],p[2]]);};
 const end=plan.beats[plan.beats.length-1].t1;
 for(let t=0;t<=end;t+=0.35)push(plan.routeAt(t));
 push(plan.s0);
 return out.length>1?out:[start,plan.s0];
}
export function stepTransitClock(state:{t:number;hiddenFor:number;fade:number},dt:number,hidden:boolean):{t:number;hiddenFor:number;fade:number;jumped:boolean}{
 if(hidden)return {t:state.t,hiddenFor:state.hiddenFor+Math.max(0,dt),fade:state.fade,jumped:false};
 const resumed=state.hiddenFor>30;return {t:state.t+Math.max(0,Math.min(dt,0.1)),hiddenFor:0,fade:resumed?0.35:Math.max(0,state.fade-Math.max(0,dt)),jumped:false};
}

