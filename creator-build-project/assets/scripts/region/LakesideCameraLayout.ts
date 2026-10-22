import type {Pose,Vec} from '../world-r1/WorldFlowCore';
import {arrivalPose,journeyCamera,routeLength,type JourneyLanding,type JourneyTiming} from '../world-r1/RegionJourneyCore';
import {boardLayout,type SafeArea} from '../ui/BoardLayout';
import {fromLookAt,type AuthoredPose,type CameraPose} from '../world-r1/CameraPose';
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
  * fallback's close neighbourhood (6.8 m behind / 1.1 m right of her; 3.0 m up, 0.4 m under the 3.4 m follow height). These
  * numbers are the BASE end pose; aim (horizontal at the focus, arrivalPitchDeg below the focus pitch) and arrivalFovDeg are
  * set near a common phone's board camera so that the per-screen correction stays small. The journey does NOT end on this base
  * pose: at runtime the adapter back-solves the current screen's board camera (lakesideScreenLanding: BoardLayout +
  * boardSafeInsets, the frame the board UI will report) and replaces the arrival aim (arrivalYawDeg / arrivalPitchDeg) and
  * arrivalFovDeg by that camera's, so the arrival blend (one smootherstep over the last arrivalBlendM = 14.3 m, ≥ 3 s of the
  * walk; the screen difference is never put into the 1 s hook) ends ON the board camera of that screen and the hook has
  * (almost) nothing left to close. One weight for view and FOV keeps the zoom monotonic (an extra short correction on top
  * of the arrival FOV ramp would reverse the zoom on screens whose board FOV is below the base). Over the 14.3 m arrival blend the lens height above her eases 3.4 → 3.0 m and the FOV 48 →
  * arrivalFovDeg with the same smoother as the view, so the lens never climbs in the world (no crane-up). */
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
  * the close landing position (the fallback-like end pose, see landing; the journey ends on this camera for the current screen); only its view direction and FOV change so the 3D
  * lake grid (wb_line grid, cell edges x ±3.85, z 8.15…15.85 on the water) lies under the 2D board grid of BoardLayout with
  * the board centre on the 2D grid centre and the centre row exactly the 2D grid width. The view is shallow (≈ 9–11° down),
  * so the rows are strongly foreshortened: corner / cell errors are reported by the test, not hidden. Landscape (desktop
  * preview; the board fills the height of the right column) keeps the overhead closed-form lens. No geometry is moved or added. */
 board:{landscape:{pitchDeg:75,fovVerticalDeg:40},
  /** b18 portrait board lens (Grok Bot approved variant B for build16: [1,8,27] → [0,-0.5,11], fov 50). The old lens stood on
   *  the landing spot 3.6 m up, so under the opaque 2D board the lower 40% of the screen was empty lawn and trees cut the left
   *  edge. B looks down the lake axis: the water grid and buoy ring under the board, bridge and mountains above it. B itself
   *  sees only water below the tray (the ground under the tray's lower edge is z ≈ 19.5, the bank lip is z 22.75), so no land
   *  spot puts her in frame and clear of the tray; B′ = B moved +1.7 m x / +3.6 m z, SAME view direction and FOV, so the bank
   *  with her unchanged stop L1 [1.2, .58, 24.5] (walk endpoint untouched, see docs/r5/cine/b18_landing_endpoint.md) sits in the
   *  band between the tray and the screen bottom on every portrait screen. Vertical FOV 50 on 390×844 and shorter screens, the
   *  390×844 horizontal coverage on taller ones (cap maxFovDeg). The journey ends ON this pose (lakesideScreenLanding solves the
   *  arrival offsets to it), so landing → board stays one continuous camera. Yaw fixed: the board is the only locked view. */
  portrait:{position:[2.7,8,30.6] as Vec,target:[1.7,-.5,14.6] as Vec,fovVerticalDeg:50,refAspect:390/844,maxFovDeg:75},grid:{halfX:3.85,zNear:15.85,zFar:8.15,centre:[0,0,12] as Vec}},
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
/** Board-UI frame (LakesideBoardFrame) the board UI will report for a viewport: BoardLayout with the board UI's own safe area
 * (ui/BoardLayout.boardSafeInsets); the portrait plate width does not depend on the goal count (2 used). */
export function lakesideScreenFrame(width:number,height:number,safe:SafeArea):LakesideBoardFrame{
 const g=boardLayout(width,height,safe,2);return {width,height,boardTop:g.tray.y-g.tray.height/2,board:{x:g.grid.x,y:g.grid.y,size:g.grid.size}};}
const yawPitch=(p:Readonly<{position:readonly number[];target:readonly number[]}>)=>{const d=[p.target[0]-p.position[0],p.target[1]-p.position[1],p.target[2]-p.position[2]],l=Math.hypot(d[0],d[1],d[2]);
 return {yaw:Math.atan2(d[0],d[2]),pitch:Math.asin(Math.max(-1,Math.min(1,d[1]/l)))};};
/** Route landing for THIS screen (RegionJourneyAdapter, at journey prepare): the base landing with the arrival aim and FOV
 * replaced by this screen's board camera (lakesideAlignedLookAt(frame); same position, so only arrivalYawDeg (from the
 * horizontal focus direction), arrivalPitchDeg (from the focus pitch) and arrivalFovDeg change): the journey's final pose IS
 * that camera. */
export function lakesideScreenLanding(journey:Readonly<{landing:JourneyLanding}>,frame:LakesideBoardFrame):JourneyLanding{
 const L=LAKESIDE_CAMERA_LAYOUT,b=lakesideAlignedLookAt(frame),f=L.focusLocal;
 if(journey.landing.arrivalAim)throw Error('lakesideScreenLanding: arrivalAim must be 0');
 // b18 portrait: the board lens (B′) is no longer at the base landing position, so the arrival offsets (back / side / up from
 // her stop, focus-relative, see RegionJourneyCore.arrivalPose) are solved to land EXACTLY on it. Landscape keeps the base.
 let lan:JourneyLanding=journey.landing;
 if(frame.width<=frame.height){const e=L.walkLocal[L.walkLocal.length-1],fx=f[0]-e[0],fz=f[2]-e[2],fl=Math.hypot(fx,fz)||1,u=[fx/fl,fz/fl],n=[-u[1],u[0]],d=[b.position[0]-e[0],b.position[1]-e[1],b.position[2]-e[2]];
  lan={...lan,arrivalBackM:-(d[0]*u[0]+d[2]*u[1]),arrivalSideM:d[0]*n[0]+d[2]*n[1],arrivalUpM:d[1]};}
 const base=arrivalPose(L.walkLocal,L.focusLocal,{...lan,arrivalYawDeg:0,arrivalPitchDeg:0}),p=base.position;
 journey={landing:lan};
 const a=yawPitch(b),yf=Math.atan2(f[0]-p[0],f[2]-p[2]),pf=Math.atan2(f[1]-p[1],Math.hypot(f[0]-p[0],f[2]-p[2])),k=180/Math.PI;
 let dy=a.yaw-yf;while(dy>Math.PI)dy-=2*Math.PI;while(dy<-Math.PI)dy+=2*Math.PI;
 return {...journey.landing,arrivalYawDeg:dy*k,arrivalPitchDeg:(a.pitch-pf)*k,arrivalFovDeg:b.fovVerticalDeg};
}
/** Lakeside close end pose (Local): Landing A arrival pose of the lakeside walk (her stop walkLocal[last], focus = board centre). */
export function lakesideLandingLocal(frame?:Readonly<{width:number;height:number}>):AuthoredPose{const L=LAKESIDE_CAMERA_LAYOUT;
 // b18: portrait (default) = the board lens B′ the journey now ends on; landscape keeps the base close end pose.
 if(!frame||frame.width<=frame.height){const P=L.board.portrait,a=frame?frame.width/frame.height:P.refAspect;return {position:[P.position[0],P.position[1],P.position[2]],target:[P.target[0],P.target[1],P.target[2]],fovVerticalDeg:lakesidePortraitFov(a)};}
 const e=arrivalPose(L.walkLocal,L.focusLocal,L.landing);
 return {position:[e.position[0],e.position[1],e.position[2]],target:[e.target[0],e.target[1],e.target[2]],fovVerticalDeg:L.landing.arrivalFovDeg||48};}
/** Lakeside board-background camera for a board-UI frame (Local).
 * Portrait (b18): the authored lens B′ (board.portrait), FOV from lakesidePortraitFov(aspect); the old grid-alignment solve is
 * retired (the 2D board is opaque, aligning the hidden 3D grid only forced the low lawn view).
 * Landscape: closed form — with the view direction fixed (landscape.pitchDeg, facing −Z) the 3D centre row is at one depth D,
 * so its projected width 7.7/(D·tan(fov/2)·aspect) (NDC) equals the 2D grid width; the camera then shifts in its own image
 * plane so the 3D board centre lands on the 2D grid centre. */
export function lakesideAlignedLookAt(frame:LakesideBoardFrame):AuthoredPose{
 const B=LAKESIDE_CAMERA_LAYOUT.board,G=B.grid,rect=lakesideBoardRect(frame),w=frame.width,h=frame.height,aspect=w/h,c=G.centre;
 const q=(v:number)=>+v.toFixed(4);
 if(w<=h){const P=B.portrait;return {position:[P.position[0],P.position[1],P.position[2]],target:[P.target[0],P.target[1],P.target[2]],fovVerticalDeg:q(lakesidePortraitFov(aspect))};}
 const fov=B.landscape.fovVerticalDeg,t=Math.tan(fov*Math.PI/360),p=B.landscape.pitchDeg*Math.PI/180;
 const f:V3=[0,-Math.sin(p),-Math.cos(p)],r:V3=[1,0,0],up:V3=[0,Math.cos(p),-Math.sin(p)];
 const D=2*G.halfX/(t*aspect*(rect.size/w*2)),X=(rect.x/w*2-1)*t*aspect*D,Y=(1-rect.y/h*2)*t*D;
 const pos:V3=[c[0]-r[0]*X-up[0]*Y-f[0]*D,c[1]-r[1]*X-up[1]*Y-f[1]*D,c[2]-r[2]*X-up[2]*Y-f[2]*D];
 return {position:[q(pos[0]),q(pos[1]),q(pos[2])],target:[q(pos[0]+f[0]*D),q(pos[1]+f[1]*D),q(pos[2]+f[2]*D)],fovVerticalDeg:fov};
}
/** b18 portrait board FOV for a screen aspect (w/h): vertical 50° on 390×844 and shorter screens, the 390×844 horizontal
 * coverage on taller ones, capped at maxFovDeg. */
export function lakesidePortraitFov(aspect:number):number{const P=LAKESIDE_CAMERA_LAYOUT.board.portrait,t=Math.tan(P.fovVerticalDeg*Math.PI/360)*P.refAspect/Math.max(.01,aspect);
 return Math.min(P.maxFovDeg,Math.max(P.fovVerticalDeg,2*Math.atan(t)*180/Math.PI));}
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
