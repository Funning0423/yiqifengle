/** full6 P1 (Mac full5: meadow→skycity B1 ~39 s walk). With all 12 levels done the island→skycity journey is chained: the sail
 *  leg ends at A6 = sail M1 and B1 used to walk a STRAIGHT line M1→basket door (33.9 m, through the yard fence). Now, when she
 *  is more than B1_PREWALK_MIN_M from M6, she first walks the meadow node graph (RegionNodes edges, through the gate) to M6 at
 *  her natural NodeWalker speed (1.2 m/s, no speed-up, no cut), and B1 starts at M6 as in the normal flow (≈11.4 s).
 *  Grok Bot 2026-10-26: this pre-walk is region walking, not part of the 50 s balloon cap. Pure (no 'cc'). */
import {REGION_NODES,type Vec} from './RegionNodes';
import {routeKeys,WALK_SPEED_MPS} from './NodeWalker';
export const B1_PREWALK_MIN_M=3;
export const B1_START_NODE='M6';
export type B1PreWalk=Readonly<{path:Vec[];lengthM:number;durationS:number;fromKey:string}>|null;
const d2=(a:Vec,b:Vec)=>Math.hypot(a[0]-b[0],a[2]-b[2]);
/** `here` in meadow model-local metres. null = already at M6 (normal flow: L8 reward walk M4→M6). */
export function b1PreWalk(here:Vec):B1PreWalk{
 const nodes=REGION_NODES.meadow.nodes,m6=nodes.find(n=>n.key===B1_START_NODE)!;
 if(d2(here,m6.at)<=B1_PREWALK_MIN_M)return null;
 let near=nodes[0];for(const n of nodes)if(d2(here,n.at)<d2(here,near.at))near=n;
 const r=near.key===B1_START_NODE?{path:[m6.at] as Vec[],lengthM:0}:routeKeys('meadow',near.key,B1_START_NODE);
 const path:Vec[]=[here,...r.path];if(d2(path[0],path[1])<0.05)path.splice(1,1);
 let L=0;for(let i=1;i<path.length;i++)L+=Math.hypot(path[i][0]-path[i-1][0],path[i][1]-path[i-1][1],path[i][2]-path[i-1][2]);
 return {path,lengthM:L,durationS:L/WALK_SPEED_MPS,fromKey:near.key};
}
/** 运镜bot full7-cam: the pre-walk follow lens (was inline in BalloonTransit preDraw). Her heading flips at every node corner, and a
 *  first-order pose ease of followPose made the lens yaw accel spike (p99 ≈1000 °/s² at the corners). Now the lens heading is a
 *  critically damped follower of hers (ω PREWALK_LENS.omega, rate ≤ yawDegS, accel ≤ accDegS2). Start: min-jerk from the live lens over
 *  inS. End: min-jerk onto the B1 first lens c0 over the last outS (B1 then starts with no step). Pure; positions/headings in world. */
import type {Pose} from '../world-r1/WorldFlowCore';
import {followPose} from './ExploreCameraCore';
import {blendPose,minJerk} from './TransitionCamera';
export const PREWALK_LENS=Object.freeze({omega:2.2,yawDegS:100,accDegS2:240,inS:1,outS:1.5});
export type PreWalkLensState={yaw:number;v:number};
export function b1PreWalkLens(a:{her:Vec;yawRad:number;w:number;h:number;dt:number;t:number;durationS:number;live:Pose|null;c0:Pose;prev:PreWalkLensState|null}):{pose:Pose;state:PreWalkLensState}{
 const K=PREWALK_LENS,D=Math.PI/180,s=a.prev?{...a.prev}:{yaw:a.yawRad,v:0};
 if(a.prev&&a.dt>0){let e=a.yawRad-s.yaw;e=Math.atan2(Math.sin(e),Math.cos(e));
  const acc=Math.max(-K.accDegS2*D,Math.min(K.accDegS2*D,K.omega*K.omega*e-2*K.omega*s.v));s.v=Math.max(-K.yawDegS*D,Math.min(K.yawDegS*D,s.v+acc*a.dt));s.yaw+=s.v*a.dt;}
 let p:Pose=followPose(a.her,s.yaw,a.w,a.h);
 if(a.live&&a.t<K.inS)p=blendPose(a.live,p,minJerk(a.t/K.inS));
 const left=a.durationS-a.t;if(left<K.outS)p=blendPose(p,a.c0,minJerk(1-Math.max(0,left)/K.outS));
 return {pose:p,state:s};
}
