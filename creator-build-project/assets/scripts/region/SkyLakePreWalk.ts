import {REGION_NODES,type Vec} from './RegionNodes';
import {routeKeys,WALK_SPEED_MPS} from './NodeWalker';
import {skyLocalToWorld} from './SkyWalkShot';
import {MAX_TURN_DEG,dropSharpTurns} from './BalloonB1Start';
import type {Pose} from '../world-r1/WorldFlowCore';
/** full7 option (a) (Grok Bot 2026-10-26): the skycity→lakeside leg is counted from S6 (mooring-C walk start, = S6 world).
 *  Mac full6 S2/S3: she stood at S0, the ride walked ONE straight 70.7 m line through the S1–S5 terrace/rocks (≈75 s walk_loop).
 *  When she is not at S6 she first walks the skycity node path to S6 at WALK_SPEED_MPS (region walking, not counted), with a
 *  continuous follow lens; the counted ride then starts at S6 exactly as designed. */
export const SKY_LAKE_AT_S6_M=0.6;
type Mooring={world:readonly number[];worldYawDeg:number;pos:readonly number[];yawDeg:number;walkWorld:readonly (readonly number[])[]};
const d3=(a:readonly number[],b:readonly number[])=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
/** Cuts out-and-back spurs: the node graph passes dead-end nodes (S4 stair top) by walking in and out along the same edge. */
export function dropLoops(path:readonly Vec[],tolM=.35):Vec[]{const p=path.slice();for(let i=0;i<p.length;i++)for(let j=p.length-1;j>i+1;j--)if(Math.hypot(p[i][0]-p[j][0],p[i][2]-p[j][2])<=tolM){p.splice(i+1,j-i);break;}return p;}
export type SkyLakePreWalk={path:Vec[];keys:string[];lengthM:number;durationS:number}|null;
export function skyLakePreWalk(start:Vec,m:Mooring):SkyLakePreWalk{
 const s6:Vec=[m.walkWorld[0][0],m.walkWorld[0][1],m.walkWorld[0][2]];if(d3(start,s6)<=SKY_LAKE_AT_S6_M)return null;
 let near='S6',best=Infinity;for(const n of REGION_NODES.skycity.nodes){const d=d3(start,skyLocalToWorld(m,n.at));if(d<best){best=d;near=n.key;}}
 const r=routeKeys('skycity',near,'S6'),pts=r.path.map(p=>skyLocalToWorld(m,p));
 let path:Vec[]=[start,...pts];if(d3(path[0],path[1])<0.05)path.splice(1,1);path[path.length-1]=s6;
 path=dropLoops(path);path=dropSharpTurns(path,MAX_TURN_DEG+.5)/* node pass-throughs; spurs are cut first so no chord leaves the graph */;let L=0;for(let i=1;i<path.length;i++)L+=d3(path[i-1],path[i]);
 return {path,keys:r.keys,lengthM:L,durationS:Math.max(.5,L/WALK_SPEED_MPS)};}
/** Follow lens behind her along the walk heading (4.6 m back, 2.3 m up, aim at chest + 2 m ahead). */
export const SKY_PRE_FOLLOW={backM:4.6,upM:2.3,aimUpM:1.2,aheadM:2,fovDeg:46,blendInS:1.2,halfLifeS:.35};
export function skyPreFollowPose(her:Vec,dir:readonly number[],k=SKY_PRE_FOLLOW):Pose{
 const L=Math.hypot(dir[0],dir[2])||1,x=dir[0]/L,z=dir[2]/L;
 return {position:[her[0]-x*k.backM,her[1]+k.upM,her[2]-z*k.backM],target:[her[0]+x*k.aheadM,her[1]+k.aimUpM,her[2]+z*k.aheadM],fovVerticalDeg:k.fovDeg};}
