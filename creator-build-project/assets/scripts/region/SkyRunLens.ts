/** full9c (运镜bot endshots): skycity walk-run lens. The reward / finale FollowWalk writer (raw followPose; skycity occlude() is unguarded)
 *  left her behind the star ring at S4 and the lens in the palette block on the S4→S6 runs. Per run (NodeWalker segment):
 *  - raw follow clear at the run start → raw follow, min-jerk blended over the last `blendS` into the planned clear end pose
 *    (occludeHeld(followPose(endFeet, endYaw)), computed once per run);
 *  - raw follow NOT clear at the run start (her hidden by a proxy or the lens < 0.35 m from one) → the run opens on the planned
 *    clear start pose and holds it, panning with her (frameHer); endHeld unused. Pure (no engine); RegionNodeStage supplies the poses. */
import type {Pose} from '../world-r1/WorldFlowCore';
import {frameHer} from './LensSmooth';
export type RunLensPose=Pose&{k:number};
const mj=(x:number)=>{const u=Math.max(0,Math.min(1,x));return u*u*u*(10-15*u+6*u*u);};
const lerp=(a:readonly number[],b:readonly number[],k:number):[number,number,number]=>[a[0]+(b[0]-a[0])*k,a[1]+(b[1]-a[1])*k,a[2]+(b[2]-a[2])*k];
/** her = her feet now: a blended pose is re-aimed (frameHer, position kept) so her body stays inside the 7-screen safe margins */
export function skyRunLens(raw:Pose,startHeld:Pose,endHeld:Pose,t:number,T:number,blendS:number,startClear:boolean,her?:readonly number[]):RunLensPose{
 const aim=(p:RunLensPose):RunLensPose=>her&&p.k>0?{...p,target:frameHer(p.position,p.target,p.fovVerticalDeg??45,her) as [number,number,number]}:p;
 if(startClear){const k=mj(1-(T-t)/Math.max(1e-3,blendS));return k<=0?{...raw,k:0}:aim({position:lerp(raw.position,endHeld.position,k),target:lerp(raw.target,endHeld.target,k),fovVerticalDeg:raw.fovVerticalDeg,k});}
 /* full9c: a min-jerk between two clear poses went THROUGH the stair wall on S4→S6 run 1 (hidden 1.4–2.3 s) — the lens stays on the
  * planned clear start pose and pans with her (frameHer), measured: walk margin ≥ 0.34, hidden 0, nothing within 0.35 m */
 const P=startHeld.position,fov=startHeld.fovVerticalDeg??raw.fovVerticalDeg??45,c=her?[her[0],her[1]+1.2,her[2]]:startHeld.target;
 return {position:[P[0],P[1],P[2]],target:her?frameHer(P,c,fov,her) as [number,number,number]:[c[0],c[1],c[2]],fovVerticalDeg:fov,k:1};}
/** blend into the planned clear end pose over the last SKY_RUN_BLEND_S of a clear-start run */
export const SKY_RUN_BLEND_S=2;
/** Grok Bot (full9c): the T-02 finale approach starts while she still has SKY_FINALE_EARLY_M to walk to S6 (the follow lens is inside
 *  the palette block over that stretch); she finishes the walk under the approach lens */
export const SKY_FINALE_EARLY_M=1.05;
