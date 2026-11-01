import type {Vec} from './RegionNodes';
import {skyLakePreWalk} from './SkyLakePreWalk';
/** full8b P0 (Mac afb9a70c fin: journey-invalid-continuity → lakeside fallback): since e079dfcc the counted skycity→lakeside leg
 *  starts at S6 (mooring C walkWorld[0]) but the journey checkpoint (`start`) is where the meadow→skycity balloon left her (the
 *  b19 S0 deck), and validateJourneyRoute requires path[0] === start. The leg now carries the uncounted lead-in the ride already
 *  walks (skyLakePreWalk: her stand → skycity node path → S6), so continuity is checked over checkpoint → entry → S6 → counted leg.
 *  Pure, no cc. */
export function skyLakeEntry(start:Vec,m:{walkWorld:readonly (readonly number[])[]}):Vec[]|null{
 const s6:Vec=[m.walkWorld[0][0],m.walkWorld[0][1],m.walkWorld[0][2]];
 if(Math.hypot(start[0]-s6[0],start[1]-s6[1],start[2]-s6[2])<=1e-4)return null/* already on S6: no lead-in */;
 const pre=skyLakePreWalk(start,m as any);return pre?pre.path.map(p=>[p[0],p[1],p[2]] as Vec):[[start[0],start[1],start[2]],s6]/* within SKY_LAKE_AT_S6_M */;}
