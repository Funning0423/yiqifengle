import { createSkycityBoardBackground } from '../region/SkycityBoardBackground';
import { createLakesideBoardBackground, LAKESIDE_LOAD_FAILED, prewarmLakesideAssets, preloadLakesideBoard } from '../region/LakesideBoardBackground';
import RegionCampaign from '../mainline-r1/runtime/region-campaign.js';
import type { JourneyRegion } from '../world-r1/RegionJourneyCore';
import { _decorator, Component, Node, Prefab, Camera, JsonAsset, Layers, sys, director, view } from 'cc';
import { DEBUG, MINIGAME } from 'cc/env';
import { requiresMeadowScene, requiresSkycityScene, requiresLakesideScene } from './LevelRegion';
import { createMeadowBoardBackground, preflightMeadowScene } from '../region/MeadowBoardBackground';
import { createRegionFlowCheckpoint } from './RegionFlowTest';
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
// r4-prep B (extended): she stays where she landed in the meadow / sky-city live boards (their lease files untouched; wrapped per entry).
const meadowBoardWithGuest=(context:any)=>withRegionBoardGuest('meadow','MeadowLiveScene',1<<20,createMeadowBoardBackground)(context),skycityBoardWithGuest=(context:any)=>withRegionBoardGuest('skycity','SkycityLiveBackground',1<<20,createSkycityBoardBackground)(context);
const {ccclass,property}=_decorator;
/** NEW composition component; do not enable alongside FirstsliceBoot. No automatic rewards/progress. */
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
  start(){void this.initializeWorld().catch(error=>console.error('World composition initialization failed',error));}
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
     const input=this.node.getComponent(ExploreInput)||this.node.addComponent(ExploreInput);
     input.sink=(g,x,y)=>stage.onGesture(g,x,y);
    }
  }
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
    this.pendingJourneySelection=selection;const arrived=await this.ensureRegion(region);if(!arrived.ok){if(region==='lakeside'){console.error('[QF_LAKE] lakeside journey not reached: '+arrived.reason);if(!LAKESIDE_SOFT_REASONS.includes(String(arrived.reason)))return this.lakesideFallback('journey',arrived.reason);}return arrived;}
    // ===== LAKESIDE LANDING → BOARD HOOK (运镜bot owns the transition; swap lakesideLandingToBoard for their hook) =====
    // 运镜bot: lakeside assets still not ready after the hook's 3 s wait → the existing lakeside fallback (toast + island), never an empty board.
    let held=false;
    if(region==='lakeside'){const landed=await lakesideLandingToBoard({stageId:selection.stageId,journey:this.world?.commands().snapshot().journey??null,deps:this.lakesideLandingDeps()});if(landed?.ok===false)return this.lakesideFallback('board',landed.reason);held=true;this.world?.holdEnterLevel?.(true);}
    // 运镜bot (region hooks): 04→05 / 08→09 end on the meadow / skycity board camera (RegionBoardLanding); hold the push-in only
    // when the hook put the world camera ON that pose and that board background will render. Otherwise today's path, unchanged.
    else if(region==='meadow'||region==='skycity'){const deps=this.regionLandingDeps(region);if(deps&&(region==='meadow'?requiresMeadowScene(selection):requiresSkycityScene(selection))){const landed=await regionLandingToBoard({region,stageId:selection.stageId,deps});if(landed.ok){held=true;this.world?.holdEnterLevel?.(true);}}}
    // 运镜bot: the hold is one-shot and only for this enterLevel (the board camera = the landing end, no push-in, no cut back).
    let result:Result;try{result=await this.world.commands().enterLevel(selection.stageId);}finally{if(held)this.world?.holdEnterLevel?.(false);}if(result.ok){this.pendingJourneySelection=null;this.markExplore(false);}
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
      boardPose:v=>{const src=regionBoardSource(region);return src?regionBoardPose(src,v.width/v.height):null;},
      log:entry=>{try{if((globalThis as any).__worldFlowLog||DEBUG)console.info('[QF_REGION] '+JSON.stringify(entry));}catch{}},
    };
  }
  private selectionRegion(selection:Selection):JourneyRegion {
    if(selection.provider==='mainline')return (RegionCampaign as any).stage(selection.stageId)?.regionId||'island';
    // r05-meadow-* meadow, r05-sky-* skycity, 风铃湖畔 r04-lake-* (r05 renumbering too) lakeside, else island (tide).
    const id=selection.stageId;return /^r05-meadow-/.test(id)?'meadow':/^r05-sky-/.test(id)?'skycity':/^r0[45]-lake-\d+$/.test(id)?'lakeside':'island';
  }
  /** Cold progress opens the same physical route in order. Unlocks are read from verified records, never counters. */
  private async ensureRegion(target:JourneyRegion):Promise<Result>{
    const commands=this.world!.commands();
    let current=commands.snapshot().journey?.region||'island';
    if(current===target&&!commands.snapshot().journey?.target)return {ok:true};
    // 风铃湖畔 is a side branch off the island (island→lakeside, LakesideCameraLayout.lakesideJourney). It is not a mainline
    // campaign region (its r04-lake-* stages are gated by CampaignHost.inspectSelection in selectProvider/enterSelectedLevel).
    if(target!=='lakeside'){const permission=(RegionCampaign as any).canEnterRegion(this.mainline.journeySnapshot(),target);if(!permission.ok)return permission;}
    const order:JourneyRegion[]=target==='lakeside'?['island','lakeside']:['island','meadow','skycity'];
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
  async enterMainline(){const s=this.mainlineStatus();const id=s.active?.status==='playing'?s.active.stageId:s.nextStageId||s.stages.find((x:any)=>x.unlocked&&!x.record?.bestStars)?.id||'mainline-12';return this.enterMainlineStage(id);}
  async enterMainlineStage(stageId:string,seed=1){const selected=this.selectProvider({provider:'mainline',stageId,seed});return selected.ok?this.enterSelectedLevel():selected;}
  async advanceMainline(){
    const s=this.activeSession?.snapshot();if(s?.provider!=='mainline-v33'||!s.result?.completionRecorded||!s.nextStageId||s.state!=='result.saved')return {ok:false,reason:'next-requires-registered-win'};
    const route=(RegionCampaign as any).transition(s.journey,s.active.stageId,s.nextStageId);if(!route.ok)return route;
    if(route.requiresTravel){const prepared=await this.world!.commands().prepareRegion(route.toRegion);if(!prepared.ok)return prepared;}
    await this.presentNodeWalk(s);
    const exited=this.world!.commands().exitLevel();return exited.ok?this.enterMainlineStage(s.nextStageId):exited;
  }
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
  async startRegionFlowTest(checkpoint:number):Promise<Result>{
    if(!DEBUG)return {ok:false,reason:'test-build-only'};
    if(!this.world||!['home','island'].includes(this.world.commands().snapshot().state))return {ok:false,reason:'test-only-outside-level'};
    let profile:any;try{profile=createRegionFlowCheckpoint(checkpoint);}catch(e){return {ok:false,reason:String((e as Error).message)};}
    if(!this.normalPorts)this.normalPorts={mainline:this.mainline,r4:this.r4,persistence:this.persistence,selection:this.selection};
    this.mainline=profile.mainline;this.r4=profile.r4;this.persistence=profile.r5;this.testProfile=profile;this.activeSession=null;this.hostReply=null;
    if(this.world.commands().snapshot().state==='home'){const r=await this.world.commands().leaveHome();if(!r.ok)return r;}
    return this.enterMainlineStage(profile.stageId,profile.seed);
  }
  exitRegionFlowTest():Result{
    if(!DEBUG||!this.normalPorts)return {ok:false,reason:'no-test-profile'};
    if(!this.world||!['home','island'].includes(this.world.commands().snapshot().state))return {ok:false,reason:'return-to-island-before-exiting-test'};
    Object.assign(this,this.normalPorts);this.normalPorts=null;this.testProfile=null;this.activeSession=null;this.hostReply=null;return {ok:true};
  }
  attachCalibratedCharacter(adapter:CharacterAdapter){if(!this.world)throw Error('World not ready');this.boundCharacter=adapter;return this.world.bindCharacter(adapter);}
  /** Reward / next-level: follow the girl to the next node, then the existing board or bridge opens. No character bound (tests, headless) keeps today's order. */
  private markExplore(on:boolean){const set=(globalThis as any).__qfSetExplore;if(typeof set==='function')set(on);}
  private stage():RegionNodeStage|null{return this.node?.getComponent(RegionNodeStage)||null;}
  private async presentNodeWalk(snapshot:any){
    if(!this.boundCharacter||!snapshot?.active?.stageId||!snapshot?.nextStageId)return;
    const stage=this.stage();
    if(stage&&this.worldCamera){
     stage.bindCharacter(this.boundCharacter);
     try{await stage.playReward(this.boundCharacter,snapshot.active.stageId,snapshot.nextStageId);}
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
     stage.bindCharacter(this.boundCharacter);
     try{await stage.playFinale(this.boundCharacter);}catch(error){console.error('region-node-finale',error);}
    }
    return this.mainlineReward('claimRegion',index);
  }
  /** URL `qa=1` only, and only in the web-test build. `MINIGAME` is true for wechat-release, so this body is not in the player package. */
  async qaShot(spec:{region?:'island'|'meadow'|'skycity';lens?:string;prop?:string;night?:boolean}){
    if(MINIGAME)return {ok:false,reason:'player-build'};
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
    return {ok:true,pause};
  }
  worldCommands(){if(!this.world)throw Error('World not ready');return this.world.commands();}
  private releaseOwned(){if(this.worldCamera&&this.previousCameraVisibility!==null)this.worldCamera.visibility=this.previousCameraVisibility;this.owner?.destroy();this.uiParent?.destroy();this.owner=null;this.uiParent=null;this.world=null;this.previousCameraVisibility=null;}
  onDestroy(){this.releaseOwned();}
}
