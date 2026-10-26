/** 运镜bot (cine/b19-s6-follow): follow lens for GGbot's off-S6 pre-walk (SkyLakePreWalk, e079dfcc). The original lens eased the POSE
 *  toward skyPreFollowPose(her, current segment) with a 0.35 s half-life; at each node corner (≤90°) the wanted lens jumps round her and
 *  the eased yaw peaked at 172 °/s (S0/S3 walks, all screens). Here the lens HEADING is a critically damped follower of the segment
 *  heading (ω, rate ≤ yawDegS, accel ≤ accDegS2), the pose is skyPreFollowPose along that heading (same framing), and the first blendInS
 *  blend from the live lens is unchanged. Pure. */
import type {Pose,Vec} from '../world-r1/WorldFlowCore';
import {SKY_PRE_FOLLOW,skyPreFollowPose} from './SkyLakePreWalk';
import {blendPose as lakeBlendPose} from './LakesideBalloon';
export const SKY_PRE_LENS=Object.freeze({omega:2.2,yawDegS:100,accDegS2:240});
export type SkyPreLensState={yaw:number;v:number;bp?:number[];bv?:number[]};
/** heading of the path segment nearest to her (as the original preDraw) */
export function segHeading(her:Vec,P:readonly Vec[]):number{let k=0,b=Infinity;for(let i=0;i+1<P.length;i++){const a=P[i],c=P[i+1],vx=c[0]-a[0],vz=c[2]-a[2],l2=vx*vx+vz*vz||1,u=Math.max(0,Math.min(1,((her[0]-a[0])*vx+(her[2]-a[2])*vz)/l2)),dx=a[0]+vx*u-her[0],dz=a[2]+vz*u-her[2],d=dx*dx+dz*dz;if(d<b){b=d;k=i;}}
 return Math.atan2(P[k+1][0]-P[k][0],P[k+1][2]-P[k][2]);}
export function skyPreFollowLens(a:{her:Vec;path:readonly Vec[];dt:number;t:number;live:Pose|null;prev:SkyPreLensState|null;w?:number;h?:number}):{pose:Pose;state:SkyPreLensState}{
 const K=SKY_PRE_LENS,D=Math.PI/180,want=segHeading(a.her,a.path),s=a.prev?{...a.prev}:{yaw:want,v:0};
 if(a.prev&&a.dt>0){let e=want-s.yaw;e=Math.atan2(Math.sin(e),Math.cos(e));const acc=Math.max(-K.accDegS2*D,Math.min(K.accDegS2*D,K.omega*K.omega*e-2*K.omega*s.v));
  s.v=Math.max(-K.yawDegS*D,Math.min(K.yawDegS*D,s.v+acc*a.dt));s.yaw+=s.v*a.dt;}
 const p=skyPreFollowPose(a.her,[Math.sin(s.yaw),0,Math.cos(s.yaw)]);
 return {pose:a.live&&a.t<SKY_PRE_FOLLOW.blendInS?lakeBlendPose(a.live,p,a.t/SKY_PRE_FOLLOW.blendInS):p,state:s};}
/** 运镜bot full8-skyfollow (sky-resume-follow, 14 rows S0/S3: lens within 1.1 m of skycity walls / env_sky_ruins, face hidden 1.35 / 0.9 s).
 *  Root cause: skyPreFollowLens puts the lens backM straight behind her along the (damped) segment heading; at each node corner that
 *  straight line cuts across the wall / ruins the walkway turns round. Here the lens TRAILS her along the walk path itself (arc length
 *  backM behind her, upM over the path, aim at the path aheadM ahead): the walk path is the clear corridor, so the lens stays in it; the
 *  heading turns as the trail point rounds the corner (no snap). Blend-in from the live lens unchanged. Pure. */
export const SKY_TRAIL_OMEGA=5;
export function pathArc(P:readonly Vec[]):number[]{const a=[0];for(let i=1;i<P.length;i++)a.push(a[i-1]+Math.hypot(P[i][0]-P[i-1][0],P[i][2]-P[i-1][2]));return a;}
export function pathAt(P:readonly Vec[],A:readonly number[],s:number):Vec{const n=P.length-1;let i=0;if(s<=0)i=0;else if(s>=A[n])i=n-1;else while(i<n-1&&A[i+1]<s)i++;
 const L=(A[i+1]-A[i])||1,u=s<=0?s/L:Math.min(1,(s-A[i])/L)/* before the start: extend the first segment backwards */;return [P[i][0]+(P[i+1][0]-P[i][0])*u,P[i][1]+(P[i+1][1]-P[i][1])*u,P[i][2]+(P[i+1][2]-P[i][2])*u];}
export function herArc(her:Vec,P:readonly Vec[],A:readonly number[]):number{let best=0,b=Infinity;for(let i=0;i+1<P.length;i++){const a=P[i],c=P[i+1],vx=c[0]-a[0],vz=c[2]-a[2],l2=vx*vx+vz*vz||1,u=Math.max(0,Math.min(1,((her[0]-a[0])*vx+(her[2]-a[2])*vz)/l2)),dx=a[0]+vx*u-her[0],dz=a[2]+vz*u-her[2],d=dx*dx+dz*dz;if(d<b){b=d;best=A[i]+u*(A[i+1]-A[i]);}}return best;}
export function skyResumeLens(a:{her:Vec;path:readonly Vec[];dt:number;t:number;live:Pose|null;prev:SkyPreLensState|null}):{pose:Pose;state:SkyPreLensState}{
 const k=SKY_PRE_FOLLOW,P=a.path,A=pathArc(P),s=herArc(a.her,P,A),raw=pathAt(P,A,s-k.backM),dy=a.her[1]-pathAt(P,A,s)[1];
 /* trail point: critically damped follower of the raw path point (ω=SKY_TRAIL_OMEGA) — rounds the path vertices (yaw accel) */
 const W=SKY_TRAIL_OMEGA,bp=a.prev&&a.prev.bp?a.prev.bp.slice():raw.slice(),bv=a.prev&&a.prev.bv?a.prev.bv.slice():[0,0,0];
 if(a.prev&&a.prev.bp&&a.dt>0)for(let c=0;c<3;c++){bv[c]+=(W*W*(raw[c]-bp[c])-2*W*bv[c])*a.dt;bp[c]+=bv[c]*a.dt;}
 const back=bp;
 const hx=a.her[0]-back[0],hz=a.her[2]-back[2],hl=Math.hypot(hx,hz)||1/* aim THROUGH her (the trail point may be round a corner) */;
 const p:Pose={position:[back[0],back[1]+dy+k.upM,back[2]],target:[a.her[0]+hx/hl*k.aheadM,a.her[1]+k.aimUpM,a.her[2]+hz/hl*k.aheadM],fovVerticalDeg:k.fovDeg};
 const st={yaw:Math.atan2(p.target[0]-p.position[0],p.target[2]-p.position[2]),v:0,bp,bv};
 return {pose:a.live&&a.t<SKY_PRE_FOLLOW.blendInS?lakeBlendPose(a.live,p,a.t/SKY_PRE_FOLLOW.blendInS):p,state:st};}
