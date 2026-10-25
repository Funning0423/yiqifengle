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
export const SKY_LAKE_CONT=Object.freeze({
 /** PLACEHOLDER beats until 场景设计部 / GGbot animation timings arrive: door open, step in, ignition */
 doorS:1.0,stepInS:1.2,igniteS:3.0,
 /** seconds of screen time that show the 18 s lift-off T-03 skipped (searched: least value meeting the yaw caps, see test) */
 liftS:6.0,
 /** smoothstep rate ramps inside the lift-off window (start and end of the window are at rate 1 → no velocity step) */
 rampFrac:0.3,
 placeholder:true,
 /** compress (Grok Bot ≥ 8 s): screen seconds of T-03's visible flight; undefined/≥ R.T−R.cutT = T-03 bit-identical. Retimed
  *  with the same eased warp (rate 1 at both ends), lens path unchanged. */
 flightS:undefined as number|undefined});
export type SkyLake=Readonly<{walkS:number;boardS:number;flightAt:number;liftEndAt:number;touchdownAt:number;
 rideT(tau:number):number;cam(tau:number,from:Pose|null):Pose;phase(tau:number):'C1-walk'|'C1-board'|'liftoff'|'flight'|'C2'}>;
/** eased warp: σ∈[0,S] → flight time f∈[0,F]; rate 1 at both ends, smoothstep up/down to the cruise rate (C1, monotonic) */
export function liftWarp(S:number,F:number,rampFrac=SKY_LAKE_CONT.rampFrac):{f:(s:number)=>number;rate:number}{
 const ramp=S*rampFrac,ri=(x:number)=>{if(x<=0)return 0;if(x>=ramp)return ramp/2+(x-ramp);const u=x/ramp;return ramp*(u*u*u-u*u*u*u/2);};
 const r=1+(F-S)/(ri(S)-ri(ramp));/* ∫(rate−1) = (r−1)(ri(s) − ri(s−(S−ramp))) */
 return {rate:r,f:s=>{const x=Math.max(0,Math.min(S,s));return Math.min(F,x+(r-1)*(ri(x)-ri(x-(S-ramp))));}};}
export function skyLakeContinuous(R:LakesideBalloonRide,door:Pose,k=SKY_LAKE_CONT):SkyLake{
 const skip=R.cutT-R.liftT/* T-03 flightSkipS: flight time hidden under black */,walkS=R.walkS,boardS=k.doorS+k.stepInS+k.igniteS;
 const flightAt=walkS+boardS,liftEndAt=flightAt+k.liftS,Fv=R.T-R.cutT,fS=k.flightS!=null&&k.flightS<Fv?Math.max(1,k.flightS):Fv,touchdownAt=liftEndAt+fS,FW=fS<Fv?liftWarp(fS,Fv,k.rampFrac):null;
 // the same ride with no cut: flight lens from lift-off (vehicle on the flight's own clock)
 const R2={...R,cutT:R.liftT,vehicle:(t:number):Vec=>R.flight.vehicle(t-R.liftT),camera:(t:number,_f:Pose|null):Pose=>R.flight.camera(Math.max(0,t-R.liftT),null)} as LakesideBalloonRide;
 const W=liftWarp(k.liftS,skip,k.rampFrac);
 const rideT=(tau:number)=>tau<walkS?tau:tau<flightAt?R.liftT/* basket moored = flight time 0 */:tau<liftEndAt?R.liftT+W.f(tau-flightAt):tau<touchdownAt&&FW?R.cutT+FW.f(tau-liftEndAt):tau<touchdownAt?R.cutT+(tau-liftEndAt):R.T+(tau-touchdownAt);
 const flightLens=(t:number)=>t>=R.cutT?lakesideDoorRideCamera(R,door,t,null)/* T-03 exact */:lakesideDoorRideCamera(R2,door,t,null);
 let walkEnd:Pose|null=null,walkFrom:Pose|null|undefined;
 const cam=(tau:number,from:Pose|null):Pose=>{
  if(tau<walkS)return R.camera(tau,from);
  if(tau<flightAt){if(!walkEnd||walkFrom!==from){walkFrom=from;walkEnd=R.camera(walkS-1e-6,from);}return blendPose(walkEnd,flightLens(R.liftT),minJerk((tau-walkS)/boardS));}
  return flightLens(rideT(tau));};
 const phase=(tau:number)=>tau<walkS?'C1-walk':tau<flightAt?'C1-board':tau<liftEndAt?'liftoff':tau<touchdownAt?'flight':'C2';
 return {walkS,boardS,flightAt,liftEndAt,touchdownAt,rideT,cam,phase};
}
