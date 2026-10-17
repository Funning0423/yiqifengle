import type {Vec} from '../world-r1/WorldFlowCore';
import {REGION_JOURNEY_LAYOUT} from './RegionJourneyLayout';
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
 /** Rock strata stay hidden until she is on the lawn (B-h), so the belly never enters the frame. */
 strataHideUntil:number;
 /** Sky city mesh stays inactive until B-e. */
 cityActiveAt:number;
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
export function balloonBeats(m6:Vec,s0Local:Vec,courtLocal:Vec,opts?:{launch?:Vec;walkInM?:number;walkOutM?:number;clearRadiusM?:number;strataLocalMinY?:number;meadowGroundMaxY?:number}):BalloonPlan{
 const touch=balloonTouchdown(s0Local,courtLocal);
 const placed=balloonCityPlacement(m6,touch,courtLocal);
 const launch=opts?.launch??[m6[0]+8,m6[1],m6[2]+3];
 const s0=placed.s0,court=placed.court,radius=opts?.clearRadiusM??18;
 const cruiseY=s0[1]+3,up:Vec=[launch[0],launch[1]+8,launch[2]];
 const rise=Math.max(1,cruiseY-up[1]),pitch=25*Math.PI/180,horiz=rise/Math.tan(pitch);
 const climbEnd:Vec=[up[0]+horiz,cruiseY,up[2]];
 const before:Vec=[s0[0]-6,cruiseY,s0[2]-20];
 const keys=rounded([launch,up,climbEnd,before,s0],8).filter((p,i,a)=>i===0||Math.hypot(p[0]-a[i-1][0],p[1]-a[i-1][1],p[2]-a[i-1][2])>0.02);
 function rounded(wps:Vec[],r:number):Vec[]{
 if(wps.length<3)return polyline(wps,0.5);
 const out:Vec[]=[wps[0]];
 const nrm=(v:Vec):Vec=>{const l=Math.hypot(v[0],v[1],v[2])||1;return [v[0]/l,v[1]/l,v[2]/l];};
 const cross=(a:Vec,b:Vec):Vec=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
 for(let i=1;i<wps.length-1;i++){const a=wps[i-1],b=wps[i],c=wps[i+1];
  const u1=nrm(sub(b,a)),u2=nrm(sub(c,b));
  const dot=Math.max(-1,Math.min(1,u1[0]*u2[0]+u1[1]*u2[1]+u1[2]*u2[2])),turn=Math.acos(dot);
  const lab=Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2]),lcb=Math.hypot(c[0]-b[0],c[1]-b[1],c[2]-b[2]);
  const cut=turn<1e-3?0:Math.min(lab*0.45,lcb*0.45,r*Math.tan(turn/2));
  const p1:Vec=[b[0]-u1[0]*cut,b[1]-u1[1]*cut,b[2]-u1[2]*cut],p2:Vec=[b[0]+u2[0]*cut,b[1]+u2[1]*cut,b[2]+u2[2]*cut];
  for(const q of polyline([out[out.length-1],p1],0.5).slice(1))out.push(q);
  if(turn<1e-3||cut<1e-3){out.push(p2);continue;}
  const axis=nrm(cross(u1,u2));
  let inward=nrm(cross(axis,u1));
  const centerOf=(dir:Vec):Vec=>[p1[0]+dir[0]*r,p1[1]+dir[1]*r,p1[2]+dir[2]*r];
  const miss=(dir:Vec)=>Math.abs(Math.hypot(p2[0]-centerOf(dir)[0],p2[1]-centerOf(dir)[1],p2[2]-centerOf(dir)[2])-r);
  if(miss([-inward[0],-inward[1],-inward[2]])<miss(inward))inward=[-inward[0],-inward[1],-inward[2]];
  const center=centerOf(inward);
  const startV=sub(p1,center),endV=sub(p2,center);
  const sLen=Math.hypot(startV[0],startV[1],startV[2])||1,eLen=Math.hypot(endV[0],endV[1],endV[2])||1;
  const sN:Vec=[startV[0]/sLen,startV[1]/sLen,startV[2]/sLen],eN:Vec=[endV[0]/eLen,endV[1]/eLen,endV[2]/eLen];
  const side0=nrm(cross(axis,sN));
  const at=(sn:Vec,th:number):Vec=>{const cs=Math.cos(th),s=Math.sin(th);return [center[0]+(sN[0]*cs+sn[0]*s)*r,center[1]+(sN[1]*cs+sn[1]*s)*r,center[2]+(sN[2]*cs+sn[2]*s)*r];};
  const endMiss=(sn:Vec)=>Math.hypot(at(sn,turn)[0]-p2[0],at(sn,turn)[1]-p2[1],at(sn,turn)[2]-p2[2]);
  const side=endMiss([-side0[0],-side0[1],-side0[2]])<endMiss(side0)?[-side0[0],-side0[1],-side0[2]] as Vec:side0;
  const n=Math.max(3,Math.ceil(r*turn/0.4));
  for(let k=1;k<=n;k++)out.push(at(side,turn*k/n));
 }
 for(const q of polyline([out[out.length-1],wps[wps.length-1]],0.5).slice(1))out.push(q);
 return out;
 }
 const aDur=Math.min(BALLOON_CAP.a,Math.max(0,(opts?.walkInM??0)/1.2));
 const hDur=Math.min(BALLOON_CAP.h,Math.max(0.8,(opts?.walkOutM??8.6)/1.2));
 const order:{id:string;d:number}[]=[{id:'B-b',d:BALLOON_CAP.b},{id:'B-c',d:BALLOON_CAP.c},{id:'B-d',d:BALLOON_CAP.d},{id:'B-e',d:BALLOON_CAP.e},{id:'B-f',d:BALLOON_CAP.f},{id:'B-g',d:BALLOON_CAP.g}];
 let t=aDur;const beats:Beat[]=[{id:'B-a',t0:0,t1:aDur}];
 for(const b of order){beats.push({id:b.id,t0:t,t1:t+b.d});t+=b.d;}
 beats.push({id:'B-h',t0:t,t1:t+hDur});t+=hDur;beats.push({id:'board',t0:t,t1:t+BALLOON_CAP.board});
 const by=(id:string)=>beats.find(b=>b.id===id)!;
 const flight0=by('B-c').t0,flight1=by('B-f').t1;
 const pieces=keys;
 const segLen=pieces.slice(1).map((p,i)=>Math.hypot(p[0]-pieces[i][0],p[1]-pieces[i][1],p[2]-pieces[i][2]));
 const totalLen=segLen.reduce((s,n)=>s+n,0)||1;
 const flightU=trapDistance(totalLen,flight1-flight0,1.9);
 const pointAt=(dist:number):Vec=>{let left=Math.max(0,Math.min(totalLen,dist));
  for(let i=0;i<segLen.length;i++){if(!(segLen[i]>1e-4))continue;if(left<=segLen[i]||i===segLen.length-1){const u=Math.max(0,Math.min(1,left/segLen[i]));return lerp(pieces[i],pieces[i+1],u);}left-=segLen[i];}
  return pieces[pieces.length-1];};
 const flightAt=(time:number):Vec=>{if(time<=flight0)return pieces[0];if(time>=flight1)return pieces[pieces.length-1];
  return pointAt(flightU((time-flight0)/(flight1-flight0))*totalLen);};
 const routeAt=(time:number):Vec=>{
  if(time<beats[1].t1)return flightAt(beats[2].t0);
  if(time>=beats[7].t0){const u=smoother((time-beats[7].t0)/((beats[7].t1-beats[7].t0)||1));return lerp(s0,court,Math.min(1,u));}
  return flightAt(time);
 };
 const vehicle=(time:number):VehicleSample=>{
  const pos=time<beats[2].t0?launch:time>beats[6].t1?s0:flightAt(time);
  const ahead=time<beats[2].t0?add(launch,[0,0,1]):flightAt(Math.min(flight1,time+0.15));
  const yaw=yawOf(pos,ahead.length?ahead:add(pos,[0,0,1]));
  const roll=time>=beats[3].t0&&time<=beats[4].t1?Math.sin((time-beats[3].t0)*2*Math.PI/3.2)*3:0;
  return {pos,yaw,roll};
 };
 const cloudY=m6[1]+20;
 let cloudAt=flightAt(beats[3].t0);
 for(let tScan=beats[3].t0;tScan<beats[3].t1;tScan+=0.05){const p=flightAt(tScan);if(p[1]>=cloudY){cloudAt=p;break;}}
 const fovFor=(screen?:Screen)=>screen&&screen.w===320&&screen.h===568?50:48;
 const backFor=(screen?:Screen)=>{let back=9;if(!screen)return back;if((screen.w===390&&screen.h===520)||(screen.w===375&&screen.h===667))back+=1.5;if(screen.w===768&&screen.h===1024)back-=2;return back;};
 const camOf=(eye:Vec,look:Vec,fov:number):Pose=>({position:eye,target:look,fovVerticalDeg:fov});
 const camera=(time:number,screen?:Screen):Pose=>{
  const fov=fovFor(screen),v=vehicle(Math.max(beats[1].t0,Math.min(beats[6].t1,time>=beats[1].t0?time:beats[1].t1)));
  const [hx,hz]=heading(v.yaw),rx=hz,rz=-hx,p=v.pos;
  const eye=(back:number,right:number,upM:number):Vec=>[p[0]-hx*back+rx*right,p[1]+upM,p[2]-hz*back+rz*right];
  // B-b: back 8 m, up ~2.6 m, look at the envelope waist so the basket and the bag both sit in a 48° portrait frame.
  if(time<beats[2].t0)return camOf(eye(8,0.35,2.6),[p[0]+hx*0.4,p[1]+2.7,p[2]+hz*0.4],fov);
  // B-c first 2 s: lens stays at the pad and tilts up as she rises (design: do not follow yet).
  if(time<beats[2].t0+2){const hold=vehicle(beats[2].t0);const [h2,z2]=heading(hold.yaw);const e:Vec=[hold.pos[0]-h2*8,hold.pos[1]+1.8,hold.pos[2]-z2*8];
   return camOf(e,[p[0],p[1]+2.2,p[2]],fov);}
  // Rest of B-c (about 8–12 m up): from behind and above, look back at the pad so grass and the windmill stay under her.
  if(time<beats[3].t0)return camOf(eye(11,1.6,6.2),[launch[0],launch[1]+0.8,launch[2]],fov);
  // B-d: side-rear, lens above the cloud plane. Look slightly down so the meadow stays in the lower frame; the bag stays centered.
  if(time<beats[4].t0){const back=backFor(screen);let upM=3.4;const eyeY=p[1]+upM;if(Math.abs(eyeY-cloudY)<1.35)upM=eyeY<cloudY?cloudY-p[1]-1.35:cloudY-p[1]+1.35;return camOf(eye(back,2.4,upM),[p[0]+hx*1.5,p[1]+1.4,p[2]+hz*1.5],fov);}
  // B-e: high and to the side, looking down onto the court so the island reads as a whole above the cloud sea.
  if(time<beats[5].t0)return camOf(eye(20,12,18),[court[0],court[1]+12,court[2]],fov);
  return camOf(eye(6.6,2.4,3.4),[p[0]+hx*1.2,p[1]+2.4,p[2]+hz*1.2],fov);
 };
 const samples=pieces;
 const accelPeak=accelOf(flightAt,flight0,flight1);
 const climbDeg=climbAngle(up,climbEnd);
 const total=beats[beats.length-1].t1;
 return {beats,total,build05S:total,yawDeg:placed.yawDeg,origin:placed.origin,s0,launch,court,cloudY,cloudAt,samples,camera,vehicle,routeAt,strataHideUntil:beats.find(b=>b.id==='B-h')!.t0,cityActiveAt:beats[4].t0,grassOffAt:beats[2].t0+2,accelPeak,climbDeg,clearRadiusM:radius};
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
 push(plan.court);
 return out.length>1?out:[start,plan.court];
}
export function stepTransitClock(state:{t:number;hiddenFor:number;fade:number},dt:number,hidden:boolean):{t:number;hiddenFor:number;fade:number;jumped:boolean}{
 if(hidden)return {t:state.t,hiddenFor:state.hiddenFor+Math.max(0,dt),fade:state.fade,jumped:false};
 const resumed=state.hiddenFor>30;return {t:state.t+Math.max(0,Math.min(dt,0.1)),hiddenFor:0,fade:resumed?0.35:Math.max(0,state.fade-Math.max(0,dt)),jumped:false};
}
