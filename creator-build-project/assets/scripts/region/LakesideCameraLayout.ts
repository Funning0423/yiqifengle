import type {Pose,Vec} from '../world-r1/WorldFlowCore';
import type {JourneyLanding,JourneyTiming} from '../world-r1/RegionJourneyCore';
import {fromLookAt,type AuthoredPose,type CameraPose} from '../world-r1/CameraPose';
import {lakesideBoardPose} from './LakesideSceneData';
import {REGION_JOURNEY_LAYOUT,bridgePath,islandApproach,plus} from './RegionJourneyLayout';
/** Lakeside (r5h3) camera data: journey into the region, Landing A arrival and the board framing. Pure numbers and maths, no
 * engine imports, so tools/journey-integration/test-lakeside-camera.cjs checks exactly these values against the committed
 * region_lakeside GLBs placed by scene_r5h_slim_transforms.json. Coordinates marked Local are lakeside-root (Y-up, metres).
 * Route: island exit (same approach as 04→05) → 24 m rainbow bridge (same shape) → lands on the empty south bank (flat
 * 0.56–0.59 m from z 23 to 39) → walks 11.5 m straight toward the lake and stops 2.5 m from the shore, facing the board.
 * Landing A machinery (RegionJourneyCore.arrivalPose/journeyCamera) with per-route overrides: lens on HER RIGHT, no late
 * lift (no crane-up), lens position on an S-curve Hermite into the arrival pose (at rest when she stops), board centre as the focus
 * so the arrival frame already looks at the level she is about to play. */
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
 /** Landing A overrides (all other arrival numbers = JOURNEY_CAMERA, i.e. the 08→09 Landing A values). */
 landing:{arrivalSideM:.8,arrivalLiftM:0,arrivalHermite:1,anchorSmoothM:1.5} as JourneyLanding,
 /** Time profile (reviewer on c375304): the 39.2 m leg in 17 s, smootherstep ramps 4 s up from rest and 4 s down into
  * the landing stop. Cruise 3.02 m/s (≤ 4.5), |a| ≤ 1.41 m/s² (≤ 3), |jerk| ≤ 1.09 m/s³ for her; the lens follows distance
  * (K7: lens |a| ≤ 1.95 m/s², |jerk| ≤ 4.9 m/s³). */
 timing:{durationS:17,easeInS:4,easeOutS:4} as JourneyTiming,
 /** Landing → board: after she stops, the journey (world) camera blends from the final landing pose to the board camera
  * (lakesideAlignedBoardPose, mapped to world) in `seconds`, smootherstep in position, yaw/pitch (no roll) and FOV; the
  * board UI/lease then takes over at the identical pose. lateralExp > 1 delays the sideways part of the move so the lens
  * stays on her right while it is still behind her. */
 landingBlend:{seconds:1,lateralExp:3},
 /** Board framing: the 3D lake grid (wb_line grid, cell edges x ±3.85, z 8.15…15.85 on the water) is laid under the 2D board
  * grid of BoardLayout: board centre on the 2D grid centre and the centre row exactly the 2D grid width. pitchDeg is the
  * view pitch below horizontal; 58° (reviewer on c375304: more village/mountains above the tray) keeps the residual
  * perspective (near row wider, far row narrower) inside the opaque tray frame on portrait layouts 0.43…0.75 (≥ 0.05 cell)
  * while the strip above the tray reaches the village shore. Portrait FOV follows Voice Bot's lakesideBoardPose rule (handoff 61.928°, widened on taller screens). Landscape
  * (desktop preview; the board fills the height of the right column) needs a steeper, longer lens for the same fit. No
  * geometry is moved or added. */
 board:{pitchDeg:58,landscape:{pitchDeg:75,fovVerticalDeg:40},grid:{halfX:3.85,zNear:15.85,zFar:8.15,centre:[0,0,12] as Vec}},
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
/** Lakeside board-background camera for a board-UI frame. Closed form: with the view direction fixed (pitchDeg, facing −Z)
 * the 3D centre row is at one depth D, so its projected width 7.7/(D·tan(fov/2)·aspect) (NDC) equals the 2D grid width;
 * the camera then shifts in its own image plane so the 3D board centre lands on the 2D grid centre. */
export function lakesideAlignedLookAt(frame:LakesideBoardFrame):AuthoredPose{
 const B=LAKESIDE_CAMERA_LAYOUT.board,G=B.grid,rect=lakesideBoardRect(frame),w=frame.width,h=frame.height,aspect=w/h;
 const wide=w>h,fov=wide?B.landscape.fovVerticalDeg:lakesideBoardPose(aspect).fovVerticalDeg,t=Math.tan(fov*Math.PI/360),p=(wide?B.landscape.pitchDeg:B.pitchDeg)*Math.PI/180;
 const f:V3=[0,-Math.sin(p),-Math.cos(p)],r:V3=[1,0,0],up:V3=[0,Math.cos(p),-Math.sin(p)];
 const D=2*G.halfX/(t*aspect*(rect.size/w*2)),X=(rect.x/w*2-1)*t*aspect*D,Y=(1-rect.y/h*2)*t*D,c=G.centre;
 const pos:V3=[c[0]-r[0]*X-up[0]*Y-f[0]*D,c[1]-r[1]*X-up[1]*Y-f[1]*D,c[2]-r[2]*X-up[2]*Y-f[2]*D];
 const q=(v:number)=>+v.toFixed(4);
 return {position:[q(pos[0]),q(pos[1]),q(pos[2])],target:[q(pos[0]+f[0]*D),q(pos[1]+f[1]*D),q(pos[2]+f[2]*D)],fovVerticalDeg:fov};
}
/** The same pose as the CameraPose applyCameraPose() takes (the lease's frame() writes this). */
export function lakesideAlignedBoardPose(frame:LakesideBoardFrame):CameraPose{const p=lakesideAlignedLookAt(frame);return fromLookAt(p,p.fovVerticalDeg);}
const smooth5=(x:number)=>{const u=Math.max(0,Math.min(1,x));return u*u*u*(10+u*(-15+6*u));};
const yawPitch=(p:Readonly<{position:readonly number[];target:readonly number[]}>)=>{const d=[p.target[0]-p.position[0],p.target[1]-p.position[1],p.target[2]-p.position[2]],h=Math.hypot(d[0],d[2]);return {yaw:Math.atan2(d[0],d[2]),pitch:Math.atan2(d[1],h)};};
export type LakesideLandingBlend=Readonly<{seconds:number;from:Pose;boardLocal:AuthoredPose;boardWorld:Pose;
 /** World camera pose t seconds after she stopped (clamped to 0…seconds): pass to WorldLease.setCamera each frame. */
 at(t:number):Pose}>;
/** Landing → board hook for the region wiring (Voice Bot). Call once when the lakeside journey is 'arrived':
 *   const b=lakesideLandingBlend(world.readCamera() /* = the final journey pose *\/, boardFrame, journey);
 *   each frame: world.setCamera(b.at(elapsed)); when elapsed ≥ b.seconds: show the board (lease.frame → its camera is
 *   lakesideAlignedBoardPose(boardFrame) = b.boardWorld seen from the lease's own origin, so the hand-off has no jump).
 * `journey` is lakesideJourney(start) (yawDeg + root). Position eases with smootherstep (lateral part with lateralExp),
 * view yaw/pitch with the same S (shortest yaw, never any roll), FOV linearly in the eased parameter. */
export function lakesideLandingBlend(from:Pose,frame:LakesideBoardFrame,journey:Readonly<{yawDeg:number;root:Vec}>,seconds:number=LAKESIDE_CAMERA_LAYOUT.landingBlend.seconds):LakesideLandingBlend{
 if(!(seconds>0)||!Number.isFinite(seconds))throw Error('Invalid lakeside landing blend seconds');
 const local=lakesideAlignedLookAt(frame),toW=(p:readonly number[]):Vec=>plus(rotY(journey.yawDeg,[p[0],p[1],p[2]]),journey.root);
 const toL=(p:readonly number[]):Vec=>rotY(-journey.yawDeg,[p[0]-journey.root[0],p[1]-journey.root[1],p[2]-journey.root[2]]);
 const boardWorld:Pose={position:toW(local.position),target:toW(local.target),fovVerticalDeg:local.fovVerticalDeg};
 const A=toL(from.position),B=local.position,a=yawPitch(from),b=yawPitch(boardWorld),f0=from.fovVerticalDeg??48,f1=local.fovVerticalDeg,k=LAKESIDE_CAMERA_LAYOUT.landingBlend.lateralExp;
 let dy=b.yaw-a.yaw;while(dy>Math.PI)dy-=2*Math.PI;while(dy<-Math.PI)dy+=2*Math.PI;
 const at=(t:number):Pose=>{const u=Math.max(0,Math.min(1,t/seconds));if(u>=1)return boardWorld;const e=smooth5(u),el=Math.pow(e,k);
  const p=toW([A[0]+(B[0]-A[0])*el,A[1]+(B[1]-A[1])*e,A[2]+(B[2]-A[2])*e]),yaw=a.yaw+dy*e,pitch=a.pitch+(b.pitch-a.pitch)*e;
  const d:Vec=[Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch)];
  return {position:p,target:[p[0]+d[0]*10,p[1]+d[1]*10,p[2]+d[2]*10],fovVerticalDeg:f0+(f1-f0)*e};};
 return {seconds,from,boardLocal:local,boardWorld,at};
}
