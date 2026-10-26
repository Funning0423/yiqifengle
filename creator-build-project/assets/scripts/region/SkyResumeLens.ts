/** 运镜bot full9-skyfollow: the S6-resume follow lens with REAL 1.1 m clearance and a clear sightline to her face / chest.
 *  Root cause (sky-resume-follow, 14 rows S0/S3): resumeSkyAtS6 wrote skyPreFollowLens raw — no clearance; at node corners its straight-back
 *  lens cut through walls / env_sky_ruins and inside the covered passages it sat in the masonry.
 *  Plan once at walk start (the path is known, she walks it at constant speed), pure, no cc:
 *   - trail curve: the walk path, extended back past its start, Gaussian-smoothed over arc length (σ TRAIL_SIGMA_M) — the lens trails
 *     her ALONG the walkway (the clear corridor), and the smoothing rounds the node corners (yaw / accel caps);
 *   - per 0.25 m of her arc: candidates (back distance along the trail × lift over the normal height); feasible = every occupied voxel of
 *     the real-mesh voxels (offline bake only, tools/skycity-walk/SkyResumePlanner.ts) ≥ CLR_M from the lens AND the lens→face / lens→chest segments free;
 *   - a DP picks the cheapest feasible sequence with bounded change per step (eased rise to the clear height before a covered segment,
 *     eased descent after — never a jump), then a light smoothing.
 *  Runtime: her arc → interpolated (back, lift) → pose (aim through her); the first blendInS blend from the live lens (first frame = live). */
import type {Pose,Vec} from '../world-r1/WorldFlowCore';
import {SKY_PRE_FOLLOW,skyLakePreWalk} from './SkyLakePreWalk';
import {REGION_NODES} from './RegionNodes';
import {skyLocalToWorld} from './SkyWalkShot';
import {S0_GAME} from './BalloonFlight';
import {blendPose as lakeBlendPose} from './LakesideBalloon';
import {SKY_RESUME_PLANS} from './SkyResumePlans';
export const SKY_RESUME_LENS=Object.freeze({clrM:1.15/* the test probes 1.15 m; voxel box distance is already conservative */,stepM:0.25,trailSigmaM:2.2,
 backs:[4.6,4.3,4.0,3.7,3.4,3.1,2.8,2.5,2.2,1.9,1.6,1.3,1.0] as readonly number[],lifts:[0,0.5,1,1.5,2,2.5,3,3.5,4,4.5,5,5.5,6,6.5,7] as readonly number[],sides:[-1.5,-1.25,-1,-0.75,-0.5,-0.25,0,0.25,0.5,0.75,1,1.25,1.5] as readonly number[],smoothIters:60,wLift:1,wBack:2,wSide:2,wChange:3,frameNdc:0.8,minAsp:0.46,smoothM:1.5});
export type SkyResumePlan={P:readonly Vec[];A:number[];s0:number;step:number;back:number[];lift:number[];side:number[];trail:Vec[];trail0:number;feasible:boolean;worst:number};
export function arcOf(P:readonly Vec[]):number[]{const a=[0];for(let i=1;i<P.length;i++)a.push(a[i-1]+Math.hypot(P[i][0]-P[i-1][0],P[i][2]-P[i-1][2]));return a;}
/** point at arc s (extrapolated before the start / after the end along the end segments) */
export function arcAt(P:readonly Vec[],A:readonly number[],s:number):Vec{const n=P.length-1;let i=0;if(s>=A[n])i=n-1;else if(s>0)while(i<n-1&&A[i+1]<s)i++;
 const L=(A[i+1]-A[i])||1,u=(s-A[i])/L;return [P[i][0]+(P[i+1][0]-P[i][0])*u,P[i][1]+(P[i+1][1]-P[i][1])*u,P[i][2]+(P[i+1][2]-P[i][2])*u];}
export function arcOfHer(her:Vec,P:readonly Vec[],A:readonly number[]):number{let best=0,b=Infinity;for(let i=0;i+1<P.length;i++){const a=P[i],c=P[i+1],vx=c[0]-a[0],vz=c[2]-a[2],l2=vx*vx+vz*vz||1,u=Math.max(0,Math.min(1,((her[0]-a[0])*vx+(her[2]-a[2])*vz)/l2)),dx=a[0]+vx*u-her[0],dz=a[2]+vz*u-her[2],d=dx*dx+dz*dz;if(d<b){b=d;best=A[i]+u*(A[i+1]-A[i]);}}return best;}
export function lensAt(pl:{P:readonly Vec[];A:number[];trail:Vec[];trail0:number;step:number},s:number,back:number,lift:number,side=0):Vec{
 const k=SKY_PRE_FOLLOW,u=(s-back-pl.trail0)/pl.step,i=Math.max(0,Math.min(pl.trail.length-2,Math.floor(u))),f=Math.max(0,Math.min(1,u-i)),a=pl.trail[i],b=pl.trail[i+1];
 const floorY=arcAt(pl.P,pl.A,s)[1],tx=b[0]-a[0],tz=b[2]-a[2],tl=Math.hypot(tx,tz)||1;return [a[0]+(b[0]-a[0])*f+tz/tl*side,floorY+k.upM+lift,a[2]+(b[2]-a[2])*f-tx/tl*side];}
/** pose from a lens point: aim through her (aheadM past her, aimUpM) */
export function aimPose(p:Vec,her:Vec):Pose{const k=SKY_PRE_FOLLOW,hx=her[0]-p[0],hz=her[2]-p[2],hl=Math.hypot(hx,hz)||1;return {position:p,target:[her[0]+hx/hl*k.aheadM,her[1]+k.aimUpM,her[2]+hz/hl*k.aheadM],fovVerticalDeg:k.fovDeg};}
export function ndc(c:Pose,q:Vec,asp:number):number{const f=[c.target[0]-c.position[0],c.target[1]-c.position[1],c.target[2]-c.position[2]],n=Math.hypot(f[0],f[1],f[2]);for(let i=0;i<3;i++)f[i]/=n;
 const r=[f[2],0,-f[0]],rn=Math.hypot(r[0],r[2])||1;r[0]/=rn;r[2]/=rn;const u=[f[1]*r[2]-f[2]*r[1],f[2]*r[0]-f[0]*r[2],f[0]*r[1]-f[1]*r[0]],d=[q[0]-c.position[0],q[1]-c.position[1],q[2]-c.position[2]],z=d[0]*f[0]+d[1]*f[1]+d[2]*f[2];if(z<=0.05)return 9;
 const th=Math.tan((c.fovVerticalDeg??46)*Math.PI/360);return Math.max(Math.abs((d[0]*r[0]+d[2]*r[2])/z/(th*asp)),Math.abs((d[0]*u[0]+d[1]*u[1]+d[2]*u[2])/z/th));}
/** trail curve: walk path extended 8 m back, Gaussian-smoothed over arc (cheap; rebuilt from a baked plan too) */
export function skyTrail(P:readonly Vec[],K=SKY_RESUME_LENS):{A:number[];trail:Vec[];trail0:number;step:number}{
 const A=arcOf(P),end=A[A.length-1],step=K.stepM,trail0=-8,nT=Math.ceil((end+2-trail0)/step)+1,raw:Vec[]=[];
 for(let i=0;i<nT;i++)raw.push(arcAt(P,A,trail0+i*step));
 const sg=K.trailSigmaM/step,R=Math.ceil(3*sg),trail:Vec[]=raw.map((_,i)=>{let w=0,x=0,z=0;for(let j=-R;j<=R;j++){const q=raw[Math.max(0,Math.min(nT-1,i+j))],ww=Math.exp(-j*j/(2*sg*sg));w+=ww;x+=q[0]*ww;z+=q[2]*ww;}return [x/w,0,z/w];});
 return {A,trail,trail0,step};}
/** key of a walk path (rounded to 1 mm) + the planner constants — a baked plan is used only for the identical path */
export function skyPathKey(P:readonly Vec[]):string{let h=2166136261;const str=JSON.stringify(P.map(p=>p.map(v=>Math.round(v*1000))))+JSON.stringify(SKY_RESUME_LENS);
 for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}return h.toString(16)+':'+P.length;}
export type BakedSkyPlan={from:string;key:string;alias?:string;back:readonly number[];lift:readonly number[];side:readonly number[];feasible:boolean;worst:number};
export function planFromBaked(P:readonly Vec[],b:BakedSkyPlan):SkyResumePlan{const t=skyTrail(P);return {P,A:t.A,s0:0,step:t.step,back:b.back.slice(),lift:b.lift.slice(),side:b.side.slice(),trail:t.trail,trail0:t.trail0,feasible:b.feasible,worst:b.worst};}
/** runtime entry: the baked plan for this walk (SkyResumePlans, zero planning) or — logged by the caller via .baked=false — the live planner */
/** SkyResumePlans rows store back/lift/side as integer-millimetre deltas (first absolute), zigzag, base-32 varint chars (0–31 last group,
 *  32–63 continue). Decoded value = integer mm / 1000 = exactly the baked Math.round(v·1000)/1000. */
const MM64='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
export function mmDecode(s:string):number[]{const o:number[]=[];let a=0,z=0,m=1;for(let i=0;i<s.length;i++){const c=MM64.indexOf(s.charAt(i));if(c<0)throw new Error('mmDecode');
 if(c>=32){z+=(c-32)*m;m*=32;continue;}z+=c*m;a+=(z&1)?-(z+1)/2:z/2;o.push(a/1000);z=0;m=1;}return o;}
let decoded:BakedSkyPlan[]|null=null;
export function bakedSkyPlans():BakedSkyPlan[]{return decoded||(decoded=SKY_RESUME_PLANS.map((p:any)=>({from:p.from,key:p.key,alias:p.alias,feasible:p.feasible,worst:p.worst,back:mmDecode(p.back),lift:mmDecode(p.lift),side:mmDecode(p.side)})));}
/** full9b option A (Grok Bot): the runtime never plans. Exact walk → its baked plan. Otherwise (FALLBACK, logged once by the caller as
 *  '[QF_SKY_RESUME] fallback-live') → the baked plan of the NEAREST start node, on that start's own baked walk path (her walk joins it at the
 *  start: her own node walk joins that path at the start node; before that her arc is clamped to 0). Valid only within SKY_RESUME_REUSE_M of a start (gated by test_sky_resume_fallback_reuse.cjs on the
 *  real mesh); outside it the caller first walks her to the nearest start along the node graph (skyResumeApproach). */
/** S0L (balloon landing, 3.2 m from S0 — where the resume really starts) uses S0's baked plan on S0's path (gated, real mesh). */
export const SKY_RESUME_ALIAS:{[from:string]:string}={S0L:'S0'};
export const SKY_RESUME_REUSE_M=0.75/* gated: 0.75 m passes all offsets; 1 m fails S2+N1.0 (clearance) */;
type Mooring={world:readonly number[];worldYawDeg:number;pos:readonly number[];yawDeg:number;walkWorld:readonly (readonly number[])[]};
export function skyResumeStarts(m:Mooring):{key:string;at:Vec;path:Vec[]}[]{const out:{key:string;at:Vec;path:Vec[]}[]=[];
 const add=(key:string,at:Vec)=>{const pre=skyLakePreWalk(at,m as any);if(pre)out.push({key,at,path:pre.path});};
 for(const n of REGION_NODES.skycity.nodes)add(n.key,skyLocalToWorld(m as any,n.at) as Vec);add('S0L',[S0_GAME[0],S0_GAME[1],S0_GAME[2]]);/* S0L = the balloon landing (where the resume actually starts) */return out;}
export function skyNearestStart(her:Vec,m:Mooring):{key:string;at:Vec;path:Vec[];dM:number}|null{let best:any=null;
 for(const s of skyResumeStarts(m)){const d=Math.hypot(her[0]-s.at[0],her[1]-s.at[1],her[2]-s.at[2]);if(!best||d<best.dM)best={...s,dM:d};}return best;}
export function skyResumePlanFor(P:readonly Vec[],m:Mooring):{plan:SkyResumePlan;walk:Vec[];baked:boolean;key:string;from:string;dM:number;inRadius:boolean}|null{
 const key=skyPathKey(P),force=!!(globalThis as any).__QF_SKY_FORCE_FALLBACK,all=bakedSkyPlans(),b=force?undefined:all.find(x=>x.key===key);
 const starts=skyResumeStarts(m),use=(from:string)=>{const t=SKY_RESUME_ALIAS[from]||from,st=starts.find(x=>x.key===t),pb=st&&all.find(x=>x.from===t&&x.key===skyPathKey(st.path));return st&&pb?{st,pb}:null;};
 if(b){if(!b.alias)return {plan:planFromBaked(P,b),walk:P.slice(),baked:true,key,from:b.from,dM:0,inRadius:true};const u=use(b.from);if(u)return {plan:planFromBaked(u.st.path,u.pb),walk:P.slice(),baked:true,key,from:b.from,dM:0,inRadius:true};}
 const n=skyNearestStart(P[0],m);if(!n)return null;const u=use(n.key);if(!u)return null;const nb=u.pb;n.path=u.st.path;
 return {plan:planFromBaked(n.path,nb),walk:P.slice(),baked:false,key,from:n.key,dM:n.dM,inRadius:n.dM<=SKY_RESUME_REUSE_M};}
export function skyResumePose(pl:SkyResumePlan,her:Vec):Pose{const k=SKY_PRE_FOLLOW,s=arcOfHer(her,pl.P,pl.A),u=s/pl.step,i=Math.max(0,Math.min(pl.back.length-2,Math.floor(u))),f=Math.max(0,Math.min(1,u-i));
 const b=pl.back[i]+(pl.back[i+1]-pl.back[i])*f,l=pl.lift[i]+(pl.lift[i+1]-pl.lift[i])*f,sd=pl.side[i]+(pl.side[i+1]-pl.side[i])*f,p=lensAt(pl,s,b,l,sd),dy=her[1]-arcAt(pl.P,pl.A,s)[1];p[1]+=dy;
 const hx=her[0]-p[0],hz=her[2]-p[2],hl=Math.hypot(hx,hz)||1;
 return {position:p,target:[her[0]+hx/hl*k.aheadM,her[1]+k.aimUpM,her[2]+hz/hl*k.aheadM],fovVerticalDeg:k.fovDeg};}
export const SKY_RESUME_YAW=Object.freeze({omega:6,yawDegS:100,accDegS2:240});
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
