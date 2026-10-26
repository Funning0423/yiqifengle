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
