/** full6 P1 (Mac full5: meadow→skycity B1 ~39 s walk) + gate handoff (场景设计部 review of baf51b13, Grok Bot 2026-10-26).
 *  With all 12 levels done the island→skycity journey is chained: the sail leg ends at A6 = sail M1. She walks the meadow node
 *  graph (RegionNodes edges, natural NodeWalker speed 1.2 m/s, no cut) and hands off to B1 at the YARD GATE (2.6,−20.8) — not
 *  at M6, which lies past the basket door (U-turn) and against the windmill base. The post-L8 M4→M6 departure walk is cut at the
 *  same gate. No walk or handoff turns in place by more than MAX_TURN_DEG. The 50 s balloon cap starts at B1 (= the gate).
 *  Pure (no 'cc'). */
import {REGION_NODES,type Vec} from './RegionNodes';
import {routeKeys,WALK_SPEED_MPS} from './NodeWalker';
/** Meadow-local yard gate on the M4→M6 / M5→M6 edges (RegionNodes data point). */
export const B1_HANDOFF:Vec=[2.6,6.341,-20.8];
export const B1_HANDOFF_TOL_M=0.5;
export const B1_START_NODE='M6';
export const MAX_TURN_DEG=90;
export type B1PreWalk=Readonly<{path:Vec[];lengthM:number;durationS:number;fromKey:string}>|null;
const d2=(a:Vec,b:Vec)=>Math.hypot(a[0]-b[0],a[2]-b[2]);
const head=(a:Vec,b:Vec)=>Math.atan2(b[0]-a[0],b[2]-a[2]);
/** Unsigned turn (deg) at b on a→b→c, ground plane. */
export function turnDeg(a:Vec,b:Vec,c:Vec):number{let t=Math.abs(head(b,c)-head(a,b))*180/Math.PI;if(t>180)t=360-t;return t;}
export function maxTurnDeg(path:readonly Vec[]):number{let m=0;for(let i=1;i+1<path.length;i++)if(d2(path[i-1],path[i])>1e-6&&d2(path[i],path[i+1])>1e-6)m=Math.max(m,turnDeg(path[i-1],path[i],path[i+1]));return m;}
/** Drop interior points that would make her turn > MAX_TURN_DEG in place (keeps both ends). */
export function dropSharpTurns(path:readonly Vec[],max=MAX_TURN_DEG):Vec[]{const p=path.slice();let i=1;while(i+1<p.length){if(turnDeg(p[i-1],p[i],p[i+1])>max){p.splice(i,1);i=Math.max(1,i-1);}else i++;}return p;}
/** Cut a meadow path at the gate (first point within 5 cm), if it passes the gate. */
export function cutAtHandoff(path:readonly Vec[]):Vec[]{const i=path.findIndex(q=>d2(q,B1_HANDOFF)<.05);return i>=0?path.slice(0,i+1):path.slice();}
const len=(p:readonly Vec[])=>{let L=0;for(let i=1;i<p.length;i++)L+=Math.hypot(p[i][0]-p[i-1][0],p[i][1]-p[i-1][1],p[i][2]-p[i-1][2]);return L;};
/** `here` meadow-local; `firstB1` = B1's first target (basket 'outside', meadow-local). null = already at the gate (normal flow). */
export function b1PreWalk(here:Vec,firstB1?:Vec):B1PreWalk{
 if(d2(here,B1_HANDOFF)<=B1_HANDOFF_TOL_M)return null;
 const nodes=REGION_NODES.meadow.nodes;
 let near=nodes[0];for(const n of nodes)if(d2(here,n.at)<d2(here,near.at))near=n;
 const r=near.key===B1_START_NODE?{path:[near.at] as Vec[]}:routeKeys('meadow',near.key,B1_START_NODE);
 let path:Vec[]=[here,...cutAtHandoff(r.path)];if(path.length>1&&d2(path[0],path[1])<0.05)path.splice(1,1);
 path=dropSharpTurns(path);
 // handoff: the last prewalk heading → B1's first heading must not exceed MAX_TURN_DEG (e.g. from M6 the gate is behind her)
 if(firstB1)while(path.length>2&&turnDeg(path[path.length-2],path[path.length-1],firstB1)>MAX_TURN_DEG)path.pop();
 if(path.length<2)return null;
 const L=len(path);return {path,lengthM:L,durationS:L/WALK_SPEED_MPS,fromKey:near.key};
}
/** B1 door path [start, outside, doorOut] without in-place turns > MAX_TURN_DEG (world or local; rigid-invariant). */
export function b1DoorPath(start:Vec,outside:Vec,doorOut:Vec):Vec[]{return dropSharpTurns([start,outside,doorOut]);}
/** Post-L8 departure (M4→M6 / M5→M6, meadow→skycity): stop at the gate; B1 continues from there. */
export function meadowDepartureCut(region:string,toKey:string,nextRegion:string|undefined,path:readonly Vec[]):Vec[]{
 return region==='meadow'&&toKey===B1_START_NODE&&nextRegion==='skycity'?cutAtHandoff(path):path.slice();}
