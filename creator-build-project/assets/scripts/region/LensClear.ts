import type {Pose,Vec} from '../world-r1/WorldFlowCore';
/** full8 P1-a (运镜bot m2 replay: our B1 pre-walk lens was inside the windmill t 123.3–129.9 and within 1.1 m of a meadow tree
 *  t 139.7–141.2 = grey frames 591–593). Camera-collision pull-in: keep the lens ≥ LENS_CLEAR_M from every solid box (MeadowLensBoxes,
 *  world space) by sliding it along the lens→target line toward the target; ease back out (never snap out). Pure, no cc. */
export const LENS_CLEAR_M=1.1,LENS_OUT_MPS=2.0,LENS_GRASS_M=0.6/* grass / flower blades over the walk floor */;
export type LensBox=readonly number[];// [x0,y0,z0,x1,y1,z1]
export function boxDist(p:Vec,b:LensBox):number{const dx=Math.max(b[0]-p[0],0,p[0]-b[3]),dy=Math.max(b[1]-p[1],0,p[1]-b[4]),dz=Math.max(b[2]-p[2],0,p[2]-b[5]);return Math.hypot(dx,dy,dz);}
export function lensClear(p:Vec,boxes:readonly LensBox[],clr=LENS_CLEAR_M):boolean{for(const b of boxes)if(boxDist(p,b)<clr)return false;return true;}
/** Smallest pull-in (m, along lens→target) that clears all boxes; 0 = already clear. Stops 0.6 m short of the target. */
export function lensPullM(pose:Pose,boxes:readonly LensBox[],clr=LENS_CLEAR_M):number{
 const p=pose.position,t=pose.target,d=Math.hypot(t[0]-p[0],t[1]-p[1],t[2]-p[2]);if(d<1e-6)return 0;
 for(let s=0;s<=d-0.6;s+=0.05){const u=s/d,q:Vec=[p[0]+(t[0]-p[0])*u,p[1]+(t[1]-p[1])*u,p[2]+(t[2]-p[2])*u];if(lensClear(q,boxes,clr))return s;}
 return Math.max(0,d-0.6);}
export type LensClearState={pull:number};
/** Per-frame: pull in at once when needed, ease back out at LENS_OUT_MPS. Returns the cleared pose. */
/** groundY(p): walkable floor height under p (world) or null; the lens is kept ≥ clr above it (raised, target unchanged). */
export type GroundY=(p:Vec)=>number|null;
export function lensClearStep(pose:Pose,boxes:readonly LensBox[],dt:number,st:LensClearState,clr=LENS_CLEAR_M,groundY?:GroundY):Pose{
 if(groundY){const g=groundY(pose.position);if(g!==null&&pose.position[1]<g+clr+LENS_GRASS_M)pose={...pose,position:[pose.position[0],g+clr+LENS_GRASS_M,pose.position[2]]};}
 const need=lensPullM(pose,boxes,clr);st.pull=need>=st.pull?need:Math.max(need,st.pull-LENS_OUT_MPS*Math.max(0,dt));
 if(st.pull<=0)return pose;const p=pose.position,t=pose.target,d=Math.hypot(t[0]-p[0],t[1]-p[1],t[2]-p[2])||1,u=Math.min(st.pull,d-0.6)/d;
 let q:Vec=[p[0]+(t[0]-p[0])*u,p[1]+(t[1]-p[1])*u,p[2]+(t[2]-p[2])*u];
 if(!lensClear(q,boxes,clr)){const k=lensPullM(pose,boxes,clr)/d;q=[p[0]+(t[0]-p[0])*k,p[1]+(t[1]-p[1])*k,p[2]+(t[2]-p[2])*k];}
 // no clear point between lens and target (she is beside / in front of the solid): lift the ORIGINAL lens until clear (≤ 8 m)
 if(!lensClear(q,boxes,clr)){let found=false;
  for(let k=0.1;k<=6&&!found;k+=0.1){const r:Vec=[p[0]-(t[0]-p[0])/d*k,p[1]-(t[1]-p[1])/d*k,p[2]-(t[2]-p[2])/d*k];if(lensClear(r,boxes,clr)){q=r;found=true;}}/* back off, away from her */
  for(let up=0.25;up<=8&&!found;up+=0.25){const r:Vec=[p[0],p[1]+up,p[2]];if(lensClear(r,boxes,clr)){q=r;found=true;}}}
 if(groundY){const g=groundY(q);if(g!==null&&q[1]<g+clr+LENS_GRASS_M)q=[q[0],g+clr+LENS_GRASS_M,q[2]];}
 return {...pose,position:q};}
