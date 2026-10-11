/** Shared test world: REAL WorldFlow + REAL FirstsliceRoutes + REAL RoomExploreOverlay + REAL IslandJourneyOverlay
 * (baseline, or T1 'after' when bundled with T1) + REAL T1 IslandHomeInteraction (T1 bundles) + a boot stand-in that copies
 * WorldIntegrationBoot's invoke/overlay wiring + a fake platform/engine touch pipeline fed through the REAL prelude. */
import {clock} from './setup';
import {director,input,js,game,Game,Node,UITransform} from 'cc';
import {WorldFlow} from '../../../creator-build-project/assets/scripts/world-r1/WorldFlowCore';
import type {CharacterAdapter,Action,Cancellation,StablePose,WorldLease} from '../../../creator-build-project/assets/scripts/world-r1/WorldFlowCore';
import {createFirstsliceRoutes} from '../../../creator-build-project/assets/scripts/world-r1/FirstsliceRoutes';
import {FIRSTSLICE} from '../../../creator-build-project/assets/scripts/world-r1/FirstsliceFacts';
import {CHARACTER_REFERENCE as REF} from '../../../creator-build-project/assets/scripts/world-r1/CharacterReference';
import {RoomExploreOverlay} from '../../../creator-build-project/assets/scripts/RoomExploreOverlay';
import {IslandJourneyOverlay} from '#overlay';
import * as T1 from '#home';
import {ManagedMobileBoardUI} from '#board';
import {readFileSync} from 'fs';
export const W=390,H=844,DPR=3;
export const env={door:process.env.GB_DOOR_VISIBLE||'visible',t1:process.env.GB_T1||'',cameraHook:!!process.env.GB_CAMERA_HOOK,prelude:process.env.GB_PRELUDE!=='0',combo:!!process.env.GB_COMBO,deadButton:process.env.GB_COMBO_BUTTON==='dead'};
/* ---- fake WeChat platform + REAL prelude + fake Cocos touch source registered AFTER the prelude (as the engine is) ---- */
const raw:Record<string,Function[]>={};const G:any=globalThis;
G.wx={getWindowInfo:()=>({windowWidth:W,windowHeight:H,safeArea:{left:0,right:W,top:47,bottom:H-34}}),getSystemInfoSync:()=>({windowWidth:W,windowHeight:H}),getMenuButtonBoundingClientRect:()=>({left:281,right:368,top:51,bottom:83}),
 onHide:(f:any)=>{G.__wxHide=f;},onShow:(f:any)=>{G.__wxShow=f;}};
for(const k of ['TouchStart','TouchMove','TouchEnd','TouchCancel']){raw[k]=[];G.wx['on'+k]=(f:Function)=>{raw[k].push(f);};G.wx['off'+k]=(f?:Function)=>{raw[k]=f?raw[k].filter(x=>x!==f):[];};}
if(env.prelude)(0,eval)(readFileSync(process.env.GB_PRELUDE_FILE!,'utf8'));
export const engine={claims:new Map<number,any>(),touches:new Map<number,{x:number;y:number}>(),buttonPresses:[] as string[],uiRoot:null as any};
const evt=(id:number,p:{x:number;y:number})=>{const all=[...engine.touches].map(([i,q])=>({getID:()=>i,getLocation:()=>({x:q.x*DPR,y:(H-q.y)*DPR}),getUILocation:()=>({x:q.x,y:H-q.y})}));
 return {getID:()=>id,getLocation:()=>({x:p.x*DPR,y:(H-p.y)*DPR}),getUILocation:()=>({x:p.x,y:H-p.y}),getAllTouches:()=>all,windowId:0};};
function walk(n:any,out:any[]){out.push(n);for(const c of n.children)walk(c,out);return out;}
function claimant(p:{x:number;y:number}){const nodes=walk(engine.uiRoot,[]).reverse();// topmost first (later siblings draw above)
 for(const n of nodes){if(!n.activeInHierarchy)continue;const t=n.getComponent({name:'UITransform'});if(!t)continue;
  if(n.__press){const wp=n.worldPosition,cx=wp.x+W/2,cy=H/2-wp.y;if(Math.abs(p.x-cx)<=t.width/2&&Math.abs(p.y-cy)<=t.height/2)return n;continue;}
  if((n.name==='IslandLighthouseTouch'||n.name==='RoomExploreSurface')&&(n._h['touch-start']||[]).length)return n;}
 return null;}
function source(kind:string){return (e:any)=>{for(const c of e.changedTouches){const id=c.identifier,p={x:c.clientX,y:c.clientY};
  if(kind==='start'||kind==='move')engine.touches.set(id,p);else engine.touches.delete(id);(input as any)._count=engine.touches.size;
  const ev=evt(id,p);let n=kind==='start'?claimant(p):engine.claims.get(id);if(kind==='start'&&n)engine.claims.set(id,n);if(kind==='end'||kind==='cancel')engine.claims.delete(id);
  if(n){if(n.__press){if(kind==='end'){const wp=n.worldPosition,t=n.getComponent({name:'UITransform'});if(Math.abs(p.x-(wp.x+W/2))<=t.width/2&&Math.abs(p.y-(H/2-wp.y))<=t.height/2){engine.buttonPresses.push(n.name);n.__press();}}}
   else n.emit('touch-'+kind,ev);}
  else (input as any).emit('touch-'+kind,ev);}};}
G.wx.onTouchStart(source('start'));G.wx.onTouchMove(source('move'));G.wx.onTouchEnd(source('end'));G.wx.onTouchCancel(source('cancel'));
/* ---- world ---- */
type Timer={at:number;resolve:()=>void};const timers:Timer[]=[];
const after=(s:number,t:Cancellation)=>new Promise<void>((resolve,reject)=>{const tm={at:clock.ms+s*1000,resolve};timers.push(tm);t.onCancel(()=>{const i=timers.indexOf(tm);if(i>=0)timers.splice(i,1);reject(new Error('cancelled'));});});
const cam={node:{worldPosition:{x:0,y:1.5,z:-2},worldRotation:{x:0,y:0,z:0,w:1}}};
const moveCam=(s:number,t:Cancellation)=>{const end=clock.ms+s*1000;const step=()=>{if(clock.ms<end&&!t.cancelled){cam.node.worldPosition={x:Math.random(),y:1.5,z:-2};setImmediate(step);}};step();return after(s,t);};
const lease:WorldLease={setLayers(){},setDoor(){},setCamera(){},animateDoor:(_a,_b,s,t)=>after(s,t),animateCamera:(_p,s,t)=>moveCam(s,t),cancelTransient(){},assertStaticWorld(){},dispose(){}};
class Char implements CharacterAdapter{readonly calibrated=true;readonly coordinates={units:'m' as const,up:'+Y' as const,forward:'+Z' as const,rootMotion:'controller-only' as const,standingRoot:REF.standingRoot as any,seatedRoot:REF.seatedRoot as any,seatYawRad:REF.seatYawRad,clearanceRadiusM:.15};
 job:{left:number;resolve:()=>void}|null=null;actions:string[]=[];
 advance(dt:number){if(!this.job)return;this.job.left-=dt;if(this.job.left<=0){const j=this.job;this.job=null;j.resolve();}}
 perform(a:Action,t:Cancellation){t.check();if(this.job)return Promise.reject(Error('busy'));this.actions.push(a.kind);const d=a.kind==='stand'?2.0:a.kind==='sit'?2.2:a.kind==='walk'?a.duration:1.5;return new Promise<void>((resolve,reject)=>{this.job={left:d,resolve};t.onCancel(()=>{this.job=null;reject(new Error('cancelled'));});});}
 cancelAndReset(_:StablePose){this.job=null;} setVisible(){} dispose(){}}
export const char=new Char();export const states:string[]=[];
export const config=createFirstsliceRoutes(FIRSTSLICE,REF as any);
export const flow=new WorldFlow({config,mode:'motion',character:char,levels:{enter:()=>env.combo?Promise.resolve(openBoard()):Promise.reject(Error('n/a'))},loadWorld:async()=>lease,onChange:s=>{states.push(s.state);if(s.state==='crossing-out')craneListeners.forEach(l=>queueMicrotask(()=>l({segment:'toIsland',progress:0.4})));settleListeners.forEach(l=>{if(s.state==='island'||s.state==='home')queueMicrotask(()=>l(s.state,{reason:'test-hook'}));});}});
const settleListeners:((p:string,i?:any)=>void)[]=[];
export const calls={leave:0,ret:0,look:0,mainline:0};
/** combo: a level = a ManagedMobileBoardUI stand-in in the scene (7x7 cells under a board frame at boardCenter), intro modal for 1.5 s. */
/** Real Cocos layout: WorldIntegrationBoot is a component ON the Scene node; getComponentInChildren does NOT look at the node itself
 *  (Cocos semantics), so a children-only lookup finds nothing. GB_BOOT_ON=child puts it on a child instead (both must work). */
const bootOnChild=process.env.GB_BOOT_ON==='child';
export const scene:any=new Node('Scene');{const own=scene.getComponent.bind(scene);scene.getComponent=(n:any)=>n==='WorldIntegrationBoot'?(bootOnChild?null:boot):own(n);
 scene.getComponentInChildren=(n:string)=>n==='WorldIntegrationBoot'&&bootOnChild?boot:null;}
export let board:any=null;
function openBoard(){const n=new Node('ManagedBoard');scene.addChild(n);const b:any=n.addComponent(ManagedMobileBoardUI as any);const root=new Node('NativeBoardCanvas');n.addChild(root);root.addComponent(UITransform).setContentSize(W,H);
 const frame=new Node('IslandBoardCarving');root.addChild(frame);frame.setPosition(0,60);const cells:any[]=[];for(let i=0;i<49;i++){const c=new Node('cell'+i);frame.addChild(c);c.setPosition((i%7-3)*48,(3-Math.floor(i/7))*48);cells.push(c);}
 b.root=root;b.cells=cells;b.layoutInfo={width:W,height:H,safe:{top:47,bottom:34,left:0,right:0},boardCenter:{x:0,y:60}};b.modal=true;b.snapshot={state:'run.intro'};board=b;
 const at=clock.ms+1500;const ready=()=>{if(clock.ms<at){setImmediate(ready);return;}b.modal=false;b.snapshot={state:'run.ready',active:{board:cells.map((_:any,i:number)=>({id:'tile'+i,type:i%5,special:null}))}};};ready();
 return {requestExit:()=>({ok:true}),hide(){},showPaused(){},resume:()=>({ok:true}),dispose(){n.destroy();board=null;}};}let lookYaw=0;
const inBox=(x:number,y:number)=>{const cx=x/DPR,cy=H-y/DPR;return cx>=150&&cx<=240&&cy>=250&&cy<=420;};
const commands:any={snapshot:()=>flow.snapshot(),leaveHome:()=>{calls.leave++;return flow.leaveHome();},returnHome:()=>{calls.ret++;return flow.returnHome();},
 roomView:(_:number)=>{const s=flow.snapshot();const vis=env.door==='visible'||(env.door==='reveal-by-drag'&&lookYaw<=-0.12);return {enabled:s.state==='home'&&!s.hidden&&!s.needsResume&&s.characterReady,settling:false,door:{visible:vis,x:.62,y:.48,direction:1}};},
 lookRoom:(dx:number,_dy:number)=>{calls.look++;lookYaw+=dx;return true;},dayNight:()=>({mode:'day'}),toggleDayNight:()=>({ok:true})};
if(env.t1)commands.hitLighthouse=(x:number,y:number)=>flow.snapshot().state==='island'&&inBox(x,y);
const worldComp:any={flow};if(env.cameraHook){worldComp.onCameraSettled=(l:any)=>{settleListeners.push(l);return ()=>{};};worldComp.onCraneStart=(l:any)=>{craneListeners.push(l);return ()=>{};};}
export const craneListeners:any[]=[];
/** Copy of the WorldIntegrationBoot pieces autoplay touches (invoke + overlay wiring + paintNavigation sync), T1 wiring when bundled with T1. */
class BootStandIn{loadPhase='loading';ready=false;busy=false;error='';isValid=true;composition={worldCommands:()=>commands,world:worldComp,worldCamera:cam,enterMainline:()=>{calls.mainline++;return flow.enterLevel('mainline-01');}};mainline:any=null;roomExplore:any;islandJourney:any;islandHome:any=null;canvas:any=new Node('WorldNavigationCanvas');
 constructor(){engine.uiRoot=this.canvas;
  this.islandJourney=new IslandJourneyOverlay(this.canvas as any,{invoke:(fn:any)=>{void this.invoke(fn);},mainlineStatus:()=>null,gates:()=>null,enterRegion:()=>null,enterR4:()=>null,enterSkycity:()=>null,returnHome:()=>this.composition.worldCommands().returnHome(),toggleDayNight:()=>this.composition.worldCommands().toggleDayNight(),dayNight:()=>this.composition.worldCommands().dayNight()} as any);
  this.roomExplore=new RoomExploreOverlay(this.canvas as any,()=>this.composition?.worldCommands()??null as any,()=>this.loadPhase==='ready'&&this.ready&&!this.busy&&!this.board()?.hostModalOpen(),()=>{void this.invoke(()=>this.composition.worldCommands().leaveHome());});
  if(env.combo){const n:any=new Node('mainline');this.canvas.addChild(n);n.addComponent(UITransform).setContentSize(240,46);n.setPosition(0,-300);n.active=false;n.__press=env.deadButton?()=>{}:()=>{void this.invoke(()=>this.composition.enterMainline());};this.mainline=n;}
  if(env.t1&&(T1 as any).IslandHomeInteraction)this.islandHome=new (T1 as any).IslandHomeInteraction(this.canvas,{canUse:()=>this.loadPhase==='ready'&&this.ready&&!this.busy&&!this.error&&!this.islandJourney?.isOpen(),hit:(x:number,y:number)=>this.composition.worldCommands().hitLighthouse(x,y),returnHome:()=>this.invoke(()=>this.composition.worldCommands().returnHome())});}
 board():any{return board&&board.node.isValid?board:null;} navLayout(){return {width:W,height:H};}
 async invoke(fn:()=>any){if(this.busy||this.board()?.hostModalOpen()||this.islandJourney?.isOpen())return;this.busy=true;this.error='';try{const r=await fn();if(r&&!r.ok&&r.reason!=='cancelled')this.error=r.reason;}catch(e){this.error=String(e);}finally{this.busy=false;}}
 update(){if(this.loadPhase!=='ready')return;const s=flow.snapshot();this.islandJourney.sync(W,H,s.state==='island'&&!s.needsResume&&!this.busy);this.islandHome?.sync(W,H,s.state==='island'&&!s.hidden&&!s.needsResume&&!this.busy&&!this.error&&!this.islandJourney?.isOpen());this.roomExplore.sync(W,H);if(this.mainline)this.mainline.active=s.state==='island'&&!s.needsResume&&!this.islandJourney.isOpen();}}
export const boot=new BootStandIn();
/** Test-only inert HUD button (claims the touch like a UI button, opens nothing) for the l123-vs-l12 negative control. */
if(process.env.GB_INERT_BUTTON){const n:any=new Node('GB_TEST_INERT_BUTTON');boot.canvas.addChild(n);n.addComponent(UITransform).setContentSize(64,64);n.setPosition(120,-200);n.__press=()=>{};
 (globalThis as any).GROKBOT_TOUCH_SCENARIOS=JSON.stringify([{name:'neg-same-frame-inert',expect:'stay',expectAlt:{variant:'l12',expect:'return'},needs:['lighthouse'],steps:[{at:0,finger:1,phase:'start',target:'lighthouse'},{at:200,finger:2,phase:'start',target:'hud',name:'GB_TEST_INERT_BUTTON'},{at:200,finger:2,phase:'end'},{at:600,finger:1,phase:'end'}]}]);}
(director as any).scene=scene;
/** Fake GameAudio with the real method names/semantics the observer wraps. */
export class FakeGameAudio{static instance:FakeGameAudio|null=null;cascade=0;muted=false;reasons=new Set();musicVolume=0.4;sfxVoices=new Map<any,any>();
 loopSource:any={playing:false,currentTime:0,duration:48,volume:0.4,loop:true,clip:{name:'bgm_main',duration:48}};musicPath='audio_bgm/bgm_main';played:string[]=[];
 play(n:string,v=1){this.played.push(n);if(this.muted)return;const src={volume:v,loop:false,clip:{name:n,duration:0.8},duration:0.8};this.sfxVoices.set(src,{source:src,name:n});}
 setMusicVolume(v:number){this.musicVolume=v;this.loopSource.volume=v;} setMuted(m:boolean){this.muted=m;} onBoardFrame(v:any){if(v?.kind==='action'){this.cascade=0;return;}if(v?.kind==='clear'){this.cascade++;this.play(this.cascade<=1?'sfx_match_normal':this.cascade===2?'sfx_combo_1':this.cascade===3?'sfx_combo_2':'sfx_combo_3');}}
 onRender(state:string,won:boolean){if(state.startsWith('result.')&&won)this.play('sfx_level_clear');} onChestResult(r:any){if(r?.newlyGrantedRewards?.length>0)this.play('sfx_chest_open');} onClaimResult(r:any){if(r?.ok&&!r.duplicate)this.play('sfx_chest_open');} setMusic(p:string){this.musicPath=p;}}
/** Stand-in for T6 CheerTextHost: show() returns the same result shape as the real one. */
export class FakeCheerTextHost{active=-1;show(level:number,visual?:any){const d=level>this.active?(this.active<0?'show':'replace'):'skip';const rep=d==='replace'?this.active:-1;if(d!=='skip')this.active=level;const c=visual?.wave?.removed?.length?'clear':'center';return {tier:level,word:['Great!','Excellent!','Amazing!','Unbelievable!'][level],decision:d,source:c,x:c==='clear'?-96:0,y:c==='clear'?84:-60,replaced:rep};}}
if(!env.combo){if(!process.env.GB_NO_T6)(js as any)._register('CheerTextHost',FakeCheerTextHost);
(js as any)._register('GameAudio',FakeGameAudio);FakeGameAudio.instance=new FakeGameAudio();}
const flush=async()=>{for(let i=0;i<6;i++)await new Promise(r=>setImmediate(r));};
let started=false,frames=0;
export async function run(maxS:number,stop:()=>boolean,onFrame?:(f:number)=>void){
 if(!started){started=true;await import('../src/GrokbotAutoplay');const r=await flow.load();if(!r.ok)throw Error('load '+JSON.stringify(r));}
 const dt=1/60;const cold=Math.round(9/dt),end=frames+60*maxS;
 while(frames<end){frames++;clock.ms+=dt*1000;if(frames===cold){boot.loadPhase='ready';boot.ready=true;}
  flow.advance(dt);for(const t of [...timers])if(t.at<=clock.ms){timers.splice(timers.indexOf(t),1);t.resolve();}
  await flush();boot.update();onFrame?.(frames);(director as any)._frame();await flush();if(stop())break;}
}
export const marks=()=>((globalThis as any).__testLogs as string[]).filter(l=>l.startsWith('GB_MARK'));
export const names=()=>marks().map(l=>l.split(' ')[1]);
export {game,Game};
