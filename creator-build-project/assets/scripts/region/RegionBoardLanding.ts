import type {Pose,Vec} from '../world-r1/WorldFlowCore';
import type {AuthoredPose} from '../world-r1/CameraPose';
import type {JourneyBoardEnd} from '../world-r1/RegionJourneyCore';
import {meadowScenePose} from './MeadowSceneData';
import {skycityVisitPose} from './SkycityVisitPose';
/** 运镜bot: LANDING → BOARD for 04→05 (meadow) and 08→09 (skycity), same approach as 风铃湖畔 (LakesideLandingHook). Pure
 *  (no engine imports): RegionJourneyAdapter gives the map between the journey copy of the region model and the board copy,
 *  WorldNativeComposition injects the camera and the frame clock.
 *   0. The journey ENDS on the camera that renders after the swap: MeadowBoardBackground / SkycityBoardBackground write
 *      meadowScenePose(aspect) / skycityVisitPose(anchor_spawn_girl, anchor_starcourt_center, aspect) (board rig coordinates,
 *      aspect = the board UI's layout width/height = window inner size). regionBoardPose maps that pose onto the journey copy
 *      (journey world) for THIS screen, and the adapter puts it on the route (route.board, RegionJourneyCore.boardEndBlend):
 *      the lens leaves the follow / Landing A pose over the last blendM metres of her walk on one smootherstep (position,
 *      view and FOV together, monotonic, zero velocity where she stops). The big differences (meadow ≈ 25 m / 20° / +1.4° FOV,
 *      skycity ≈ 60 m / 72° / +7° FOV) are absorbed there, over ≥ 10 s of walk, never in a short blend.
 *   1. HOOK (regionLandingToBoard, after the journey arrived, before enterLevel): re-derives the board pose for the CURRENT
 *      viewport. On it already (the normal case): one exact write, {ok:true}. A small residual (viewport changed mid-walk):
 *      1–4 s smootherstep blend onto it (≈ 4 m/s), {ok:true}. Anything else (not at the landing, no board pose, error): no camera write,
 *      {ok:false}, and the call site keeps today's path (generic push-in) unchanged. Never rejects.
 *   2. HOLD: on {ok:true} the call site holds the generic enter-level push-in (WorldFlowComponent.holdEnterLevel), so the world
 *      camera stays on the board pose under the 0.78 s cover and the board camera takes over at the identical pose. */
export type BoardLandingRegion='meadow'|'skycity';
export const REGION_BOARD_LANDING={
 /** Metres of her walk (1.2 m/s, constant speed: 10 s / 18 s) over which the lens goes to the board camera. Meadow: from the last
  *  ~10 m of the 24 m bridge onto the bank (10 s); skycity: 22 m = 18 s, from the bridge across the deck (the 60 m / 72° move
  *  needs the length: 18 m passes 0.93 m from env_sky_floatingrocks_1 on 390x520). Checked against the real GLB geometry (clearance ≥ 1.1 m) by test-region-landing-hook.cjs. */
 blendM:{meadow:12,skycity:22} as Record<BoardLandingRegion,number>,
 /** Hook: on the board pose already = within exact*; residual blend allowed up to match* (else no hold). The residual (a viewport
  *  change mid-walk; the skycity board camera dollies along its view with the aspect: 390x844→375x667 4.8 m, →390x520 10.3 m)
  *  blends in residualMps-paced seconds, clamped to residualS [1, 4] s. */
 exact:{positionM:1e-3,viewDeg:.01,fovDeg:.01},match:{positionM:16,viewDeg:10,fovDeg:15},residualS:[1,4] as readonly [number,number],residualMps:4,
} as const;
/** Map between the board copy (board rig coordinates, the board host and rig are identity) and the journey copy (world). */
export type RegionModelMap=Readonly<{toJourney(p:Vec):Vec;toBoard(p:Vec):Vec}>;
export type RegionBoardSource=Readonly<{region:BoardLandingRegion;map:RegionModelMap;
 /** skycity only: anchor_spawn_girl / anchor_starcourt_center of the JOURNEY copy (world). */
 anchors?:Readonly<{spawn:Vec;court:Vec}>}>;
/** The board background camera exactly as the lease writes it (board rig coordinates). */
export function regionBoardCamera(src:RegionBoardSource,aspect:number):AuthoredPose{
 if(src.region==='meadow')return meadowScenePose(aspect);
 const a=src.anchors;if(!a)throw Error('region-board-anchors-missing');
 return skycityVisitPose(src.map.toBoard(a.spawn) as any,src.map.toBoard(a.court) as any,aspect);
}
/** That camera on the journey copy (journey world): the pose the route ends on for a viewport. */
export function regionBoardPose(src:RegionBoardSource,aspect:number):Pose{
 const b=regionBoardCamera(src,aspect);return {position:src.map.toJourney(b.position as any),target:src.map.toJourney(b.target as any),fovVerticalDeg:b.fovVerticalDeg};}
export function regionBoardEnd(src:RegionBoardSource,aspect:number):JourneyBoardEnd{const p=regionBoardPose(src,aspect);
 return {position:p.position,target:p.target,fovVerticalDeg:p.fovVerticalDeg as number,blendM:REGION_BOARD_LANDING.blendM[src.region]};}
/** Journey leases register their map here (RegionJourneyAdapter) and drop it on release; the hook reads it. */
const sources=new Map<BoardLandingRegion,RegionBoardSource>();
export function setRegionBoardSource(region:BoardLandingRegion,src:RegionBoardSource|null):void{if(src)sources.set(region,src);else sources.delete(region);}
export function regionBoardSource(region:BoardLandingRegion):RegionBoardSource|null{return sources.get(region)||null;}
export type RegionLandingDeps=Readonly<{
 readCamera():Pose|null;
 setCamera(pose:Pose):boolean;
 nextFrame():Promise<number>;
 viewport():Readonly<{width:number;height:number}>;
 /** the board pose (journey world) for a viewport, or null (no journey copy registered). */
 boardPose(viewport:Readonly<{width:number;height:number}>):Pose|null;
 log?(entry:Record<string,unknown>):void;
}>;
export type RegionLandingResult=Readonly<{ok:boolean;result:string}>;
const sub=(a:readonly number[],b:readonly number[])=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const unit=(v:number[])=>{const l=Math.hypot(v[0],v[1],v[2])||1;return [v[0]/l,v[1]/l,v[2]/l];};
const smooth5=(x:number)=>{const u=Math.max(0,Math.min(1,x));return u*u*u*(10+u*(-15+6*u));};
export function poseGap(a:Pose,b:Pose):{positionM:number;viewDeg:number;fovDeg:number}{
 const u=unit(sub(a.target,a.position)),v=unit(sub(b.target,b.position)),c=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
 return {positionM:Math.hypot(...sub(a.position,b.position)),viewDeg:Math.atan2(Math.hypot(c[0],c[1],c[2]),u[0]*v[0]+u[1]*v[1]+u[2]*v[2])*180/Math.PI,fovDeg:(b.fovVerticalDeg??48)-(a.fovVerticalDeg??48)};}
/** One smootherstep for position (lerp), view (slerp) and FOV (lerp); at(seconds) = to exactly. */
export function poseBlend(from:Pose,to:Pose,seconds:number):(t:number)=>Pose{
 const d0=unit(sub(from.target,from.position)),d1=unit(sub(to.target,to.position)),th=Math.acos(Math.max(-1,Math.min(1,d0[0]*d1[0]+d0[1]*d1[1]+d0[2]*d1[2]))),sn=Math.sin(th),f0=from.fovVerticalDeg??48,f1=to.fovVerticalDeg??48;
 return t=>{const u=Math.max(0,Math.min(1,t/seconds));if(u>=1)return to;const e=smooth5(u),A=from.position,B=to.position,p:Vec=[A[0]+(B[0]-A[0])*e,A[1]+(B[1]-A[1])*e,A[2]+(B[2]-A[2])*e];
  const k0=th>1e-9?Math.sin((1-e)*th)/sn:1-e,k1=th>1e-9?Math.sin(e*th)/sn:e,d=unit([d0[0]*k0+d1[0]*k1,d0[1]*k0+d1[1]*k1,d0[2]*k0+d1[2]*k1]);
  return {position:p,target:[p[0]+d[0]*10,p[1]+d[1]*10,p[2]+d[2]*10],fovVerticalDeg:f0+(f1-f0)*e};};}
export async function regionLandingToBoard(context:Readonly<{region:BoardLandingRegion;stageId:string;deps?:RegionLandingDeps}>):Promise<RegionLandingResult>{
 const d=context.deps;if(!d)return {ok:false,result:'no-deps'};let stage='plan';
 const done=(ok:boolean,result:string,e:Record<string,unknown>={}):RegionLandingResult=>{try{d.log?.({event:'landing-board',region:context.region,stageId:context.stageId,result,hold:ok,...e});}catch{}return {ok,result};};
 try{
  const from=d.readCamera();if(!from)return done(false,'no-camera');const v=d.viewport(),to=d.boardPose(v);if(!to)return done(false,'no-board-pose');
  const gap=poseGap(from,to),X=REGION_BOARD_LANDING.exact,M=REGION_BOARD_LANDING.match;
  if(gap.positionM<=X.positionM&&gap.viewDeg<=X.viewDeg&&Math.abs(gap.fovDeg)<=X.fovDeg){stage='write';return d.setCamera(to)?done(true,'on-board-pose',{gap}):done(false,'camera-rejected',{gap});}
  if(!(gap.positionM<=M.positionM&&gap.viewDeg<=M.viewDeg&&Math.abs(gap.fovDeg)<=M.fovDeg))return done(false,'not-at-landing',{gap});
  stage='blend';const R=REGION_BOARD_LANDING,seconds=Math.min(R.residualS[1],Math.max(R.residualS[0],gap.positionM/R.residualMps)),at=poseBlend(from,to,seconds);let t=0,frames=0;
  for(;;){if(!d.setCamera(at(t)))return done(false,'camera-rejected',{gap,frames});if(t>=seconds)break;const dt=await d.nextFrame();frames++;t+=Number.isFinite(dt)&&dt>0?Math.min(.1,dt):0;}
  return done(true,'blended',{gap,seconds,frames,frame:{width:v.width,height:v.height}});
 }catch(error){return done(false,'error',{stage,error:String((error as any)?.message||error)});}
}
