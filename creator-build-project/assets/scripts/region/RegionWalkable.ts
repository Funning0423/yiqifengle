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
export type WalkTap=Readonly<{kind:'walk';at:WVec;stay?:boolean}|{kind:'water';at:WVec}|{kind:'none'}>;
/** March a local-space ray and report the first walkable floor it meets ('walk'), the water surface ('water', regions with waterY),
 *  or 'none' (sky, wall, off the area). */
/** Regions whose taps that land on a prop / wall / planter (a blocked cell next to walkable floor) walk to the floor in front of
 *  it instead of 'none' (b17 skycity-walk-r2: S3 west planter, x≈9.9–10.7 z≈9). Not lakeside / island / meadow: their water and
 *  river must still answer 'water' / 'none'. */
export const WALK_TAP_SNAP:readonly WalkRegion[]=['skycity'];
/** Voxel field (skycity, b17 skycity-walk-r4): per cell the 0.25 m slabs that hold scene surface (walls, roofs, fence, roots,
 *  canopy, cliffs; on walkable cells only what stands > 0.3 m above the floor). */
type ObsField={slab:number;lo:Int32Array;off:Int32Array;cnt:Uint16Array;mask:Uint8Array};
const obsCache:Partial<Record<WalkRegion,ObsField|null>>={};
function obstacles(region:WalkRegion):ObsField|null{
 if(region in obsCache)return obsCache[region]!;
 const D=REGION_WALKABLE_DATA[region] as WalkableData&{obs?:string;obsH?:string;obsCells?:number;obsSlab?:number};
 if(!D.obs||!D.obsH||!D.obsSlab){obsCache[region]=null;return null;}
 const bits=decode64(D.obs),dh=decode64(D.obsH),n=D.W*D.H,lo=new Int32Array(n),off=new Int32Array(n).fill(-1),cnt=new Uint16Array(n);let p=0,prev=0,k=0;
 const vi=()=>{let z=0,shift=0,b=0;do{b=dh[p++];z|=(b&127)<<shift;shift+=7;}while(b&128);return z;};
 for(let ci=0;ci<n;ci++){if(!(bits[ci>>3]&(1<<(ci&7))))continue;const z=vi();prev+=(z&1)?-((z+1)>>1):(z>>1);lo[ci]=prev;cnt[ci]=vi();off[ci]=p;p+=Math.ceil(cnt[ci]/8);k++;}
 if(D.obsCells!==undefined&&k!==D.obsCells)throw Error('obstacle-decode '+region+' '+k+'/'+D.obsCells);
 const o={slab:D.obsSlab,lo,off,cnt,mask:dh};obsCache[region]=o;return o;
}
const OBS_THICK_M=.6,OBS_HEAD_M=2.5,OBS_LOW_M=1.8,WALL_CLEAR_M=1.5,WALL_TAP_M=3;
/** Top (m) of the contiguous occupied slabs in cell ci that hold height y: the object the ray is in, not the canopy above it. */
/** Bottom (m) of the contiguous occupied slabs in cell ci that hold height y. */
function runBot(o:ObsField,ci:number,y:number):number{let k=Math.floor(y/o.slab);while(solidAt(o,ci,(k-.5)*o.slab))k--;return k*o.slab;}
function runTop(o:ObsField,ci:number,y:number):number{let k=Math.floor(y/o.slab);while(solidAt(o,ci,(k+1.5)*o.slab))k++;return (k+1)*o.slab;}
/** Scene geometry above (x,z,y) within 4 m in this cell: the ray is under a roof / the ground it just went through. */
function roofed(o:ObsField,ci:number,y:number):boolean{for(let k=1;k*o.slab<=4;k++)if(solidAt(o,ci,y+k*o.slab))return true;return false;}
/** Floor height of the walkable cell nearest (x,z) in plan within r m, or null. */
function floorNear(region:WalkRegion,x:number,z:number,r:number):number|null{
 const g=walkGrid(region),n=Math.ceil(r/g.c),cx=Math.floor((x-g.x0)/g.c),cz=Math.floor((z-g.z0)/g.c);let best=Infinity,h:number|null=null;
 for(let dz=-n;dz<=n;dz++)for(let dx=-n;dx<=n;dx++){const gx=cx+dx,gz=cz+dz;if(gx<0||gz<0||gx>=g.W||gz>=g.H)continue;const v=g.h[gz*g.W+gx];if(Number.isNaN(v))continue;const d=dx*dx+dz*dz;if(d<best){best=d;h=v;}}
 return best<=n*n?h:null;
}
function solidAt(o:ObsField,ci:number,y:number):boolean{
 if(o.off[ci]<0)return false;const k=Math.floor(y/o.slab)-o.lo[ci];if(k<0||k>=o.cnt[ci])return false;return (o.mask[o.off[ci]+(k>>3)]&(1<<(k&7)))!==0;
}
/** Where she goes when a tap hits the scene at `at` (not a floor): the nearest walkable floor, first from 0.3 m back toward the
 *  camera (the side she sees), widening 1.6 → 3 → 6 → 12 → 24 m. All skycity floor is one component, so it is reachable. */
function tapSnap(region:WalkRegion,at:WVec,u:readonly number[],from?:WVec|null):WVec|null{
 const b:WVec=[at[0]-u[0]*.3,at[1],at[2]-u[2]*.3];
 // 方案 C (p0drag9): with her position, the floor cell that is cheapest to walk to (path + 2 × its plan distance to the hit): a tap into the fenced pocket / a thin fence stops her on HER side, not on the far side 15 m round.
 if(from){const best=snapNear(region,b,from);if(best)return best;}
 for(const r of [1.6,3,6,12,24]){const h=nearestWalkable(region,b,r);if(h)return h.at;}
 return null;
}
function snapNear(region:WalkRegion,b:WVec,from:WVec):WVec|null{
 const g=walkGrid(region),A=nearestWalkable(region,from,1.6);if(!A)return null;const s=cellOf(g,A.at[0],A.at[2]);if(s<0)return null;
 const W=g.W,H=g.H,dist=new Float64Array(W*H).fill(Infinity),heap:number[]=[],fs:number[]=[];
 const push=(ci:number,f:number)=>{heap.push(ci);fs.push(f);let i=heap.length-1;while(i>0){const p=(i-1)>>1;if(fs[p]<=fs[i])break;[heap[p],heap[i]]=[heap[i],heap[p]];[fs[p],fs[i]]=[fs[i],fs[p]];i=p;}};
 const pop=():number=>{const top=heap[0],lh=heap.pop()!,lf=fs.pop()!;if(heap.length){heap[0]=lh;fs[0]=lf;let i=0;for(;;){const l=i*2+1,r=l+1;let m=i;if(l<heap.length&&fs[l]<fs[m])m=l;if(r<heap.length&&fs[r]<fs[m])m=r;if(m===i)break;[heap[m],heap[i]]=[heap[i],heap[m]];[fs[m],fs[i]]=[fs[i],fs[m]];i=m;}}return top;};
 let best=-1,bestCost=Infinity;dist[s]=0;push(s,0);
 while(heap.length){const fv=fs[0],ci=pop();if(fv>dist[ci])continue;if(fv>=bestCost)break;
  const cc=centre(g,ci),dh=Math.hypot(cc[0]-b[0],cc[2]-b[2]);{const cost=fv+SNAP_OFF_W*dh;if(cost<bestCost){bestCost=cost;best=ci;}}
  const gx=ci%W,gz=(ci/W)|0,y=g.h[ci],sc=g.c/.4;
  for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dz)continue;const nx=gx+dx,nz=gz+dz;if(nx<0||nz<0||nx>=W||nz>=H)continue;const nc=nz*W+nx,y2=g.h[nc];
   if(Number.isNaN(y2))continue;const diag=dx&&dz?Math.SQRT2:1;if(Math.abs(y2-y)>WALK_STEP_M*diag*sc)continue;
   if(dx&&dz&&(Number.isNaN(g.h[gz*W+nx])||Number.isNaN(g.h[nz*W+gx])))continue;const nd=fv+diag*g.c;if(nd<dist[nc]){dist[nc]=nd;push(nc,nd);}}}
 return best<0?null:centre(g,best);
}
/** March a local-space ray and report the first walkable floor it meets ('walk'), the water surface ('water', regions with waterY),
 *  or 'none' (sky / off the area). WALK_TAP_SNAP regions (skycity, b17 skycity-walk-r4): the ray also stops on the baked obstacle
 *  voxel field (walls, houses, fence, roots, canopy, cliffs; 0.25 m slabs per cell) and a ray that slips under a floor hit its riser, and she walks to the nearest floor in front
 *  of that hit, so a ray that meets the scene never answers 'none'. */
/** r7 (Mac p0drag11): a tap that does not land on a floor (it met leaves, a planter, a pillar, the roofline…) and resolves to a point
 *  < STAY_NEAR_M from her in plan is not a walk: she does not move at all, not even onto her cell's centre (T1 0.4 m, T2 0.89 m).
 *  `stay` tells the caller not to walk; `at` is then exactly her position. A floor hit (the ground at her feet) still walks. */
export const STAY_NEAR_M=1.0;
/** snapNear: cost = path + SNAP_OFF_W × plan distance of the cell to the hit (r4: 2; r7: 3, the S3 pocket tap over the planter stopped her at x≈9, 2.4 m short of the pocket edge). */
let SNAP_OFF_W=3;export function __setSnapOffW(w:number){SNAP_OFF_W=w;}
export function walkRayHit(region:WalkRegion,o:WVec,d:WVec,maxM=160,stepM=.05,from:WVec|null=null):WalkTap{
 const h=walkRayHitRaw(region,o,d,maxM,stepM,from);
 if(from&&h.kind==='walk'&&!(h as any).floor&&Math.hypot(h.at[0]-from[0],h.at[2]-from[2])<STAY_NEAR_M)return {kind:'walk',at:[from[0],from[1],from[2]],stay:true};
 return h.kind==='walk'?{kind:'walk',at:h.at}:h;
}
function walkRayHitRaw(region:WalkRegion,o:WVec,d:WVec,maxM:number,stepM:number,from:WVec|null):WalkTap{
 const g=walkGrid(region),L=Math.hypot(d[0],d[1],d[2])||1,u=[d[0]/L,d[1]/L,d[2]/L],floorMin=g.minY-2,snap=WALK_TAP_SNAP.indexOf(region)>=0;
 const ob=snap?obstacles(region):null;let startIn=true,obsHit:WVec|null=null,solidM=0,over:WVec|null=null,lastIn:WVec|null=null,wasAbove=false,prevIn=false,prevCi=-1,runAt:WVec|null=null,countAt:WVec|null=null,lowHit:WVec|null=null;
 for(let t=0;t<=maxM;t+=stepM){const x=o[0]+u[0]*t,y=o[1]+u[1]*t,z=o[2]+u[2]*t;
  const ci=cellOf(g,x,z),f=ci<0||Number.isNaN(g.h[ci])?null:g.h[ci];
  if(f!==null&&y<=f+.02&&y>=f-.6){
   // came out of scene geometry (fence foot, the ground of a not-walkable pocket) under this floor's level: that geometry was the hit
   if(snap&&prevIn&&!startIn&&runAt&&y<f-.15){const at=tapSnap(region,runAt,u,from);if(at)return {kind:'walk',at};}
   return {kind:'walk',at:[x,f,z],floor:true} as WalkTap;}
  if(snap&&f!==null&&y<f-.6&&wasAbove){const at=tapSnap(region,[x,f,z],u,from);if(at)return {kind:'walk',at};} // under a floor = its riser / cliff face
  if(ob){let inS=ci>=0&&solidAt(ob,ci,y);
   // r5 (Mac p0drag9): a LOW object (planter, bench, low fence, low foliage: its run of voxels tops out ≤ 1.8 m over the nearby floor) does not stop a
   // tap above its own ground skin; she can see over it, and the floor beyond is the tap (E3/E6/Roof/W9 were stopped at the S3-east
   // planter, x≈9–11). Its ground skin (≤ 0.3 m over the floor) still counts, so the not-walkable pocket keeps answering.
   if(inS){const ref0=f!==null?f:floorNear(region,x,z,2);if(ref0!==null&&y>ref0+.3&&runTop(ob,ci,y)<=ref0+OBS_LOW_M){inS=false;if(!lowHit&&!startIn)lowHit=[x,y,z];}}
   // scene geometry: once the ray has gone through ≥ 0.6 m of it (wall, house, fence, roots, cliff; not a pole, a foliage card or
   // a lamp it grazes) she walks to the floor in front of where it entered. A camera that starts inside a voxel is not a hit.
   // canopy / eaves > 2.5 m over the nearby floor do not block a tap on the floor under them (they only answer when nothing else does)
   if(inS&&!startIn){if(!obsHit)obsHit=[x,y,z];const ref=f!==null?f:floorNear(region,x,z,2);
    // r6: a ground-rooted run that rises past head height (wall, house, trunk), crossed ≤ 3 m up (the wall face) walks her to its near
    // side; crossed higher (eaves, roofline, a crown in front of it) she stays. Either way the ray stops right here, however thin it is and
    // whatever height the ray crosses it at; before, a one-voxel wall crossed above 2.5 m let the ray fly on to far geometry.
    // Only past her and ≥ 1.5 m away in plan: the lens rides behind / over her and fades what is between it and her (Mac NE1),
    // and the 0.4 m voxels round the pillars by her would otherwise eat rays that only graze them.
    if(ref!==null&&(!from||((x-from[0])*u[0]+(z-from[2])*u[2]>0&&Math.hypot(x-from[0],z-from[2])>=WALL_CLEAR_M))&&runBot(ob,ci,y)<=ref+.5&&runTop(ob,ci,y)>=ref+OBS_HEAD_M){
     if(y<=ref+WALL_TAP_M){const at=tapSnap(region,[x,y,z],u,from);if(at)return {kind:'walk',at};}
     else if(from){const st=nearestWalkable(region,from,1.6);if(st)return {kind:'walk',at:st.at};}} // above the wall face (eaves, roofline): stay
    if(ref!==null&&y<=ref+OBS_HEAD_M){if(!countAt)countAt=[x,y,z];solidM+=stepM;}if(solidM>=OBS_THICK_M&&countAt){const at=tapSnap(region,countAt,u,from);if(at)return {kind:'walk',at};}}
   // went down THROUGH a surface (ground of a not-walkable cell, a fence or wall top): a hit, not a pass to the floor beyond / below
   if(inS&&!prevIn)runAt=[x,y,z];
   // (or through a wall into the hollow inside of a house: out of a voxel into a not-walkable cell)
   if(!inS&&prevIn&&!startIn&&runAt&&f===null&&ci>=0&&roofed(ob,ci,y)){const rf=floorNear(region,runAt[0],runAt[2],2);
    if(rf!==null&&runAt[1]<=rf+OBS_HEAD_M){const at=tapSnap(region,runAt,u,from);if(at)return {kind:'walk',at};}}
   prevIn=inS;prevCi=ci;
   if(inS)lastIn=[x,y,z];else startIn=false;}
  if(f!==null&&y>f)wasAbove=true;
  if(snap&&!over&&f!==null&&y>=f&&y-f<=4)over=[x,f,z]; // first floor the ray passes ≤ 4 m over (last resort below)
  if(g.waterY!==null&&f===null&&y<=g.waterY)return {kind:'water',at:[x,g.waterY,z]};
  if(y<floorMin)break;
 }
 // only thin / high geometry met and no floor beyond. Tree canopy, eaves (> 2.5 m over the floor under it): she stays where she is
 // (r5: a tap on the leaves walked her 6.9 m)
 if(obsHit){const rf=floorNear(region,obsHit[0],obsHit[2],2);if(from&&rf!==null&&obsHit[1]>rf+OBS_HEAD_M){const st=nearestWalkable(region,from,1.6);if(st)return {kind:'walk',at:st.at};}
  const at=tapSnap(region,obsHit,u,from);if(at)return {kind:'walk',at};}
 if(lowHit){const at=tapSnap(region,lowHit,u,from);if(at)return {kind:'walk',at};} // only a low planter / fence, nothing beyond
 if(over){const at=tapSnap(region,over,u,from);if(at)return {kind:'walk',at};}
 if(lastIn){const at=tapSnap(region,lastIn,u,from);if(at)return {kind:'walk',at};} // camera inside geometry the whole way (a tower, a canopy)
 return {kind:'none'};
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
/** Ground-tap path. b17 skycity-walk-r4 (Mac p0drag8): plain walkPath to the tapped floor (she reaches it, ≤0.3 m), the r3
 *  "stop on the near side when it is the long way round" rule is gone (it stopped her 1.5 m short of reachable floor). Kept as the
 *  stage's single entry point; null only when the floor is not reachable (one component in skycity, so never there). */
export function walkTapPath(region:WalkRegion,from:WVec,to:WVec):WVec[]|null{return walkPath(region,from,to);}
export function walkPathLengthM(p:readonly WVec[]):number{let n=0;for(let i=1;i<p.length;i++)n+=Math.hypot(p[i][0]-p[i-1][0],p[i][1]-p[i-1][1],p[i][2]-p[i-1][2]);return n;}
