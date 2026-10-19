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
/** Cruise speed that covers `length` with a 2 s ease-in and a 2.2 s ease-out. */
export function sailSpeed(length:number,cruiseS=9):SailSpeed{
 const accelS=2,decelS=2.2,cap=4.4;
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
/** Real seconds → sail timeline. The hull stays before S-c until `departAt` (she has finished sitting). Motion is compressed into `motionBudget` so the walk itself is never sped up. */
export function sailPresentationT(real:number,departAt:number|null,motionStart:number,motionEnd:number,buildEnd:number,motionBudget:number):number{
 if(departAt==null)return Math.min(Math.max(0,real),Math.max(0,motionStart-1e-4));
 const motionS=Math.max(1e-3,motionEnd-motionStart);
 const budget=Math.max(0.4,motionBudget);
 const rate=motionS/Math.min(motionS,budget);
 const since=Math.max(0,real-departAt);
 const motionReal=Math.min(motionS,budget);
 if(since<=motionReal+1e-6)return Math.min(motionEnd,motionStart+since*rate);
 return Math.min(buildEnd,motionEnd+(since-motionReal));
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
const K2:SailOff={back:-11,side:-1,up:5.2,fov:52,look:-6,orb:0};
/** Beam on her port side, so the swing off the bow does not look through the sail. */
const Kbeam:SailOff={back:0.8,side:10.2,up:5.1,fov:52,look:0.2,orb:0};
/**
 * Far-sea K3 (day) / K7 (night still). r5-sail-farsea: astern, a little to starboard, lower, aimed 3 m ahead
 * so the meadow windmill (≈80 m ahead, port of the heading) sits whole in the upper third above her.
 * fov stays 52 so the K7 star still keeps its pixel size.
 * Old (sail-k2k7): {back:8.2,side:7.8,up:5.0,fov:52,look:0.2}, port quarter, windmill ~6 ndc off the left edge.
 * Rollback: restore that line and SAIL_K3_IN back to 0.24.
 */
const K3:SailOff={back:10.5,side:-2,up:4.4,fov:52,look:3,orb:0};
/** S-d u where the Kbeam→K3 arc ends and the K3 hold starts (was 0.24). The arc is ~96° now (was ~42°), so it gets 1.62 s; the K3 hold is 1.08 s (S-d u 0.30–0.42). */
export const SAIL_K3_IN=0.30;
export const SAIL_K3_OUT=0.42;
/** Stay in the channel. side 5.2 put the lens inside rm_bank_left once the boat reaches the mouth. */
const K4:SailOff={back:9.2,side:1.05,up:6.2,fov:50,look:2.4,orb:0};
/** Channel centre: boat x≈−4.4, side≈0.9 → camera x≈−3.5, between the inner banks. */
const K5:SailOff={back:10.2,side:0.92,up:7.6,fov:48,look:2.2,orb:0};
/** Same channel, a little closer. The old side 4.2 still sat in the left bank. */
const K6:SailOff={back:8.4,side:0.85,up:6.8,fov:48,look:2.8,orb:0};
/** Blend on a constant-radius arc. A straight lerp from ahead of the bow to astern crosses the hull and guardOff then teleports. */
function orbitMix(a:SailOff,b:SailOff,u:number):SailOff{
 const s=smoother(u);
 let ang=Math.atan2(a.side,a.back),bng=Math.atan2(b.side,b.back),d=bng-ang;
 while(d>Math.PI)d-=Math.PI*2;while(d<-Math.PI)d+=Math.PI*2;
 const th=ang+d*s,r=lerp(Math.hypot(a.back,a.side),Math.hypot(b.back,b.side),s);
 return {back:Math.cos(th)*r,side:Math.sin(th)*r,up:lerp(a.up,b.up,s),fov:lerp(a.fov,b.fov,s),look:lerp(a.look,b.look,s),orb:lerp(a.orb,b.orb,s)};
}
/** Keep the lens outside the 4.2 m hull. A straight blend from astern to ahead would cross the mast. */
function guardOff(o:SailOff):SailOff{const r=Math.hypot(o.back,o.side);if(r>=7.2)return o;const k=7.2/Math.max(1e-3,r);return {...o,back:o.back*k,side:o.side*k};}
function sailOffset(b:SailBeat,t:number):SailOff{
 const u=(t-b.t0)/Math.max(1e-3,b.t1-b.t0);
 if(b.id==='S-a'||b.id==='S-b')return K1;
 if(b.id==='S-c')return u>=0.9?K2:orbitMix(K1,K2,u/0.9);
 if(b.id==='S-d'){
  if(u<0.12)return orbitMix(K2,Kbeam,u/0.12);
  if(u<SAIL_K3_IN)return orbitMix(Kbeam,K3,(u-0.12)/(SAIL_K3_IN-0.12));
  if(u<SAIL_K3_OUT)return K3;
  if(u<0.56)return orbitMix(K3,K4,(u-SAIL_K3_OUT)/(0.56-SAIL_K3_OUT));
  if(u<0.64)return K4;
  if(u<0.82)return orbitMix(K4,K5,(u-0.64)/0.18);
  return K5;
 }
 if(b.id==='S-e')return u<0.62?K5:orbitMix(K5,K6,(u-0.62)/0.38);
 return K6;
}
/** K1–K7 in the boat frame (README §5), held outside the hull. Positive side is port (+X, her left). */
export function sailCamera(tl:SailTimeline,route:readonly Vec[],t:number,screen:SailScreen={w:390,h:844}):Pose{
 const v=sailVehicle(tl,route,t),b=beatAt(tl,t);
 let o=guardOff(sailOffset(b,t));
 if(b.id==='S-d'&&o.orb>8){
  if(screen.h<=520||(screen.w===375&&screen.h===667))o={...o,up:o.up+0.6};
  if(screen.w===768&&screen.h===1024)o={...o,back:o.back-(o.back>0?1.5:-1.5)};
 }
 const orb=o.orb*Math.PI/180;
 const pyaw=v.yaw+orb,fx=Math.sin(pyaw),fz=Math.cos(pyaw),rx=fz,rz=-fx;
 const pos:Vec=[v.pos[0]-fx*o.back+rx*o.side,v.pos[1]+o.up,v.pos[2]-fz*o.back+rz*o.side];
 const look=o.look;
 return {position:pos,target:[v.pos[0]+fx*look,v.pos[1]+1.05,v.pos[2]+fz*look],fovVerticalDeg:o.fov};
}
/** Shore walk lens. `state.yaw` eases toward the path heading so a corner does not snap the camera. */
export function sailFollowCamera(path:readonly Vec[],u:number,from:Pose,to:Pose,state:{yaw:number|null}):Pose{
 const s=smoother(Math.min(1,Math.max(0,u)));
 let L=0;for(let i=1;i<path.length;i++)L+=dist(path[i-1],path[i]);
 let left=L*Math.min(1,Math.max(0,u)),at=path[0]||[0,0,0],seg=0;
 for(let i=1;i<path.length;i++){
  const d=dist(path[i-1],path[i]);
  const h=Math.atan2(path[i][0]-path[i-1][0],path[i][2]-path[i-1][2]);
  if(d>0&&left<=d){const k=left/d;at=[lerp(path[i-1][0],path[i][0],k),lerp(path[i-1][1],path[i][1],k),lerp(path[i-1][2],path[i][2],k)];seg=h;break;}
  left-=d;at=path[i];seg=h;
 }
 if(state.yaw==null)state.yaw=seg;
 else{
  let d=seg-state.yaw;while(d>Math.PI)d-=Math.PI*2;while(d<-Math.PI)d+=Math.PI*2;
  const max=2.5*Math.PI/180;
  state.yaw+=Math.max(-max,Math.min(max,d));
 }
 const yaw=state.yaw,back=4.8,side=1.35,up=3.3;
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
 const camera=(time:number,_screen?:Screen):Pose=>{const s=local(time);return {position:map(s.cam,time,s.frame),target:map(s.camLook,time,s.frame),fovVerticalDeg:48};};
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

