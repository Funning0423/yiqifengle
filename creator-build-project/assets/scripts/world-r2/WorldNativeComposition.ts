import { createSkycityBoardBackground } from '../region/SkycityBoardLive';
import {registerSkyLakeContinuous} from '../region/SkyLakeRegister';
import {continuousTransitions,preloadTargetForStage,recordFallback,withLegacyTransition} from '../region/TransitionChain';
import { createLakesideBoardBackground, LAKESIDE_LOAD_FAILED, prewarmLakesideAssets, preloadLakesideBoard } from '../region/LakesideBoardBackground';
import RegionCampaign from '../mainline-r1/runtime/region-campaign.js';
import type { JourneyRegion } from '../world-r1/RegionJourneyCore';
import { _decorator, Component, Node, Prefab, Camera, JsonAsset, Layers, sys, director, view, Director, Vec3, MeshRenderer, geometry } from 'cc';
import { DEBUG, MINIGAME } from 'cc/env';
import { requiresMeadowScene, requiresSkycityScene, requiresLakesideScene } from './LevelRegion';
import { createMeadowBoardBackground, preflightMeadowScene } from '../region/MeadowBoardBackground';
import { createRegionFlowCheckpoint, seedLakeCheckpoint } from './RegionFlowTest';
import { QA_SKIP_CHECKPOINT, qaSkipTarget, qaQuery, type QaSkipTarget } from './QaSkip';
import { preTransitionEnabled } from './PreTransitionKeys';
import { qaTransportEnabled } from '../region/JourneyTransport';
import { armSailQa } from '../region/SailQaProbe';
import { WorldFlowComponent } from '../world-r1/WorldFlowComponent';
import type { CharacterAdapter, Result } from '../world-r1/WorldFlowCore';
import { createNativeWorldLevelAdapter } from './NativeWorldLevelAdapter';
import { createIslandBoardBackground } from './IslandBoardBackground';
import type { Selection } from './ManagedBoardSession';
import RegionalAPI from '../regional-r05/runtime/index.js';
import CampaignHost from '../regional-r05/runtime/campaign-host.js';
import { createPersistentR5Port } from './PersistentR5Port';
import { createPersistentMainlinePort } from './PersistentMainlinePort';
import R4 from '../r4-cloud-compat/runtime/challenge-controller.js';
import R4Port from '../r4-cloud-compat/adapter/cocos-port.js';
import {lakesideLandingToBoard,lakesideViewport,type LakesideLandingDeps} from '../region/LakesideLandingHook';
import {applyCameraPose,fromLookAt} from '../world-r1/CameraPose';
import {lakesideQaPhase,LAKESIDE_QA_FREEZE,lakesideRevealPose} from '../region/LakesideQaShot';
import type {Vec} from '../world-r1/WorldFlowCore';
import {regionBoardPose,regionBoardSource,regionLandingToBoard,type BoardLandingRegion,type RegionLandingDeps} from '../region/RegionBoardLanding';
import {boardSafeInsets} from '../ui/BoardLayout';
/** Not failures: the player paused/cancelled or tapped twice; the normal journey pause/resume UI handles them. */
const LAKESIDE_SOFT_REASONS=['cancelled','paused','busy'];
import { installR5PersistenceProbe,createIsolatedTestPort } from './R5PersistenceProbe';
import { runRewardWalk } from '../region/RegionNodePlay';
import { qaUnlocked } from '../region/ExploreGate';
import { RegionNodeStage } from './RegionNodeStage';
import { ExploreInput } from './ExploreInput';
import '../region/ExploreGate';
import { withRegionBoardGuest } from '../region/LakesideBoardGuest';
// r4-prep B: meadow guest wrap stays here. Sky-city state hiding lives in SkycityBoardLive so the board import stays the r4.2 factory.
const meadowBoardWithGuest=(context:any)=>withRegionBoardGuest('meadow','MeadowLiveScene',1<<20,createMeadowBoardBackground)(context),skycityBoardWithGuest=(context:any)=>withRegionBoardGuest('skycity','SkycityLiveBackground',1<<20,createSkycityBoardBackground)(context);
const {ccclass,property}=_decorator;
/** NEW composition component; do not enable alongside FirstsliceBoot. No automatic rewards/progress. */
/** QA only (b15 reveal): line-of-sight test against the rendered scene (MeshRenderer models within 45 m of her, minus the
 *  moored balloon and her own rig), for lakesideRevealPose's occlusion term. Engine ray/AABB + ray/model, no physics. */
/** QA only (b16 edge rule): first surface along a unit ray within maxM (same model set as qaSceneOccluder); ground = terrain
 *  or lake models (name LK_terrain / LK_lake / LK_shore_foam) or a hit below her feet + 1.2 m (grass, reeds, rocks, low
 *  bushes are not 'near objects cut by the edge'; trees, houses and the pavilion are). */
function qaSceneEdgeRay(scene:Node|null,skip:Node[],near:Vec):(o:Vec,d:Vec,maxM:number)=>{t:number;ground:boolean}|null{
 const models:{md:any;ground:boolean}[]=[];const under=(n:Node|null)=>{for(let p=n;p;p=p.parent)if(skip.indexOf(p)>=0)return true;return false;};
 if(scene)for(const m of scene.getComponentsInChildren(MeshRenderer)){const md=(m as any).model;if(!m.enabledInHierarchy||!md||!md.worldBounds||under(m.node))continue;
  const c=md.worldBounds.center,h=md.worldBounds.halfExtents;if(Math.abs(c.x-near[0])>h.x+45||Math.abs(c.z-near[2])>h.z+45)continue;models.push({md,ground:/^LK_(terrain|lake|shore_foam)/.test(m.node.name)});}
 const ray=new geometry.Ray();
 return (o,d,maxM)=>{geometry.Ray.set(ray,o[0],o[1],o[2],d[0],d[1],d[2]);let best=maxM,g=false,hit=false;
  for(const x of models){const t=geometry.intersect.rayModel(ray,x.md,{mode:geometry.ERaycastMode.CLOSEST,distance:best,doubleSided:true} as any);if(t&&t<best){best=t;hit=true;g=x.ground||o[1]+d[1]*t<near[1]+1.2;}}
  return hit?{t:best,ground:g}:null;};
}
function qaSceneOccluder(scene:Node|null,skip:Node[],near:Vec):(a:Vec,b:Vec)=>boolean{
 const models:any[]=[];const under=(n:Node|null)=>{for(let p=n;p;p=p.parent)if(skip.indexOf(p)>=0)return true;return false;};
 if(scene)for(const m of scene.getComponentsInChildren(MeshRenderer)){const md=(m as any).model;if(!m.enabledInHierarchy||!md||!md.worldBounds||under(m.node))continue;
  const c=md.worldBounds.center,h=md.worldBounds.halfExtents;if(Math.abs(c.x-near[0])>h.x+45||Math.abs(c.z-near[2])>h.z+45)continue;models.push(md);}
 const ray=new geometry.Ray();
 return (a,b)=>{const d=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],L=Math.hypot(d[0],d[1],d[2]);if(L<1e-3)return false;
  geometry.Ray.set(ray,a[0],a[1],a[2],d[0]/L,d[1]/L,d[2]/L);
  for(let i=0;i<models.length;i++){const wb=models[i].worldBounds,c=wb.center,h=wb.halfExtents,inside=Math.abs(a[0]-c.x)<=h.x&&Math.abs(a[1]-c.y)<=h.y&&Math.abs(a[2]-c.z)<=h.z;
   if(!inside){const t0=geometry.intersect.rayAABB(ray,wb);if(!t0||t0>L)continue;}/* rayAABB is 0 for a ray starting inside the box (the merged lakeside scenery) */
   const t=geometry.intersect.rayModel(ray,models[i],{mode:geometry.ERaycastMode.ANY,distance:L*.98,doubleSided:true} as any);if(t&&t<L*.98)return true;}
  return false;};
}
@ccclass('WorldNativeComposition')
export class WorldNativeComposition extends Component {
  @property(Prefab) firstsliceModel:Prefab|null=null;
  @property(Camera) worldCamera:Camera|null=null;
  @property(JsonAsset) smokeFixture:JsonAsset|null=null;
  private owner:Node|null=null;private uiParent:Node|null=null;private world:WorldFlowComponent|null=null;
  private selection:Selection|null=null;private mainline=createPersistentMainlinePort();private persistence=createPersistentR5Port(this.mainline.journey);private r4=this.createR4Port();private previousCameraVisibility:number|null=null;private activeSession:any=null;private hostReply:any=null;
  private testProfile:any=null;private normalPorts:any=null;private boundCharacter:CharacterAdapter|null=null;
  private initialization:Promise<void>|null=null;private pendingJourneySelection:Selection|null=null;
  /** Boot awaits actual world validation; Creator start shares the same promise. */
  initializeWorld():Promise<void>{if(!this.initialization)this.initialization=this.initializeOnce();return this.initialization;}
  private skyLakeOff:(()=>void)|null=null;
  start(){try{if(!this.skyLakeOff&&typeof registerSkyLakeContinuous==='function')this.skyLakeOff=registerSkyLakeContinuous(this as any)/* T-02 → segment 6 continuous */;}catch{/* hook optional: fallback = enterMainline */}void this.initializeWorld().catch(error=>console.error('World composition initialization failed',error));}
  private async initializeOnce(){
    if(!this.firstsliceModel||!this.worldCamera||!this.smokeFixture)throw Error('Bind combined prefab, dedicated world camera and R4 smoke fixture');
    installR5PersistenceProbe();
    this.previousCameraVisibility=this.worldCamera.visibility;this.worldCamera.visibility &= ~Layers.Enum.UI_2D;
    this.owner=new Node('WorldFlowOwner');this.node.addChild(this.owner);
    this.uiParent=new Node('WorldLevelUI');this.node.addChild(this.uiParent);
    const world=this.owner.addComponent(WorldFlowComponent);this.world=world;
    world.firstsliceModel=this.firstsliceModel;world.worldCamera=this.worldCamera;
    const fixture:any=this.smokeFixture.json;
    this.selection={provider:'r4',stageId:fixture.stageId,seed:fixture.seed};
    const composition=this;
    const levels=createNativeWorldLevelAdapter({uiParent:this.uiParent,fixture,background:context=>requiresMeadowScene(context.selection)?meadowBoardWithGuest(context):requiresLakesideScene(context.selection)?createLakesideBoardBackground(context):requiresSkycityScene(context.selection)?skycityBoardWithGuest(context):createIslandBoardBackground(context),get mainlinePort(){return composition.mainline;},get r4Persistence(){return composition.r4;},get r5Persistence(){return composition.persistence;},onSession:session=>{this.activeSession=session;},
      select:id=>{if(!this.selection||id!==this.selection.stageId)throw Error('Select provider/stage explicitly first');return {...this.selection};},
      navigation:{exit:()=>world.commands().exitLevel(),resume:()=>world.commands().snapshot().needsResume?world.commands().resume():undefined},
    });
    try {const result=await world.initialize(levels,undefined,'motion');if(!result.ok)throw Error(result.reason);}
    catch(error){this.releaseOwned();throw error;}
    if(typeof RegionNodeStage==='function'&&typeof ExploreInput==='function'){
     const stage=this.node.getComponent(RegionNodeStage)||this.node.addComponent(RegionNodeStage);
     stage.attach(this.worldCamera);
     stage.characterSource=()=>this.boundCharacter;
     const input=this.node.getComponent(ExploreInput)||this.node.addComponent(ExploreInput);
     input.sink=(g,x,y)=>stage.onGesture(g,x,y);
    }
  }
  /** b17r14: island free-explore taps arrive via IslandLighthouseTouch (it claims the touch), not the global input. */
  exploreFeed():ExploreInput|null{const c=this.node?.getComponent(ExploreInput);return c&&c.isValid?c:null;}
  selectProvider(selection:Selection):Result {
    if(!this.world)return {ok:false,reason:'world-not-ready'};
    if(!['home','island','meadow','skycity','lakeside'].includes(this.world.commands().snapshot().state))return {ok:false,reason:'exit-current-level-first'};
    if(selection.provider==='r5'){
      const stage=(RegionalAPI as any).getStage(selection.stageId);
      if(!stage||!stage.seedBank.includes(selection.seed))return {ok:false,reason:'unverified-r5-stage-or-seed'};
      const permission=(CampaignHost as any).inspectSelection(this.persistence,selection);if(!permission.ok)return permission;
    }else if(selection.provider==='mainline'){
      const stage=this.mainline.createController().snapshot().stages.find((x:any)=>x.id===selection.stageId);if(!stage?.unlocked)return {ok:false,reason:'stage-locked'};
    }else if(selection.provider!=='r4'||selection.stageId!==(this.smokeFixture!.json as any).stageId||selection.seed!==(this.smokeFixture!.json as any).seed){
      return {ok:false,reason:'r4-candidate-limited-to-existing-smoke-fixture'};
    }
    if(selection.provider==='r4'){const stage=new (R4 as any)({platform:this.r4.platform,journey:this.mainline.journey}).snapshot().stages.find((x:any)=>x.id===selection.stageId);if(!stage?.unlocked)return {ok:false,reason:'stage-locked'};}
    this.selection={...selection};return {ok:true};
  }
  async enterSelectedLevel(){
    if(!this.world||!this.selection)throw Error('World not ready');const selection={...this.selection};
    if(selection.provider==='r5'){const permission=(CampaignHost as any).inspectSelection(this.persistence,selection);if(!permission.ok)return permission;}
    const region=this.selectionRegion(selection);
    this.pendingJourneySelection=selection;const arrived=await this.ensureRegion(region);if(!arrived.ok){/* r4.2 item 3: a soft stop (player cancel/background pause/double tap) logs nothing; a real failure logs ONE error, lakesideFallback's (it carries the reason) */if(region==='lakeside'&&!LAKESIDE_SOFT_REASONS.includes(String(arrived.reason)))return this.lakesideFallback('journey',arrived.reason);return arrived;}
    // ===== LAKESIDE LANDING → BOARD HOOK (运镜bot owns the transition; swap lakesideLandingToBoard for their hook) =====
    // 运镜bot: lakeside assets still not ready after the hook's 3 s wait → the existing lakeside fallback (toast + island), never an empty board.
    let held=false;
    if(region==='lakeside')(globalThis as any).__qfArrivalMark?.('arrived',{state:this.world?.commands().snapshot().state});
    if(region==='lakeside'){const landed=await lakesideLandingToBoard({stageId:selection.stageId,journey:this.world?.commands().snapshot().journey??null,deps:this.lakesideLandingDeps()});if(landed?.ok===false)return this.lakesideFallback('board',landed.reason);held=true;this.world?.holdEnterLevel?.(true);}
    // 运镜bot (region hooks): 04→05 / 08→09 end on the meadow / skycity board camera (RegionBoardLanding); hold the push-in only
    // when the hook put the world camera ON that pose and that board background will render. Otherwise today's path, unchanged.
    else if(region==='meadow'||region==='skycity'){const deps=this.regionLandingDeps(region);if(deps&&(region==='meadow'?requiresMeadowScene(selection):requiresSkycityScene(selection))){const landed=await regionLandingToBoard({region,stageId:selection.stageId,deps});if(landed.ok){held=true;this.world?.holdEnterLevel?.(true);}}}
    // 运镜bot: the hold is one-shot and only for this enterLevel (the board camera = the landing end, no push-in, no cut back).
    if(region==='lakeside')(globalThis as any).__qfArrivalMark?.('enter-level');let result:Result;try{result=await this.world.commands().enterLevel(selection.stageId);}finally{if(held)this.world?.holdEnterLevel?.(false);}if(region==='lakeside')(globalThis as any).__qfArrivalMark?.('level-'+(result.ok?'interactive':'failed'),{reason:(result as any).reason});if(result.ok){this.pendingJourneySelection=null;this.markExplore(false);}
    // transitions-continuous: the last level of a region warms the next region + its vehicle (04 meadow+sail, 08 skycity+balloon, 12 lakeside+balloon)
    {let target:string|null=null;try{target=result.ok?preloadTargetForStage(selection.stageId):null;}catch{target=null;}if(target){const preload=(this.world.commands() as {preloadHiddenRegion?:(id:string)=>unknown}).preloadHiddenRegion;if(typeof preload==='function')void preload(target);}}
    // v3.3: a failed lakeside scene already logged its cause ([QF_LAKESIDE]); lakesideFallback puts her back on the island. Hand the HUD one stable reason.
    if(result.ok===false&&String(result.reason).includes(LAKESIDE_LOAD_FAILED))return this.lakesideFallback('board',result.reason);
    return result;
  }
  /** build05-next: every lakeside journey / ensureRegion / board failure ends the same way: details to the log only
   *  ([QF_LAKE] / [QF_LAKESIDE]), the lakeside journey is dropped, she stands on the island, and the HUD gets one stable
   *  reason (WorldIntegrationBoot shows only the toast 「湖畔暂时没准备好，先回小岛吧」). */
  private lakesideFallback(stage:'journey'|'board',reason:unknown):Result{
    this.pendingJourneySelection=null;let back:Result={ok:false,reason:'no-world'};
    try{back=(this.world?.commands() as any)?.abandonLakesideJourney?.()??back;}catch(error){back={ok:false,reason:String(error)};}
    try{console.error('[QF_LAKE] '+JSON.stringify({event:'lakeside-fallback',stage,reason:String(reason),island:back.ok?'ok':String((back as any).reason)}));}catch{}
    return {ok:false,reason:LAKESIDE_LOAD_FAILED};
  }
  /** 运镜bot: what the landing→board hook needs (world camera read/write through applyCameraPose, frame clock, the board UI's
   *  viewport + safe area, the lakeside preload). The hook is pure and never rejects. */
  private lakesideLandingDeps():LakesideLandingDeps|undefined{
    const camera=this.worldCamera;if(!camera||!camera.node?.isValid)return undefined;
    return {
      readCamera:()=>{const n=camera.node;if(!n.isValid)return null;const p=n.worldPosition,f=n.forward;return {position:[p.x,p.y,p.z],target:[p.x+f.x*10,p.y+f.y*10,p.z+f.z*10],fovVerticalDeg:camera.fov};},
      setCamera:pose=>camera.node.isValid&&applyCameraPose(camera,fromLookAt(pose,pose.fovVerticalDeg??camera.fov),'lakeside.landing-board'),
      nextFrame:()=>new Promise<number>(resolve=>this.scheduleOnce(()=>resolve(director.getDeltaTime()),0)),
      viewport:()=>lakesideViewport(view.getFrameSize()),
      safe:(w,h)=>boardSafeInsets(w,h),
      preload:()=>prewarmLakesideAssets().then(r=>{void preloadLakesideBoard()/* r4-prep A: board preloaded during the landing (not awaited) */;return r;}),
      log:entry=>{try{if((globalThis as any).__worldFlowLog||DEBUG)console.info('[QF_LAKESIDE] '+JSON.stringify(entry));}catch{}},
    };
  }
  /** 运镜bot: world camera read/write, frame clock, the board UI's viewport and the board pose on the journey copy. Never throws. */
  private regionLandingDeps(region:BoardLandingRegion):RegionLandingDeps|undefined{
    const camera=this.worldCamera;if(!camera||!camera.node?.isValid)return undefined;
    return {
      readCamera:()=>{const n=camera.node;if(!n.isValid)return null;const p=n.worldPosition,f=n.forward;return {position:[p.x,p.y,p.z],target:[p.x+f.x*10,p.y+f.y*10,p.z+f.z*10],fovVerticalDeg:camera.fov};},
      setCamera:pose=>camera.node.isValid&&applyCameraPose(camera,fromLookAt(pose,pose.fovVerticalDeg??camera.fov),region+'.landing-board'),
      nextFrame:()=>new Promise<number>(resolve=>this.scheduleOnce(()=>resolve(director.getDeltaTime()),0)),
      viewport:()=>lakesideViewport(view.getFrameSize()),
      boardPose:v=>{const src=regionBoardSource(region);return src?regionBoardPose(src,v.width/v.height,v):null;},
      log:entry=>{try{if((globalThis as any).__worldFlowLog||DEBUG)console.info('[QF_REGION] '+JSON.stringify(entry));}catch{}},
    };
  }
  private selectionRegion(selection:Selection):JourneyRegion {
    if(selection.provider==='mainline')return (RegionCampaign as any).stage(selection.stageId)?.regionId||'island';
    // r05-meadow-* meadow, r05-sky-* skycity, 风铃湖畔 r04-lake-* (r05 renumbering too) lakeside, else island (tide).
    const id=selection.stageId;return /^r05-meadow-/.test(id)?'meadow':/^r05-sky-/.test(id)?'skycity':(/^r0[45]-lake-\d+$/.test(id)||/^mainline-1[3-6]$/.test(id))?'lakeside':'island';
  }
  /** Cold progress opens the same physical route in order. Unlocks are read from verified records, never counters. */
  private async ensureRegion(target:JourneyRegion):Promise<Result>{
    const commands=this.world!.commands();
    let current=commands.snapshot().journey?.region||'island';
    if(current===target&&!commands.snapshot().journey?.target)return {ok:true};
    // Physical admission uses verified mainline records too; the challenge provider keeps its own stage gate.
    const permission=(RegionCampaign as any).canEnterRegion(this.mainline.journeySnapshot(),target);if(!permission.ok)return permission;
    const order:JourneyRegion[]=['island','meadow','skycity','lakeside'];
    if(!order.includes(current)||order.indexOf(target)<order.indexOf(current))return {ok:false,reason:'return-route-not-yet-available'};
    while(current!==target){const next=order[order.indexOf(current)+1];const result=await commands.travelRegion(next);if(!result.ok)return result;current=next;}
    return {ok:true};
  }
  async resumeJourney():Promise<Result>{
    const commands=this.world!.commands(),resumed=commands.resume();if(!resumed.ok)return resumed;
    if(commands.snapshot().state==='level'||!this.pendingJourneySelection)return resumed;
    this.selection={...this.pendingJourneySelection};return this.enterSelectedLevel();
  }
  /** One read-only target resolver shared by the journal gate and actual entry. */
  private regionSelection(region:string):any{
    const first=(RegionalAPI as any).catalog.find((s:any)=>s.region===region&&s.ordinal===1);if(!first)return {ok:false,reason:'unknown-region'};
    let stage=first,seed=first.seedBank[0];
    try{const raw=this.persistence.platform.load('forest-regional-r05-active'),r=raw?JSON.parse(raw as string):null;if(r&&!r.discarded){const run=(RegionalAPI as any).restore(r.checkpoint);if(run.stage.region===region){stage=run.stage;seed=run.seed;if(run.engine.status==='won'){const next=(RegionalAPI as any).catalog.find((x:any)=>x.region===region&&x.ordinal===run.stage.ordinal+1);if(next&&(CampaignHost as any).inspectSelection(this.persistence,{stageId:next.id,seed:next.seedBank[0]}).ok){stage=next;seed=next.seedBank[0];}}}}}catch{return {ok:false,reason:'preserved-active-error'};}
    return {ok:true,selection:{provider:'r5',stageId:stage.id,seed}};
  }
  async enterRegion(region:string){
    const target=this.regionSelection(region);if(!target.ok)return target;
    const selected=this.selectProvider(target.selection);return selected.ok?this.enterSelectedLevel():selected;
  }
  private createR4Port(){const namespace=this.mainline.namespace+'r4:';const platform=R4Port.createSynchronousStorage({getItem:(k:string)=>sys.localStorage.getItem(namespace+k),setItem:(k:string,v:string)=>sys.localStorage.setItem(namespace+k,v)});return {platform,journey:this.mainline.journey,inspect:()=>['forest-challenges-c01','forest-challenges-c01-active'].map(k=>[k,platform.load(k)])};}
  /** Island browsing never constructs the recovering mainline controller. */
  islandOverview(){return {journey:this.mainline.journeySnapshot()};}
  islandGates(){
    const readOnly={load:(key:string)=>this.r4.platform.load(key),save:()=>false};
    const r4=new (R4 as any)({platform:readOnly,journey:this.mainline.journey}).snapshot().stages;
    const r5=(RegionalAPI as any).catalog.filter((x:any)=>x.ordinal===1).map((x:any)=>{const target=this.regionSelection(x.region);return target.ok?{id:target.selection.stageId,region:x.region,seed:target.selection.seed,...(CampaignHost as any).inspectSelection(this.persistence,target.selection)}:{id:x.id,region:x.region,ok:false,reason:target.reason};});
    // Journal display only (x/4 per region): the provider still owns every gate and write.
    const challenges:Record<string,number>={tide:0,meadow:0,sky:0,lake:0};
    try{const raw=this.persistence.platform.load('forest-regional-r05-progress'),d=raw?(typeof raw==='string'?JSON.parse(raw):raw):null;for(const id of Object.keys(d?.records||{})){const m=/^r05-(tide|meadow|sky)-/.exec(id)||/^r0[45]-(lake)-/.exec(id);if(m)challenges[m[1]]++;}}catch{}
    return {r4,r5,challenges};
  }

  mainlineStatus(){return this.mainline.createController().snapshot();}
  mainlineStorage(){return this.mainline.inspect();}
  challengeGates(){return {r4:new (R4 as any)({platform:this.r4.platform,journey:this.mainline.journey}).snapshot().stages,r5:(RegionalAPI as any).catalog.filter((x:any)=>x.ordinal===1).map((x:any)=>({id:x.id,region:x.region,...(CampaignHost as any).inspectSelection(this.persistence,{stageId:x.id,seed:x.seedBank[0]})}))};}
  /** T-02 continuation hook. The sky-finale auto-continue and the 继续旅程 button both call continueFromSkyFinale(). A continuous
   * skycity→lakeside segment (walk to the basket, door, board, ignition, take-off; built elsewhere) registers here and gets the
   * end-of-shot camera {position, rotation, fovVerticalDeg, velocity, angularVelocityDegS}; returning true means it took over.
   * When nothing is registered or every handler declines, the fallback is the existing enterMainline() path (WindWipe 'ride'). */
  private skyContinueHandlers:((camera:any)=>boolean|void|PromiseLike<any>)[]=[];
  onSkyFinaleContinue(handler:(camera:any)=>boolean|void|PromiseLike<any>){this.skyContinueHandlers.push(handler);return ()=>{this.skyContinueHandlers=this.skyContinueHandlers.filter(h=>h!==handler);};}
  skyFinaleActive(){try{return !!(this.stage() as any)?.finaleEndCamera?.();}catch{return false;}}
  /** skyfix (界面验收部 cand-stage5 P1, root cause): the T-02 finale plays on top of the mainline-12 RESULT board, i.e. the world
   *  is still in state 'level'. enterMainline()→enterRegion('lake')→selectProvider() then answers {ok:false,'exit-current-level-
   *  first'} (a resolved promise, so nothing was logged), and the 继续旅程 button is only shown in state 'skycity' → no UI, no
   *  departure. Close that board in place (same exitLevel the other region advances use) without moving her or the held shot. */
  leaveFinaleBoard():boolean{
    const w=this.world?.commands();if(!w||w.snapshot().state!=='level')return true;
    const actor=this.boundCharacter as any,had=actor&&Object.prototype.hasOwnProperty.call(actor,'__qfWalkTail'),prev=actor?.__qfWalkTail;
    if(actor&&!prev)actor.__qfWalkTail={done:Promise.resolve(),holdForFinale:true}/* RegionJourneyCore.restore(): keep her where the finale left her */;
    let r:any;try{const inPlace=(w as any).exitLevelInPlace;r=typeof inPlace==='function'?inPlace()/* skyfix: no restore(), board fades */:w.exitLevel();}catch(error){r={ok:false,reason:String(error)};}
    finally{if(actor&&!prev){if(had)actor.__qfWalkTail=prev;else delete actor.__qfWalkTail;}}
    try{(this.stage() as any)?.holdFinaleView?.();}catch{/* optional */}
    if(!r?.ok)console.warn('[QF_TRANSITION] sky finale board exit refused '+String(r?.reason));
    return !!r?.ok;
  }
  async continueFromSkyFinale(){const stage=this.stage() as any;let camera=null;try{camera=stage?.finaleEndCamera?.()??null;stage?.disarmFinale?.();stage?.markFinaleDeparture?.();}catch{/* optional */}
    this.leaveFinaleBoard();const t0=Date.now();let reason='no-continuous-handler';
    for(const h of [...this.skyContinueHandlers]){let r:any;try{r=h(camera);}catch(error){reason='handler-threw:'+String(error);console.warn('[QF_TRANSITION] sky-finale-continue '+reason);continue;}
      if(r===true)return {ok:true,via:'continuous'} as any;
      if(r&&typeof r.then==='function'){let res:any;try{res=await r;}catch(error){res={ok:false,reason:'continuous-threw:'+String(error)};}
        if(res&&res.ok!==false)return {...res,via:'continuous'};
        if(!this.stillInSkycity())return res??{ok:false,reason:'continuous-null'};
        reason=String(res?.reason??'continuous-null');break;}}
    // bounded fallback: the continuous path declined / returned null / threw while she is still in sky city → the WindWipe ride, logged
    if(this.skyContinueHandlers.length){const n=recordFallback('lakeside',(Date.now()-t0)/1000,'sky-finale:'+reason);console.warn('[QF_TRANSITION_FALLBACK] !!! sky finale → lakeside fell back to WindWipe (#'+n+', reason '+reason+'). Acceptance requires 0 — report this.');}
    return withLegacyTransition(()=>this.enterMainline());}
  private stillInSkycity(){try{const s=this.world?.commands().snapshot();return !!s&&(s.state==='skycity'||s.state==='level'&&s.journey?.region==='skycity');}catch{return false;}}
  /** 继续旅程: from the held sky finale go through the continuation hook; elsewhere the plain mainline entry. */
  continueJourney(){return this.skyFinaleActive()?this.continueFromSkyFinale():this.enterMainline();}
  async enterMainline(){const s=this.mainlineStatus();if(s.active?.status!=='playing'&&(RegionCampaign as any).canEnterRegion(s.journey,'lakeside').ok)return this.enterRegion('lake');const id=s.active?.status==='playing'?s.active.stageId:s.nextStageId||s.stages.find((x:any)=>x.unlocked&&!x.record?.bestStars)?.id||'mainline-12';return this.enterMainlineStage(id);}
  async enterMainlineStage(stageId:string,seed=1){const selected=this.selectProvider({provider:'mainline',stageId,seed});return selected.ok?this.enterSelectedLevel():selected;}
  async advanceMainline(){
    const s=this.activeSession?.snapshot();if(s?.provider!=='mainline-v33'||!s.result?.completionRecorded||!s.nextStageId||s.state!=='result.saved')return {ok:false,reason:'next-requires-registered-win'};
    const route=(RegionCampaign as any).transition(s.journey,s.active.stageId,s.nextStageId);if(!route.ok)return route;
    if(route.requiresTravel){const prepared=await this.world!.commands().prepareRegion(route.toRegion);if(!prepared.ok)return prepared;}
    await this.presentNodeWalk(s,!!route.requiresTravel&&typeof continuousTransitions==='function'&&continuousTransitions())/* sail-blue: departure walk hands its live lens to the ride */;
    if(route.requiresTravel&&typeof continuousTransitions==='function'&&continuousTransitions())this.adoptLiveForJourney();
    const exited=this.world!.commands().exitLevel();return exited.ok?this.enterMainlineStage(s.nextStageId):exited;
  }
  /** sail-blue: hand the departure walk's live lens + her stand to the prepared ride before exitLevel restores. */
  private adoptLiveForJourney(){try{const c=this.world!.commands() as any;const n=(this.boundCharacter as any)?.node;const p=n?.worldPosition;const e=n?.eulerAngles;c.adoptJourneyLive?.(p?[p.x,p.y,p.z]:null,e?e.y*Math.PI/180:undefined);}catch{/* optional */}}
  mainlineReward(command:'openChest'|'claimRegion',index:number){if(this.activeSession?.snapshot().provider!=='mainline-v33')return {ok:false,reason:'not-mainline'};const snapshot=this.activeSession.snapshot();if(command==='openChest'){const chest=snapshot.journey.chests?.find((x:any)=>x.level===index);if(snapshot.readOnly||snapshot.state!=='result.saved'||!snapshot.result?.completionRecorded||index!==snapshot.active.level||!chest?.earned)return this.hostReply={ok:false,reason:'chest-not-earned-or-unsaved'};}else{const region=snapshot.journey.regionRewards?.find((x:any)=>x.region===index);if(snapshot.readOnly||snapshot.state!=='result.saved'||!snapshot.result?.completionRecorded||index!==Math.floor(snapshot.active.level/4)||!region?.unlocked)return this.hostReply={ok:false,reason:'region-tool-not-earned-or-unsaved'};}return this.hostReply=this.activeSession.command(command,index);}
  async enterR4(){const f:any=this.smokeFixture!.json;const selected=this.selectProvider({provider:'r4',stageId:f.stageId,seed:f.seed});return selected.ok?this.enterSelectedLevel():selected;}
  async advanceRegistered(){const s=this.activeSession?.snapshot();if(!s||s.state!=='result.saved'||!s.result?.completionRecorded||!s.nextStageId)return {ok:false,reason:'next-requires-registered-win'};
    if(requiresMeadowScene({stageId:s.nextStageId})){try{await preflightMeadowScene();}catch{return {ok:false,reason:'meadow-scene-load-failed'};}}
    const next=(RegionalAPI as any).getStage(s.nextStageId),permission=(CampaignHost as any).inspectSelection(this.persistence,{stageId:next.id,seed:next.seedBank[0]});if(!permission.ok)return permission;
    const exited=this.world!.commands().exitLevel();if(!exited.ok)return exited;
    const selected=this.selectProvider({provider:'r5',stageId:next.id,seed:next.seedBank[0]});return selected.ok?this.enterSelectedLevel():selected;
  }
  claimRegisteredMemento(){const s=this.activeSession?.snapshot();if(!s||s.state!=='result.saved'||!s.result?.completionRecorded)return {ok:false,reason:'claim-requires-registered-win'};
    const stages=(RegionalAPI as any).catalog.filter((x:any)=>x.region===s.active.region);if(stages.length!==4||!stages.every((x:any)=>s.progress.records[x.id]))return {ok:false,reason:'region-incomplete'};
    return this.hostReply=this.activeSession.claimMemento(s.active.region);
  }
  lastHostReply(){return this.hostReply;}
  useIsolatedTestProfile(namespace:string,journeyNamespace:string):Result {
    if(!this.world||!['home','island'].includes(this.world.commands().snapshot().state))return {ok:false,reason:'test-profile-only-outside-level'};
    this.persistence=createIsolatedTestPort(namespace,journeyNamespace);return {ok:true};
  }
  regionFlowTestStatus(){return DEBUG&&this.testProfile?{namespace:this.testProfile.namespace,checkpoint:this.testProfile.completed,lastAction:this.testProfile.lastAction}:null;}
  /** Web / QA only (`?balloonPreview=1`). WeChat release ignores it. No on-screen test banner. */
  async previewBalloonTransit():Promise<Result>{
    if(!qaTransportEnabled())return {ok:false,reason:'qa-only'};
    if(!this.world)return {ok:false,reason:'world-not-ready'};
    const commands=this.world.commands();
    if(commands.snapshot().state==='home'){const left=await commands.leaveHome();if(!left.ok)return left;}
    if(commands.snapshot().state==='island'){const meadow=await commands.travelRegion('meadow');if(!meadow.ok)return meadow;}
    try{const q=typeof location!=='undefined'?String(location.search||''):'';const forced=/(?:^|[?&])balloonNight=([01])/.exec(q);if(forced)await (globalThis as any).__worldDayNight?.set?.(forced[1]==='1'?'night':'day');else if(q.includes('night=1'))await commands.toggleDayNight();}catch{}
    return commands.travelRegion('skycity');
  }
  /** Web / QA only (`?meadowGameplay=1`). Stand in the live meadow without starting the balloon transit. */
  async previewMeadowGameplay():Promise<Result>{
    if(!qaTransportEnabled())return {ok:false,reason:'qa-only'};
    if(!this.world)return {ok:false,reason:'world-not-ready'};
    const commands=this.world.commands();
    if(commands.snapshot().state==='home'){const left=await commands.leaveHome();if(!left.ok)return left;}
    if(commands.snapshot().state==='island')return commands.travelRegion('meadow');
    return {ok:commands.snapshot().state==='meadow',reason:commands.snapshot().state==='meadow'?undefined:'not-meadow'};
  }
  /** Web / QA only (`?sailqa=1`). Real RegionJourney sail from the mainline-04 stand (I4). */
  async previewSailJourney():Promise<Result>{
    if(!qaTransportEnabled())return {ok:false,reason:'qa-only'};
    if(!this.world)return {ok:false,reason:'world-not-ready'};
    const commands=this.world.commands();
    armSailQa();
    if(commands.snapshot().state==='home'){const left=await commands.leaveHome();if(!left.ok)return left;}
    try{this.boundCharacter?.cancelAndReset({kind:'standing',controllerRoot:[4.5,0.231,-4.9],yawRad:0});}catch(error){console.error('[QF_SAIL] sailqa stand failed',error);}
    try{const q=typeof location!=='undefined'?String(location.search||''):'';if(q.includes('night=1'))await (globalThis as any).__worldDayNight?.set?.('night');else await (globalThis as any).__worldDayNight?.set?.('day');}catch{}
    if(commands.snapshot().state!=='island')return {ok:false,reason:'sailqa-not-island'};
    return commands.travelRegion('meadow');
  }
  async startRegionFlowTest(checkpoint:number):Promise<Result>{
    if(!DEBUG)return {ok:false,reason:'test-build-only'};
    if(!this.world||!['home','island'].includes(this.world.commands().snapshot().state))return {ok:false,reason:'test-only-outside-level'};
    let profile:any;try{profile=createRegionFlowCheckpoint(checkpoint);}catch(e){return {ok:false,reason:String((e as Error).message)};}
    if(!this.normalPorts)this.normalPorts={mainline:this.mainline,r4:this.r4,persistence:this.persistence,selection:this.selection};
    this.mainline=profile.mainline;this.r4=profile.r4;this.persistence=profile.r5;this.testProfile=profile;this.activeSession=null;this.hostReply=null;
    if(this.world.commands().snapshot().state==='home'){const r=await this.world.commands().leaveHome();if(!r.ok)return r;}
    return this.enterMainlineStage(profile.stageId,profile.seed);
  }
  /** b17r10 test-only level skip (`?qfSkip=<target>`, see QaSkip.ts). Refuses unless the URL/host gate is open. Isolated profile:
   *  real saves are never written; leave via exitQaSkip() or a relaunch. No banner. */
  async qaSkip(target:QaSkipTarget):Promise<Result>{
    const gated=qaSkipTarget('qfSkip='+target);if(!gated||gated!==target)return {ok:false,reason:'qa-skip-disabled'};
    const search=qaQuery();
    if(!qaSkipTarget(search)&&!(globalThis as any).__QF_QA_SKIP_API)return {ok:false,reason:'qa-skip-disabled'};
    if(!this.world||!['home','island'].includes(this.world.commands().snapshot().state))return {ok:false,reason:'test-only-outside-level'};
    const cp=QA_SKIP_CHECKPOINT[target];let profile:any;
    try{profile=createRegionFlowCheckpoint(cp.completed,{allowQa:true,finish:cp.finish});}catch(e){return {ok:false,reason:String((e as Error).message)};}
    if(!this.normalPorts)this.normalPorts={mainline:this.mainline,r4:this.r4,persistence:this.persistence,selection:this.selection};
    this.mainline=profile.mainline;this.r4=profile.r4;this.persistence=profile.r5;this.testProfile=profile;this.activeSession=null;this.hostReply=null;
    try{console.info('[QF_QA_SKIP] '+JSON.stringify({target,namespace:profile.namespace,completed:cp.completed,finish:cp.finish}));}catch{}
    if(this.world.commands().snapshot().state==='home'){const r=await this.world.commands().leaveHome();if(!r.ok)return r;}
    return cp.finish?this.enterMainline():this.enterMainlineStage(profile.stageId,profile.seed);
  }
  /** Test-only pre-transition setup (PreTransitionRun): swap in an isolated, engine-replayed profile (real saves untouched),
   *  `completed` stages with the last one paused one move short (finish=false) or registered (finish=true). Same host gate as
   *  __qfTeleport; refuses in WeChat release. Moves nobody: the caller drives the world through the normal commands. */
  preTransitionProfile(completed:number,finish:boolean,lake?:{stageId:string;mode:'win'|'lose'}):Result{
    if(!preTransitionEnabled())return {ok:false,reason:'pre-transition-disabled'};
    if(!this.world||!['home','island'].includes(this.world.commands().snapshot().state))return {ok:false,reason:'test-only-outside-level'};
    let profile:any,lk:any=null;try{profile=createRegionFlowCheckpoint(completed,{allowQa:true,finish,anyCheckpoint:true});if(lake)lk=seedLakeCheckpoint(profile,lake.stageId,lake.mode,{allowQa:true});}catch(e){return {ok:false,reason:String((e as Error).message)};}
    if(!this.normalPorts)this.normalPorts={mainline:this.mainline,r4:this.r4,persistence:this.persistence,selection:this.selection};
    this.mainline=profile.mainline;this.r4=profile.r4;this.persistence=profile.r5;this.testProfile=profile;this.activeSession=null;this.hostReply=null;
    try{console.info('[QF_PRE] profile '+JSON.stringify({namespace:profile.namespace,completed,finish,lake:lk&&{stageId:lk.stageId,seed:lk.seed,cleared:lk.cleared}}));}catch{}
    if(lk)return {ok:true,stageId:lk.stageId,seed:lk.seed,lastAction:lk.lastAction,cleared:lk.cleared} as any;
    return {ok:true,stageId:profile.stageId,seed:profile.seed,lastAction:profile.lastAction} as any;
  }
  exitQaSkip():Result{
    if(!this.normalPorts)return {ok:false,reason:'no-test-profile'};
    if(!this.world||!['home','island'].includes(this.world.commands().snapshot().state))return {ok:false,reason:'return-to-island-before-exiting-test'};
    Object.assign(this,this.normalPorts);this.normalPorts=null;this.testProfile=null;this.activeSession=null;this.hostReply=null;return {ok:true};
  }
  exitRegionFlowTest():Result{
    if(!DEBUG||!this.normalPorts)return {ok:false,reason:'no-test-profile'};
    if(!this.world||!['home','island'].includes(this.world.commands().snapshot().state))return {ok:false,reason:'return-to-island-before-exiting-test'};
    Object.assign(this,this.normalPorts);this.normalPorts=null;this.testProfile=null;this.activeSession=null;this.hostReply=null;return {ok:true};
  }
  attachCalibratedCharacter(adapter:CharacterAdapter){if(!this.world)throw Error('World not ready');this.boundCharacter=adapter;const st=this.stage();if(st){st.characterSource=()=>this.boundCharacter;st.ensureCharacter();}return this.world.bindCharacter(adapter);}
  /** Reward / next-level: follow the girl to the next node, then the existing board or bridge opens. No character bound (tests, headless) keeps today's order. */
  private markExplore(on:boolean){const set=(globalThis as any).__qfSetExplore;if(typeof set==='function')set(on);}
  private stage():RegionNodeStage|null{return this.node?.getComponent(RegionNodeStage)||null;}
  private async presentNodeWalk(snapshot:any,handoff=false){
    if(!this.boundCharacter||!snapshot?.active?.stageId||!snapshot?.nextStageId)return;
    await (this.boundCharacter as any).__qfWalkTail?.done/* b15: a level cleared during her exit walk: let it finish, never re-walk/snap */;
    const stage=this.stage();
    if(stage&&this.worldCamera){
     stage.bindCharacter(this.boundCharacter);
     try{await stage.playReward(this.boundCharacter,snapshot.active.stageId,snapshot.nextStageId,handoff);}
     catch(error){console.error('region-node-walk',error);}
     return;
    }
    this.markExplore(true);
    try{await runRewardWalk(this.boundCharacter,snapshot.active.stageId,snapshot.nextStageId);}
    catch(error){console.error('region-node-walk',error);}
  }
  /** Sky-city clear: leave the stair top, look up at the star ring, then free explore. */
  async claimRegionAndWalk(index:number){
    const snap=this.activeSession?.snapshot();
    const stage=this.stage();
    if(snap?.active?.stageId==='mainline-12'&&this.boundCharacter&&stage){
     await (this.boundCharacter as any).__qfWalkTail?.done;
     stage.bindCharacter(this.boundCharacter);
     try{await stage.playFinale(this.boundCharacter);}catch(error){console.error('region-node-finale',error);}
     /* T-02: once the region reward is claimed, the held sky shot auto-continues after SKY_FINALE.holdS of no input (same
      * handler as 继续旅程; any drag/tap cancels it and the button stays). */
     const r=this.mainlineReward('claimRegion',index);if((r as any)?.ok!==false)this.leaveFinaleBoard()/* skyfix: state 'skycity' → 继续旅程 shown, departure can select lakeside */;if((r as any)?.ok!==false)try{stage.armFinaleContinue?.(()=>{void this.continueFromSkyFinale();});}catch{/* optional */}
     return r;
    }
    return this.mainlineReward('claimRegion',index);
  }
  /** URL `qa=1` only, and only in the web-test build. `MINIGAME` is true for wechat-release, so this body is not in the player package. */
  async qaShot(spec:{region?:'island'|'meadow'|'skycity'|'lakeside';lens?:string;prop?:string;night?:boolean;phase?:string;timeScale?:number}){
    if(MINIGAME)return {ok:false,reason:'player-build'};
    if(spec?.region==='lakeside')return this.qaShotLakeside(spec);
    const search=(()=>{try{const s=(globalThis as any).location?.search;return typeof s==='string'?s:'';}catch{return '';}})();
    if(!qaUnlocked(search))return {ok:false,reason:'qa-only'};
    if(!this.world)return {ok:false,reason:'world-not-ready'};
    const region=spec?.region==='meadow'||spec?.region==='skycity'?spec.region:'island';
    const checkpoint=region==='meadow'?8:region==='skycity'?12:4;
    try{
     const diag=(this.boundCharacter as any)?.diagnostics?.();
     const root=diag?.root||[0,0,0];
     this.boundCharacter?.cancelAndReset({kind:'standing',controllerRoot:[root[0],root[1],root[2]],yawRad:0});
    }catch{/* idle */}
    let here=this.world.commands().snapshot();
    const placed=here.state==='level'&&here.journey?.region===region;
    if(!placed){
     if(here.state==='level'){const exited=this.world.commands().exitLevel();if(!exited.ok)return exited;here=this.world.commands().snapshot();}
     const profile=createRegionFlowCheckpoint(checkpoint,{allowQa:true});
     if(!this.normalPorts)this.normalPorts={mainline:this.mainline,r4:this.r4,persistence:this.persistence,selection:this.selection};
     this.mainline=profile.mainline;this.r4=profile.r4;this.persistence=profile.r5;this.testProfile=profile;this.activeSession=null;
     if(here.state==='home'){const left=await this.world.commands().leaveHome();if(!left.ok)return left;}
     const entered=await this.enterMainlineStage(profile.stageId,profile.seed);if(!entered.ok)return entered;
    }
    if(spec?.night){try{const day=this.world.commands().dayNight?.();if(!String(day?.mode||day||'').includes('night'))this.world.commands().toggleDayNight();}catch{/* day stays */}}
    const stage=this.stage();if(stage){stage.bindCharacter(this.boundCharacter);await stage.frame({region,lens:spec?.lens,prop:spec?.prop});}
    let pause=false;
    if(spec?.lens==='board'){
     const reveal=()=>{const scene=director.getScene();if(!scene)return;for(const c of scene.getComponentsInChildren(Component)){const fn=(c as any).revealPlayfield;if(typeof fn==='function')fn.call(c);}};
     reveal();await new Promise<void>(resolve=>this.scheduleOnce(()=>resolve(),0));reveal();
     const scene=director.getScene();
     pause=!!scene?.getChildByName('PausePanel')||!!(scene as any)?.getComponentsInChildren?.(Component)?.some((c:any)=>c.node?.name==='PausePanel'&&c.node.activeInHierarchy);
    }
    (globalThis as any).__qaFrame=spec?.lens||'world';
    const note=(stage as any)?.shotNote||'';
    return {ok:true,pause,note};
  }
  /** QA only (b15): skycity checkpoint → the real skycity → lakeside balloon journey at timeScale (default 3), frozen
   *  (timeScale 0) at phase 'door' (she pushes the basket door open and steps out), 'walk' (walking back to the shore while
   *  the board fades in) or 'reveal' (on shore, then the lakeside free look at the revealWiden angle that frames the whole
   *  balloon + her: LakesideQaShot.lakesideRevealPose, held on the world camera every frame). Next qaShot clears the hold. */
  private qaRevealHook:(()=>void)|null=null;
  private async qaShotLakeside(spec:{phase?:string;timeScale?:number}){
    const phase=lakesideQaPhase(spec?.phase),freeze=LAKESIDE_QA_FREEZE[phase],scale=Math.max(1,Math.min(8,Number(spec?.timeScale)||3));
    const sched=director.getScheduler();sched.setTimeScale(1);
    if(this.qaRevealHook){director.off(Director.EVENT_BEFORE_DRAW,this.qaRevealHook);this.qaRevealHook=null;}
    // b16: a same-page call can land before the return route exists (return-route-not-yet-available): wait and retry
    let sky:any=null;for(let i=0;i<20;i++){sky=await this.qaShot({region:'skycity'});if(sky?.reason==='exit-current-level-first'){try{const ww=this.world!.commands();if(ww.snapshot().state==='level')ww.exitLevel();}catch{/* retry */}}
     // b15 handover: a consecutive call from the lakeside itself (no route back to skycity): stand her on the island first
     else if(sky?.reason==='return-route-not-yet-available'&&this.world?.commands().snapshot().state==='lakeside'){try{(this.world.commands() as any).abandonLakesideJourney?.();}catch{/* retry */}}
     else if(sky?.ok||sky?.reason!=='return-route-not-yet-available')break;await new Promise<void>(r=>setTimeout(r,500));}
    if(!sky?.ok)return sky;
    // b15 QA: the skycity frame() hid WorldNavigationCanvas; the lakeside journey that follows is the real flow (fades, cover, board UI), so reopen it.
    try{const f=(n:any):any=>{if(!n)return null;if(n.name==='WorldNavigationCanvas')return n;for(const c of n.children||[]){const h=f(c);if(h)return h;}return null;};const ui=f(director.getScene());if(ui&&!ui.active)ui.active=true;}catch{/* qa only */}
    const w=this.world!.commands();if(w.snapshot().state==='level'){const e=w.exitLevel();if(!e.ok)return e;}
    const qa:{mark:string|null;markT:number}={mark:null,markT:0};(globalThis as any).__qaLakeside=qa;
    sched.setTimeScale(scale);
    let travel:any=null;void w.travelRegion('lakeside').then(r=>{travel=r;},e=>{travel={ok:false,reason:String(e)};});
    const sleep=(ms:number)=>new Promise<void>(r=>setTimeout(r,ms));
    for(let i=0;i<1200&&qa.mark!==freeze.mark;i++){if(travel&&travel.ok===false){sched.setTimeScale(1);return travel;}await sleep(100);}
    if(qa.mark!==freeze.mark){sched.setTimeScale(1);return {ok:false,reason:'qa-lakeside-timeout',mark:qa.mark};}
    await sleep(freeze.afterS*1000/scale);
    if(phase!=='reveal'){sched.setTimeScale(0);return {ok:true,phase,mark:qa.mark};}
    sched.setTimeScale(1);await sleep(1200);
    const cam=this.worldCamera;if(!cam||!cam.node?.isValid)return {ok:false,reason:'no-world-camera'};
    const p=cam.node.worldPosition,fw=new Vec3();Vec3.transformQuat(fw,new Vec3(0,0,-1),cam.node.worldRotation);
    const board={position:[p.x,p.y,p.z] as Vec,target:[p.x+fw.x*10,p.y+fw.y*10,p.z+fw.z*10] as Vec,fovVerticalDeg:cam.fov};
    const d=(this.boundCharacter as any)?.diagnostics?.(),feet=(d?.root||[0,0,0]) as Vec;
    const scene=director.getScene();let b:any=null;const walk=(n:any)=>{if(!n||b)return;if(n.name==='LakesideMooredBalloon'&&n.activeInHierarchy){b=n;return;}for(const c of n.children||[])walk(c);};walk(scene);
    if(!b)return {ok:false,reason:'no-moored-balloon'};
    const bp=b.worldPosition,vs=view.getVisibleSize(),occ=qaSceneOccluder(scene,[b,(this.boundCharacter as any)?.node].filter(Boolean),feet),skipN=[b,(this.boundCharacter as any)?.node].filter(Boolean),edge=qaSceneEdgeRay(scene,skipN,feet),r=lakesideRevealPose(board,feet,[bp.x,bp.y,bp.z],vs.width/Math.max(1,vs.height),.98,occ,.03,edge);
    if(!r)return {ok:false,reason:'no-reveal-angle'};
    const pose=r.pose;this.qaRevealHook=()=>{if(cam.node.isValid)applyCameraPose(cam,fromLookAt(pose,pose.fovVerticalDeg??cam.fov),'qa.lakeside-reveal');};
    director.on(Director.EVENT_BEFORE_DRAW,this.qaRevealHook);
    return {ok:true,phase,yawDeg:r.yawDeg,pitchDeg:r.pitchDeg,maxNdc:r.maxNdc,occludedFrac:r.occludedFrac,edgeCuts:r.edgeCuts,composition:r.composition,fov:pose.fovVerticalDeg,board,pose};
  }
  worldCommands(){if(!this.world)throw Error('World not ready');return this.world.commands();}
  private releaseOwned(){if(this.worldCamera&&this.previousCameraVisibility!==null)this.worldCamera.visibility=this.previousCameraVisibility;this.owner?.destroy();this.uiParent?.destroy();this.owner=null;this.uiParent=null;this.world=null;this.previousCameraVisibility=null;}
  onDestroy(){this.releaseOwned();}
}
