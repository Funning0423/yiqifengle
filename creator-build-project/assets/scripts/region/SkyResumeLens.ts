/** 运镜bot full9-skyfollow: the S6-resume follow lens with REAL 1.1 m clearance and a clear sightline to her face / chest.
 *  Root cause (sky-resume-follow, 14 rows S0/S3): resumeSkyAtS6 wrote skyPreFollowLens raw — no clearance; at node corners its straight-back
 *  lens cut through walls / env_sky_ruins and inside the covered passages it sat in the masonry.
 *  Plan once at walk start (the path is known, she walks it at constant speed), pure, no cc:
 *   - trail curve: the walk path, extended back past its start, Gaussian-smoothed over arc length (σ TRAIL_SIGMA_M) — the lens trails
 *     her ALONG the walkway (the clear corridor), and the smoothing rounds the node corners (yaw / accel caps);
 *   - per 0.25 m of her arc: candidates (back distance along the trail × lift over the normal height); feasible = every occupied voxel of
 *     SkyLensVoxels (real skycity mesh, model-local) ≥ CLR_M from the lens AND the lens→face / lens→chest segments free;
 *   - a DP picks the cheapest feasible sequence with bounded change per step (eased rise to the clear height before a covered segment,
 *     eased descent after — never a jump), then a light smoothing.
 *  Runtime: her arc → interpolated (back, lift) → pose (aim through her); the first blendInS blend from the live lens (first frame = live). */
import type {Pose,Vec} from '../world-r1/WorldFlowCore';
import {SKY_PRE_FOLLOW} from './SkyLakePreWalk';
import {blendPose as lakeBlendPose} from './LakesideBalloon';
import {SKY_LENS_VOX} from './SkyLensVoxels';
import {b64Bytes,voxClear,type VoxGrid} from './LensVoxels';
export const SKY_RESUME_LENS=Object.freeze({clrM:1.15/* the test probes 1.15 m; voxel box distance is already conservative */,stepM:0.25,trailSigmaM:2.2,
 backs:[4.6,4.3,4.0,3.7,3.4,3.1,2.8,2.5,2.2,1.9,1.6,1.3,1.0] as readonly number[],lifts:[0,0.5,1,1.5,2,2.5,3,3.5,4,4.5,5,5.5,6,6.5,7] as readonly number[],sides:[-1.5,-1.25,-1,-0.75,-0.5,-0.25,0,0.25,0.5,0.75,1,1.25,1.5] as readonly number[],smoothIters:60,wLift:1,wBack:2,wSide:2,wChange:3,frameNdc:0.8,minAsp:0.46,smoothM:1.5});
let grid:VoxGrid|null=null;
export function skyVox():VoxGrid{if(!grid){const v=SKY_LENS_VOX;grid={size:v.size,origin:v.origin,dims:v.dims,bits:b64Bytes(v.bits)};}return grid;}
function occAt(g:VoxGrid,p:Vec):boolean{const s=g.size,o=g.origin,N=g.dims,i=Math.floor((p[0]-o[0])/s),j=Math.floor((p[1]-o[1])/s),k=Math.floor((p[2]-o[2])/s);
 if(i<0||j<0||k<0||i>=N[0]||j>=N[1]||k>=N[2])return false;const n=(k*N[1]+j)*N[0]+i;return !!(g.bits[n>>3]&(1<<(n&7)));}
/** segment a→b free of occupied voxels (stops 0.35 m short of b = her) */
export function voxSight(g:VoxGrid,a:Vec,b:Vec):boolean{const d=Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2]),n=Math.ceil(d/0.15);
 for(let i=1;i<n;i++){const u=i/n;if(u*d>d-0.35)break;if(occAt(g,[a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u,a[2]+(b[2]-a[2])*u]))return false;}return true;}
export type SkyResumePlan={P:readonly Vec[];A:number[];s0:number;step:number;back:number[];lift:number[];side:number[];trail:Vec[];trail0:number;feasible:boolean;worst:number};
export function arcOf(P:readonly Vec[]):number[]{const a=[0];for(let i=1;i<P.length;i++)a.push(a[i-1]+Math.hypot(P[i][0]-P[i-1][0],P[i][2]-P[i-1][2]));return a;}
/** point at arc s (extrapolated before the start / after the end along the end segments) */
export function arcAt(P:readonly Vec[],A:readonly number[],s:number):Vec{const n=P.length-1;let i=0;if(s>=A[n])i=n-1;else if(s>0)while(i<n-1&&A[i+1]<s)i++;
 const L=(A[i+1]-A[i])||1,u=(s-A[i])/L;return [P[i][0]+(P[i+1][0]-P[i][0])*u,P[i][1]+(P[i+1][1]-P[i][1])*u,P[i][2]+(P[i+1][2]-P[i][2])*u];}
export function arcOfHer(her:Vec,P:readonly Vec[],A:readonly number[]):number{let best=0,b=Infinity;for(let i=0;i+1<P.length;i++){const a=P[i],c=P[i+1],vx=c[0]-a[0],vz=c[2]-a[2],l2=vx*vx+vz*vz||1,u=Math.max(0,Math.min(1,((her[0]-a[0])*vx+(her[2]-a[2])*vz)/l2)),dx=a[0]+vx*u-her[0],dz=a[2]+vz*u-her[2],d=dx*dx+dz*dz;if(d<b){b=d;best=A[i]+u*(A[i+1]-A[i]);}}return best;}
function lensAt(pl:{P:readonly Vec[];A:number[];trail:Vec[];trail0:number;step:number},s:number,back:number,lift:number,side=0):Vec{
 const k=SKY_PRE_FOLLOW,u=(s-back-pl.trail0)/pl.step,i=Math.max(0,Math.min(pl.trail.length-2,Math.floor(u))),f=Math.max(0,Math.min(1,u-i)),a=pl.trail[i],b=pl.trail[i+1];
 const floorY=arcAt(pl.P,pl.A,s)[1],tx=b[0]-a[0],tz=b[2]-a[2],tl=Math.hypot(tx,tz)||1;return [a[0]+(b[0]-a[0])*f+tz/tl*side,floorY+k.upM+lift,a[2]+(b[2]-a[2])*f-tx/tl*side];}
/** pose from a lens point: aim through her (aheadM past her, aimUpM) */
function aimPose(p:Vec,her:Vec):Pose{const k=SKY_PRE_FOLLOW,hx=her[0]-p[0],hz=her[2]-p[2],hl=Math.hypot(hx,hz)||1;return {position:p,target:[her[0]+hx/hl*k.aheadM,her[1]+k.aimUpM,her[2]+hz/hl*k.aheadM],fovVerticalDeg:k.fovDeg};}
export function ndc(c:Pose,q:Vec,asp:number):number{const f=[c.target[0]-c.position[0],c.target[1]-c.position[1],c.target[2]-c.position[2]],n=Math.hypot(f[0],f[1],f[2]);for(let i=0;i<3;i++)f[i]/=n;
 const r=[f[2],0,-f[0]],rn=Math.hypot(r[0],r[2])||1;r[0]/=rn;r[2]/=rn;const u=[f[1]*r[2]-f[2]*r[1],f[2]*r[0]-f[0]*r[2],f[0]*r[1]-f[1]*r[0]],d=[q[0]-c.position[0],q[1]-c.position[1],q[2]-c.position[2]],z=d[0]*f[0]+d[1]*f[1]+d[2]*f[2];if(z<=0.05)return 9;
 const th=Math.tan((c.fovVerticalDeg??46)*Math.PI/360);return Math.max(Math.abs((d[0]*r[0]+d[2]*r[2])/z/(th*asp)),Math.abs((d[0]*u[0]+d[1]*u[1]+d[2]*u[2])/z/th));}
/** toLocal: world → skycity model-local (the voxel space). */
export function planSkyResume(P:readonly Vec[],toLocal:(w:Vec)=>Vec,K=SKY_RESUME_LENS):SkyResumePlan{
 const g=skyVox(),A=arcOf(P),end=A[A.length-1],step=K.stepM,trail0=-8,nT=Math.ceil((end+2-trail0)/step)+1,raw:Vec[]=[];
 for(let i=0;i<nT;i++)raw.push(arcAt(P,A,trail0+i*step));
 const sg=K.trailSigmaM/step,R=Math.ceil(3*sg),trail:Vec[]=raw.map((_,i)=>{let w=0,x=0,z=0;for(let j=-R;j<=R;j++){const q=raw[Math.max(0,Math.min(nT-1,i+j))],ww=Math.exp(-j*j/(2*sg*sg));w+=ww;x+=q[0]*ww;z+=q[2]*ww;}return [x/w,0,z/w];});
 const pl={P,A,trail,trail0,step},nS=Math.floor(end/step)+1,B=K.backs,Lf=K.lifts,Sd=K.sides,nL=Lf.length,nB=B.length,nc=Sd.length*nB*nL,dec=(c:number)=>({si:Math.floor(c/(nB*nL)),bi:Math.floor(c/nL)%nB,li:c%nL});
 const ok:boolean[][]=[];for(let si=0;si<nS;si++){const s=si*step,her=arcAt(P,A,s),face:Vec=[her[0],her[1]+1.5,her[2]],chest:Vec=[her[0],her[1]+1.2,her[2]],fl=toLocal(face),cl=toLocal(chest),row:boolean[]=[];
  for(const sd of Sd)for(const b of B)for(const l of Lf){const w=lensAt(pl,s,b,l,sd),p=toLocal(w),c=aimPose(w,her);row.push(ndc(c,face,K.minAsp)<=K.frameNdc&&ndc(c,chest,K.minAsp)<=K.frameNdc&&voxClear(g,p,K.clrM)&&voxSight(g,p,fl)&&voxSight(g,p,cl));}ok.push(row);}
 /* DP: cost = lift + 0.6·(4.6−back) (+1e4 if infeasible) + change penalty; |Δlift| ≤ dLiftMax, |Δback| ≤ dBackMax per step... per step = (dLiftMax·stepM) */
 const dl=K.dLiftMax*step+1e-9,db=K.dBackMax*step+1e-9,BIG=1e4,cost=(si:number,c:number)=>{const d=dec(c);return (ok[si][c]?0:BIG)+Lf[d.li]*K.wLift+(4.6-B[d.bi])*K.wBack+Math.abs(Sd[d.si])*K.wSide;};
 /* the grid of lifts/backs is coarser than one step's allowed change, so the DP runs on "levels" with a dwell: allow a 1-level change every
  * ceil(level/(rate·step)) steps — implemented as: change allowed only if |Δ| ≤ one grid level, then the result is smoothed */
 void dl;void db;
 let D=new Float64Array(nc),prev:Int32Array[]=[];for(let c=0;c<nc;c++)D[c]=cost(0,c);
 for(let si=1;si<nS;si++){const E=new Float64Array(nc).fill(Infinity),pr=new Int32Array(nc);
  for(let c=0;c<nc;c++){const d=dec(c),cc=cost(si,c);
   for(let s2=Math.max(0,d.si-1);s2<=Math.min(Sd.length-1,d.si+1);s2++){for(let b2=Math.max(0,d.bi-1);b2<=Math.min(nB-1,d.bi+1);b2++)for(let l2=Math.max(0,d.li-1);l2<=Math.min(nL-1,d.li+1);l2++){const p=(s2*nB+b2)*nL+l2,v=D[p]+cc+(p!==c?K.wChange:0);if(v<E[c]){E[c]=v;pr[c]=p;}}}}
  prev.push(pr);D=E;}
 let c=0;for(let k=1;k<nc;k++)if(D[k]<D[c])c=k;const seq=new Array(nS);seq[nS-1]=c;for(let si=nS-1;si>0;si--){c=prev[si-1][c];seq[si-1]=c;}
 let worst=0;const back0=seq.map(c=>B[dec(c).bi]),side0=seq.map(c=>Sd[dec(c).si]),lift0=seq.map((c,si)=>{if(!ok[si][c])worst++;return Lf[dec(c).li];});
 /* feasibility-preserving smoothing: repeated 5-tap averaging of (back, lift, side); a sample takes the smoothed value only if that lens is
  * still feasible (clearance, sightline, framing) — so the result is as smooth as the geometry allows and never leaves the clear space */
 const feas=(si:number,b:number,l:number,sd:number)=>{const s=si*step,her=arcAt(P,A,s),face:Vec=[her[0],her[1]+1.5,her[2]],chest:Vec=[her[0],her[1]+1.2,her[2]],w=lensAt(pl,s,b,l,sd),p=toLocal(w),c=aimPose(w,her);
  return ndc(c,face,K.minAsp)<=K.frameNdc&&ndc(c,chest,K.minAsp)<=K.frameNdc&&voxClear(g,p,K.clrM)&&voxSight(g,p,toLocal(face))&&voxSight(g,p,toLocal(chest));};
 const back=back0.slice(),lift=lift0.slice(),side=side0.slice(),av=(v:number[],i:number)=>{let t=0;for(let j=-2;j<=2;j++)t+=v[Math.max(0,Math.min(nS-1,i+j))];return t/5;};
 for(let it=0;it<K.smoothIters;it++){const nb=back.map((_,i)=>av(back,i)),nl=lift.map((_,i)=>av(lift,i)),ns=side.map((_,i)=>av(side,i));
  for(let i=0;i<nS;i++){if(feas(i,nb[i],nl[i],ns[i])){back[i]=nb[i];lift[i]=nl[i];side[i]=ns[i];}else if(feas(i,back[i],nl[i],side[i]))lift[i]=nl[i];}}
 return {P,A,s0:0,step,back,lift,side,trail,trail0,feasible:worst===0,worst};}
export function skyResumePose(pl:SkyResumePlan,her:Vec):Pose{const k=SKY_PRE_FOLLOW,s=arcOfHer(her,pl.P,pl.A),u=s/pl.step,i=Math.max(0,Math.min(pl.back.length-2,Math.floor(u))),f=Math.max(0,Math.min(1,u-i));
 const b=pl.back[i]+(pl.back[i+1]-pl.back[i])*f,l=pl.lift[i]+(pl.lift[i+1]-pl.lift[i])*f,sd=pl.side[i]+(pl.side[i+1]-pl.side[i])*f,p=lensAt(pl,s,b,l,sd),dy=her[1]-arcAt(pl.P,pl.A,s)[1];p[1]+=dy;
 const hx=her[0]-p[0],hz=her[2]-p[2],hl=Math.hypot(hx,hz)||1;
 return {position:p,target:[her[0]+hx/hl*k.aheadM,her[1]+k.aimUpM,her[2]+hz/hl*k.aheadM],fovVerticalDeg:k.fovDeg};}
export const SKY_RESUME_YAW=Object.freeze({omega:4,yawDegS:100,accDegS2:240});
export type SkyResumeState={yaw:number;v:number};
/** Runtime lens: planned position; the view HEADING is a critically damped follower (rate ≤ yawDegS, accel ≤ accDegS2) of the heading through
 *  her, so the walking yaw caps hold by construction; pitch / target height as planned. First blendInS: blend from the live lens. */
export function skyResumeLens(pl:SkyResumePlan,her:Vec,t:number,live:Pose|null,dt=0,prev:SkyResumeState|null=null):{pose:Pose;state:SkyResumeState}{
 const raw=skyResumePose(pl,her),K=SKY_RESUME_YAW,D=Math.PI/180,p=raw.position,want=Math.atan2(raw.target[0]-p[0],raw.target[2]-p[2]),s=prev?{...prev}:{yaw:want,v:0};
 if(prev&&dt>0){let e=want-s.yaw;e=Math.atan2(Math.sin(e),Math.cos(e));const acc=Math.max(-K.accDegS2*D,Math.min(K.accDegS2*D,K.omega*K.omega*e-2*K.omega*s.v));
  s.v=Math.max(-K.yawDegS*D,Math.min(K.yawDegS*D,s.v+acc*dt));s.yaw+=s.v*dt;}
 const hd=Math.hypot(raw.target[0]-p[0],raw.target[2]-p[2]),pose:Pose={position:p,target:[p[0]+Math.sin(s.yaw)*hd,raw.target[1],p[2]+Math.cos(s.yaw)*hd],fovVerticalDeg:raw.fovVerticalDeg};
 return {pose:live&&t<SKY_PRE_FOLLOW.blendInS?lakeBlendPose(live,pose,t/SKY_PRE_FOLLOW.blendInS):pose,state:s};}
/** inverse of SkyWalkShot.skyLocalToWorld (world → skycity model-local) */
export function skyWorldToLocal(m:{world:readonly number[];worldYawDeg:number;pos:readonly number[];yawDeg:number},w:readonly number[]):Vec{const r=(m.worldYawDeg-m.yawDeg)*Math.PI/180,c=Math.cos(r),s=Math.sin(r),l=m.pos;
 const o=[m.world[0]-(c*l[0]+s*l[2]),m.world[1]-l[1],m.world[2]-(-s*l[0]+c*l[2])],d=[w[0]-o[0],w[1]-o[1],w[2]-o[2]];return [c*d[0]-s*d[2],d[1],s*d[0]+c*d[2]];}
