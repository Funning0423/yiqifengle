/** Transition follow shots on HER real path (segments A1–A6, B1–B5). Pure (no cc). GGbot feeds her live feet/yaw (or the
 *  scripted timeline built here from 场景设计部's transition-anchors.json); the lens is a 3/4 follow with slow variety on long
 *  walks (azimuth / arm drift, no cuts), an occlusion + clearance search against transition-occluders.json boxes, smoothed,
 *  then the eased yaw caps (TransitionCamera.ViewLimiter: walk ≤120°/s ≤300°/s², stand/seated ≤90°/s ≤200°/s²). */
import type {Pose,Vec} from '../world-r1/WorldFlowCore';
import {ViewLimiter} from './TransitionCamera';
export type HerPose='stand'|'walk'|'seated';
export type HerSample={feet:Vec;yawDeg:number;pose:HerPose};
export type Beat=Readonly<{kind:'walk';path:readonly Vec[];seconds:number;clip?:string}|{kind:'hold';at:Vec;yawDeg?:number;seconds:number;pose:'stand'|'seated';clip?:string}>;
export type Box=readonly [number,number,number,number,number,number];
export const HER_SHOT=Object.freeze({arm:4.6,up:1.7,lookUp:1.15,fov:50,azDeg:150/* behind-right of her heading */,
 /** long-walk variety: slow azimuth + arm drift (sine, period s) — gentle, never a cut */
 driftAzDeg:22,driftArm:.7,driftPeriodS:14,driftFromS:6,
 /** occlusion / clearance search */
 searchDeg:[0,12,-12,24,-24,36,-36,50,-50,65,-65,80,-80] as readonly number[],clearM:1.1,sampleS:.2,smoothS:1.2,headingSmoothS:1.2,
 chestM:1.2,faceM:1.5,seatedChestM:.75,seatedFaceM:1.0,seatedElevDeg:34});
const R=Math.PI/180;
const seg=(a:readonly number[],b:readonly number[])=>Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2]);
function along(path:readonly Vec[],d:number):{p:Vec;dir:[number,number]}{let acc=0;for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i],l=seg(a,b);
  if(acc+l>=d||i===path.length-1){const u=l>0?Math.max(0,Math.min(1,(d-acc)/l)):0,h=Math.hypot(b[0]-a[0],b[2]-a[2])||1;return {p:[a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u,a[2]+(b[2]-a[2])*u],dir:[(b[0]-a[0])/h,(b[2]-a[2])/h]};}acc+=l;}
 return {p:[path[0][0],path[0][1],path[0][2]],dir:[0,1]};}
/** Her scripted timeline from beats. Walks ease in/out over 0.4 s (production walk start/stop). */
export function herTimeline(beats:readonly Beat[]):{total:number;at:(t:number)=>HerSample;beatAt:(t:number)=>number}{
 const t0:number[]=[];let T=0;for(const b of beats){t0.push(T);T+=b.seconds;}
 let lastYaw=0;const yawAt:number[]=[];for(const b of beats){if(b.kind==='walk'){const d=along(b.path,0).dir;lastYaw=Math.atan2(d[0],d[1])/R;}else if(b.yawDeg!==undefined)lastYaw=b.yawDeg;yawAt.push(lastYaw);}
 const beatAt=(t:number)=>{let i=0;while(i<beats.length-1&&t>=t0[i+1])i++;return i;};
 const at=(t:number):HerSample=>{const i=beatAt(Math.max(0,Math.min(T,t))),b=beats[i],u=Math.max(0,Math.min(b.seconds,t-t0[i]));
  if(b.kind==='hold')return {feet:[b.at[0],b.at[1],b.at[2]],yawDeg:b.yawDeg??(i?yawAt[i-1]:0),pose:b.pose};
  let L=0;for(let k=1;k<b.path.length;k++)L+=seg(b.path[k-1],b.path[k]);const e=Math.min(.4,b.seconds/3),v=L/(b.seconds-e);
  const d=u<e?v*u*u/(2*e):u>b.seconds-e?L-v*(b.seconds-u)*(b.seconds-u)/(2*e):v*(u-e/2);
  const s=along(b.path,Math.max(0,Math.min(L,d)));return {feet:s.p,yawDeg:Math.atan2(s.dir[0],s.dir[1])/R,pose:'walk'};};
 return {total:T,at,beatAt};}
/** Segment from a to b hits an AABB (slab). */
export function segBox(a:readonly number[],b:readonly number[],x:Box):boolean{let t0=0,t1=1;for(let k=0;k<3;k++){const d=b[k]-a[k],lo=x[k],hi=x[k+3];
  if(Math.abs(d)<1e-9){if(a[k]<lo||a[k]>hi)return false;continue;}let u0=(lo-a[k])/d,u1=(hi-a[k])/d;if(u0>u1){const s=u0;u0=u1;u1=s;}t0=Math.max(t0,u0);t1=Math.min(t1,u1);if(t0>t1)return false;}return true;}
export function boxDist(p:readonly number[],x:Box):number{const d=[0,1,2].map(k=>Math.max(x[k]-p[k],0,p[k]-x[k+3]));return Math.hypot(d[0],d[1],d[2]);}
export function inBox(p:readonly number[],x:Box):boolean{return p[0]>x[0]&&p[0]<x[3]&&p[1]>x[1]&&p[1]<x[4]&&p[2]>x[2]&&p[2]<x[5];}
/** Raw lens for her at a heading (smoothed) with an azimuth offset. */
/** seated in a basket / boat: look down on her chest from ≥ seatedElevDeg so the rim never covers it (as lakesideRimLift) */
function rawLens(h:HerSample,headDeg:number,azOff:number,arm:number,k=HER_SHOT,seatW=h.pose==='seated'?1:0):Pose{const a=(headDeg+k.azDeg+azOff)*R,
 look=k.lookUp+(k.seatedChestM-k.lookUp)*seatW,up=k.up+(k.seatedChestM+arm*Math.tan(k.seatedElevDeg*R)-k.up)*seatW,c:Vec=[h.feet[0],h.feet[1]+look,h.feet[2]];
 return {position:[h.feet[0]+Math.sin(a)*arm,h.feet[1]+up,h.feet[2]+Math.cos(a)*arm],target:c,fovVerticalDeg:k.fov};}
export function lensOk(p:Pose,h:HerSample,boxes:readonly Box[],k=HER_SHOT):boolean{const s=h.pose==='seated',face:Vec=[h.feet[0],h.feet[1]+(s?k.seatedFaceM:k.faceM),h.feet[2]],chest:Vec=[h.feet[0],h.feet[1]+(s?k.seatedChestM:k.chestM),h.feet[2]];
 for(const b of boxes){if(boxDist(p.position,b)<k.clearM)return false;if(segBox(p.position,face,b)||segBox(p.position,chest,b))return false;}return true;}
/** Precomputed follow shot over [0,T]: per-sample best azimuth (closest to the drifting base that is clear), smoothed, then capped. */
export function followShot(her:(t:number)=>HerSample,T:number,boxes:readonly Box[],k=HER_SHOT):{pose:(t:number)=>Pose;clearFrac:number;plan:{az:number[];arm:number[];up:number[]}}{
 const n=Math.ceil(T/k.sampleS)+1,head:number[]=[],az:number[]=[],arm:number[]=[],ups:number[]=[],offs:number[][]=[];let clear=0;
 /* full2-cam: optional extra lens heights (m over k.up) tried after the azimuth search fails (SkyWalkShot: foliage on the 5a walk); absent = unchanged */
 const lifts:readonly number[]=(k as any).liftSearch??[0],arms:readonly number[]=(k as any).armSearch??[0];
 // heading: her yaw, unwrapped and smoothed (a stand/seated hold, incl. turning in place, keeps the last walking heading — the lens does not orbit a turn-in-place, it lets her turn to face it)
 const raw:number[]=[];for(let i=0;i<n;i++){const hs=her(i*k.sampleS);if(i&&hs.pose!=='walk'){raw.push(raw[i-1]);continue;}const y=hs.yawDeg;raw.push(i?raw[i-1]+(((y-raw[i-1])%360+540)%360-180):y);}
 const w=Math.round(k.headingSmoothS/k.sampleS);for(let i=0;i<n;i++){let s=0,W=0;for(let j=-w;j<=w;j++){const q=raw[Math.max(0,Math.min(n-1,i+j))],ww=w+1-Math.abs(j);s+=q*ww;W+=ww;}head.push(s/W);}
 for(let i=0;i<n;i++){const t=i*k.sampleS,h=her(t),dr=t>k.driftFromS?Math.sin(2*Math.PI*(t-k.driftFromS)/k.driftPeriodS):0,base=k.driftAzDeg*dr,A=k.arm+k.driftArm*Math.sin(2*Math.PI*(t-k.driftFromS)/(k.driftPeriodS*1.7))*(t>k.driftFromS?1:0);
  let pick=base,ok=false,up=0;let armD=0;const plan=(k as any).plan as {az:number[];arm:number[];up:number[]}|undefined,okFn=(k as any).okFn as ((p:Pose,h:HerSample)=>boolean)|undefined;
  if(plan&&i<plan.az.length){pick=base+plan.az[i];armD=plan.arm[i];up=plan.up[i];ok=true;}
  else for(const o of k.searchDeg){for(const da of arms){for(const dl of lifts){const kk=dl?{...k,up:k.up+dl}:k;const L=rawLens(h,head[i],base+o,A+da,kk,h.pose==='seated'?1:0);if(lensOk(L,h,boxes,kk)&&(!okFn||okFn(L,h))){pick=base+o;ok=true;up=dl;armD=da;break;}}if(ok)break;}if(ok)break;}
  offs.push([pick-base,armD,up]);/* nearest azimuth first; a lift before a swing */
  if(ok)clear++;az.push(pick);arm.push(A+armD);ups.push(up);}
 /* full2-cam offline (k.okFn given, generator only): replace the greedy picks by the smoothest clear sequence — DP over a 6° × arm × height
  * grid, cost = |Δaz| + 4·|Δarm| + 4·|Δup| between samples + 0.02·|az| (stay near the authored framing); unclear samples keep the greedy pick. */
 if((k as any).okFn&&!(k as any).plan){const okFn=(k as any).okFn as (p:Pose,h:HerSample)=>boolean,grid:number[][][]=[];const azs:number[]=[];for(let d=-84;d<=84;d+=6)azs.push(d);
  for(let i=0;i<n;i++){const t=i*k.sampleS,h=her(t),base=az[i]-offs[i][0],A=arm[i]-offs[i][1],c:number[][]=[];
   for(const o of azs)for(const da of arms)for(const dl of lifts){const kk=dl?{...k,up:k.up+dl}:k,L=rawLens(h,head[i],base+o,A+da,kk,h.pose==='seated'?1:0);if(lensOk(L,h,boxes,kk)&&okFn(L,h))c.push([o,da,dl]);}
   grid.push(c.length?c:[offs[i]]);}
  const cost:number[][]=[],from:number[][]=[];for(let i=0;i<n;i++){cost.push([]);from.push([]);for(let j=0;j<grid[i].length;j++){const g=grid[i][j],own=0.02*Math.abs(g[0]);
   if(!i){cost[i].push(own);from[i].push(-1);continue;}let best=Infinity,bj=0;for(let q=0;q<grid[i-1].length;q++){const p=grid[i-1][q],v=cost[i-1][q]+Math.abs(g[0]-p[0])+4*Math.abs(g[1]-p[1])+4*Math.abs(g[2]-p[2]);if(v<best){best=v;bj=q;}}cost[i].push(best+own);from[i].push(bj);}}
  let j=0;for(let q=1;q<cost[n-1].length;q++)if(cost[n-1][q]<cost[n-1][j])j=q;for(let i=n-1;i>=0;i--){const g=grid[i][j],base=az[i]-offs[i][0],A=arm[i]-offs[i][1];offs[i]=[g[0],g[1],g[2]];az[i]=base+g[0];arm[i]=A+g[1];ups[i]=g[2];j=from[i][j];}}
 const sm=(a:number[])=>{const m=Math.round(k.smoothS/k.sampleS);return a.map((_,i)=>{let s=0,W=0;for(let j=-m;j<=m;j++){const ww=m+1-Math.abs(j);s+=a[Math.max(0,Math.min(n-1,i+j))]*ww;W+=ww;}return s/W;});};
 const seat=sm(sm(Array.from({length:n},(_,i)=>her(i*k.sampleS).pose==='seated'?1:0))),azS=sm(sm(az)),armS=sm(arm),upS=sm(sm(ups));
 const lerpA=(a:number[],t:number)=>{const x=Math.max(0,Math.min(n-1,t/k.sampleS)),i=Math.min(n-2,Math.floor(x)),u=x-i;return a[i]+(a[i+1]-a[i])*u;};
 return {clearFrac:clear/n,plan:{az:offs.map(o=>o[0]),arm:offs.map(o=>o[1]),up:offs.map(o=>o[2])},pose:t=>{const du=lerpA(upS,t);return rawLens(her(t),lerpA(head,t),lerpA(azS,t),lerpA(armS,t),du?{...k,up:k.up+du}:k,lerpA(seat,t));}};}
/** Stateful writer: follow pose through the eased yaw caps (walk / stand-seated mode from her pose). */
export class FollowWriter{private lim=new ViewLimiter();constructor(private shot:{pose:(t:number)=>Pose},private her:(t:number)=>HerSample){}
 reset(p:Pose,yawRate=0){this.lim.reset(p,yawRate);}
 step(t:number,dt:number):Pose{return this.lim.step(this.shot.pose(t),dt,this.her(t).pose==='walk'?'walk':'stand');}}

/** Yaw-cap mode for ViewLimiter: walking caps only while she keeps walking for the next leadS, so the lens is already at the standing
 *  caps (≤90°/s) on the frame she stops (decelerating 120→90 °/s at 300 °/s² takes 0.1 s). */
export function capMode(her:(t:number)=>HerSample,leadS=0.2):(t:number)=>'walk'|'stand'{
 return t=>{for(let u=0;u<=leadS+1e-9;u+=leadS/4)if(her(t+u).pose!=='walk')return 'stand';return 'walk';};}
