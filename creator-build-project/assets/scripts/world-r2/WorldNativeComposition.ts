import { _decorator, Component, Node, Prefab, Camera, JsonAsset, Layers, sys } from 'cc';
import { DEBUG } from 'cc/env';
import { levelBackgroundKind, requiresMeadowScene, requiresSkycityScene } from './LevelRegion';
import { createMeadowBoardBackground, preflightMeadowScene } from '../region/MeadowBoardBackground';
import { createSkycityBoardBackground, preflightSkycityScene } from '../region/SkycityBoardBackground';
import { createRegionFlowCheckpoint, createRegionFlowEntry, createRegionFlowWins, openRegionFlowRoot, pinnedFlowMarker, readTask21TestNamespace, task21TestRoot } from './RegionFlowTest';
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
import { installR5PersistenceProbe,createIsolatedTestPort } from './R5PersistenceProbe';
const {ccclass,property}=_decorator;
async function preflightUpcomingScene(stageId: string): Promise<string> {
  if (requiresMeadowScene({ stageId })) { try { await preflightMeadowScene(); } catch { return 'meadow-scene-load-failed'; } }
  if (requiresSkycityScene({ stageId })) { try { await preflightSkycityScene(); } catch { return 'skycity-scene-load-failed'; } }
  return '';
}

/** Ordinal-1 regional stages unlock after mainline 04 / 08 / 12. Higher ordinals stay on the caller's save. */
function regionUnlockWins(stageId:string):number|null{
  const m=/^r05-(tide|meadow|sky)-(\d+)$/.exec(stageId);
  if(!m||Number(m[2])!==1)return null;
  return m[1]==='tide'?4:m[1]==='meadow'?8:12;
}
/** NEW composition component; do not enable alongside FirstsliceBoot. No automatic rewards/progress. */
@ccclass('WorldNativeComposition')
export class WorldNativeComposition extends Component {
  @property(Prefab) firstsliceModel:Prefab|null=null;
  @property(Camera) worldCamera:Camera|null=null;
  @property(JsonAsset) smokeFixture:JsonAsset|null=null;
  private owner:Node|null=null;private uiParent:Node|null=null;private world:WorldFlowComponent|null=null;
  private selection:Selection|null=null;private mainline=createPersistentMainlinePort();private persistence=createPersistentR5Port(this.mainline.journey);private r4=this.createR4Port();private previousCameraVisibility:number|null=null;private activeSession:any=null;private hostReply:any=null;
  private testProfile:any=null;private normalPorts:any=null;private pinnedRoot:string|null=null;
  private initialization:Promise<void>|null=null;
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
    const levels=createNativeWorldLevelAdapter({uiParent:this.uiParent,fixture,background:context=>{const kind=levelBackgroundKind(context.selection);if(kind==='meadow')return createMeadowBoardBackground(context);if(kind==='skycity')return createSkycityBoardBackground(context);return createIslandBoardBackground(context);},get mainlinePort(){return composition.mainline;},get r4Persistence(){return composition.r4;},get r5Persistence(){return composition.persistence;},onSession:session=>{this.activeSession=session;},
      select:id=>{if(!this.selection||id!==this.selection.stageId)throw Error('Select provider/stage explicitly first');return {...this.selection};},
      navigation:{exit:()=>world.commands().exitLevel(),resume:()=>world.commands().snapshot().needsResume?world.commands().resume():undefined},
    });
    try {const result=await world.initialize(levels,undefined,'motion');if(!result.ok)throw Error(result.reason);}
    catch(error){this.releaseOwned();throw error;}
    if(DEBUG){const ns=readTask21TestNamespace();if(ns){const r=this.pinTestRoot(ns);if(r.ok)console.info('TASK21_TEST_NAMESPACE',JSON.stringify(this.regionFlowTestStatus()));else console.error('TASK21_TEST_NAMESPACE rejected',r.reason);}}
  }
  selectProvider(selection:Selection):Result {
    if(!this.world)return {ok:false,reason:'world-not-ready'};
    if(!['home','island'].includes(this.world.commands().snapshot().state))return {ok:false,reason:'exit-current-level-first'};
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
    return await this.world.commands().enterLevel(selection.stageId);
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
    const challenges:Record<string,number>={tide:0,meadow:0,sky:0};
    try{const raw=this.persistence.platform.load('forest-regional-r05-progress'),d=raw?(typeof raw==='string'?JSON.parse(raw):raw):null;for(const id of Object.keys(d?.records||{})){const m=/^r05-(tide|meadow|sky)-/.exec(id);if(m)challenges[m[1]]++;}}catch{}
    return {r4,r5,challenges};
  }

  mainlineStatus(){return this.mainline.createController().snapshot();}
  mainlineStorage(){return this.mainline.inspect();}
  challengeGates(){return {r4:new (R4 as any)({platform:this.r4.platform,journey:this.mainline.journey}).snapshot().stages,r5:(RegionalAPI as any).catalog.filter((x:any)=>x.ordinal===1).map((x:any)=>({id:x.id,region:x.region,...(CampaignHost as any).inspectSelection(this.persistence,{stageId:x.id,seed:x.seedBank[0]})}))};}
  async enterMainline(){const s=this.mainlineStatus();const id=s.active?.status==='playing'?s.active.stageId:s.nextStageId||s.stages.find((x:any)=>x.unlocked&&!x.record?.bestStars)?.id||'mainline-12';return this.enterMainlineStage(id);}
  async enterMainlineStage(stageId:string,seed=1){const selected=this.selectProvider({provider:'mainline',stageId,seed});return selected.ok?this.enterSelectedLevel():selected;}
  async advanceMainline(){const s=this.activeSession?.snapshot();if(s?.provider!=='mainline-v33'||!s.result?.completionRecorded||!s.nextStageId||s.state!=='result.saved')return {ok:false,reason:'next-requires-registered-win'};const blocked=await preflightUpcomingScene(s.nextStageId);if(blocked)return {ok:false,reason:blocked};const exited=this.world!.commands().exitLevel();return exited.ok?this.enterMainlineStage(s.nextStageId):exited;}
  mainlineReward(command:'openChest'|'claimRegion',index:number){if(this.activeSession?.snapshot().provider!=='mainline-v33')return {ok:false,reason:'not-mainline'};const snapshot=this.activeSession.snapshot();if(command==='openChest'){const chest=snapshot.journey.chests?.find((x:any)=>x.level===index);if(snapshot.readOnly||snapshot.state!=='result.saved'||!snapshot.result?.completionRecorded||index!==snapshot.active.level||!chest?.earned)return this.hostReply={ok:false,reason:'chest-not-earned-or-unsaved'};}else{const region=snapshot.journey.regionRewards?.find((x:any)=>x.region===index);if(snapshot.readOnly||snapshot.state!=='result.saved'||!snapshot.result?.completionRecorded||index!==Math.floor(snapshot.active.level/4)||!region?.unlocked)return this.hostReply={ok:false,reason:'region-tool-not-earned-or-unsaved'};}return this.hostReply=this.activeSession.command(command,index);}
  async enterR4(){const f:any=this.smokeFixture!.json;const selected=this.selectProvider({provider:'r4',stageId:f.stageId,seed:f.seed});return selected.ok?this.enterSelectedLevel():selected;}
  async advanceRegistered(){const s=this.activeSession?.snapshot();if(!s||s.state!=='result.saved'||!s.result?.completionRecorded||!s.nextStageId)return {ok:false,reason:'next-requires-registered-win'};
    const blocked=await preflightUpcomingScene(s.nextStageId);if(blocked)return {ok:false,reason:blocked};
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
  regionFlowTestStatus(){return DEBUG&&this.testProfile?{namespace:this.testProfile.namespace,checkpoint:this.testProfile.completed,lastAction:this.testProfile.lastAction,pinned:!!this.testProfile.pinned}:null;}
  /** Debug only: bind every lane to one named task21 root so a restarted runtime restores the same test progress. */
  pinTestRoot(param:string):Result {
    if(!DEBUG)return {ok:false,reason:'test-build-only'};
    if(!this.world||!['home','island'].includes(this.world.commands().snapshot().state))return {ok:false,reason:'test-only-outside-level'};
    if(this.testProfile)return {ok:false,reason:'test-profile-already-active'};
    let root:any;try{const namespace=task21TestRoot(param);if(!namespace)return {ok:false,reason:'invalid-task21-test-namespace'};root=openRegionFlowRoot(namespace);}catch(e){return {ok:false,reason:String((e as Error).message)};}
    this.normalPorts={mainline:this.mainline,r4:this.r4,persistence:this.persistence,selection:this.selection};
    this.mainline=root.mainline;this.r4=root.r4;this.persistence=root.r5;this.pinnedRoot=root.namespace;
    const marker=pinnedFlowMarker(root.mainline);
    this.testProfile={namespace:root.namespace,completed:marker.completed,lastAction:marker.lastAction,pinned:true};this.activeSession=null;this.hostReply=null;
    return {ok:true};
  }
  async startRegionFlowTest(checkpoint:number):Promise<Result>{
    if(!DEBUG)return {ok:false,reason:'test-build-only'};
    if(!this.world||!['home','island'].includes(this.world.commands().snapshot().state))return {ok:false,reason:'test-only-outside-level'};
    let profile:any;try{profile=createRegionFlowCheckpoint(checkpoint,this.pinnedRoot||undefined);}catch(e){return {ok:false,reason:String((e as Error).message)};}
    if(!this.normalPorts)this.normalPorts={mainline:this.mainline,r4:this.r4,persistence:this.persistence,selection:this.selection};
    this.mainline=profile.mainline;this.r4=profile.r4;this.persistence=profile.r5;this.testProfile=profile;this.activeSession=null;this.hostReply=null;
    if(this.world.commands().snapshot().state==='home'){const r=await this.world.commands().leaveHome();if(!r.ok)return r;}
    return this.enterMainlineStage(profile.stageId,profile.seed);
  }
  exitRegionFlowTest():Result{
    if(!DEBUG||!this.normalPorts)return {ok:false,reason:'no-test-profile'};
    if(!this.world||!['home','island'].includes(this.world.commands().snapshot().state))return {ok:false,reason:'return-to-island-before-exiting-test'};
    Object.assign(this,this.normalPorts);this.normalPorts=null;this.testProfile=null;this.pinnedRoot=null;this.activeSession=null;this.hostReply=null;return {ok:true};
  }
  /** Hidden debug panel only. Reaches home or island, then runs the requested jump. Release builds return immediately. */
  async debugJump(cmd:{kind:'place';place:'home'|'island'|'skycity'|'r4'}|{kind:'mainline';level:number}|{kind:'region';stageId:string}|{kind:'last';checkpoint:number}|{kind:'exit-flow'}):Promise<Result>{
    if(!DEBUG)return {ok:false,reason:'debug-build-only'};
    if(!this.world)return {ok:false,reason:'world-not-ready'};
    if(cmd.kind==='exit-flow'){const place=await this.debugReach('island');return place.ok?this.exitRegionFlowTest():place;}
    if(cmd.kind==='last'){const place=await this.debugReach('island');return place.ok?this.startRegionFlowTest(cmd.checkpoint):place;}
    if(cmd.kind==='place'){
      if(cmd.place==='home')return this.debugReach('home');
      if(cmd.place==='island')return this.debugReach('island');
      const place=await this.debugReach('island');if(!place.ok)return place;
      if(cmd.place==='skycity')return this.world.commands().enterSkycity();
      const entered=await this.enterR4();if(entered.ok)return entered;
      const f:any=this.smokeFixture!.json;this.selection={provider:'r4',stageId:f.stageId,seed:f.seed};return this.world.commands().enterLevel(f.stageId);
    }
    const place=await this.debugReach('island');if(!place.ok)return place;
    if(cmd.kind==='mainline'){
      const id='mainline-'+String(cmd.level).padStart(2,'0');
      const selected=this.selectProvider({provider:'mainline',stageId:id,seed:1});
      if(selected.ok)return this.enterSelectedLevel();
      if(selected.reason!=='stage-locked')return selected;
      let profile:any;try{profile=createRegionFlowEntry(cmd.level);}catch(e){return {ok:false,reason:String((e as Error).message)};}
      if(!this.normalPorts)this.normalPorts={mainline:this.mainline,r4:this.r4,persistence:this.persistence,selection:this.selection};
      this.mainline=profile.mainline;this.r4=profile.r4;this.persistence=profile.r5;this.testProfile=profile;this.activeSession=null;this.hostReply=null;
      return this.enterMainlineStage(profile.stageId,profile.seed);
    }
    const stage=(RegionalAPI as any).getStage(cmd.stageId);if(!stage||!stage.seedBank?.length)return {ok:false,reason:'unknown-stage'};
    const seed=stage.seedBank[0],selected=this.selectProvider({provider:'r5',stageId:cmd.stageId,seed});
    if(selected.ok)return this.enterSelectedLevel();
    const wins=selected.reason==='stage-locked'?regionUnlockWins(cmd.stageId):null;
    if(wins==null){this.selection={provider:'r5',stageId:cmd.stageId,seed};return this.world.commands().enterLevel(cmd.stageId);}
    let profile:any;try{profile=createRegionFlowWins(wins);}catch(e){return {ok:false,reason:String((e as Error).message)};}
    if(!this.normalPorts)this.normalPorts={mainline:this.mainline,r4:this.r4,persistence:this.persistence,selection:this.selection};
    this.mainline=profile.mainline;this.r4=profile.r4;this.persistence=profile.r5;this.testProfile=profile;this.activeSession=null;this.hostReply=null;
    const again=this.selectProvider({provider:'r5',stageId:cmd.stageId,seed});
    return again.ok?this.enterSelectedLevel():again;
  }
  private async debugReach(where:'home'|'island'):Promise<Result>{
    const cmd=this.world!.commands() as {debugPlace?:(place:'home'|'island')=>Result};
    if(typeof cmd.debugPlace==='function')return cmd.debugPlace(where);
    return {ok:false,reason:'debug-place-missing'};
  }
  attachCalibratedCharacter(adapter:CharacterAdapter){if(!this.world)throw Error('World not ready');return this.world.bindCharacter(adapter);}
  worldCommands(){if(!this.world)throw Error('World not ready');return this.world.commands();}
  private releaseOwned(){if(this.worldCamera&&this.previousCameraVisibility!==null)this.worldCamera.visibility=this.previousCameraVisibility;this.owner?.destroy();this.uiParent?.destroy();this.owner=null;this.uiParent=null;this.world=null;this.previousCameraVisibility=null;}
  onDestroy(){this.releaseOwned();}
}
