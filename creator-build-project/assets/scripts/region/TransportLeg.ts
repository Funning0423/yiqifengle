import type {Vec} from '../world-r1/WorldFlowCore';
import {REGION_JOURNEY_LAYOUT} from './RegionJourneyLayout';
import {CITY_ON_T, FLIGHT_DURATION, GRASS_OFF_T, LAND_T, MEADOW_OFF_T, S0_GAME, SEAM_T, STRATA_OFF_T, applyRigid, artCityInMeadow, flightDocument, mapFlightPoint, meadowFrameFromM6, postSeamFrame, sampleFlight, type Rigid} from './BalloonFlight';
/** Balloon meadow → sky city (§10). Pure: no engine imports. Sail beats live on the sail branch;
 * this file still exports the shared return shape so a later merge can add sailBeats beside balloonBeats. */
export type Pose={position:Vec;target:Vec;fovVerticalDeg:number};
export type Beat={id:string;t0:number;t1:number};
export type VehicleSample={pos:Vec;yaw:number;roll:number};
export type Screen={w:number;h:number};
/** Meadow ground (terrain), not the windmill blade tip. +40 m is the §10 cap; see STATUS. */
export const BALLOON_LIFT_M=REGION_JOURNEY_LAYOUT.balloonSkyOffset.liftM;
export const BALLOON_RANGE_M=REGION_JOURNEY_LAYOUT.balloonSkyOffset.rangeM;
export const BALLOON_GROUND_CLEAR_M=REGION_JOURNEY_LAYOUT.balloonSkyOffset.groundClearM;
const smoother=(u:number)=>{const x=Math.max(0,Math.min(1,u));return x*x*x*(x*(x*6-15)+10);};
const lerp=(a:Vec,b:Vec,t:number):Vec=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];
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
function heading(yaw:number):[number,number]{return [Math.sin(yaw),Math.cos(yaw)];}
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
  const n=Math.max(1,Math.ceil(l/step));for(let k=1;k<=n;k++)out.push(lerp(a,b,k/n));}
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
