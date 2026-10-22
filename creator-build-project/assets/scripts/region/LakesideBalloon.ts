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
 pathKeys:[[0,0,0],[.05,0,1.5],[.15,-1,4.5],[.3,-1,8],[.45,0,10],[.55,0,11],[.66,0,13],[.76,0,13.5],[.86,0,9],[.95,0,2.5],[1,0,0]] as ReadonlyArray<readonly [number,number,number]>,
 /** Peak basket altitude (m), kept for older readers (= max of pathKeys). */
 climbM:13.5,
 /** Kept for older readers: the descent is the last 22 % of the run. */
 descentM:8.5,
 /** v2 departure (lake-local, the lake is placed from S6 by lakesideJourney): S6 is in the great tree's roots and no spot of
  *  the skycity floor fits the parked balloon (the envelope always meets env_sky_static_palette), and the point
  *  [-7, 0.58, 53] the review asked for has no floor under it (west of the island edge, which runs x ≈ -3.5 at z 55).
  *  So the balloon is MOORED off the edge at deck level ([-8, .58, 53.5]: 0.7–0.8 m from all geometry, the nearest free
  *  spot to [-7, .58, 53]); she walks from S6 round the roots to the edge (walkLocal, production walk at walkMps) and
  *  boards under a short fade (no stepping-through-the-wall; there is no boarding clip). */
 /** b15 (场景特效bot): moored on the flat lawn behind the bank. [9.5,.61,23] sat on the bank lip: 3/72 footprint samples over
  *  the cut bank/water, the shore-foam ribbon (top of bank, z 22.75–24.25) ran under the whole basket and the floor floated
  *  5 cm above the grass. Here the footprint (r 0.72) is all lawn (terrain 0.569–0.579, 0.6 m clear of the foam ribbon) and
  *  the basket sits 0–0.7 cm into the grass (test_lakeside_balloon_mooring clearance ≥ 0.49 still holds).
 *  b15b: y 0.572 is the lawn height used for both (terrain 0.569–0.579 under the footprint, 0.569–0.581 along her walk; keeps the reviewed 0–0.7 cm press-in); she steps out
 *  and walks at the same y (lakesideBalloonMooring) up to the shared bank node L1. */
 /** b15 floor fix (场景特效bot): transport_balloon.glb now has a 3 cm woven floor board under the basket origin (board top 0 =
  *  her feet). The b15 floor was a zero-thickness sheet at the basket bottom, pressed 0-0.7 cm into the lawn, so the grass
  *  (0.569-0.579) came up through it. Mooring = lawn 0.572 + basketFloorM: the board bottom keeps the reviewed press-in and
  *  her floor sits 2.3-3.3 cm above the grass. */
 basketFloorM:.03,
 mooringLocal:[9.5,.602,25.6] as readonly [number,number,number],
 launchLocal:[-8,.58,53.5] as readonly [number,number,number],
 walkLocal:[[2,.58,63.2],[-1,.58,61],[-2.5,.58,57.5],[-3,.58,55.6]] as ReadonlyArray<readonly [number,number,number]>,
 /** NodeWalker.WALK_SPEED_MPS: the speed the production walk clip is calibrated for (no foot sliding). */
 walkMps:1.2,
 /** b15 get-out (角色动画bot getout_v3 INTEGRATE.md, supersedes v2): her walk from the basket door back to the shore. Requested cruise
  *  speed; the speed actually used is picked from walk_loop's calibrated native speed (exitWalkSpeed) so that the planner
  *  keeps walk_start and walk_stop (0.75…1.3 × native; 0.8 on the 0.7 m/s clip, rate 1.14). */
 exitWalkMps:.8,
 /** Exit path corner radius (m): at least 1.0 (the corner's foot slide drops below it), capped by half the shorter leg. */
 exitCornerM:1,
 /** Start root P0 in basket-local metres (door wall = +Z): 0.405 m behind the closed leaf's inner face. */
 exitStartLocal:[.03,0,.395] as readonly [number,number,number],
 /** Get-out clock: idle hold, door trigger after door_reach starts (flat leaf contact), leaf swing, walk_start entry. */
 exitIdleS:.5,
 doorContactS:.333,
 doorFollowDeg:2.75,
 doorFollowS:.034/* v3: ease-out starts at T0 + 0.367 */,
 doorOpenDeg:100,
 doorOpenS:.8,
 walkStartAfterReachS:1.8,
 /** walk_start / stop numbers the exit timing is planned with (hipsway65 anim_meta): start covers startM in startS at
  *  rate 1, the stop clip covers stopM in stopS. */
 exitStart:{S:1.733,M:.896,rateMax:1.2},
 exitStop:{S:1.47,M:.5},
 /** Walk start/stop ease (s), passed to the walk as distanceAt. */
 walkEaseS:.8,
 /** Walk corners rounded with this radius (m). */
 walkCornerM:1.6,
 /** Boarding: fade to black, (cut + seat her in the basket), fade back in; the basket lifts liftHoldS after the cut. */
 boardFadeOutS:.5,
 boardBlackS:.3,
 boardFadeInS:.7,
 liftHoldS:0,
 /** Flight time skipped at the cut (s). */
 flightSkipS:9,
 /** Walk lens, her-relative on the walk heading: [back, side (right +), up, aimAhead, aimUp (from chest), fov, aimSide (right +)]. */
 walkLens:[4.92,-.37,-.3,-.18,.15,48,.46] as readonly [number,number,number,number,number,number,number],
 /** Walk lens at the end of the walk (blended from walkLens on her walk progress, smootherstep). */
 walkLensEnd:[3.28,-6.51,.49,-.36,1.26,48,0] as readonly [number,number,number,number,number,number,number],
 /** Ride time: at least durationS (longer when the route needs it: cruise ≤ 4.2 m/s, |a| ≤ 3 m/s²). */
 durationS:30,
 easeInS:5,
 easeOutS:7,
 /** Lens keys on ride time τ (0…1): [τ, along, side, up] of the LENS in the flight frame (absolute: the skycity tree and
  *  the bank are fixed in this frame), then her-relative aim [ahead, side, up] from her chest (basket + 1.2 m), FOV. */
 keys:[[0,-4.66,3.47,6,0,0,0,48],[.15,-5.74,13.48,7.63,0,0,3.32,48],[.35,4.55,5.17,12.25,0,0,1.79,48],[.55,3.25,.02,13.58,0,0,-2.28,48],[.72,7.18,-4.99,18.57,1,0,.99,48],[.88,17.21,-2.39,17.4,1.5,0,-.22,50],[1,24.6,3.7,3,6,0,-1.5,54]] as ReadonlyArray<readonly [number,number,number,number,number,number,number,number]>,
 /** Start: blend from the camera she had in the skycity, at least this long (longer for big view / position gaps,
  *  SPEC §6.1: T = max(blendInS, √(5.7735·Δ°/120), √(5.7735·L/3))), never more than blendInMaxFrac of the ride. */
 blendInS:7.5,
 /** v2 ride: start blend (skycity camera → walk lens) length (s). */
 walkBlendInS:3.93,
 blendInMaxFrac:1,
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

export type LakesideBalloonRide=Readonly<{flight:LakesideBalloonFlight;walk:Vec[];walkS:number;walkTiming:JourneyTiming;walkAt(t:number):number;fadeOutAt:number;cutT:number;liftT:number;T:number;path:Vec[];
 vehicle(t:number):Vec;girl(t:number):Vec;girlYaw(t:number):number;cover(t:number):number;camera(t:number,from:Pose|null):Pose}>;
/** v2 ride: walk S6 → the moored basket (production walk), board under a fade, fly launch → bank, end on `landing`.
 *  walk = world points from her start (S6) to the boarding spot; launch = world basket position (moored at the edge). */
/** Round each inner corner of a walk polyline with a quadratic arc of up to `r` m (dense points), so she turns smoothly. */
const WALK_BLEND_MARGIN=1.6;
export function roundWalk(pts:readonly Vec[],r:number):Vec[]{
 if(pts.length<3)return pts.map(p=>[p[0],p[1],p[2]] as Vec);const out:Vec[]=[[pts[0][0],pts[0][1],pts[0][2]]];
 for(let i=1;i<pts.length-1;i++){const a=pts[i-1],b=pts[i],c=pts[i+1],l0=seg(a,b),l1=seg(b,c),k=Math.min(r,l0/2,l1/2);
  const p:Vec=[b[0]+(a[0]-b[0])*k/l0,b[1]+(a[1]-b[1])*k/l0,b[2]+(a[2]-b[2])*k/l0],q:Vec=[b[0]+(c[0]-b[0])*k/l1,b[1]+(c[1]-b[1])*k/l1,b[2]+(c[2]-b[2])*k/l1];
  for(let j=0;j<=32;j++){const u=j/32,w0=(1-u)*(1-u),w1=2*u*(1-u),w2=u*u;out.push([w0*p[0]+w1*b[0]+w2*q[0],w0*p[1]+w1*b[1]+w2*q[1],w0*p[2]+w1*b[2]+w2*q[2]]);}}
 const e=pts[pts.length-1];out.push([e[0],e[1],e[2]]);return out;
}
export function lakesideBalloonRide(walkKeys:Vec[],launch:Vec,bank:Vec,landing:Pose,knobs:BalloonKnobs=LAKESIDE_BALLOON_LANDING):LakesideBalloonRide{
 const walk=roundWalk(walkKeys,knobs.walkCornerM);
 const flight=lakesideBalloonFlight(launch,bank,landing,knobs),wl=routeLength(walk);
 // the walk starts and stops with the production walk's own ease (distanceAt), cruising at walkMps (no foot sliding)
 const walkTiming:JourneyTiming={durationS:wl/knobs.walkMps+(knobs.walkEaseS*2)/2,easeInS:knobs.walkEaseS,easeOutS:knobs.walkEaseS},walkS=walkTiming.durationS,walkAt=(t:number)=>journeyDistanceAt(wl,walkTiming,Math.max(0,Math.min(walkS,t)));
 const fadeOutAt=walkS,cutT=walkS+knobs.boardFadeOutS+knobs.boardBlackS/2,fadeInAt=walkS+knobs.boardFadeOutS+knobs.boardBlackS;
 // the cut under black also skips the lift-off out of the island's edge (flightSkipS of flight time): the shot opens on the
 // basket already aloft and drifting out under the canopy (no frames of the envelope grazing the rim)
 const liftT=cutT-knobs.flightSkipS,T=liftT+flight.timing.durationS;
 const wd=heading(walk[0],walk[walk.length-1]),wr:[number,number]=[-wd[1],wd[0]];
 const girl=(t:number):Vec=>t<cutT?sampleRoute(walk,walkAt(t)):flight.vehicle(t-liftT);
 const girlYaw=(t:number):number=>{if(t>=cutT)return flight.girlYawRad;const d=walkAt(t),a=sampleRoute(walk,Math.max(0,d-.3)),b=sampleRoute(walk,Math.min(wl,d+.3));return Math.atan2(b[0]-a[0],b[2]-a[2]);};
 const vehicle=(t:number):Vec=>t<cutT?flight.vehicle(0):flight.vehicle(t-liftT);
 const cover=(t:number):number=>t<fadeOutAt?0:t<fadeOutAt+knobs.boardFadeOutS?(t-fadeOutAt)/knobs.boardFadeOutS:t<fadeInAt?1:t<fadeInAt+knobs.boardFadeInS?1-(t-fadeInAt)/knobs.boardFadeInS:0;
 const walkLens=(t:number):Pose=>{const p=girl(Math.min(t,walkS)),c:Vec=[p[0],p[1]+CHEST,p[2]],e=smooth5(walkAt(t)/wl),W0=knobs.walkLens,W1=knobs.walkLensEnd,WL=[0,1,2,3,4,5,6].map(i=>(W0[i]||0)+((W1[i]||0)-(W0[i]||0))*e);
  return {position:[p[0]-wd[0]*WL[0]+wr[0]*WL[1],p[1]+CHEST+WL[2],p[2]-wd[1]*WL[0]+wr[1]*WL[1]],target:[c[0]+wd[0]*WL[3]+wr[0]*WL[6],c[1]+WL[4],c[2]+wd[1]*WL[3]+wr[1]*WL[6]],fovVerticalDeg:WL[5]};};
 // start blend: walkBlendInS for the default skycity follow camera, longer when the live camera starts further away (SPEC §6.1
 // rule on the orbit arc, ×WALK_BLEND_MARGIN for her own walk-off acceleration riding on the blend)
 let turn=0,fromKey:Pose|null=null,walkBlendS:number=knobs.walkBlendInS;
 const camera=(t:number,from:Pose|null):Pose=>{
  if(t>=T)return landing;
  if(t>=cutT)return flight.camera(Math.max(0,t-liftT),null)/* cut under full black */;
  let pose=walkLens(t);
  if(from&&from!==fromKey){const p0=girl(0);walkBlendS=Math.min(walkS,Math.max(knobs.walkBlendInS,WALK_BLEND_MARGIN*balloonBlendInS(from,walkLens(0),walkS,{...knobs,blendInS:0,blendInMaxFrac:1} as unknown as BalloonKnobs,[p0[0],p0[1]+CHEST,p0[2]])));}
  if(from&&t<walkBlendS){const p=girl(t),c:Vec=[p[0],p[1]+CHEST,p[2]];
   if(from!==fromKey){fromKey=from;const q=walkLens(0).position,p0=girl(0),da=Math.atan2(q[0]-p0[0],q[2]-p0[2])-Math.atan2(from.position[0]-p0[0],from.position[2]-p0[2]);turn=Math.sin(da)>=0?1:-1;}
   const e=smooth5(t/walkBlendS),a:Vec=[from.position[0]-c[0],from.position[1]-c[1],from.position[2]-c[2]],b:Vec=[pose.position[0]-c[0],pose.position[1]-c[1],pose.position[2]-c[2]],o=orbitOffset(a,b,e,turn);
   const v=blendPose(from,pose,e),q:Vec=[c[0]+o[0],c[1]+o[1],c[2]+o[2]],d=unit(v.position,v.target);
   pose={position:q,target:[q[0]+d[0]*10,q[1]+d[1]*10,q[2]+d[2]*10],fovVerticalDeg:v.fovVerticalDeg};}
  return pose;};
 return {flight,walk,walkS,walkTiming,walkAt,fadeOutAt,cutT,liftT,T,path:[...walk.map(v=>[v[0],v[1],v[2]] as Vec),...flight.path],vehicle,girl,girlYaw,cover,camera};
}

/** b15 turn foot-lock (getout v2 INTEGRATE §Corner): while the exit walk's yaw changes, the root is pivoted about the
 *  planted sole instead of the root (in-place root rotation skates the stance foot sideways in the corner). The sole sits
 *  FOOT_LOCK_HALF_W to her side (L = +X local, R = −X; +Z forward). The offset relaxes back onto the path over
 *  FOOT_LOCK_RELAX_S while the yaw is steady and never exceeds FOOT_LOCK_MAX_M. Applied by the lakeside adapter after the
 *  character driver's update (the frozen character controller is untouched). */
export const FOOT_LOCK_HALF_W=.09,FOOT_LOCK_RELAX_S=.35,FOOT_LOCK_MAX_M=.15;
export function footLockStep(off:readonly [number,number],planted:'L'|'R'|null,yawOld:number,yawNew:number,dt:number):[number,number]{
 let x=off[0],z=off[1];const d=yawNew-yawOld;
 if(planted&&Math.abs(d)>1e-6){const lx=planted==='L'?FOOT_LOCK_HALF_W:-FOOT_LOCK_HALF_W;
  x+=lx*(Math.cos(yawOld)-Math.cos(yawNew));z+=-lx*Math.sin(yawOld)+lx*Math.sin(yawNew);}
 else if(dt>0){const k=Math.exp(-dt/FOOT_LOCK_RELAX_S);x*=k;z*=k;}
 const l=Math.hypot(x,z);if(l>FOOT_LOCK_MAX_M){x*=FOOT_LOCK_MAX_M/l;z*=FOOT_LOCK_MAX_M/l;}
 return [x,z];}
/** b15: walk speed for the exit walk, from the clip's calibrated speed (walk_loop nativeSpeed): the requested exitWalkMps
 *  clamped into the band where CharacterMotion.planWalk keeps walk_start and walk_stop (CRUISE_RATIO 0.75…1.3). */
export function exitWalkSpeed(nativeMps:number,want:number=LAKESIDE_BALLOON_LANDING.exitWalkMps):number{
 const n=nativeMps>0&&isFinite(nativeMps)?nativeMps:.7;return Math.max(.75*n,Math.min(1.3*n,want));}
/** Fixed duration of the exit walk for planWalk: walk_start (rate k so its average matches the cruise), cruise at v, stop. */
export function exitWalkDuration(length:number,v:number,nativeMps=.7,knobs:BalloonKnobs=LAKESIDE_BALLOON_LANDING):number{
 const st=knobs.exitStart,sp=knobs.exitStop,k=Math.max(1,Math.min(st.rateMax,v/nativeMps)),cruise=Math.max(.3,length-st.M-sp.M);
 return st.S/k+cruise/v+sp.S;}
/** b15 step-down (角色动画bot anim/b15-getout-stepdown 3c5025af, getout_v3/INTEGRATE.md last section; 333f0b15 board).
 *  walk_start_stepdown: hard cut from door_reach at T0+1.8 (its f0 = door_reach @1.8 s), 1.7333 s at rate 1, root forward/Y from
 *  its root_motion table (Y = board 0.602 + y_m), then hard cut to walk_loop at 0.453 s and the distance clock from 1.1566 m.
 *  stepM: the route's step-down point (P0 + 0.36 m along the exit heading, on the 0.572 lawn). */
export const LAKESIDE_STEPDOWN={clip:'walk_start_stepdown',durationS:1.7333,loopTime:0.453,forwardEnd:1.1566,stepM:.36,stopWarp:.979,
 t:[0.0,0.0333,0.0667,0.1,0.1333,0.1667,0.2,0.2333,0.2667,0.3,0.3333,0.3667,0.4,0.4333,0.4667,0.5,0.5333,0.5667,0.6,0.6333,0.6667,0.7,0.7333,0.7667,0.8,0.8333,0.8667,0.9,0.9333,0.9667,1.0,1.0333,1.0667,1.1,1.1333,1.1667,1.2,1.2333,1.2667,1.3,1.3333,1.3667,1.4,1.4333,1.4667,1.5,1.5333,1.5667,1.6,1.6333,1.6667,1.7,1.7333] as readonly number[],
 forward:[0.0,0.003,0.0068,0.0116,0.0173,0.0239,0.03316,0.04647,0.06301,0.08184,0.10236,0.12374,0.14526,0.16629,0.18633,0.20464,0.2205,0.2354,0.2511,0.2677,0.285,0.303,0.3216,0.3408,0.3604,0.3805,0.4012,0.4227,0.4454,0.4693,0.4948,0.5221,0.5517,0.586,0.626,0.6686,0.7097,0.7469,0.7795,0.8085,0.8357,0.8625,0.8894,0.9162,0.943,0.9699,0.9966,1.0232,1.0499,1.0766,1.1032,1.1299,1.1566] as readonly number[],
 y:[0.0,0.0,0.0,0.0,0.0,0.0,-1e-05,-0.00031,-0.0011,-0.00241,-0.00423,-0.00654,-0.0093,-0.01245,-0.01592,-0.01962,-0.02485,-0.02967,-0.03349,-0.0356,-0.036,-0.03567,-0.03459,-0.03285,-0.03066,-0.03,-0.03,-0.03,-0.03,-0.03,-0.03,-0.03,-0.03,-0.03,-0.03,-0.03,-0.03,-0.03,-0.03,-0.03,-0.03,-0.03,-0.03,-0.03,-0.03,-0.03,-0.03,-0.03,-0.03,-0.03,-0.03,-0.03,-0.03] as readonly number[]} as const;
/** Root (forward m, y m) of walk_start_stepdown at clip time t (linear between the 30 fps samples, clamped). */
export function stepdownRootAt(t:number):[number,number]{const S=LAKESIDE_STEPDOWN,T=S.t,n=T.length;if(t<=T[0])return [S.forward[0],S.y[0]];if(t>=T[n-1])return [S.forward[n-1],S.y[n-1]];
 let i=1;while(i<n-1&&T[i]<t)i++;const u=(t-T[i-1])/((T[i]-T[i-1])||1);return [S.forward[i-1]+(S.forward[i]-S.forward[i-1])*u,S.y[i-1]+(S.y[i]-S.y[i-1])*u];}
/** b15 stand-up: fraction of the seat → P0 root travel at clip time t (linear over the clip). */
export function standupRootK(t:number,dur:number):number{return Math.max(0,Math.min(1,t/(dur||1)));}
/** The part of a walk polyline from route distance s on (first point = the point at s). */
export function walkFrom(walk:readonly Vec[],s:number):Vec[]{let acc=0;for(let i=1;i<walk.length;i++){const a=walk[i-1],b=walk[i],l=seg(a,b);
  if(acc+l>=s){const u=l>0?(s-acc)/l:0;return [[a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u,a[2]+(b[2]-a[2])*u] as Vec,...walk.slice(i).map(p=>[p[0],p[1],p[2]] as Vec)];}acc+=l;}
 const e=walk[walk.length-1];return [[e[0],e[1],e[2]]];}
/** Option A: land off the board frame. Disembark through the b15 basket door (DOOR_SPEC, door wall = basket local +Z), also
 *  offscreen, then walk to the unchanged shore root with the production planner (walk_start → walk_loop → walk_stop_bodyL).
 *  The camera stays on the board pose; the board fades in while she walks (she is off the board frame for ~7 s). */
export function lakesideBalloonMooring(bank:Vec,toWorld:(p:Vec)=>Vec,nativeMps=.7){
 const K=LAKESIDE_BALLOON_LANDING,mooring=toWorld([...K.mooringLocal] as Vec),origin=toWorld([0,0,0]),south=toWorld([0,0,2]);
 // Finish on the original arrival heading too: RegionJourneyController derives the final lens/yaw from this tangent.
 const approach:Vec=[bank[0]+south[0]-origin[0],bank[1],bank[2]+south[2]-origin[2]],h=heading(mooring,approach);
 // Door wall (local +Z) faces her exit heading h (Cocos rotY(θ) takes +Z to (sin θ, 0, cos θ)): 96.19° at the b15 mooring.
 const doorYawDeg=Math.atan2(h[0],h[1])*180/Math.PI,yr=doorYawDeg*Math.PI/180,c=Math.cos(yr),sn=Math.sin(yr),e=K.exitStartLocal;
 // P0 = mooring + rotY(doorYaw)·exitStartLocal (rotY: x' = x cos + z sin, z' = −x sin + z cos); feet at the basket origin
 // b15b (场景特效bot b69faa60) agrees: door exit and approach on the mooring lawn height, ending on the shared arrival node L1 (0.58).
 // v3: one ground height for the exit route = the 0.572 lawn (floor fix: mooring 0.602 = lawn + 3 cm board; bank anchors 0.58); lake-local P0 (9.1105, ·, 25.6724)
 const gy=mooring[1]-K.basketFloorM/* lawn under the board */,start:Vec=[mooring[0]+e[0]*c+e[2]*sn,mooring[1]+e[1]/* on the floor board */,mooring[2]-e[0]*sn+e[2]*c],appr:Vec=[approach[0],gy,approach[2]],shoreG:Vec=[bank[0],bank[1],bank[2]]/* the shore root itself stays the arrival anchor (final lens unchanged): the last 2 m leg rises 8 mm */;
 const l0=seg(start,appr),l1=seg(appr,shoreG),cornerM=Math.min(Math.max(1,K.exitCornerM),l0/2,l1/2);
 // sd3 step-down point: P0 + stepM along the exit heading (P0 → approach), on the lawn; the walk is straight from P0 to it
 // (not rounded) so walk[1] IS the step point and the start yaw (toward walk[1]) is unchanged.
 const hd=Math.hypot(appr[0]-start[0],appr[2]-start[2])||1,stepPt:Vec=[start[0]+(appr[0]-start[0])/hd*LAKESIDE_STEPDOWN.stepM,gy,start[2]+(appr[2]-start[2])/hd*LAKESIDE_STEPDOWN.stepM];
 const walk=[[start[0],start[1],start[2]] as Vec,...roundWalk([stepPt,appr,shoreG],Math.min(cornerM,seg(stepPt,appr)/2))],length=routeLength(walk),mps=exitWalkSpeed(nativeMps),walkS=exitWalkDuration(length,mps,nativeMps);
 const T0=K.exitIdleS,doorAt=T0+K.doorContactS,walkAt=T0+K.walkStartAfterReachS;
 // leaf yaw (deg, about local Y, + = outward) on the get-out clock: hand-follow for 2 frames, then ease-out cubic to +100°
 const doorDeg=(t:number):number=>{const a=t-doorAt;if(a<=0)return 0;if(a<K.doorFollowS)return K.doorFollowDeg*a/K.doorFollowS;const u=Math.min(1,(a-K.doorFollowS)/K.doorOpenS),q=1-Math.pow(1-u,3);return K.doorFollowDeg+(K.doorOpenDeg-K.doorFollowDeg)*q;};
 const timing:JourneyTiming={durationS:walkAt+walkS,easeInS:K.walkEaseS,easeOutS:K.walkEaseS};
 // facing at touchdown: she rode facing the flight heading; she is reset (offscreen) to face the door before the get-out
 // v3 facing: toward the first rounded-walk point (95.97°, 0.22° off the door normal)
 return {mooring,start,walk,length,cornerM,mps,walkS,timing,doorYawDeg,startYawRad:Math.atan2(walk[1][0]-start[0],walk[1][2]-start[2]),groundY:gy,T0,doorAt,walkStartAt:walkAt,doorDeg,
  /** her seat yaw under stand_point, compensated for the basket yaw so her ride facing is unchanged */
  seatYawDeg:(girlYawDeg:number)=>girlYawDeg-doorYawDeg};
}

/** b15 qashot fix: the whole lakeside route (S6 walk + flight + moored walk) is summarised for the journey controller as ONE
 *  timing, and journeyTimingOk rejects it when the 0.8 s walk ease gives the summary > 3 m/s² (b15 7b0c1c90: 3.65 → every
 *  skycity → lakeside journey failed with journey-invalid-timing). Same total duration; each ramp lengthened (0.1 s steps) until
 *  the summary passes. The ride and the walks keep their own clocks. */
export function lakesideRouteTiming(length:number,durationS:number,easeInS:number,easeOutS:number):JourneyTiming{
 let a=easeInS,b=easeOutS;
 for(let i=0;i<60&&!journeyTimingOk(Math.max(length,.01),{durationS,easeInS:a,easeOutS:b});i++){a=Math.round((a+.1)*10)/10;b=Math.round((b+.1)*10)/10;}
 return {durationS,easeInS:a,easeOutS:b};
}

/** b15 door shot (Grok review: the door opening and her step-out must be on screen). The ride lens no longer blends onto
 *  the landing pose before touchdown: from T - blendOutS it stays on the follow lens (which tracks the basket) down to
 *  touchdown and holds there (doorLens) until she has walked `outM` along the moored walk (clear of the basket: half-width
 *  1.0 m + her radius + margin; capped at walk start + outM at walk speed + capPadS game seconds). Only then does it blend
 *  onto the landing (= board) pose, over lakesideDoorBlendS (SPEC §6.1 rule, ≥ minBlendS), while she walks on off the board
 *  frame; the controller and the board fade-in follow that, still overlapping the rest of her walk. */
export const LAKESIDE_DOOR_HOLD={outM:1.6,capPadS:2.0,minBlendS:3.0,aimPull:.8} as const;
/** Door lens: on the shore side, ahead of her and to the side of the door path, looking back at the door and her first
 *  steps (the follow lens sits behind the basket, so the door wall, which faces the shore, would be hidden). Pure numbers. */
export const LAKESIDE_DOOR_LENS={aheadM:3.2,sideM:3.6,upM:1.5,lookUpM:1.0,fovDeg:50,turnInS:8} as const;
export function lakesideDoorLensAt(walk:readonly Vec[],ahead:number,side:number,up:number,lookUp:number,fov:number,outM:number=LAKESIDE_DOOR_HOLD.outM):Pose{
 const p0=walk[0],q=sampleRoute(walk as Vec[],outM),m:Vec=[(p0[0]+q[0])/2,(p0[1]+q[1])/2,(p0[2]+q[2])/2];
 const d=unit(p0,q),hl=Math.hypot(d[0],d[2])||1,f:Vec=[d[0]/hl,0,d[2]/hl],sd:Vec=[f[2],0,-f[0]];
 const pos:Vec=[q[0]+f[0]*ahead+sd[0]*side,m[1]+up,q[2]+f[2]*ahead+sd[2]*side];
 return {position:pos,target:[m[0]-f[0]*.3,m[1]+lookUp,m[2]-f[2]*.3],fovVerticalDeg:fov};
}
/** Framing points of the door shot: the basket box (±1.0 m, 0…1.25 m, around the mooring) and her door path (feet, head). */
export function lakesideDoorFramePoints(walk:readonly Vec[],basket:Vec,outM:number=LAKESIDE_DOOR_HOLD.outM):Vec[]{
 const pts:Vec[]=[];for(const x of [-1,1])for(const z of [-1,1])for(const y of [0,1.25])pts.push([basket[0]+x,basket[1]+y,basket[2]+z]);
 const q=sampleRoute(walk as Vec[],outM);for(const p of [walk[0],q])for(const y of [0,1.65])pts.push([p[0],p[1]+y,p[2]]);
 return pts;
}
/** b16 door lens retune (real-build review: ~30% empty grass at the bottom, basket cut on the right): a small deterministic
 *  search of the shore-side lens (ahead/side/up/look height) for the frame that holds the whole basket + her door path
 *  inside 0.9, with the lowest framed point near the bottom (≈ -0.8, little empty ground) and the block centred. Falls back
 *  to the b15 numbers when no candidate fits. `aspect` is the screen width/height. */
export function lakesideDoorLens(walk:readonly Vec[],basket?:Vec,aspect=390/844,outM:number=LAKESIDE_DOOR_HOLD.outM,k=LAKESIDE_DOOR_LENS):Pose{
 if(!basket)return lakesideDoorLensAt(walk,k.aheadM,k.sideM,k.upM,k.lookUpM,k.fovDeg,outM);
 const pts=lakesideDoorFramePoints(walk,basket,outM);let best:Pose|null=null,bc=1e9;
 for(let ahead=2;ahead<=7.01;ahead+=.5)for(let side=1;side<=6.01;side+=.5)for(let up=.6;up<=2.41;up+=.3)for(let lu=.3;lu<=1.51;lu+=.3){
  const P=lakesideDoorLensAt(walk,ahead,side,up,lu,k.fovDeg,outM),f=unit(P.position,P.target),rl=Math.hypot(f[0],f[2])||1,r:Vec=[-f[2]/rl,0,f[0]/rl];
  const u:Vec=[r[1]*f[2]-r[2]*f[1],r[2]*f[0]-r[0]*f[2],r[0]*f[1]-r[1]*f[0]],th=Math.tan(k.fovDeg*Math.PI/360);
  let xmn=9,xmx=-9,ymn=9,ymx=-9,ok=true;
  for(const q of pts){const v=[q[0]-P.position[0],q[1]-P.position[1],q[2]-P.position[2]],z=v[0]*f[0]+v[1]*f[1]+v[2]*f[2];if(z<1.5){ok=false;break;}
   const x=(v[0]*r[0]+v[2]*r[2])/(z*th*aspect),y=(v[0]*u[0]+v[1]*u[1]+v[2]*u[2])/(z*th);xmn=Math.min(xmn,x);xmx=Math.max(xmx,x);ymn=Math.min(ymn,y);ymx=Math.max(ymx,y);}
  if(!ok||xmn<-.9||xmx>.9||ymn<-.9||ymx>.9)continue;
  const c=Math.abs(ymn+.8)*4+Math.abs((xmn+xmx)/2)*2+Math.max(0,.55-(ymx-ymn))*3;if(c<bc){bc=c;best=P;}}
 return best||lakesideDoorLensAt(walk,k.aheadM,k.sideM,k.upM,k.lookUpM,k.fovDeg,outM);
}
/** Ride lens with the door-shot ending (see LAKESIDE_DOOR_HOLD): R.camera until the old blend-out window (from there the
 *  plain follow lens, which equals R.camera at its start), and over the last turnInS of the descent an
 *  orbit round the basket (RegionJourneyCore.orbitOffset, short way round, view slerped) from the follow lens onto the
 *  door lens, arriving exactly at touchdown; held on the door lens after T. */
export function lakesideDoorRideCamera(R:LakesideBalloonRide,door:Pose,t:number,from:Pose|null,k=LAKESIDE_DOOR_LENS):Pose{
 if(t<R.T-LAKESIDE_BALLOON_LANDING.blendOutS||t<R.cutT)return R.camera(t,from)/* the old blend-out onto the landing pose is not used */;
 const o=R.T-k.turnInS;if(t>=R.T)return door;if(t<o)return R.flight.follow(t-R.liftT);
 const fl=R.flight.follow(t-R.liftT),v=R.vehicle(t),c:Vec=[v[0],v[1]+1.0,v[2]],e=Math.max(0,Math.min(1,(t-o)/k.turnInS)),x=e*e*e*(e*(e*6-15)+10);
 const vt=R.vehicle(R.T),cT:Vec=[vt[0],vt[1]+1.0,vt[2]];
 const a:Vec=[fl.position[0]-c[0],fl.position[1]-c[1],fl.position[2]-c[2]],b:Vec=[door.position[0]-cT[0],door.position[1]-cT[1],door.position[2]-cT[2]],off=orbitOffset(a,b,x,0);
 const bl=blendPose(fl,door,x),p:Vec=[c[0]+off[0],c[1]+off[1],c[2]+off[2]],dd=unit(bl.position,bl.target);
 return {position:p,target:[p[0]+dd[0]*10,p[1]+dd[1]*10,p[2]+dd[2]*10],fovVerticalDeg:bl.fovVerticalDeg};
}
/** Blend length door lens → landing pose: max(minBlendS, √(5.7735·L/3), √(5.7735·Δ°/120)) (smootherstep peaks ≤ 3 m/s², ≤ 120°/s²). */
export function lakesideDoorBlendS(a:Pose,b:Pose):number{
 const L=Math.hypot(a.position[0]-b.position[0],a.position[1]-b.position[1],a.position[2]-b.position[2]);
 const u=unit(a.position,a.target),v=unit(b.position,b.target),deg=Math.acos(Math.max(-1,Math.min(1,u[0]*v[0]+u[1]*v[1]+u[2]*v[2])))*180/Math.PI;
 return Math.max(LAKESIDE_DOOR_HOLD.minBlendS,Math.sqrt(5.7735*L/3),Math.sqrt(5.7735*deg/120));
}
/** b16 board entry: walk distance (m along the moored walk) from which her whole body (feet, waist, head ± ~0.3 m) is
 *  inside `margin` of the landing (= board) frame. The door → board blend ends there (driven by her real walk progress), so
 *  she stays clearly in frame through the blend and the board fade-in instead of being cut by the right edge. */
export function lakesideBoardEntryM(walk:readonly Vec[],land:Pose,aspect:number,fromM:number,margin=.85):number{
 const L=routeLength(walk as Vec[]),f=unit(land.position,land.target),rl=Math.hypot(f[0],f[2])||1,r:Vec=[-f[2]/rl,0,f[0]/rl];
 const u:Vec=[r[1]*f[2]-r[2]*f[1],r[2]*f[0]-r[0]*f[2],r[0]*f[1]-r[1]*f[0]],th=Math.tan((land.fovVerticalDeg||48)*Math.PI/360);
 const inF=(q:Vec)=>{const v=[q[0]-land.position[0],q[1]-land.position[1],q[2]-land.position[2]],z=v[0]*f[0]+v[1]*f[1]+v[2]*f[2];if(z<.3)return false;
  return Math.abs((v[0]*r[0]+v[2]*r[2])/(z*th*aspect))<=margin&&Math.abs((v[0]*u[0]+v[1]*u[1]+v[2]*u[2])/(z*th))<=margin;};
 for(let s=fromM;s<=L;s+=.05){const p=sampleRoute(walk as Vec[],s);let ok=true;
  for(const y of [0,.9,1.65])for(const dx of [-.3,.3]){if(!inF([p[0]+r[0]*dx,p[1]+y,p[2]+r[2]*dx]))ok=false;}if(ok)return s;}
 return L;
}
/** Blend progress (0…1, before smootherstep) for the door → board blend: her walk progress between outM and entryM, never
 *  faster than elapsed/minS (so a short entry distance still honours the SPEC §6.1 blend length). */
export function lakesideDoorBlendU(walkedM:number,outM:number,entryM:number,elapsedS:number,minS:number):number{
 const w=entryM>outM+1e-3?(walkedM-outM)/(entryM-outM):1;return Math.max(0,Math.min(1,w,elapsedS/Math.max(.1,minS)));
}
/** Door lens → landing pose at blend progress u∈[0,1] (smootherstep, as the old blend-out). */
export function lakesideDoorBlendPose(a:Pose,b:Pose,u:number,her?:Vec,pull=LAKESIDE_DOOR_HOLD.aimPull):Pose{const x=Math.max(0,Math.min(1,u)),p=blendPose(a,b,x*x*x*(x*(x*6-15)+10));
 if(!her||x<=0||x>=1)return p;
 // b16: mid-blend aim pull toward her chest (0 at both ends, so the door lens and the board pose stay exact)
 const k=pull*Math.sin(Math.PI*x),d=unit(p.position,p.target),dist=Math.hypot(p.target[0]-p.position[0],p.target[1]-p.position[1],p.target[2]-p.position[2]),h=unit(p.position,[her[0],her[1]+1.0,her[2]]);
 const m=[d[0]+(h[0]-d[0])*k,d[1]+(h[1]-d[1])*k,d[2]+(h[2]-d[2])*k],ml=Math.hypot(m[0],m[1],m[2])||1;
 return {position:p.position,target:[p.position[0]+m[0]/ml*dist,p.position[1]+m[1]/ml*dist,p.position[2]+m[2]/ml*dist],fovVerticalDeg:p.fovVerticalDeg};}
