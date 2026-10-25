/** p0drag8: skycity lens avoidance limits + the per-candidate box test (pure, no cc). */
import type {OccBox} from './LensOcclusion';
/** Steepest look-down anywhere (Mac: −58°). */
export const LENS_PITCH_MAX_DEG=58;
export const AVOID=Object.freeze({swings:[0,15,-15,30,-30,45,-45,60,-60,90,-90] as readonly number[],stepDeg:6,backN:12,yawDegS:90,elevDegS:45,searchEveryN:4,insideBoost:1.6,aheadS:0.5,aheadMaxDeg:40,stayW:1});
/** 0 = lens outside every box and the look→lens segment clear; 1 = lens outside but the segment crosses a box; 2 = lens inside one.
 *  Boxes that hold the look point are ignored (she stands in / on them). */
export function lensLevel(look:readonly number[],q:readonly number[],boxes:readonly OccBox[],pad:number):0|1|2{
 const d=[q[0]-look[0],q[1]-look[1],q[2]-look[2]];let lv:0|1|2=0;
 for(let i=0;i<boxes.length;i++){const b=boxes[i];
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
/** Boxes whose nearest point lies within r of c (sphere filter, p0drag8 perf). */
export function nearSphere(boxes:readonly OccBox[],c:readonly number[],r:number):OccBox[]{const out:OccBox[]=[],r2=r*r;
 for(let i=0;i<boxes.length;i++){const b=boxes[i],x=Math.max(b.min[0]-c[0],0,c[0]-b.max[0]),y=Math.max(b.min[1]-c[1],0,c[1]-b.max[1]),z=Math.max(b.min[2]-c[2],0,c[2]-b.max[2]);if(x*x+y*y+z*z<r2)out.push(b);}
 return out;}
/** p0drag10: her face (feet + 1.45 m) / chest (feet + 1.05 m) hidden from the lens by a proxy box — the same slab raycast as lensLevel
 *  (a box holding the body point is skipped; a lens inside a box counts as hidden). camTrace occFace / occChest + the replay test use it. */
export function herOcclusion(lens:readonly number[],feet:readonly number[],boxes:readonly OccBox[]):{face:boolean;chest:boolean}{
 const f=[feet[0],feet[1]+1.45,feet[2]],c=[feet[0],feet[1]+1.05,feet[2]];
 return {face:lensLevel(f,lens,boxes,0)>0,chest:lensLevel(c,lens,boxes,0)>0};}
