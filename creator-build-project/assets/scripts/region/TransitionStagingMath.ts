/** Pure geometry for the staged walks (no cc), from TRANSITION_STAGING (场景设计部 b19 data). */
import type {Vec} from '../world-r1/WorldFlowCore';
import {TRANSITION_STAGING as S} from './TransitionStaging';
/** boat / basket local → world: yaw about +Y (radians), same convention as RegionJourneyAdapter onBoat. */
export function localToWorld(origin:readonly number[],yawRad:number,l:readonly number[]):Vec{const c=Math.cos(yawRad),s=Math.sin(yawRad);
 return [origin[0]+l[0]*c+l[2]*s,origin[1]+l[1],origin[2]-l[0]*s+l[2]*c];}
/** Segment 1: her level stop → dock ramp → new I6 (A1 start) → dock_board → over the gangway into the boat (sit start). */
export function sailBoardPaths(start:Vec,boatPos:readonly number[],boatYawRad:number){const I=S.island;
 return {toI6:[start,...I.toDock,I.i6New] as Vec[],dock:[I.i6New,I.dockMid,I.dockBoard] as Vec[],
  boat:[I.dockBoard,...I.boardBoat.map(p=>localToWorld(boatPos,boatYawRad,p))] as Vec[]};}
/** Segment 2: stand_up end → hatch step → port gunwale → gangway foot → landing_step. */
export function sailOffPath(berth:readonly number[],yawRad:number,landingStep:Vec):Vec[]{const M=S.meadowLanding;
 return [localToWorld(berth,yawRad,M.standUpEnd),...M.offBoat.map(p=>localToWorld(berth,yawRad,p)),landingStep];}
/** Basket local → world (yaw in DEGREES). */
export function basketToWorld(origin:readonly number[],yawDeg:number,local:readonly number[]):Vec{return localToWorld(origin,yawDeg*Math.PI/180,local);}
const len=(p:readonly Vec[])=>{let L=0;for(let i=1;i<p.length;i++)L+=Math.hypot(p[i][0]-p[i-1][0],p[i][1]-p[i-1][1],p[i][2]-p[i-1][2]);return L;};
export const pathLength=len;
