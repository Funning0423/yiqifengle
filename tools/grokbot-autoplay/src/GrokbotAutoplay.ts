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
import {director,Director,game,Game,js,screen,input,Input,assetManager,resources,AudioSource} from 'cc';
import {EDITOR} from 'cc/env';
import {AutoplaySequencer,parseAutoplayQuery} from './GrokbotAutoplaySequencer';
import type {AutoplayDriver,StepResult,AutoplayConfig} from './GrokbotAutoplaySequencer';
import {TouchScenarioRunner,selectScenarios,validateScenario,PROP_TARGET_NODE,isPropTarget} from './GrokbotTouchScenarios';
import {markDef} from './GrokbotMarks';
import {ComboRunner} from './GrokbotCombo';
import {BootTimeline,pickOrigin,tok} from './GrokbotBoot';
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
 readonly t0=now();boot:any=null;private sink=fileSink();
 findBoot(){if(this.boot&&this.boot.isValid!==false&&this.boot.node?.isValid!==false)return this.boot;const s:any=director.getScene();this.boot=s?(s.getComponent?.('WorldIntegrationBoot')||s.getComponentInChildren?.('WorldIntegrationBoot')||null):null;return this.boot;}
 /* ^ Cocos: getComponentInChildren does NOT check the node itself, and the boot lives ON the Scene node in real builds. */
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
 /** Lighthouse tap point (T1 return / touch target 'lighthouse'). Mac r4: the old per-call 35x45 grid of real ray tests (1575 x
  * worldCommands().hitLighthouse = geometry.intersect.rayModel over 3 meshes) froze the sim for 5.6-17 s during the island hold.
  * Now: (1) cache per island arrival + client size, re-verified with ONE real ray test at use while in island (the island camera
  * is static; a moved camera simply fails the check; off island the arrival's pick is reused unverified); (2) seed = env_lighthouse_ext world AABB projected with the live world camera
  * (WorldFlowComponent.worldCamera/lighthouseTargets, read-only, defensive) -> centre, then 5x5 samples inside the projected rect
  * nearest-first, first real hit wins (<= 26 ray tests, 1 on the real island camera); (3) the old grid only when no projection is
  * available (stand-ins, renamed fields) and never from the warm-up. Every pick is a REAL hitLighthouse hit. */
 private lhArrival=0;private lhStateWas:string|null=null;private lhWarmed=-1;readonly lhStats={rays:0,computes:0,cacheHits:0,grid:0,proj:0};
 private lhKey(){const {w,h}=this.client();return this.lhArrival+':'+Math.round(w)+'x'+Math.round(h);}
 private lhHit(p:Point){this.lhStats.rays++;return this.hitLighthouse(p);}
 private lhPick(hits:Point[]):Point|null{if(!hits.length)return null;let cx=0,cy=0;for(let i=0;i<hits.length;i++){cx+=hits[i].x;cy+=hits[i].y;}cx/=hits.length;cy/=hits.length;
  let best=hits[0],bd=Infinity;for(let i=0;i<hits.length;i++){const d=Math.hypot(hits[i].x-cx,hits[i].y-cy);if(d<bd){bd=d;best=hits[i];}}return best;}
 /** Client-px rect of the first live lighthouse target's world AABB through the live world camera; null when unavailable. */
 lighthouseRect():{x0:number;y0:number;x1:number;y1:number;cx:number;cy:number}|null{
  try{const b=this.findBoot(),world=b?.composition?.world,cam=world?.worldCamera,targets=world?.lighthouseTargets;
   if(!cam||typeof cam.worldToScreen!=='function'||!targets||typeof targets.length!=='number')return null;
   let wb:any=null;for(let i=0;i<targets.length&&!wb;i++){const r=targets[i];if(r&&r.node&&r.node.activeInHierarchy!==false&&r.model&&r.model.worldBounds)wb=r.model.worldBounds;}
   if(!wb||!wb.center||!wb.halfExtents)return null;const {w,h}=this.client(),d=this.dpr(),c=wb.center,e=wb.halfExtents;
   let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
   for(let i=0;i<8;i++){const q=cam.worldToScreen({x:c.x+(i&1?e.x:-e.x),y:c.y+(i&2?e.y:-e.y),z:c.z+(i&4?e.z:-e.z)});if(!q||!Number.isFinite(q.x)||!Number.isFinite(q.y))return null;
    const px=q.x/d,py=h-q.y/d;if(px<x0)x0=px;if(px>x1)x1=px;if(py<y0)y0=py;if(py>y1)y1=py;}
   const m=cam.worldToScreen({x:c.x,y:c.y,z:c.z});if(!m||!Number.isFinite(m.x)||!Number.isFinite(m.y))return null;
   x0=Math.max(0,x0);y0=Math.max(0,y0);x1=Math.min(w,x1);y1=Math.min(h,y1);if(!(x1>x0&&y1>y0))return null;
   return {x0,y0,x1,y1,cx:Math.min(x1,Math.max(x0,m.x/d)),cy:Math.min(y1,Math.max(y0,h-m.y/d))};}catch{return null;}}
 /** Projected AABB centre first, then the 5x5 samples nearest-first; the FIRST real hit wins (a miss costs a full triangle sweep of
  * all 3 targets, ~15k triangles, so stop early: bench/bench_lighthouse_pick.cjs, 1 ray on the real island camera). */
 private lhProjected():Point|null{const r=this.lighthouseRect();if(!r)return null;const c:Point[]=[{x:r.cx,y:r.cy}],rest:Point[]=[];
  for(let j=0;j<5;j++)for(let i=0;i<5;i++)rest.push({x:r.x0+(r.x1-r.x0)*(.1+.2*i),y:r.y0+(r.y1-r.y0)*(.1+.2*j)});
  rest.sort((a,b)=>Math.hypot(a.x-r.cx,a.y-r.cy)-Math.hypot(b.x-r.cx,b.y-r.cy));for(let i=0;i<rest.length;i++)c.push(rest[i]);
  for(let i=0;i<c.length;i++)if(this.lhHit(c[i]))return c[i];return null;}
 private lhGrid():Point|null{const {w,h}=this.client(),hits:Point[]=[];
  for(let gy=0.12;gy<=0.80;gy+=0.02)for(let gx=0.06;gx<=0.94;gx+=0.02){const p={x:gx*w,y:gy*h};if(this.lhHit(p))hits.push(p);}
  return this.lhPick(hits);}
 private lighthouseCache:{p:Point;key:string}|null=null;
 /** Call every frame (cheap): tracks island arrivals and, in island-idle, precomputes the point ONCE per arrival (projection only). */
 warmLighthouse(enabled:boolean){const s=this.state();if(s!==this.lhStateWas){if(s==='island')this.lhArrival++;this.lhStateWas=s;}
  if(!enabled||s!=='island'||this.lhWarmed===this.lhArrival||!this.hasLighthouse()||!this.idle())return;this.lhWarmed=this.lhArrival;this.lighthousePoint('warm');}
 lighthousePoint(why='use'):Point|null{if(!this.hasLighthouse())return null;const key=this.lhKey(),c=this.lighthouseCache,r0=this.lhStats.rays,t=now();
  if(c&&c.key===key){if(this.state()!=='island'||this.lhHit(c.p)){this.lhStats.cacheHits++;return c.p;}this.lighthouseCache=null;} // off island (e.g. the 2nd finger of a double tap after the return began) a ray test always misses: reuse the arrival's pick, like the old 1.5 s cache
  let p=this.lhProjected(),src='proj';if(!p&&why!=='warm'){p=this.lhGrid();src='grid';}
  this.lhStats.computes++;if(p){if(src==='grid')this.lhStats.grid++;else this.lhStats.proj++;this.lighthouseCache={p,key};}
  this.mark('lighthouse:point',`why=${why} src=${p?src:'none'} rays=${this.lhStats.rays-r0} ms=${Math.round(now()-t)}${p?` at=${Math.round(p.x)},${Math.round(p.y)}`:''}`);
  return p;}
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
   const ev={type:'touch'+phase,touches:Array.from(this.down).map(([i,q])=>mk(i,q)),changedTouches:[mk(id,p)],timeStamp:Date.now()};
   const key=({start:'onTouchStart',move:'onTouchMove',end:'onTouchEnd',cancel:'onTouchCancel'} as const)[phase];
   const n=G.__gbTouch.emit(key,ev);return n>0?{ok:true,info:`backend=wx-prelude listeners=${n} touches=${ev.touches.length}`}:{ok:false,reason:'no-wx-listeners'};}
  if(this.kind==='web-dom'){const cv=(game as any).canvas,r=cv.getBoundingClientRect(),T=(G as any).Touch,TE=(G as any).TouchEvent;
   const mk=(i:number,q:Point)=>new T({identifier:i,target:cv,clientX:r.left+q.x,clientY:r.top+q.y,pageX:r.left+q.x,pageY:r.top+q.y,force:1});
   const touches=Array.from(this.down).map(([i,q])=>mk(i,q));cv.dispatchEvent(new TE('touch'+phase,{touches,targetTouches:touches,changedTouches:[mk(id,p)],bubbles:true,cancelable:true}));return {ok:true,info:`backend=web-dom touches=${touches.length}`};}
  return {ok:false,reason:'no-touch-backend'};
 }
 releaseAll(){Array.from(this.down).forEach(([id,p])=>this.inject('cancel',id-1000,p));}
}

/** ---------- device:caps (texture-based morph targets need float/vertex textures; see docs/walk-driver.md §8) ---------- */
const CAPS_TIMEOUT_MS=20000;
/** cc gfx.API / gfx.Format.RGBA32F / gfx.FormatFeatureBit.SAMPLED_TEXTURE as in Cocos Creator 3.8.8 (engine cc.d.ts). */
const GFX_API_NAMES=['UNKNOWN','GLES2','GLES3','METAL','VULKAN','NVN','WEBGL','WEBGL2','WEBGPU'];
const GFX_RGBA32F=44,GFX_SAMPLED_TEXTURE=2;
const APRON_NODE='LOD0_G2_APRON';
const POSE_GIRL='B_PASS2G_CURSOR',POSE_BONES=['thigh.L','spine'],POSE_WINDOW_MS=500,POSE_MAX=4,POSE_LIVE_DEG=0.5,POSE_SIT_DEG=5;
function capTry(f:()=>any):any{try{return f();}catch{return undefined;}}
function capTok(v:any):string{if(v===undefined||v===null||v==='')return '-';return String(v).replace(/\s+/g,'_').slice(0,96);}
function capBool(v:any):string{return v===undefined||v===null?'-':(v?'1':'0');}
function gfxDevice():any{return capTry(()=>(director as any).root.device)||capTry(()=>G.cc.deviceManager.gfxDevice)||null;}
function deviceCapsFields():string{const dev=gfxDevice();const api=capTry(()=>dev.gfxAPI);const apiName=typeof api==='number'?(GFX_API_NAMES[api]||String(api)):'-';
 let gl:any=capTry(()=>dev.gl)||null,glSource=gl?'device':'-';
 // Fallback: ask the game canvas for the context of the type the device already created (returns that same context, creates nothing new).
 if(!gl&&(api===6||api===7)){gl=capTry(()=>(game as any).canvas.getContext(api===7?'webgl2':'webgl'))||null;if(gl)glSource='canvas';}
 const glVersion=capTry(()=>gl.getParameter(gl.VERSION));
 let webgl='-';if(api===7)webgl='2';else if(api===6)webgl='1';else if(typeof glVersion==='string')webgl=/WebGL 2/i.test(glVersion)?'2':/WebGL 1/i.test(glVersion)?'1':'-';
 const exts:any=gl?capTry(()=>gl.getSupportedExtensions()):null;const has=(n:string)=>Array.isArray(exts)?(exts.indexOf(n)>=0?'1':'0'):'-';
 const caps:any=capTry(()=>dev.capabilities)||{};const pick=(k:string,pname:number)=>{const v=capTry(()=>caps[k]);if(typeof v==='number')return v;return capTry(()=>gl.getParameter(pname));};
 const rgba32f=capTry(()=>typeof dev.getFormatFeatures==='function'?((dev.getFormatFeatures(GFX_RGBA32F)&GFX_SAMPLED_TEXTURE)?1:0):undefined);
 let renderer=capTry(()=>dev.renderer),vendor=capTry(()=>dev.vendor),unR:any,unV:any;
 if(!renderer)renderer=capTry(()=>gl.getParameter(gl.RENDERER));if(!vendor)vendor=capTry(()=>gl.getParameter(gl.VENDOR));
 const dbg=Array.isArray(exts)&&exts.indexOf('WEBGL_debug_renderer_info')>=0?capTry(()=>gl.getExtension('WEBGL_debug_renderer_info')):null;
 if(dbg){unR=capTry(()=>gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL));unV=capTry(()=>gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL));}
 const wx=G.wx;let si:any=capTry(()=>wx.getSystemInfoSync());if(!si||!si.platform){const di=capTry(()=>wx.getDeviceInfo())||{},ab=capTry(()=>wx.getAppBaseInfo())||{};si={platform:di.platform,model:di.model,system:di.system,brand:di.brand,benchmarkLevel:di.benchmarkLevel,SDKVersion:ab.SDKVersion,pixelRatio:capTry(()=>wx.getWindowInfo().pixelRatio)};}
 return `gfxAPI=${typeof api==='number'?api:'-'}(${apiName}) webgl=${webgl} glSource=${glSource} OES_texture_float=${has('OES_texture_float')} OES_texture_half_float=${has('OES_texture_half_float')} rgba32fSampled=${capBool(rgba32f)}`+
  ` maxVertexTextureUnits=${capTok(pick('maxVertexTextureUnits',0x8B4C))} maxTextureSize=${capTok(pick('maxTextureSize',0x0D33))} maxVertexUniformVectors=${capTok(pick('maxVertexUniformVectors',0x8DFB))}`+
  ` platform=${capTok(si&&si.platform)} model=${capTok(si&&si.model)} system=${capTok(si&&si.system)} SDKVersion=${capTok(si&&si.SDKVersion)} brand=${capTok(si&&si.brand)} benchmarkLevel=${capTok(si&&si.benchmarkLevel)} pixelRatio=${capTok(si&&si.pixelRatio)}`+
  ` ${apronFields()} glVersion=${capTok(glVersion)} renderer=${capTok(renderer)} vendor=${capTok(vendor)} unmaskedRenderer=${capTok(unR)} unmaskedVendor=${capTok(unV)}`;}
/** Apron morph: the renderer itself (scene node LOD0_G2_APRON, cc.SkinnedMeshRenderer/cc.MeshRenderer) + the walk driver's binding status
 *  (__worldIntegration.morph(), work/GGbot-morph; '-' before it is merged). apronMorphTargets=null = no morph data on the mesh. */
function apronFields():string{const w=G.__worldIntegration;const d:any=w&&typeof w.morph==='function'?capTry(()=>w.morph()):null;
 let r:any=null;const s:any=capTry(()=>director.getScene());
 if(s){const q:any[]=[s];let seen=0;while(q.length&&seen<20000&&!r){const n=q.shift();seen++;if(n&&n.name===APRON_NODE)r=capTry(()=>n.getComponent('cc.SkinnedMeshRenderer'))||capTry(()=>n.getComponent('cc.MeshRenderer'))||null;const k=n&&n.children;if(k)for(let i=0;i<k.length;i++)q.push(k[i]);}}
 const subs=r?capTry(()=>r.mesh.struct.morph.subMeshMorphs):undefined;let counts='null';
 if(Array.isArray(subs)&&subs.length){const c:number[]=[];for(let i=0;i<subs.length;i++)c.push(subs[i]&&subs[i].targets?subs[i].targets.length:0);counts=c.join(',');}
 return `apronRenderer=${r?'found':s?'missing':'-'} apronMorphEnabled=${r?capBool(capTry(()=>r.enableMorph!==false)):'-'} apronMorphTargets=${counts} apronDriver=${d?capTok(d.status):'-'}${d&&d.reason?' apronDriverReason='+capTok(d.reason):''}`;}

/** ---------- read-only observers ---------- */
class Observers {
 private bgmPlaying:boolean|null=null;private audioHooked=false;private cheerHooked=false;private flowHooked:any=null;private settleHookFor:any=null;private settleHookAvailable=false;
 private craneHookFor:any=null;private craneReported=false;private settle:{place:string;since:number;last:number[]|null;still:number;done:boolean}|null=null;private lastState:string|null=null;private reportedNoHook=false;
 constructor(private ctx:Ctx){
  game.on(Game.EVENT_HIDE,()=>{ctx.mark('app:hide','source=cc.game');this.peakSummary('app-hide');});game.on(Game.EVENT_SHOW,()=>ctx.mark('app:show','source=cc.game'));
  try{G.wx?.onHide?.(()=>ctx.mark('app:wx-hide'));G.wx?.onShow?.(()=>ctx.mark('app:wx-show'));}catch{}
 }
 tick(){this.hookAudio();this.hookCheerText();this.pollBgm();this.hookFlow();this.cameraSettle();this.hookPropTaps();this.hookMotion();this.trackRoomReady();this.hookUnlock();this.hookMusicStart();this.flushMusicStart();this.samplePeak();this.deviceCaps();this.poseLive();}
 /** device:caps once: when the boot is ready (apron renderer bound, __worldIntegration.morph available) or 20 s after install. */
 private capsDone=false;
 private deviceCaps(){if(this.capsDone)return;const ready=this.ctx.ready(this.ctx.findBoot());if(!ready&&now()-this.ctx.t0<CAPS_TIMEOUT_MS)return;this.capsDone=true;
  let extra='';try{extra=deviceCapsFields()+(ready?'':' worldReady=0');}catch(e){extra='error='+capTok(String(e));}this.ctx.mark('device:caps',extra);}
 /** anim:pose-live (GGbot work/GGbot-animfix, Mac r4 'girl slides in bind pose'): proof that bones really move. While the walk
  *  driver's clip (__worldLoading.motion().clip) is a walk/turn, sit or other action clip, the girl's thigh.L and spine LOCAL
  *  rotations are read at the start of that activity and ~POSE_WINDOW_MS later; the mark carries both angular deltas plus whether
  *  the engine state of the clip has a clip evaluator (SkeletalAnimationState._clipEval; without it sample() writes nothing).
  *  Static holds (sit_hold) also report vsWalk = thigh.L vs the last walk sample. Max POSE_MAX marks per activity. Read-only. */
 private poseWin:{act:string;clip:string;since:number;q:{[b:string]:number[]|null};done:boolean}|null=null;private poseN:{[a:string]:number}={};
 private poseLastWalk:number[]|null=null;private poseGirl:any=null;private poseBones:{[b:string]:any}={};private poseAnim:any=null;
 private poseNodes(){let g=this.poseGirl;if(!g||!g.isValid){g=null;this.poseBones={};this.poseAnim=null;const sc:any=capTry(()=>director.getScene());if(!sc)return null;
   const q:any[]=[sc];let seen=0;while(q.length&&seen<20000&&!g){const n=q.shift();seen++;if(n&&n.name===POSE_GIRL)g=n;const k=n&&n.children;if(k)for(let i=0;i<k.length;i++)q.push(k[i]);}
   this.poseGirl=g;if(!g)return null;
   const q2:any[]=[g];seen=0;while(q2.length&&seen<5000){const n=q2.shift();seen++;if(!n)continue;if(POSE_BONES.indexOf(n.name)>=0&&!this.poseBones[n.name])this.poseBones[n.name]=n;
    if(!this.poseAnim){const a=capTry(()=>n.getComponent('cc.SkeletalAnimation'));if(a)this.poseAnim=a;}const k=n.children;if(k)for(let i=0;i<k.length;i++)q2.push(k[i]);}}
  return g;}
 private poseRot(name:string):number[]|null{const n=this.poseBones[name];const r:any=n?capTry(()=>n.rotation||(typeof n.getRotation==='function'?n.getRotation():null)):null;
  return r&&isFinite(r.w)?[Number(r.x)||0,Number(r.y)||0,Number(r.z)||0,Number(r.w)]:null;}
 private poseLive(){const wl=G.__worldLoading;const d:any=wl&&typeof wl.motion==='function'?capTry(()=>wl.motion()):null;const clip=d&&typeof d.clip==='string'?d.clip:'';
  const act=!clip?'':/^(walk|turn)/.test(clip)?'walk':/^sit/.test(clip)?'sit':/^(idle|stand)/.test(clip)?'':'action';
  if(!act){this.poseWin=null;return;}if(!this.poseNodes())return;
  const w=this.poseWin;if(!w||w.act!==act){const q:{[b:string]:number[]|null}={};for(let i=0;i<POSE_BONES.length;i++)q[POSE_BONES[i]]=this.poseRot(POSE_BONES[i]);this.poseWin={act:act,clip:clip,since:now(),q:q,done:false};return;}
  const dt=now()-w.since;if(w.done||dt<POSE_WINDOW_MS)return;w.done=true;
  const th=this.poseRot('thigh.L'),sp=this.poseRot('spine');if(act==='walk'&&th)this.poseLastWalk=th;
  const n=(this.poseN[act]||0)+1;this.poseN[act]=n;if(n>POSE_MAX)return;
  const dA=(a:number[]|null,b:number[]|null)=>a&&b?2*Math.acos(Math.min(1,Math.abs(a[0]*b[0]+a[1]*b[1]+a[2]*b[2]+a[3]*b[3])))*180/Math.PI:null;
  const f2=(v:number|null)=>v===null?'-':v.toFixed(2);const dTh=dA(w.q['thigh.L'],th),dSp=dA(w.q['spine'],sp),vsWalk=act==='sit'?dA(this.poseLastWalk,th):null;
  const an=this.poseAnim;const st:any=an?capTry(()=>an.getState(clip)||an.getState(w.clip)):null;
  const ev=st?(st._clipEval?1:0):'-',baked=an?(an.useBakedAnimation?1:0):'-';const m:any=d.motion||{};const de=m.clipEval&&typeof m.clipEval==='object'?(m.clipEval.clipEval===null?'-':m.clipEval.clipEval?1:0):'-';
  const moved=(dTh!==null&&dTh>=POSE_LIVE_DEG)||(dSp!==null&&dSp>=POSE_LIVE_DEG);
  const verdict=!th&&!sp?'no-bones':moved?'live':act==='sit'&&vsWalk===null?'static-hold':vsWalk!==null&&vsWalk>=POSE_SIT_DEG?'live':'frozen';
  this.ctx.mark('anim:pose-live',`activity=${act} n=${n} clip=${capTok(w.clip)}${clip!==w.clip?'->'+capTok(clip):''} action=${capTok(d.action??'-')} clipEval=${ev} driverClipEval=${de} baked=${baked}`+
   ` repaired=${Array.isArray(m.repairedStates)?m.repairedStates.length:'-'} blend=${m.blend===undefined?'-':m.blend?1:0} thighL=${f2(dTh)} spine=${f2(dSp)} vsWalkThighL=${f2(vsWalk)} dtMs=${Math.round(dt)} verdict=${verdict}`);}
 /** Walk driver (GGbot work/GGbot-walk): __worldIntegration.onFoot / onApronLift. Absent = not merged = no mark. */
 private motionFor:any=null;private motionOff:Array<()=>void>=[];
 private hookMotion(){const w=G.__worldIntegration;if(!w||w===this.motionFor||typeof w.onFoot!=='function')return;for(let i=0;i<this.motionOff.length;i++){try{this.motionOff[i]();}catch{}}this.motionOff=[];this.motionFor=w;const ctx=this.ctx;
  const f3=(v:any)=>typeof v==='number'&&isFinite(v)?v.toFixed(3):'-';
  try{const off=w.onFoot((e:any)=>{const p=e&&e.pos;ctx.mark('anim:foot',`event=${e?.event} bone=${e?.bone} body=${e?.body} clip=${e?.clip} phase=${f3(e?.phase)} cycle=${e?.cycle} pos=${p?f3(p[0])+','+f3(p[2]):'-'}`);});if(typeof off==='function')this.motionOff.push(off);
   if(typeof w.onApronLift==='function'){const off2=w.onApronLift((strength:string,dur:number)=>ctx.mark('anim:apron-lift',`strength=${strength} dur=${f3(dur)}`));if(typeof off2==='function')this.motionOff.push(off2);}
   ctx.mark('anim:hooked','source=__worldIntegration');}catch(e){ctx.mark('anim:hooked','failed='+String(e));}}
 /** Audio unlock (GGbot work/GGbot-audiounlock): AudioUnlock publishes __audioUnlock.onUnlock (replays if already unlocked).
  *  audio:unlock is logged ONCE. Without __audioUnlock (older builds) the first gestureSeen false->true is logged instead.
  *  audio:playback follows GameAudio.musicDiagnostics().playbackState (pending -> playing after the unlock). Read-only. */
 private unlockFor:any=null;private unlockAtT:number|null=null;private unlockDone=false;private unlockNoticed=false;private playback:string|null=null;
 private musicDiag(){const C:any=js.getClassByName('GameAudio');const a=C?.instance;if(!a||typeof a.musicDiagnostics!=='function')return null;try{return a.musicDiagnostics();}catch{return null;}}
 private unlockFields(d:any){return `gestureSeen=${d?(d.gestureSeen?1:0):'-'} status=${d?.status??'-'} playbackState=${d?.playbackState??'-'} playing=${d?(d.playing?1:0):'-'}`;}
 private hookUnlock(){const ctx=this.ctx,u=G.__audioUnlock;
  if(u&&u!==this.unlockFor&&typeof u.onUnlock==='function'){this.unlockFor=u;
   try{let sync=true;u.onUnlock((info:any)=>{if(this.unlockDone)return;this.unlockDone=true;const at=Number(info?.at);this.unlockAtT=Number.isFinite(at)?at:now();
     ctx.mark('audio:unlock',`source=${info?.source??'-'} event=${info?.event||'-'} ms=${Number.isFinite(at)?Math.round(at-ctx.t0):'-'} replay=${sync?1:0} via=__audioUnlock `+this.unlockFields(this.musicDiag()||info?.diagnostics));});sync=false;
    ctx.mark('audio:unlock-hook','status=subscribed');}catch(e){ctx.mark('audio:unlock-hook','status=subscribe-failed');}}
  const d=this.musicDiag();
  if(!u&&!this.unlockNoticed&&d){this.unlockNoticed=true;ctx.mark('audio:unlock-hook','status=unavailable using=gestureSeen-poll');}
  if(!u&&!this.unlockDone&&d?.gestureSeen){this.unlockDone=true;this.unlockAtT=now();ctx.mark('audio:unlock','source=unknown event=- ms=- replay=0 via=gestureSeen-poll '+this.unlockFields(d));}
  const pb=d?String(d.playbackState):null;if(pb!==null&&pb!==this.playback){const from=this.playback;this.playback=pb;ctx.mark('audio:playback',`from=${from??'-'} to=${pb} gestureSeen=${d.gestureSeen?1:0} status=${d.status??'-'} path=${d.path??'-'}`);}}
 /** BGM actually started (Voice bot GameAudio v0.5, work/Voice-bot-pack 53f5999): GameAudio.onMusicStart(cb) (static), else
  *  globalThis.__gameAudioMusic.onMusicStart(cb). audio:bgm-start is logged ONCE, for the first event with first:true (re-fires after
  *  background/unmute carry first:false and are ignored). If T0 subscribes after that start already happened, __gameAudioMusic.lastStart()
  *  / musicDiagnostics().lastStart is replayed (replay=1). Absent API (GameAudio before v0.5) = no mark, nothing thrown.
  *  The mark is emitted on the next T0 tick (after hookUnlock), so a same-frame unlock is already known; startMs is the start itself.
  *  Clocks: info.at/requestedAt/loadedAt are GameAudio.now() (Date.now); T0/AudioUnlock use performance.now -> start mapped by
  *  now()-(GameAudio.now()-info.at). Room ready = first T0 frame with __worldLoading.snapshot().phase==='ready' (SceneMusic's own
  *  gate), else the boot's loadPhase ready (frame precision). Read-only. */
 private roomReadyAt:number|null=null;private roomReadyVia='-';
 private musicStartFor:any=null;private musicStartVia='';private bgmStartDone=false;private bgmStartPending:{info:any;startT:number;replay:boolean;via:string}|null=null;
 private trackRoomReady(){if(this.roomReadyAt!==null)return;let via='';
  try{const wl=G.__worldLoading;const sn=wl&&typeof wl.snapshot==='function'?wl.snapshot():null;if(sn&&sn.phase==='ready')via='__worldLoading';}catch(e){/* ignore */}
  if(!via&&!G.__worldLoading){try{if(this.ctx.ready(this.ctx.findBoot()))via='boot.loadPhase';}catch(e){/* ignore */}}
  if(via){this.roomReadyAt=now();this.roomReadyVia=via;}}
 private hookMusicStart(){if(this.bgmStartDone||this.bgmStartPending)return;let C:any=null;try{C=js.getClassByName('GameAudio');}catch(e){C=null;}
  let host:any=null,via='';
  try{if(C&&typeof C.onMusicStart==='function'){host=C;via='GameAudio.onMusicStart';}
   else{const g=G.__gameAudioMusic;if(g&&typeof g.onMusicStart==='function'){host=g;via='__gameAudioMusic.onMusicStart';}}}catch(e){host=null;}
  if(!host||host===this.musicStartFor)return;this.musicStartFor=host;this.musicStartVia=via;
  try{host.onMusicStart((info:any)=>{try{this.onMusicStart(info,false);}catch(e){/* ignore */}});this.ctx.mark('audio:bgm-start-hook','status=subscribed via='+via);}
  catch(e){this.ctx.mark('audio:bgm-start-hook','status=subscribe-failed via='+via);return;}
  let last:any=null;try{const g=G.__gameAudioMusic;last=g&&typeof g.lastStart==='function'?g.lastStart():null;}catch(e){last=null;}
  if(!last){try{const a=C&&C.instance;const d=a&&typeof a.musicDiagnostics==='function'?a.musicDiagnostics():null;last=d?d.lastStart:null;}catch(e){last=null;}}
  if(last&&last.first===true)this.onMusicStart(last,true);}
 private onMusicStart(info:any,replay:boolean){if(this.bgmStartDone||this.bgmStartPending||!info||info.first!==true)return;
  const t=now(),at=Number(info.at);let gaNow=NaN;try{const C:any=js.getClassByName('GameAudio');gaNow=Number(C&&typeof C.now==='function'?C.now():Date.now());}catch(e){gaNow=Date.now();}
  const lag=gaNow-at,startT=Number.isFinite(lag)&&lag>=0&&lag<600000?t-lag:t; // replay lag; clock mismatch -> now
  this.bgmStartPending={info:info,startT:startT,replay:replay,via:this.musicStartVia||'-'};}
 private flushMusicStart(){const p=this.bgmStartPending;if(!p||this.bgmStartDone)return;this.bgmStartPending=null;this.bgmStartDone=true;
  const num=(v:any)=>typeof v==='number'&&isFinite(v)?v:null;const i=p.info,at=num(i.at),req=num(i.requestedAt),ld=num(i.loadedAt);
  const d=(a:number|null,b:number|null)=>a===null||b===null?'-':String(Math.round(b-a));
  const reqT=req!==null&&at!==null?p.startT-(at-req):null;
  this.ctx.mark('audio:bgm-start',`path=${capTok(i.path)} bundle=${capTok(i.bundle)} fadeIn=${i.fadeIn?1:0} startMs=${Math.round(p.startT-this.ctx.t0)}`+
   ` unlockToStartMs=${d(this.unlockAtT,p.startT)} requestToLoadMs=${d(req,ld)} loadToStartMs=${d(ld,at)} requestToStartMs=${d(req,at)}`+
   ` roomReadyToRequestMs=${d(this.roomReadyAt,reqT)} roomReadyToStartMs=${d(this.roomReadyAt,p.startT)} roomReadyVia=${this.roomReadyVia}`+
   ` unlocked=${this.unlockAtT!==null?1:0} via=${p.via} replay=${p.replay?1:0}`);}
 /** audio:peak-instances (for Voice bot: WeChat caps simultaneous InnerAudioContexts; flag > 8). Every frame: playing cc.AudioSource
  *  components = scene scan (cached, refreshed every 1 s: GameAudio, WindAudio, AmbienceAudio, AmbienceNight... all add AudioSource to
  *  their nodes) + GameAudio.instance sfxVoices/loopSource/loopPartner/fadeOutSource read live (voices created between refreshes).
  *  Logged on every NEW maximum (peak, clips), and ONE summary (summary=1) when the autoplay runner finishes, else at the first app hide.
  *  Raw wx.createInnerAudioContext users that bypass cc.AudioSource are NOT counted. Read-only; every probe try/catch. */
 private peakMax=0;private peakAt=0;private peakClips='-';private peakCache:any[]=[];private peakCacheAt=-1e9;private peakSamples=0;
 private overMs=0;private overSince:number|null=null;private peakCur=-1;private peakSummaryDone=false;
 private samplePeak(){try{const t=now();
  if(t-this.peakCacheAt>=1000){this.peakCacheAt=t;let list:any[]=[];try{const sc:any=director.getScene();list=sc&&typeof sc.getComponentsInChildren==='function'?(sc.getComponentsInChildren(AudioSource)||[]):[];}catch(e){list=[];}this.peakCache=list;}
  const all:any[]=[];const add=(x:any)=>{if(x&&all.indexOf(x)<0)all.push(x);};
  for(let i=0;i<this.peakCache.length;i++)add(this.peakCache[i]);
  let a:any=null;try{const C:any=js.getClassByName('GameAudio');a=C?C.instance:null;}catch(e){a=null;}
  if(a){try{const v=a.sfxVoices;if(v&&typeof v.forEach==='function')v.forEach((_x:any,k:any)=>add(k&&k.playing!==undefined?k:(_x&&_x.source)));}catch(e){/* ignore */}
   try{add(a.loopSource);add(a.loopPartner);add(a.fadeOutSource);}catch(e){/* ignore */}}
  const clips:string[]=[];let n=0;for(let i=0;i<all.length;i++){let on=false;try{on=!!all[i].playing&&all[i].isValid!==false;}catch(e){on=false;}if(on){n++;let c='-';try{c=String(all[i].clip&&all[i].clip.name||'-');}catch(e){c='-';}clips.push(c);}}
  this.peakSamples++;
  if(n>8){if(this.overSince===null)this.overSince=t;}else if(this.overSince!==null){this.overMs+=t-this.overSince;this.overSince=null;}
  if(n>this.peakMax){this.peakMax=n;this.peakAt=t;this.peakClips=capTok(clips.join(','));
   this.ctx.mark('audio:peak-instances',`peak=${n} playing=${n} clips=${this.peakClips} limit=8 over=${n>8?1:0} sources=${all.length}`);}
  this.peakCur=n;}catch(e){/* ignore */}}
 peakSummary(reason:string){if(this.peakSummaryDone)return;this.peakSummaryDone=true;try{const t=now();const over=this.overMs+(this.overSince!==null?t-this.overSince:0);
  this.ctx.mark('audio:peak-instances',`summary=1 reason=${reason} peak=${this.peakMax} peakAtMs=${this.peakMax?Math.round(this.peakAt-this.ctx.t0):'-'} peakClips=${this.peakClips} limit=8 over=${this.peakMax>8?1:0} overMs=${Math.round(over)} now=${this.peakCur<0?'-':this.peakCur} samples=${this.peakSamples}`);}catch(e){/* ignore */}}
 /** T9: IslandPropTaps via the boot's QA object (__worldIntegration.onPropTap); real and injected taps alike. Absent = T9 not merged = no mark. */
 private propTapsFor:any=null;private propTapsOff:(()=>void)|null=null;
 private hookPropTaps(){const w=G.__worldIntegration;if(!w||w===this.propTapsFor||typeof w.onPropTap!=='function')return;this.propTapsOff?.();this.propTapsFor=w;const ctx=this.ctx;
  try{const off=w.onPropTap((target:string,phase:string,info:any)=>ctx.mark('ui:tap',`target=${target} phase=${phase} blocked=${info?.blocked?1:0} props=${info?.props?1:0}`));this.propTapsOff=typeof off==='function'?off:null;ctx.mark('ui:tap-hooked','source=__worldIntegration.onPropTap');}catch(e){ctx.mark('ui:tap-hooked','failed='+String(e));}}
 /** Wrap GameAudio prototype methods: call the original unchanged, then log. No gameplay path is altered. */
 private hookAudio(){if(this.audioHooked)return;const C:any=js.getClassByName('GameAudio');if(!C?.prototype?.play)return;this.audioHooked=true;const P=C.prototype,ctx=this.ctx;let source='';
  const wrap=(name:string,after:(self:any,args:any[],before:any)=>void,before?:(self:any,args:any[])=>any)=>{const orig=P[name];if(typeof orig!=='function')return;P[name]=function(this:any,...args:any[]){const b=before?.(this,args);const r=orig.apply(this,args);try{after(this,args,b);}catch{}return r;};};
  // play(): log request + what GameAudio actually did (new AudioSource voice or dropped), clip, effective volume.
  wrap('play',(self,[n,v],before)=>{const sus=self.reasons?.size?1:0,muted=self.muted?1:0;let voice:any=null;try{Array.from<any>(self.sfxVoices?.values?.()??[]).forEach(x=>{if(!before.has(x.source))voice=x;});}catch{}
   const src=voice?.source,vol=src?Number(src.volume):Math.max(0,Math.min(1,Number.isFinite(v)?v:1)),eff=muted||sus?0:vol;
   ctx.mark('audio:sfx',`name=${n} accepted=${voice?1:0} clip=${src?.clip?.name??'-'} vol=${fmt(vol)} effVol=${fmt(voice?eff:0)} loop=${src?.loop?1:0} dur=${fmt(src?.duration??src?.clip?.duration)} muted=${muted} suspended=${sus}`);
   if(n==='sfx_level_clear')ctx.mark('audio:level-complete','accepted='+(voice?1:0));if(n==='sfx_chest_open')ctx.mark('audio:chest','source='+(source||'other')+' accepted='+(voice?1:0));},
   (self)=>{const set=new Set<any>();try{Array.from<any>(self.sfxVoices?.values?.()??[]).forEach(x=>set.add(x.source));}catch{}return set;});
  wrap('onBoardFrame',(self,[v])=>{if(v?.kind==='clear'){const c=self.cascade,tier=c<=1?'normal':c===2?'combo_1':c===3?'combo_2':'combo_3';ctx.mark('audio:clear',`wave=${c} tier=${tier}${v.gbSynthetic?' synthetic=1 token='+v.token:''}`);}else if(v?.kind==='action')ctx.mark('audio:combo-reset');});
  wrap('onChestResult',()=>{source='';},()=>{source='chest';});wrap('onClaimResult',()=>{source='';},()=>{source='claim';});
  wrap('setMusic',(_s,a)=>ctx.mark('audio:bgm-set','path='+a[0]+(a.length>1?' bundle='+(a[1]||'-'):'')+(a[2]&&a[2].fadeIn?' fadeIn=1':'')));
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
   if(isPropTarget(st.target)){const p=ctx.uiPoint(PROP_TARGET_NODE[st.target]);return p?p:{error:'prop-target-not-found:'+st.target+'('+PROP_TARGET_NODE[st.target]+')'};}
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

/** ---------- boot timing (GrokbotBoot.ts): startup-phase boot:* marks. Read-only wrappers/polls; shipped startup code is not edited. ----------
 * Hooks: game.totalTime, director scene events + EVENT_AFTER_DRAW, assetManager.loadBundle and each loaded bundle's load/loadDir
 * (callback wrapped, args/return/this unchanged), the Boot's own fields (loadPhase, status label, loadingMask/loadingBackdrop),
 * cc SplashScreen (if exposed), the prelude's game.js time + wx.loadSubpackage record, camera-settled / audio:unlock marks. */
const BOOT_CAP_MS=120000,BOOT_ASSET_MAX=40;
class BootProbe {
 readonly tl:BootTimeline;private assets=0;private lastPhase:string|null=null;private lastStatus:string|null=null;private shown=false;private fade=false;
 private subEmitted=0;private splashState:'unknown'|'none'|'running'|'done'='unknown';private walkHomeAt:number|null=null;private returns=0;private lastState:string|null=null;
 private wrapped:any[]=[];private hasDraw=false;
 constructor(private ctx:Ctx){
  const nowE=()=>Date.now(),o=pickOrigin(G,nowE());this.tl=new BootTimeline(o,nowE,(n,e)=>ctx.mark(n,e));const tl=this.tl,pre=G.__gbBoot;
  if(pre&&typeof pre.epoch==='number'&&o.via==='prelude-game.js')tl.point('game-js','via=prelude perf='+(pre.perf===null||pre.perf===undefined?'-':Math.round(pre.perf)),pre.epoch);
  try{const tt=Number((game as any).totalTime);if(isFinite(tt)&&tt>=0)tl.point('engine-init','via=game.totalTime totalTimeMs='+Math.round(tt),nowE()-tt);}catch(e){/* ignore */}
  let perfOrigin='-';try{const to=G.performance&&G.performance.timeOrigin;if(typeof to==='number'&&isFinite(to))perfOrigin=String(Math.round(to));}catch(e){/* ignore */}
  let scene0=0;try{scene0=director.getScene()?1:0;}catch(e){/* ignore */}
  tl.point('t0-eval',`origin=${o.via} originEpoch=${Math.round(o.epoch)} perfTimeOrigin=${perfOrigin} sceneAtEval=${scene0} frameAtEval=${frameNo()} prelude=${pre?1:0} subWrapped=${pre&&pre.subWrapped?1:0}`);
  try{const gi=(Game as any).EVENT_GAME_INITED;if((game as any).inited)tl.point('game-inited','via=already-at-eval');else if(gi&&typeof (game as any).once==='function')(game as any).once(gi,()=>tl.point('game-inited','via=event'));}catch(e){/* ignore */}
  const D:any=Director,ev:[string,string][]=[[D.EVENT_BEFORE_SCENE_LOADING,'scene-loading'],[D.EVENT_BEFORE_SCENE_LAUNCH,'scene-launch-begin'],[D.EVENT_AFTER_SCENE_LAUNCH,'scene-launch-end']];
  for(let i=0;i<ev.length;i++){const e=ev[i];if(typeof e[0]!=='string')continue;try{director.on(e[0],(sc:any)=>{tl.point(e[1],'scene='+tok(sc&&sc.name!==undefined?sc.name:(typeof sc==='string'?sc:'-')));});}catch(x){/* ignore */}}
  if(scene0)tl.point('scene-launch-end','missed=1 reason=scene-existed-at-t0-eval');
  if(typeof D.EVENT_AFTER_DRAW==='string'){try{director.on(D.EVENT_AFTER_DRAW,()=>this.frame('after-draw'));this.hasDraw=true;}catch(e){/* ignore */}}
  this.wrapLoadBundle();try{if(resources)this.wrapBundle(resources,'resources');}catch(e){/* ignore */}
  this.launchInfo();this.splash();
  ctx.taps.push((n,e)=>this.onMark(n,e));
 }
 private live(){return !this.tl.summarized;}
 private wrapLoadBundle(){const am:any=assetManager;if(!am||typeof am.loadBundle!=='function'||BootProbe.amWrapped===am)return;BootProbe.amWrapped=am;const orig=am.loadBundle,self=this;
  am.loadBundle=function(this:any){const args=Array.prototype.slice.call(arguments),name=typeof args[0]==='string'?args[0]:'?',b=Date.now();
   try{let cached=0;try{cached=am.getBundle&&am.getBundle(name)?1:0;}catch(x){/* ignore */}self.tl.point('bundle-begin:'+name,'cached='+cached);}catch(x){/* ignore */}
   let i=args.length-1;while(i>=0&&typeof args[i]!=='function')i--;
   if(i>=0){const cb=args[i];args[i]=function(this:any,err:any,bundle:any){try{self.tl.point('bundle-end:'+name,`durMs=${Date.now()-b} ok=${err?0:1}`+(err?' err='+tok(err&&err.message||err):''));if(!err&&bundle)self.wrapBundle(bundle,name);}catch(x){/* ignore */}
    return cb.apply(this,arguments);};}
   return orig.apply(this,args);};}
 static amWrapped:any=null;
 private wrapBundle(bundle:any,name:string){if(!bundle||this.wrapped.indexOf(bundle)>=0)return;this.wrapped.push(bundle);const self=this,fns=['load','loadDir'];
  for(let k=0;k<fns.length;k++){const fn=fns[k],orig=bundle[fn];if(typeof orig!=='function')continue;
   bundle[fn]=function(this:any){const args=Array.prototype.slice.call(arguments),b=Date.now();if(!self.live())return orig.apply(this,args);
    const p=args[0],path=typeof p==='string'?p:(Array.isArray(p)?p.slice(0,2).join(',')+(p.length>2?',+'+(p.length-2):''):'?');
    let i=args.length-1;while(i>=0&&typeof args[i]!=='function')i--;
    if(i>=0){const cb=args[i];args[i]=function(this:any,err:any,res:any){try{if(self.live()&&self.assets<BOOT_ASSET_MAX){self.assets++;
      self.tl.note('asset',`bundle=${tok(name)} fn=${fn} path=${tok(path)} beginT=${self.tl.rel(b)} durMs=${Date.now()-b} ok=${err?0:1} n=${Array.isArray(res)?res.length:(res?1:0)}`);}}catch(x){/* ignore */}
     return cb.apply(this,arguments);};}
    return orig.apply(this,args);};}}
 private launchInfo(){const wx=G.wx;if(!wx)return;
  try{const o=wx.getLaunchOptionsSync&&wx.getLaunchOptionsSync();if(o){const q=o.query||{};this.tl.note('launch',`scene=${tok(o.scene)} queryKeys=${tok(Object.keys(q).join(','))} referrer=${tok(o.referrerInfo&&o.referrerInfo.appId)}`);}}catch(e){this.tl.note('launch','error='+tok(e));}
  try{const p=wx.getPerformance&&wx.getPerformance();if(p){let ents:any[]=[];try{ents=typeof p.getEntries==='function'?(p.getEntries()||[]):[];}catch(x){ents=[];}
    const sh:string[]=[];for(let i=0;i<ents.length&&i<6;i++){const e=ents[i];sh.push(tok(e&&(e.name||e.entryType))+'@'+Math.round(Number(e&&e.startTime))+'+'+Math.round(Number(e&&e.duration)));}
    // unit of wx Performance.now() differs by base library (ms or us); logged raw next to performance.now() so the round can compare
    this.tl.note('wx-perf',`now=${typeof p.now==='function'?Math.round(p.now()):'-'} perfNow=${Math.round(now())} entries=${ents.length} first=${tok(sh.join(','))}`);}}catch(e){this.tl.note('wx-perf','error='+tok(e));}}
 private splash(){if(this.splashState==='done'||this.splashState==='none')return;let S:any=null;
  try{const cc=G.cc;S=cc&&((cc.internal&&cc.internal.SplashScreen)||cc.SplashScreen);}catch(e){S=null;}
  let inst:any=null;try{inst=S&&(S.instance||(typeof S.getInstance==='function'?S.getInstance():null));}catch(e){inst=null;}
  if(!inst||typeof inst.isFinished!=='boolean'){if(this.splashState==='unknown'){this.splashState='none';this.tl.note('splash-unavailable','reason=no-cc.SplashScreen.instance.isFinished');}return;}
  if(!inst.isFinished){if(this.splashState!=='running'){this.splashState='running';this.tl.point('splash-shown','via=SplashScreen.isFinished=false');}return;}
  this.tl.point('splash-end','via=SplashScreen.isFinished'+(this.splashState==='unknown'?' finished-before-t0-eval=1':''));this.splashState='done';}
 private frame(via:string){if(this.tl.has('room-first-frame'))return;const b=this.ctx.findBoot();if(!b||b.loadPhase!=='ready')return;
  const m=b.loadingMask,bd=b.loadingBackdrop,hasLayer=!!(m||bd);if(hasLayer&&!this.tl.has('loading-hidden'))return;if(this.ctx.state()!=='home')return;
  this.tl.point('room-first-frame',`via=${via} frame=${frameNo()}${hasLayer?'':' loadingLayer=absent'}`);this.tl.summary('room-first-frame');}
 private onMark(n:string,e:string){if(n.indexOf('boot:')===0)return;
  if(n.indexOf('camera-settled:')===0){const place=n.slice(15);this.tl.point('camera-first-settled','place='+tok(place)+' '+tok((/source=\S+/.exec(e)||['-'])[0]));
   if(place==='home'&&this.walkHomeAt!==null){this.returns++;this.tl.note('camera-return-settled',`n=${this.returns} sinceWalkingHomeMs=${Date.now()-this.walkHomeAt} ${tok((/source=\S+/.exec(e)||['-'])[0])}`);this.walkHomeAt=null;}}
  else if(n==='audio:unlock')this.tl.point('audio-unlock',tok((/source=\S+/.exec(e)||['-'])[0]));}
 tick(){const tl=this.tl;if(tl.rel()>BOOT_CAP_MS&&!tl.summarized)tl.summary('cap-'+BOOT_CAP_MS);
  const s=this.ctx.state();if(s!==this.lastState){this.lastState=s;if(s==='walking-home')this.walkHomeAt=Date.now();}
  if(tl.has('room-first-frame')&&tl.summarized)return;
  this.splash();this.subpackages();
  const b=this.ctx.findBoot();if(!b)return;tl.point('boot-found','loadPhase='+tok(b.loadPhase));
  const ph=String(b.loadPhase);if(ph!==this.lastPhase){const from=this.lastPhase;this.lastPhase=ph;tl.note('phase',`from=${tok(from)} to=${tok(ph)} progress=${tok(b.loadProgress)}`);
   if(ph==='loading')tl.point('world-loading');else if(ph==='ready')tl.point('world-ready');else if(ph==='error')tl.note('world-error','error='+tok(b.error));}
  let st:string|null=null;try{st=b.status&&typeof b.status.string==='string'?b.status.string:null;}catch(e){st=null;}
  if(st!==null&&st!==this.lastStatus){this.lastStatus=st;tl.note('status','text='+tok(st));}
  const on=(n:any)=>{try{return !!n&&n.isValid!==false&&n.active!==false;}catch(e){return false;}};const m=b.loadingMask,bd=b.loadingBackdrop,vis=on(m)||on(bd);
  if(vis&&!this.shown){this.shown=true;tl.point('loading-shown',`mask=${on(m)?1:0} backdrop=${on(bd)?1:0}`);}
  if(on(bd)){let sf:any=null;try{const sp=bd.getComponent&&bd.getComponent('cc.Sprite');sf=sp&&sp.spriteFrame;}catch(e){sf=null;}if(sf)tl.point('loading-image','via=backdrop.spriteFrame');
   let op:any=null;try{const u=bd.getComponent&&bd.getComponent('cc.UIOpacity');op=u?Number(u.opacity):null;}catch(e){op=null;}if(op!==null&&op<255&&!this.fade){this.fade=true;tl.point('loading-fade-start','opacity='+Math.round(op));}}
  if(this.shown&&!vis)tl.point('loading-hidden','fade='+(this.fade?'opacity':'none(hard-cut)'));
  if(!this.hasDraw)this.frame('after-update');}
 private subpackages(){const pre=G.__gbBoot,list=pre&&pre.sub;if(!list||!list.length)return;
  while(this.subEmitted<list.length){const e=list[this.subEmitted];if(!e||e.end===null||e.end===undefined)return;this.subEmitted++;
   this.tl.point('subpackage:'+tok(e.name),`via=wx.loadSubpackage beginT=${this.tl.rel(e.begin)} durMs=${e.end-e.begin} ok=${e.ok?1:0}`,e.end);}}
}
function install(){
 if(G.__GB_AUTOPLAY)return;const cfg:AutoplayConfig|null=parseAutoplayQuery(readQuery(),INSTALLED_DEFAULT_ON);
 if(!cfg){console.log('GB_MARK autoplay-disabled 0');return;}
 const ctx=new Ctx();let bootProbe:BootProbe|null=null;if(readQuery().gbBoot!=='0'){try{bootProbe=new BootProbe(ctx);}catch(e){console.error('GB_MARK boot-probe-exception',e);}}
 const touch=new TouchBackend(ctx),obs=new Observers(ctx);
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
 let waitStarted=false,peakLogged=false;
 const endPeak=(why:string)=>{if(peakLogged)return;peakLogged=true;try{obs.peakSummary(why);}catch(e){/* ignore */}};
 const warmLh=cfg.mode==='out-and-back'||cfg.mode==='touch';
 const tick=()=>{try{obs.tick();}catch(e){console.error('GB_MARK observer-exception',e);}try{ctx.warmLighthouse(warmLh);}catch(e){console.error('GB_MARK lighthouse-warm-exception',e);}try{bootProbe?.tick();}catch(e){console.error('GB_MARK boot-probe-exception',e);}
  if(runner&&!runner.finished()){if(cfg.mode==='touch'&&!waitStarted){if(ctx.state()!=='home'||!ctx.idle())return;waitStarted=true;ctx.mark('world-ready');}
   try{runner.tick();}catch(e){console.error('GB_MARK autoplay-exception',e);ctx.mark('autoplay-failed','reason=exception');runner=null;endPeak('autoplay-end:exception');}
   if(runner&&runner.finished())endPeak('autoplay-end:'+String((runner as any).current??'done'));}};
 director.on(Director.EVENT_AFTER_UPDATE,tick); // stays on: observers keep logging audio/app/camera for manual play too
 G.__GB_AUTOPLAY={config:cfg,touchBackend:touch.kind,phase:()=>runner?((runner as any).current??(runner.finished()?'done':'running')):'observe',touchResults:()=>touchRunner?.results.slice()??[],logFile:ctx.logFile,lighthouse:()=>({...ctx.lhStats})};
}
if(!EDITOR)install();
