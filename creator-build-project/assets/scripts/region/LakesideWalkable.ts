/**
 * 风铃湖畔 explore walkable area (b16 P1-3). Pure, no cc. Data: LakesideWalkableData.ts, baked from the r5h3 export by
 * tools/lakeside-walkable/bake-lakeside-walkable.cjs (grass shore + LK_bridge boardwalk; the lake surface y=0 is never walkable).
 * All coordinates are lakeside model-local metres (the LakesideJourneyScene node / scene_r5h_slim_transforms.json frame).
 */
import {LAKESIDE_WALKABLE_DATA as D} from './LakesideWalkableData';
export type LVec=readonly [number,number,number];
const B64='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function decode64(s:string):Uint8Array{
 const clean=s.replace(/=+$/,''),out=new Uint8Array(Math.floor(clean.length*3/4));let bits=0,acc=0,o=0;
 for(let i=0;i<clean.length;i++){acc=(acc<<6)|B64.indexOf(clean[i]);bits+=6;if(bits>=8){bits-=8;out[o++]=(acc>>bits)&255;}}
 return out;
}
type Grid={W:number;H:number;c:number;x0:number;z0:number;h:Float32Array/* NaN = not walkable */};
let grid:Grid|null=null;
export function lakesideWalkGrid():Grid{
 if(grid)return grid;
 const bits=decode64(D.bits),hb=decode64(D.heights),n=D.W*D.H,h=new Float32Array(n);let k=0;
 for(let ci=0;ci<n;ci++){if(bits[ci>>3]&(1<<(ci&7))){let v=hb[k*2]|(hb[k*2+1]<<8);if(v&0x8000)v-=0x10000;h[ci]=v/100;k++;}else h[ci]=NaN;}
 if(k!==D.cells)throw Error('lakeside-walkable-decode '+k+'/'+D.cells);
 grid={W:D.W,H:D.H,c:D.c,x0:D.x0,z0:D.z0,h};return grid;
}
export const LAKESIDE_WATER_Y=D.waterY;
export const LAKESIDE_STEP_M=.36;
function cellOf(x:number,z:number):number{const g=lakesideWalkGrid(),gx=Math.floor((x-g.x0)/g.c),gz=Math.floor((z-g.z0)/g.c);return gx<0||gz<0||gx>=g.W||gz>=g.H?-1:gz*g.W+gx;}
/** Floor height (m) where she can stand, or null (water, house, tree trunk, outside the baked box). */
export function lakesideFloorY(x:number,z:number):number|null{const ci=cellOf(x,z);if(ci<0)return null;const y=lakesideWalkGrid().h[ci];return Number.isNaN(y)?null:y;}
export function lakesideWalkable(x:number,z:number):boolean{return lakesideFloorY(x,z)!==null;}
function centre(ci:number):LVec{const g=lakesideWalkGrid();return [+(g.x0+(ci%g.W+.5)*g.c).toFixed(3),g.h[ci],+(g.z0+(((ci/g.W)|0)+.5)*g.c).toFixed(3)];}
/** Nearest walkable cell centre within `radiusM` (her current spot may sit a hair off the baked grid). */
export function lakesideSnap(p:LVec,radiusM=1.2):LVec|null{
 const g=lakesideWalkGrid(),ci=cellOf(p[0],p[2]);if(ci>=0&&!Number.isNaN(g.h[ci]))return [p[0],g.h[ci],p[2]];
 const r=Math.ceil(radiusM/g.c),gx=Math.floor((p[0]-g.x0)/g.c),gz=Math.floor((p[2]-g.z0)/g.c);let best:LVec|null=null,bd=Infinity;
 for(let dz=-r;dz<=r;dz++)for(let dx=-r;dx<=r;dx++){const x=gx+dx,z=gz+dz;if(x<0||z<0||x>=g.W||z>=g.H)continue;const k=z*g.W+x;if(Number.isNaN(g.h[k]))continue;
  const c=centre(k),d=Math.hypot(c[0]-p[0],c[2]-p[2]);if(d<=radiusM&&d<bd){bd=d;best=c;}}
 return best;
}
export type LakesideTap=Readonly<{kind:'walk';at:LVec}|{kind:'water';at:LVec}|{kind:'none'}>;
/** March a local-space ray (origin, unit-ish dir) and report the first floor or water it meets. */
export function lakesideRayHit(o:LVec,d:LVec,maxM=160,stepM=.05):LakesideTap{
 const L=Math.hypot(d[0],d[1],d[2])||1,u=[d[0]/L,d[1]/L,d[2]/L];
 for(let t=0;t<=maxM;t+=stepM){const x=o[0]+u[0]*t,y=o[1]+u[1]*t,z=o[2]+u[2]*t;
  const f=lakesideFloorY(x,z);
  if(f!==null&&y<=f+.02)return {kind:'walk',at:[x,f,z]};
  if(f===null&&y<=LAKESIDE_WATER_Y)return {kind:'water',at:[x,LAKESIDE_WATER_Y,z]};
 }
 return {kind:'none'};
}
/** A* on the walkable cells (8-neighbour, step <= 0.36 m per 0.4 m, no corner cut past water). Simplified local path or null
 *  when the goal is not on the same shore (the two shores are only joined by water). */
export function lakesidePath(from:LVec,to:LVec,maxNodes=40000):LVec[]|null{
 const g=lakesideWalkGrid(),a=lakesideSnap(from),b=lakesideSnap(to,.6);if(!a||!b)return null;
 const s=cellOf(a[0],a[2]),e=cellOf(b[0],b[2]);if(s<0||e<0)return null;
 if(s===e)return [a,b];
 const W=g.W,H=g.H,gs=new Float64Array(W*H).fill(Infinity),par=new Int32Array(W*H).fill(-1),closed=new Uint8Array(W*H);
 const ex=e%W,ez=(e/W)|0,hf=(ci:number)=>Math.hypot(ci%W-ex,((ci/W)|0)-ez)*g.c;
 const heap:number[]=[],fs:number[]=[];
 const push=(ci:number,f:number)=>{heap.push(ci);fs.push(f);let i=heap.length-1;while(i>0){const p=(i-1)>>1;if(fs[p]<=fs[i])break;[heap[p],heap[i]]=[heap[i],heap[p]];[fs[p],fs[i]]=[fs[i],fs[p]];i=p;}};
 const pop=():number=>{const top=heap[0],lh=heap.pop()!,lf=fs.pop()!;if(heap.length){heap[0]=lh;fs[0]=lf;let i=0;for(;;){const l=i*2+1,r=l+1;let m=i;if(l<heap.length&&fs[l]<fs[m])m=l;if(r<heap.length&&fs[r]<fs[m])m=r;if(m===i)break;[heap[m],heap[i]]=[heap[i],heap[m]];[fs[m],fs[i]]=[fs[i],fs[m]];i=m;}}return top;};
 gs[s]=0;push(s,hf(s));let seen=0;
 while(heap.length){const ci=pop();if(closed[ci])continue;closed[ci]=1;if(ci===e)break;if(++seen>maxNodes)return null;
  const gx=ci%W,gz=(ci/W)|0,y=g.h[ci];
  for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dz)continue;const nx=gx+dx,nz=gz+dz;if(nx<0||nz<0||nx>=W||nz>=H)continue;const nc=nz*W+nx,y2=g.h[nc];
   if(Number.isNaN(y2)||closed[nc])continue;const diag=dx&&dz?Math.SQRT2:1;if(Math.abs(y2-y)>LAKESIDE_STEP_M*diag)continue;
   if(dx&&dz&&(Number.isNaN(g.h[gz*W+nx])||Number.isNaN(g.h[nz*W+gx])))continue;
   const ng=gs[ci]+diag*g.c;if(ng<gs[nc]){gs[nc]=ng;par[nc]=ci;push(nc,ng+hf(nc));}}}
 if(!closed[e])return null;
 const cells:number[]=[];for(let k=e;k!==-1;k=par[k])cells.push(k);cells.reverse();
 const pts:LVec[]=[a,...cells.slice(1,-1).map(centre),b];
 // string-pull: drop a point when the straight line to the next keeper stays on walkable cells
 const out:LVec[]=[pts[0]];let i=0;
 while(i<pts.length-1){let j=pts.length-1;for(;j>i+1;j--)if(lakesideLineWalkable(pts[i],pts[j]))break;out.push(pts[j]);i=j;}
 return out;
}
/** True when every 0.1 m sample of the segment stands on a walkable cell (no water in between). */
export function lakesideLineWalkable(a:LVec,b:LVec):boolean{
 const n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[2]-a[2])/.1));let prev=lakesideFloorY(a[0],a[2]);if(prev===null)return false;
 for(let k=1;k<=n;k++){const t=k/n,y=lakesideFloorY(a[0]+(b[0]-a[0])*t,a[2]+(b[2]-a[2])*t);if(y===null||Math.abs(y-prev)>LAKESIDE_STEP_M)return false;prev=y;}
 return true;
}
export function pathLengthM(p:readonly LVec[]):number{let n=0;for(let i=1;i<p.length;i++)n+=Math.hypot(p[i][0]-p[i-1][0],p[i][1]-p[i-1][1],p[i][2]-p[i-1][2]);return n;}
