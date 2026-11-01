import type {Pose} from '../world-r1/WorldFlowCore';
import type {SafeArea} from '../ui/BoardLayout';
import {LAKESIDE_CAMERA_LAYOUT,lakesideLandingBlend,lakesideLandingLocal,lakesideScreenFrame,type LakesideBoardFrame,type LakesideLandingBlend} from './LakesideCameraLayout';
/** LANDING → BOARD camera hook for 风铃湖畔 (运镜bot; single call site: WorldNativeComposition.enterSelectedLevel, after the
 *  journey arrived, before enterLevel mounts the board). Pure (no engine imports): the call site injects the camera, the frame
 *  clock, the viewport/safe area and the preload.
 *   0. The journey already ENDS on this screen's board camera: RegionJourneyAdapter gives the route
 *      lakesideScreenLanding(journey, lakesideScreenFrame(viewport, boardSafeInsets)), which turns / zooms the lens onto it
 *      over the last ~3 s of the walk. So at the hook the residual is ~0 unless the viewport changed during the journey.
 *   1. PRELOAD: awaits deps.preload() (prewarmLakesideAssets: bundle, transforms, prefabs, water material), at most
 *      preloadTimeoutS (default 3 s, counted on deps.nextFrame). If it FAILS or TIMES OUT the hook does not blend into an
 *      empty board: it returns {ok:false, reason:'lakeside-assets-not-ready'} and the call site runs the existing lakeside
 *      fallback (toast 「湖畔暂时没准备好，先回小岛吧」 + back to the island; details to the log only).
 *   2. BLEND: from the world camera's current pose to the board camera for the board UI's own frame (same frame as step 0),
 *      lakesideLandingBlend: position lerp + view slerp + FOV lerp on ONE smootherstep, zero velocity at both ends, monotonic;
 *      1 s; time from the frame dt (capped at 0.1 s). First write = the current pose, last write = boardWorld exactly.
 *   3. SWAP: returns after the frame that wrote boardWorld; the world camera holds it while enterLevel mounts the board, and
 *      the lakeside board background's camera (lakesideAlignedBoardPose(frame) in the lease rig) takes over at the identical pose.
 *  Never rejects, never touches saves/progression. Without deps (older call sites) it resolves {ok:true} at once (plain cut). */
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
/** The hook only blends from (near) the journey's end pose: the world camera must sit at the landing position and its view /
 *  FOV may differ from this screen's board camera by at most this much (a viewport change mid-journey); else plain cut. */
export const LANDING_MATCH={positionM:.05,viewDeg:10,fovDeg:15} as const;
export const LAKESIDE_ASSETS_NOT_READY='lakeside-assets-not-ready';
export type LakesideLandingResult={ok:true;result:string}|{ok:false;reason:typeof LAKESIDE_ASSETS_NOT_READY;preloaded:'failed'|'timeout'};
export type LakesideLandingContext=Readonly<{stageId:string;journey:unknown;deps?:LakesideLandingDeps}>;
/** Viewport the board UI uses (ManagedMobileBoardUI): window inner size when there is a window, else the engine frame size. */
export function lakesideViewport(frameSize?:Readonly<{width:number;height:number}>|null):{width:number;height:number}{
 const w:any=(globalThis as any).window,f=w&&w.innerWidth>0?{width:w.innerWidth,height:w.innerHeight}:frameSize||{width:390,height:844};
 return {width:Math.max(240,f.width),height:Math.max(320,f.height)};}
/** @deprecated name kept for older callers: lakesideScreenFrame. */
export const lakesideHookFrame=(width:number,height:number,safe:SafeArea):LakesideBoardFrame=>lakesideScreenFrame(width,height,safe);
/** Lakeside root from the landing pose: the journey ends at lakesideLandingLocal().position placed by (yawDeg, root). */
export function lakesideRootFromLanding(from:Pose,frame?:Readonly<{width:number;height:number}>):{yawDeg:number;root:[number,number,number]}{
 const yawDeg=LAKESIDE_CAMERA_LAYOUT.yawDeg,t=yawDeg*Math.PI/180,c=Math.cos(t),s=Math.sin(t),p=lakesideLandingLocal(frame).position;
 const r=[c*p[0]+s*p[2],p[1],-s*p[0]+c*p[2]];return {yawDeg,root:[from.position[0]-r[0],from.position[1]-r[1],from.position[2]-r[2]]};}
export async function lakesideLandingToBoard(context:LakesideLandingContext):Promise<LakesideLandingResult>{
 const d=context.deps;if(!d)return {ok:true,result:'no-deps'};const log=(e:Record<string,unknown>)=>{try{d.log?.({event:'landing-board',stageId:context.stageId,...e});}catch{}};
 const t0=Date.now();let frames=0,elapsed=0,stage='preload',preloaded:'ok'|'failed'|'timeout'|'none'='none';
 const done=(result:string,e:Record<string,unknown>={}):LakesideLandingResult=>{log({result,preloaded,...e});return {ok:true,result};};
 try{
  if(d.preload){let settled=false;const p=Promise.resolve().then(()=>d.preload!()).then(()=>{settled=true;preloaded='ok';},()=>{settled=true;preloaded='failed';});
   const limit=d.preloadTimeoutS??3;let waited=0;while(!settled&&waited<limit){await Promise.race([p,d.nextFrame().then(dt=>{waited+=Math.max(0,Math.min(.1,dt||0))||1/60;})]);}
   if(!settled)preloaded='timeout';
   const pl=preloaded as 'ok'|'failed'|'timeout'|'none';if(pl==='failed'||pl==='timeout'){log({result:'assets-not-ready',preloaded:pl});return {ok:false,reason:LAKESIDE_ASSETS_NOT_READY,preloaded:pl};}}
  stage='plan';const from=d.readCamera();if(!from)return done('no-camera');
  const v=d.viewport(),frame=lakesideScreenFrame(v.width,v.height,d.safe?d.safe(v.width,v.height):{top:0,bottom:0,left:0,right:0,capsule:null}),
   b:LakesideLandingBlend=lakesideLandingBlend(from,frame,lakesideRootFromLanding(from,frame));
  // the root is recovered from the camera position, so check that position against the journey's own landing position too
  const Lp=lakesideLandingLocal(frame).position,jr=(context.journey as any)?.root;let posOff=0;
  if(Array.isArray(jr)&&jr.length===3){const t=LAKESIDE_CAMERA_LAYOUT.yawDeg*Math.PI/180,c=Math.cos(t),s=Math.sin(t),q=[c*Lp[0]+s*Lp[2]+jr[0],Lp[1]+jr[1],-s*Lp[0]+c*Lp[2]+jr[2]];posOff=Math.hypot(from.position[0]-q[0],from.position[1]-q[1],from.position[2]-q[2]);}
  if(!(posOff<=LANDING_MATCH.positionM&&b.gap.viewDeg<=LANDING_MATCH.viewDeg&&Math.abs(b.gap.fovDeg)<=LANDING_MATCH.fovDeg))return done('not-at-landing',{posOff,gap:b.gap});
  stage='blend';
  for(;;){const end=b.done(elapsed);if(!d.setCamera(b.at(elapsed)))return done('camera-rejected',{elapsed,frames});if(end)break;
   const dt=await d.nextFrame();frames++;elapsed+=Number.isFinite(dt)&&dt>0?Math.min(.1,dt):0;}
  return done('ok',{frames,seconds:b.seconds,gap:b.gap,frame:{width:v.width,height:v.height},ms:Date.now()-t0});
 }catch(error){return done('error',{stage,error:String((error as any)?.message||error)});}
}
