import type {Pose} from '../world-r1/WorldFlowCore';
import {boardLayout,type SafeArea} from '../ui/BoardLayout';
import {LAKESIDE_CAMERA_LAYOUT,lakesideLandingBlend,lakesideLandingLocal,type LakesideBoardFrame,type LakesideLandingBlend} from './LakesideCameraLayout';
/** LANDING → BOARD camera hook for 风铃湖畔 (运镜bot; single call site: WorldNativeComposition.enterSelectedLevel, after the
 *  journey arrived, before enterLevel mounts the board). Pure (no engine imports): the call site injects the camera, the frame
 *  clock, the viewport/safe area and the preload.
 *   1. PRELOAD: awaits deps.preload() (prewarmLakesideAssets: bundle, transforms, prefabs, water material) before the blend
 *      starts, at most preloadTimeoutS (frames counted on deps.nextFrame) — a slow or failed preload never blocks or rejects;
 *      enterLevel still loads what is missing.
 *   2. BLEND: from the world camera's current pose (= the final journey pose: the landing END pose, which already IS the board
 *      camera at the 390×844 reference) to the board camera for the board UI's own frame (BoardLayout + boardSafeInsets, the
 *      exact frame ManagedMobileBoardUI reports), lakesideLandingBlend: position lerp + view slerp + FOV lerp on ONE
 *      smootherstep, zero velocity/acceleration at both ends, monotonic, no overshoot; seconds = landingBlend.seconds (1 s),
 *      time from the frame dt (capped at 0.1 s like WorldFlowComponent). First write = the current pose, last write =
 *      boardWorld exactly.
 *   3. SWAP: returns after the frame that wrote boardWorld; the world camera holds it while enterLevel mounts the board, and
 *      the lakeside board background's camera (lakesideAlignedBoardPose(frame) in the lease rig = boardWorld seen from the
 *      lakeside root) takes over at the identical pose.
 *  Never rejects, never touches saves/progression. Without deps (older call sites) it resolves at once (previous hard cut). */
export type LakesideLandingDeps=Readonly<{
 readCamera():Pose|null;
 /** apply a world camera pose (applyCameraPose on the world camera); false = rejected → the hook stops (the board still mounts). */
 setCamera(pose:Pose):boolean;
 /** resolves on the next rendered frame with that frame's dt in seconds. */
 nextFrame():Promise<number>;
 viewport():Readonly<{width:number;height:number}>;
 safe?(width:number,height:number):SafeArea;
 preload?():Promise<unknown>;
 /** default 3 s */
 preloadTimeoutS?:number;
 /** one line per run: {event:'landing-board', ...} */
 log?(entry:Record<string,unknown>):void;
}>;
/** How close the world camera must be to the landing END (direction / FOV) for the hook to run. */
export const LANDING_MATCH={viewDeg:.5,fovDeg:.5} as const;
export type LakesideLandingContext=Readonly<{stageId:string;journey:unknown;deps?:LakesideLandingDeps}>;
/** Board-UI frame the board will report for this viewport (portrait plate width does not depend on the goal count). */
export function lakesideHookFrame(width:number,height:number,safe:SafeArea):LakesideBoardFrame{
 const g=boardLayout(width,height,safe,2);return {width,height,boardTop:g.tray.y-g.tray.height/2,board:{x:g.grid.x,y:g.grid.y,size:g.grid.size}};}
/** Lakeside root from the landing pose: the journey ends on lakesideLandingLocal() placed by (yawDeg, root). */
export function lakesideRootFromLanding(from:Pose):{yawDeg:number;root:[number,number,number]}{
 const yawDeg=LAKESIDE_CAMERA_LAYOUT.yawDeg,t=yawDeg*Math.PI/180,c=Math.cos(t),s=Math.sin(t),p=lakesideLandingLocal().position;
 const r=[c*p[0]+s*p[2],p[1],-s*p[0]+c*p[2]];return {yawDeg,root:[from.position[0]-r[0],from.position[1]-r[1],from.position[2]-r[2]]};}
export async function lakesideLandingToBoard(context:LakesideLandingContext):Promise<void>{
 const d=context.deps;if(!d)return;const log=(e:Record<string,unknown>)=>{try{d.log?.({event:'landing-board',stageId:context.stageId,...e});}catch{}};
 const t0=Date.now();let frames=0,elapsed=0,stage='preload',preloaded:'ok'|'failed'|'timeout'|'none'='none';
 try{
  if(d.preload){let settled=false;const p=Promise.resolve().then(()=>d.preload!()).then(()=>{settled=true;preloaded='ok';},()=>{settled=true;preloaded='failed';});
   const limit=d.preloadTimeoutS??3;let waited=0;while(!settled&&waited<limit){await Promise.race([p,d.nextFrame().then(dt=>{waited+=Math.max(0,Math.min(.1,dt||0))||1/60;})]);}
   if(!settled)preloaded='timeout';}
  stage='plan';const from=d.readCamera();if(!from){log({result:'no-camera',preloaded});return;}
  // only from the journey's landing END (view direction and FOV are root-independent): anything else keeps the plain cut
  const L=lakesideLandingLocal(),yr=LAKESIDE_CAMERA_LAYOUT.yawDeg*Math.PI/180,u=[L.target[0]-L.position[0],L.target[1]-L.position[1],L.target[2]-L.position[2]],
   ue=[Math.cos(yr)*u[0]+Math.sin(yr)*u[2],u[1],-Math.sin(yr)*u[0]+Math.cos(yr)*u[2]],uf=[from.target[0]-from.position[0],from.target[1]-from.position[1],from.target[2]-from.position[2]],
   cr=[ue[1]*uf[2]-ue[2]*uf[1],ue[2]*uf[0]-ue[0]*uf[2],ue[0]*uf[1]-ue[1]*uf[0]],offDeg=Math.atan2(Math.hypot(cr[0],cr[1],cr[2]),ue[0]*uf[0]+ue[1]*uf[1]+ue[2]*uf[2])*180/Math.PI,fovOff=Math.abs((from.fovVerticalDeg??48)-(L.fovVerticalDeg??48));
  if(!(offDeg<=LANDING_MATCH.viewDeg&&fovOff<=LANDING_MATCH.fovDeg)){log({result:'not-at-landing',offDeg,fovOff,preloaded});return;}
  const v=d.viewport(),frame=lakesideHookFrame(v.width,v.height,d.safe?d.safe(v.width,v.height):{top:0,bottom:0,left:0,right:0,capsule:null}),b:LakesideLandingBlend=lakesideLandingBlend(from,frame,lakesideRootFromLanding(from));
  stage='blend';
  for(;;){const done=b.done(elapsed);if(!d.setCamera(b.at(elapsed))){log({result:'camera-rejected',elapsed,frames,preloaded});return;}if(done)break;
   const dt=await d.nextFrame();frames++;elapsed+=Number.isFinite(dt)&&dt>0?Math.min(.1,dt):0;}
  log({result:'ok',preloaded,frames,seconds:b.seconds,gap:b.gap,frame:{width:v.width,height:v.height},ms:Date.now()-t0});
 }catch(error){log({result:'error',stage,error:String((error as any)?.message||error),preloaded});}
}
