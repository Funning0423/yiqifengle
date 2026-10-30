/** full9c (运镜bot): skycity reward-walk run lens — clear start: raw follow, min-jerk over the last blendS into the planned clear end pose; else hold the planned clear start pose and pan with her (frameHer). */
import type {Pose} from '../world-r1/WorldFlowCore';
import {frameHer} from './LensSmooth';
export type RunLensPose=Pose&{k:number};
const mj=(x:number)=>{const u=Math.max(0,Math.min(1,x));return u*u*u*(10-15*u+6*u*u);};
const lerp=(a:readonly number[],b:readonly number[],k:number):[number,number,number]=>[a[0]+(b[0]-a[0])*k,a[1]+(b[1]-a[1])*k,a[2]+(b[2]-a[2])*k];
export function skyRunLens(raw:Pose,startHeld:Pose,endHeld:Pose,t:number,T:number,blendS:number,startClear:boolean,her?:readonly number[]):RunLensPose{
 const aim=(p:RunLensPose):RunLensPose=>her&&p.k>0?{...p,target:frameHer(p.position,p.target,p.fovVerticalDeg??45,her) as [number,number,number]}:p;
 if(startClear){const k=mj(1-(T-t)/Math.max(1e-3,blendS));return k<=0?{...raw,k:0}:aim({position:lerp(raw.position,endHeld.position,k),target:lerp(raw.target,endHeld.target,k),fovVerticalDeg:raw.fovVerticalDeg,k});}
 const P=startHeld.position,fov=startHeld.fovVerticalDeg??raw.fovVerticalDeg??45,c=her?[her[0],her[1]+1.2,her[2]]:startHeld.target;
 return {position:[P[0],P[1],P[2]],target:her?frameHer(P,c,fov,her) as [number,number,number]:[c[0],c[1],c[2]],fovVerticalDeg:fov,k:1};}
export const SKY_RUN_BLEND_S=2;
export const SKY_FINALE_EARLY_M=1.05;
