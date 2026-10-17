import type {Pose,Vec} from '../world-r1/WorldFlowCore';
import {arrivalPose,type JourneyLanding,type JourneyTiming} from '../world-r1/RegionJourneyCore';
import {fromLookAt,projectPoint,type AuthoredPose,type CameraPose} from '../world-r1/CameraPose';
import {REGION_JOURNEY_LAYOUT,bridgePath,islandApproach,plus} from './RegionJourneyLayout';
/** Lakeside (r5h3) camera data: journey into the region, Landing A arrival and the board framing. Pure numbers and maths, no
 * engine imports, so tools/journey-integration/test-lakeside-camera.cjs checks exactly these values against the committed
 * region_lakeside GLBs placed by scene_r5h_slim_transforms.json. Coordinates marked Local are lakeside-root (Y-up, metres).
 * Route: island exit (same approach as 04→05) → 24 m rainbow bridge (same shape) → lands on the empty south bank (flat
 * 0.56–0.59 m from z 23 to 39) → walks 11.5 m straight toward the lake and stops 2.5 m from the shore, facing the board.
 * Landing A machinery (RegionJourneyCore.arrivalPose/journeyCamera) with per-route overrides: lens on HER RIGHT, no late
 * lift (no crane-up), close fallback-like end pose. The lens is driven by her walked distance, and her walk has the S-curve
 * time profile (timing), so the lens eases in/out with her and is at rest when she stops (no Hermite needed: the end pose
 * is the follow pose's own neighbourhood). Board centre as the focus. */
export const LAKESIDE_CAMERA_LAYOUT={
 /** Root Y rotation (Cocos setRotationFromEuler(0,yawDeg,0)): lakeside -Z (toward the lake) becomes the bridge's world +Z. */
 yawDeg:180,
 /** World offset of the bridge landing from the island approach end: the 04→05 bridge length and level (meadowOffset). */
 offset:[0,0,24] as Vec,
 bridgeArchM:2,
 /** Bridge landing and walk on the south bank (Local). */
 landingLocal:[1.2,.58,36] as Vec,
 walkLocal:[[1.2,.58,30],[1.2,.58,24.5]] as ReadonlyArray<Vec>,
 /** Board centre (7×7 cells x −3.3…3.3, z 8.7…15.3) at piece height. */
 focusLocal:[0,.3,12] as Vec,
 /** Landing A overrides (all other arrival numbers = JOURNEY_CAMERA, i.e. the 08→09 Landing A values). Close end pose
  * (Funning on the c375304 video: the fallback's final frame reads the board and bridge better): the arrival pose is the
  * fallback's close neighbourhood (6.8 m behind / 1.1 m right of her; 3.0 m up, 0.4 m under the 3.4 m follow height) and it
  * ENDS ON THE BOARD CAMERA (reviewer): aim, pitch and FOV are those of lakesideAlignedLookAt at the 390×844 reference with
  * the board UI's default insets (ManagedMobileBoardUI: top 47 / bottom 34 + capsule; iPhone 12–15 class)
  * (board centre on the 2D grid centre: horizontal aim at the focus, arrivalPitchDeg below the focus pitch, arrivalFovDeg),
  * so the landing→board hook closes no gap there and only a small one on other screens (≤ ~2.5° view, a few ° FOV; the
  * test reports it per layout). If BoardLayout or the landing position changes, re-derive the two numbers (the test fails
  * when the 390×844 gap exceeds 0.01° / 0.01° FOV). Over the 14.3 m arrival blend the lens height above her eases
  * 3.4 → 3.0 m and the FOV 48 → arrivalFovDeg with the same smoother as the view, so the lens never climbs in the world
  * (no crane-up). */
 landing:{arrivalBackM:6.8,arrivalSideM:1.1,arrivalUpM:3.0,arrivalPitchDeg:-2.507461,arrivalFovDeg:57.35256,arrivalLiftM:0,arrivalHermite:0,anchorSmoothM:1.5} as JourneyLanding,
 /** Time profile (reviewer on c375304): the 39.2 m leg in 17 s, smootherstep ramps 4 s up from rest and 4 s down into
  * the landing stop. Cruise 3.02 m/s (≤ 4.5), |a| ≤ 1.41 m/s² (≤ 3), |jerk| ≤ 1.09 m/s³ for her; the lens follows distance
  * (K7: lens |a| ≤ 1.95 m/s², |jerk| ≤ 4.9 m/s³). */
 timing:{durationS:17,easeInS:4,easeOutS:4} as JourneyTiming,
 /** Landing → board: after she stops (lens at rest), the journey (world) camera blends from the final landing pose to the
  * board camera (lakesideAlignedBoardPose, mapped to world) in `seconds`. Position (lerp), view direction (slerp, never any
  * roll) and FOV all follow the SAME smootherstep S, so all three start and end at zero velocity and zero acceleration, move
  * monotonically (no overshoot) and peak together at mid-blend; the board UI/lease then takes over at the identical pose. */
 landingBlend:{seconds:1},
 /** Board framing. Portrait (reviewer, c375304 round 2: the pitch-58 overhead board view is void): the board camera stays at
  * the close landing position (the fallback-like end pose, see landing); only its view direction and FOV change so the 3D
  * lake grid (wb_line grid, cell edges x ±3.85, z 8.15…15.85 on the water) lies under the 2D board grid of BoardLayout with
  * the board centre on the 2D grid centre and the centre row exactly the 2D grid width. The view is shallow (≈ 9–11° down),
  * so the rows are strongly foreshortened: corner / cell errors are reported by the test, not hidden. Landscape (desktop
  * preview; the board fills the height of the right column) keeps the overhead closed-form lens. No geometry is moved or added. */
 board:{landscape:{pitchDeg:75,fovVerticalDeg:40},grid:{halfX:3.85,zNear:15.85,zFar:8.15,centre:[0,0,12] as Vec}},
} as const;
const rotY=(deg:number,p:Vec):Vec=>{const t=deg*Math.PI/180,c=Math.cos(t),s=Math.sin(t);return [c*p[0]+s*p[2],p[1],-s*p[0]+c*p[2]];};
/** Placement + route pieces for RegionJourneyAdapter: model.setRotationFromEuler(0,yawDeg,0); model.setWorldPosition(...root);
 * path=[...approach,...bridge.slice(1),...arrival]; route {focus,landing,timing,startBlendM:0} as returned. */
export function lakesideJourney(start:Vec){
 const L=LAKESIDE_CAMERA_LAYOUT,approach=islandApproach(start),edge=approach[approach.length-1],landing=plus(edge,L.offset);
 const yawDeg=L.yawDeg,r=rotY(yawDeg,L.landingLocal),root:Vec=[landing[0]-r[0],landing[1]-r[1],landing[2]-r[2]];
 const toWorld=(p:Vec):Vec=>plus(rotY(yawDeg,p),root);
 const bridge=bridgePath(edge,toWorld(L.landingLocal),L.bridgeArchM),arrival=L.walkLocal.map(toWorld);
 return {yawDeg,root,toWorld,approach,bridge,arrival,focus:toWorld(L.focusLocal),landing:L.landing,timing:L.timing,startBlendM:0,speed:REGION_JOURNEY_LAYOUT.speedMps};
}
type V3=[number,number,number];
/** What the board UI reports to the background lease (LevelBackgroundFrame): viewport, tray top and, when available, the 2D
 * grid rect (centre x/y and side, logical px, origin top-left, y down; BoardLayout.grid). */
export type LakesideBoardFrame=Readonly<{width:number;height:number;boardTop:number;board?:Readonly<{x:number;y:number;size:number}>}>;
/** 2D grid rect for a frame. Without frame.board (older callers) it is rebuilt from the BoardLayout portrait rule: pitch from
 * the width (no side insets), tray 723/82 pitches tall, grid centred in the tray, horizontally centred. */
export function lakesideBoardRect(frame:LakesideBoardFrame):{x:number;y:number;size:number}{
 const w=frame.width,h=frame.height;if(!(w>0&&h>0))throw Error('Invalid lakeside frame');
 const b=frame.board;if(b&&b.size>0&&Number.isFinite(b.x)&&Number.isFinite(b.y))return {x:b.x,y:b.y,size:b.size};
 const pitch=Math.max(20,Math.min(42.6*Math.min(1.3,Math.max(1,w/390)),(w-18)/(681/82)));
 return {x:w/2,y:frame.boardTop+pitch*(723/82)/2,size:pitch*7};
}
/** Lakeside close end pose (Local): Landing A arrival pose of the lakeside walk (her stop walkLocal[last], focus = board centre). */
export function lakesideLandingLocal():AuthoredPose{const L=LAKESIDE_CAMERA_LAYOUT,e=arrivalPose(L.walkLocal,L.focusLocal,L.landing);
 return {position:[e.position[0],e.position[1],e.position[2]],target:[e.target[0],e.target[1],e.target[2]],fovVerticalDeg:L.landing.arrivalFovDeg||48};}
/** Lakeside board-background camera for a board-UI frame (Local).
 * Portrait: position = lakesideLandingLocal().position; no roll; yaw/pitch solved (Newton) so the 3D board centre projects on
 * the 2D grid centre, FOV solved (bisection) so the 3D centre row projects exactly the 2D grid width.
 * Landscape: closed form — with the view direction fixed (landscape.pitchDeg, facing −Z) the 3D centre row is at one depth D,
 * so its projected width 7.7/(D·tan(fov/2)·aspect) (NDC) equals the 2D grid width; the camera then shifts in its own image
 * plane so the 3D board centre lands on the 2D grid centre. */
export function lakesideAlignedLookAt(frame:LakesideBoardFrame):AuthoredPose{
 const B=LAKESIDE_CAMERA_LAYOUT.board,G=B.grid,rect=lakesideBoardRect(frame),w=frame.width,h=frame.height,aspect=w/h,c=G.centre;
 const q=(v:number)=>+v.toFixed(4);
 if(w<=h){
  const pos=lakesideLandingLocal().position,xn=rect.x/w*2-1,yn=1-rect.y/h*2,wn=rect.size/w*2;
  const dir=(yaw:number,pitch:number):V3=>[Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch)];
  const pose=(yaw:number,pitch:number,fov:number)=>{const d=dir(yaw,pitch);return fromLookAt({position:pos,target:[pos[0]+d[0]*20,pos[1]+d[1]*20,pos[2]+d[2]*20],fovVerticalDeg:fov},fov);};
  const v:V3=[c[0]-pos[0],c[1]-pos[1],c[2]-pos[2]],aimAt=(fov:number)=>{let yaw=Math.atan2(v[0],v[2]),pitch=Math.atan2(v[1],Math.hypot(v[0],v[2]));
   for(let i=0;i<30;i++){const pr=(y:number,p:number)=>projectPoint(pose(y,p,fov),aspect,c),p0=pr(yaw,pitch),ex=p0.x-xn,ey=p0.y-yn;if(Math.abs(ex)+Math.abs(ey)<1e-12)break;
    const e=1e-6,py=pr(yaw+e,pitch),pp=pr(yaw,pitch+e),a11=(py.x-p0.x)/e,a21=(py.y-p0.y)/e,a12=(pp.x-p0.x)/e,a22=(pp.y-p0.y)/e,det=a11*a22-a12*a21;
    yaw-=(a22*ex-a12*ey)/det;pitch-=(a11*ey-a21*ex)/det;}return {yaw,pitch};};
  const width=(fov:number)=>{const a=aimAt(fov),p=pose(a.yaw,a.pitch,fov),l=projectPoint(p,aspect,[c[0]-G.halfX,c[1],c[2]]),r=projectPoint(p,aspect,[c[0]+G.halfX,c[1],c[2]]);return r.x-l.x;};
  let lo=10,hi=120;for(let i=0;i<60;i++){const m=(lo+hi)/2;if(width(m)>wn)lo=m;else hi=m;}
  const fov=(lo+hi)/2,a=aimAt(fov),d=dir(a.yaw,a.pitch),D=Math.hypot(...v);
  return {position:[pos[0],pos[1],pos[2]],target:[pos[0]+d[0]*D,pos[1]+d[1]*D,pos[2]+d[2]*D],fovVerticalDeg:fov};}
 const fov=B.landscape.fovVerticalDeg,t=Math.tan(fov*Math.PI/360),p=B.landscape.pitchDeg*Math.PI/180;
 const f:V3=[0,-Math.sin(p),-Math.cos(p)],r:V3=[1,0,0],up:V3=[0,Math.cos(p),-Math.sin(p)];
 const D=2*G.halfX/(t*aspect*(rect.size/w*2)),X=(rect.x/w*2-1)*t*aspect*D,Y=(1-rect.y/h*2)*t*D;
 const pos:V3=[c[0]-r[0]*X-up[0]*Y-f[0]*D,c[1]-r[1]*X-up[1]*Y-f[1]*D,c[2]-r[2]*X-up[2]*Y-f[2]*D];
 return {position:[q(pos[0]),q(pos[1]),q(pos[2])],target:[q(pos[0]+f[0]*D),q(pos[1]+f[1]*D),q(pos[2]+f[2]*D)],fovVerticalDeg:fov};
}
/** The same pose as the CameraPose applyCameraPose() takes (the lease's frame() writes this). */
export function lakesideAlignedBoardPose(frame:LakesideBoardFrame):CameraPose{const p=lakesideAlignedLookAt(frame);return fromLookAt(p,p.fovVerticalDeg);}
const smooth5=(x:number)=>{const u=Math.max(0,Math.min(1,x));return u*u*u*(10+u*(-15+6*u));};
export type LakesideLandingBlend=Readonly<{seconds:number;from:Pose;boardLocal:AuthoredPose;boardWorld:Pose;
 gap:Readonly<{positionM:number;viewDeg:number;fovDeg:number}>;
 /** World camera pose t seconds after she stopped (clamped to 0…seconds): pass to WorldLease.setCamera each frame. */
 at(t:number):Pose;
 /** true once at(t) returns boardWorld exactly (t ≥ seconds): the frame on which to swap to the board. */
 done(t:number):boolean}>;
/** Landing → board hook for the region wiring (Voice Bot). Preload the board scene (lakeside lease + board UI, hidden) BEFORE
 * the journey arrives; call once when the lakeside journey is 'arrived':
 *   const b=lakesideLandingBlend(world.readCamera() /* = the final journey pose *\/, boardFrame, journey);
 *   each frame: world.setCamera(b.at(elapsed)); when b.done(elapsed) the pose IS b.boardWorld: swap to the board on that
 *   frame (lease.frame → its camera is lakesideAlignedBoardPose(boardFrame) = b.boardWorld seen from the lease's own origin,
 *   identical pose, so the frame is continuous). b.gap = residual landing→board difference (m / ° view / ° FOV).
 * `journey` is lakesideJourney(start) (yawDeg + root). One smootherstep e(t/seconds) drives position (lerp), view direction
 * (slerp on the unit sphere; the pose is a look-at, so no roll) and FOV (lerp): zero velocity/acceleration at both ends. */
export function lakesideLandingBlend(from:Pose,frame:LakesideBoardFrame,journey:Readonly<{yawDeg:number;root:Vec}>,seconds:number=LAKESIDE_CAMERA_LAYOUT.landingBlend.seconds):LakesideLandingBlend{
 if(!(seconds>0)||!Number.isFinite(seconds))throw Error('Invalid lakeside landing blend seconds');
 const local=lakesideAlignedLookAt(frame),toW=(p:readonly number[]):Vec=>plus(rotY(journey.yawDeg,[p[0],p[1],p[2]]),journey.root);
 const boardWorld:Pose={position:toW(local.position),target:toW(local.target),fovVerticalDeg:local.fovVerticalDeg};
 const unit=(a:readonly number[],b:readonly number[]):V3=>{const d:V3=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],l=Math.hypot(...d);return [d[0]/l,d[1]/l,d[2]/l];};
 const A=from.position,B=boardWorld.position,d0=unit(from.position,from.target),d1=unit(boardWorld.position,boardWorld.target),f0=from.fovVerticalDeg??48,f1=local.fovVerticalDeg;
 const th=Math.acos(Math.max(-1,Math.min(1,d0[0]*d1[0]+d0[1]*d1[1]+d0[2]*d1[2]))),sn=Math.sin(th);
 const at=(t:number):Pose=>{const u=Math.max(0,Math.min(1,t/seconds));if(u>=1)return boardWorld;const e=smooth5(u);
  const p:Vec=[A[0]+(B[0]-A[0])*e,A[1]+(B[1]-A[1])*e,A[2]+(B[2]-A[2])*e],k0=th>1e-9?Math.sin((1-e)*th)/sn:1-e,k1=th>1e-9?Math.sin(e*th)/sn:e;
  const d=[d0[0]*k0+d1[0]*k1,d0[1]*k0+d1[1]*k1,d0[2]*k0+d1[2]*k1],l=Math.hypot(d[0],d[1],d[2]);
  return {position:p,target:[p[0]+d[0]/l*10,p[1]+d[1]/l*10,p[2]+d[2]/l*10],fovVerticalDeg:f0+(f1-f0)*e};};
 return {seconds,from,boardLocal:local,boardWorld,gap:{positionM:Math.hypot(B[0]-A[0],B[1]-A[1],B[2]-A[2]),viewDeg:th*180/Math.PI,fovDeg:f1-f0},at,done:(t:number)=>t>=seconds};
}
