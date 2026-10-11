import {IslandJourneyOverlay} from './world-r2/IslandJourneyOverlay';
import {applyJourneyNavigationSkin} from './ui/JourneyNavigationSkin';
import {ISLAND_NAV_IDS,worldNavigationLayout} from './world-r2/WorldNavigationLayout';
import { RoomExploreOverlay } from './RoomExploreOverlay';
import { resultLayout } from './ResultLayout';
import { warmButton, WarmButton } from './WarmButton';
import {_decorator,Component,Prefab,assetManager,isValid,EffectAsset,JsonAsset,Camera,Node,Canvas,UITransform,Layers,Label,Graphics,Color,Vec3,view,ResolutionPolicy,director,instantiate,game,Game,MeshRenderer,Material,utils,primitives,profiler,SkeletalAnimation,AnimationClip,resources,ImageAsset,Texture2D,SpriteFrame,Sprite} from 'cc';
import {WorldNativeComposition} from './world-r2/WorldNativeComposition';
import {CHARACTER_REFERENCE as REF} from './world-r1/CharacterReference';
import {pointOnPath,Cancelled} from './world-r1/WorldFlowCore';
import type {CharacterAdapter,Action,Cancellation,StablePose} from './world-r1/WorldFlowCore';
import {StartupReadyGate,StartupAttempt,StartupCancelled} from './world-r2/StartupReadyGate';
import {ManagedMobileBoardUI} from './ManagedMobileBoardUI';
import {REGIONS,loadRegionPrefab,mountRegion} from './region/RegionLoader';
import {validateSkycity} from './region/RegionValidation';
const {ccclass,property}=_decorator;
/** Island world art lives in the region_island Asset Bundle (subpackage or remote), never in the start scene's static deps. */

/** Explicit flow-reference stand-in. The calibrated flag certifies only these reference coordinates,
 * never B body/clothing/contact. No animation clips/root motion/collision acceptance. */
class FlowReferenceStandin implements CharacterAdapter {
 readonly calibrated=true;
 readonly coordinates={units:'m' as const,up:'+Y' as const,forward:'+Z' as const,rootMotion:'controller-only' as const,standingRoot:REF.standingRoot,seatedRoot:REF.seatedRoot,seatYawRad:REF.seatYawRad,clearanceRadiusM:.15};
 private job:any=null;private anim:SkeletalAnimation|null=null;private visualState:any=null;private visualName='';private visualElapsed=0;private visualLoop=false;private disposed=false;
 constructor(private node:Node){}
 private motionEvents:{utc:string;clip:string;duration:number}[]=[];
 diagnostics(){const p=this.node.worldPosition;return {clip:this.visualName,time:this.visualState?.time??null,duration:this.visualState?.clip?.duration??null,loop:this.visualLoop,manualClock:true,action:this.job?.action.kind??null,root:[p.x,p.y,p.z],disposed:this.disposed,availableClips:this.anim?.clips.filter(Boolean).map(c=>({name:c.name,duration:c.duration})),events:this.motionEvents.slice(-32)};}
 bindVisual(visual:Node){if(this.disposed)throw Error('Character disposed');this.anim=visual.getComponent(SkeletalAnimation)||visual.getComponentInChildren(SkeletalAnimation);if(!this.anim)throw Error('Character SkeletalAnimation missing');this.anim.useBakedAnimation=true;this.playNamed('sit_hold',true);}
 /** Creator 3.8.8 AnimationState.pause unregisters the manager tick; public setTime/sample
  * still evaluates SkeletalAnimationState baked frames. The controller is the sole clock. */
 private playNamed(name:string,loop:boolean){if(this.disposed)return;const anim=this.anim;const clip=anim?.clips.find(c=>c?.name===name);if(!anim||!clip)throw Error('Character clip missing: '+name);if(!Number.isFinite(clip.duration)||clip.duration<=0)throw Error('Invalid character clip duration: '+name);
  for(const c of anim.clips){if(c)anim.getState(c.name)?.stop();}
  clip.wrapMode=loop?AnimationClip.WrapMode.Loop:AnimationClip.WrapMode.Normal;
  const state=anim.getState(name)||anim.createState(clip,name);state.wrapMode=clip.wrapMode;state.repeatCount=loop?Infinity:1;anim.play(name);state.pause();state.setTime(0);state.sample();
  this.visualState=state;this.visualName=name;this.visualElapsed=0;this.visualLoop=loop;this.motionEvents.push({utc:new Date().toISOString(),clip:name,duration:clip.duration});if(this.motionEvents.length>32)this.motionEvents.shift();return clip.duration;
 }
 private stopVisual(){this.visualState?.stop();this.visualState=null;this.visualName='';this.visualElapsed=0;}
 playDoorReach(){if(this.disposed||this.job||!this.node.active)return false;this.playNamed('door_reach',false);return true;}
 advance(dt:number){if(this.disposed||!Number.isFinite(dt)||dt<=0)return;const step=Math.min(dt,.1);const j=this.job;
  if(j){j.elapsed=Math.min(j.duration,j.elapsed+step);const p=j.elapsed/j.duration;
   if(j.action.kind==='walk'){
    this.node.setWorldPosition(...pointOnPath(j.action.path,p));
    // +Z is character forward. Follow the authored path on both outward and return walks.
    const a=pointOnPath(j.action.path,Math.max(0,p-.0001)),b=pointOnPath(j.action.path,Math.min(1,p+.0001));
    const dx=b[0]-a[0],dz=b[2]-a[2];
    if(Math.hypot(dx,dz)>1e-8)this.node.setRotationFromEuler(0,Math.atan2(dx,dz)*180/Math.PI,0);
   }
   else if(j.action.kind==='turn')this.node.setRotationFromEuler(0,(j.action.fromYawRad+Math.atan2(Math.sin(j.action.toYawRad-j.action.fromYawRad),Math.cos(j.action.toYawRad-j.action.fromYawRad))*p)*180/Math.PI,0);
   else{const target=j.action.kind==='stand'?j.action.seat.standingControllerRoot:j.action.seat.seatedControllerRoot;this.node.setWorldPosition(...j.from.map((v:number,i:number)=>v+(target[i]-v)*p));}
  }
  if(this.visualState){this.visualElapsed+=step;const duration=this.visualState.clip.duration;this.visualState.setTime(this.visualLoop?this.visualElapsed%duration:Math.min(duration,this.visualElapsed));this.visualState.sample();}
  if(j&&j.elapsed>=j.duration){const kind=j.action.kind;j.off();this.job=null;this.playNamed(kind==='sit'?'sit_hold':'idle_breathing_loop',true);j.resolve();}
  else if(!j&&this.visualName==='door_reach'&&this.visualElapsed>=this.visualState.clip.duration)this.playNamed('idle_breathing_loop',true);
 }
 perform(action:Action,token:Cancellation):Promise<void>{token.check();if(this.disposed)return Promise.reject(Error('Character disposed'));if(this.job)return Promise.reject(Error('Character action busy'));
  if(action.kind==='sit'){
   const q=this.node.worldRotation,from=Math.atan2(2*(q.x*q.z+q.w*q.y),1-2*(q.x*q.x+q.y*q.y));
   const delta=Math.atan2(Math.sin(action.seat.yawRad-from),Math.cos(action.seat.yawRad-from));
   // Return routes end facing the chair. Turn in place before the original sit animation.
   if(Math.abs(delta)>.001)return this.perform({kind:'turn',controllerRoot:action.seat.standingControllerRoot,fromYawRad:from,toYawRad:from+delta,direction:'left'},token).then(()=>{token.check();return this.perform(action,token);});
  }
  let duration:number;try{duration=action.kind==='stand'?this.playNamed('stand_up',false)!:action.kind==='sit'?this.playNamed('sit_down',false)!:action.kind==='walk'?(this.playNamed('walk_loop',true),action.duration):(this.playNamed('idle_breathing_loop',true),1.5);if(!Number.isFinite(duration)||duration<=0)throw Error('Invalid character action duration');}catch(error){return Promise.reject(error);}
  return new Promise((resolve,reject)=>{const pos=this.node.worldPosition;const j:any={action,duration,from:[pos.x,pos.y,pos.z],elapsed:0,resolve,reject,off:()=>{}};this.job=j;j.off=token.onCancel(()=>{if(this.job===j){this.job=null;this.stopVisual();}reject(new Cancelled());});});
 }
 cancelAndReset(pose:StablePose){if(this.disposed)return;if(this.job){this.job.off();this.job.reject(new Cancelled());this.job=null;}this.stopVisual();this.node.setWorldPosition(...(pose.kind==='seated'?pose.seat.seatedControllerRoot:pose.controllerRoot));this.node.setRotationFromEuler(0,(pose.kind==='seated'?pose.seat.yawRad:pose.yawRad)*180/Math.PI,0);this.playNamed(pose.kind==='seated'?'sit_hold':'idle_breathing_loop',true);}
 setVisible(v:boolean){if(!this.disposed)this.node.active=v;}
 dispose(){if(this.disposed)return;this.disposed=true;if(this.job){this.job.off();this.job.reject(new Cancelled());this.job=null;}this.stopVisual();this.anim=null;this.node.destroy();}
}
@ccclass('WorldIntegrationBoot')
export class WorldIntegrationBoot extends Component {
 @property validationScenario='';
 @property initialSeatedClip='sit_hold';
 private startup=new StartupReadyGate();private startupOwner:Node|null=null;private startupReference:Node|null=null;private loadingMask:Node|null=null;private startupGirl:Node|null=null;private characterAnimations:SkeletalAnimation[]=[];private selectedSeatedClip='';
 private loadingBackdrop:Node|null=null;private loadingImageSize={width:710,height:1536};private characterPrefab:Prefab|null=null;private loadPhase='start';private loadProgress=0;private model:Prefab|null=null;private loading=false;private markerRenderer:MeshRenderer|null=null;@property(JsonAsset)smokeFixture:JsonAsset|null=null;
 private roomExplore:RoomExploreOverlay|null=null;private islandJourney:IslandJourneyOverlay|null=null;
 private composition!:WorldNativeComposition;private canvas!:Node;private controls=new Map<string,Node>();private notice!:Label;private status!:Label;private ready=false;private busy=false;private lastState='';private hudState='';private islandEntrance=-1;private settledListeners=new Set<(place:'island'|'home')=>void>();private error='';private doorReached=false;
 start(){profiler.hideStats();if(!this.smokeFixture)throw Error('Bind existing fixture');const scene=director.getScene()!;
 this.createNavigation();this.resize();view.on('canvas-resize',this.resize,this);if(typeof window!=='undefined')window.addEventListener('resize',this.resize);
 (globalThis as any).__regionDebug={mount:(id:string)=>loadRegionPrefab(REGIONS[id]).then(p=>{const n=mountRegion(REGIONS[id],p,director.getScene()!);n.name='REGION_DEBUG_'+id;return {ok:true,node:n.name};},e=>({ok:false,error:String(e)}))};
 for(const n of this.controls.values())n.active=false;this.notice.node.parent!.active=false;this.status.string='咦，起风了';this.resize();
 (globalThis as any).__worldLoading={snapshot:()=>({phase:this.loadPhase,progress:this.loadProgress,error:this.error,approvedArt:true,backgroundSha256:'308f78b5f037bd33668ff8ad899649ee6094b8e55cf695cf7df62a195b7e8e8d',gate:this.startup.snapshot(),initialClip:this.selectedSeatedClip,characterRoot:REF.seatedRoot,childOffset:[0,0,0]}),layout:()=>this.navLayout(),motion:()=>((this as any)._referenceAdapter)?.diagnostics()||null};
 void this.loadWorld();
 }
 /** The loading picture is startup only; actual dependencies and initial seated pose unlock the room. */
 private loadWorld():Promise<void>{
  const pending=this.startup.run(async attempt=>{
   this.loading=true;this.loadPhase='loading';this.loadProgress=0;this.error='';this.setStatus('正在准备海岛',false);
   if(this.loadingBackdrop)this.loadingBackdrop.active=true;if(this.loadingMask)this.loadingMask.active=true;
   try{
    const prefab=await loadRegionPrefab(REGIONS.island);attempt.check();
    this.setStatus('正在准备角色与动画',false);const character=await this.loadCharacter();attempt.check();
    this.model=prefab;this.characterPrefab=character;this.setStatus('正在准备房间',false);
    await this.mountWorld(attempt);attempt.check();
    this.loadPhase='ready';this.loadProgress=1;this.loading=false;this.error='';
    if(this.loadingBackdrop)this.loadingBackdrop.active=false;if(this.loadingMask)this.loadingMask.active=false;this.paintNavigation();this.resize();
   }catch(error){this.releaseStartupMount();throw error;}
  });
  return pending.catch(error=>{if(error instanceof StartupCancelled||!isValid(this.node,true))return;
   this.loading=false;this.loadPhase='error';this.loadProgress=0;this.error='世界加载失败，点这里重试';
   console.error('World startup failed',error);this.setStatus(this.error,true);
  });
 }
 private releaseStartupMount(){this.startupOwner?.destroy();this.startupOwner=null;this.startupGirl?.destroy();this.startupGirl=null;this.startupReference?.destroy();this.startupReference=null;this.characterAnimations=[];this.selectedSeatedClip='';this.composition=null!;this.ready=false;delete(globalThis as any).__worldIntegration;}
 private setStatus(text:string,retry:boolean){if(!this.status)return;this.status.string=text;const plate=this.status.node.parent!;plate.active=true;plate.off(Node.EventType.TOUCH_END,this.retryLoad,this);if(retry)plate.on(Node.EventType.TOUCH_END,this.retryLoad,this);}
 private retryLoad(){if(this.startup.snapshot().phase==='ready')return;this.status.node.parent!.off(Node.EventType.TOUCH_END,this.retryLoad,this);this.loadWorld();}
 /** E2 fix: the start scene no longer depends on the island GLB, so 'builtin-standard' may not be loaded yet at start().
  * Material creation by effect name is therefore deferred until the island prefab (and its effects) has loaded,
  * checks the effect is registered, falls back to builtin-unlit, and never blocks startup. */
 private loadCharacter(){return new Promise<Prefab>((ok,fail)=>{const b=assetManager.getBundle('region_island');if(!b)return fail(Error('Character bundle missing'));b.loadDir('character',Prefab,(e,list:Prefab[])=>{if(e||list.length!==1)return fail(e||Error('Expected one interim character prefab'));ok(list[0]);});});}
 private applyMarkerMaterial(){const r=this.markerRenderer;if(!r||!isValid(r.node,true))return;
  try{const pick=(n:string)=>EffectAsset.get(n)?n:null;const effect=pick('builtin-standard')||pick('builtin-unlit');
   if(!effect){console.warn('Reference marker: no builtin effect loaded, marker stays hidden');return;}
   const mat=new Material();mat.initialize({effectName:effect});const c=new Color('#b278bb');
   if(effect==='builtin-standard'){mat.setProperty('albedo',c);mat.setProperty('roughness',1);}else mat.setProperty('mainColor',c);
   r.setMaterial(mat,0);r.node.active=true;}catch(e){console.error('Reference marker material failed (non-fatal)',e);}
 }
 private async mountWorld(attempt:StartupAttempt){attempt.check();const scene=director.getScene()!;const reference=new Node('FLOW_REFERENCE_PLACEHOLDER_NOT_B');this.startupReference=reference;scene.addChild(reference);(this as any)._referenceAdapter=new FlowReferenceStandin(reference);
 if(!this.characterPrefab)throw Error('Required character prefab missing');
 const girl=instantiate(this.characterPrefab);this.startupGirl=girl;girl.name='B_PASS2G_CURSOR';reference.addChild(girl);girl.setScale(1,1,1);
 // The parent owns seatedRoot/seatYaw. The old standing-minus-seated child offset kept B standing.
 girl.setPosition(0,0,0);girl.setRotationFromEuler(0,0,0);
 const animations=girl.getComponentsInChildren(SkeletalAnimation);const seated=animations.filter(a=>a.clips.some(clip=>clip?.name===this.initialSeatedClip));
 if(!seated.length)throw Error('Required initial seated clip missing: '+this.initialSeatedClip);
 this.selectedSeatedClip=this.initialSeatedClip;this.characterAnimations=seated;
 for(const a of animations){a.playOnLoad=false;a.stop();}
 for(const a of seated){a.useBakedAnimation=true;const clip=a.clips.find(x=>x?.name===this.selectedSeatedClip)!;clip.wrapMode=AnimationClip.WrapMode.Loop;a.defaultClip=clip;a.play(clip.name);const state=a.getState(clip.name);if(!state)throw Error('Initial seated animation state unavailable');state.time=0;state.sample();}
 (this as any)._referenceAdapter.bindVisual(girl);
 const camera=scene.getComponentsInChildren(Camera)[0];if(!camera)throw Error('World camera missing');
 const owner=new Node('IsolatedWorldComposition');this.startupOwner=owner;scene.addChild(owner);const composition=owner.addComponent(WorldNativeComposition);this.composition=composition;composition.firstsliceModel=this.model;composition.worldCamera=camera;composition.smokeFixture=this.smokeFixture;
 await composition.initializeWorld();attempt.check();
 const bound=composition.attachCalibratedCharacter((this as any)._referenceAdapter);if(!bound.ok)throw Error(bound.reason);
 if(composition.worldCommands().snapshot().state!=='home')throw Error('Initial world is not at home');
 for(const a of seated){const state=a.getState(this.selectedSeatedClip);if(!state)throw Error('Initial seated state lost');state.time=0;state.sample();}
 this.ready=true;girl.active=true;this.error='';
 console.info('WORLD_STARTUP_READY',{initialClip:this.selectedSeatedClip,controllerRoot:REF.seatedRoot,childOffset:[0,0,0],scale:1,motionAcceptance:false});
 (globalThis as any).__worldIntegration={snapshot:()=>this.composition.worldCommands().snapshot(),hostResult:()=>this.composition.lastHostReply(),useTestFixture:(namespace:string,journeyNamespace:string)=>this.composition.useIsolatedTestProfile(namespace,journeyNamespace),board:()=>this.board()?.diagnostics()||null,layout:()=>this.navLayout(),select:(stageId:string,seed:number)=>this.select(stageId,seed),leave:()=>this.composition.worldCommands().leaveHome(),returnHome:()=>this.composition.worldCommands().returnHome(),hide:()=>game.emit(Game.EVENT_HIDE),show:()=>game.emit(Game.EVENT_SHOW),resume:()=>this.composition.worldCommands().resume(),lateEnd:(index:number)=>this.board()?.lateEnd(index),navigationStatus:()=>({error:this.error,text:this.status.string}),mainline:()=>this.composition.mainlineStatus(),mainlineStorage:()=>this.composition.mainlineStorage(),gates:()=>this.composition.challengeGates(),enterMainlineStage:(id:string,seed:number)=>this.composition.enterMainlineStage(id,seed),scope:'Mainline new-player isolated Cocos storage; R5 isolated Cocos localStorage v1.2; read-only real mainline schema v1/v2/v3; missing or protected journey keeps new stages locked. Verified pass2g SHA 05cfc06aba010924e606530f9fdf9716ac5e3743b41b84bf254d0d6902aaabe0; scale1; controller owns world movement; motion/contact acceptance requires runtime evidence.'};
 if(this.validationScenario==='skycity')this.scheduleOnce(()=>validateSkycity(this),3);
 }
 private board(){return director.getScene()?.getComponentsInChildren(ManagedMobileBoardUI).find(x=>x.node.isValid)||null;}
 private select(stageId:string,seed:number){const r=this.composition.selectProvider({provider:'r5',stageId,seed});return r.ok?this.composition.enterSelectedLevel():r;}
 private async invoke(fn:()=>any){if(this.busy||this.board()?.hostModalOpen()||this.islandJourney?.isOpen())return;this.busy=true;this.error='';try{const r=await fn();if(r&&!r.ok&&r.reason!=='cancelled')this.error=({ 'stage-locked':'先完成对应地区的主线，再开启挑战','finish-or-discard-current-attempt':'请先继续或结束当前挑战','completion-unsaved':'请先保存当前成绩','preserved-storage-error':'记录暂时无法安全读取，请保留并稍后重试' } as any)[r.reason]||r.reason;}catch(e){this.error=String(e);}finally{this.busy=false;this.paintNavigation();}}
 private createNavigation(){this.canvas=new Node('WorldNavigationCanvas');this.canvas.layer=Layers.Enum.UI_2D;this.node.addChild(this.canvas);this.canvas.addComponent(UITransform);const c=this.canvas.addComponent(Canvas);c.alignCanvasWithScreen=false;const cn=new Node('WorldNavigationCamera');this.node.addChild(cn);cn.setPosition(0,0,1000);const cam=cn.addComponent(Camera);cam.projection=Camera.ProjectionType.ORTHO;cam.near=.1;cam.far=2000;cam.priority=60;cam.visibility=Layers.Enum.UI_2D;cam.clearFlags=Camera.ClearFlag.DEPTH_ONLY;c.cameraComponent=cam;
 this.createLoadingBackdrop();this.notice=this.label('流程参考占位 · 非新版B',0,0,12,320);this.status=this.label('世界加载中',0,0,16,320);
 this.button('mainline','继续旅程  →',()=>this.composition.enterMainline());this.button('mainNext','主线下一关',()=>this.composition.advanceMainline());this.button('chest','打开本关宝箱',()=>this.composition.mainlineReward('openChest',this.board()?.hostPresentation().active.level));this.button('regionReward','领取主线地区奖励',()=>this.composition.mainlineReward('claimRegion',Math.floor(this.board()?.hostPresentation().active.level/4)));this.button('r4','原地区 · 潮汐',()=>this.composition.enterR4());this.button('leave','出门 · 选择地区',()=>this.composition.worldCommands().leaveHome());this.button('home','回主页',()=>this.composition.worldCommands().returnHome());this.button('tide','潮汐小径',()=>this.composition.enterRegion('tide'));this.button('meadow','花粉草甸',()=>this.composition.enterRegion('meadow'));this.button('sky','天空回声',()=>this.composition.enterRegion('sky'));this.button('skycity','天空城 · 看看',()=>this.composition.worldCommands().enterSkycity());this.button('returnIsland','返回小岛',()=>this.composition.worldCommands().exitSkycity());this.button('cancelVisit','取消前往',()=>this.composition.worldCommands().cancelTransition(),true);this.button('next','下一关',()=>this.composition.advanceRegistered());this.button('claim','领取地区印记',()=>this.composition.claimRegisteredMemento());this.button('resume','继续',()=>this.composition.worldCommands().resume());this.button('dayNight','晴昼',()=>this.composition.worldCommands().toggleDayNight());
 this.islandJourney=new IslandJourneyOverlay(this.canvas,{invoke:fn=>{void this.invoke(fn);},mainlineStatus:()=>this.composition.islandOverview(),gates:()=>this.composition.islandGates(),enterRegion:id=>this.composition.enterRegion(id),enterR4:()=>this.composition.enterR4(),enterSkycity:()=>this.composition.worldCommands().enterSkycity(),returnHome:()=>this.composition.worldCommands().returnHome(),toggleDayNight:()=>this.composition.worldCommands().toggleDayNight(),dayNight:()=>this.composition.worldCommands().dayNight()});
 this.roomExplore=new RoomExploreOverlay(this.canvas,()=>this.composition?.worldCommands()??null,()=>this.loadPhase==='ready'&&this.ready&&!this.busy&&!this.board()?.hostModalOpen(),()=>{void this.invoke(()=>this.composition.worldCommands().leaveHome());});}
 private createLoadingBackdrop(){const mask=new Node('LoadingOpaqueUntilWorldReady');mask.layer=Layers.Enum.UI_2D;this.canvas.addChild(mask);mask.addComponent(UITransform);mask.addComponent(Graphics);this.loadingMask=mask;const n=new Node('ApprovedLoadingReference_INTERNAL_TEST_ONLY');n.layer=Layers.Enum.UI_2D;this.canvas.addChild(n);n.addComponent(UITransform);this.loadingBackdrop=n;const sprite=n.addComponent(Sprite);sprite.sizeMode=Sprite.SizeMode.CUSTOM;
  assetManager.loadBundle('resources',(bundleError)=>{if(bundleError){console.error('Loading backdrop bundle failed',bundleError);return;}resources.load('ui/loading-reference',ImageAsset,(error,image)=>{if(!isValid(n,true))return;if(error){console.error('Loading backdrop image failed',error);return;}const texture=new Texture2D();texture.image=image;const frame=new SpriteFrame();frame.texture=texture;sprite.spriteFrame=frame;this.loadingImageSize={width:image.width,height:image.height};n.active=this.loadPhase!=='ready';this.resize();});});}
 private label(text:string,x:number,y:number,size:number,w:number){const n=new Node('LabelPlate');n.layer=Layers.Enum.UI_2D;this.canvas.addChild(n);n.setPosition(x,y,0);n.addComponent(UITransform).setContentSize(w,size+10);const bg=n.addComponent(Graphics);bg.fillColor=new Color('#123233');bg.roundRect(-w/2,-(size+10)/2,w,size+10,10);bg.fill();const t=new Node('VisibleLabel');t.layer=Layers.Enum.UI_2D;n.addChild(t);t.addComponent(UITransform).setContentSize(w,size+10);const l=t.addComponent(Label);l.string=text;l.fontSize=size;l.lineHeight=size+4;l.color=new Color('#fff2cf');l.horizontalAlign=Label.HorizontalAlign.CENTER;l.verticalAlign=Label.VerticalAlign.CENTER;return l;}
 private button(id:string,text:string,fn:()=>any,interrupt=false){const n=new Node(id);n.layer=Layers.Enum.UI_2D;this.canvas.addChild(n);n.addComponent(UITransform).setContentSize(240,46);const surface=warmButton(n,240,46);const l=this.label(text,0,0,17,230);const plate=l.node.parent!;plate.removeFromParent();plate.getComponent(Graphics)!.clear();n.addChild(plate);surface.addContent(plate);surface.bind(()=>{if(this.board()?.hostModalOpen()||this.islandJourney?.isOpen()||this.busy&&!interrupt)return false;if(interrupt){const r=fn();if(r&&!r.ok)this.error=r.reason;this.paintNavigation();return;}void this.invoke(fn);});this.controls.set(id,n);}
 private resize=()=>{if(!this.canvas)return;const f=typeof window!=='undefined'?{width:window.innerWidth,height:window.innerHeight}:view.getFrameSize();view.setDesignResolutionSize(f.width,f.height,ResolutionPolicy.EXACT_FIT);if(game.canvas)director.root?.resize(game.canvas.width,game.canvas.height);this.canvas.getComponent(UITransform)!.setContentSize(f.width,f.height);this.canvas.getComponent(Canvas)!.cameraComponent!.orthoHeight=f.height/2;this.notice.node.parent!.setPosition(0,-f.height/2+55,0);this.status.node.parent!.setPosition(0,this.loadPhase==='ready'?f.height/2-130:-f.height/2+172,0);if(this.loadingMask){this.loadingMask.getComponent(UITransform)!.setContentSize(f.width,f.height);const g=this.loadingMask.getComponent(Graphics)!;g.clear();g.fillColor=new Color('#123233');g.rect(-f.width/2,-f.height/2,f.width,f.height);g.fill();}if(this.loadingBackdrop){const a=this.loadingImageSize,k=Math.max(f.width/a.width,f.height/a.height);this.loadingBackdrop.getComponent(UITransform)!.setContentSize(a.width*k,a.height*k);}let i=0;for(const [k,n]of this.controls){n.setPosition(0,70-(i++)*56,0);}this.controls.get('leave')!.setPosition(0,-f.height/2+115,0);this.controls.get('resume')!.setPosition(0,-f.height/2+115,0);
 // T2: bake the FINAL island button size/skin while it is still hidden. Otherwise the first island frame resizes the
 // button, the WarmButtonSkin cache starts a new offscreen bake and the Graphics fallback surface shows until it lands.
 const islandNav=worldNavigationLayout(f.width,f.height);for(const id of ISLAND_NAV_IDS){const n=this.controls.get(id);if(n)this.placeNavigationControl(n,islandNav.buttons[id]);}
 };
 private navLayout(){const f=typeof window!=='undefined'?{width:window.innerWidth,height:window.innerHeight}:view.getFrameSize();return {width:f.width,height:f.height,room:this.roomExplore?.diagnostics()??null,targets:Object.fromEntries(Array.from(this.controls).filter(([_,n])=>n.active).map(([k,n])=>[k,{x:n.worldPosition.x+f.width/2,y:f.height/2-n.worldPosition.y}])),targetRects:Object.fromEntries(Array.from(this.controls).filter(([_,n])=>n.active).map(([k,n])=>{const t=n.getComponent(UITransform)!;return [k,{x:n.worldPosition.x+f.width/2-t.width/2,y:f.height/2-n.worldPosition.y-t.height/2,width:t.width,height:t.height}]})),managedBoards:director.getScene()?.getComponentsInChildren(ManagedMobileBoardUI).filter(x=>x.node.isValid).length||0};}
 /** Use the same safe-area result geometry as the board; never scale labels to fit. */
 private placeResultButtons(d:any,candidates=['mainNext','chest','regionReward']){const keys=candidates.filter(k=>this.controls.get(k)!.active);if(!keys.length)return;
  const layout=resultLayout(d,keys.length);keys.forEach((k,i)=>{const n=this.controls.get(k)!,r=layout.actions[i],t=n.getComponent(UITransform)!;if(t.width!==r.width||t.height!==r.height){t.setContentSize(r.width,r.height);n.getComponent(WarmButton)!.configure(r.width,r.height);for(const label of n.getComponentsInChildren(Label)){label.node.getComponent(UITransform)!.setContentSize(r.width-10,label.fontSize+10);label.node.parent!.getComponent(UITransform)!.setContentSize(r.width-10,label.fontSize+10);}}n.setScale(1,1,1);n.setPosition(r.x,r.y,0);});}
 private placeNavigationControl(n:Node,r:{x:number;y:number;width:number;height:number}){const t=n.getComponent(UITransform)!;
  if(t.width!==r.width||t.height!==r.height){t.setContentSize(r.width,r.height);n.getComponent(WarmButton)!.configure(r.width,r.height);for(const label of n.getComponentsInChildren(Label))if(label.node.name==='VisibleLabel'){label.fontSize=15;label.lineHeight=20;label.node.getComponent(UITransform)!.setContentSize(r.width-12,25);label.node.parent!.getComponent(UITransform)!.setContentSize(r.width-12,25);}
  if(n.name==='mainline')applyJourneyNavigationSkin(n,'primary',r.width,r.height);}
  n.setScale(1,1,1);n.setPosition(r.x,r.y,0);
 }
 /** T2/T3a: fires once per completed journey when the world camera is at its final stable pose with zero speed
  * (outbound/return ease-out finishes inside the last walk, before restore()). For debug logging (e.g. GGbot T0 GB_MARK)
  * and HUD sequencing. Returns an unsubscribe function. Release builds only call registered listeners; nothing is logged here. */
 onCameraSettled(fn:(place:'island'|'home')=>void){this.settledListeners.add(fn);return ()=>{this.settledListeners.delete(fn);};}
 /** Funning 2026-10-11: the top status plate is HIDDEN during outbound/return transitions and slides back in (position
  * animation, no opacity fade) once the character is still and operable. GGbot owns the HUD API.
  * TODO(GGbot): wire 'hide' -> statusHud.hide() and 'slideIn' -> statusHud.slideIn(). Intentionally a no-op here. */
 private hudTransition(_kind:'hide'|'slideIn',_place:string){}
 /** Call-site timing (see docs/camera/T2-T3a-DELIVERY.md): hide on 'standing' (leaveHome) / 'walking-home' (returnHome);
  * settled + slideIn on 'island' after crossing-out and on 'home' after sitting. */
 private trackTransitionHud(state:string){const prev=this.hudState;if(state===prev)return;this.hudState=state;
  if(state==='standing'||state==='walking-home')this.hudTransition('hide',state);
  const place=state==='island'&&prev==='crossing-out'?'island':state==='home'&&prev==='sitting'?'home':null;
  if(state==='island'&&prev==='crossing-out')this.islandEntrance=0;
  if(place){this.hudTransition('slideIn',place);for(const fn of Array.from(this.settledListeners)){try{fn(place);}catch(error){console.warn('onCameraSettled listener failed',String(error));}}}
 }
 /** T2: island buttons enter with a 0.25 s slide (24 px) + scale (0.94->1). Position/scale only: no opacity, so the
  * scene is never masked. Applied after placeNavigationControl, which rewrites the base pose every frame. */
 private applyIslandEntrance(dt:number,mainline:Node|null){if(this.islandEntrance<0)return;
  this.islandEntrance=Math.min(1,this.islandEntrance+Math.max(0,Math.min(dt,.1))/.25);const e=1-Math.pow(1-this.islandEntrance,3),k=.94+.06*e,dy=-24*(1-e);
  if(mainline?.active){const p=mainline.position;mainline.setPosition(p.x,p.y+dy,p.z);mainline.setScale(k,k,1);}
  const dock=this.canvas?.getChildByName('IslandJourneyOverlay')?.getChildByName('IslandUtilityDock');if(dock){dock.setPosition(0,dy,0);dock.setScale(k,k,1);}
  if(this.islandEntrance>=1)this.islandEntrance=-1;
 }
 private paintNavigation(dt=0){let s:any;try{s=this.composition.worldCommands().snapshot();}catch{return;}if(s.state==='home'&&!this.ready){const r=this.composition.attachCalibratedCharacter((this as any)._referenceAdapter);if(!r.ok){this.error=r.reason;return;}this.ready=true;}
 // 0007 v1.3 (GGbot): home camera is pose DATA now (world-r1/RegionCameraData.ts homePoseSource='oi-interim-standing', same -1.1,1.5,-2.4 -> .1,.86,-4.35, fov 55); only CameraPose.applyCameraPose writes the camera.
 const transitionText=({'standing':'正在起身…','turning-out':'正在转身…','walking-out':'正在走向门口…','opening-door':'正在开门…','crossing-out':'正在走向海岛…','walking-home':'正在回屋…','crossing-in':'正在进屋…','closing-door':'正在关门…','walking-to-seat':'正在走向椅子…','sitting':'正在坐下…','skycity-loading':'正在前往天空城…'} as any)[s.state];
 this.notice.node.parent!.active=false;this.status.node.parent!.active=!!this.error||!!transitionText;this.status.string=this.error||transitionText||(s.state==='skycity'?'天空城 · 轻点机器人或庭院':'');if(s.state==='skycity')this.status.node.parent!.active=true;
 const board=this.board(),b=board?.hostPresentation();const registered=s.state==='level'&&!s.needsResume&&b?.provider==='regional-r05'&&b.state==='result.saved'&&b.result?.completionRecorded;
 for(const [k,n]of this.controls)n.active=k==='cancelVisit'?!s.needsResume&&s.state==='skycity-loading':k==='returnIsland'?!s.needsResume&&s.state==='skycity':k==='resume'?s.needsResume:k==='mainNext'?!!(s.state==='level'&&b?.provider==='mainline-v33'&&b.state==='result.saved'&&b.result?.completionRecorded&&b.nextStageId):k==='chest'?!!(s.state==='level'&&b?.provider==='mainline-v33'&&b.state==='result.saved'&&b.result?.completionRecorded&&!b.readOnly&&b.journey.chests?.find((x:any)=>x.level===b.active.level)?.earned):k==='regionReward'?!!(s.state==='level'&&b?.provider==='mainline-v33'&&b.state==='result.saved'&&b.result?.completionRecorded&&!b.readOnly&&b.journey.regionRewards?.find((x:any)=>x.region===Math.floor(b.active.level/4))?.unlocked):k==='next'?!!(registered&&b.nextStageId):k==='claim'?!!(registered&&!b.nextStageId&&Object.keys(b.progress.records).filter(id=>id.startsWith('r05-'+b.active.region+'-')).length===4):!s.needsResume&&(k==='leave'?s.state==='home':k==='mainline'?s.state==='island':false);
 const f=this.navLayout(),navigation=worldNavigationLayout(f.width,f.height);this.islandJourney?.sync(f.width,f.height,s.state==='island'&&!s.needsResume&&!this.busy);if(this.islandJourney?.isOpen())this.controls.get('mainline')!.active=false;this.trackTransitionHud(s.state);if(s.state==='island')for(const id of ISLAND_NAV_IDS)this.placeNavigationControl(this.controls.get(id)!,navigation.buttons[id]);if(s.state==='island')this.applyIslandEntrance(dt,this.controls.get('mainline')??null);else if(this.islandEntrance>=0){this.islandEntrance=-1;const dock=this.canvas?.getChildByName('IslandJourneyOverlay')?.getChildByName('IslandUtilityDock');dock?.setPosition(0,0,0);dock?.setScale(1,1,1);}
 for(const id of ['returnIsland','cancelVisit'])if(this.controls.get(id)!.active)this.placeNavigationControl(this.controls.get(id)!,navigation.back);
 if(b?.provider==='mainline-v33'&&board){const region=b.journey.regionRewards?.find((x:any)=>x.region===Math.floor(b.active.level/4));this.controls.get('regionReward')!.getComponentsInChildren(Label)[0].string=region?.claimed?'地区工具已领取':'领取地区工具';const chest=b.journey.chests?.find((x:any)=>x.level===b.active.level);this.controls.get('chest')!.getComponentsInChildren(Label)[0].string=chest?.opened?'本关宝箱已领取':'打开本关宝箱';this.placeResultButtons(board.hostLayout());}
 if(registered&&board){this.placeResultButtons(board.hostLayout(),['next','claim']);const owned=b.progress.claimedRegions.includes(b.active.region);this.controls.get('claim')!.getComponentsInChildren(Label)[0].string=owned?'地区印记已领取':'领取地区印记';}
 const dn=this.controls.get('dayNight');if(dn){const view=this.composition.worldCommands().dayNight();dn.active=false; // Day/night belongs in the small settings panel, not the landscape.
dn.getComponentsInChildren(Label)[0].string=view.mode==='night'?'夜色':'晴昼';this.placeNavigationControl(dn,navigation.dayNight);}
 this.controls.get('leave')!.active=false;const roomFrame=this.navLayout();this.roomExplore?.sync(roomFrame.width,roomFrame.height);
 // Result actions live in a separate, higher-priority Canvas; the board modal cannot block them by sibling order.
 if(board?.hostModalOpen())for(const k of ['mainNext','chest','regionReward','next','claim'])this.controls.get(k)!.active=false;
 const adapter=(this as any)._referenceAdapter;if(s.state==='opening-door'){if(!this.doorReached){this.doorReached=true;adapter?.playDoorReach?.();}}else this.doorReached=false;

 }
 update(dt:number){if(this.loadPhase!=='ready'||!this.composition)return;this.paintNavigation(dt);}
 onDestroy(){this.islandJourney?.dispose();this.islandJourney=null;this.roomExplore?.dispose();this.roomExplore=null;this.startup.dispose();this.releaseStartupMount();delete (globalThis as any).__worldLoading;delete (globalThis as any).__regionDebug;view.off('canvas-resize',this.resize,this);if(typeof window!=='undefined')window.removeEventListener('resize',this.resize);delete(globalThis as any).__worldIntegration;}
}
