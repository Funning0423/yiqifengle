/** Segment 6 (skycity → lakeside) without the WindWipe boarding cover (Grok Bot 2026-10-25). Camera only, pure (no cc).
 *  Entry: T-02's continuation hook (TransitionCamera.onShotContinue) hands over the end-of-shot CamState.
 *  Timeline on the segment clock τ:
 *   C1 walk    [0, walkS)                 T-03 walk lens (LakesideBalloon ride.camera, its own start blend from the T-02 pose)
 *   C1 board   [walkS, walkS+boardS)      door open → step in → ignition: min-jerk blend walk-end lens → liftoff lens (PLACEHOLDER beats)
 *   lift-off   [flightAt, flightAt+liftS) the 18 s of flight T-03 skipped under black, shown time-compressed (eased C1 warp)
 *   flight     [.., touchdownAt)          T-03's 12 s visible flight, BIT-IDENTICAL (lakesideDoorRideCamera on ride time t ≥ cutT)
 *   C2         touchdownAt →              ride time t = R.T + (τ − touchdownAt): door hold, LAKESIDE_TOUCHDOWN sign/board timing unchanged
 *  rideT(τ) gives GGbot the T-03 ride time to drive basket, her and the adapter's touchdown logic (no state change of its own). */
import type {Pose,Vec} from '../world-r1/WorldFlowCore';
import {lakesideDoorRideCamera,type LakesideBalloonRide} from './LakesideBalloon';
import {blendPose,minJerk} from './TransitionCamera';
import {TRANSITION_DURATIONS} from './TransitionStaging';
export const SKY_LAKE_CONT=Object.freeze({
 /** PLACEHOLDER beats until 场景设计部 / GGbot animation timings arrive: door open, step in, ignition */
 /* b19: real beats from TRANSITION_DURATIONS.seg5a; ignition/inflation runs during the walk (GGbot compress) → 0 here */
 doorS:TRANSITION_DURATIONS.seg5a.doorReach as number,stepInS:(TRANSITION_DURATIONS.seg5a.intoBasket+TRANSITION_DURATIONS.seg5a.turn180+TRANSITION_DURATIONS.seg5a.sitDown) as number,igniteS:0,
 /** seconds of screen time that show the 18 s lift-off T-03 skipped (searched: least value meeting the yaw caps, see test) */
 liftS:TRANSITION_DURATIONS.seg5a.liftoff as number,
 /** smoothstep rate ramps inside the lift-off window (start and end of the window are at rate 1 → no velocity step) */
 rampFrac:0.3,
 /** b19 caps (Grok Bot): visible flight after lift-off, 8–12 s (was T-03's 12 s). ONE data parameter: TRANSITION_DURATIONS.seg5a.flight.
  *  Lift-off + flight are re-timed as one C1 warp over T-03's ride time [liftT, T]; the last tailS play at rate 1 so the touchdown
  *  framing (her + lake, LAKESIDE_DOOR_HER_FRAC) and C2 are exactly T-03's. */
 flightS:TRANSITION_DURATIONS.seg5a.flight as number,tailS:3.0,
 placeholder:false,
 /** b19 data hooks (BalloonLegData.skyLakeParamsFrom): null = T-03 values. walkS = S6→door walk seconds (data); liftTraj = 场景设计部
  *  lift keys (world basket root, t 0..liftS); liftInWindow: lift-off counts INSIDE the visible-flight window flightS (Grok Bot);
  *  riderYawDeg = her seated facing (data; used by the occlusion tests / her pose, never hard-coded here). */
 walkS:null as number|null,liftTraj:null as null|ReadonlyArray<Readonly<{t:number;pos:Vec;yawDeg:number}>>,liftInWindow:false/* 9d0043f2 timeline (Grok Bot): lift 5 s + visible flight 8 s */,riderYawDeg:null as number|null,
 /** b19 T-02→walk handoff: SkyWalkShot lens on the data walk (tau = walk clock; caller passes τ ↦ walk.pose(gazeS+τ)). null = T-03 walk lens */
 walkCam:null as null|((tau:number)=>Pose)});
export type SkyLake=Readonly<{walkS:number;boardS:number;flightAt:number;liftEndAt:number;touchdownAt:number;
 rideT(tau:number):number;basket(tau:number):Vec;flightVisS:number;liftJoinM:number;cam(tau:number,from:Pose|null):Pose;phase(tau:number):'C1-walk'|'C1-board'|'liftoff'|'flight'|'C2'}>;
/** eased warp: σ∈[0,S] → flight time f∈[0,F]; rate 1 at both ends, smoothstep up/down to the cruise rate (C1, monotonic) */
/** σ∈[0,S] → f∈[0,F]: rate 1 at σ=0, smoothstep up over rampFrac·S, cruise, smoothstep down over downS, rate 1 for the last tailS */
export function flightWarp(S:number,F:number,rampFrac:number,tailS:number,downS=S*0.3):{f:(s:number)=>number;rate:number}{
 const up=S*rampFrac,ri=(x:number,R:number)=>{if(x<=0)return 0;if(x>=R)return R/2+(x-R);const u=x/R;return R*(u*u*u-u*u*u*u/2);};
 const d0=S-tailS-downS,r=1+(F-S)/(ri(S,up)-ri(S-d0,downS));
 return {rate:r,f:s=>{const x=Math.max(0,Math.min(S,s));return Math.min(F,x+(r-1)*(ri(x,up)-ri(x-d0,downS)));}};}
export function liftWarp(S:number,F:number,rampFrac=SKY_LAKE_CONT.rampFrac):{f:(s:number)=>number;rate:number}{
 const ramp=S*rampFrac,ri=(x:number)=>{if(x<=0)return 0;if(x>=ramp)return ramp/2+(x-ramp);const u=x/ramp;return ramp*(u*u*u-u*u*u*u/2);};
 const r=1+(F-S)/(ri(S)-ri(ramp));/* ∫(rate−1) = (r−1)(ri(s) − ri(s−(S−ramp))) */
 return {rate:r,f:s=>{const x=Math.max(0,Math.min(S,s));return Math.min(F,x+(r-1)*(ri(x)-ri(x-(S-ramp))));}};}
/** Catmull-Rom on pos, linear yaw (same interpolation as check-lift-clearance.cjs). */
export function liftTrajAt(keys:ReadonlyArray<Readonly<{t:number;pos:Vec;yawDeg:number}>>,t:number):{pos:Vec;yawDeg:number}{
 let i=0;while(i<keys.length-2&&t>keys[i+1].t)i++;const a=keys[Math.max(0,i-1)],b=keys[i],c=keys[Math.min(keys.length-1,i+1)],d=keys[Math.min(keys.length-1,i+2)];
 const u=c.t>b.t?Math.max(0,Math.min(1,(t-b.t)/(c.t-b.t))):0,u2=u*u,u3=u2*u;
 const pos=[0,1,2].map(j=>0.5*(2*b.pos[j]+(-a.pos[j]+c.pos[j])*u+(2*a.pos[j]-5*b.pos[j]+4*c.pos[j]-d.pos[j])*u2+(-a.pos[j]+3*b.pos[j]-3*c.pos[j]+d.pos[j])*u3)) as Vec;
 return {pos,yawDeg:b.yawDeg+(c.yawDeg-b.yawDeg)*u};}
const s5=(u:number)=>{const x=Math.max(0,Math.min(1,u));return x*x*x*(x*(x*6-15)+10);};
export function skyLakeContinuous(R:LakesideBalloonRide,door:Pose,k=SKY_LAKE_CONT):SkyLake{
 const K=k as any,walkS:number=K.walkS??R.walkS,boardS=k.doorS+k.stepInS+k.igniteS,traj=K.liftTraj as (null|ReadonlyArray<Readonly<{t:number;pos:Vec;yawDeg:number}>>);
 const liftS:number=traj?traj[traj.length-1].t-traj[0].t:k.liftS,windowS:number=K.flightS??(R.T-R.cutT);
 const flightS=K.liftInWindow!==false&&K.flightS!=null?Math.max(1,windowS-liftS):windowS/* visible flight after the lift */;
 const tailS=Math.min(K.tailS??3,flightS*0.5),flightAt=walkS+boardS,liftEndAt=flightAt+liftS,touchdownAt=liftEndAt+flightS;
 const walkClock=(tau:number)=>tau*R.walkS/walkS/* T-03 walk lens on the data walk length (old-yaw content, re-block pending) */;
 // the same ride with no cut: flight lens from lift-off (vehicle on the flight's own clock)
 const R2={...R,cutT:R.liftT,vehicle:(t:number):Vec=>R.flight.vehicle(t-R.liftT),camera:(t:number,_f:Pose|null):Pose=>R.flight.camera(Math.max(0,t-R.liftT),null)} as LakesideBalloonRide;
 const W=flightWarp(liftS+flightS,R.T-R.liftT,k.rampFrac*liftS/(liftS+flightS),tailS,Math.max(1,flightS-tailS));
 const rideT=(tau:number)=>tau<walkS?tau:tau<flightAt?R.liftT/* basket moored = flight time 0 */:tau<touchdownAt?R.liftT+W.f(tau-flightAt):R.T+(tau-touchdownAt);
 const flightLens=(t:number)=>t>=R.cutT?lakesideDoorRideCamera(R,door,t,null)/* T-03 lens (on the re-timed clock) */:lakesideDoorRideCamera(R2,door,t,null);
 let walkEnd:Pose|null=null,walkFrom:Pose|null|undefined;
 // data lift: basket on the 场景设计部 keys; the T-03 flight is joined by a translation offset D that decays to 0 before the tail
 /* T-03 basket on its own clock: the flight path before cutT (R.vehicle is the moored/cut model there) */
 const veh=(t:number):Vec=>t<R.cutT?R.flight.vehicle(t-R.liftT):R.vehicle(t);
 const T0=traj?traj[0].t:0,liftEnd:Vec|null=traj?liftTrajAt(traj,T0+liftS).pos:null,f0:Vec=veh(rideT(liftEndAt+1e-6));
 const D:Vec=liftEnd?[liftEnd[0]-f0[0],liftEnd[1]-f0[1],liftEnd[2]-f0[2]]:[0,0,0],liftJoinM=Math.hypot(D[0],D[1],D[2]);
 const dW=(tau:number)=>tau<liftEndAt?1:1-s5((tau-liftEndAt)/Math.max(.5,flightS-tailS));
 const shift=(p:Pose,w:number):Pose=>w<=0?p:{position:[p.position[0]+D[0]*w,p.position[1]+D[1]*w,p.position[2]+D[2]*w],target:[p.target[0]+D[0]*w,p.target[1]+D[1]*w,p.target[2]+D[2]*w],fovVerticalDeg:p.fovVerticalDeg};
 const basket=(tau:number):Vec=>{if(traj&&tau>=flightAt&&tau<liftEndAt)return liftTrajAt(traj,T0+tau-flightAt).pos;if(tau<flightAt&&traj)return traj[0].pos as Vec;
  const v=traj?veh(rideT(tau)):R.vehicle(rideT(tau)),w=traj&&tau<touchdownAt?dW(tau):0;return [v[0]+D[0]*w,v[1]+D[1]*w,v[2]+D[2]*w];};
 /* lift lens = T-03 lift lens re-based so it frames the data basket: offset = data basket − T-03 basket on the same clock */
 const liftLens=(tau:number):Pose=>{const t=rideT(Math.max(flightAt,tau)),v=veh(t),q=basket(Math.max(flightAt,tau)),dd:Vec=[q[0]-v[0],q[1]-v[1],q[2]-v[2]],p=flightLens(t);
  return {position:[p.position[0]+dd[0],p.position[1]+dd[1],p.position[2]+dd[2]],target:[p.target[0]+dd[0],p.target[1]+dd[1],p.target[2]+dd[2]],fovVerticalDeg:p.fovVerticalDeg};};
 const cam=(tau:number,from:Pose|null):Pose=>{
  if(tau<walkS)return K.walkCam?K.walkCam(tau):R.camera(walkClock(tau),from);
  if(tau<flightAt){if(!walkEnd||walkFrom!==from){walkFrom=from;walkEnd=K.walkCam?K.walkCam(walkS):R.camera(R.walkS-1e-6,from);}return blendPose(walkEnd,traj?liftLens(flightAt)/* lens placed for the data mooring */:flightLens(R.liftT),minJerk((tau-walkS)/Math.max(1e-3,boardS)));}
  if(traj&&tau<liftEndAt)return liftLens(tau);
  return traj&&tau<touchdownAt?shift(flightLens(rideT(tau)),dW(tau)):flightLens(rideT(tau));};
 const phase=(tau:number)=>tau<walkS?'C1-walk':tau<flightAt?'C1-board':tau<liftEndAt?'liftoff':tau<touchdownAt?'flight':'C2';
 return {walkS,boardS,flightAt,liftEndAt,touchdownAt,rideT,basket,flightVisS:flightS,liftJoinM,cam,phase};
}
