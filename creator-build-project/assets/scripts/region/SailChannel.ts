import type {Vec} from '../world-r1/WorldFlowCore';
import {SAIL_SEA_Y} from './TransportLeg';
/** Hull mesh minimum Y in boat space (`sailboat.glb` hull). Waterline is y = 0. */
export const SAIL_HULL_MIN_Y=-0.4;
/** World Y of the dug estuary. Below the keel (waterline − 0.4) and below the sea plane (−0.91). */
export const SAIL_CHANNEL_FLOOR_Y=-1.62;
export type SailRect={x0:number;x1:number;z0:number;z1:number};
/**
 * Visible landing pocket only. A long canal through the meadow would show up in K3–K5.
 * Port (+X) opens toward the pier and M0.
 */
export function sailLandingRect(samples:readonly Vec[]):SailRect{
 const end=samples[samples.length-1];
 return {x0:end[0]-3.4,x1:end[0]+4.6,z0:end[2]-10.5,z1:end[2]+3.6};
}
function nearLateRoute(x:number,z:number,samples:readonly Vec[],radius:number):boolean{
 if(samples.length<2)return false;
 const endZ=samples[samples.length-1][2];
 for(let i=0;i<samples.length;i++){
  const a=samples[i];
  if(a[2]<endZ-20)continue;
  const b=samples[Math.min(samples.length-1,i+1)];
  const abx=b[0]-a[0],abz=b[2]-a[2],len=Math.hypot(abx,abz)||1;
  const t=Math.max(0,Math.min(1,((x-a[0])*abx+(z-a[2])*abz)/(len*len)));
  const px=a[0]+abx*t,pz=a[2]+abz*t;
  if(Math.hypot(x-px,z-pz)<=radius)return true;
 }
 return false;
}
export function sailChannelContains(x:number,z:number,samples:readonly Vec[]):boolean{
 const r=sailLandingRect(samples);
 return x>=r.x0&&x<=r.x1&&z>=r.z0&&z<=r.z1;
}
/**
 * Visible land: only the landing pocket.
 * Already-underwater meadow: push down along the last 20 m of the route so the keel clears without new banks.
 */
export function sailChannelWorldY(x:number,z:number,y:number,samples:readonly Vec[]):number{
 if(sailChannelContains(x,z,samples))return Math.min(y,SAIL_CHANNEL_FLOOR_Y);
 if(y<=SAIL_SEA_Y+0.03&&nearLateRoute(x,z,samples,2.35))return Math.min(y,SAIL_CHANNEL_FLOOR_Y);
 return y;
}
type P=[number,number,number];
const mid=(a:P,b:P):P=>[(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2];
function inRect(p:P,r:SailRect){return p[0]>=r.x0&&p[0]<=r.x1&&p[2]>=r.z0&&p[2]<=r.z1;}
function pointInTri(x:number,z:number,a:P,b:P,c:P){
 const den=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);
 if(Math.abs(den)<1e-8)return false;
 const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/den;
 const v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/den;
 const w=1-u-v;
 return u>=-1e-4&&v>=-1e-4&&w>=-1e-4;
}
function overlaps(a:P,b:P,c:P,r:SailRect){
 if(inRect(a,r)||inRect(b,r)||inRect(c,r))return true;
 const steps=8;
 for(const [p,q] of [[a,b],[b,c],[c,a]] as const){
  for(let i=0;i<=steps;i++){
   const t=i/steps,x=p[0]+(q[0]-p[0])*t,z=p[2]+(q[2]-p[2])*t;
   if(x>=r.x0&&x<=r.x1&&z>=r.z0&&z<=r.z1)return true;
  }
 }
 return [[r.x0,r.z0],[r.x1,r.z0],[r.x0,r.z1],[r.x1,r.z1]].some(([x,z])=>pointInTri(x,z,a,b,c));
}
function lower(p:P,samples:readonly Vec[]):P{
 return [p[0],sailChannelWorldY(p[0],p[2],p[1],samples),p[2]];
}
/** Split coarse meadow triangles that cross the visible landing cut, then drop verts that need clearance. */
export function carveTriangle(a:P,b:P,c:P,rect:SailRect,samples:readonly Vec[],depth=0):P[][]{
 const long=Math.max(Math.hypot(a[0]-b[0],a[2]-b[2]),Math.hypot(b[0]-c[0],b[2]-c[2]),Math.hypot(c[0]-a[0],c[2]-a[2]));
 const splitLand=overlaps(a,b,c,rect)&&!(inRect(a,rect)&&inRect(b,rect)&&inRect(c,rect));
 if(depth<4&&long>0.45&&splitLand){
  const ab=mid(a,b),bc=mid(b,c),ca=mid(c,a);
  return [
   ...carveTriangle(a,ab,ca,rect,samples,depth+1),
   ...carveTriangle(ab,b,bc,rect,samples,depth+1),
   ...carveTriangle(ca,bc,c,rect,samples,depth+1),
   ...carveTriangle(ab,bc,ca,rect,samples,depth+1),
  ];
 }
 return [[lower(a,samples),lower(b,samples),lower(c,samples)]];
}
