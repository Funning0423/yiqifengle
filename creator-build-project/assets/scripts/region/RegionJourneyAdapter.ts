import {waitRegionAsset} from './RegionAssetDeadline';
import {Animation, Camera, Color, Component, Director, Mat4, Material, Mesh, MeshRenderer, Node, Vec3, director, gfx, isValid, utils, view} from 'cc';
import {REGIONS, loadRegionPrefab, mountRegion} from './RegionLoader';
import {RegionAmbientAnimation} from './RegionAmbientAnimation';
import {SkyNightTexture} from '../render/SkyNightTexture';
import {configureMeadowVertexColors, loadWindEffect, validateModel, MeadowSceneMotion, meadowCloudMaterials, meadowGroundMaterials, MEADOW_PROP_NIGHT} from './MeadowBoardBackground';
import {rotate} from '../world-r1/CameraPose';
import {RegionJourneyController, journeyDistanceAt, routeLength, sampleRoute} from '../world-r1/RegionJourneyCore';
import {REGION_JOURNEY_LAYOUT,bridgePath,islandApproach,lensKeys,plus,skyDeckRoute,skycityYawDeg,meadowExitFrom,meadowExitExtraM,MEADOW_EXIT_BUDGET_M} from './RegionJourneyLayout';
import type {JourneyRegion, JourneyRoute, JourneySceneLease} from '../world-r1/RegionJourneyCore';
import type {Cancellation, CharacterAdapter, Pose, Vec, WorldLease} from '../world-r1/WorldFlowCore';
import { TailToken, beginTail, endTail } from './WalkTail';
import {applyLakesideLandFill,applyLakesideWaterMode,enableLakesideInstancing,isLakesideWaterNode,lakesideWaterMaterial,loadLakesideWaterAsset,mergeLakesideStatic,mountLakesideScenery,preloadLakesideBoard,releaseLakesideBoardPreload,useLakesideWater} from './LakesideBoardBackground';
import {lakesideStaticMergeFromEnv} from './LakesideStaticMerge';
import {applyLakesideJourneyBatching,type JourneyBatching} from './LakesideJourneyBatching';
import {LAKESIDE_CAMERA_LAYOUT,lakesideJourney,lakesideScreenFrame,lakesideScreenLanding} from './LakesideCameraLayout';
import {lakesideQaAdvance} from './LakesideQaShot';
import {LAKESIDE_DOOR_HOLD,lakesideBoardEntryM,lakesideDoorBlendU,lakesideDoorLens,lakesideDoorRideCamera,lakesideDoorBlendS,lakesideDoorBlendDurS,lakesideDoorBlendPose,lakesideRouteTiming,LAKESIDE_BALLOON_LANDING,lakesideBalloonRide,lakesideBalloonMooring,footLockStep,footLockSwing,LAKESIDE_PATH_V4,LAKESIDE_STEPDOWN,stepdownRootAt,walkFrom,standupRootK} from './LakesideBalloon';
import {arrivalPose} from '../world-r1/RegionJourneyCore';
import {lakesideViewport} from './LakesideLandingHook';
import {boardSafeInsets} from '../ui/BoardLayout';
import {lakesideAtmosphereWeight,lakesideDayNightMode} from './LakesideJourneyAtmosphere';
import {onDayNightChange} from '../world-r1/DayNightContract';
import {regionBoardEnd,regionBoardSource,regionGirlStand,setMeadowBoardFraming,setRegionBoardSource,type BoardLandingRegion,type GirlStand,type RegionBoardSource} from './RegionBoardLanding';
import type {JourneyBoardEnd} from '../world-r1/RegionJourneyCore';
import {lakesideJourneyAtmosphere} from './LakesideJourneyLighting';
import {lakesideWaterSourceRenderer,logLakesideJourneyWaterFallback,prewarmLakesideWaterDraw,type LakesideWaterPrewarm} from './LakesideJourneyWater';
import {transportFor} from './JourneyTransport';
import {awaitVehicle, VEHICLE_ASSET_WAIT_MS} from './TransportWait';
import {loadTransitPrefab} from './BalloonTransit';
import {mountVehicle} from './TransportVehicle';
import {stepTransitClock} from './TransportLeg';
import {SAIL_I6,sailBeats,sailBerthWorld,sailDockSeat,sailJourneyPath,sailM0World,sailM1World,sailMeadowRoot,sailRoute,sailVehicle,seatFromBench} from './TransportLeg';
import {meadowLocalToWorld,SAIL_LANDING_STEP_LOCAL,SAIL_LANDING_WALK_LOCAL,SAIL_PORT_STEP_LOCAL} from './SailLanding';
import {createSailDriver,playSailBeats} from './SailRide';
import {mountSailArt,type SailArt} from './SailArt';
import {takeSailWarm} from './SailPreload';
import {mountBalloonLease} from './BalloonRide';
function find(node:Node,name:string):Node|null {if(node.name===name)return node;for(const child of node.children){const hit=find(child,name);if(hit)return hit;}return null;}
function anchor(model:Node,name:string):Vec{const node=find(model,name);if(!node)throw Error('journey-anchor-missing:'+name);const p=node.worldPosition;if(![p.x,p.y,p.z].every(Number.isFinite))throw Error('journey-anchor-invalid:'+name);return [p.x,p.y,p.z];}
/** Placement numbers and pure route maths live in RegionJourneyLayout (tested against the real GLB geometry). */
export {REGION_JOURNEY_LAYOUT};
/** 运镜bot: map between the board copy (board rig coordinates; boardLocal = the prefab root's own transform) and this placed
 *  journey copy (world): toJourney = J·B⁻¹, toBoard = B·J⁻¹ (rigid, both copies share the prefab scale). Skycity also takes
 *  the two framing anchors from the journey copy (world). */
function journeyBoardSource(region:BoardLandingRegion,model:Node,boardLocal:Mat4):RegionBoardSource{
 const J=new Mat4();Mat4.copy(J,model.worldMatrix);const Bi=new Mat4();Mat4.invert(Bi,boardLocal);const M=new Mat4();Mat4.multiply(M,J,Bi);const Mi=new Mat4();Mat4.invert(Mi,M);
 const tf=(m:Mat4)=>(p:Vec):Vec=>{const v=new Vec3(p[0],p[1],p[2]);Vec3.transformMat4(v,v,m);return [v.x,v.y,v.z];};
 const mm=M as any;for(let i=0;i<16;i++)if(!Number.isFinite(mm['m'+String(i).padStart(2,'0')]))throw Error('region-board-map-invalid');
 return {region,map:{toJourney:tf(M),toBoard:tf(Mi)},...(region==='skycity'?{anchors:{spawn:anchor(model,'anchor_spawn_girl'),court:anchor(model,'anchor_starcourt_center')}}:{})};
}
/** Real bundled GLBs and required anchors/materials are prepared before publishing ready. Rigid placement only,
 * at original metre scale. The original island remains alive; a second area never replaces the visible first area. */
export function createRegionJourney(options:{parent:Node;camera:Camera}):RegionJourneyController{
 const mounted=new Map<JourneyRegion,Node>();
 return new RegionJourneyController({
  readCamera():Pose{const c=options.camera,p=c.node.worldPosition,q=c.node.worldRotation,f=rotate([q.x,q.y,q.z,q.w],[0,0,-1]);return {position:[p.x,p.y,p.z],target:[p.x+f[0]*8,p.y+f[1]*8,p.z+f[2]*8],fovVerticalDeg:c.fov};},
  async prepare(from,to,start,token,progress){
   if(to==='lakeside')return prepareLakesideJourney(options.parent,options.camera,from,start,token,progress);
   if(to==='skycity'&&transportFor(from,to)==='balloon'){
    const waited=await awaitVehicle({kind:'balloon',cancelled:()=>token.cancelled,load:()=>mountBalloonLease({parent:options.parent,meadow:mounted.get('meadow')??null,start,token,progress})});
    const lease=waited.value;if(lease.model)mounted.set('skycity',lease.model);return lease;
   }
   // Rainbow bridge removed (b16): the only on-foot-free legs are sail (island→meadow) and balloon (→skycity, →lakeside).
   if(!(from==='island'&&to==='meadow'&&transportFor(from,to)==='sail'))throw Error('journey-transport-unsupported:'+from+'-'+to);
   const def=REGIONS[to];if(!def)throw Error('journey-region-unavailable');
   const sailWait=true;
   const prefab=sailWait?(await awaitVehicle({kind:'sail',cancelled:()=>token.cancelled,load:()=>waitRegionAsset(loadRegionPrefab(def,p=>progress(p*.72)),token,VEHICLE_ASSET_WAIT_MS)})).value:await waitRegionAsset(loadRegionPrefab(def,p=>progress(p*.72)),token);token.check();
   if(!isValid(options.parent,true)||!isValid(options.camera.node,true))throw Error('journey-owner-destroyed');
   prefab.addRef();const owned:Array<Mesh|Material>=[],rig=new Node('RegionJourney-'+to);rig.active=false;options.parent.addChild(rig);
   let effect:any=null,dead=false,model:Node|null=null,motion:MeadowSceneMotion|null=null,boardLocal:Mat4|null=null,boardSrc:RegionBoardSource|null=null,stand:GirlStand|null=null,sailArt:SailArt|null=null;
   const release=()=>{if(dead)return;dead=true;sailArt?.dispose();if(boardSrc&&regionBoardSource(to as BoardLandingRegion)===boardSrc)setRegionBoardSource(to as BoardLandingRegion,null);if(mounted.get(to)===model)mounted.delete(to);rig.active=false;rig.destroy();for(const asset of owned)asset.destroy();effect?.decRef();prefab.decRef();};
   try{
    const sail=true;
    // 运镜bot r5 (meadow-girlsize A): the sail arrival ends at M1 → closer board camera.
    setMeadowBoardFraming('A');
    const warmed=sail?takeSailWarm():null;
    model=mountRegion(def,prefab,rig);
    // 运镜bot: the prefab's own root transform = the board copy's transform in its (identity) board rig, before the journey places it.
    boardLocal=new Mat4();Mat4.fromRTS(boardLocal,model.rotation,model.position,model.scale);
    if(warmed){model.removeFromParent();model.destroy();model=warmed;rig.addChild(model);boardLocal=new Mat4();Mat4.fromRTS(boardLocal,model.rotation,model.position,model.scale);}
    for(const c of model.getComponentsInChildren(Camera))c.enabled=false;
    if(to==='meadow'){
     for(const a of model.getComponentsInChildren(Animation)){a.playOnLoad=false;a.enabled=false;}
     const grass=validateModel(model);configureMeadowVertexColors(model);
     // These local backdrops enclose the source island when both scenes coexist. Reuse the world's existing sky.
     for(const name of ['meadow_sky_dome','meadow_far_hills']){const backdrop=find(model,name);if(backdrop)for(const r of backdrop.getComponentsInChildren(MeshRenderer))r.enabled=false;}
     // N1 (e2a03ec audit): at night the reused island sky reads as day out here. Keep the meadow dome as a night-only sky
     // with SkyNightTexture (night picture on demand, gradient until it lands); WorldFlowComponent.applyDayNight drives
     // nightBlend and the dome's visibility on every day/night change. Day keeps the old path (dome off).
     mountMeadowNightSky(model);
     effect=await waitRegionAsset(loadWindEffect(),token);token.check();effect.addRef();
     const material=new Material();material.initialize({effectAsset:effect});if(!material.passes.length)throw Error('journey-meadow-wind-material-missing');owned.push(material);
     for(const r of grass)for(let i=0;i<r.sharedMaterials.length;i++)r.setSharedMaterial(material,i);
     motion=rig.addComponent(MeadowSceneMotion);motion.material=material;motion.sail=find(model,'windmill_sail_hub');
     // N2: grass + topmost cloud follow the journey's night grade.
     motion.journeyNight=true;motion.clouds=meadowCloudMaterials(find(model,'meadow_clouds_near'));
     motion.grounds=meadowGroundMaterials([find(model,'meadow_terrain'),find(model,'meadow_river_bank')]);
    }else{const ambient=model.getComponent(RegionAmbientAnimation);if(!ambient)throw Error('journey-skycity-ambient-missing');await waitRegionAsset(ambient.prepare(),token);token.check();}
    progress(.86);
    model.setRotationFromEuler(0,180,0);
    {const root=sailMeadowRoot();model.setWorldPosition(root[0],root[1],root[2]);}
    // 运镜bot (region hooks): the route ENDS on THIS screen's board camera (RegionBoardLanding: the board background's own pose
    // for the board UI's viewport, mapped onto this journey copy); if the screen or the map cannot be read, the old end is kept.
    let board:JourneyBoardEnd|undefined;
    try{boardSrc=journeyBoardSource(to as BoardLandingRegion,model,boardLocal!);const v=lakesideViewport(view.getFrameSize());board=regionBoardEnd(boardSrc,v.width/v.height,v);}catch(error){boardSrc=null;board=undefined;try{console.error('[QF_REGION] board landing unavailable: '+String(error));}catch{}}
    let route:JourneyRoute;
    let sailDriver:ReturnType<typeof createSailDriver>|null=null;
    let sailPlan:Parameters<typeof playSailBeats>[4]|null=null;
    if(sail){
     const sr=sailRoute(),m0=sailM0World(),m1=sailM1World(),berth=sailBerthWorld(),root=sailMeadowRoot();
     const step=meadowLocalToWorld(SAIL_LANDING_STEP_LOCAL,root);
     const walk=SAIL_LANDING_WALK_LOCAL.map(p=>meadowLocalToWorld(p,root));
     const built=sailJourneyPath(start,m0,m1,[...sr.samples,...walk]);
     const sailPath=built.path;if(board&&!(board.blendM<routeLength(sailPath)))board=undefined;
     route={from,to,path:sailPath,bridgeStart:built.bridgeStart,bridgeEnd:built.bridgeEnd,speed:REGION_JOURNEY_LAYOUT.speedMps,startBlendM:0,...(board?{board}:{})};
     let boat:Node|null=null,seat:Node|null=null,sailNode:Node|null=null;
     try{sailArt=await mountSailArt(rig,model);boat=sailArt.boat;seat=sailArt.seat;sailNode=sailArt.sail;}catch(error){try{console.info('[QF_SAIL] '+String((error as Error)?.message||error));}catch{}}
     const tl=sailBeats(sr.length);
     const sceneRoot=options.parent.scene||director.getScene();
     const rider=sceneRoot?find(sceneRoot,'FLOW_REFERENCE_PLACEHOLDER_NOT_B'):null;
     if(!rider)console.error('[QF_SAIL] rider missing: FLOW_REFERENCE_PLACEHOLDER_NOT_B is not a scene-root child');
     const boardPose=board?{position:board.position as Vec,target:board.target as Vec,fovVerticalDeg:board.fovVerticalDeg}:null;
     sailDriver=createSailDriver({timeline:tl,route:sr.samples,shore:walk,boat,sail:sailNode,seat,rider,riderHome:rider?.parent??null,art:sailArt,boardPose,screen:()=>{const v=view.getFrameSize();return {w:v.width,h:v.height};}});
     const dock=sr.samples[0];
     const deck:Vec=[SAIL_I6[0]+0.75,-0.18,dock[2]];
     // Port rail (mirror of board_step) → landing_step ends the sail clock.
     const vEnd=sailVehicle(tl,sr.samples,tl.beats.find(b=>b.id==='S-e')!.t1);
     const onBoat=(local:Vec):Vec=>{
      const c=Math.cos(vEnd.yaw),s=Math.sin(vEnd.yaw);
      return [berth[0]+local[0]*c+local[2]*s,berth[1]+local[1],berth[2]-local[0]*s+local[2]*c];
     };
     const standAt=seatFromBench(onBoat([0,0.06,-0.07]),vEnd.yaw);
     const port=onBoat(SAIL_PORT_STEP_LOCAL);
     const v0=sailVehicle(tl,sr.samples,0),fx=Math.sin(v0.yaw),fz=Math.cos(v0.yaw),p0=sr.samples[0];
     const sit=seatFromBench([p0[0]-fx*0.55,p0[1]+0.06,p0[2]-fz*0.55],v0.yaw);
     const arrival=[step,...walk.slice(1),m0,m1];
     sailPlan={total:tl.build05S,approach:[start,[SAIL_I6[0],start[1],SAIL_I6[2]]],deck,disembark:[standAt.position as Vec,port,step],arrival,sit,stand:standAt,boardS:tl.beats.find(b=>b.id==='S-g')!.t1-tl.beats.find(b=>b.id==='S-g')!.t0,arrivalS:tl.arrivalS,boardPose};
    }
    token.check();
    // N3: at night the path and windmill dim to x0.6 with the same night weight.
    if(motion&&model)motion.grounds.push(...meadowGroundMaterials([find(model,'meadow_path'),find(model,'windmill_static_merged'),find(model,'windmill_sails')],MEADOW_PROP_NIGHT));mounted.set(to,model);progress(.98);
    if(boardSrc&&route.board)setRegionBoardSource(to as BoardLandingRegion,boardSrc);
    const lease:JourneySceneLease={route,show(visible){if(dead)return;rig.active=visible;if(motion){motion.visible=visible;motion.hostPaused=!visible;}model?.getComponent(RegionAmbientAnimation)?.setHostPaused(!visible);},dispose:release,
     ...(sailDriver&&sailPlan?{onFrame:(dt:number)=>sailDriver!.onFrame(dt,false),ride:(actor,world,token)=>playSailBeats(sailDriver!,actor,world,token,sailPlan!)}:{})};
    return lease;
   }catch(error){release();throw error;}
  }
 });
}
/** N1: meadow_sky_dome as a night-only sky (SkyNightTexture on its renderer). Returns the component, or null without a dome. */
export function mountMeadowNightSky(model:Node,night:boolean=meadowNightNow()):SkyNightTexture|null{
 const dome=find(model,'meadow_sky_dome');const r=dome?dome.getComponentsInChildren(MeshRenderer)[0]:null;if(!dome||!r)return null;
 const sky=dome.getComponent(SkyNightTexture)||dome.addComponent(SkyNightTexture);sky.skyRenderer=r;(sky as any).__qfNightOnly=true;
 r.enabled=night;sky.setNightBlend(night?1:0);
 try{if((globalThis as any).__worldFlowLog)console.info('[QF_SKY] '+JSON.stringify({event:'meadow-night-sky',night}));}catch{}
 return sky;
}
function meadowNightNow():boolean{try{const m=(globalThis as any).__worldDayNight?.snapshot?.()?.mode;return typeof m==='string'&&m.includes('night');}catch{return false;}}
/** 风铃湖畔: skycity → lakeside on the existing balloon. LakesideCameraLayout.lakesideJourney(start) still places the
 *  scene; the basket descends onto the south-bank walk stop. */
class LakesideBalloonTicker extends Component{step:(dt:number)=>void=()=>{};lateUpdate(dt:number){this.step(Math.max(0,Math.min(0.1,dt||0)));}}
/** 运镜bot: the lakeside route ends on THIS screen's board camera (the board UI's frame: viewport + boardSafeInsets); the
 *  base landing is kept if anything about the screen cannot be read. */
function lakesideRouteLanding(L:ReturnType<typeof lakesideJourney>){
 try{const v=lakesideViewport(view.getFrameSize());return lakesideScreenLanding(L,lakesideScreenFrame(v.width,v.height,boardSafeInsets(v.width,v.height)),LAKESIDE_CAMERA_LAYOUT.stopLocal/* b18 v4 stop */);}catch{return L.landing;}}
/** r4-prep A: blend weight at which the arrival starts preloading the 风铃湖畔 board (a batch of instances per frame; ~1 m + the 1 s landing hook before the swap). */
export const LAKESIDE_BOARD_PRELOAD_W=.9;
/** r5 per-part fill: re-write the journey fill only on a weight step of >= 1/64, or when it reaches 0 / 1 exactly. */
export function lakesideFillStep(prev:number,next:number):boolean{return Math.abs(next-prev)>=1/64||(next!==prev&&(next===0||next===1));}
async function prepareLakesideJourney(parent:Node,camera:Camera,from:JourneyRegion,start:Vec,token:Cancellation,progress:(n:number)=>void):Promise<JourneySceneLease>{
 if(from!=='skycity')throw Error('journey-region-order');
 const held:Array<{decRef():unknown}>=[],owned:Array<Mesh|Material>=[],rig=new Node('RegionJourney-lakeside');rig.active=false;parent.addChild(rig);let dead=false,warm:LakesideWaterPrewarm|null=null,journeyWater:Material|null=null,lakeModel:Node|null=null;
 let tailStop=()=>{}/* b15 handover: only the journey owner ends the exit walk */,waterY=0,lakeYaw=0,batching:JourneyBatching|null=null,offWater=()=>{},offLand=()=>{},beforeDraw=()=>{};let fillW=0;const atmosphere=lakesideJourneyAtmosphere(camera,()=>waterY,()=>lakeYaw);
 const release=()=>{if(dead)return;dead=true;offWater();offLand();atmosphere.restore();releaseLakesideBoardPreload()/* r4-prep A: an unadopted board preload goes with the journey */;warm?.cancel()/* r4 journey fix 3 */;director.off(Director.EVENT_BEFORE_DRAW,beforeDraw);tailStop();rig.active=false;if(isValid(rig,true))rig.destroy();batching?.release();batching=null;for(const a of owned)a.destroy();for(const a of held.splice(0))a.decRef();};
 const take=<T extends {addRef():unknown;decRef():unknown}>(a:T):T=>{if(dead)throw Error('journey-lakeside-disposed');a.addRef();held.push(a);return a;};
 try{
  progress(.05);const model=new Node('LakesideJourneyScene');rig.addChild(model);lakeModel=model;
  await mountLakesideScenery(model,token,take);token.check();
  // journey-merge (side branch): the board's instancing + static merge on the journey copy too (431 renderers -> ~4 lakeside draws); ?lakemerge=off keeps instancing only.
  batching=applyLakesideJourneyBatching(model,{instancing:enableLakesideInstancing,merge:mergeLakesideStatic,mergeEnabled:lakesideStaticMergeFromEnv,isWater:isLakesideWaterNode});progress(.86);
  // r4 land fill (VB): enableLakesideInstancing gave the landform GLBs their filled copies (same source as the board:
  // lakesideModeLighting(mode).landFill*); the journey re-writes them on the day/night toggle like the board's applyDir.
  // r5 per-part fill: the journey copy follows the atmosphere blend weight, rewritten on a step >= 1/64 or at 0 / 1.
  applyLakesideLandFill(model,lakesideDayNightMode(),fillW);
  offLand=onDayNightChange(()=>{if(!dead)applyLakesideLandFill(model,lakesideDayNightMode(),fillW);});
  // r4-prep D (lead): the journey's lake reads the SAME water source as the board (its own lakeside-water.mtl copy written by
  // lakesideWaterMaterial / applyLakesideWaterMode from LAKESIDE_DIR_LIGHT_PARAMS + lakesideModeLighting). Not loaded = old look,
  // r4 journey fix 1: and one always-on [QF_LAKE] journey-water-fallback ERROR line with the reason + asset path (no throw, the walk goes on).
  let waterAsset:Material|null=null;try{waterAsset=await loadLakesideWaterAsset(token,take);}catch(error){if(token.cancelled||dead)throw error;logLakesideJourneyWaterFallback(error);waterAsset=null;}token.check();
  if(waterAsset){const water=lakesideWaterMaterial(waterAsset);owned.push(water);applyLakesideWaterMode(water,lakesideDayNightMode());useLakesideWater(model,water);
   offWater=onDayNightChange(()=>{if(!dead)applyLakesideWaterMode(water,lakesideDayNightMode());});journeyWater=water;}
  if(!isValid(parent,true))throw Error('journey-owner-destroyed');
  const L=lakesideJourney(start);model.setRotationFromEuler(0,L.yawDeg,0);model.setWorldPosition(L.root[0],L.root[1],L.root[2]);waterY=L.root[1];L.landing=lakesideRouteLanding(L);lakeYaw=L.yawDeg/* r4 journey fix 2: sun turned with the lake */;
  // 运镜bot r5 lakeside-landing-cam: ONE shot from the skycity camera to the standing landing pose E (= this screen's board
  // camera, LAKESIDE_CAMERA_LAYOUT.landing via lakesideRouteLanding): the flight lens ends exactly on E, so the 1 s landing hook
  // and the board take over without a cut. The basket carries her (stand_point) and flies the west corridor round the tree.
  const shore=L.arrival[L.arrival.length-1],v4Stop=L.toWorld([...LAKESIDE_CAMERA_LAYOUT.stopLocal] as Vec),E=arrivalPose([shore,v4Stop],L.focus,L.landing)/* b18: solved from the v4 stop, = this screen's board lens */,landPose:Pose={position:E.position,target:E.target,fovVerticalDeg:L.landing.arrivalFovDeg};
  // v2: she walks from S6 round the roots to the island edge (production walk), boards the moored basket under a fade, flies.
  const K=LAKESIDE_BALLOON_LANDING,moored=lakesideBalloonMooring(shore,L.toWorld),R=lakesideBalloonRide([start,...K.walkLocal.slice(1).map(p=>L.toWorld([p[0],p[1],p[2]]))],L.toWorld([K.launchLocal[0],K.launchLocal[1],K.launchLocal[2]]),moored.mooring,landPose),flight=R.flight,path=[...R.path,...moored.walk],walkM=routeLength(R.walk);
  let route:JourneyRoute={from,to:'lakeside',path,bridgeStart:walkM+flight.bridgeStart,bridgeEnd:walkM+flight.bridgeEnd,speed:L.speed,startBlendM:L.startBlendM,focus:L.focus,landing:L.landing,timing:L.timing/* build05-next: 运镜bot 0e39055/b0c21d2 17 s S-curve walk (lakesideJourney contract) */};
  const total=routeLength(path);route={...route,timing:lakesideRouteTiming(total,R.T+moored.timing.durationS,K.walkEaseS,moored.timing.easeOutS)};token.check();progress(.98);
  const loaded=await awaitVehicle({kind:'balloon',cancelled:()=>token.cancelled||dead,load:async()=>{token.check();const prefab=await loadTransitPrefab('transport_balloon');if(!prefab)throw Error('balloon-prefab-missing');return prefab;}});
  token.check();const prefab=loaded.value;prefab.addRef();held.push(prefab);const vehicle=mountVehicle(prefab,rig);vehicle.name='LakesideMooredBalloon';
  // b15 getout v2: the basket carries the exit yaw for the whole ride (door wall +Z toward her shore walk, 96.19° at the b15
  // mooring); her seat yaw under stand_point is compensated in board(), so her ride facing is unchanged.
  if(isValid(vehicle,true))vehicle.setRotationFromEuler(0,moored.doorYawDeg,0);
  // r4 journey fix 3: the first show (under the set-off black, right after prime() switched the fog) draws the water copy once, tiny, in
  // front of the camera, so its shader/PSO exist before the lake first comes into view (no first-sight hitch). Once per journey.
  const warmWater=()=>{if(warm||dead||!journeyWater)return;warm=prewarmLakesideWaterDraw(camera,journeyWater,lakesideWaterSourceRenderer(lakeModel,isLakesideWaterNode));};
  const clock={t:0,hiddenFor:0,fade:0};
  let lastPose:Pose|null=null;
  const readLens=():Pose=>{const p=camera.node.worldPosition,q=camera.node.worldRotation,f=rotate([q.x,q.y,q.z,q.w],[0,0,-1]);return {position:[p.x,p.y,p.z],target:[p.x+f[0]*8,p.y+f[1]*8,p.z+f[2]*8],fovVerticalDeg:camera.fov};};
  const doorVs=view.getVisibleSize(),doorLens=lakesideDoorLens(moored.walk,moored.mooring,doorVs.width/Math.max(1,doorVs.height))/* b15 door shot: where the ride lens arrives at touchdown */;
  const ride=async(actor:CharacterAdapter,world:WorldLease,rideToken:Cancellation)=>{
   const ticker=rig.addComponent(LakesideBalloonTicker);
   const from=readLens()/* the skycity camera at set-off: the walk lens blends out of it (7.5 s), orbiting round her */;
   const seat=find(vehicle,'stand_point')||vehicle,girl=(actor as any).node as Node|undefined;let prev:Node|null=null,aboard=false;
   const fade=typeof world.fadeCover==='function'?(w:number,s:number)=>Promise.resolve(world.fadeCover!(w,s)).catch(()=>{}):null;
   let walkDone=false,blackDone=!fade,fadingOut=false,fadingIn=false;
   const walking=actor.perform({kind:'walk',path:R.walk,duration:R.walkS,distanceAt:R.walkAt},rideToken).then(()=>{walkDone=true;});
   await new Promise<void>((ok,bad)=>{
    walking.catch(bad);
    const off=rideToken.onCancel(()=>{director.off(Director.EVENT_BEFORE_DRAW,beforeDraw);bad(Error('cancelled'));});
    const board=()=>{if(aboard||!girl||!isValid(girl,true))return;aboard=true;prev=girl.parent;girl.setParent(seat,true);
     // b15 stand-up v1b (角色动画bot 968be1d1 REPORT): she rides seated 0.494 m behind P0 facing the door (stand_point local
     // 0.032,-0.1,-0.099; basket floor board top = basket y 0), so the stand_up root motion ends on P0 with no turn.
     girl.setPosition(.032,-.1,-.099);girl.setRotationFromEuler(0,moored.seatYawDeg(moored.startYawRad*180/Math.PI),0);};
    const apply=()=>{
     const t=Math.min(clock.t,R.T),pos=R.vehicle(t);
     if(isValid(vehicle,true))vehicle.setWorldPosition(pos[0],pos[1],pos[2]);
     if(t>=R.cutT)board()/* under full black (or a plain cut when the world has no cover) */;
     lastPose=lakesideDoorRideCamera(R,doorLens,t,from);world.setCamera(lastPose);
     lease.progress!(t<R.cutT?R.walkAt(t):walkM+journeyDistanceAt(flight.total,flight.timing,Math.max(0,t-R.liftT)))/* atmosphere + the board preload */;
    };
    beforeDraw=()=>{if(!dead)apply();};
    director.on(Director.EVENT_BEFORE_DRAW,beforeDraw);
    ticker.step=(dt)=>{
     const hidden=typeof document!=='undefined'&&!!document.hidden;
     const next=stepTransitClock(clock,dt,hidden);
     const resumed=clock.fade<=0&&next.fade>0;
     // the shot clock waits for her: at the basket until the walk has really ended, in the black until the cover is down
     let t=next.t;if(!walkDone&&t>R.fadeOutAt)t=R.fadeOutAt;if(!blackDone&&t>R.cutT)t=R.cutT;
     clock.t=t;clock.hiddenFor=next.hiddenFor;clock.fade=next.fade;
     if(fade&&walkDone&&!fadingOut&&t>=R.fadeOutAt){fadingOut=true;void fade(1,K.boardFadeOutS).then(()=>{blackDone=true;});}
     if(fade&&blackDone&&!fadingIn&&t>=R.cutT+K.boardBlackS/2){fadingIn=true;void fade(0,K.boardFadeInS);}
     if(resumed&&fade){try{void fade(next.fade,0.35);}catch{/* cover optional */}}
     apply();
     if(clock.t+1e-4>=R.T){off();director.off(Director.EVENT_BEFORE_DRAW,beforeDraw);ticker.step=()=>{};ok();}
    };
   });
   rideToken.check();
   if(girl&&isValid(girl,true)&&aboard){const back=prev&&isValid(prev,true)?prev:rig.parent;if(back)girl.setParent(back,true);}
   // b15 getout v3 (角色动画bot getout_v3/INTEGRATE.md: b15 mooring, door yaw 96.19°, P0 inside the basket): at touchdown (off the board
   // frame) she faces the flight heading; cancelAndReset turns her to the door at P0 (no authored in-basket turn), then idle
   // 0.5 s → door_reach (basket_door opens 0.333 s in, to +100°) → planner walk (walk_start → walk_loop at the clip-picked
   // speed → walk_stop_bodyL) with a ≥1 m corner and the support-foot lock. The board takes over while she walks.
   if(isValid(vehicle,true))vehicle.setRotationFromEuler(0,moored.doorYawDeg,0);
   const door=find(vehicle,'basket_door');door?.setRotationFromEuler(0,0,0);
   // b15 acceptance (5a177b4c door strip): the engine kept her SkeletalAnimation 'sit_hold' state PLAYING (auto-played on
   // re-activation after board()/setParent), so Cocos overwrote the joints every frame and door_reach / walk_start / walk_loop
   // (driven by the actor's own rig clock, whose states must never play) never reached the screen: seated pose sliding out.
   // The rig is the only clock: stop any engine-played state at touchdown and on every get-out tick.
   let engineStops=0;const stopEngineStates=()=>{const anim=(actor as any).anim;if(!anim||!anim.clips)return;for(const c of anim.clips){if(!c)continue;const st=anim.getState(c.name);if(st&&st.isPlaying){try{st.stop();engineStops++;if(engineStops===1)console.warn('[QF_LAKESIDE] stopped engine-played character state '+c.name+' at get-out');}catch{/* state gone */}}}};
   stopEngineStates();
   const landedM=routeLength([...R.path,moored.walk[0]]);lease.progress!(landedM);
   // b15 door shot: the ride lens holds on the basket (lastPose, the route's last frame) until she is clear of the basket
   // (LAKESIDE_DOOR_HOLD.outM along the moored walk, or a game-time cap); only then does the controller arrive and the board
   // fade in, still overlapping the rest of her (offscreen) walk to the shore.
   let outOk:()=>void=()=>{};const out=new Promise<void>(r=>{outOk=r;});
   const hold=()=>{if(!dead&&lastPose)world.setCamera(lastPose);};director.on(Director.EVENT_BEFORE_DRAW,hold);
   // b15 stand-up v1b: on the seat (where she rode) sit_hold → HARD CUT stand_up (REPORT: start_pose = sit_hold f0, no crossfade;
   // 1.2667 s time clock, root carried seat → P0 along the facing by stand_up root_motion.forward_m (LAKESIDE_STANDUP)) → crossfade 0.2 into idle at P0 facing the door (cancelAndReset
   // in place) = getout t0. Without the stand_up clip / playNamed: the old placement (cancelAndReset straight to P0).
   {const a=actor as any,n=girl,canStand=!!(a.rig?.has?.('stand_up')&&typeof a.playNamed==='function'&&n&&isValid(n,true));
    if(canStand){const w=n!.worldPosition,seatRoot:Vec=[w.x,w.y,w.z],P0=moored.start as Vec;
     const seatDef={position:seatRoot,back:seatRoot,yawRad:moored.startYawRad,seatedFoot:seatRoot,standingFoot:P0,seatedControllerRoot:seatRoot,standingControllerRoot:P0};
     const dur=(typeof a.rig?.duration==='function'&&a.rig.duration('stand_up'))||1.266667;
     const prevStep=ticker.step;
     try{actor.cancelAndReset({kind:'seated',seat:seatDef} as any);a.pendingIdle=false;a.playNamed('stand_up',false,0);
      await new Promise<void>((ok,bad)=>{let st=0;const off=rideToken.onCancel(()=>{bad(Object.assign(Error('cancelled'),{name:'Cancelled'}));});
       ticker.step=(dt)=>{stopEngineStates();st=Math.min(dur,st+dt);const k=standupRootK(st,dur),m=a.node;
        if(m&&isValid(m,true))m.setWorldPosition(seatRoot[0]+(P0[0]-seatRoot[0])*k,seatRoot[1]+(P0[1]-seatRoot[1])*k,seatRoot[2]+(P0[2]-seatRoot[2])*k);
        if(st>=dur){off();ok();}};});}
     catch(e){if((e as any)?.name==='Cancelled')throw e;console.warn('[QF_LAKESIDE] stand-up skipped: '+String(e));}
     finally{ticker.step=prevStep;}
     rideToken.check();}
    actor.cancelAndReset({kind:'standing',controllerRoot:moored.start,yawRad:moored.startYawRad});}
   const holdCapS=moored.walkStartAt+LAKESIDE_DOOR_HOLD.outM/Math.max(.1,moored.length/Math.max(.1,moored.walkS))+LAKESIDE_DOOR_HOLD.capPadS;
   const qaMark0=(m:string)=>{try{const q=(globalThis as any).__qaLakeside;if(q&&typeof q==='object')q.mark=lakesideQaAdvance(q.mark,m);}catch{/* qa only */}};
   let tailDone=false/* b16: the tail cleared its ticker step (she is on the shore); the door blend must not restore it */;
   // b15 handover: the exit walk has its own token: once the ride resolved, a later flow cancel (pause, a level, a dialog)
   // must not stop her midway; before that the ride token still aborts it. Journey release (leaving the region) ends it.
   const tailToken=new TailToken();let rideOver=false;const offTail=rideToken.onCancel(()=>{if(!rideOver)tailToken.cancel();});tailStop=()=>{tailToken.cancel();endTail(actor);}/* b17: synchronous, before the 主页 restore */;
   const tail=(async()=>{
   const rideToken=tailToken as any as Cancellation;
    let t=0,reached=false,walking=false,stepping=false,walkBase=0,walkLen=moored.length,lock:[number,number]=[0,0],lockYaw:number|null=null;    const waitUntil=(at:number)=>new Promise<void>((ok,bad)=>{const off=rideToken.onCancel(()=>bad(Error('cancelled')));const chk=()=>{if(t>=at){off();ok();}else setTimeout(chk,16);};chk();});
    ticker.step=(dt)=>{t+=dt;stopEngineStates();if(door&&isValid(door,true))door.setRotationFromEuler(0,moored.doorDeg(t),0);if(t>=holdCapS)outOk();
     if(stepping){const u=t-moored.walkStartAt,r=stepdownRootAt(u),a=actor as any,P0=moored.start,sy=Math.sin(moored.startYawRad),cy=Math.cos(moored.startYawRad);
      // sd3: root Y = board (P0 0.602) + y_m while walk_start_stepdown plays; forward along the exit heading
      // b18 fix ①: off the board the root follows the measured lawn (v4 terrain profile), blended in by the drop fraction
      // r[1]/−0.03 (0 on the board, 1 once the step has landed), instead of the hard 0.572 (right foot 4.9 mm into the 0.5754 lawn)
      const drop=Math.max(0,Math.min(1,r[1]/-.03)),yB=P0[1]+r[1],yG=moored.groundYAt(r[0]);
      if(a.node&&isValid(a.node,true))a.node.setWorldPosition(P0[0]+sy*r[0],yB+(yG-(P0[1]-.03))*drop,P0[2]+cy*r[0]);
      lease.progress!(landedM+r[0]);if(r[0]>=LAKESIDE_DOOR_HOLD.outM)outOk();}
     if(reached){const w=(actor as any).walkProgress?.();if(typeof w==='number'){const s=walkBase+w*walkLen;lease.progress!(landedM+s);if(s>=LAKESIDE_DOOR_HOLD.outM)outOk();}
      // support-foot lock in the corner (lateUpdate: after the driver placed her on the path this frame)
      const a=actor as any,y=a.yawRad,n=girl;if(walking&&typeof y==='number'&&n&&isValid(n,true)){// b18 fix ②: stance foot only from a real contact (lastFootEmit; lastFoot alone is never null), recovery only in swing
       const fe=a.lastFootEmit,pl=fe&&(a.lastFoot==='L'||a.lastFoot==='R')?a.lastFoot:null,sw=footLockSwing(a.motionT,fe?fe.t:null);
       lock=footLockStep(lock,pl,lockYaw===null?y:lockYaw,y,dt,sw);lockYaw=y;if(lock[0]||lock[1]){const p=n.worldPosition;n.setWorldPosition(p.x+lock[0],p.y,p.z+lock[1]);}}}};
    const qaMark=(m:string)=>{try{const q=(globalThis as any).__qaLakeside;if(q&&typeof q==='object'){const n=lakesideQaAdvance(q.mark,m);if(n!==q.mark){q.mark=n;q.markT=t;}}}catch{/* qa only */}};
    await waitUntil(moored.T0);rideToken.check();qaMark('door');
    const reach=actor.performDoorReach?actor.performDoorReach(rideToken).catch(()=>{}):Promise.resolve();
    await waitUntil(moored.walkStartAt);
    const SD=LAKESIDE_STEPDOWN,av=actor as any,hasSd=!!(av.rig?.has?.(SD.clip)&&typeof av.playNamed==='function');
    if(hasSd){
     // sd3: hard cut door_reach → walk_start_stepdown at T0+1.8 (the door job ends here), root from its table, then hard cut to
     // walk_loop @0.453 s and the planner walk (phase kept: beginWalk continues a running walk_loop) from s = 1.1566 m at 0.8 m/s.
     const j=av.job;if(j&&j.action?.kind==='door-reach'){av.job=null;try{j.off();}catch{/* token */}j.resolve();}
     av.pendingIdle=false;av.playNamed(SD.clip,false,0);stepping=true;qaMark('walk');
     await waitUntil(moored.walkStartAt+SD.durationS);stepping=false;rideToken.check();
     av.playNamed('walk_loop',true,0,false,SD.loopTime);
     const rest=walkFrom(moored.walk,SD.forwardEnd),restLen=routeLength(rest),stopS=(typeof av.rig?.duration==='function'?av.rig.duration('walk_stop_bodyL'):0)||1.4667;
     walkBase=SD.forwardEnd;walkLen=restLen;reached=true;walking=true;
     await actor.perform({kind:'walk',path:rest,duration:Math.max(.5,(restLen-.5)/LAKESIDE_BALLOON_LANDING.exitWalkMps+stopS),stopAtEnd:true} as any,rideToken);walking=false;
     try{const lp=av.lastPlan;if(lp)console.info('[QF_LAKESIDE] stepdown walk plan '+JSON.stringify(lp)+' (INTEGRATE stop warp '+SD.stopWarp+')');}catch{/* log only */}
    }else{
    await reach;rideToken.check();
    reached=true;walking=true;qaMark('walk');
    await actor.perform({kind:'walk',path:moored.walk,duration:moored.walkS,stopAtEnd:true} as any,rideToken);walking=false;}
    rideToken.check();lease.progress!(landedM+moored.length);ticker.step=()=>{};tailDone=true;outOk();qaMark('shore');
    const before=moored.walk[moored.walk.length-2];
    const end=moored.walk[moored.walk.length-1];
    actor.cancelAndReset({kind:'standing',controllerRoot:end,yawRad:Math.atan2(end[0]-before[0],end[2]-before[2])});
   })();
   // the controller arrives now (board fade-in overlaps her offscreen walk); it must not reset her to the shore root
   (lease as any).tail=tail;beginTail(actor,tail,moored.walk[moored.walk.length-1]);tail.catch(()=>{}).then(()=>{offTail();if((lease as any).tail===tail)(lease as any).tail=null;});
   tail.catch(()=>{}).then(()=>outOk());const offOut=rideToken.onCancel(()=>outOk());
   try{await out;rideToken.check();qaMark0('out')/* when she is out, not after the blend */;
    // she is out: blend the held door lens onto the landing (= board) pose in game time, then hand over
    // b16: the blend follows her real walk progress up to the board entry distance (whole body inside 0.85 of the board
    // frame), so she stays clearly in frame through the blend and the board fade-in; never shorter than the SPEC blend
    const a=lastPose||landPose,blendS=lakesideDoorBlendS(a,landPose),vs=view.getVisibleSize(),entryM=lakesideBoardEntryM(moored.walk,landPose,vs.width/Math.max(1,vs.height),LAKESIDE_DOOR_HOLD.outM);
    let el=0,u=0;const durS=lakesideDoorBlendDurS(blendS,LAKESIDE_DOOR_HOLD.outM,entryM,moored.length/Math.max(.1,moored.walkS)),capS=blendS+(entryM-LAKESIDE_DOOR_HOLD.outM)/Math.max(.1,moored.length/Math.max(.1,moored.walkS))+LAKESIDE_DOOR_HOLD.capPadS;
    await new Promise<void>((ok,bad)=>{const offB=rideToken.onCancel(()=>{bad(Error('cancelled'));});const prevStep=ticker.step;
     ticker.step=(dt)=>{if(!tailDone)prevStep(dt);el+=dt;const w=(actor as any).walkProgress?.(),walked=typeof w==='number'?w*moored.length:entryM;
      void walked;u=Math.min(1,el/durS)/* b18: pure game time → C2 smooth */;const gp=girl&&isValid(girl,true)?girl.worldPosition:null;lastPose=lakesideDoorBlendPose(a,landPose,u,gp?[gp.x,gp.y,gp.z]:undefined);if(u>=1){lastPose=landPose;ticker.step=tailDone?()=>{}:prevStep;offB();ok();}};});
   }finally{director.off(Director.EVENT_BEFORE_DRAW,hold);offOut();}
   rideToken.check();rideOver=true;
  };
  // r4.2: first show is staged across two frames under the set-off black (fog + tiny water, then the lake). Later shows turn on at once.
  let showSerial=0,shown=false;
  const showScene=(s:number)=>{if(dead||s!==showSerial)return;rig.active=true;shown=true;};
  const lease:JourneySceneLease={route,show(visible){if(dead)return;const s=++showSerial;if(!visible){rig.active=false;return;}atmosphere.prime();warmWater();
    if(shown){showScene(s);return;}let fired=false;const go=()=>{if(fired)return;fired=true;showScene(s);};try{director.once('director_after_draw' as any,go);}catch{}setTimeout(go,50)/* paused game: never stall */;},progress(d){if(dead)return;const w=lakesideAtmosphereWeight(route,total,d);atmosphere.apply(w);if(lakesideFillStep(fillW,w)){fillW=w;applyLakesideLandFill(model,lakesideDayNightMode(),w);}},onFrame(){return lastPose||undefined;}/* keeps the controller from re-applying its set-off camera after the ride */,dispose:release,ride};
  // r4-prep A: the arrival starts preloading the 风铃湖畔 board (a batch of instances per frame) so the swap frame only turns its camera on.
  const walk=lease.progress!;lease.progress=d=>{walk(d);if(!dead&&lakesideAtmosphereWeight(route,total,d)>=LAKESIDE_BOARD_PRELOAD_W)void preloadLakesideBoard();};
  return lease;
 }catch(error){/* r4.2 item 3: a cancelled prepare is not a failure */if(!token.cancelled&&(error as any)?.name!=='Cancelled'){try{console.error('[QF_LAKE] skycity→lakeside journey prepare failed: '+String((error as any)?.stack||error));}catch{}}release();throw error;}
}
