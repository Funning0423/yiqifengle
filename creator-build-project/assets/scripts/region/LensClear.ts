import type {Pose,Vec} from '../world-r1/WorldFlowCore';
/** full8 P1-a (运镜bot m2 replay: our B1 pre-walk lens was inside the windmill t 123.3–129.9 and within 1.1 m of a meadow tree
 *  t 139.7–141.2 = grey frames 591–593). Camera-collision pull-in: keep the lens ≥ LENS_CLEAR_M from every solid box (MeadowLensBoxes,
 *  world space) by sliding it along the lens→target line toward the target; ease back out (never snap out). Pure, no cc. */
export const LENS_CLEAR_M=1.1,LENS_OUT_MPS=2.0,LENS_GRASS_M=0.6/* grass / flower blades over the walk floor */;
export type LensBox=readonly number[];// [x0,y0,z0,x1,y1,z1]
export function boxDist(p:Vec,b:LensBox):number{const dx=Math.max(b[0]-p[0],0,p[0]-b[3]),dy=Math.max(b[1]-p[1],0,p[1]-b[4]),dz=Math.max(b[2]-p[2],0,p[2]-b[5]);return Math.hypot(dx,dy,dz);}
/** Extra solid test (e.g. the meadow occupancy grid): true = p is ≥ clr from it. */
export type LensSolid=(p:Vec,clr:number)=>boolean;
export function lensClear(p:Vec,boxes:readonly LensBox[],clr=LENS_CLEAR_M,solid?:LensSolid):boolean{for(const b of boxes)if(boxDist(p,b)<clr)return false;return solid?solid(p,clr):true;}
/** Smallest pull-in (m, along lens→target) that clears all boxes; 0 = already clear. Stops 0.6 m short of the target. */
export function lensPullM(pose:Pose,boxes:readonly LensBox[],clr=LENS_CLEAR_M,solid?:LensSolid):number{
 const p=pose.position,t=pose.target,d=Math.hypot(t[0]-p[0],t[1]-p[1],t[2]-p[2]);if(d<1e-6)return 0;
 for(let s=0;s<=d-0.6;s+=0.05){const u=s/d,q:Vec=[p[0]+(t[0]-p[0])*u,p[1]+(t[1]-p[1])*u,p[2]+(t[2]-p[2])*u];if(lensClear(q,boxes,clr,solid))return s;}
 return Math.max(0,d-0.6);}
export type LensClearState={pull:number,off?:Vec|null};
/** groundY(p): walkable floor height under p (world) or null; the lens is kept ≥ clr + grass above it. */
export type GroundY=(p:Vec)=>number|null;
const LIFT_MAX=10,LIFT_STEP=.5,SLIDE_BACK=6,SLIDE_STEP=.4,SIDE_MAX=4,SIDE_STEP=1;
/** Per-frame lens clearance. The output = raw lens + an offset; candidates = slide along lens→target (pull-in ≤ 0.6 m short of her,
 *  back-off ≤ 6 m) × side (±4 m) × lift (≤ 10 m). The offset is CONTINUOUS: the previous offset is kept while it is clear and eased toward the
 *  wanted one at LENS_OUT_MPS (only through clear points); a new offset is the clear candidate nearest the previous output (no pops
 *  between far-apart solutions). The walk-floor rule (≥ clr + grass above the floor) is part of "clear". */
export function lensClearStep(pose:Pose,boxes:readonly LensBox[],dt:number,st:LensClearState,clr=LENS_CLEAR_M,groundY?:GroundY,solid?:LensSolid):Pose{
 const solid0=solid;const ok=(q:Vec):boolean=>{if(groundY){const g=groundY(q);if(g!==null&&q[1]<g+clr+LENS_GRASS_M-1e-6)return false;}return lensClear(q,boxes,clr,solid0);};
 const p=pose.position,t=pose.target,d=Math.hypot(t[0]-p[0],t[1]-p[1],t[2]-p[2])||1,ux=(t[0]-p[0])/d,uy=(t[1]-p[1])/d,uz=(t[2]-p[2])/d,sMax=Math.max(0,d-.6);
 const at=(o:Vec):Vec=>[p[0]+o[0],p[1]+o[1],p[2]+o[2]],len=(o:Vec)=>Math.hypot(o[0],o[1],o[2]);
 const prev=st.off||null,step=LENS_OUT_MPS*Math.max(0,dt);
 let want:Vec|null=ok(p)?[0,0,0]:null;
 if(!want){let best=1e18;const ref=prev||[0,0,0];
  const hx=Math.hypot(ux,uz)||1,lx=-uz/hx,lz=ux/hx/* horizontal side axis */;
  for(let up=0;up<=LIFT_MAX;up+=LIFT_STEP){if(want&&up>best)break;for(let sl=-SLIDE_BACK;sl<=sMax+1e-9;sl+=SLIDE_STEP)for(let sd=-SIDE_MAX;sd<=SIDE_MAX+1e-9;sd+=SIDE_STEP){
   const o:Vec=[ux*sl+lx*sd,uy*sl+up,uz*sl+lz*sd];const c=Math.hypot(o[0]-ref[0],o[1]-ref[1],o[2]-ref[2])+.25*(Math.abs(sl)+up+Math.abs(sd));if(c<best&&ok(at(o))){best=c;want=o;}}}
  if(!want)want=prev||[0,0,0]/* nothing clear in range: hold */;}
 let off:Vec=want;
 if(prev){const dx=want[0]-prev[0],dy=want[1]-prev[1],dz=want[2]-prev[2],D=Math.hypot(dx,dy,dz);
  if(D>step&&ok(at(prev))){const k=step/D,e:Vec=[prev[0]+dx*k,prev[1]+dy*k,prev[2]+dz*k];off=ok(at(e))?e:prev;}}
 st.off=len(off)<1e-6?null:off;st.pull=len(off);
 return st.off?{...pose,position:at(off)}:pose;}
