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
 placeholder:false});
export type SkyLake=Readonly<{walkS:number;boardS:number;flightAt:number;liftEndAt:number;touchdownAt:number;
 rideT(tau:number):number;cam(tau:number,from:Pose|null):Pose;phase(tau:number):'C1-walk'|'C1-board'|'liftoff'|'flight'|'C2'}>;
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
export function skyLakeContinuous(R:LakesideBalloonRide,door:Pose,k=SKY_LAKE_CONT):SkyLake{
 const skip=R.cutT-R.liftT/* T-03 flightSkipS: flight time hidden under black */,walkS=R.walkS,boardS=k.doorS+k.stepInS+k.igniteS;
 const flightS=(k as any).flightS??(R.T-R.cutT),tailS=Math.min((k as any).tailS??3,flightS*0.5),flightAt=walkS+boardS,liftEndAt=flightAt+k.liftS,touchdownAt=liftEndAt+flightS;
 // the same ride with no cut: flight lens from lift-off (vehicle on the flight's own clock)
 const R2={...R,cutT:R.liftT,vehicle:(t:number):Vec=>R.flight.vehicle(t-R.liftT),camera:(t:number,_f:Pose|null):Pose=>R.flight.camera(Math.max(0,t-R.liftT),null)} as LakesideBalloonRide;
 const W=flightWarp(k.liftS+flightS,R.T-R.liftT,k.rampFrac*k.liftS/(k.liftS+flightS),tailS,Math.max(1,flightS-tailS));
 const rideT=(tau:number)=>tau<walkS?tau:tau<flightAt?R.liftT/* basket moored = flight time 0 */:tau<touchdownAt?R.liftT+W.f(tau-flightAt):R.T+(tau-touchdownAt);
 const flightLens=(t:number)=>t>=R.cutT?lakesideDoorRideCamera(R,door,t,null)/* T-03 lens (on the re-timed clock) */:lakesideDoorRideCamera(R2,door,t,null);
 let walkEnd:Pose|null=null,walkFrom:Pose|null|undefined;
 const cam=(tau:number,from:Pose|null):Pose=>{
  if(tau<walkS)return R.camera(tau,from);
  if(tau<flightAt){if(!walkEnd||walkFrom!==from){walkFrom=from;walkEnd=R.camera(walkS-1e-6,from);}return blendPose(walkEnd,flightLens(R.liftT),minJerk((tau-walkS)/boardS));}
  return flightLens(rideT(tau));};
 const phase=(tau:number)=>tau<walkS?'C1-walk':tau<flightAt?'C1-board':tau<liftEndAt?'liftoff':tau<touchdownAt?'flight':'C2';
 return {walkS,boardS,flightAt,liftEndAt,touchdownAt,rideT,cam,phase};
}
