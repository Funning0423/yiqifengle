/** 运镜bot (cine/b19-s6-follow): follow lens for GGbot's off-S6 pre-walk (SkyLakePreWalk, e079dfcc). The original lens eased the POSE
 *  toward skyPreFollowPose(her, current segment) with a 0.35 s half-life; at each node corner (≤90°) the wanted lens jumps round her and
 *  the eased yaw peaked at 172 °/s (S0/S3 walks, all screens). Here the lens HEADING is a critically damped follower of the segment
 *  heading (ω, rate ≤ yawDegS, accel ≤ accDegS2), the pose is skyPreFollowPose along that heading (same framing), and the first blendInS
 *  blend from the live lens is unchanged. Pure. */
import type {Pose,Vec} from '../world-r1/WorldFlowCore';
import {SKY_PRE_FOLLOW,skyPreFollowPose} from './SkyLakePreWalk';
import {blendPose as lakeBlendPose} from './LakesideBalloon';
export const SKY_PRE_LENS=Object.freeze({omega:2.2,yawDegS:100,accDegS2:240});
export type SkyPreLensState={yaw:number;v:number};
/** heading of the path segment nearest to her (as the original preDraw) */
export function segHeading(her:Vec,P:readonly Vec[]):number{let k=0,b=Infinity;for(let i=0;i+1<P.length;i++){const a=P[i],c=P[i+1],vx=c[0]-a[0],vz=c[2]-a[2],l2=vx*vx+vz*vz||1,u=Math.max(0,Math.min(1,((her[0]-a[0])*vx+(her[2]-a[2])*vz)/l2)),dx=a[0]+vx*u-her[0],dz=a[2]+vz*u-her[2],d=dx*dx+dz*dz;if(d<b){b=d;k=i;}}
 return Math.atan2(P[k+1][0]-P[k][0],P[k+1][2]-P[k][2]);}
export function skyPreFollowLens(a:{her:Vec;path:readonly Vec[];dt:number;t:number;live:Pose|null;prev:SkyPreLensState|null;w?:number;h?:number}):{pose:Pose;state:SkyPreLensState}{
 const K=SKY_PRE_LENS,D=Math.PI/180,want=segHeading(a.her,a.path),s=a.prev?{...a.prev}:{yaw:want,v:0};
 if(a.prev&&a.dt>0){let e=want-s.yaw;e=Math.atan2(Math.sin(e),Math.cos(e));const acc=Math.max(-K.accDegS2*D,Math.min(K.accDegS2*D,K.omega*K.omega*e-2*K.omega*s.v));
  s.v=Math.max(-K.yawDegS*D,Math.min(K.yawDegS*D,s.v+acc*a.dt));s.yaw+=s.v*a.dt;}
 const p=skyPreFollowPose(a.her,[Math.sin(s.yaw),0,Math.cos(s.yaw)]);
 return {pose:a.live&&a.t<SKY_PRE_FOLLOW.blendInS?lakeBlendPose(a.live,p,a.t/SKY_PRE_FOLLOW.blendInS):p,state:s};}
