/**
 * b16 free-explore walkable areas for island / meadow / skycity / lakeside. Pure, no cc. API: docs/b16/walkable/API.md.
 * Data: RegionWalkableData.ts (tools/region-walkable/bake-region-walkable.cjs). Every position here is MODEL-LOCAL metres of that
 * region's scene (the region GLB frame = RegionNodes.ts / LakesideRegionNodes.ts frame). Convert world <-> local with the
 * region model node's worldMatrix (RegionNodeStage.toWorld / toLocal).
 */
import {REGION_WALKABLE_DATA,type WalkableData} from './RegionWalkableData';
export type WalkRegion='island'|'meadow'|'skycity'|'lakeside';
export type WVec=readonly [number,number,number];
export const WALK_REGIONS:readonly WalkRegion[]=['island','meadow','skycity','lakeside'];
export const WALK_STEP_M=.36;
const B64='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function decode64(s:string):Uint8Array{
 const clean=s.replace(/=+$/,''),out=new Uint8Array(Math.floor(clean.length*3/4));let bits=0,acc=0,o=0;
 for(let i=0;i<clean.length;i++){acc=((acc<<6)|B64.indexOf(clean[i]))&0xffffff;bits+=6;if(bits>=8){bits-=8;out[o++]=(acc>>bits)&255;}}
 return out;
}
export type WalkGrid=Readonly<{region:WalkRegion;W:number;H:number;c:number;x0:number;z0:number;waterY:number|null;minY:number;h:Float32Array/* NaN = not walkable */}>;
const grids:Partial<Record<WalkRegion,WalkGrid>>={};
export function walkGrid(region:WalkRegion):WalkGrid{
 const hit=grids[region];if(hit)return hit;
 const D:WalkableData=REGION_WALKABLE_DATA[region];if(!D)throw Error('no-walkable '+region);
 const bits=decode64(D.bits),dh=decode64(D.dh),n=D.W*D.H,h=new Float32Array(n);let p=0,cm=0,k=0;
 for(let ci=0;ci<n;ci++){
  if(!(bits[ci>>3]&(1<<(ci&7)))){h[ci]=NaN;continue;}
  let z=0,shift=0,b=0;do{b=dh[p++];z|=(b&127)<<shift;shift+=7;}while(b&128);
  cm+=(z&1)?-((z+1)>>1):(z>>1);h[ci]=cm/100;k++;
 }
 if(k!==D.cells)throw Error('walkable-decode '+region+' '+k+'/'+D.cells);
 const g={region,W:D.W,H:D.H,c:D.c,x0:D.x0,z0:D.z0,waterY:D.waterY,minY:D.minY,h};grids[region]=g;return g;
}
function cellOf(g:WalkGrid,x:number,z:number):number{const gx=Math.floor((x-g.x0)/g.c),gz=Math.floor((z-g.z0)/g.c);return gx<0||gz<0||gx>=g.W||gz>=g.H?-1:gz*g.W+gx;}
function centre(g:WalkGrid,ci:number):WVec{return [+(g.x0+(ci%g.W+.5)*g.c).toFixed(3),g.h[ci],+(g.z0+(((ci/g.W)|0)+.5)*g.c).toFixed(3)];}
/** Floor height (m) where she can stand at local (x,z), or null (water, wall, trunk, off the baked area). */
export function walkFloorY(region:WalkRegion,x:number,z:number):number|null{const g=walkGrid(region),ci=cellOf(g,x,z);if(ci<0)return null;const y=g.h[ci];return Number.isNaN(y)?null:y;}
export function isWalkable(region:WalkRegion,x:number,z:number):boolean{return walkFloorY(region,x,z)!==null;}
export type NearestHit=Readonly<{at:WVec;distanceM:number;exact:boolean}>;
/** Nearest standable point to `pos` (local). Same cell -> pos itself on the floor height (exact). Otherwise the closest walkable cell
 *  centre within `radiusM` (default 3 m), preferring floors within 1.5 m of pos.y (so a stair top is not snapped to the ground
 *  below). null when nothing is within the radius. */
export function nearestWalkable(region:WalkRegion,pos:WVec,radiusM=3):NearestHit|null{
 const g=walkGrid(region),ci=cellOf(g,pos[0],pos[2]);
 if(ci>=0&&!Number.isNaN(g.h[ci]))return {at:[pos[0],g.h[ci],pos[2]],distanceM:Math.abs(g.h[ci]-pos[1])>1.5?Math.abs(g.h[ci]-pos[1]):0,exact:true};
 const r=Math.ceil(radiusM/g.c),gx=Math.floor((pos[0]-g.x0)/g.c),gz=Math.floor((pos[2]-g.z0)/g.c);let best:WVec|null=null,bd=Infinity;
 for(let dz=-r;dz<=r;dz++)for(let dx=-r;dx<=r;dx++){const x=gx+dx,z=gz+dz;if(x<0||z<0||x>=g.W||z>=g.H)continue;const k=z*g.W+x;if(Number.isNaN(g.h[k]))continue;
  const c=centre(g,k),d=Math.hypot(c[0]-pos[0],c[2]-pos[2]);if(d>radiusM)continue;const score=d+(Math.abs(c[1]-pos[1])>1.5?10:0);if(score<bd){bd=score;best=c;}}
 return best?{at:best,distanceM:+Math.hypot(best[0]-pos[0],best[2]-pos[2]).toFixed(3),exact:false}:null;
}
export type WalkTap=Readonly<{kind:'walk';at:WVec}|{kind:'water';at:WVec}|{kind:'none'}>;
/** March a local-space ray and report the first walkable floor it meets ('walk'), the water surface ('water', regions with waterY),
 *  or 'none' (sky, wall, off the area). */
/** Regions whose taps that land on a prop / wall / planter (a blocked cell next to walkable floor) walk to the floor in front of
 *  it instead of 'none' (b17 skycity-walk-r2: S3 west planter, x≈9.9–10.7 z≈9). Not lakeside / island / meadow: their water and
 *  river must still answer 'water' / 'none'. */
export const WALK_TAP_SNAP:readonly WalkRegion[]=['skycity'];
export function walkRayHit(region:WalkRegion,o:WVec,d:WVec,maxM=160,stepM=.05):WalkTap{
 const g=walkGrid(region),L=Math.hypot(d[0],d[1],d[2])||1,u=[d[0]/L,d[1]/L,d[2]/L],floorMin=g.minY-2,snap=WALK_TAP_SNAP.indexOf(region)>=0;
 let lastF:number|null=null,cand:WVec|null=null,inBlock=false;
 for(let t=0;t<=maxM;t+=stepM){const x=o[0]+u[0]*t,y=o[1]+u[1]*t,z=o[2]+u[2]*t;
  const f=walkFloorY(region,x,z);
  if(f!==null&&y<=f+.02&&y>=f-.6)return {kind:'walk',at:[x,f,z]};
  if(snap){
   if(f!==null){lastF=f;inBlock=false;if(cand&&y<f-.6)break;} // the ray went under the floor past the obstacle: it hit the obstacle
   else if(!inBlock){inBlock=true;
    // entering a blocked run under head height: the floor in front of it (≤1.6 m, from 0.3 m back along the ray). The LAST such
    // run before the ray dives under the floor is the obstacle it hit; earlier runs it flew over.
    if(lastF!==null&&y<=lastF+1.8){const back=Math.max(0,t-.3),h=nearestWalkable(region,[o[0]+u[0]*back,lastF,o[2]+u[2]*back],1.6);cand=h?h.at:null;}
    else cand=null;
   }
  }
  if(g.waterY!==null&&f===null&&y<=g.waterY)return {kind:'water',at:[x,g.waterY,z]};
  if(y<floorMin)break;
 }
 return cand?{kind:'walk',at:cand}:{kind:'none'};
}
/** True when every 0.1 m sample of the segment stands on walkable cells with no step > 0.36 m. */
export function lineWalkable(region:WalkRegion,a:WVec,b:WVec):boolean{
 const n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[2]-a[2])/.1));let prev=walkFloorY(region,a[0],a[2]);if(prev===null)return false;
 for(let k=1;k<=n;k++){const t=k/n,y=walkFloorY(region,a[0]+(b[0]-a[0])*t,a[2]+(b[2]-a[2])*t);if(y===null||Math.abs(y-prev)>WALK_STEP_M)return false;prev=y;}
 return true;
}
/** A* over walkable cells (8-neighbour, step limit, no corner cut). Simplified local polyline from `from` to `to`, or null when
 *  `to` is not reachable (other shore, behind a wall, off the area). Ends are snapped with nearestWalkable (from: 1.6 m, to: 0.6 m). */
export function walkPath(region:WalkRegion,from:WVec,to:WVec,maxNodes=60000):WVec[]|null{
 const g=walkGrid(region),A=nearestWalkable(region,from,1.6),Bn=nearestWalkable(region,to,.6);if(!A||!Bn)return null;
 const a=A.at,b=Bn.at,s=cellOf(g,a[0],a[2]),e=cellOf(g,b[0],b[2]);if(s<0||e<0)return null;
 if(s===e)return [a,b];
 const W=g.W,H=g.H,gs=new Float64Array(W*H).fill(Infinity),par=new Int32Array(W*H).fill(-1),closed=new Uint8Array(W*H);
 const ex=e%W,ez=(e/W)|0,hf=(ci:number)=>Math.hypot(ci%W-ex,((ci/W)|0)-ez)*g.c;
 const heap:number[]=[],fs:number[]=[];
 const push=(ci:number,f:number)=>{heap.push(ci);fs.push(f);let i=heap.length-1;while(i>0){const p=(i-1)>>1;if(fs[p]<=fs[i])break;[heap[p],heap[i]]=[heap[i],heap[p]];[fs[p],fs[i]]=[fs[i],fs[p]];i=p;}};
 const pop=():number=>{const top=heap[0],lh=heap.pop()!,lf=fs.pop()!;if(heap.length){heap[0]=lh;fs[0]=lf;let i=0;for(;;){const l=i*2+1,r=l+1;let m=i;if(l<heap.length&&fs[l]<fs[m])m=l;if(r<heap.length&&fs[r]<fs[m])m=r;if(m===i)break;[heap[m],heap[i]]=[heap[i],heap[m]];[fs[m],fs[i]]=[fs[i],fs[m]];i=m;}}return top;};
 gs[s]=0;push(s,hf(s));let seen=0;
 while(heap.length){const ci=pop();if(closed[ci])continue;closed[ci]=1;if(ci===e)break;if(++seen>maxNodes)return null;
  const gx=ci%W,gz=(ci/W)|0,y=g.h[ci],stepScale=g.c/.4;
  for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dz)continue;const nx=gx+dx,nz=gz+dz;if(nx<0||nz<0||nx>=W||nz>=H)continue;const nc=nz*W+nx,y2=g.h[nc];
   if(Number.isNaN(y2)||closed[nc])continue;const diag=dx&&dz?Math.SQRT2:1;if(Math.abs(y2-y)>WALK_STEP_M*diag*stepScale)continue;
   if(dx&&dz&&(Number.isNaN(g.h[gz*W+nx])||Number.isNaN(g.h[nz*W+gx])))continue;
   const ng=gs[ci]+diag*g.c;if(ng<gs[nc]){gs[nc]=ng;par[nc]=ci;push(nc,ng+hf(nc));}}}
 if(!closed[e])return null;
 const cells:number[]=[];for(let k=e;k!==-1;k=par[k])cells.push(k);cells.reverse();
 const pts:WVec[]=[a,...cells.slice(1,-1).map(c=>centre(g,c)),b];
 const out:WVec[]=[pts[0]];let i=0;
 while(i<pts.length-1){let j=pts.length-1;for(;j>i+1;j--)if(lineWalkable(region,pts[i],pts[j]))break;out.push(pts[j]);i=j;}
 return out;
}
export function walkPathLengthM(p:readonly WVec[]):number{let n=0;for(let i=1;i<p.length;i++)n+=Math.hypot(p[i][0]-p[i-1][0],p[i][1]-p[i-1][1],p[i][2]-p[i-1][2]);return n;}
