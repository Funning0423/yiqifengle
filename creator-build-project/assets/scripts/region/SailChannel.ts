import type {Vec} from '../world-r1/WorldFlowCore';
/** Hull mesh minimum Y in boat space (`sailboat.glb` hull). Waterline is y = 0. */
export const SAIL_HULL_MIN_Y=-0.4;
/** World Y of the dug estuary. Below the keel (waterline − 0.4) and below the sea plane (−0.91). */
export const SAIL_CHANNEL_FLOOR_Y=-1.62;
export type SailRect={x0:number;x1:number;z0:number;z1:number};
/**
 * Rectangle of water at the landing, in world XZ.
 * Inset from M0 (x ≈ endX − 1.85) so the path stays on grass, and past the bow so the keel is not on the bank slope.
 * Meadow triangles are ~2.8 m, so the runtime splits any triangle that crosses this edge before lowering.
 */
export function sailLandingRect(samples:readonly Vec[]):SailRect{
 const end=samples[samples.length-1];
 return {x0:end[0]-1.45,x1:end[0]+5.4,z0:end[2]-22,z1:end[2]+4.8};
}
export function sailChannelContains(x:number,z:number,samples:readonly Vec[]):boolean{
 const r=sailLandingRect(samples);
 return x>=r.x0&&x<=r.x1&&z>=r.z0&&z<=r.z1;
}
/** Lower a world-space vertex onto the channel floor. Vertices already below the floor stay put. */
export function sailChannelWorldY(x:number,z:number,y:number,samples:readonly Vec[]):number{
 return sailChannelContains(x,z,samples)?Math.min(y,SAIL_CHANNEL_FLOOR_Y):y;
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
function segHits(a:P,b:P,r:SailRect){
 const steps=8;
 for(let i=0;i<=steps;i++){
  const t=i/steps,x=a[0]+(b[0]-a[0])*t,z=a[2]+(b[2]-a[2])*t;
  if(x>=r.x0&&x<=r.x1&&z>=r.z0&&z<=r.z1)return true;
 }
 return false;
}
function overlaps(a:P,b:P,c:P,r:SailRect){
 if(inRect(a,r)||inRect(b,r)||inRect(c,r))return true;
 if(segHits(a,b,r)||segHits(b,c,r)||segHits(c,a,r))return true;
 return [[r.x0,r.z0],[r.x1,r.z0],[r.x0,r.z1],[r.x1,r.z1]].some(([x,z])=>pointInTri(x,z,a,b,c));
}
function lower(p:P,r:SailRect):P{return inRect(p,r)?[p[0],Math.min(p[1],SAIL_CHANNEL_FLOOR_Y),p[2]]:p;}
/** Split coarse meadow triangles that cross the cut, then drop the part inside the rectangle. */
export function carveTriangle(a:P,b:P,c:P,rect:SailRect,depth=0):P[][]{
 const long=Math.max(Math.hypot(a[0]-b[0],a[2]-b[2]),Math.hypot(b[0]-c[0],b[2]-c[2]),Math.hypot(c[0]-a[0],c[2]-a[2]));
 if(depth<4&&long>0.45&&overlaps(a,b,c,rect)&&!(inRect(a,rect)&&inRect(b,rect)&&inRect(c,rect))){
  const ab=mid(a,b),bc=mid(b,c),ca=mid(c,a);
  return [
   ...carveTriangle(a,ab,ca,rect,depth+1),
   ...carveTriangle(ab,b,bc,rect,depth+1),
   ...carveTriangle(ca,bc,c,rect,depth+1),
   ...carveTriangle(ab,bc,ca,rect,depth+1),
  ];
 }
 return [[lower(a,rect),lower(b,rect),lower(c,rect)]];
}
