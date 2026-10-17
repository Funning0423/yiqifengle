import type {Pose,Vec} from '../world-r1/WorldFlowCore';
import type {AuthoredPose} from '../world-r1/CameraPose';
import type {JourneyBoardEnd} from '../world-r1/RegionJourneyCore';
import {meadowScenePose} from './MeadowSceneData';
import {skycityVisitPose} from './SkycityVisitPose';
import {MEADOW_STAND_LOCAL} from './RegionJourneyLayout';
import {boardLayout,toolSlots,type SafeArea} from '../ui/BoardLayout';
import {REGION_CAMERA} from '../world-r1/RegionCameraData';
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
/** 运镜bot (r4): WHERE SHE STOPS on the board. Her frozen board copy (GGbot, LakesideBoardGuest.mountRegionBoardGuest) is put
 *  exactly where she stands when the journey ends, and the board camera is fixed (meadowScenePose / skycityVisitPose per aspect),
 *  so the walk end decides whether the board UI covers her. Her box (REGION_CAMERA.islandCharacter: 1.7253 m tall, ±0.3 m,
 *  model axes) is projected through that board camera for this screen (vertical FOV, aspect = layout width/height) and tested
 *  against the board UI of this screen: boardLayout(width, height, safe, 4 goals) tray, goal plate, the tool row with THREE
 *  tools (toolSlots(layout, 3), icon squares grown by the selection ring / count badge: 2 pt sides+top, 4 pt bottom), the hint
 *  hint banner (r4.1, GGbot 260ea02: BoardLayout.toast above the tray; taken at its max width layout.toast.maxWidth x height,
 *  + 2 pt shadow below; a shorter hint is narrower on the same centre), the pause hit box, the capsule, the safe-area bands and the screen edges.
 *  Stops are tried every 0.1 m along her stand line; a stop is clear when her box overlaps none of them; its score is
 *  min(gap to the nearest of them, 16 pt) + 8 if inside REGION_CAMERA.frameLimits with gap ≥ minGapPt (13); the best score wins, ties go to the later
 *  stop. `accept` (the adapter: the O5 08→09 budget) drops stops before scoring. No clear stop (an unknown screen): the stop that leaves the least of her covered, logged by the caller. */
export const GIRL_STAND={stepM:.1,capPt:16,framingBonus:8,goals:4,tools:3,iconPadPt:{side:2,top:2,bottom:4},toastShadowPt:2,minGapPt:13} as const;
export type GirlStand=Readonly<{region:BoardLandingRegion;distanceM:number;local:Vec;yawDeg:number;path:ReadonlyArray<Vec>;clear:boolean;gapPt:number;inFrameLimits:boolean;boxPt:Readonly<{l:number;t:number;r:number;b:number}>}>;
type Rect=Readonly<{l:number;t:number;r:number;b:number}>;
/** The board UI rectangles (pt) her copy must stay clear of. */
export function girlStandUi(width:number,height:number,safe:SafeArea):Rect[]{
 const g=boardLayout(width,height,safe,GIRL_STAND.goals),c=(o:{x:number;y:number;width:number;height:number}):Rect=>({l:o.x-o.width/2,t:o.y-o.height/2,r:o.x+o.width/2,b:o.y+o.height/2});
 const out:Rect[]=[c(g.tray),c(g.plate),...toolSlots(g,GIRL_STAND.tools).map(x=>{const q=c({x,y:g.tools.y,width:g.tools.size,height:g.tools.size}),P=GIRL_STAND.iconPadPt;return {l:q.l-P.side,t:q.t-P.top,r:q.r+P.side,b:q.b+P.bottom};}),
  {l:g.toast.x-g.toast.maxWidth/2,t:g.toast.y-g.toast.height/2,r:g.toast.x+g.toast.maxWidth/2,b:g.toast.y+g.toast.height/2+GIRL_STAND.toastShadowPt},c({x:g.pause.x,y:g.pause.y,width:g.pause.hit,height:g.pause.hit}),
  {l:0,t:0,r:width,b:Math.max(0,safe.top)},{l:0,t:height-Math.max(0,safe.bottom),r:width,b:height}];
 if(safe.capsule&&safe.capsule.bottom>safe.capsule.top)out.push({l:safe.capsule.left,t:safe.capsule.top,r:safe.capsule.right,b:safe.capsule.bottom});
 return out;}
/** Her box on screen (pt) through a camera (model coordinates), or null if any corner is behind it. */
export function girlBoxPt(camera:AuthoredPose,foot:Vec,width:number,height:number):Rect|null{
 const C=REGION_CAMERA.islandCharacter,P=camera.position,f=unit(sub(camera.target,P)),r0=[-f[2],0,f[0]],rl=Math.hypot(r0[0],r0[2])||1,r=[r0[0]/rl,0,r0[2]/rl],u=[r[1]*f[2]-r[2]*f[1],r[2]*f[0]-r[0]*f[2],r[0]*f[1]-r[1]*f[0]];
 const t=Math.tan(camera.fovVerticalDeg*Math.PI/360),asp=width/height;let l=Infinity,R=-Infinity,T=Infinity,B=-Infinity;
 for(const dx of [-C.halfWidthM,C.halfWidthM])for(const dz of [-C.halfWidthM,C.halfWidthM])for(const y of [0,C.heightM]){
  const q=[foot[0]+dx-P[0],foot[1]+y-P[1],foot[2]+dz-P[2]],z=q[0]*f[0]+q[1]*f[1]+q[2]*f[2];if(!(z>1e-6))return null;
  const x=(q[0]*r[0]+q[1]*r[1]+q[2]*r[2])/(z*t*asp),yy=(q[0]*u[0]+q[1]*u[1]+q[2]*u[2])/(z*t),px=(x+1)/2*width,py=(1-yy)/2*height;
  l=Math.min(l,px);R=Math.max(R,px);T=Math.min(T,py);B=Math.max(B,py);}
 return {l,t:T,r:R,b:B};}
const at=(pts:ReadonlyArray<Vec>,d:number):{p:Vec;i:number}=>{let acc=0;for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i],l=Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2]);if(acc+l>=d-1e-9){const k=l>0?Math.max(0,Math.min(1,(d-acc)/l)):0;return {p:[a[0]+(b[0]-a[0])*k,a[1]+(b[1]-a[1])*k,a[2]+(b[2]-a[2])*k],i};}acc+=l;}return {p:[...pts[pts.length-1]] as Vec,i:pts.length-1};};
const len=(pts:ReadonlyArray<Vec>)=>{let s=0;for(let i=1;i<pts.length;i++)s+=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1],pts[i][2]-pts[i-1][2]);return s;};
/** Her stand line for a region, model coordinates, starting where the old route leaves off (meadow: player_spawn). */
export function girlStandLine(region:BoardLandingRegion,start:Vec):Vec[]|null{return region==='meadow'?[[start[0],start[1],start[2]],...MEADOW_STAND_LOCAL.map(p=>[p[0],p[1],p[2]] as Vec)]:null;}
/** Pure: the stop for one screen. `camera` = that screen's board camera, `line` = her stand line (both model coordinates). */
export function girlStandStop(region:BoardLandingRegion,line:ReadonlyArray<Vec>,camera:AuthoredPose,width:number,height:number,safe:SafeArea,accept?:(local:Vec)=>boolean):GirlStand{
 const ui=girlStandUi(width,height,safe),L=len(line),FL=REGION_CAMERA.frameLimits,G=GIRL_STAND;let best:any=null,least:any=null,behind:any=null;
 for(let k=0,n=Math.floor(L/G.stepM+1e-9);k<=n+1;k++){const d=Math.min(L,k*G.stepM),{p,i}=at(line,d);if(accept&&!accept(p)){if(d>=L)break;continue;}const box=girlBoxPt(camera,p,width,height);if(!box){behind={d,p,i,box:{l:NaN,t:NaN,r:NaN,b:NaN},gap:-1,inFL:false,cover:1};if(d>=L)break;continue;}
  const edge:Rect[]=[{l:-1e9,t:-1e9,r:0,b:1e9},{l:width,t:-1e9,r:1e9,b:1e9},{l:-1e9,t:-1e9,r:1e9,b:0},{l:-1e9,t:height,r:1e9,b:1e9}];let gap=Infinity,cover=0;const area=Math.max(1e-9,(box.r-box.l)*(box.b-box.t));
  for(const q of [...ui,...edge]){const ox=Math.min(box.r,q.r)-Math.max(box.l,q.l),oy=Math.min(box.b,q.b)-Math.max(box.t,q.t);if(ox>0&&oy>0){cover+=ox*oy/area;gap=-1;}else if(gap>=0)gap=Math.min(gap,Math.hypot(Math.max(q.l-box.r,box.l-q.r,0),Math.max(q.t-box.b,box.t-q.b,0)));}
  const nx=[box.l/width*2-1,box.r/width*2-1],ny=[1-box.b/height*2,1-box.t/height*2],inFL=nx[0]>=-FL.maxAbsX&&nx[1]<=FL.maxAbsX&&ny[0]>=FL.minY&&ny[1]<=FL.maxY;
  const row={d,p,i,box,gap,inFL,cover};
  if(gap>=0){const s=Math.min(gap,G.capPt)+(inFL&&gap>=G.minGapPt?G.framingBonus:0);if(!best||s>best.s+1e-9||(Math.abs(s-best.s)<=1e-9&&d>best.d))best={...row,s};}
  else if(!least||cover<least.cover-1e-9||(Math.abs(cover-least.cover)<=1e-9&&d>least.d))least=row;
  if(d>=L)break;}
 // whole line behind the camera (meadow landscape preview): the end of the line, not clear (the caller logs it).
 const w=best||least||behind;if(!w)throw Error('girl-stand-empty-line');
 const path=[...line.slice(0,w.i).map(p=>[p[0],p[1],p[2]] as Vec),w.p as Vec],a=path.length>1?path[path.length-2]:line[0],b=w.p as Vec;
 return {region,distanceM:w.d,local:b,yawDeg:Math.atan2(b[0]-a[0],b[2]-a[2])*180/Math.PI,path,clear:!!best,gapPt:best?w.gap:0,inFrameLimits:w.inFL,boxPt:w.box};}
/** The stop for this screen from a journey copy's map (model coordinates in, model coordinates out; the adapter maps the path). */
export function regionGirlStand(src:RegionBoardSource,start:Vec,width:number,height:number,safe:SafeArea,accept?:(local:Vec)=>boolean):GirlStand|null{
 const line=girlStandLine(src.region,start);if(!line)return null;return girlStandStop(src.region,line,regionBoardCamera(src,width/height),width,height,safe,accept);}
