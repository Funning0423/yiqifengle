/** p0drag8: skycity lens avoidance limits + the per-candidate box test (pure, no cc). */
import type {OccBox} from './LensOcclusion';
/** Steepest look-down anywhere (Mac: −58°). */
export const LENS_PITCH_MAX_DEG=58;
export const AVOID=Object.freeze({swings:[0,15,-15,30,-30,45,-45,60,-60,90,-90,120,-120,150,-150,180] as readonly number[],stepDeg:6,backN:12,yawDegS:90,elevDegS:45,searchEveryN:4,insideBoost:1.6,aheadS:1.0,aheadMaxDeg:90,stayW:1,
 /** p0drag11: arm pull-in candidates (× current arm), floor, cost per unit of (1 − k), pull-in rate (m/s) */
 armK:[1,0.8,0.62,0.48] as readonly number[],armFloorM:3.5,armAfterS:0.3,armCost:45,armMS:2.2});
/** 0 = lens outside every box and the look→lens segment clear; 1 = lens outside but the segment crosses a box; 2 = lens inside one.
 *  Boxes that hold the look point are ignored (she stands in / on them). */
/** p0drag11: a box may carry `l` = the world→model-local affine (12 numbers, column-major 3×4: [m0 m1 m2 | m3 m4 m5 | m6 m7 m8 | t0 t1 t2]).
 *  Its min/max are then MODEL-LOCAL and points are tested in that frame. Mac p0drag10: the sky city sits yawed ~118°, and world AABBs
 *  of its rotated proxies were up to 1.4–9× too big (a 10×1 m wall → a 9×9 m block) → phantom "she is hidden" 2–10 s, avoidance fled
 *  from walls that were not there. */
export type FrameBox=OccBox&{readonly l?:readonly number[]};
export function toFrame(l:readonly number[],p:readonly number[]):[number,number,number]{
 return [l[0]*p[0]+l[3]*p[1]+l[6]*p[2]+l[9],l[1]*p[0]+l[4]*p[1]+l[7]*p[2]+l[10],l[2]*p[0]+l[5]*p[1]+l[8]*p[2]+l[11]];}
export function lensLevel(look0:readonly number[],q0:readonly number[],boxes:readonly OccBox[],pad:number):0|1|2{
 let lv:0|1|2=0,F:readonly number[]|undefined,look=look0,q=q0,d=[q0[0]-look0[0],q0[1]-look0[1],q0[2]-look0[2]];
 for(let i=0;i<boxes.length;i++){const b=boxes[i] as FrameBox;
  if(b.l!==F){F=b.l;if(F){look=toFrame(F,look0);q=toFrame(F,q0);}else{look=look0;q=q0;}d=[q[0]-look[0],q[1]-look[1],q[2]-look[2]];}
  const l0=b.min[0]-pad,l1=b.min[1]-pad,l2=b.min[2]-pad,h0=b.max[0]+pad,h1=b.max[1]+pad,h2=b.max[2]+pad;
  if(look[0]>=l0&&look[0]<=h0&&look[1]>=l1&&look[1]<=h1&&look[2]>=l2&&look[2]<=h2)continue;
  if(q[0]>l0&&q[0]<h0&&q[1]>l1&&q[1]<h1&&q[2]>l2&&q[2]<h2)return 2;
  if(lv)continue;let t0=0,t1=1;/* p0drag8 perf: slab test on scalars, no per-box arrays */
  if(Math.abs(d[0])<1e-9){if(look[0]<l0||look[0]>h0)continue;}else{let a=(l0-look[0])/d[0],c=(h0-look[0])/d[0];if(a>c){const s=a;a=c;c=s;}if(a>t0)t0=a;if(c<t1)t1=c;if(t0>t1)continue;}
  if(Math.abs(d[1])<1e-9){if(look[1]<l1||look[1]>h1)continue;}else{let a=(l1-look[1])/d[1],c=(h1-look[1])/d[1];if(a>c){const s=a;a=c;c=s;}if(a>t0)t0=a;if(c<t1)t1=c;if(t0>t1)continue;}
  if(Math.abs(d[2])<1e-9){if(look[2]<l2||look[2]>h2)continue;}else{let a=(l2-look[2])/d[2],c=(h2-look[2])/d[2];if(a>c){const s=a;a=c;c=s;}if(a>t0)t0=a;if(c<t1)t1=c;if(t0>t1)continue;}
  lv=1;}
 return lv;
}
/** p0drag11: point inside a (frame) box. */
export function inBox(b:OccBox,p0:readonly number[],pad=0):boolean{const F=(b as FrameBox).l,p=F?toFrame(F,p0):p0;
 return p[0]>b.min[0]-pad&&p[0]<b.max[0]+pad&&p[1]>b.min[1]-pad&&p[1]<b.max[1]+pad&&p[2]>b.min[2]-pad&&p[2]<b.max[2]+pad;}
/** Boxes whose nearest point lies within r of c (sphere filter, p0drag8 perf). */
export function nearSphere(boxes:readonly OccBox[],c0:readonly number[],r:number):OccBox[]{const out:OccBox[]=[],r2=r*r;let F:readonly number[]|undefined,c=c0;
 for(let i=0;i<boxes.length;i++){const b=boxes[i];if((b as FrameBox).l!==F){F=(b as FrameBox).l;c=F?toFrame(F,c0):c0;}const x=Math.max(b.min[0]-c[0],0,c[0]-b.max[0]),y=Math.max(b.min[1]-c[1],0,c[1]-b.max[1]),z=Math.max(b.min[2]-c[2],0,c[2]-b.max[2]);if(x*x+y*y+z*z<r2)out.push(b);}
 return out;}
/** p0drag10: her face (feet + 1.45 m) / chest (feet + 1.05 m) hidden from the lens by a proxy box — the same slab raycast as lensLevel
 *  (a box holding the body point is skipped; a lens inside a box counts as hidden). camTrace occFace / occChest + the replay test use it. */
export function herOcclusion(lens:readonly number[],feet:readonly number[],boxes:readonly OccBox[]):{face:boolean;chest:boolean}{
 const f=[feet[0],feet[1]+1.45,feet[2]],c=[feet[0],feet[1]+1.05,feet[2]];
 return {face:lensLevel(f,lens,boxes,0)>0,chest:lensLevel(c,lens,boxes,0)>0};}
