/** p0drag9 (Mac p0drag8 sx2d, skycity (13,7.4) slow full turn): the avoidance offset (LensGuard + proxy avoidance) about her look point
 *  is eased (critically damped, capped rates) instead of applied in one frame; then the view is re-aimed so her body stays inside
 *  safe margins on every supported portrait / tablet screen. Pure, no cc. */
type V3=[number,number,number];
export const LENS_SMOOTH=Object.freeze({
 /** spring ω (1/s) of the offset follower and its rate caps */
 omega:8,holdMaxDeg:90,yawDegS:80,elevDegS:22,armMS:2.2,
 /** ×boost while the eased lens is still inside an occluder box (gets out sooner; still continuous) */
 insideBoost:2.5,
 /** p0drag10: ×yaw rate while her face AND chest are hidden from the written lens */
 hiddenYawBoost:5,
 /** p0drag10: a yaw boost never moves the lens faster than this along its arc (m/s; p0drag8 P5 step cap 0.35 m @ 60 fps) */
 boostLensMS:28,
 /** p0drag13 (Mac p0drag12: automatic swing 379–507°/s, p95 140–240°/s — a whip): OUR yaw offset moves on an eased, capped
  *  profile — ≤ yawOursDegS, |accel| ≤ yawAccDegS2 (trapezoid: speeds up, cruises, slows into the target). Replaces ×5 + 28 m/s. */
 yawOursDegS:90,yawAccDegS2:200,yawWalkDegS:120,yawWalkAccDegS2:300,
 /** screens the framing must hold on (w×h px) */
 screens:[[390,844],[414,896],[360,780],[375,667],[320,568],[390,520],[768,1024]] as readonly (readonly [number,number])[],
 /** her body: feet .. head above the feet (m) and half width (m); margin kept to the screen edge (fraction of the half screen) */
 bodyM:[0.05,1.6] as readonly [number,number],halfWidthM:0.3,safe:0.12,
});
export type Sph={yaw:number;el:number;arm:number};
const R=Math.PI/180;
export function sphOf(p:readonly number[],look:readonly number[]):Sph{const d=[p[0]-look[0],p[1]-look[1],p[2]-look[2]],L=Math.hypot(d[0],d[1],d[2])||1e-6;
 return {yaw:Math.atan2(d[0],d[2])/R,el:Math.asin(Math.max(-1,Math.min(1,d[1]/L)))/R,arm:L};}
export function posOf(look:readonly number[],s:Sph):V3{const y=s.yaw*R,e=s.el*R;return [look[0]+Math.sin(y)*Math.cos(e)*s.arm,look[1]+Math.sin(e)*s.arm,look[2]+Math.cos(y)*Math.cos(e)*s.arm];}
export const wrapDeg=(a:number)=>((a%360)+540)%360-180;
/** Critically damped follower of an offset (yaw°, elevation°, arm m) with velocity caps. */
export class OffsetSmoother{
 y=0;e=0;a=0;private vy=0;private ve=0;private va=0;live=false;
 reset(y=0,e=0,a=0){this.y=y;this.e=e;this.a=a;this.vy=this.ve=this.va=0;this.live=true;}
 clear(){this.reset();this.live=false;}
 /** p0drag10: the no-entry guard moved the lens to (y,e,a) instead of the eased step — adopt it, zeroing the velocity on axes it held. */
 /** p0drag13: per-mode yaw caps (0 = LENS_SMOOTH): walks may use the 120°/s hard cap, ≤ 300°/s². */
 capV=0;capA=0;
 pin(y:number,e:number,a:number){if(y!==this.y)this.vy=0;if(e!==this.e)this.ve=0;if(a!==this.a)this.va=0;this.y=y;this.e=e;this.a=a;}
 step(ty:number,te:number,ta:number,dt:number,boost=1,yawBoost=1,yawMaxDegS=Infinity,yawDir=0):[number,number,number]{
  if(!this.live){this.reset(ty,te,ta);return [ty,te,ta];}
  if(!(dt>0))return [this.y,this.e,this.a];/* p0drag10: a dt = 0 write (drag event → aimOrbit → writeOrbit(0)) HOLDS — it used to reset to the target = a jump */
  const t=Math.min(0.1,dt),w=LENS_SMOOTH.omega*boost;
  const f=(x:number,v:number,g:number,cap:number,ww=w):[number,number]=>{const acc=ww*ww*(g-x)-2*ww*v;let nv=v+acc*t;nv=Math.max(-cap,Math.min(cap,nv));return [x+nv*t,nv];};
  const dy=wrapDeg(ty-this.y);/* p0drag11: yawDir ±1 = go round that way (detour past a wall) */
  {const d=yawDir&&Math.sign(dy)!==yawDir?dy+360*yawDir:dy,A=this.capA||LENS_SMOOTH.yawAccDegS2,V=this.capV||LENS_SMOOTH.yawOursDegS;
   /* p0drag13: eased + capped yaw — target speed is what can still stop in time (√(2A|d|)), the speed changes by ≤ A·t */
   /* full9 (p0drag13 K1 skxd_pock accPeak 671): the continuous √(2A|d|) brake overshot by a fraction of a degree in discrete steps, reversed
    * (−7 °/s) and was then snapped onto the target (+3 °/s → 0 in one 15 ms frame). Discrete-exact brake: the speed that still stops
    * within d when it may drop by A·t per step (v = A·t·(√(¼ + 2|d|/(A·t²)) − ½)); never step past the target (land on it, v → 0, |Δv| ≤ A·t). */
   const ad=Math.abs(d),Ab=0.8*A/* brake profile at 0.8 A: the frame dt varies (12–21 ms), so the last step still lands within A·t */,vs=Ab*t*(Math.sqrt(0.25+2*ad/(Ab*t*t))-0.5),want=Math.sign(d)*Math.min(V,vs),nv=this.vy+Math.max(-A*t,Math.min(A*t,want-this.vy));
   let ny=this.y+nv*t;if((ad<0.05&&Math.abs(nv)<=A*t)||(Math.sign(nv)===Math.sign(d)&&Math.abs(nv*t)>=ad&&Math.abs(nv)<=A*t)){ny=this.y+d;this.vy=0;}else this.vy=nv;this.y=ny;void yawBoost;void yawMaxDegS;}/* p0drag11: the yaw spring is also stiffer while she is hidden *//* p0drag10: yaw alone may go ×yawBoost while she is hidden (yaw is not a user-felt pitch/height limit) */
  [this.e,this.ve]=f(this.e,this.ve,te,LENS_SMOOTH.elevDegS*boost);
  [this.a,this.va]=f(this.a,this.va,ta,LENS_SMOOTH.armMS*boost);
  return [this.y,this.e,this.a];}
}
/** Worst normalised margin (1 = centre, 0 = on the safe edge, <0 outside) of her body box over all screens for a look-at pose. */
export function herMargin(pos:readonly number[],target:readonly number[],fovV:number,feet:readonly number[],screens=LENS_SMOOTH.screens):number{
 const f=[target[0]-pos[0],target[1]-pos[1],target[2]-pos[2]],fl=Math.hypot(f[0],f[1],f[2])||1;for(let i=0;i<3;i++)f[i]/=fl;
 let r=[f[2],0,-f[0]];const rl=Math.hypot(r[0],r[2])||1;r=[r[0]/rl,0,r[2]/rl];/* screen right = forward × up (sign irrelevant: symmetric margins) */
 const u=[r[1]*f[2]-r[2]*f[1],r[2]*f[0]-r[0]*f[2],r[0]*f[1]-r[1]*f[0]];const tv=Math.tan(fovV*R/2);
 const [b0,b1]=LENS_SMOOTH.bodyM,hw=LENS_SMOOTH.halfWidthM;let worst=1;
 const pts:number[][]=[];for(const y of [b0,b1])for(const s of [-1,1])pts.push([feet[0]+r[0]*hw*s,feet[1]+y,feet[2]+r[2]*hw*s]);
 for(const [w,h] of screens){const th=tv*w/h,lim=1-LENS_SMOOTH.safe;
  for(const p of pts){const d=[p[0]-pos[0],p[1]-pos[1],p[2]-pos[2]],z=d[0]*f[0]+d[1]*f[1]+d[2]*f[2];if(z<=0.05){worst=Math.min(worst,-1);continue;}
   const x=Math.abs((d[0]*r[0]+d[1]*r[1]+d[2]*r[2])/z/th),y=Math.abs((d[0]*u[0]+d[1]*u[1]+d[2]*u[2])/z/tv);worst=Math.min(worst,(lim-Math.max(x,y))/lim);}}
 return worst;}
/** Re-aim the view (position kept) so herMargin ≥ 0: blend the target toward her body centre just enough (bisection). */
export function frameHer<T extends readonly number[]>(pos:readonly number[],target:T,fovV:number,feet:readonly number[]):T|V3{
 if(herMargin(pos,target,fovV,feet)>=0)return target;/* unchanged: same array */const tg:V3=[target[0],target[1],target[2]];
 const c=[feet[0],feet[1]+(LENS_SMOOTH.bodyM[0]+LENS_SMOOTH.bodyM[1])/2,feet[2]];
 const dist=Math.hypot(tg[0]-pos[0],tg[1]-pos[1],tg[2]-pos[2])||1,cd=Math.hypot(c[0]-pos[0],c[1]-pos[1],c[2]-pos[2])||1;
 const dir=(k:number):V3=>{const a=[(tg[0]-pos[0])/dist,(tg[1]-pos[1])/dist,(tg[2]-pos[2])/dist],b=[(c[0]-pos[0])/cd,(c[1]-pos[1])/cd,(c[2]-pos[2])/cd];
  const m=[a[0]+(b[0]-a[0])*k,a[1]+(b[1]-a[1])*k,a[2]+(b[2]-a[2])*k],ml=Math.hypot(m[0],m[1],m[2])||1;return [pos[0]+m[0]/ml*cd,pos[1]+m[1]/ml*cd,pos[2]+m[2]/ml*cd];};
 if(herMargin(pos,dir(1),fovV,feet)<0)return dir(1);
 let lo=0,hi=1;for(let i=0;i<14;i++){const m=(lo+hi)/2;if(herMargin(pos,dir(m),fovV,feet)>=0)hi=m;else lo=m;}
 return dir(hi);}
