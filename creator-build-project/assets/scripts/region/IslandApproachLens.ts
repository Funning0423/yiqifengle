/** 运镜bot b21 (Grok Bot item 4, plan B): island I3>I4 follow on GGbot's E-waypoint route, pure (no cc).
 *  The live FollowWalk lens (followPose through LensGuard) swings 8.7 m/s / p99 440 deg/s^2 on this curve, and in its last stretch the
 *  lean and short beach palms cover her face. This plans the whole walk once at its start (60 Hz):
 *   1. TRACK: the runtime follow (followPose + LensGuard on ISLAND_LENS_OCCLUDERS) sampled at 60 Hz, then smoothed (triangle window
 *      +-smoothS on position and view direction) so speed / angular acceleration stay inside the limits; the first startS s ease from the
 *      live lens onto it (first write = the live lens).
 *   2. TAKEOVER (handoverS = walk end - takeS): a quintic Hermite from the track's position, velocity and acceleration at that instant
 *      (C2: no jump) to the settled follow pose at I4 (track end + settleS), lifted by lift m mid-way (zero slope at both ends); the view
 *      direction leaves the track direction onto her over aimEaseS (min-jerk, zero rate at the handover) and onto the stand view over
 *      the last endAimS. Held after the walk ends. Gate: tools/journey-integration/test-island-i4-approach.cjs. */
import type {Pose,Vec} from '../world-r1/WorldFlowCore';
import {followPose} from './ExploreCameraCore';
import {LensGuard,type OccBox} from './LensOcclusion';
export const ISLAND_APPROACH=Object.freeze({hz:60,smoothS:0.6,startS:1.0,takeS:4.0,lift:1.0,aimEaseS:1.4,endAimS:0.8,settleS:0.5,walkMps:1.2,headM:0.3,lookM:1.0});
type V=[number,number,number];
const nz=(v:readonly number[]):V=>{const n=Math.hypot(v[0],v[1],v[2])||1;return [v[0]/n,v[1]/n,v[2]/n];};
const lerpDir=(a:readonly number[],b:readonly number[],u:number):V=>nz([a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u,a[2]+(b[2]-a[2])*u]);
const mj=(u:number)=>{const x=Math.max(0,Math.min(1,u));return x*x*x*(10-15*x+6*x*x);};
function cum(p:readonly Vec[]):number[]{const c=[0];for(let i=1;i<p.length;i++)c.push(c[i-1]+Math.hypot(p[i][0]-p[i-1][0],p[i][1]-p[i-1][1],p[i][2]-p[i-1][2]));return c;}
function along(p:readonly Vec[],c:readonly number[],d:number):V{const L=c[c.length-1],x=Math.max(0,Math.min(L,d));let i=1;while(i<c.length-1&&c[i]<x)i++;const a=p[i-1],b=p[i],s=(x-c[i-1])/Math.max(1e-9,c[i]-c[i-1]);return [a[0]+(b[0]-a[0])*s,a[1]+(b[1]-a[1])*s,a[2]+(b[2]-a[2])*s];}
/** Quintic Hermite on [0,1]: p0,v0,a0 -> p1 with v1=a1=0 (v0,a0 already scaled by the span). */
function herm5(p0:number,v0:number,a0:number,p1:number,u:number):number{const u2=u*u,u3=u2*u,u4=u3*u,u5=u4*u;
 const h0=1-10*u3+15*u4-6*u5,h1=u-6*u3+8*u4-3*u5,h2=0.5*(u2-3*u3+3*u4-u5),h5=10*u3-15*u4+6*u5;return h0*p0+h1*v0+h2*a0+h5*p1;}
export type ApproachLens={seconds:number;handoverS:number;at:(t:number)=>Pose;end:Pose;her:(t:number)=>Vec};
export function islandApproachLens(live:Pose,walk:readonly Vec[],w:number,h:number,boxes:readonly OccBox[]):ApproachLens{
 const K=ISLAND_APPROACH,c=cum(walk),L=c[c.length-1],T=L/K.walkMps,hz=K.hz,N=Math.ceil((T+K.settleS)*hz)+1;
 const her=(t:number):V=>along(walk,c,t*K.walkMps);
 const hd=(d:number)=>{const a=along(walk,c,d-K.headM),b=along(walk,c,d+K.headM);return Math.atan2(b[0]-a[0],b[2]-a[2]);};
 const g=new LensGuard(),P:V[]=[],D:V[]=[];let fov=48;
 for(let k=0;k<N;k++){const t=k/hz,d=Math.min(L,t*K.walkMps),q=her(t),raw=followPose(q as unknown as Vec,hd(d),w,h,0);
  const r=g.apply(raw,q as unknown as Vec,boxes,1/hz,undefined,undefined,false,0,false);fov=raw.fovVerticalDeg??48;
  P.push([r.position[0],r.position[1],r.position[2]]);D.push(nz([r.target[0]-r.position[0],r.target[1]-r.position[1],r.target[2]-r.position[2]]));}
 const R=Math.round(K.smoothS*hz),SP:V[]=[],SD:V[]=[];
 for(let k=0;k<N;k++){let p:V=[0,0,0],d:V=[0,0,0],ws=0;for(let j=-R;j<=R;j++){const i=Math.max(0,Math.min(N-1,k+j)),wt=R+1-Math.abs(j);ws+=wt;for(let a=0;a<3;a++){p[a]+=P[i][a]*wt;d[a]+=D[i][a]*wt;}}
  SP.push([p[0]/ws,p[1]/ws,p[2]/ws]);SD.push(nz(d));}
 const l0=live.position,ld=nz([live.target[0]-l0[0],live.target[1]-l0[1],live.target[2]-l0[2]]),off:V=[l0[0]-SP[0][0],l0[1]-SP[0][1],l0[2]-SP[0][2]],f0=live.fovVerticalDeg??fov;
 const samp=(arr:V[],t:number):V=>{const x=Math.max(0,Math.min(N-1,t*hz)),i=Math.min(N-2,Math.floor(x)),s=x-i,a=arr[i],b=arr[i+1];return [a[0]+(b[0]-a[0])*s,a[1]+(b[1]-a[1])*s,a[2]+(b[2]-a[2])*s];};
 const trackP=(t:number):V=>{const s=samp(SP,t),e=1-mj(t/K.startS);return [s[0]+off[0]*e,s[1]+off[1]*e,s[2]+off[2]*e];};
 const trackD=(t:number):V=>lerpDir(ld,nz(samp(SD,t)),mj(t/K.startS));
 const th=Math.max(K.startS,T-K.takeS),span=T-th,e=1/hz;
 const p0=trackP(th),pm=trackP(th-e),pp=trackP(th+e),v0=[0,1,2].map(a=>(pp[a]-pm[a])/(2*e)*span),a0=[0,1,2].map(a=>(pp[a]-2*p0[a]+pm[a])/(e*e)*span*span);
 const endP=SP[N-1],endD=SD[N-1],endPose:Pose={position:[endP[0],endP[1],endP[2]] as Vec,target:[endP[0]+endD[0]*10,endP[1]+endD[1]*10,endP[2]+endD[2]*10] as Vec,fovVerticalDeg:fov};
 const at=(t:number):Pose=>{
  if(t>=T)return endPose;
  let p:V,d:V;
  if(t<th){p=trackP(t);d=trackD(t);}
  else{const u=(t-th)/span,b=16*u*u*(1-u)*(1-u);p=[0,1,2].map(a=>herm5(p0[a],v0[a],a0[a],endP[a],u)+(a===1?K.lift*b:0)) as V;
   const q=her(t),dh=nz([q[0]-p[0],q[1]+K.lookM-p[1],q[2]-p[2]]);d=lerpDir(trackD(t),dh,mj((t-th)/K.aimEaseS));d=lerpDir(d,endD,mj((t-(T-K.endAimS))/K.endAimS));}
  const fv=f0+(fov-f0)*mj(t/K.startS);return {position:[p[0],p[1],p[2]] as Vec,target:[p[0]+d[0]*10,p[1]+d[1]*10,p[2]+d[2]*10] as Vec,fovVerticalDeg:fv};};
 return {seconds:T,handoverS:th,at,end:endPose,her:t=>her(t) as unknown as Vec};
}
/** Wiring helper (FollowWalk writer): the stage's own clock, dt clamped to 0.1 s. */
export function approachClock(l:ApproachLens):(dt?:number)=>Pose{let t=0;return (dt=0)=>{t+=Math.max(0,Math.min(0.1,dt));return l.at(t);};}
