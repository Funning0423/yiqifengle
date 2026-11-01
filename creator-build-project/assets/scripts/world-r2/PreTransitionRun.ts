import { Node } from 'cc';
import { qaSkipAllowed } from './QaSkip';
/*QF_TRIAL_BEGIN*/
/** Test-only `__qfPreTransition(key)` runtime (see PreTransitionKeys). Registered by the boot ONLY behind preTransitionEnabled()
 *  (same host gate as __qfTeleport; WeChat release never). Setup goes through the real commands and an isolated test profile;
 *  the transition itself is never started here — the tester (or autoplay) touches the returned trigger. */
import {armSkycityWarmOnSailRide} from '../region/TransitionPreload';
import {prewarmLakesideAssets} from '../region/LakesideBoardBackground';
import {LAKESIDE_L12_HOLD_MS} from '../region/TransitionPreload';
import { director, Director, game, UITransform, Canvas, Vec3 } from 'cc';
/*QF_PROBE_BEGIN*/import { seedSkyChallengeWins, finishPausedMainlineWin } from './RegionFlowTest';/*QF_PROBE_END*/
import { warmJourneyUi } from '../ui/JourneyUi';
import { setLastRegion } from '../ui/UiPrefs';
/*QF_PROBE_BEGIN*/import { QF_DEVICE_PREVIEW } from './PreTransitionKeys';/*QF_PROBE_END*/
import { PRE_SPECS, PRE_UNSUPPORTED, preSpec, preTransitionEnabled, preTransitionKey, preKeySource, canvasLocalToScreen, type PreSpec, type PreTap } from './PreTransitionKeys';
type R={ok:boolean;reason?:string;[k:string]:any};
const sleep=(ms:number)=>new Promise<void>(r=>setTimeout(r,ms));
async function waitFor(pred:()=>any,ms:number,step=100):Promise<boolean>{const t=Date.now();while(Date.now()-t<ms){try{if(pred())return true;}catch{}await sleep(step);}return false;}
const PANEL_FRAMES=120;/* rendered frames the host gets to enable the overlay / build the panel once its bundle is in */
async function waitFrames(pred:()=>any,frames:number):Promise<boolean>{const f0=director.getTotalFrames();for(;;){try{if(pred())return true;}catch{}if(director.getTotalFrames()-f0>=frames)return false;await new Promise<void>(r=>director.once(Director.EVENT_AFTER_DRAW,()=>r()));}}
function find(root:any,name:string):Node|null{if(!root)return null;for(const c of root.children||[]){if(c.name===name&&c.activeInHierarchy)return c;const h=find(c,name);if(h)return h;}return null;}
function findPath(path:string[]):Node|null{let n:any=director.getScene();for(const p of path){n=find(n,p);if(!n)return null;}return n;}
function nodePoint(n:Node,frame:{width:number;height:number}){
 let c:any=n;while(c&&!c.getComponent?.(Canvas))c=c.parent;const ct=c?.getComponent?.(UITransform);if(!ct)return null;
 const wp=n.getComponent(UITransform)?.convertToWorldSpaceAR(new Vec3())??n.worldPosition,lp=ct.convertToNodeSpaceAR(wp);
 const p=canvasLocalToScreen(lp.x,lp.y,ct.contentSize.width,ct.contentSize.height);
 return {x:Math.round(p.x*frame.width/Math.max(1,ct.contentSize.width)),y:Math.round(p.y*frame.height/Math.max(1,ct.contentSize.height))};
}
/** cocos getLocation space (canvas px, y up) -> top-left CSS px */
function locToCss(x:number,y:number,frame:{width:number;height:number}){const cw=game.canvas?.width||frame.width,ch=game.canvas?.height||frame.height;return {x:Math.round(x*frame.width/cw),y:Math.round(frame.height-y*frame.height/ch)};}
export class PreTransitionRunner{
 private last:{spec:PreSpec}|null=null;private running=false;
 constructor(private d:PreDeps){}
 private wc(){return this.d.composition.worldCommands();}
 private st(){return this.wc().snapshot();}
 private async settle(state:string|string[],ms=180000){const want=Array.isArray(state)?state:[state];return waitFor(()=>{const s=this.st();return want.includes(s.state)&&!s.needsResume&&this.d.idle();},ms);}
 private async step(fn:()=>any,state:string|string[],what:string,ms=180000):Promise<R>{
  const r=await this.d.call(fn);if(r&&r.ok===false)return {ok:false,reason:what+': '+r.reason};
  return await this.settle(state,ms)?{ok:true}:{ok:false,reason:what+': timeout (state '+this.st().state+')'};
 }
 /** Back to a clean room or island through the normal commands (level exit / skycity exit / 主页 / 出门). */
 private async toPlace(place:'home'|'island'):Promise<R>{
  let s=this.st();
  if(s.state==='level'){const b=this.d.board();try{(b as any)?.popups?.clear?.();}catch{}const e=this.wc().exitLevel();if(!e.ok)return {ok:false,reason:'exit-level: '+e.reason};await this.settle(['island','meadow','skycity','lakeside']);s=this.st();}
  if(s.state==='skycity'&&s.journey?.region!=='skycity'){const e=this.wc().exitSkycity();if(!e.ok)return {ok:false,reason:'exit-skycity: '+e.reason};await this.settle('island');s=this.st();}
  const away=s.journey?.region&&s.journey.region!=='island';
  if(place==='home'||away){if(s.state!=='home'){const r=await this.step(()=>this.wc().returnHome(),'home','return-home');if(!r.ok)return r;}}
  if(place==='island'&&this.st().state!=='island'){const r=await this.step(()=>this.wc().leaveHome(),'island','leave-home');if(!r.ok)return r;}
  return {ok:true};
 }
 /** Open a journal page the way the player's tap does, waiting on the REAL signals instead of a wall-clock guess:
  *  (1) the journey_ui bundle has loaded (warmJourneyUi promise), (2) the host has enabled the overlay for an island frame
  *  (IslandJourneyOverlay.ready(); open() is a silent no-op before that — the old hook called it right after leave-home and
  *  then polled 5 s for a panel that was never requested), (3) the overlay reports the page on screen (shownPage(), set in
  *  the callback that builds the panel). Bounded by rendered frames, not ms, so a slow renderer only makes it slower. */
 private async openPanel(page:string,path:string[]):Promise<R>{
  const j=this.d.islandJourney();if(!j)return {ok:false,reason:'no-journal-overlay'};
  if(!await warmJourneyUi())return {ok:false,reason:'journey-ui-load-failed'};
  if(!await waitFrames(()=>j.ready()&&!j.isOpen(),PANEL_FRAMES))return {ok:false,reason:'journal-overlay-not-ready (state '+this.st().state+')'};
  /*QF_PROBE_BEGIN*/if(QF_DEVICE_PREVIEW&&page!=='journal'&&typeof (j as any).previewChapterViaJournal==='function'){if(!j.openPage('journal'))return {ok:false,reason:'journal-open-refused'};if(!await waitFrames(()=>j.shownPage()==='journal'&&findPath(['JourneyPanel']),PANEL_FRAMES))return {ok:false,reason:'journal-not-open'};if(!(j as any).previewChapterViaJournal(page))return {ok:false,reason:'preview-chapter-refused'};}else/*QF_PROBE_END*/
  if(!j.openPage(page))return {ok:false,reason:'journal-open-refused'};
  if(!await waitFrames(()=>j.shownPage()===page&&findPath(path),PANEL_FRAMES))return {ok:false,reason:'chapter-panel-not-open (shown '+j.shownPage()+')'};
  return {ok:true};
 }
 private boardSnap(){const b:any=this.d.board();return b?.snapshot||null;}
 private async toResult(spec:PreSpec,last:any,seed:number):Promise<R>{
  const r=await this.step(()=>this.d.composition.enterMainlineStage(spec.stage,seed),'level','enter '+spec.stage,240000);if(!r.ok)return r;
  return this.swapToResult(spec,last);
 }
 /** Board already entered: resume if restored paused, then the player's own swap of the recorded last move; wait for the panel. */
 private async swapToResult(spec:PreSpec,last:any):Promise<R>{
  if(!await waitFor(()=>{const s=this.boardSnap();return s&&(s.state==='run.ready'||s.state==='run.paused')&&(this.d.board() as any)?.presented;},30000))return {ok:false,reason:'board-not-ready'};
  const b:any=this.d.board();
  if(this.boardSnap().state==='run.paused'){try{b.popups?.close?.('PausePanel');}catch{}b.host.command('resume');await waitFor(()=>this.boardSnap()?.state==='run.ready',5000);}
  if(!Array.isArray(last)||last[0]!=='swap')return {ok:false,reason:'no-witness-move'};
  await waitFor(()=>!b.modalOpen?.(),5000);
  b.swap(last[1],last[2]);/* the player's own swap path (ManagedMobileBoardUI.swap -> previewAction/commitAction) */
  const name=spec.taps[0].kind==='node'?(spec.taps[0] as any).path:null;
  if(!await waitFor(()=>this.boardSnap()?.state==='result.saved'&&(!name||findPath(name)),30000))return {ok:false,reason:'result-panel-timeout ('+this.boardSnap()?.state+')'};
  return {ok:true};
 }
 private async setup(spec:PreSpec):Promise<R>{
  const sched=director.getScheduler(),fast=(on:boolean)=>{try{sched.setTimeScale(on?this.scale:1);}catch{}};
  try{
   fast(true);
   if(spec.place==='home')return await this.toPlace('home');
   if(!['island','result','skycity-visit'].includes(spec.place))(this.d.composition as any).warmMeadowIfIsland?.('pre',true)/* P0 wipe */;
   let r=await this.toPlace('island');if(!r.ok)return r;
   let prof:any=null;
   if(spec.checkpoint!==null){prof=this.d.composition.preTransitionProfile(spec.checkpoint,spec.finish,spec.place==='lake-result'?{stageId:spec.stage,mode:spec.lakeMode||'win'}:undefined);if(!prof.ok)return prof;}
   if(spec.place==='island'){
    /*QF_PROBE_BEGIN*/if(spec.justWon){try{finishPausedMainlineWin((this.d.composition as any).testProfile,prof?.lastAction,{allowQa:true});}catch(e){return {ok:false,reason:'just-won: '+String((e as Error).message||e)};}}
    if(spec.skyChallenges!=null||spec.skyPage){try{if(spec.skyChallenges!=null)seedSkyChallengeWins((this.d.composition as any).testProfile,spec.skyChallenges,{allowQa:true});}catch(e){return {ok:false,reason:'sky-seed: '+String((e as Error).message||e)};}if(spec.focusSky){setLastRegion('sky');/* what entering 天空之城 from its page writes: focusRegion() prefers the last played region */return await this.openPanel('journal',['JourneyPanel','Focus-sky']);}return await this.openPanel('sky',['ChapterPanel','Continue-sky']);}/*QF_PROBE_END*/
    if(spec.key==='skycity-visit')return await this.openPanel('sky',['ChapterPanel','VisitSkycity']);
    return {ok:true};
   }
   if(spec.place==='result')return await this.toResult(spec,prof?.lastAction,prof?.seed);
   if(spec.place==='skycity-visit')return await this.step(()=>this.wc().enterSkycity(),'skycity','enter-skycity');
   armSkycityWarmOnSailRide();/* full9c: the skycity leg follows the sail directly */
   r=await this.step(()=>this.wc().travelRegion('meadow'),'meadow','travel meadow',240000);if(!r.ok)return r;
   r=await this.step(()=>this.wc().travelRegion('skycity'),'skycity','travel skycity',240000);if(!r.ok)return r;
   if(spec.place==='skycity'){
    /* full7 option (a): the skycity→lakeside key starts where a player who finished L12 stands (S6, the finale terrace; the
     * counted leg starts there). Lakeside assets are warmed as on the real checkpoint-12 path. */
    if(spec.key==='skycity-lakeside'){try{void prewarmLakesideAssets(LAKESIDE_L12_HOLD_MS);}catch{}const tp=(globalThis as any).__qfTeleport;if(typeof tp!=='function')return {ok:false,reason:'no-teleport-hook (S6)'};try{tp('S6');}catch(e){return {ok:false,reason:'teleport-S6: '+String(e)};}}
    return r;}
   r=await this.step(()=>this.d.composition.enterMainline(),'level','enter lakeside',300000);if(!r.ok)return r;
   if(spec.place==='lake-result'){const id=this.boardSnap()?.active?.stageId;if(id&&id!==spec.stage)return {ok:false,reason:'lake-stage-mismatch ('+id+')'};return await this.swapToResult(spec,prof?.lastAction);}
   if(!await waitFor(()=>this.boardSnap()?.state==='run.ready'&&(this.d.board() as any)?.presented,30000))return {ok:false,reason:'lake-board-not-ready'};
   if(spec.place==='lake-board')return {ok:true};
   const b:any=this.d.board();return await this.step(()=>b.command('requestExit'),'lakeside','leave lake board');
  }finally{fast(false);}
 }
 private scale=3;
 private tapInfo(t:PreTap){
  const f=this.d.frame();
  if(t.kind==='node'){const n=findPath(t.path);return {kind:'node',node:t.path.join('/'),point:n?nodePoint(n,f):null,note:t.path[0]==='PausePanel'?'先点上一个触发点后才出现':undefined};}
  if(t.kind==='control'){
   if(t.id==='mainline'){const r=this.d.signRect();if(r&&this.st().state==='island')return {kind:'signpost-3d',node:'IslandProps signpost',point:canvasLocalToScreen(r.x,r.y,f.width,f.height)};}
   const n=this.d.control(t.id);return {kind:'control',node:'WorldNavigationCanvas/'+t.id,point:n&&n.activeInHierarchy?nodePoint(n,f):null};
  }
  if(t.kind==='glass-sign'){const g=this.d.glassSign?.()?.diagnostics?.(),b=g?.box;if(b)return {kind:'glass-sign',node:'GlassSign',point:locToCss((b.l+b.r)/2,(b.t+b.b)/2,f)};
   const h=this.d.roomExplore?.()?.diagnostics?.()?.handle;return {kind:'door-handle',node:'RoomExploreOverlay handle',point:h&&h.visible?{x:Math.round(h.x),y:Math.round(f.height-h.y)}:null};}
  const cw=game.canvas?.width||f.width,ch=game.canvas?.height||f.height;
  for(let gy=.2;gy<=.8;gy+=.025)for(let gx=.1;gx<=.9;gx+=.025){const x=cw*gx,y=ch*gy;try{if(this.wc().hitLighthouse(x,y))return {kind:'lighthouse',node:'island lighthouse (ray hit)',point:locToCss(x,y,f),cocosLocation:{x:Math.round(x),y:Math.round(y)}};}catch{}}
  return {kind:'lighthouse',node:'island lighthouse',point:null};
 }
 async run(key:string,opts?:{setupTimeScale?:number}):Promise<R>{
  if(key==='enable'){if(!qaSkipAllowed())return {ok:false,reason:'pre-transition-disabled'};(globalThis as any).__qfHooksEnable=true;return {ok:true,enabled:true,note:'__qfTeleport 在场景 attach 时注册；需要它时请在启动后尽早 enable'};}
  if(!preTransitionEnabled())return {ok:false,reason:'pre-transition-disabled',hint:"call __qfPreTransition('enable') first (test builds only)"};
  if(key==='list')return {ok:true,keys:PRE_SPECS.map(s=>({key:s.key,label:s.label,trigger:s.trigger,expect:s.expect})),unsupported:PRE_UNSUPPORTED};
  if(key==='tap')return this.tap();
  const spec=preSpec(key);if(!spec)return {ok:false,reason:'unknown-key',keys:PRE_SPECS.map(s=>s.key)};
  if(this.running)return {ok:false,reason:'pre-transition-running'};
  this.running=true;this.scale=Math.max(1,Math.min(6,Number(opts?.setupTimeScale)||3));
  try{
   const r=await this.setup(spec);if(!r.ok)return {...r,key};
   await sleep(300);this.last={spec};
   const taps=spec.taps.map(t=>this.tapInfo(t));
   const out={ok:true,key,label:spec.label,trigger:spec.trigger,expect:spec.expect,state:this.st().state,tap:taps[0],taps,frame:this.d.frame()};
   try{console.info('[QF_PRE] ready '+JSON.stringify(out));}catch{}
   return out;
  }finally{this.running=false;}
 }
 /** Fallback for hosts without touch injection: run the trigger's OWN handler (3D/hit-test triggers only). */
 tap():R{
  const s=this.last?.spec;if(!s)return {ok:false,reason:'no-pre-transition'};const t=s.taps[0];
  if(t.kind==='glass-sign'){this.d.leave();return {ok:true,via:'RoomExplore leave (same as the door/sign tap)'};}
  if(t.kind==='lighthouse'){this.d.returnHome();return {ok:true,via:'IslandHomeInteraction returnHome'};}
  if(t.kind==='control'&&t.id==='mainline'){this.d.enterMainline();return {ok:true,via:'继续旅程 handler'};}
  return {ok:false,reason:'tap-the-node',node:t.kind==='node'?t.path.join('/'):(t as any).id};
 }
}
/*QF_TRIAL_END*/
export type PreDeps={
 composition:any;board:()=>any;control:(id:string)=>Node|undefined;call:(fn:()=>any)=>Promise<any>;idle:()=>boolean;
 islandJourney:()=>any;glassSign:()=>any;roomExplore:()=>any;frame:()=>{width:number;height:number};signRect:()=>{x:number;y:number;width:number;height:number}|null;
 leave:()=>void;enterMainline:()=>void;returnHome:()=>void;
};
/*QF_TRIAL_BEGIN*//** Boot wiring: registers the globals only when the gate is open; auto-runs ?qfPre=<key>. Returns whether it registered. *//*QF_TRIAL_END*/
/** Boot hook (WorldIntegrationBoot): returns whether a test entry was registered. */
export function installPreTransition(deps:PreDeps):boolean{
 if(!qaSkipAllowed())return false;/* WeChat release envVersion: never registered. develop/trial/web: registered but inert until a query gate or 'enable' */
 /*QF_PROBE_BEGIN*/try{console.info('[QF_PRE] auto key='+(preTransitionKey()||'none')+' src='+preKeySource());}catch{}/* journal-r6 J6: always one line in every test build (release returns above) so a missed qfPre key is visible in the log *//*QF_PROBE_END*/
 let registered=false;
 /*QF_TRIAL_BEGIN*/{const runner=new PreTransitionRunner(deps),G=globalThis as any;
 G.__qfPreTransition=(key:string,opts?:any)=>runner.run(key,opts);
 const auto=preTransitionKey();if(auto)setTimeout(()=>{void runner.run(auto).then(r=>{try{console.info('[QF_PRE] auto '+JSON.stringify(r));}catch{}});},1500);
 registered=true;}/*QF_TRIAL_END*/
 return registered;/* FORMAL release (FORMAL_RELEASE=1 strips the trial region): always false, nothing registered */
}
