/** T-02 (运镜bot, Grok Bot approved Oct 25): the last skycity shot before the lakeside set-off.
 * Old: finaleLook — 26 m back, 6 m up, fov 58, aimed between her head and the star-ring centre 20 m above her: mostly empty sky,
 * she ≈ 4 % of the frame (ISSUES T-02, shots/T02_sky_end_day.png).
 * New: a low hero angle a few metres from her, looking up past her at the near arc of the star ring (env_sky_starring, a 47 m
 * tilted ring at y 13–27 over the S6 plateau), so she, the ring and the city between fill the portrait frame.
 * Engine-free and deterministic: the stage passes her feet, her facing, the ring sample points and the skycity lens boxes, all in
 * ONE frame (skycity model-local = walk-local, or world). Constraints on ALL 7 portrait screens: her body inside the safe margins,
 * head/chest not hidden (guardEval), lens ≥ minClearM (1.1 m) from every box and not inside one, lens in front of her (face seen).
 * Kept: her ≥ minHerShare of the frame height and ≥ minRingShare of the ring samples on screen (worst screen each); score = ring share +
 * her share (a low side angle: her at a quarter of the frame, the ring arc across the top, the city between). */
import {guardEval,type OccBox} from './LensOcclusion';
import {herMargin} from './LensSmooth';
import {herOcclusion} from './LensAvoid';
import {SCREENS} from './ExploreCameraCore';
type V3=[number,number,number];
/** env_sky_starring vertices binned every 7.5° round the ring centroid (model-local, from env_skycity.glb). */
export const STAR_RING_LOCAL:readonly (readonly number[])[]=[[-1.01,25.43,-47.42],[-3.57,24.88,-46.58],[-6.51,24.35,-46.04],[-9.33,23.74,-45.1],[-12,23.07,-43.83],[-14.45,22.35,-42.2],[-17.15,21.47,-40.07],[-18.69,20.71,-37.72],[-20.26,20.01,-35.66],[-22.72,18.14,-29.16],[-22.92,17.5,-26.57],[-23.34,16.78,-23.75],[-22.64,16.15,-20.66],[-22.32,15.54,-17.9],[-21.28,15.14,-15.57],[-19.89,14.7,-12.9],[-18.2,14.34,-10.4],[-16.17,14.09,-8.15],[-13.9,13.93,-6.14],[-11.91,13.84,-4.57],[-9.18,13.96,-3.5],[-6.76,14.03,-2.35],[0.29,14.72,-1.14],[2.27,15,-1.18],[5.2,15.49,-1.57],[8.04,16.04,-2.3],[10.74,16.68,-3.39],[13.98,17.64,-5.19],[15.96,18.16,-7.01],[18.31,19.13,-9.32],[20.39,20.03,-11.95],[21.26,20.76,-14.51],[23.25,23.33,-24.28],[22.79,23.9,-26.95],[22.47,24.54,-29.86],[20.97,25.03,-32.82],[19.93,25.51,-35.46],[18.05,25.87,-38.09],[15.85,26,-39.95],[13.51,26.24,-42.34],[10.81,26.18,-43.64],[8.39,26.16,-44.99],[1.43,25.6,-46.69],[-0.29,25.28,-46.35]];
export const SKY_FINALE={fovDeg:50,minClearM:1.1,minRingShare:0.08,minHerShare:0.2,faceYawMaxDeg:180,
 /** approachS: shortest eased approach; holdS: seconds the shot is held (from the reward claim) before auto-continue; any input cancels it */
 approachS:1.4,holdS:5.5,bodyM:[0.05,1.6] as readonly [number,number]};
export type SkyFinaleShot={position:V3;target:V3;fovVerticalDeg:number;armM:number;herFrac:number[];ringShare:number;clearM:number;yawDeg:number;lookUpDeg:number};
const boxDist=(P:readonly number[],b:OccBox)=>Math.hypot(Math.max(b.min[0]-P[0],0,P[0]-b.max[0]),Math.max(b.min[1]-P[1],0,P[1]-b.max[1]),Math.max(b.min[2]-P[2],0,P[2]-b.max[2]));
/** Projected point: ndc x/y (|·| ≤ 1 on screen) for a look-at pose; null behind the lens. */
export function ndc(P:readonly number[],T:readonly number[],fov:number,W:number,H:number,q:readonly number[]):[number,number]|null{
 const f=[T[0]-P[0],T[1]-P[1],T[2]-P[2]],fl=Math.hypot(f[0],f[1],f[2])||1;for(let i=0;i<3;i++)f[i]/=fl;
 let r=[f[2],0,-f[0]];const rl=Math.hypot(r[0],r[2])||1;r=[r[0]/rl,0,r[2]/rl];const u=[r[1]*f[2]-r[2]*f[1],r[2]*f[0]-r[0]*f[2],r[0]*f[1]-r[1]*f[0]];
 const d=[q[0]-P[0],q[1]-P[1],q[2]-P[2]],z=d[0]*f[0]+d[1]*f[1]+d[2]*f[2];if(z<=0.05)return null;
 const tv=Math.tan(fov*Math.PI/360),th=tv*W/H;return [(d[0]*r[0]+d[1]*r[1]+d[2]*r[2])/(z*th),(d[0]*u[0]+d[1]*u[1]+d[2]*u[2])/(z*tv)];}
/** Her height share of the frame (feet+0.05 … +1.6 m), by projection of her centre line. */
export function herShare(P:readonly number[],T:readonly number[],fov:number,W:number,H:number,feet:readonly number[]):number{
 const a=ndc(P,T,fov,W,H,[feet[0],feet[1]+SKY_FINALE.bodyM[0],feet[2]]),b=ndc(P,T,fov,W,H,[feet[0],feet[1]+SKY_FINALE.bodyM[1],feet[2]]);return a&&b?Math.abs(b[1]-a[1])/2:0;}
export function ringShare(P:readonly number[],T:readonly number[],fov:number,W:number,H:number,ring:readonly (readonly number[])[]):number{
 let n=0;for(const q of ring){const s=ndc(P,T,fov,W,H,q);if(s&&Math.abs(s[0])<=1&&Math.abs(s[1])<=1)n++;}return n/Math.max(1,ring.length);}
export function skyFinaleShot(feet:readonly number[],faceYawRad:number,ring:readonly (readonly number[])[],boxes:readonly OccBox[],o:{screens?:readonly (readonly [number,number])[];fov?:number;
  /** optional real-mesh checks (bake tool / test only): lens clearance in metres, and whether a point is seen from the lens */
  clearAt?:(p:readonly number[])=>number;seen?:(from:readonly number[],to:readonly number[])=>boolean}={}):SkyFinaleShot|null{
 const S=SKY_FINALE,scr=o.screens??SCREENS,fov=o.fov??S.fovDeg;let best:SkyFinaleShot|null=null,bs=-1;
 const near=boxes.filter(b=>boxDist(feet,b)<20);
 for(let dy=-S.faceYawMaxDeg;dy<=S.faceYawMaxDeg;dy+=10)for(const arm of [4,5,6,7,8,10,12])for(const hc of [0.3,0.8,1.3,2,3])for(let up=4;up<=32;up+=4){
  const y=faceYawRad+dy*Math.PI/180,P:V3=[feet[0]+Math.sin(y)*arm,feet[1]+hc,feet[2]+Math.cos(y)*arm];
  const az=Math.atan2(feet[0]-P[0],feet[2]-P[2]),e=up*Math.PI/180,T:V3=[P[0]+Math.sin(az)*Math.cos(e)*10,P[1]+Math.sin(e)*10,P[2]+Math.cos(az)*Math.cos(e)*10];
  let clear=Infinity,ok=true;for(const b of near){const d=boxDist(P,b);if(d<clear)clear=d;if(d<S.minClearM){ok=false;break;}}if(!ok)continue;
  const g=guardEval({position:P,target:T,fovVerticalDeg:fov} as any,feet as any,near,{up:0,swing:0,share:1});if(g.head||g.chest||g.inside)continue;
  const hf:number[]=[];let rs=1;for(const [W,H] of scr){if(herMargin(P,T,fov,feet,[[W,H]] as any)<0){ok=false;break;}const h=herShare(P,T,fov,W,H,feet);if(h<S.minHerShare){ok=false;break;}hf.push(h);rs=Math.min(rs,ringShare(P,T,fov,W,H,ring));if(rs<S.minRingShare){ok=false;break;}}
  if(!ok)continue;
  if(o.clearAt){const c=o.clearAt(P);if(c<S.minClearM)continue;clear=Math.min(clear,c);}
  if(o.seen){if(!o.seen(P,[feet[0],feet[1]+1.45,feet[2]])||!o.seen(P,[feet[0],feet[1]+1.05,feet[2]]))continue;
   let seenRing=0,on=0;for(const q of ring){const n=ndc(P,T,fov,320,568,q);if(!n||Math.abs(n[0])>1||Math.abs(n[1])>1)continue;on++;if(o.seen(P,q))seenRing++;}
   if(seenRing<Math.max(1,Math.ceil(on/2)))continue;}
  const s=Math.min(...hf)+rs;
  if(s>bs){bs=s;best={position:P,target:T,fovVerticalDeg:fov,armM:Math.hypot(P[0]-feet[0],P[1]-feet[1]-1.15,P[2]-feet[2]),herFrac:hf,ringShare:rs,clearM:clear,yawDeg:dy,lookUpDeg:up};}}
 return best;}
/** The shot for S6 (end of planWalk S4→S6, facing −148°). T-02 option C (Grok Bot, Oct 25): her + the city, no ring requirement
 * (A2 — a ring arc across ≥60 % of the frame width with fov ≤ 60 and no up-tilt — has no pose: the ring never enters the upper frame).
 * Rear 3/4 (50° off her back), 6 m arm, lens 1.3 m up, fov 45; found by a real-mesh search (clearance ≥ 1.1 m, head/chest clear,
 * city share) and baked so the player build does no search. test_t02_sky_final checks it per screen. skycity model-local. */
/** b19 P1 (界面验收部 d3fe578e: parked under the city, underside 69 % of the upper half, sky 5.6 %): pulled back 8.5 m out from
 *  under the canopy, rear 3/4 (25° off her back), lens 1.5 m up, pitched 2° UP toward the distant city, her on the left third with
 *  lead room toward the city. Proxy (env_skycity.glb rays): sky 40.9–48 %, underside ≤ 21.9 % of the upper half, 7 screens.
 *  Old option C pose kept as SKY_FINALE_POSE_LOCAL_C for before/after. */
/** full9c: shifted by the stand move old planWalk end (0.941,0.044,-27.059) → S6 node (0.2,0.034,-27.8): Δ (−0.741,−0.0095,−0.741), rigid (same arm, angle, fov). Was position [1.972,1.542,-18.668] target [0.377,1.839,-27.012]. */
export const SKY_FINALE_POSE_LOCAL={position:[1.231,1.532,-19.409] as V3,target:[-0.364,1.829,-27.753] as V3,fovVerticalDeg:45};
export const SKY_FINALE_POSE_LOCAL_C={position:[6.845,1.342,-26.291] as V3,target:[-3.199,2.342,-26.649] as V3,fovVerticalDeg:45};
/** Approach seconds from the walk lens to the shot under the standing yaw cap: blendPose is smootherstep (peak rate 1.875·Δ/T,
 * peak acceleration ≈ 5.77·Δ/T²), so T ≥ 1.875·Δ/V and T ≥ √(5.77·Δ/A) with V = 90°/s, A = 200°/s² (5 % margin). Δ = the larger of
 * the view-direction turn and the turn of the lens round her. */
export function skyFinaleApproachS(from:{position:readonly number[];target:readonly number[]},to:{position:readonly number[];target:readonly number[]},feet:readonly number[],V=90,A=200):number{
 const dir=(p:{position:readonly number[];target:readonly number[]})=>{const d=[p.target[0]-p.position[0],p.target[1]-p.position[1],p.target[2]-p.position[2]],l=Math.hypot(d[0],d[1],d[2])||1;return d.map(v=>v/l);};
 const a=dir(from),b=dir(to),view=Math.acos(Math.max(-1,Math.min(1,a[0]*b[0]+a[1]*b[1]+a[2]*b[2])))*180/Math.PI;
 const az=(p:readonly number[])=>Math.atan2(p[0]-feet[0],p[2]-feet[2]);let orb=Math.abs(az(to.position)-az(from.position))*180/Math.PI;if(orb>180)orb=360-orb;
 const D=Math.max(view,orb);return Math.max(SKY_FINALE.approachS,1.05*1.875*D/V,1.05*Math.sqrt(5.77*D/A));}
/** Approach pose at time t of T: the lens orbits round her (azimuth, height, distance eased by smootherstep, the short way round
 * unless dir is given), the view direction slerped — never a straight cut through the walls between the two poses. */
const smoother=(x:number)=>{const t=Math.max(0,Math.min(1,x));return t*t*t*(t*(t*6-15)+10);};
export function skyFinaleApproachPose(from:{position:readonly number[];target:readonly number[];fovVerticalDeg?:number},to:{position:readonly number[];target:readonly number[];fovVerticalDeg?:number},feet:readonly number[],t:number,T:number,dir=0):{position:V3;target:V3;fovVerticalDeg:number}{
 const e=T>0?smoother(t/T):1,sph=(p:readonly number[])=>({a:Math.atan2(p[0]-feet[0],p[2]-feet[2]),r:Math.hypot(p[0]-feet[0],p[2]-feet[2]),y:p[1]-feet[1]});
 const A=sph(from.position),Bq=sph(to.position);let da=Bq.a-A.a;while(da>Math.PI)da-=2*Math.PI;while(da<-Math.PI)da+=2*Math.PI;if(dir>0&&da<0)da+=2*Math.PI;if(dir<0&&da>0)da-=2*Math.PI;
 const a=A.a+da*e,r=A.r+(Bq.r-A.r)*e,y=A.y+(Bq.y-A.y)*(T>0&&Bq.y<A.y?smoother(Math.min(1,t/(0.55*T))):e)/* drop under the canopy band first */,P:V3=[feet[0]+Math.sin(a)*r,feet[1]+y,feet[2]+Math.cos(a)*r];
 const u=(p:{position:readonly number[];target:readonly number[]})=>{const d=[p.target[0]-p.position[0],p.target[1]-p.position[1],p.target[2]-p.position[2]],l=Math.hypot(d[0],d[1],d[2])||1;return d.map(v=>v/l);};
 const d0=u(from),d1=u(to),c=Math.max(-1,Math.min(1,d0[0]*d1[0]+d0[1]*d1[1]+d0[2]*d1[2])),w=Math.acos(c);let d:number[];
 if(w<1e-4)d=d1;else{const s0=Math.sin((1-e)*w)/Math.sin(w),s1=Math.sin(e*w)/Math.sin(w);d=[d0[0]*s0+d1[0]*s1,d0[1]*s0+d1[1]*s1,d0[2]*s0+d1[2]*s1];}
 const f0=from.fovVerticalDeg??48,f1=to.fovVerticalDeg??48;return {position:P,target:[P[0]+d[0]*8,P[1]+d[1]*8,P[2]+d[2]*8],fovVerticalDeg:f0+(f1-f0)*e};}
/** Chooses the way round (dir ±1) and the approach time: per way, T from the orbit turn and the view turn under the standing cap
 * (skyFinaleApproachS rule), then 48 samples scored by lens-in-box (×100) and face/chest-hidden samples; the better way wins. */
export function skyFinaleApproach(from:{position:readonly number[];target:readonly number[];fovVerticalDeg?:number},to:{position:readonly number[];target:readonly number[];fovVerticalDeg?:number},feet:readonly number[],boxes:readonly OccBox[],V=90,A=200):{dir:number;T:number;inBox:number;hidden:number}{
 const near=boxes.filter(b=>boxDist(feet,b)<16),az=(p:readonly number[])=>Math.atan2(p[0]-feet[0],p[2]-feet[2]);
 let da=az(to.position)-az(from.position);while(da>Math.PI)da-=2*Math.PI;while(da<-Math.PI)da+=2*Math.PI;
 const u=(p:{position:readonly number[];target:readonly number[]})=>{const d=[p.target[0]-p.position[0],p.target[1]-p.position[1],p.target[2]-p.position[2]],l=Math.hypot(d[0],d[1],d[2])||1;return d.map(v=>v/l);};
 const d0=u(from),d1=u(to),view=Math.acos(Math.max(-1,Math.min(1,d0[0]*d1[0]+d0[1]*d1[1]+d0[2]*d1[2])))*180/Math.PI;
 let best={dir:0,T:0,inBox:Infinity,hidden:Infinity},bs=Infinity;
 for(const dir of [Math.sign(da)||1,-(Math.sign(da)||1)]){const orb=Math.abs(dir===Math.sign(da)?da:da-dir*2*Math.PI)*180/Math.PI,D=Math.max(view,orb);
  const T=Math.max(SKY_FINALE.approachS,1.05*1.875*D/V,1.05*Math.sqrt(5.77*D/A));let inBox=0,hidden=0;
  for(let k=0;k<=48;k++){const p=skyFinaleApproachPose(from,to,feet,k/48*T,T,dir);if(near.some(b=>p.position[0]>b.min[0]&&p.position[0]<b.max[0]&&p.position[1]>b.min[1]&&p.position[1]<b.max[1]&&p.position[2]>b.min[2]&&p.position[2]<b.max[2]))inBox++;
   const o=herOcclusion(p.position,feet,near);if(o.face||o.chest)hidden++;}
  const sc=inBox*100+hidden+T*0.01;if(sc<bs){bs=sc;best={dir,T,inBox,hidden};}}
 return best;}
