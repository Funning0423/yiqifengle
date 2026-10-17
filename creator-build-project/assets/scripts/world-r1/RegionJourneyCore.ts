import type { Cancellation, CharacterAdapter, Pose, StablePose, Vec, WorldLease } from './WorldFlowCore';
export type JourneyRegion = 'island'|'meadow'|'skycity';
export type JourneyPhase = 'idle'|'loading'|'ready'|'approach'|'bridge'|'arrival'|'paused'|'failed'|'arrived'|'disposed';
export type JourneyRoute = Readonly<{ from:JourneyRegion; to:JourneyRegion; path:readonly Vec[]; bridgeStart:number; bridgeEnd:number; speed:number; focus?:Vec; lens?:readonly LensKey[]; startBlendM?:number; landing?:JourneyLanding; timing?:JourneyTiming }>;
export interface JourneySceneLease { route:JourneyRoute; show(visible:boolean):void; dispose():void; }
export interface JourneySceneAdapter {
 prepare(from:JourneyRegion,to:JourneyRegion,start:Vec,token:Cancellation,progress:(n:number)=>void):Promise<JourneySceneLease>;
 readCamera():Pose;
}
export type JourneySnapshot = Readonly<{phase:JourneyPhase;region:JourneyRegion;target:JourneyRegion|null;loadProgress:number;distance:number;total:number;error:string|null;canRetry:boolean;canResume:boolean}>;
const dist=(a:Vec,b:Vec)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
export const routeLength=(p:readonly Vec[])=>p.slice(1).reduce((n,b,i)=>n+dist(p[i],b),0);
export function sampleRoute(path:readonly Vec[],distance:number):Vec {
 let left=Math.max(0,distance);for(let i=1;i<path.length;i++){const d=dist(path[i-1],path[i]);if(d>0&&left<=d){const a=path[i-1],b=path[i],t=left/d;return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];}left-=d;}return path[path.length-1];
}
export function remainingRoute(path:readonly Vec[],distance:number):Vec[] {
 const result:Vec[]=[sampleRoute(path,distance)];let walked=0;for(let i=1;i<path.length;i++){walked+=dist(path[i-1],path[i]);if(walked>distance+1e-6)result.push(path[i]);}return result;
}
export function validateJourneyRoute(route:JourneyRoute,start:Vec):void {
 if(!route.path||route.path.length<2||route.path.some(p=>p.length!==3||p.some(n=>!Number.isFinite(n))))throw Error('journey-invalid-path');
 const length=routeLength(route.path);if(dist(start,route.path[0])>1e-4||!(length>0)||!Number.isFinite(length)||!(route.speed>0&&route.speed<=2)||!(route.bridgeStart>=0&&route.bridgeEnd>route.bridgeStart&&route.bridgeEnd<=length))throw Error('journey-invalid-continuity');
 if(!((route.from==='island'&&route.to==='meadow')||(route.from==='meadow'&&route.to==='skycity')))throw Error('journey-region-order');
 if(route.timing!==undefined&&!journeyTimingOk(routeLength(route.path),route.timing))throw Error('journey-invalid-timing');
 if(route.landing!==undefined&&(!route.focus||Object.keys(route.landing).some(k=>!(k in LANDING_KEYS)||!Number.isFinite((route.landing as any)[k]))))throw Error('journey-invalid-landing');
}
/** Follow lens for the region bridges. Build05 occlusion fix: the offset is in the PATH frame (behind/left/up of the
 * smoothed walking heading), so a bridge that turns keeps the lens behind her. Numbers are checked by
 * tools/journey-integration/test-journey-occlusion.cjs (geometry) and test-journey-framing.cjs (screen framing,
 * angular velocity, underside/sky coverage) against the real region GLB geometry.
 * v3 (lead Mac review of a373227+4c30cf7):
 *  - Lower, flatter follow (upM 3.4, aim lookM 2.4 above her feet): the top of the portrait frame now holds the sky dome,
 *    so the night journey shows the night sky instead of only the bright sea under a steep lens.
 *  - Start (04→05): the lens no longer flies ahead toward the bridge. It turns onto HER in the first startAimM metres and
 *    keeps her in frame while it travels to the follow pose over blendM (7 m, was 4) with a lower arc (blendLiftM 2.5).
 *  - Route lens keys (LensKey, metres along the route) locally raise/pull back the lens, e.g. under the sky city where its
 *    grey underside filled the upper left (08→09).
 *  - Arrival (route.focus): one smooth move from the follow pose to a high, pulled-back side-rear pose that frames the
 *    plaza (anchor_starcourt_center) centred with her small in front (~1/6 frame height) and clears the platform post.
 *    Position and view direction both move on smootherstep over arrivalBlendM metres; direction is slerped, so the
 *    angular speed is bounded (≤ 20°/s at 1.2 m/s, asserted by the framing test). */
export type LensKey = Readonly<{at:number;upM?:number;backM?:number;sideM?:number;lookM?:number}>;
/** 04→05 set-off: black cover ramps (s), same cover/style as 主页 (HOME_FADE 0.4/0.5 in 88506aa). */
export const SETOFF_FADE={outS:.25,inS:.35} as const;
export const JOURNEY_CAMERA={blendM:18,startAimM:2,startTurn:1,headingWindowM:5,backM:6.6,sideM:-2.4,upM:3.4,leadM:1.2,lookM:2.4,blendLiftM:2.5,fovDeg:48,
 // Landing A (final, v3, Mac check 379e137): 12 m behind / 1.5 m right / 2 m up from the end, view pitched 2.5 deg up over the
 // plaza-centred aim: plaza 50% across / 55% down, her centre at 75% of the width (was 86-89%), her 0.153 of screen height
 // with her whole body in frame (feet 21% above the bottom edge), plaza rock in the frame centre 5/25 samples. A small 2.5 m
 // late lift keeps her head/chest clear over the sunk mushroom at d41-43. Blend 14.3 m: turn <=20 deg/s, right side until
 // the last ~10 m.
 arrivalBlendM:14.3,arrivalHoldM:.5,arrivalLiftM:2.5,arrivalRiseM:5,arrivalDropM:2,arrivalBackM:12,arrivalSideM:-1.5,arrivalUpM:2,arrivalAim:0,arrivalPitchDeg:2.5,
 // 0 = off (Build05 routes). 1 (route.landing only): over the arrival (arrivalBlendM) the lens POSITION runs on a quintic
 // Hermite from the follow pose (matching its velocity, zero acceleration) to the final arrival pose (zero velocity and
 // acceleration), so it decelerates monotonically on an S-curve and comes to rest exactly when she stops; the view direction
 // keeps the Landing A blend. arrivalLiftM is not applied on this path.
 arrivalHermite:0,
 // 0 = off (Build05 routes). > 0 (route.landing only): the lens anchors on her route position smoothed with a triangular
 // kernel ±anchorSmoothM (narrowed to the distance left to either end), so polyline corners (approach→bridge, bridge→ground)
 // no longer kick the lens: its acceleration stays finite and continuous. On straight runs it is exactly her position.
 // The follow heading chord (headingWindowM) is taken between smoothed points as well.
 anchorSmoothM:0,
 // 0 = off (Build05 routes: aim horizontally at the focus). 0…1 (route.landing only): the horizontal aim of the arrival pose
 // turns from the focus toward her by this fraction of the angle between them (keeps her inside the frame on a close lens).
 arrivalYawToHer:0} as const;
/** Per-route Landing A overrides (route.landing, needs route.focus). Same machinery as 08→09; any key left out keeps the
 * JOURNEY_CAMERA value, so routes without `landing` (04→05, 08→09) are byte-for-byte unchanged. Used by island→lakeside. */
/** Optional time profile for a route (reviewer on c375304: island→lakeside in ~17 s instead of length/1.2 m/s). Her travel
 * distance s(t) over durationS: speed ramps up from rest over easeInS and down to rest over easeOutS with a smootherstep
 * (C2: speed, acceleration and jerk are continuous, zero at both ends), constant cruise in between. The walk action
 * receives journeyDistanceAt as its distance curve; the lens is driven by distance as before, so every distance-domain
 * camera check still holds and the time-domain ones scale with this profile. Limits (JOURNEY_TIMING_LIMITS) are the B5.5
 * standard: peak ≤ 4.5 m/s, |a| ≤ 3 m/s². */
export type JourneyTiming = Readonly<{durationS:number;easeInS:number;easeOutS:number}>;
export const JOURNEY_TIMING_LIMITS={peakMps:4.5,accelMps2:3} as const;
const smooth5I=(x:number)=>x*x*x*x*(2.5+x*(-3+x));// ∫0^x (10u³−15u⁴+6u⁵) du
/** Cruise (= peak) speed of a timing over length L. */
export function journeyCruiseSpeed(L:number,t:JourneyTiming):number{return L/(t.durationS-t.easeInS/2-t.easeOutS/2);}
/** Peak |acceleration| and |jerk| of the profile (smootherstep: max slope 15/8, max curvature 10/√3). */
export function journeyTimingPeaks(L:number,t:JourneyTiming):{speed:number;accel:number;jerk:number}{const v=journeyCruiseSpeed(L,t),e=Math.min(t.easeInS,t.easeOutS);
 return {speed:v,accel:v*1.875/e,jerk:v*(10/Math.sqrt(3))/(e*e)};}
export function journeyTimingOk(L:number,t:JourneyTiming):boolean{if(!t||![t.durationS,t.easeInS,t.easeOutS].every(Number.isFinite)||!(t.easeInS>0&&t.easeOutS>0)||!(t.easeInS+t.easeOutS<=t.durationS)||!(L>0))return false;
 const p=journeyTimingPeaks(L,t);return p.speed<=JOURNEY_TIMING_LIMITS.peakMps+1e-9&&p.accel<=JOURNEY_TIMING_LIMITS.accelMps2+1e-9;}
/** Distance travelled at time t (0…durationS) along a route of length L. */
export function journeyDistanceAt(L:number,t:JourneyTiming,time:number):number{const T=t.durationS,a=t.easeInS,b=t.easeOutS,v=journeyCruiseSpeed(L,t);
 if(!(time>0))return 0;if(time>=T)return L;if(time<a)return v*a*smooth5I(time/a);if(time<=T-b)return v*(a/2+time-a);return Math.max(0,L-v*b*smooth5I((T-time)/b));}
/** Profile for what is left of the route after a pause (she restarts from rest): same ramps, duration scaled with the
 * remaining length, never shorter than the ramps need. */
export function remainingTiming(L:number,remaining:number,t:JourneyTiming):JourneyTiming{const k=remaining/L;let a=t.easeInS,b=t.easeOutS;if(a+b>t.durationS*k){const f=t.durationS*k/(a+b+.5);a*=f;b*=f;}
 return {durationS:Math.max(a+b+.5*Math.min(1,k),t.durationS*k),easeInS:a,easeOutS:b};}
export type JourneyLanding = Readonly<Partial<Record<'arrivalBlendM'|'arrivalHoldM'|'arrivalLiftM'|'arrivalRiseM'|'arrivalDropM'|'arrivalBackM'|'arrivalSideM'|'arrivalUpM'|'arrivalAim'|'arrivalPitchDeg'|'arrivalHermite'|'anchorSmoothM'|'arrivalYawToHer',number>>>;
const LANDING_KEYS={arrivalBlendM:1,arrivalHoldM:1,arrivalLiftM:1,arrivalRiseM:1,arrivalDropM:1,arrivalBackM:1,arrivalSideM:1,arrivalUpM:1,arrivalAim:1,arrivalPitchDeg:1,arrivalHermite:1,anchorSmoothM:1,arrivalYawToHer:1} as const;
const landingCamera=(landing?:JourneyLanding)=>landing?{...JOURNEY_CAMERA,...landing}:JOURNEY_CAMERA;
/** Route point at d smoothed with a triangular kernel of half-width w=min(W, d, T−d), computed EXACTLY from the polyline's
 * second arc-length integral I2 (Tri(d)=(I2(d+w)−2·I2(d)+I2(d−w))/w²): piecewise cubic, so the result has continuous velocity
 * and acceleration across polyline corners. W 0 = sampleRoute. */
const integrals=new WeakMap<readonly Vec[],{s:number[];c1:Vec[];c2:Vec[]}>();
function routeIntegrals(path:readonly Vec[]){let r=integrals.get(path);if(r)return r;const s=[0],c1:Vec[]=[[0,0,0]],c2:Vec[]=[[0,0,0]];
 for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i],l=dist(a,b),u:Vec=l>0?[(b[0]-a[0])/l,(b[1]-a[1])/l,(b[2]-a[2])/l]:[0,0,0],p=c1[i-1],q=c2[i-1];
  const i1=(k:number)=>p[k]+a[k]*l+u[k]*l*l/2,i2=(k:number)=>q[k]+p[k]*l+a[k]*l*l/2+u[k]*l*l*l/6;c1.push([i1(0),i1(1),i1(2)]);c2.push([i2(0),i2(1),i2(2)]);s.push(s[i-1]+l);}
 r={s,c1,c2};integrals.set(path,r);return r;}
function integral2(path:readonly Vec[],x:number):Vec{const R=routeIntegrals(path),n=path.length;let i=1;while(i<n-1&&R.s[i]<x)i++;
 const a=path[i-1],b=path[i],l=R.s[i]-R.s[i-1],u:Vec=l>0?[(b[0]-a[0])/l,(b[1]-a[1])/l,(b[2]-a[2])/l]:[0,0,0],t=x-R.s[i-1],p=R.c1[i-1],q=R.c2[i-1];
 const v=(k:number)=>q[k]+p[k]*t+a[k]*t*t/2+u[k]*t*t*t/6;return [v(0),v(1),v(2)];}
export function smoothRoutePoint(path:readonly Vec[],d:number,W:number):Vec{const T=routeLength(path),w=Math.min(W,d,T-d);if(!(w>1e-3))return sampleRoute(path,d);
 const A=integral2(path,d-w),B=integral2(path,d),C=integral2(path,d+w);const v=(k:number)=>(A[k]-2*B[k]+C[k])/(w*w);return [v(0),v(1),v(2)];}
/** C1 soft clamp of x to [lo,hi] with quadratic blends of half-width k (used for the heading chord ends). */
/** Soft clamp to [lo,hi] with a C2 knee of half-width k (slope = cubic smoothstep, so no acceleration step in the lens when
 * the heading chord reaches a route end; the earlier quadratic knee was C1 only and showed as jerk spikes at walk speed > 2 m/s). */
function softClamp(x:number,lo:number,hi:number,k:number):number{const sl=(v:number)=>{if(v>=k)return v;if(v<=-k)return 0;const u=(v+k)/(2*k);return 2*k*u*u*u*(1-u/2);};return hi-sl(hi-(lo+sl(x-lo)));}
export function journeyHeading(path:readonly Vec[],distance:number,smoothM:number=0):[number,number]{
 const w=JOURNEY_CAMERA.headingWindowM,T=routeLength(path),at=(d:number)=>smoothM>0?smoothRoutePoint(path,softClamp(d,0,T,smoothM),smoothM):sampleRoute(path,d),a=at(smoothM>0?distance-w:Math.max(0,distance-w)),b=at(distance+w),x=b[0]-a[0],z=b[2]-a[2],l=Math.hypot(x,z);
 return l>1e-6?[x/l,z/l]:[0,1];
}
const smooth=(v:number)=>{const u=Math.min(1,Math.max(0,v));return u*u*(3-2*u);};
const smoother=(v:number)=>{const u=Math.min(1,Math.max(0,v));return u*u*u*(u*(u*6-15)+10);};
const unit=(v:Vec):Vec=>{const l=Math.hypot(v[0],v[1],v[2])||1;return [v[0]/l,v[1]/l,v[2]/l];};
const lerp=(a:Vec,b:Vec,t:number):Vec=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];
/** Great-circle interpolation of two unit directions (constant angular rate in t). */
export function slerpDir(a:Vec,b:Vec,t:number):Vec{const d=Math.max(-1,Math.min(1,a[0]*b[0]+a[1]*b[1]+a[2]*b[2])),w=Math.acos(d);if(w<1e-5)return unit(lerp(a,b,t));const s=Math.sin(w),k0=Math.sin((1-t)*w)/s,k1=Math.sin(t*w)/s;return unit([a[0]*k0+b[0]*k1,a[1]*k0+b[1]*k1,a[2]*k0+b[2]*k1]);}
/** Lens offsets at a route distance: defaults, smoothly blended (smoothstep) between the route's keys. */
export function lensAt(keys:readonly LensKey[]|undefined,distance:number){
 const C=JOURNEY_CAMERA,base={upM:C.upM as number,backM:C.backM as number,sideM:C.sideM as number,lookM:C.lookM as number};if(!keys||!keys.length)return base;
 const full=(k:LensKey)=>({upM:k.upM??base.upM,backM:k.backM??base.backM,sideM:k.sideM??base.sideM,lookM:k.lookM??base.lookM});
 if(distance<=keys[0].at)return full(keys[0]);
 for(let i=1;i<keys.length;i++)if(distance<=keys[i].at){const a=full(keys[i-1]),b=full(keys[i]),t=smooth((distance-keys[i-1].at)/((keys[i].at-keys[i-1].at)||1));return {upM:a.upM+(b.upM-a.upM)*t,backM:a.backM+(b.backM-a.backM)*t,sideM:a.sideM+(b.sideM-a.sideM)*t,lookM:a.lookM+(b.lookM-a.lookM)*t};}
 return full(keys[keys.length-1]);
}
/** Pure path-frame follow pose (no start blend, no arrival). */
export function followPose(path:readonly Vec[],distance:number,keys?:readonly LensKey[],smoothM:number=0):{position:Vec;target:Vec}{
 const p=sampleRoute(path,distance),[hx,hz]=journeyHeading(path,distance,smoothM),sx=hz,sz=-hx,o=lensAt(keys,distance);
 return {position:[p[0]-hx*o.backM+sx*o.sideM,p[1]+o.upM,p[2]-hz*o.backM+sz*o.sideM],target:[p[0]+hx*JOURNEY_CAMERA.leadM,p[1]+o.lookM,p[2]+hz*JOURNEY_CAMERA.leadM]};
}
/** Arrival hero pose for a focused route: behind her on the far side of the line to the focus, pulled back, raised and
 * offset sideways (clear of the terminus post), aimed horizontally at the focus (plaza centred) and tilted toward her chest by arrivalAim. */
export function arrivalPose(path:readonly Vec[],focus:Vec,landing?:JourneyLanding):{position:Vec;target:Vec}{
 const C=landingCamera(landing),p=path[path.length-1],fx=focus[0]-p[0],fz=focus[2]-p[2],fl=Math.hypot(fx,fz)||1,u=[fx/fl,fz/fl],n=[-u[1],u[0]];
 const position:Vec=[p[0]-u[0]*C.arrivalBackM+n[0]*C.arrivalSideM,p[1]+C.arrivalUpM,p[2]-u[1]*C.arrivalBackM+n[1]*C.arrivalSideM];
 // Horizontally the view points straight at the focus (plaza centred); vertically it tilts from the focus toward her
 // chest by arrivalAim so she stays in the lower part of the portrait frame.
 const hx=focus[0]-position[0],hz=focus[2]-position[2],hl=Math.hypot(hx,hz)||1,yf=Math.atan2(hx,hz);let dyh=Math.atan2(p[0]-position[0],p[2]-position[2])-yf;while(dyh>Math.PI)dyh-=2*Math.PI;while(dyh<-Math.PI)dyh+=2*Math.PI;
 const yh=yf+dyh*C.arrivalYawToHer,fx2=C.arrivalYawToHer?Math.sin(yh)*hl:hx,fz2=C.arrivalYawToHer?Math.cos(yh)*hl:hz,fh=hl,pf=Math.atan2(focus[1]-position[1],fh),pc=Math.atan2(p[1]+.9-position[1],Math.hypot(p[0]-position[0],p[2]-position[2])||1),pitch=pf+(pc-pf)*C.arrivalAim+C.arrivalPitchDeg*Math.PI/180,aim:Vec=[fx2/fh*Math.cos(pitch),Math.sin(pitch),fz2/fh*Math.cos(pitch)];
 return {position,target:[position[0]+aim[0]*8,position[1]+aim[1]*8,position[2]+aim[2]*8]};
}
/** Her-relative lens offset moved on an orbit: horizontal angle, horizontal radius and height interpolate separately,
 * so a lens that has to get from in front of her to behind her goes AROUND her (for a swing of more than 135° the side is given by
 * turn: +1 ccw, -1 cw, 0 shortest; smaller swings always take the short way) instead of through or over her, and her screen position changes slowly. The radius moves geometrically,
 * so a distant lens closes in early instead of leaving her tiny for most of the move. */
export function orbitOffset(a:Vec,b:Vec,t:number,turn=0):Vec{
 const aa=Math.atan2(a[0],a[2]),ab=Math.atan2(b[0],b[2]),ra=Math.hypot(a[0],a[2]),rb=Math.hypot(b[0],b[2]);let d=ab-aa;
 while(d>Math.PI)d-=2*Math.PI;while(d<-Math.PI)d+=2*Math.PI;if(Math.abs(d)>Math.PI*.75){if(turn>0&&d<0)d+=2*Math.PI;if(turn<0&&d>0)d-=2*Math.PI;}
 const ang=aa+d*t,r=ra>1e-3&&rb>1e-3?ra*Math.pow(rb/ra,t):ra+(rb-ra)*t;return [Math.sin(ang)*r,a[1]+(b[1]-a[1])*t,Math.cos(ang)*r];
}
export function journeyCamera(path:readonly Vec[],distance:number,start:Pose,focus?:Vec,keys?:readonly LensKey[],startBlendM:number=JOURNEY_CAMERA.blendM,landing?:JourneyLanding):Pose {
 const C=landingCamera(landing),T=routeLength(path);
 const raw=sampleRoute(path,distance),p=C.anchorSmoothM>0?smoothRoutePoint(path,distance,C.anchorSmoothM):raw,f0=followPose(path,distance,keys,C.anchorSmoothM),dp:Vec=[p[0]-raw[0],p[1]-raw[1],p[2]-raw[2]];
 const f={position:[f0.position[0]+dp[0],f0.position[1]+dp[1],f0.position[2]+dp[2]] as Vec,target:[f0.target[0]+dp[0],f0.target[1]+dp[1],f0.target[2]+dp[2]] as Vec};
 const rel=(q:Vec,o:Vec):Vec=>[q[0]-o[0],q[1]-o[1],q[2]-o[2]],at=(o:Vec):Vec=>[p[0]+o[0],p[1]+o[1],p[2]+o[2]];
 // The lens is a her-relative offset plus an AIM POINT that stays within a few metres of her, so moving between poses
 // never swings her out of the frame; the view direction is derived from the two.
 let offset=rel(f.position,p),aim=f.target;
 // startBlendM 0 (v3.2, 04→05): no wide authored-pose blend; the lens is on her follow pose (right, behind) from set-off.
 const blend=startBlendM>0?smooth(distance/startBlendM):1;
 if(blend<1){const o=orbitOffset(rel(start.position,path[0]),offset,blend,C.startTurn);offset=[o[0],o[1]+C.blendLiftM*Math.sin(Math.PI*blend),o[2]];aim=lerp([p[0],p[1]+lensAt(keys,distance).lookM,p[2]],aim,blend);}
 if(focus){const w=smoother((C.arrivalBlendM-(T-distance))/(C.arrivalBlendM-C.arrivalHoldM));
  if(w>0){const e=arrivalPose(path,focus,landing),end=path[path.length-1],eo=rel(e.position,end),ed=unit(rel(e.target,e.position)),r=Math.hypot(eo[0],eo[1]-.9,eo[2]);
   const o=orbitOffset(offset,eo,w,0);const left=T-distance,lift=C.arrivalLiftM*smooth((C.arrivalBlendM-left)/C.arrivalRiseM)*smooth(left/C.arrivalDropM);offset=[o[0],o[1]+lift,o[2]];aim=lerp(aim,at([eo[0]+ed[0]*r,eo[1]+ed[1]*r,eo[2]+ed[2]*r]),w);}}
 let position=at(offset);
 if(focus&&C.arrivalHermite>0){const Lb=Math.min(C.arrivalBlendM,T),d0=T-Lb;if(distance>d0&&Lb>0){
  const fa=(d:number):Vec=>{const r=sampleRoute(path,d),q=C.anchorSmoothM>0?smoothRoutePoint(path,d,C.anchorSmoothM):r,o=followPose(path,d,keys,C.anchorSmoothM).position;return [o[0]+q[0]-r[0],o[1]+q[1]-r[1],o[2]+q[2]-r[2]];};
  const h=Math.min(.01,d0),a=fa(d0),b=fa(d0-h),E=arrivalPose(path,focus,landing).position,u=Math.min(1,(distance-d0)/Lb),u3=u*u*u;
  const H=u3*(10-15*u+6*u*u),H1=u-6*u3+8*u3*u-3*u3*u*u,k=h>0?Lb/h:0;
  position=[a[0]+(a[0]-b[0])*k*H1+(E[0]-a[0])*H,a[1]+(a[1]-b[1])*k*H1+(E[1]-a[1])*H,a[2]+(a[2]-b[2])*k*H1+(E[2]-a[2])*H];}}
 let dir=unit(rel(aim,position));
 // Leaving the live lens: the view first turns from wherever it was looking onto her, over startAimM.
 if(startBlendM>0&&distance<C.startAimM)dir=slerpDir(unit(rel(start.target,start.position)),dir,smoother(distance/C.startAimM));
 const fov=(start.fovVerticalDeg??45)+(C.fovDeg-(start.fovVerticalDeg??45))*blend;
 return {position,target:[position[0]+dir[0]*8,position[1]+dir[1]*8,position[2]+dir[2]*8],fovVerticalDeg:fov};
}
/** No timers, persistence, fake percentages or character assets. All movement is through the existing adapter.
 * The flow owns the sole clock. Assets become ready only after real prefab/anchor/material validation succeeds. */
export class RegionJourneyController {
 private phase:JourneyPhase='idle';private region:JourneyRegion='island';private target:JourneyRegion|null=null;
 private lease:JourneySceneLease|null=null;private scenes:JourneySceneLease[]=[];private loadProgress=0;private distance=0;private error:string|null=null;
 private root:Vec|null=null;private yaw=0;private camera:Pose|null=null;private startCamera:Pose|null=null;
 fadeState:'clear'|'out'|'black'|'in'='clear';
 private activePath:readonly Vec[]|null=null;private startDistance=0;private serial=0;private busy=false;
 constructor(private adapter:JourneySceneAdapter){}
 snapshot():JourneySnapshot {return Object.freeze({phase:this.phase,region:this.region,target:this.target,loadProgress:this.loadProgress,distance:this.distance,total:this.lease?routeLength(this.lease.route.path):0,error:this.error,canRetry:this.phase==='failed',canResume:this.phase==='paused'});}
 position():StablePose|null{return this.root?{kind:'standing',controllerRoot:this.root,yawRad:this.yaw}:null;}
 isInTransit(){return !!this.target&&this.phase!=='arrived'&&this.phase!=='idle'&&this.phase!=='disposed';}
 hasCheckpoint(){return !!this.root;}
 async prepare(to:JourneyRegion,start:Vec,token:Cancellation):Promise<void>{
  if(this.busy)throw Error('journey-busy');if(this.phase==='disposed')throw Error('journey-disposed');
  if(this.lease?.route.to===to&&this.target===to)return;
  if(this.target&&this.target!==to&&this.phase!=='arrived')throw Error('journey-already-pending');
  this.busy=true;const serial=++this.serial;this.target=to;this.phase='loading';this.error=null;this.loadProgress=0;
  try{
   const pending=this.adapter.prepare(this.region,to,start,token,p=>{if(serial===this.serial&&!token.cancelled&&Number.isFinite(p))this.loadProgress=Math.max(this.loadProgress,Math.min(.99,Math.max(0,p)));}).then(lease=>{if(token.cancelled||serial!==this.serial){lease.dispose();token.check();throw Error('journey-stale-load');}return lease;});
   const lease=await token.wait(pending);token.check();
   let camera:Pose;try{if(lease.route.from!==this.region||lease.route.to!==to)throw Error('journey-loaded-region-mismatch');validateJourneyRoute(lease.route,start);camera=this.adapter.readCamera();if([...camera.position,...camera.target].some(n=>!Number.isFinite(n)))throw Error('journey-invalid-camera');}catch(error){lease.dispose();throw error;}
   this.lease=lease;this.scenes.push(lease);this.distance=0;this.root=start;this.camera=camera;this.startCamera=this.camera;this.loadProgress=1;this.phase='ready';
  }catch(error){if(serial===this.serial){this.error=String(error);this.phase=token.cancelled?'paused':'failed';}throw error;}
  finally{if(serial===this.serial)this.busy=false;}
 }
 observe(actor:CharacterAdapter,world:WorldLease):void{
  if(!this.activePath||!this.lease||!this.startCamera)return;
  const f=actor.walkProgress?.();if(typeof f!=='number'||!Number.isFinite(f))return;
  this.distance=Math.min(routeLength(this.lease.route.path),this.startDistance+routeLength(this.activePath)*Math.max(0,Math.min(1,f)));
  this.root=sampleRoute(this.lease.route.path,this.distance);const ahead=sampleRoute(this.lease.route.path,this.distance+.08);
  if(dist(this.root,ahead)>.001)this.yaw=Math.atan2(ahead[0]-this.root[0],ahead[2]-this.root[2]);
  this.camera=journeyCamera(this.lease.route.path,this.distance,this.startCamera,this.lease.route.focus,this.lease.route.lens,this.lease.route.startBlendM,this.lease.route.landing);world.setCamera(this.camera);
  this.phase=this.distance<this.lease.route.bridgeStart?'approach':this.distance<this.lease.route.bridgeEnd?'bridge':'arrival';
 }
 async walk(actor:CharacterAdapter,world:WorldLease,token:Cancellation):Promise<void>{
  if(this.busy)throw Error('journey-busy');if(!this.lease||!this.root||!this.startCamera)throw Error('journey-not-prepared');
  if(!actor.walkProgress)throw Error('journey-needs-distance-signal');
  this.busy=true;this.error=null;const serial=++this.serial,path=remainingRoute(this.lease.route.path,this.distance);this.startDistance=this.distance;
  try{
   // v3.3 set-off fade (Grok Bot: no hard cut, no camera swoop): leaving the live island lens on a startBlendM-0 route,
   // fade to black (SETOFF_FADE.outS), cut to the follow pose (FOV straight to 48) and show the journey scenes only under
   // full black, then fade in (inS) while she walks. Audio is untouched. Leases without fadeCover keep the old path.
   const fade=this.distance===0&&this.lease.route.startBlendM===0&&this.lease.route.from==='island'&&typeof world.fadeCover==='function';
   if(fade){this.fadeState='out';await world.fadeCover!(1,SETOFF_FADE.outS);token.check();this.fadeState='black';
    this.camera=journeyCamera(this.lease.route.path,0,this.startCamera,this.lease.route.focus,this.lease.route.lens,0,this.lease.route.landing);world.setCamera(this.camera);}
   this.show(true);token.check();
   if(fade){this.fadeState='in';void Promise.resolve(world.fadeCover!(0,SETOFF_FADE.inS)).then(()=>{if(this.fadeState==='in')this.fadeState='clear';},()=>{});}
   if(path.length>1){this.activePath=path;this.phase=this.distance<this.lease.route.bridgeStart?'approach':this.distance<this.lease.route.bridgeEnd?'bridge':'arrival';
    const L=routeLength(path),tm=this.lease.route.timing,timing=tm?(this.distance>0?remainingTiming(routeLength(this.lease.route.path),L,tm):tm):null;
    await token.wait(actor.perform(timing?{kind:'walk',path,duration:timing.durationS,distanceAt:(time:number)=>journeyDistanceAt(L,timing,time)}:{kind:'walk',path,duration:L/this.lease.route.speed},token));token.check();}
   this.activePath=null;this.distance=routeLength(this.lease.route.path);this.root=sampleRoute(this.lease.route.path,this.distance);
   const before=sampleRoute(this.lease.route.path,Math.max(0,this.distance-.08));this.yaw=Math.atan2(this.root[0]-before[0],this.root[2]-before[2]);
   this.camera=journeyCamera(this.lease.route.path,this.distance,this.startCamera,this.lease.route.focus,this.lease.route.lens,this.lease.route.startBlendM,this.lease.route.landing);world.setCamera(this.camera);actor.cancelAndReset(this.position()!);
   this.region=this.lease.route.to;this.phase='arrived';this.target=null;
  }catch(error){if(this.fadeState==='out'||this.fadeState==='black'){this.fadeState='clear';try{void Promise.resolve(world.fadeCover?.(0,.2)).catch(()=>{});}catch{}}
   if(serial===this.serial){this.observe(actor,world);this.activePath=null;this.error=token.cancelled?null:String(error);this.phase=token.cancelled?'paused':'failed';}throw error;}
  finally{if(serial===this.serial)this.busy=false;}
 }
 /** Called BEFORE cancelling the action token, while its distance signal is still available. */
 suspend(actor:CharacterAdapter,world:WorldLease):void{this.observe(actor,world);this.activePath=null;if(this.isInTransit())this.phase='paused';}
 restore(actor:CharacterAdapter,world:WorldLease,visible:boolean):void{if(this.root)actor.cancelAndReset(this.position()!);if(this.camera)world.setCamera(this.camera);actor.setVisible(visible);this.show(visible);}
 show(visible:boolean){for(const scene of this.scenes)scene.show(visible);}
 /** 「主页」 from an arrived region (or a paused/failed journey): drop the journey scenes and stand her back on the island.
  * Not a completion: region unlocks/records live in the campaign save, not here; the next trip simply walks the route again. */
 returnToIsland():void{if(this.busy)throw Error('journey-busy');if(this.phase==='disposed')throw Error('journey-disposed');
  ++this.serial;for(const scene of this.scenes)scene.dispose();this.scenes=[];this.lease=null;this.region='island';this.target=null;this.phase='idle';
  this.distance=0;this.startDistance=0;this.root=null;this.camera=null;this.startCamera=null;this.activePath=null;this.error=null;this.loadProgress=0;}
 dispose(){++this.serial;this.phase='disposed';this.activePath=null;for(const scene of this.scenes)scene.dispose();this.scenes=[];this.lease=null;this.root=null;}
}
