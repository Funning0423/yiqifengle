/** T0 GROKBOT_AUTOPLAY glue (GGbot). Debug/test-build only; copied into assets/ ONLY by install.sh.
 * Zero edits to existing game files: finds WorldIntegrationBoot in the running scene by class name and
 * drives it through the SAME objects a finger would:
 *  - door: RoomExploreOverlay down/up handlers (or its leave callback) -> WorldIntegrationBoot.invoke -> worldCommands().leaveHome()
 *  - return (no T1): IslandJourneyOverlay dock open('settings') -> dispatch(returnHome) -> invoke -> returnHome()
 *  - return (T1 installed): synthetic raw touch on the lighthouse through the platform touch source -> IslandHomeInteraction
 *  - touch mode: synthetic multi-touch through the platform touch source (wx listeners captured by the prelude, or DOM TouchEvent on web)
 *  - combo mode: door -> island -> real '继续旅程' mainline button (injected touch; else the same action via boot.invoke) -> level,
 *    then synthetic clear frames into GameAudio.instance.onBoardFrame (real cascade/tier/onCheer/cheer clip/CheerText); see GrokbotCombo.ts
 * Observers (all modes, read-only wrappers): app hide/show, GameAudio calls, WorldFlow walk segments, camera settle. */
import {director,Director,game,Game,js,screen,input,Input} from 'cc';
import {EDITOR} from 'cc/env';
import {AutoplaySequencer,parseAutoplayQuery} from './GrokbotAutoplaySequencer';
import type {AutoplayDriver,StepResult,AutoplayConfig} from './GrokbotAutoplaySequencer';
import {TouchScenarioRunner,selectScenarios,validateScenario} from './GrokbotTouchScenarios';
import {markDef} from './GrokbotMarks';
import {ComboRunner} from './GrokbotCombo';
import type {ComboDriver,BoardStatus} from './GrokbotCombo';
import type {TouchDriver,TouchStep,Point,TouchScenario} from './GrokbotTouchScenarios';
const G:any=globalThis;
/** Installed file == autoplay build, so it runs by default; `autoplay=off` in the launch query disables it. */
const INSTALLED_DEFAULT_ON=true;
function readQuery():Record<string,string>{
 const q:Record<string,string>={};
 if(typeof G.GROKBOT_AUTOPLAY==='string')q.autoplay=G.GROKBOT_AUTOPLAY; // build-output "macro" (inject_prelude.sh --mode); launch query below wins
 try{const o=G.wx?.getLaunchOptionsSync?.()?.query;if(o)Object.assign(q,o);}catch{}
 try{if(typeof location!=='undefined'&&location.search)new URLSearchParams(location.search).forEach((v,k)=>{q[k]=v;});}catch{}
 return q;
}
function localIso(d:Date){const p=(n:number,w=2)=>String(Math.abs(n)).padStart(w,'0'),o=-d.getTimezoneOffset();
 return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(),3)}${o>=0?'+':'-'}${p(Math.floor(Math.abs(o)/60))}:${p(Math.abs(o)%60)}`;}
function fileSink(){try{const wx=G.wx;if(!wx?.getFileSystemManager||!wx.env?.USER_DATA_PATH)return null;const fs=wx.getFileSystemManager(),path=wx.env.USER_DATA_PATH+'/GB_MARK.log';fs.writeFileSync(path,'','utf8');return {path,append:(l:string)=>{try{fs.appendFileSync(path,l+'\n','utf8');}catch{}}};}catch{return null;}}
const fmt=(x:any)=>{const n=Number(x);return Number.isFinite(n)?String(Math.round(n*1000)/1000):'-';};
/** Effective = AudioSource.volume x (muted?0:1) x (suspended?0:1). GameAudio has no other master/group gain (musicVolume IS the loop source volume). */
function bgmInfo(a:any){const s=a?.loopSource;let pos:any,dur:any,vol:any,loop:any,clip:any;try{pos=s?.currentTime;dur=s?.duration??s?.clip?.duration;vol=s?.volume;loop=s?.loop;clip=s?.clip?.name;}catch{}
 const gate=a?.muted||a?.reasons?.size?0:1;return `clip=${clip??'-'} vol=${fmt(vol)} musicVolume=${fmt(a?.musicVolume)} effVol=${fmt(Number(vol)*gate)} loop=${loop?1:0} pos=${fmt(pos)} dur=${fmt(dur)} muted=${a?.muted?1:0} suspended=${a?.reasons?.size?1:0}`;}
const now=()=>typeof performance!=='undefined'&&performance.now?performance.now():Date.now();
const wallText=()=>{const d=new Date();return `${localIso(d)} epoch=${d.getTime()}`;};
const frameNo=()=>{try{return director.getTotalFrames();}catch{return -1;}};
type Fake={getID():number;getUILocation():{x:number;y:number};getLocation():{x:number;y:number};getAllTouches():unknown[]};
function fakeTouch(id:number,x:number,y:number,down:boolean):Fake{const t:any={getID:()=>id,getUILocation:()=>({x,y}),getLocation:()=>({x,y})};t.getAllTouches=()=>down?[t]:[];return t;}

/** ---------- shared context ---------- */
class Ctx {
 readonly t0=now();boot:any=null;private sink=fileSink();private lighthouseCache:{p:Point;at:number}|null=null;
 findBoot(){if(this.boot&&this.boot.isValid!==false&&this.boot.node?.isValid!==false)return this.boot;this.boot=director.getScene()?.getComponentInChildren('WorldIntegrationBoot')||null;return this.boot;}
 ready(b:any){return !!b&&b.loadPhase==='ready'&&b.ready&&!!b.composition;}
 commands(){const b=this.findBoot();if(!this.ready(b))return null;try{return b.composition.worldCommands();}catch{return null;}}
 state():string|null{const c=this.commands();if(!c)return null;try{return c.snapshot().state;}catch{return null;}}
 flow(){const b=this.findBoot();return b?.composition?.world?.flow??null;}
 idle(){const b=this.findBoot(),c=this.commands();if(!c||b.busy)return false;let s:any;try{s=c.snapshot();}catch{return false;}return !s.needsResume&&!s.hidden&&!b.board?.()?.hostModalOpen?.()&&!b.islandJourney?.isOpen?.();}
 emitLine(line:string){console.log(line);(G.__GB_MARKS||(G.__GB_MARKS=[])).push(line);this.sink?.append(line);}
 readonly taps:((name:string,extra:string)=>void)[]=[];
 mark(name:string,extra=''){const ms=Math.round(now()-this.t0);if(!markDef(name))extra=(extra?extra+' ':'')+'unregistered=1';this.emitLine(`GB_MARK ${name} ${ms} wall=${wallText()} frame=${frameNo()} state=${this.state()??'-'}${extra?' '+extra:''}`);
  for(const t of this.taps){try{t(name,extra);}catch{}}}
 get logFile(){return this.sink?.path??null;}
 /** CSS/client px of the window: same numbers WorldIntegrationBoot.navLayout uses for UI placement. */
 client(){const b=this.findBoot();try{const f=b?.navLayout?.();if(f&&f.width>0&&f.height>0)return {w:f.width,h:f.height};}catch{}
  if(typeof window!=='undefined'&&window.innerWidth)return {w:window.innerWidth,h:window.innerHeight};try{const i=G.wx?.getSystemInfoSync?.();if(i)return {w:i.windowWidth,h:i.windowHeight};}catch{}return {w:390,h:844};}
 dpr(){try{const d=(screen as any).devicePixelRatio;if(Number.isFinite(d)&&d>0)return d;}catch{}return typeof window!=='undefined'&&window.devicePixelRatio?window.devicePixelRatio:1;}
 /** Engine touch location (bottom-left origin, device px) predicted for a client point; Cocos minigame touch input flips Y and scales by DPR. */
 toLocation(p:Point){const c=this.client(),d=this.dpr();return {x:p.x*d,y:(c.h-p.y)*d};}
 hasLighthouse(){const c=this.commands();return !!c&&typeof c.hitLighthouse==='function';}
 hitLighthouse(p:Point){const c=this.commands();if(!c||typeof c.hitLighthouse!=='function')return false;const l=this.toLocation(p);try{return !!c.hitLighthouse(l.x,l.y);}catch{return false;}}
 /** Real ray test (worldCommands().hitLighthouse from T1) on a grid; the hit closest to the hit-centroid wins. */
 lighthousePoint():Point|null{if(this.lighthouseCache&&now()-this.lighthouseCache.at<1500)return this.lighthouseCache.p;if(!this.hasLighthouse())return null;const {w,h}=this.client(),hits:Point[]=[];
  for(let gy=0.12;gy<=0.80;gy+=0.02)for(let gx=0.06;gx<=0.94;gx+=0.02){const p={x:gx*w,y:gy*h};if(this.hitLighthouse(p))hits.push(p);}
  if(!hits.length)return null;const cx=hits.reduce((a,p)=>a+p.x,0)/hits.length,cy=hits.reduce((a,p)=>a+p.y,0)/hits.length;let best=hits[0],bd=Infinity;for(const p of hits){const d=Math.hypot(p.x-cx,p.y-cy);if(d<bd){bd=d;best=p;}}
  this.lighthouseCache={p:best,at:now()};return best;}
 uiNode(name:string):any{const b=this.findBoot();const root=b?.canvas;if(!root)return null;const q=[root];while(q.length){const n=q.shift();if(n.name===name&&n.activeInHierarchy!==false&&n.active!==false)return n;for(const c of n.children||[])q.push(c);}return null;}
 uiPoint(name:string):Point|null{const n=this.uiNode(name);if(!n)return null;const {w,h}=this.client(),wp=n.worldPosition;return {x:wp.x+w/2,y:h/2-wp.y};}
}

/** ---------- platform touch backend: same entry a real finger takes ---------- */
class TouchBackend {
 private down=new Map<number,Point>();readonly kind:string;
 constructor(private ctx:Ctx){this.kind=G.__gbTouch?.emit?'wx-prelude':(typeof document!=='undefined'&&typeof (G as any).TouchEvent==='function'&&typeof (G as any).Touch==='function'&&(game as any).canvas)?'web-dom':'none';}
 available(){return this.kind!=='none';}
 inject(phase:TouchStep['phase'],finger:number,p:Point):{ok:boolean;reason?:string;info?:string}{
  const id=1000+finger;if(phase==='start'||phase==='move')this.down.set(id,p);else this.down.delete(id);
  if(this.kind==='wx-prelude'){const mk=(i:number,q:Point)=>({identifier:i,clientX:q.x,clientY:q.y,pageX:q.x,pageY:q.y,force:1});
   const ev={type:'touch'+phase,touches:[...this.down].map(([i,q])=>mk(i,q)),changedTouches:[mk(id,p)],timeStamp:Date.now()};
   const key=({start:'onTouchStart',move:'onTouchMove',end:'onTouchEnd',cancel:'onTouchCancel'} as const)[phase];
   const n=G.__gbTouch.emit(key,ev);return n>0?{ok:true,info:`backend=wx-prelude listeners=${n} touches=${ev.touches.length}`}:{ok:false,reason:'no-wx-listeners'};}
  if(this.kind==='web-dom'){const cv=(game as any).canvas,r=cv.getBoundingClientRect(),T=(G as any).Touch,TE=(G as any).TouchEvent;
   const mk=(i:number,q:Point)=>new T({identifier:i,target:cv,clientX:r.left+q.x,clientY:r.top+q.y,pageX:r.left+q.x,pageY:r.top+q.y,force:1});
   const touches=[...this.down].map(([i,q])=>mk(i,q));cv.dispatchEvent(new TE('touch'+phase,{touches,targetTouches:touches,changedTouches:[mk(id,p)],bubbles:true,cancelable:true}));return {ok:true,info:`backend=web-dom touches=${touches.length}`};}
  return {ok:false,reason:'no-touch-backend'};
 }
 releaseAll(){for(const [id,p] of [...this.down])this.inject('cancel',id-1000,p);}
}

/** ---------- read-only observers ---------- */
class Observers {
 private bgmPlaying:boolean|null=null;private audioHooked=false;private cheerHooked=false;private flowHooked:any=null;private settleHookFor:any=null;private settleHookAvailable=false;
 private craneHookFor:any=null;private craneReported=false;private settle:{place:string;since:number;last:number[]|null;still:number;done:boolean}|null=null;private lastState:string|null=null;private reportedNoHook=false;
 constructor(private ctx:Ctx){
  game.on(Game.EVENT_HIDE,()=>ctx.mark('app:hide','source=cc.game'));game.on(Game.EVENT_SHOW,()=>ctx.mark('app:show','source=cc.game'));
  try{G.wx?.onHide?.(()=>ctx.mark('app:wx-hide'));G.wx?.onShow?.(()=>ctx.mark('app:wx-show'));}catch{}
 }
 tick(){this.hookAudio();this.hookCheerText();this.pollBgm();this.hookFlow();this.cameraSettle();}
 /** Wrap GameAudio prototype methods: call the original unchanged, then log. No gameplay path is altered. */
 private hookAudio(){if(this.audioHooked)return;const C:any=js.getClassByName('GameAudio');if(!C?.prototype?.play)return;this.audioHooked=true;const P=C.prototype,ctx=this.ctx;let source='';
  const wrap=(name:string,after:(self:any,args:any[],before:any)=>void,before?:(self:any,args:any[])=>any)=>{const orig=P[name];if(typeof orig!=='function')return;P[name]=function(this:any,...args:any[]){const b=before?.(this,args);const r=orig.apply(this,args);try{after(this,args,b);}catch{}return r;};};
  // play(): log request + what GameAudio actually did (new AudioSource voice or dropped), clip, effective volume.
  wrap('play',(self,[n,v],before)=>{const sus=self.reasons?.size?1:0,muted=self.muted?1:0;let voice:any=null;try{for(const x of (self.sfxVoices?.values?.()??[]))if(!before.has(x.source))voice=x;}catch{}
   const src=voice?.source,vol=src?Number(src.volume):Math.max(0,Math.min(1,Number.isFinite(v)?v:1)),eff=muted||sus?0:vol;
   ctx.mark('audio:sfx',`name=${n} accepted=${voice?1:0} clip=${src?.clip?.name??'-'} vol=${fmt(vol)} effVol=${fmt(voice?eff:0)} loop=${src?.loop?1:0} dur=${fmt(src?.duration??src?.clip?.duration)} muted=${muted} suspended=${sus}`);
   if(n==='sfx_level_clear')ctx.mark('audio:level-complete','accepted='+(voice?1:0));if(n==='sfx_chest_open')ctx.mark('audio:chest','source='+(source||'other')+' accepted='+(voice?1:0));},
   (self)=>{const set=new Set<any>();try{for(const x of (self.sfxVoices?.values?.()??[]))set.add(x.source);}catch{}return set;});
  wrap('onBoardFrame',(self,[v])=>{if(v?.kind==='clear'){const c=self.cascade,tier=c<=1?'normal':c===2?'combo_1':c===3?'combo_2':'combo_3';ctx.mark('audio:clear',`wave=${c} tier=${tier}${v.gbSynthetic?' synthetic=1 token='+v.token:''}`);}else if(v?.kind==='action')ctx.mark('audio:combo-reset');});
  wrap('onChestResult',()=>{source='';},()=>{source='chest';});wrap('onClaimResult',()=>{source='';},()=>{source='claim';});
  wrap('setMusic',(_s,[p])=>ctx.mark('audio:bgm-set','path='+p));
  wrap('setMusicVolume',(self)=>ctx.mark('audio:bgm-volume',bgmInfo(self)));
  wrap('setMuted',(self)=>ctx.mark('audio:muted',`muted=${self.muted?1:0} `+bgmInfo(self)));
  ctx.mark('audio:hooked','class=GameAudio');}
 /** BGM: playing/stopped transitions with clip/volume/loop/position, and loop seams (currentTime wraps backwards). */
 private bgmPos:number|null=null;
 /** T6: wrap CheerTextHost.prototype.show (returns what it did); absent class = T6 not installed = no mark. */
 private hookCheerText(){if(this.cheerHooked)return;const C:any=js.getClassByName('CheerTextHost');if(typeof C?.prototype?.show!=='function')return;this.cheerHooked=true;const P=C.prototype,orig=P.show,ctx=this.ctx;
  P.show=function(this:any,...a:any[]){const r=orig.apply(this,a);try{ctx.mark('ui:cheer-text',`tier=${r?.tier} word=${r?.word} decision=${r?.decision} source=${r?.source} x=${r?.x} y=${r?.y} replaced=${r?.replaced}`);}catch{}return r;};}
 private pollBgm(){const C:any=js.getClassByName('GameAudio');const a=C?.instance;let playing:boolean|null=null;const src=a?.loopSource;try{playing=a?!!src?.playing:null;}catch{}
  if(playing!==this.bgmPlaying){if(playing===true)this.ctx.mark('audio:bgm-playing',`path=${a?.musicPath??'-'} `+bgmInfo(a));else if(playing===false&&this.bgmPlaying===true)this.ctx.mark('audio:bgm-stopped',bgmInfo(a));this.bgmPlaying=playing;this.bgmPos=null;}
  if(playing){let pos=NaN;try{pos=Number(src.currentTime);}catch{}if(Number.isFinite(pos)){if(this.bgmPos!==null&&pos+0.25<this.bgmPos)this.ctx.mark('audio:bgm-loop-seam',`before=${fmt(this.bgmPos)} after=${fmt(pos)} `+bgmInfo(a));this.bgmPos=pos;}}}
 /** Wrap the WorldFlow instance's walk(): every authored path segment logs start/end. Original runs unchanged. */
 private hookFlow(){const flow=this.ctx.flow();if(!flow||this.flowHooked===flow||typeof flow.walk!=='function')return;this.flowHooked=flow;const orig=flow.walk,ctx=this.ctx;
  const names:[string,string][]=[['toDoor','toDoor'],['outCrossing','crossing-out'],['toIsland','toIsland'],['toThreshold','toThreshold'],['inCrossing','crossing-in'],['toSeat','toSeat']];
  flow.walk=function(this:any,path:any,cams:any,token:any){const cfg=this.config||{};const hit=names.find(([k])=>cfg[k]===path);const n=hit?hit[1]:'path#'+(path?.length??0);
   ctx.mark(`seg:${n}:start`,`mode=${this.mode}`);const p=orig.call(this,path,cams,token);
   return p.then((v:any)=>{ctx.mark(`seg:${n}:end`);return v;},(e:any)=>{ctx.mark(`seg:${n}:cancel`,'reason='+String(e?.name||e).replace(/\s+/g,'_'));throw e;});};
  ctx.mark('camera:segments-hooked');}
 /** camera-settled: 运镜bot's onCameraSettled(listener) if present (T2), else clearly-labelled fallback from camera stillness. */
 private cameraSettle(){const b=this.ctx.findBoot(),comp=b?.composition,world=comp?.world,flow=this.ctx.flow();
  const host=[world,comp,flow,G.__worldCamera].find(h=>h&&typeof h.onCameraSettled==='function');
  if(host&&this.settleHookFor!==host){this.settleHookFor=host;this.settleHookAvailable=true;try{host.onCameraSettled((place:string,info?:any)=>this.ctx.mark('camera-settled:'+place,'source=hook'+(info?.reason?' reason='+info.reason:'')));this.ctx.mark('camera:settle-hook','status=subscribed');}catch(e){this.settleHookAvailable=false;this.ctx.mark('camera:settle-hook','status=subscribe-failed');}}
  const crane=[world,comp,flow,G.__worldCamera].find(h=>h&&typeof h.onCraneStart==='function');
  if(crane&&this.craneHookFor!==crane){this.craneHookFor=crane;try{crane.onCraneStart((info?:any)=>this.ctx.mark('crane-start','source=hook'+(info?.segment?' segment='+info.segment:'')+(info?.progress!==undefined?' progress='+info.progress:'')));this.ctx.mark('camera:crane-hook','status=subscribed');}catch{this.ctx.mark('camera:crane-hook','status=subscribe-failed');}}
  const s=this.ctx.state();if(s&&!crane&&!this.craneReported){this.craneReported=true;this.ctx.mark('camera:crane-hook','status=unavailable (crane-start needs 运镜bot onCraneStart, T2+)');}
  if(s!==this.lastState){this.lastState=s;if(s==='island'||s==='home')this.settle={place:s,since:now(),last:null,still:0,done:false};else this.settle=null;
   if(!this.settleHookAvailable&&!this.reportedNoHook&&s){this.reportedNoHook=true;this.ctx.mark('camera:settle-hook','status=unavailable using=fallback-velocity');}}
  if(this.settleHookAvailable||!this.settle||this.settle.done)return;const cam=comp?.worldCamera?.node;if(!cam)return;const p=cam.worldPosition,q=cam.worldRotation,v=[p.x,p.y,p.z,q.x,q.y,q.z,q.w];
  const l=this.settle.last;this.settle.last=v;if(!l)return;const dp=Math.hypot(v[0]-l[0],v[1]-l[1],v[2]-l[2]),dq=Math.hypot(v[3]-l[3],v[4]-l[4],v[5]-l[5],v[6]-l[6]);
  if(dp<1e-4&&dq<1e-5)this.settle.still++;else this.settle.still=0;
  if(this.settle.still>=10){this.settle.done=true;this.ctx.mark('camera-settled:'+this.settle.place,`source=fallback-velocity frames=10 afterStateMs=${Math.round(now()-this.settle.since)}`);}}
}

/** ---------- real-path driver (door / return) ---------- */
function createDriver(ctx:Ctx,touch:TouchBackend):AutoplayDriver{
 const TOUCH_ID=9001;let drag:{x:number;y:number;steps:number;dir:number}|null=null;
 const boot=()=>{const b=ctx.findBoot();if(!b)throw Error('WorldIntegrationBoot-missing');return b;};
 return {
  now,wall:wallText,frame:frameNo,state:()=>ctx.state(),idle:()=>ctx.idle(),
  revealDoorStep:()=>{const b=boot(),ro=b.roomExplore;if(!ro)return {ok:false,reason:'no-RoomExploreOverlay'};
   if(!drag){if(!ro.root?.active||!ro.allowed())return 'pending';const v=ro.commands()?.roomView(ro.width/ro.height);if(!v?.enabled)return 'pending';if(v.door.visible)return 'done';
    drag={x:ro.width/2,y:ro.height/2,steps:0,dir:v.door.direction>0?-1:1};ro.down(fakeTouch(TOUCH_ID,drag.x,drag.y,true));return 'pending';}
   if(ro.diagnostics().doorVisible||drag.steps>=150){ro.up(fakeTouch(TOUCH_ID,drag.x,drag.y,false));const ok=ro.diagnostics().doorVisible;drag=null;return ok?'done':{ok:false,reason:'door-not-visible-after-drag'};}
   drag.x+=drag.dir*6;drag.steps++;ro.move(fakeTouch(TOUCH_ID,drag.x,drag.y,true));return 'pending';},
  tapDoor:():StepResult=>{const b=boot(),ro=b.roomExplore;if(!ro)return {ok:false,reason:'no-RoomExploreOverlay'};
   if(!ro.allowed())return {ok:false,reason:'overlay-not-allowed'};if(!ro.commands()?.roomView(ro.width/ro.height).enabled)return {ok:false,reason:'room-view-disabled'};
   const d=ro.diagnostics();
   if(d.doorVisible){ // Real touch handlers (down/up) at the door handle: same hit test + leave callback as a finger.
    const x=d.handle.x,y=d.handle.y;ro.down(fakeTouch(TOUCH_ID,x,y,true));ro.up(fakeTouch(TOUCH_ID,x,y,false));
    if(b.busy)return {ok:true,via:'RoomExploreOverlay.down+up(synthetic-touch@handle)'};}
   // Door off-screen in the untouched default view: same gates as RoomExploreOverlay.up, then its leave callback.
   ro.leave();return b.busy?{ok:true,via:d.doorVisible?'RoomExploreOverlay.leave(after-touch-miss)':'RoomExploreOverlay.leave(door-offscreen)'}:{ok:false,reason:'invoke-refused'};},
  openReturnPanel:():StepResult=>{const b=boot();if(b.islandHome)return {ok:true,via:'skipped(T1:lighthouse-return,no-panel-button)'};const j=b.islandJourney;if(!j)return {ok:false,reason:'no-IslandJourneyOverlay'};if(!j.enabled||j.dead||j.page)return {ok:false,reason:'dock-not-enabled'};j.open('settings');return j.page==='settings'?{ok:true,via:'IslandJourneyOverlay.open(settings)'}:{ok:false,reason:'panel-not-open'};},
  tapReturn:():StepResult=>{const b=boot(),j=b.islandJourney;
   if(b.islandHome){ // T1 installed: the only return path is a real lighthouse tap.
    const p=ctx.lighthousePoint();
    if(p&&touch.available()){const a=touch.inject('start',1,p),e=touch.inject('end',1,p);return a.ok&&e.ok?{ok:true,via:`lighthouse-touch(${touch.kind})@${Math.round(p.x)},${Math.round(p.y)}`}:{ok:false,reason:'inject-'+(a.reason||e.reason)};}
    if(b.busy)return {ok:false,reason:'busy'};b.islandHome.options.returnHome();return {ok:true,via:`IslandHomeInteraction.options.returnHome(${p?'no-touch-backend':'no-lighthouse-hit'})`};}
   if(j&&j.page==='settings'){if(j.dead||!j.enabled)return {ok:false,reason:'panel-disabled'};j.dispatch(j.options.returnHome);return b.busy?{ok:true,via:'IslandJourneyOverlay.dispatch(returnHome)'}:{ok:false,reason:'invoke-refused'};}
   if(b.busy||j?.isOpen?.())return {ok:false,reason:'busy-or-modal'};b.invoke(()=>b.composition.worldCommands().returnHome());return b.busy?{ok:true,via:'WorldIntegrationBoot.invoke(returnHome)'}:{ok:false,reason:'invoke-refused'};},
  emit:(line:string)=>ctx.emitLine(line),
 };
}
function createTouchDriver(ctx:Ctx,touch:TouchBackend,door:AutoplayDriver):TouchDriver{
 const SEA:[number,number][]=[[0.14,0.56],[0.86,0.56],[0.5,0.30],[0.2,0.40],[0.8,0.40]];
 return {
  now,state:()=>ctx.state(),idle:()=>ctx.idle(),
  has:cap=>cap==='backend'?touch.available():ctx.hasLighthouse(),
  resolve:(st:TouchStep)=>{const {w,h}=ctx.client();
   if(st.n)return {x:st.n[0]*w,y:st.n[1]*h};
   if(st.target==='lighthouse'){const p=ctx.lighthousePoint();return p?{...p}:{error:ctx.hasLighthouse()?'no-lighthouse-pixel':'no-hitLighthouse'};}
   if(st.target==='hud'){const p=ctx.uiPoint(st.name||'');return p?p:{error:'hud-not-found:'+st.name};}
   if(st.target==='sea'){for(const [x,y] of SEA){const p={x:x*w,y:y*h};if(!ctx.hitLighthouse(p))return p;}return {error:'no-sea-point'};}
   return {error:'no-target'};},
  inject:(phase,finger,p)=>touch.inject(phase,finger,p),
  leave:()=>door.tapDoor(),
  cleanup:()=>{const b=ctx.findBoot();try{if(b?.islandJourney?.isOpen?.())b.islandJourney.close();}catch{}},
  modalOpen:()=>{const b=ctx.findBoot();return !!(b?.islandJourney?.isOpen?.()||b?.board?.()?.hostModalOpen?.());},
  mark:(n,e)=>ctx.mark(n,e),
 };
}
/** combo mode: real level entry + GameAudio feed (frames built in GrokbotCombo.ts). */
function createComboDriver(ctx:Ctx,touch:TouchBackend,door:AutoplayDriver):ComboDriver{
 const GA=()=>js.getClassByName('GameAudio') as any;
 const board=()=>{const b=ctx.findBoot();try{return b?.board?.()??null;}catch{return null;}};
 const pres=()=>{try{return board()?.hostPresentation?.()??null;}catch{return null;}};
 return {
  now,state:()=>ctx.state(),idle:()=>ctx.idle(),tapDoor:()=>door.tapDoor(),
  enterLevel:(how)=>{const b=ctx.findBoot();if(!b)return {ok:false,reason:'WorldIntegrationBoot-missing'};if(b.busy)return {ok:false,reason:'busy'};
   if(how==='button'){const p=ctx.uiPoint('mainline');if(!p)return {ok:false,reason:'mainline-button-not-visible'};if(!touch.available())return {ok:false,reason:'no-touch-backend'};
    const a=touch.inject('start',1,p),e=touch.inject('end',1,p);return a.ok&&e.ok?{ok:true,via:`mainline-button-touch(${touch.kind})@${Math.round(p.x)},${Math.round(p.y)}`}:{ok:false,reason:'inject-'+(a.reason||e.reason)};}
   const c=b.composition;if(typeof c?.enterMainline!=='function')return {ok:false,reason:'no-composition.enterMainline'};if(typeof b.invoke!=='function')return {ok:false,reason:'no-boot.invoke'};
   void b.invoke(()=>c.enterMainline());return b.busy?{ok:true,via:'WorldIntegrationBoot.invoke(composition.enterMainline)'}:{ok:false,reason:'invoke-refused'};},
  board:():BoardStatus=>{const bd=board(),p=pres();let modal=false;try{modal=!!bd?.hostModalOpen?.();}catch{}return {present:!!bd,ready:p?.state==='run.ready',modal,state:String(p?.state??'-')};},
  audio:()=>{const a=GA()?.instance;return {present:!!a&&typeof a.onBoardFrame==='function',muted:!!a?.isMuted?.(),suspended:!!a?.isSuspended?.()};},
  textHost:()=>!!js.getClassByName('CheerTextHost'),
  tile:(i)=>{const p:any=pres();const t=p?.active?.board?.[i]??p?.board?.[i]??null;return t&&typeof t==='object'?{id:t.id,type:t.type,special:t.special??null}:null;},
  subscribeCheer:(f)=>{const C=GA();if(typeof C?.onCheer!=='function')return null;try{const off=C.onCheer(f);return typeof off==='function'?off:null;}catch{return null;}},
  feed:(frame)=>{const a=GA()?.instance;if(!a||typeof a.onBoardFrame!=='function')return {ok:false,reason:'no-GameAudio.instance'};a.onBoardFrame(frame);return {ok:true};},
  mark:(n,e)=>ctx.mark(n,e),
 };
}
function customScenarios(ctx:Ctx):TouchScenario[]{const raw=G.GROKBOT_TOUCH_SCENARIOS;if(!raw)return [];let list:any;try{list=typeof raw==='string'?JSON.parse(raw):raw;}catch{ctx.mark('touch:custom-invalid','reason=json');return [];}
 if(!Array.isArray(list))return [];return list.filter((s:any)=>{const bad=validateScenario(s);if(bad)ctx.mark('touch:custom-invalid',`name=${s?.name} reason=${bad}`);return !bad;});}
function install(){
 if(G.__GB_AUTOPLAY)return;const cfg:AutoplayConfig|null=parseAutoplayQuery(readQuery(),INSTALLED_DEFAULT_ON);
 if(!cfg){console.log('GB_MARK autoplay-disabled 0');return;}
 const ctx=new Ctx(),touch=new TouchBackend(ctx),obs=new Observers(ctx);
 ctx.mark('autoplay-installed',`mode=${cfg.mode} touchBackend=${touch.kind} logFile=${ctx.logFile??'-'}`);
 let runner:{tick():void;finished():boolean;current?:string}|null=null;let touchRunner:TouchScenarioRunner|null=null;
 const driver=createDriver(ctx,touch);
 if(cfg.mode==='out-and-back')runner=new AutoplaySequencer(driver,cfg.options,ctx.t0);
 else if(cfg.mode==='combo'){const cr=new ComboRunner(createComboDriver(ctx,touch,driver),cfg.combo,ctx.t0);runner=cr;
  // count what the observers saw (same lines Voice bot reads): cheer clip starts and CheerText decisions
  ctx.taps.push((n,e)=>{if(n==='audio:sfx'){const m=/name=(\S+) accepted=(\d)/.exec(e);if(m)cr.onSfx(m[1],m[2]==='1');}else if(n==='ui:cheer-text'){const m=/tier=(\S+) word=.* decision=(\S+) source=(\S+)/.exec(e);if(m)cr.onText(Number(m[1]),m[2],m[3]);}});}
 else if(cfg.mode==='touch'){const sel=selectScenarios(cfg.scenarios,customScenarios(ctx));for(const e of sel.errors)ctx.mark('touch:scenario-invalid','reason='+e);
  touchRunner=new TouchScenarioRunner(createTouchDriver(ctx,touch,driver),sel.list,cfg.variant,90000,cfg.exportWx,()=>ctx.client());runner=touchRunner;
  ctx.mark('touch:suite-start',`spec=${cfg.scenarios} count=${sel.list.length} variant=${cfg.variant||'-'}`);
  // Proof that injected touches reached Cocos input (location as the engine sees it).
  input.on(Input.EventType.TOUCH_START,(e:any)=>{const id=e.getID?.();if(id>=1000&&id<1100){const l=e.getLocation();ctx.mark('touch:cocos-seen',`f=${id-1000} loc=${Math.round(l.x)},${Math.round(l.y)} touches=${e.getAllTouches?.().length??'?'}`);}});}
 let waitStarted=false;
 const tick=()=>{try{obs.tick();}catch(e){console.error('GB_MARK observer-exception',e);}
  if(runner&&!runner.finished()){if(cfg.mode==='touch'&&!waitStarted){if(ctx.state()!=='home'||!ctx.idle())return;waitStarted=true;ctx.mark('world-ready');}
   try{runner.tick();}catch(e){console.error('GB_MARK autoplay-exception',e);ctx.mark('autoplay-failed','reason=exception');runner=null;}}};
 director.on(Director.EVENT_AFTER_UPDATE,tick); // stays on: observers keep logging audio/app/camera for manual play too
 G.__GB_AUTOPLAY={config:cfg,touchBackend:touch.kind,phase:()=>runner?((runner as any).current??(runner.finished()?'done':'running')):'observe',touchResults:()=>touchRunner?.results.slice()??[],logFile:ctx.logFile};
}
if(!EDITOR)install();
