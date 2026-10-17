import type {Pose, Vec} from '../world-r1/WorldFlowCore';
import {REGION_JOURNEY_LAYOUT} from './RegionJourneyLayout';
import {meadowLocalToWorld, SAIL_LANDING_BERTH_LOCAL, sailArrivalWalkM} from './SailLanding';
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
 const bob=t>=tl.beats[1].t0&&t<sc.t0?Math.sin(t*2)*0.02:0;
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
/** Starboard and ahead, looking back: hull + seated girl in frame with a readable wake. */
const K2:SailOff={back:-8.6,side:-4.4,up:3.0,fov:52,look:-7.2,orb:0};
const K3:SailOff={back:10,side:2.4,up:4.5,fov:52,look:0,orb:15};
const K4:SailOff={back:8.8,side:-1.15,up:3.6,fov:50,look:6.2,orb:0};
const K5:SailOff={back:6.6,side:-2.4,up:3.4,fov:48,look:4.2,orb:0};
/** Art K6: berth +(3.15,4.5,−6.4) look +(1.15,0.9,4.5). Jetty is port (+X); boat on the right of frame. */
const K6:SailOff={back:6.4,side:3.15,up:4.5,fov:48,look:4.5,orb:0};
const mixOff=(a:SailOff,b:SailOff,u:number):SailOff=>{const s=smoother(u);return {back:lerp(a.back,b.back,s),side:lerp(a.side,b.side,s),up:lerp(a.up,b.up,s),fov:lerp(a.fov,b.fov,s),look:lerp(a.look,b.look,s),orb:lerp(a.orb,b.orb,s)};};
/** Keep the lens outside the 4.2 m hull. A straight blend from astern to ahead would cross the mast. */
function guardOff(o:SailOff):SailOff{const r=Math.hypot(o.back,o.side);if(r>=7.2)return o;const k=7.2/Math.max(1e-3,r);return {...o,back:o.back*k,side:o.side*k};}
function sailOffset(b:SailBeat,t:number):SailOff{
 const u=(t-b.t0)/Math.max(1e-3,b.t1-b.t0);
 if(b.id==='S-a'||b.id==='S-b')return K1;
 if(b.id==='S-c')return mixOff(K1,K2,u);
 if(b.id==='S-d'){
  if(u<0.18)return mixOff(K2,K3,u/0.18);
  if(u<0.42)return K3;
  if(u<0.52)return mixOff(K3,K4,(u-0.42)/0.10);
  if(u<0.60)return K4;
  if(u<0.66)return mixOff(K4,K5,(u-0.60)/0.06);
  return K5;
 }
 if(b.id==='S-e')return K5;
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
