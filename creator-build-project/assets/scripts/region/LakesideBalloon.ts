import type {Pose, Vec} from '../world-r1/WorldFlowCore';
import {journeyDistanceAt, journeyTimingOk, orbitOffset, routeLength, sampleRoute, type JourneyTiming} from '../world-r1/RegionJourneyCore';
/** Skycity → lakeside balloon (运镜bot r5 lakeside-landing-cam, docs/r5/lakeside-landing/RESULT.md).
 *  One continuous shot: the lens leaves the skycity camera, rises with the basket, looks down over the lake from above and
 *  behind her right shoulder, follows the slow glide down to the south bank and ends EXACTLY on the standing landing pose
 *  (LakesideCameraLayout.LAKESIDE_CAMERA_LAYOUT.landing for this screen = the board camera position), at rest, so the
 *  landing → board hook has (almost) nothing left to close. Pure numbers, no engine imports.
 *  Lens offsets are her-relative (chest point in the basket), in the flight frame: back = away from the bank, side = her
 *  right, up = world up; aim = chest + ahead·heading − drop·up. Keys are on ride time (0…1) and interpolated with a
 *  monotone cubic (C1, no overshoot). */
export const LAKESIDE_BALLOON_LANDING={
 /** Flight frame: origin = her skycity departure point (S6, at the foot of the great tree; the lake is placed from it by
  *  lakesideJourney, so the bank is always 38.7 m ahead), along = toward the bank, side = right of that, up = world up.
  *  Basket over the run u (0 = lift-off, 1 = touchdown on the bank): [u, side m (right +), metres above the departure].
  *  S6 sits in the great tree's roots, right against the trunk: the basket lifts off up and to her left (west) into the
  *  free corridor under the canopy (side −6 m, 10–11 m up; the canopy underside is ~24 m, the envelope top stays ≤ 22 m),
  *  floats out north, rises once clear of the canopy (the lake opens below), then settles almost vertically onto the bank. */
 pathKeys:[[0,0,0],[.031,-2.6,3.5],[.109,-5,8],[.238,-6,10.5],[.444,-6,11],[.625,-4.5,12.5],[.755,-2.5,15.5],[.858,-1,13],[.948,-.8,4],[1,0,0]] as ReadonlyArray<readonly [number,number,number]>,
 /** Peak basket altitude (m), kept for older readers (= max of pathKeys). */
 climbM:13.2,
 /** Kept for older readers: the descent is the last 22 % of the run. */
 descentM:8.5,
 /** Ride time: at least durationS (longer when the route needs it: cruise ≤ 4.2 m/s, |a| ≤ 3 m/s²). */
 durationS:30,
 easeInS:5,
 easeOutS:7,
 /** Lens keys on ride time τ (0…1): [τ, along, side, up] of the LENS in the flight frame (absolute: the skycity tree and
  *  the bank are fixed in this frame), then her-relative aim [ahead, side, up] from her chest (basket + 1.2 m), FOV. */
 keys:[[0,5.7,-2.5,1.5,0,0,1,48],[.2,14.8,-4.6,2.8,0,0,1.2,48],[.38,24.3,-16.1,17.8,0,0,1.2,48],[.55,25.5,-26.4,15,0,0,.5,48],[.72,20,-12,20,1,0,-1,48],[.88,25,-4,15,1.5,0,-1,50],[1,32,1,3,6,0,-1.5,54]] as ReadonlyArray<readonly [number,number,number,number,number,number,number,number]>,
 /** Start: blend from the camera she had in the skycity, at least this long (longer for big view / position gaps,
  *  SPEC §6.1: T = max(blendInS, √(5.7735·Δ°/120), √(5.7735·L/3))), never more than blendInMaxFrac of the ride. */
 blendInS:7,
 blendInMaxFrac:.3,
 /** End: smootherstep from the keyed lens onto the landing pose over the last blendOutS (position lerp, view slerp, FOV). */
 blendOutS:8,
 /** Atmosphere (lake light/fog): route.bridgeStart/End at these run fractions; LakesideJourneyAtmosphere ramps from their
  *  midpoint (out from under the canopy) to 1 m before the stop. */
 atmosphereFromU:.3,
 atmosphereToU:.8,
 /** Old single-pose lens (lakesideBalloonLens, kept for older callers/tests). */
 camBackM:8.5,
 camUpM:3.2,
 camSideM:1.4,
 lookUpM:1.1,
 fovDeg:48,
 /** Her yaw in the basket relative to the flight heading (deg): facing the lake. */
 yawDeg:0,
 /** Rider: feet this far below the basket's stand_point (0.1 m floor), so her feet are at the basket origin = the path
  *  point and the touchdown point IS her standing root (no 10 cm drop when she is set down). */
 riderDropM:.1,
 /** Free look during the ride (documented in docs/r5/lakeside-landing/RESULT.md, not in code yet): ±20° yaw/pitch around
  *  the shot lens, critically damped spring back (0.6 s) on release; off during the last blendOutS. */
} as const;
export type BalloonKnobs=typeof LAKESIDE_BALLOON_LANDING;
const CHEST=1.2;
const smooth5=(x:number)=>{const u=Math.max(0,Math.min(1,x));return u*u*u*(10+u*(-15+6*u));};
const seg=(a:Vec,b:Vec)=>Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2]);
const heading=(start:Vec,bank:Vec):[number,number]=>{const dx=bank[0]-start[0],dz=bank[2]-start[2],h=Math.hypot(dx,dz)||1;return [dx/h,dz/h];};
/** Basket path: straight in plan from `start` to `bank`, altitude from pathKeys (monotone cubic). Dense polyline. */
export function lakesideBalloonPath(start:Vec,bank:Vec,knobs:BalloonKnobs=LAKESIDE_BALLOON_LANDING):{path:Vec[];bridgeStart:number;bridgeEnd:number}{
 const N=96,K=knobs.pathKeys,path:Vec[]=[],us:number[]=[],h=heading(start,bank),r:[number,number]=[-h[1],h[0]];
 for(let i=0;i<=N;i++){const s=i/N,u=s*s*(3-2*s);us.push(u);
  const sd=mono(K,1,u);path.push(i===0?[start[0],start[1],start[2]]:i===N?[bank[0],bank[1],bank[2]]:[start[0]+(bank[0]-start[0])*u+r[0]*sd,start[1]+(bank[1]-start[1])*u+mono(K,2,u),start[2]+(bank[2]-start[2])*u+r[1]*sd]);}
 const lenTo=(u:number)=>{let n=0;for(let i=1;i<path.length&&us[i]<=u;i++)n+=seg(path[i-1],path[i]);return n;};
 const total=routeLength(path),bridgeStart=Math.min(total-.1,lenTo(knobs.atmosphereFromU)),bridgeEnd=Math.max(bridgeStart+.05,Math.min(total,lenTo(knobs.atmosphereToU)));
 return {path,bridgeStart,bridgeEnd};
}
/** At least `durationS`, and long enough that cruise stays under 4.2 m/s and |a| under 3. */
export function lakesideBalloonTiming(length:number,knobs:BalloonKnobs=LAKESIDE_BALLOON_LANDING):JourneyTiming{
 const easeInS=knobs.easeInS,easeOutS=knobs.easeOutS;
 let durationS=knobs.durationS;
 while(!journeyTimingOk(Math.max(length,0.01),{durationS,easeInS,easeOutS})&&durationS<180)durationS=Math.round((durationS+0.5)*10)/10;
 return {durationS,easeInS,easeOutS};
}
/** Old single pose: behind / to the side / above the basket, looking at the bank (kept for older callers). */
export function lakesideBalloonLens(pos:Vec,bank:Vec,knobs:BalloonKnobs=LAKESIDE_BALLOON_LANDING):Pose{
 const dx=bank[0]-pos[0],dz=bank[2]-pos[2],h=Math.hypot(dx,dz)||1;
 const bx=-dx/h,bz=-dz/h,sx=-bz,sz=bx;
 return {position:[pos[0]+bx*knobs.camBackM+sx*knobs.camSideM,pos[1]+knobs.camUpM,pos[2]+bz*knobs.camBackM+sz*knobs.camSideM],target:[bank[0],bank[1]+knobs.lookUpM,bank[2]],fovVerticalDeg:knobs.fovDeg};
}
type V3=[number,number,number];
const unit=(a:readonly number[],b:readonly number[]):V3=>{const d:V3=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],l=Math.hypot(d[0],d[1],d[2])||1;return [d[0]/l,d[1]/l,d[2]/l];};
/** Monotone cubic (Fritsch–Carlson) through keys[i][0] → keys[i][col]. */
function mono(keys:ReadonlyArray<ReadonlyArray<number>>,col:number,x:number):number{
 const n=keys.length;if(x<=keys[0][0])return keys[0][col];if(x>=keys[n-1][0])return keys[n-1][col];
 const d:number[]=[],m:number[]=[];for(let i=0;i<n-1;i++)d.push((keys[i+1][col]-keys[i][col])/(keys[i+1][0]-keys[i][0]));
 m.push(0);for(let i=1;i<n-1;i++)m.push(d[i-1]*d[i]<=0?0:(d[i-1]+d[i])/2);m.push(0);
 for(let i=0;i<n-1;i++){if(d[i]===0){m[i]=0;m[i+1]=0;continue;}const a=m[i]/d[i],b=m[i+1]/d[i],s=a*a+b*b;if(s>9){const t=3/Math.sqrt(s);m[i]=t*a*d[i];m[i+1]=t*b*d[i];}}
 let i=0;while(i<n-2&&x>keys[i+1][0])i++;const h=keys[i+1][0]-keys[i][0],t=(x-keys[i][0])/h,t2=t*t,t3=t2*t;
 return (2*t3-3*t2+1)*keys[i][col]+(t3-2*t2+t)*h*m[i]+(-2*t3+3*t2)*keys[i+1][col]+(t3-t2)*h*m[i+1];
}
/** Blend a → b by weight e: position lerp, view direction slerp (look-at, no roll), FOV lerp. */
export function blendPose(a:Pose,b:Pose,e:number):Pose{
 if(e<=0)return a;if(e>=1)return b;const A=a.position,B=b.position,d0=unit(A,a.target),d1=unit(B,b.target);
 const th=Math.acos(Math.max(-1,Math.min(1,d0[0]*d1[0]+d0[1]*d1[1]+d0[2]*d1[2]))),sn=Math.sin(th),k0=th>1e-9?Math.sin((1-e)*th)/sn:1-e,k1=th>1e-9?Math.sin(e*th)/sn:e;
 const p:Vec=[A[0]+(B[0]-A[0])*e,A[1]+(B[1]-A[1])*e,A[2]+(B[2]-A[2])*e],d=[d0[0]*k0+d1[0]*k1,d0[1]*k0+d1[1]*k1,d0[2]*k0+d1[2]*k1],l=Math.hypot(d[0],d[1],d[2])||1;
 const f0=a.fovVerticalDeg??48,f1=b.fovVerticalDeg??48;
 return {position:p,target:[p[0]+d[0]/l*10,p[1]+d[1]/l*10,p[2]+d[2]/l*10],fovVerticalDeg:f0+(f1-f0)*e};
}
/** Start blend length for a camera gap (SPEC §6.1 acceleration rule, smootherstep: peak |a| = 5.7735·Δ/T²). */
export function balloonBlendInS(from:Pose,to:Pose,rideS:number,knobs:BalloonKnobs=LAKESIDE_BALLOON_LANDING,chest:Vec=to.target as Vec):number{
 const d0=unit(from.position,from.target),d1=unit(to.position,to.target),deg=Math.acos(Math.max(-1,Math.min(1,d0[0]*d1[0]+d0[1]*d1[1]+d0[2]*d1[2])))*180/Math.PI,
  // the blend orbits round her (see camera()), so size it on the arc, not the chord
  a:Vec=[from.position[0]-chest[0],0,from.position[2]-chest[2]],b:Vec=[to.position[0]-chest[0],0,to.position[2]-chest[2]],ra=Math.hypot(a[0],a[2]),rb=Math.hypot(b[0],b[2]),
  arc=Math.acos(Math.max(-1,Math.min(1,(a[0]*b[0]+a[2]*b[2])/((ra*rb)||1))))*(ra+rb)/2,
  L=Math.max(seg(from.position as Vec,to.position as Vec),Math.hypot(arc,Math.abs(ra-rb),from.position[1]-to.position[1]));
 return Math.min(rideS*knobs.blendInMaxFrac,Math.max(knobs.blendInS,Math.sqrt(5.7735*deg/120),Math.sqrt(5.7735*L/3)));
}
export type LakesideBalloonFlight=Readonly<{path:Vec[];bridgeStart:number;bridgeEnd:number;timing:JourneyTiming;total:number;heading:[number,number];
 /** Basket (= her feet) position at ride time t. */
 vehicle(t:number):Vec;
 /** Follow lens without the start/end blends (her-relative keys). */
 follow(t:number):Pose;
 /** Shot lens at ride time t: skycity camera `from` → follow → `landing` (exact at t ≥ duration). */
 camera(t:number,from:Pose|null):Pose;
 /** Girl yaw in the basket (rad, Cocos Y rotation: atan2(x, z) of her facing). */
 girlYawRad:number}>;
/** The whole ride for skycity `start` → `bank`, ending on `landing` (the standing landing pose for this screen). */
export function lakesideBalloonFlight(start:Vec,bank:Vec,landing:Pose,knobs:BalloonKnobs=LAKESIDE_BALLOON_LANDING):LakesideBalloonFlight{
 const f=lakesideBalloonPath(start,bank,knobs),total=routeLength(f.path),timing=lakesideBalloonTiming(total,knobs),T=timing.durationS,h=heading(start,bank),r:[number,number]=[-h[1],h[0]];
 const vehicle=(t:number):Vec=>sampleRoute(f.path,journeyDistanceAt(total,timing,Math.max(0,Math.min(T,t))));
 const follow=(t:number):Pose=>{const p=vehicle(t),x=Math.max(0,Math.min(1,t/T)),K=knobs.keys,v=(c:number)=>mono(K,c,x);
  const at=(al:number,sd:number,up:number,o:readonly number[]):Vec=>[o[0]+h[0]*al+r[0]*sd,o[1]+up,o[2]+h[1]*al+r[1]*sd],c:Vec=[p[0],p[1]+CHEST,p[2]];
  return {position:at(v(1),v(2),v(3),start),target:at(v(4),v(5),v(6),c),fovVerticalDeg:v(7)};};
 let tin=-1,fromKey:Pose|null=null;
 /** Start blend AROUND her (RegionJourneyCore.orbitOffset on the chest-relative lens offset: azimuth, radius and height
  *  separately, short way round), view slerped, FOV lerped: the lens never cuts through her or the basket. */
 let turn=0;
 const orbitIn=(from:Pose,to:Pose,c:Vec,e:number):Pose=>{if(e<=0)return from;if(e>=1)return to;
  const a:Vec=[from.position[0]-c[0],from.position[1]-c[1],from.position[2]-c[2]],b:Vec=[to.position[0]-c[0],to.position[1]-c[1],to.position[2]-c[2]],o=orbitOffset(a,b,e,turn);
  const v=blendPose(from,to,e),p:Vec=[c[0]+o[0],c[1]+o[1],c[2]+o[2]],d=unit(v.position,v.target);
  return {position:p,target:[p[0]+d[0]*10,p[1]+d[1]*10,p[2]+d[2]*10],fovVerticalDeg:v.fovVerticalDeg};};
 const camera=(t:number,from:Pose|null):Pose=>{
  if(t>=T)return landing;
  let pose=follow(t);
  if(from){if(from!==fromKey){fromKey=from;const p0=vehicle(0);tin=balloonBlendInS(from,follow(0),T,knobs,[p0[0],p0[1]+CHEST,p0[2]]);
   // lock the orbit direction once, so a near-opposite start camera never flips sides mid-blend
   const q=follow(0).position,da=Math.atan2(q[0]-p0[0],q[2]-p0[2])-Math.atan2(from.position[0]-p0[0],from.position[2]-p0[2]);turn=Math.sin(da)>=0?1:-1;}if(t<tin){const p=vehicle(t);pose=orbitIn(from,pose,[p[0],p[1]+CHEST,p[2]],smooth5(t/tin));}}
  const o=T-knobs.blendOutS;if(t>o)pose=blendPose(pose,landing,smooth5((t-o)/knobs.blendOutS));
  return pose;};
 return {path:f.path,bridgeStart:f.bridgeStart,bridgeEnd:f.bridgeEnd,timing,total,heading:h,vehicle,follow,camera,girlYawRad:Math.atan2(h[0],h[1])+knobs.yawDeg*Math.PI/180};
}
