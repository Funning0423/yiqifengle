/** 运镜bot full7-cam: per-frame camera console trace for device cut hunting (GGbot request).
 *  On with URL `?camTrace=1` OR `globalThis.__QF_CAM_TRACE` = true / 1 / '1' (set before the game scripts load), checked ONCE when this
 *  module loads (camLogStart at the bottom; imported by WorldFlowComponent / BalloonTransit / RegionBoardLanding).
 *  Off (default): no hook is installed (cameraWriteHook.log stays null), camTag() is one boolean test, nothing allocates.
 *  On: every applyCameraPose write prints ONE console.log line (never warn/error: Console-0 gate):
 *   [QF_CAM_TRACE] f=<write#> t=<s> pos=x,y,z yaw=<deg> pitch=<deg> fov=<deg> w=<writer>[ CHANGE<-prev][ JUMP=<m>m/<deg>deg]
 *  writer = the last camTag() set since the previous write (TransitionCamera, LiveHandoff, SkyWalkShot, BalloonTransit:*,
 *  enter-level, regionBoardHandoff, regionLandingToBoard, RegionJourneyCore:*), else applyCameraPose's own source.
 *  JUMP = position step > CAM_LOG_CAP.m (TRANSITION_CAM per-frame lens cap ·1.05) or view step > CAM_LOG_CAP.deg in one write. */
import { cameraWriteHook } from '../world-r1/CameraPose';
import {debugSearch} from './DebugQuery';
/*QF_PROBE_BEGIN*/import {Director,Game,Input,MeshRenderer,Vec3,assetManager,director,game,input,screen,sys,view} from 'cc';/*QF_PROBE_END*/
/** full9b P0 (Mac A/B: camTrace ON froze the renderer, OFF completed): bounded trace. ≤ linesPerS write lines per wall second
 *  (over budget: counted, the next line carries DROPPED=<n>); ≤ maxStacks CALLER stacks per session; re-entry never writes. */
export const CAM_LOG_BUDGET=Object.freeze({linesPerS:60,maxStacks:200});
export const CAM_LOG_CAP=Object.freeze({m:5/60*1.05,deg:3});
/** r2 P0 (chainJ 23267b2d camTrace ON froze, OFF passed with the same sync screenshots): camTrace printed ~81 console lines/s
 *  (her-frame probe line every frame + one trace line per camera write, 11.3 KB/s, 1.9 lines/frame); in the DevTools appservice every console.* is
 *  forwarded to the DevTools console over IPC. Lines now go to an in-memory sink flushed as ONE console.log per CAM_LOG_SINK.flushMs,
 *  with a hard per-flush cap (lines + bytes); over the cap lines are dropped and counted (sinkDropped, in the flush summary and
 *  __qfCamTraceStats). A flush is emitted in chunks of ≤ CAM_LOG_SINK.chunk chars (the autoplay console capture keeps 4000 per call).
 *  Bounded: ≤ ceil(bytes/chunk)+1 console calls per flushMs and ≤ bytes per flushMs, whatever the frame rate.
 *  Sink is used on a wx host (DevTools / device) or with globalThis.__QF_CAM_SINK=true; Node unit tests without wx keep direct lines. */
export const CAM_LOG_SINK=Object.freeze({flushMs:1000,lines:150,bytes:12*1024,chunk:3800});
export const camSink={buf:[] as string[],bytes:0,last:0,timer:null as any,flushes:0,sinkDropped:0,dropFlush:0,emit:(s:string)=>console.log(s)};
export function camSinkFlush():void{const k=camSink;if(k.timer!==null){try{clearTimeout(k.timer);}catch{}k.timer=null;}k.last=Date.now();
 if(!k.buf.length&&!k.dropFlush)return;const body=k.buf.join('\n');const n=k.buf.length,b=k.bytes,d=k.dropFlush;k.buf=[];k.bytes=0;k.dropFlush=0;k.flushes++;
 const tail='[QF_CAM_LOG] flush='+k.flushes+' lines='+n+' bytes='+b+(d?' DROPPED='+d+' totalDropped='+k.sinkDropped:'');
 let chunk='';for(const l of body?body.split('\n'):[]){if(chunk&&chunk.length+1+l.length>CAM_LOG_SINK.chunk){k.emit(chunk);chunk='';}chunk=chunk?chunk+'\n'+l:l;}
 k.emit(chunk?chunk+'\n'+tail:tail);}
export function camSinkPush(s:string):void{const k=camSink;
 if(k.buf.length>=CAM_LOG_SINK.lines||k.bytes+s.length>CAM_LOG_SINK.bytes){k.sinkDropped++;k.dropFlush++;}else{k.buf.push(s);k.bytes+=s.length+1;}
 if(Date.now()-k.last>=CAM_LOG_SINK.flushMs)camSinkFlush();
 else if(k.timer===null){try{k.timer=setTimeout(camSinkFlush,CAM_LOG_SINK.flushMs);}catch{k.timer=null;}}}
export const camLog={on:false,tag:'',n:0,t0:0,last:'',lp:[0,0,0] as number[],ly:0,lpi:0,has:false,fr:-1,fw:0,cam:0,stacks:false,busy:false,reentry:0,dropped:0,stackN:0,win:-1,winN:0,out:(s:string)=>{if(camSinkOn())camSinkPush(s);else console.log(s);}};
export function camSinkOn():boolean{try{const g:any=globalThis;return g.__QF_CAM_SINK===true||(g.__QF_CAM_SINK!==false&&!!g.wx);}catch{return false;}}
export function camLogEnabled(query:string,g:any):boolean{return /(?:^|[?&])camTrace=1(?:&|$)/.test(query||'')||camFlagOn(g&&g.__QF_CAM_TRACE);}
/** Global switch accepts exactly true / 1 / '1' (also 'true'); '0', 'false', '' and others stay off. */
/** full9b: CALLER stacks (new Error().stack on the 2nd+ write of a frame) only with camTrace on AND `?camTraceStacks=1` or
 *  `globalThis.__QF_CAM_TRACE_STACKS` = true/1/'1'. Plain camTrace prints MULTI=<n> without the stack (cheap). */
export function camStacksEnabled(query:string,g:any):boolean{return /(?:^|[?&])camTraceStacks=1(?:&|$)/.test(query||'')||camFlagOn(g&&g.__QF_CAM_TRACE_STACKS);}
export function camFlagOn(v:unknown):boolean{return v===true||v===1||v==='1'||v==='true';}
/** Writers name themselves just before world.setCamera; no-op when off. */
export function camTag(name:string):void{if(camLog.on)camLog.tag=name;}
/** Only if no more specific writer tagged this frame (e.g. RegionJourneyCore after a SkyWalkShot onFrame). */
export function camTagDefault(name:string):void{if(camLog.on&&!camLog.tag)camLog.tag=name;}
const f3=(v:number)=>(Math.round(v*1000)/1000).toString();
export function camLogWrite(camera:any,pose:{position:readonly number[];rotation:readonly number[];fovVerticalDeg:number},source:string):void{
 if(!camLog.on)return;
 /* full9b: re-entrancy guard — a write that arrives while a trace line is being built/printed (console hook, getter, stack
  * formatter) is counted, never traced (no recursion, no feedback loop) */
 if(camLog.busy){camLog.reentry++;publishStats();return;}
 camLog.busy=true;const cs=camState(camera);camSwap(cs,true);try{camLogWriteInner(camera,pose,source);}finally{camSwap(cs,false);camLog.busy=false;}
}
/** P1 (c88320c1 FINDINGS §2A): frame + pose tracking is PER CAMERA. The board camera (MeadowBoardBackground) and the world camera
 *  (enter-level) writing in the same frame are two streams, not MULTI=2 and not a 39–61 m JUMP; two writers on ONE camera still are. */
type CamState={has:boolean;last:string;lp:number[];ly:number;lpi:number;fr:number;fw:number;id:number};
let camStates=new WeakMap<object,CamState>(),camIds=0;const noCam={};
function camState(camera:any):CamState{const k=camera&&typeof camera==='object'?camera:noCam;let c=camStates.get(k);if(!c){c={has:false,last:'',lp:[0,0,0],ly:0,lpi:0,fr:-1,fw:0,id:++camIds};camStates.set(k,c);}return c;}
function camSwap(c:CamState,load:boolean):void{const L:any=camLog;if(load){L.has=c.has;L.last=c.last;L.lp[0]=c.lp[0];L.lp[1]=c.lp[1];L.lp[2]=c.lp[2];L.ly=c.ly;L.lpi=c.lpi;L.fr=c.fr;L.fw=c.fw;L.cam=c.id;}
 else{c.has=L.has;c.last=L.last;c.lp[0]=L.lp[0];c.lp[1]=L.lp[1];c.lp[2]=L.lp[2];c.ly=L.ly;c.lpi=L.lpi;c.fr=L.fr;c.fw=L.fw;}}
function publishStats():void{try{(globalThis as any).__qfCamTraceStats={reentry:camLog.reentry,dropped:camLog.dropped,stacks:camLog.stackN,lines:camLog.n,sinkDropped:camSink.sinkDropped,sinkFlushes:camSink.flushes};}catch{}}
function camLogWriteInner(camera:any,pose:{position:readonly number[];rotation:readonly number[];fovVerticalDeg:number},source:string):void{
 void camera;/* per-camera state is swapped in by camLogWrite (camSwap) */
/*QF_PROBE_BEGIN*/ gpuProbe.lens=source;/*QF_PROBE_END*/
 const [x,y,z]=pose.position,[qx,qy,qz,qw]=pose.rotation;
 const fx=-2*(qx*qz+qw*qy),fy=-2*(qy*qz-qw*qx),fz=-(1-2*(qx*qx+qy*qy));// forward = q·(0,0,-1)
 const yaw=Math.atan2(fx,-fz)*180/Math.PI,pitch=Math.asin(Math.max(-1,Math.min(1,fy)))*180/Math.PI;
 const w=camLog.tag||source;camLog.tag='';camLog.n++;
 const t=((typeof performance!=='undefined'?performance.now():Date.now())-camLog.t0)/1000;
 let s='[QF_CAM_TRACE] f='+camLog.n+' t='+f3(t)+' pos='+f3(x)+','+f3(y)+','+f3(z)+' yaw='+f3(yaw)+' pitch='+f3(pitch)+' fov='+f3(pose.fovVerticalDeg)+' w='+w+(camLog.cam>1?' cam='+camLog.cam:'');
 if(camLog.has){
  if(w!==camLog.last)s+=' CHANGE<-'+camLog.last;
  const dm=Math.hypot(x-camLog.lp[0],y-camLog.lp[1],z-camLog.lp[2]);let dy=Math.abs(yaw-camLog.ly);if(dy>180)dy=360-dy;const dd=Math.max(dy,Math.abs(pitch-camLog.lpi));
  if(dm>CAM_LOG_CAP.m||dd>CAM_LOG_CAP.deg)s+=' JUMP='+f3(dm)+'m/'+f3(dd)+'deg';
 }
 {/* full9b: writers per frame (gate: ==1). The 2nd+ write in one engine frame names its caller (stack) so an extra writer is traceable. */
  let fr=-1;try{const d=(globalThis as any).cc?.director;fr=d&&typeof d.getTotalFrames==='function'?d.getTotalFrames():-1;}catch{fr=-1;}
  if(fr>=0&&fr===camLog.fr){camLog.fw++;s+=' MULTI='+camLog.fw;if(camLog.stacks&&camLog.stackN<CAM_LOG_BUDGET.maxStacks){camLog.stackN++;let caller='';try{caller=String(new Error().stack||'').split('\n').slice(3,6).map(x=>x.trim()).join(' < ');}catch{}s+=' CALLER='+caller;}}else{camLog.fr=fr;camLog.fw=1;}
  if(fr>=0)s+=' fr='+fr;}
/*QF_PROBE_BEGIN*/ if(camLog.has&&w!==camLog.last)probe.cut={n:++probe.cuts,from:camLog.last,to:w,t0:pnow()}/* full9c probe: first draw after every cut */;
/*QF_PROBE_END*/ camLog.has=true;camLog.last=w;camLog.lp[0]=x;camLog.lp[1]=y;camLog.lp[2]=z;camLog.ly=yaw;camLog.lpi=pitch;
 {const sec=Math.floor(t);if(sec!==camLog.win){camLog.win=sec;camLog.winN=0;}
  if(++camLog.winN>CAM_LOG_BUDGET.linesPerS){camLog.dropped++;publishStats();return;}}
 if(camLog.dropped)s+=' DROPPED='+camLog.dropped;if(camLog.reentry)s+=' REENTRY='+camLog.reentry;
 camLog.out(s/*QF_PROBE_BEGIN*/+' pn='+f3(pnow())/*QF_PROBE_END*/);if((camLog.n&63)===0)publishStats();
}
/** Default world layer bit (cc Layers.Enum.DEFAULT = 1<<30). */
export const CAM_LOG_WORLD_LAYER=1<<30;
const st={fr:0,bad:''};
/** Per-frame state probe (WorldFlowComponent.lateUpdate, only inside `if(camLog.on)`): one line per frame while the world camera
 *  is disabled / missing or its visibility lacks the world layer, and one line when it recovers. */
export function camLogFrame(camera:any):void{
 if(!camLog.on)return;st.fr++;
 const bad=!camera||!camera.node||(camera.node.isValid===false)?'CAM_MISSING':camera.enabledInHierarchy===false||camera.enabled===false?'CAM_OFF':(((camera.visibility|0)&CAM_LOG_WORLD_LAYER)===0?'WORLD_LAYER_OFF':'');
 if(bad)camLog.out('[QF_CAM_TRACE] frame='+st.fr+' '+bad+(camera&&typeof camera.visibility==='number'?' vis=0x'+(camera.visibility>>>0).toString(16):'')/*QF_PROBE_BEGIN*/+' pn='+f3(pnow())/*QF_PROBE_END*/);
 else if(st.bad)camLog.out('[QF_CAM_TRACE] frame='+st.fr+' CAM_OK<-'+st.bad/*QF_PROBE_BEGIN*/+' pn='+f3(pnow())/*QF_PROBE_END*/);
 st.bad=bad;
/*QF_PROBE_BEGIN*/ if(!bad)probeHerFrame(camera,st.fr);
 if(!bad)probeSceneFrame(camera,st.fr);
/*QF_PROBE_END*/}
/*QF_PROBE_BEGIN*//** full9c probes (界面验收部 acceptance, Grok Bot 2026-10-29). TEST ONLY: every entry point returns at `if(!camLog.on)`, and
 *  the draw listener is only installed from camLogFrame (called only inside `if(camLog.on)`), so the release path runs none of it.
 *  - [QF_B1_GAP] {cut,from,to,firstDrawMs,pn}: writer change (= camera cut) → first AFTER_DRAW, at every cut (B1's own line stays).
 *  - her = the bound CharacterAdapter's own node (explicit reference from WorldFlowComponent.initialize/bindCharacter), never a
 *    name or "first skinned mesh" search; exposed as globalThis.__QF_PROBE_HER() for tools/wx-autoplay state.jsonl.
 *  - [QF_HER_FRAME] per frame: her screen bbox (px, origin bottom-left), occluded fraction (15 rays camera→her AABB grid vs other
 *    renderers' AABBs; conservative), safe-area rect. Every probe line carries pn=performance.now() ms. */
const pnow=()=>typeof performance!=='undefined'?performance.now():Date.now();
/** r2: QF_HER_FRAME (bbox + 15-ray occlusion + getComponentsInChildren on her) every HER_FRAME_EVERY frames (~10 Hz), not every frame. */
export const HER_FRAME_EVERY=6;
export const probe={actor:null as any,cut:null as null|{n:number;from:string;to:string;t0:number},cuts:0,hooked:false,occ:[] as number[][],occFr:-1e9,herFr:-1e9};
export function camProbeCharacter(adapter:any):void{if(!camLog.on)return;probe.actor=adapter||null;try{(globalThis as any).__QF_PROBE_HER=probeHer;}catch{}}
export function probeHer():any{const n=probe.actor&&probe.actor.node;return n&&n.isValid!==false?n:null;}
function probeAfterDraw():void{const c=probe.cut;if(!c)return;probe.cut=null;const t=pnow();
 camLog.out('[QF_B1_GAP] '+JSON.stringify({cut:c.n,from:c.from,to:c.to,firstDrawMs:+(t-c.t0).toFixed(1),pn:+t.toFixed(1)}));}
const under=(n:any,root:any)=>{for(let q=n;q;q=q.parent)if(q===root)return true;return false;};
/** segment a→b hits AABB (center c, half h) at parameter in (lo,hi)? (slab test) */
export function segHitsBox(a:number[],b:number[],c:number[],h:number[],lo=1e-3,hi=0.98):boolean{let t0=lo,t1=hi;
 for(let i=0;i<3;i++){const d=b[i]-a[i],mn=c[i]-h[i],mx=c[i]+h[i];if(Math.abs(d)<1e-9){if(a[i]<mn||a[i]>mx)return false;continue;}
  let u=(mn-a[i])/d,v=(mx-a[i])/d;if(u>v){const k=u;u=v;v=k;}t0=Math.max(t0,u);t1=Math.min(t1,v);if(t0>t1)return false;}return true;}
const inBox=(p:number[],c:number[],h:number[])=>Math.abs(p[0]-c[0])<=h[0]&&Math.abs(p[1]-c[1])<=h[1]&&Math.abs(p[2]-c[2])<=h[2];
/** fraction of samples whose camera ray is blocked by an occluder box (boxes containing the camera or the sample are skipped). */
export function occludedFraction(cam:number[],samples:number[][],boxes:number[][]):number{if(!samples.length)return 0;let n=0;
 for(const p of samples){for(const b of boxes){const c=[b[0],b[1],b[2]],h=[b[3],b[4],b[5]];if(inBox(cam,c,h)||inBox(p,c,h))continue;if(segHitsBox(cam,p,c,h)){n++;break;}}}return n/samples.length;}
/** P0 freeze (Mac 7e0f2c72 clean, CDP: lateUpdate → camLogFrame → getSafeAreaRect → WAGameSubContext → appservice sync): the safe area
 *  is a sync host call; read once and again only after a view resize / orientation change. */
let probeSa:any=undefined,probeSaHooked=false;
function probeSafeArea():any{
 if(!probeSaHooked){probeSaHooked=true;const drop=()=>{probeSa=undefined;};try{view.on('canvas-resize',drop);}catch{}try{(screen as any).on?.('window-resize',drop);(screen as any).on?.('orientation-change',drop);}catch{}}
 if(probeSa===undefined){try{probeSa=(sys as any).getSafeAreaRect?.()??null;}catch{probeSa=null;}}
 return probeSa;}
function probeHerFrame(camera:any,fr:number):void{
 if(!camLog.on)return;
 if(!probe.hooked){probe.hooked=true;try{director.on(Director.EVENT_AFTER_DRAW,probeAfterDraw);}catch{}}
 if(fr-probe.herFr<HER_FRAME_EVERY&&fr>=probe.herFr)return;probe.herFr=fr;
 const her=probeHer();if(!her||!camera||typeof camera.worldToScreen!=='function')return;
 try{let lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
  for(const r of her.getComponentsInChildren(MeshRenderer)){const b:any=(r as any).model?.worldBounds;if(!b||!r.enabledInHierarchy)continue;
   for(let i=0;i<3;i++){const k='xyz'[i];lo[i]=Math.min(lo[i],b.center[k]-b.halfExtents[k]);hi[i]=Math.max(hi[i],b.center[k]+b.halfExtents[k]);}}
  if(!(lo[0]<=hi[0]))return;
  const o=new Vec3(),w=new Vec3();let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
  for(let m=0;m<8;m++){w.set(m&1?hi[0]:lo[0],m&2?hi[1]:lo[1],m&4?hi[2]:lo[2]);camera.worldToScreen(o,w);x0=Math.min(x0,o.x);x1=Math.max(x1,o.x);y0=Math.min(y0,o.y);y1=Math.max(y1,o.y);}
  if(fr-probe.occFr>=30){probe.occFr=fr;probe.occ=[];const sc=director.getScene();if(sc)for(const r of sc.getComponentsInChildren(MeshRenderer)){if(!r.enabledInHierarchy||under(r.node,her))continue;const b:any=(r as any).model?.worldBounds;if(b)probe.occ.push([b.center.x,b.center.y,b.center.z,b.halfExtents.x,b.halfExtents.y,b.halfExtents.z]);}}
  const c=[(lo[0]+hi[0])/2,(lo[1]+hi[1])/2,(lo[2]+hi[2])/2],hx=(hi[0]-lo[0])/2,hy=(hi[1]-lo[1])/2,hz=(hi[2]-lo[2])/2,smp:number[][]=[];
  for(const u of [-.6,0,.6])for(const v of [-.8,-.4,0,.4,.8])smp.push([c[0]+u*hx,c[1]+v*hy,c[2]+u*hz]);
  const cp=camera.node.worldPosition,occ=occludedFraction([cp.x,cp.y,cp.z],smp,probe.occ);
  const sa=probeSafeArea();
  camLog.out('[QF_HER_FRAME] fr='+fr+' bbox='+[x0,y0,x1,y1].map(f3).join(',')+' occ='+f3(occ)+' n='+smp.length+' safe='+(sa?[sa.x,sa.y,sa.width,sa.height].map(f3).join(','):'-')+' pn='+f3(pnow()));
 }catch{/* probe only */}
}
/*QF_PROBE_END*//** Stall probe (Grok Bot 2026-10-26): while a walk / board step is active, her position unchanged (< ACTOR_STALL.m) for more
 *  than ACTOR_STALL.s → ONE `[QF_CAM_TRACE] ACTOR_STALL` line (repeated every ACTOR_STALL.s while it lasts). Trace only, the camera is
 *  never moved. Callers guard with `if(camLog.on)`. */
export const ACTOR_STALL=Object.freeze({s:3,m:0.02});
const stall={key:'',x:0,y:0,z:0,since:-1,said:-1};
export function camActorProbe(x:number,y:number,z:number,active:boolean,step:string,nowS?:number):void{
 if(!camLog.on)return;const t=nowS??(((typeof performance!=='undefined'?performance.now():Date.now())-camLog.t0)/1000);
 if(!active||stall.key!==step||Math.hypot(x-stall.x,y-stall.y,z-stall.z)>=ACTOR_STALL.m){stall.key=active?step:'';stall.x=x;stall.y=y;stall.z=z;stall.since=t;stall.said=-1;return;}
 const held=t-stall.since;if(held>ACTOR_STALL.s&&(stall.said<0||t-stall.said>=ACTOR_STALL.s)){stall.said=t;
  camLog.out('[QF_CAM_TRACE] t='+f3(t)+' ACTOR_STALL step='+step+' heldS='+f3(held)+' her='+f3(x)+','+f3(y)+','+f3(z)/*QF_PROBE_BEGIN*/+' pn='+f3(pnow())/*QF_PROBE_END*/);}
}
/** full8: actor/vehicle placement probe (≈4 Hz while the trace is on): her + boat/vehicle WORLD positions, plus the plan's boat
 *  position when given (runtime vs plan delta in metres). No `pos=` field, so collision-gate.cjs never reads it as a camera write. */
let actorAt=-1;
export function camActorPose(step:string,her:{x:number,y:number,z:number}|null,boat:{x:number,y:number,z:number}|null,planBoat?:readonly number[]|null):void{
 if(!camLog.on)return;const t=((typeof performance!=='undefined'?performance.now():Date.now())-camLog.t0)/1000;if(actorAt>=0&&t-actorAt<0.25&&t>=actorAt)return;actorAt=t;
 const v=(q:{x:number,y:number,z:number}|null)=>q?f3(q.x)+','+f3(q.y)+','+f3(q.z):'-';
 const d=boat&&planBoat?' boatVsPlanM='+f3(Math.hypot(boat.x-planBoat[0],boat.y-planBoat[1],boat.z-planBoat[2])):'';
 camLog.out('[QF_CAM_TRACE] t='+f3(t)+' ACTOR step='+step+' her='+v(her)+' boat='+v(boat)+(planBoat?' planBoat='+planBoat.map(f3).join(','):'')+d/*QF_PROBE_BEGIN*/+' pn='+f3(pnow())/*QF_PROBE_END*/);}
let started=false;
/** Read the switch once. Returns whether tracing is on. */
/*QF_PROBE_BEGIN*//** Storage timing probe (QA/diag only; stripped from release). Grok Bot 2026-10-31: measure the sync storage writes
 *  at transitions (WorldFlowComponent:266 ~12 KB at door-shut/hide/show, RegionArrivalTitleCore, LakesideArrivalCore, EndingScreen,
 *  level-result saves) on device without touching reviewed files: every sys.localStorage.setItem (→ wx.setStorageSync in the
 *  mini-game adapter) is timed and logged through the buffered camTrace sink (camLog.out; one line per write, writes are rare):
 *  [QF_STORAGE] key=<key> bytes=<utf8 bytes> ms=<setItem duration> caller=<2 stack frames>. Only setItem is timed (the stack is read after). */
function utf8Bytes(v:string):number{let n=0;for(let i=0;i<v.length;i++){const c=v.charCodeAt(i);if(c<0x80)n++;else if(c<0x800)n+=2;else if(c>=0xd800&&c<0xdc00){n+=4;i++;}else n+=3;}return n;}
export function installStorageProbe(store:any,out:(s:string)=>void=(s)=>camLog.out(s)):boolean{
 if(!store||typeof store.setItem!=='function'||store.__qfStorageProbe)return false;
 const orig=store.setItem,now=()=>typeof performance!=='undefined'?performance.now():Date.now();
 const timed=function(this:any,key:string,value:any){const v=String(value),t0=now();try{return orig.call(this===timed?store:this,key,value);}finally{const ms=now()-t0;
  let caller='';try{caller=String(new Error().stack||'').split('\n').slice(2,4).map(x=>x.trim().replace(/^at /,'')).join(' < ');}catch{}
  try{out('[QF_STORAGE] key='+key+' bytes='+utf8Bytes(v)+' ms='+ms.toFixed(3)+' caller='+caller);}catch{}}};
 try{store.setItem=timed;store.__qfStorageProbe=orig;}catch{return false;}return store.setItem===timed;}
export function storageProbeWanted(q:string,on:boolean):boolean{return on||/(?:^|[?&])(?:storageTrace|syncTrace)=1(?:&|$)/.test(q||'');}
/** [QF_SYNC] runtime gate (QA/diag only, stripped from release; P0 chainL). Wraps sys.localStorage getItem/setItem/removeItem/clear,
 *  every wx.*Sync and the sync view-info calls (getWindowInfo, getMenuButtonBoundingClientRect, getDeviceInfo, getAppBaseInfo,
 *  getSystemSetting, sys.getSafeAreaRect) and counts calls per engine frame (EVENT_AFTER_DRAW closes a frame). Nested calls (the
 *  adapter's localStorage.getItem → wx.getStorageSync) count once. A call is ALLOWED only for a named reason:
 *    boot (first SYNC_BOOT_FRAMES frames), tap (≤ 3 frames after a touch start), hide-show (≤ 30 frames after EVENT_HIDE/SHOW),
 *    transition (world journey has a target / is not arrived, or a WindWipe runs), qa (globalThis.__qfSyncAllow = '<reason>').
 *  Anything else is a STEADY call = gate FAIL. Lines: `[QF_SYNC] STEADY …` (first 20, with caller), and a summary every 600 frames +
 *  on hide: `[QF_SYNC] frames= calls= steadyCalls= maxPerFrame= maxSteadyPerFrame= allow={…} byApi={…} verdict=PASS|FAIL`.
 *  globalThis.__qfSyncStats() feeds the harness result.json (steadyCalls > 0 fails the run). */
export const SYNC_BOOT_FRAMES=300,SYNC_VIEW=['getWindowInfo','getMenuButtonBoundingClientRect','getDeviceInfo','getAppBaseInfo','getSystemSetting'];
export const syncProbe={frame:0,cur:0,curSteady:0,calls:0,steadyCalls:0,maxPerFrame:0,maxSteadyPerFrame:0,byApi:{} as Record<string,number>,allow:{} as Record<string,number>,
 steadySamples:[] as any[],lastTap:-1e9,lastHideShow:-1e9,depth:0,installed:false,trFrame:-1,tr:false,out:(s:string)=>camLog.out(s)};
function syncTransition(g:any):boolean{const P=syncProbe;if(P.trFrame===P.frame)return P.tr;P.trFrame=P.frame;let t=false;
 try{const w=g.__qfWindWipe;if(w&&w.mode)t=true;const s=g.__worldIntegration?.snapshot?.(),j=s?.journey||s?.world?.journey;if(j&&(j.target||(j.phase&&j.phase!=='arrived'&&j.phase!=='idle')))t=true;}catch{}
 P.tr=t;return t;}
export function syncReason(g:any):string|null{const P=syncProbe,f=P.frame;if(f<SYNC_BOOT_FRAMES)return 'boot';if(f-P.lastTap<=3)return 'tap';if(f-P.lastHideShow<=30)return 'hide-show';
 if(syncTransition(g))return 'transition';const q=g.__qfSyncAllow;return typeof q==='string'&&q?'qa:'+q:null;}
export function syncStats(){const P=syncProbe;return {frames:P.frame,calls:P.calls,steadyCalls:P.steadyCalls,maxPerFrame:P.maxPerFrame,maxSteadyPerFrame:P.maxSteadyPerFrame,allow:{...P.allow},byApi:{...P.byApi},steadySamples:P.steadySamples.slice(0,20),verdict:P.steadyCalls?'FAIL':'PASS'};}
function syncSummary(){const s=syncStats();syncProbe.out('[QF_SYNC] frames='+s.frames+' calls='+s.calls+' steadyCalls='+s.steadyCalls+' maxPerFrame='+s.maxPerFrame+' maxSteadyPerFrame='+s.maxSteadyPerFrame+' allow='+JSON.stringify(s.allow)+' byApi='+JSON.stringify(s.byApi)+' verdict='+s.verdict);}
export function syncFrameEnd():void{const P=syncProbe;if(P.cur>P.maxPerFrame)P.maxPerFrame=P.cur;if(P.curSteady>P.maxSteadyPerFrame)P.maxSteadyPerFrame=P.curSteady;P.cur=0;P.curSteady=0;P.frame++;if(P.frame%600===0)syncSummary();}
function syncNote(g:any,api:string,key:string):void{const P=syncProbe;P.calls++;P.cur++;P.byApi[api]=(P.byApi[api]||0)+1;const r=syncReason(g);
 if(r){P.allow[r]=(P.allow[r]||0)+1;return;}P.steadyCalls++;P.curSteady++;
 if(P.steadySamples.length<20){let caller='';try{caller=String(new Error().stack||'').split('\n').slice(3,9).map(x=>x.trim().replace(/^at /,'')).join(' < ');}catch{}
  const smp={frame:P.frame,api,key,caller};P.steadySamples.push(smp);P.out('[QF_SYNC] STEADY frame='+smp.frame+' api='+api+(key?' key='+key:'')+' caller='+caller);}}
function syncWrap(obj:any,name:string,label:string,g:any,keyed:boolean):void{const orig=obj&&obj[name];if(typeof orig!=='function'||orig.__qfSync)return;
 const w=function(this:any,...a:any[]){const P=syncProbe;if(P.depth===0)syncNote(g,label,keyed?String(a[0]):'');P.depth++;try{return orig.apply(this===w?obj:this,a);}finally{P.depth--;}};
 (w as any).__qfSync=orig;try{obj[name]=w;}catch{}}
export function installSyncProbe(g:any,store:any,wxObj:any,sysObj:any,hooks?:{onFrameEnd?:(f:()=>void)=>void;onTap?:(f:()=>void)=>void;onHideShow?:(f:()=>void)=>void}):boolean{
 const P=syncProbe;if(P.installed)return false;P.installed=true;
 if(store)for(const m of ['getItem','setItem','removeItem','clear'])syncWrap(store,m,'localStorage.'+m,g,m!=='clear');
 if(wxObj){for(const k of Object.keys(wxObj).concat(Object.getOwnPropertyNames(Object.getPrototypeOf(wxObj)||{})))if(/Sync$/.test(k)||SYNC_VIEW.includes(k))syncWrap(wxObj,k,'wx.'+k,g,/Storage/.test(k));}
 if(sysObj)syncWrap(sysObj,'getSafeAreaRect','sys.getSafeAreaRect',g,false);
 const h=hooks||{onFrameEnd:(f)=>director.on(Director.EVENT_AFTER_DRAW,f),onTap:(f)=>input.on(Input.EventType.TOUCH_START,f),onHideShow:(f)=>{game.on(Game.EVENT_HIDE,f);game.on(Game.EVENT_SHOW,f);}};
 try{h.onFrameEnd?.(syncFrameEnd);}catch{}try{h.onTap?.(()=>{P.lastTap=P.frame;});}catch{}try{h.onHideShow?.(()=>{P.lastHideShow=P.frame;syncSummary();});}catch{}
 try{g.__qfSyncStats=syncStats;}catch{}return true;}
/** [QF_GPU] render-stall probe (QA/diag only, stripped from release; P0 finR: SkyWalkShot froze with an idle JS stack). No host
 *  sync call anywhere: reads engine counters (gfx device numDrawCalls/numTris/numInstances, memoryStatus) and performance.now().
 *  - Per wall second: `[QF_GPU] s= fr= dc=max/avg tri=max inst=max texMB= bufMB= raf=max/p95/avg ms long= uploads=n/MB shaders=n regions={…} w=<lens>`
 *    (rAF interval = time between EVENT_AFTER_DRAW; long = intervals > 100 ms).
 *  - Each GPU texture creation ≥ 256 KB or upload ≥ 256 KB: `[QF_GPU] TEX op= w×h fmt= MB ms=` (≤ 60 lines, then counted only).
 *  - Each texture ≥ 256 KB destroyed: `[QF_GPU] TEX op=destroy w×h fmt= MB= name=<render-graph resource, e.g. ShadowMap1|?>` (same caps).
 *  - Per-second line also: `live=<device textures alive> liveMB= cre=<creates this s> des=<destroys this s> churn=<name:destroys,…|->`.
 *  - Each shader program creation: `[QF_GPU] SHADER n= name= ms=` (≤ 60 lines) — a compile storm shows as many in one second.
 *  - Every 5 s: resident assets per loaded bundle (`regions=` field, count of loaded assets whose uuid the bundle owns).
 *  - The last per-second line before a freeze is the evidence: rising tex/uploads → upload hypothesis; shader burst → compile storm;
 *    dc/tri spike → draw loop; raf long with flat counters → rAF throttling / compositor; texMB with 2+ regions → GPU memory.
 *  All lines go through the buffered camTrace sink (camLog.out). */
export const GPU_PROBE=Object.freeze({texMinBytes:256*1024,maxDetail:60,regionsEveryS:5});
export const gpuProbe={installed:false,sec:-1,fr:0,dcMax:0,dcSum:0,triMax:0,instMax:0,n:0,last:-1,rafMax:0,rafs:[] as number[],long:0,uploads:0,upBytes:0,shaders:0,detail:0,
 regions:'' as string,regionsAt:-1e9,lens:'',out:(s:string)=>camLog.out(s),
 live:new Map<object,number>(),liveBytes:0,creates:0,destroys:0,churn:new Map<string,number>(),
 /** Render-graph resource name of a device texture (custom pipeline executor deviceTextures), '' when unknown. Overridable in tests. */
 nameOf:(tex:any):string=>gpuResName(tex)};
/** p0-shadow-churn: name lookup for TEX op=destroy. Read-only scan of the custom pipeline executor's managed textures (ShadowMap<id>,
 *  ShadowDepth<id>, …). J5.release() destroys the texture while it is still in the map, so destroy can be named. */
export function gpuResName(tex:any):string{try{const m=(director as any).root?.pipeline?._executor?._context?.deviceTextures;if(!m||!tex)return '';
 let out='';m.forEach((v:any,k:string)=>{if(!out&&(v?.texture===tex||v?._texture===tex))out=String(k);});return out;}catch{return '';}}
const pn=()=>typeof performance!=='undefined'?performance.now():Date.now();
function texBytes(info:any):number{try{const w=info?.width|0,h=info?.height|0,d=Math.max(1,info?.depth|0),l=Math.max(1,info?.layerCount|0);return w*h*d*l*4;}catch{return 0;}}
function gpuDetail(s:string){const G=gpuProbe;if(G.detail<GPU_PROBE.maxDetail){G.detail++;G.out(s);}}
export function gpuWrapDevice(dev:any):boolean{if(!dev||dev.__qfGpu)return false;const G=gpuProbe;
 const wrap=(name:string,f:(a:any[],ms:number,r:any)=>void)=>{const o=dev[name];if(typeof o!=='function')return;dev[name]=function(this:any,...a:any[]){const t=pn();const r=o.apply(this,a);try{f(a,pn()-t,r);}catch{}return r;};};
 wrap('createTexture',(a,ms,r)=>{const b=texBytes(a[0]);
  // live accounting for every device texture; destroy wrapped per instance (p0-shadow-churn)
  if(r&&typeof r==='object'&&!G.live.has(r)){G.live.set(r,b);G.liveBytes+=b;G.creates++;const od=r.destroy;if(typeof od==='function'){const info=a[0];r.destroy=function(this:any,...x:any[]){
   if(G.live.has(r)){const bb=G.live.get(r)||0;G.live.delete(r);G.liveBytes-=bb;G.destroys++;let name='';if(bb>=GPU_PROBE.texMinBytes){try{name=G.nameOf(r);}catch{}const k=name||'?';G.churn.set(k,(G.churn.get(k)||0)+1);
    gpuDetail('[QF_GPU] TEX op=destroy '+(info?.width|0)+'x'+(info?.height|0)+' fmt='+(info?.format)+' MB='+(bb/1048576).toFixed(2)+' name='+(name||'?'));}}
   return od.apply(this,x);};}}
  if(b>=GPU_PROBE.texMinBytes){G.uploads++;G.upBytes+=b;gpuDetail('[QF_GPU] TEX op=create '+(a[0]?.width|0)+'x'+(a[0]?.height|0)+' fmt='+(a[0]?.format)+' MB='+(b/1048576).toFixed(2)+' ms='+ms.toFixed(1)+' w='+G.lens);}});
 const up=(op:string)=>(a:any[],ms:number)=>{const tex=a[1];const regs=a[2]||[];let b=0;for(const r of regs)b+=Math.max(1,r?.texExtent?.width|0)*Math.max(1,r?.texExtent?.height|0)*4;if(!b)b=texBytes(tex?.info||tex);
  if(b>=GPU_PROBE.texMinBytes){G.uploads++;G.upBytes+=b;gpuDetail('[QF_GPU] TEX op='+op+' '+(tex?.width|0)+'x'+(tex?.height|0)+' MB='+(b/1048576).toFixed(2)+' ms='+ms.toFixed(1)+' w='+G.lens);}};
 wrap('copyBuffersToTexture',up('upload'));wrap('copyTexImagesToTexture',up('image'));
 wrap('createShader',(a,ms)=>{G.shaders++;gpuDetail('[QF_GPU] SHADER n='+G.shaders+' name='+String(a[0]?.name||'?')+' ms='+ms.toFixed(1)+' w='+G.lens);});
 dev.__qfGpu=true;return true;}
export function gpuRegions(am:any):string{const out:Record<string,number>={};try{const ids:string[]=[];am.assets.forEach((_a:any,uuid:string)=>{ids.push(uuid);});
 am.bundles.forEach((b:any,name:string)=>{if(name==='internal'||name==='main'||name==='resources')return;let n=0;for(const id of ids)if(b.getAssetInfo?.(id))n++;if(n)out[name]=n;});out.total=ids.length;}catch{}return JSON.stringify(out);}
function gpuChurn(m:Map<string,number>):string{const a:string[]=[];m.forEach((n,k)=>{if(a.length<6)a.push(k+':'+n);});return a.length?a.join(','):'-';}
export function gpuFrame(dev:any,am:any,now:number=pn()):void{const G=gpuProbe;G.fr++;
 if(G.last>=0){const d=now-G.last;if(d>G.rafMax)G.rafMax=d;if(d>100)G.long++;if(G.rafs.length<240)G.rafs.push(d);}G.last=now;
 const dc=dev?.numDrawCalls|0,tri=dev?.numTris|0,inst=dev?.numInstances|0;G.n++;G.dcSum+=dc;if(dc>G.dcMax)G.dcMax=dc;if(tri>G.triMax)G.triMax=tri;if(inst>G.instMax)G.instMax=inst;
 const sec=Math.floor(now/1000);if(G.sec<0){G.sec=sec;return;}if(sec===G.sec)return;
 if(now-G.regionsAt>=GPU_PROBE.regionsEveryS*1000&&am){G.regions=gpuRegions(am);G.regionsAt=now;}
 const r=G.rafs.slice().sort((x,y)=>x-y),p95=r.length?r[Math.min(r.length-1,Math.floor(r.length*0.95))]:0,avg=r.length?r.reduce((x,y)=>x+y,0)/r.length:0,ms=dev?.memoryStatus||{};
 G.out('[QF_GPU] s='+sec+' fr='+G.fr+' dc='+G.dcMax+'/'+(G.n?(G.dcSum/G.n).toFixed(0):0)+' tri='+G.triMax+' inst='+G.instMax+' texMB='+((ms.textureSize|0)/1048576).toFixed(1)+' bufMB='+((ms.bufferSize|0)/1048576).toFixed(1)
  +' raf='+G.rafMax.toFixed(0)+'/'+p95.toFixed(0)+'/'+avg.toFixed(1)+' long='+G.long+' uploads='+G.uploads+'/'+(G.upBytes/1048576).toFixed(1)+' shaders='+G.shaders+' live='+G.live.size+' liveMB='+(G.liveBytes/1048576).toFixed(1)+' cre='+G.creates+' des='+G.destroys+' churn='+gpuChurn(G.churn)+' regions='+G.regions+' w='+G.lens);
 G.sec=sec;G.dcMax=0;G.dcSum=0;G.n=0;G.triMax=0;G.instMax=0;G.rafMax=0;G.rafs.length=0;G.long=0;G.uploads=0;G.upBytes=0;G.shaders=0;G.creates=0;G.destroys=0;G.churn.clear();}
export function installGpuProbe(dev:any,am:any,onFrameEnd?:(f:()=>void)=>void):boolean{const G=gpuProbe;if(G.installed||!dev)return false;G.installed=true;gpuWrapDevice(dev);
 const h=onFrameEnd||((f:()=>void)=>director.on(Director.EVENT_AFTER_DRAW,f));try{h(()=>gpuFrame(dev,am));}catch{}return true;}
/** r2 (B360 481c599c NOPROBE): camTrace / GPU probe must never be silently off in a TEST build.
 *  1. One unconditional startup line on the game runtime (wx host; test builds only: stripped with the probes): `[QF_CAM] enabled=<0|1> src=<query|global|none> query=<read>`.
 *     src=global = globalThis.__QF_CAM_TRACE (harness/CDP set before the game scripts load); query = debugSearch() (URL search string +
 *     wx enter/launch query + globalThis.__qfQuery). Note: DevTools `cli open` does NOT pass 编译模式 启动参数 to the game, so a run that
 *     relies only on the compile condition logs enabled=0 src=none here; harness scripts must carry launchQuery (?camTrace=1).
 *  2. GPU probe install: at module load when director.root.device exists (`[QF_GPU] probe installed at=module`), else lazily on the
 *     first EVENT_AFTER_DRAW that has a device, exactly once (`at=deferred frame=<n>`); still none after GPU_PROBE_START.maxFrames
 *     frames → `[QF_GPU] probe NOT installed reason=no-device frames=<n>`. */
export const GPU_PROBE_START=Object.freeze({maxFrames:600});
export function camStartSrc(q:string,g:any):string{if(/(?:^|[?&])camTrace=1(?:&|$)/.test(q||''))return 'query';try{if(camFlagOn(g&&g.__QF_CAM_TRACE))return 'global';}catch{}return 'none';}
export const camStart={emit:(s:string)=>camSink.emit(s)/* one direct line, not buffered */,last:'',enabled:false,src:'none',gpu:'off' as string};
/** harness read-back (autoplay tool result.camStart): globalThis.__qfCamStart = {line,enabled,src,gpu} (gpu: off|module|deferred|pending|not-installed:<reason>) */
function camStartPublish():void{try{(globalThis as any).__qfCamStart={line:camStart.last,enabled:camStart.enabled,src:camStart.src,gpu:camStart.gpu};}catch{}}
export function camStartLine(q:string,g:any,on:boolean):string{const src=camStartSrc(q,g),s='[QF_CAM] enabled='+(on?1:0)+' src='+src+' query='+(q||'-');camStart.last=s;camStart.enabled=on;camStart.src=src;camStartPublish();if(camSinkOn()||(g&&g.__QF_CAM_START_LINE===true))try{camStart.emit(s);}catch{}/* game runtime (wx host) always; Node unit tests stay silent unless asked */return s;}
export function gpuProbeStart(getDev:()=>any,am:any,on?:(f:()=>void)=>void,off?:(f:()=>void)=>void,maxFrames:number=GPU_PROBE_START.maxFrames,hook?:(f:()=>void)=>void):string{
 const G=gpuProbe;if(G.installed)return 'already';
 let dev:any=null;try{dev=getDev();}catch{dev=null;}
 if(dev){try{if(installGpuProbe(dev,am,hook)){camStart.gpu='module';camStartPublish();G.out('[QF_GPU] probe installed at=module');return 'module';}}catch(e){G.out('[QF_GPU] probe NOT installed reason=error:'+String(e).slice(0,80)+' at=module');return 'error';}}
 const subOn=on||((f:()=>void)=>director.on(Director.EVENT_AFTER_DRAW,f)),subOff=off||((f:()=>void)=>director.off(Director.EVENT_AFTER_DRAW,f));
 let n=0,done=false;const tick=()=>{if(done)return;n++;let d:any=null;try{d=getDev();}catch{d=null;}
  if(d){done=true;try{subOff(tick);}catch{}try{if(installGpuProbe(d,am,hook)){camStart.gpu='deferred';camStartPublish();G.out('[QF_GPU] probe installed at=deferred frame='+n);}else G.out('[QF_GPU] probe NOT installed reason='+(G.installed?'already':'install-false')+' frames='+n);}catch(e){G.out('[QF_GPU] probe NOT installed reason=error:'+String(e).slice(0,80)+' frames='+n);}return;}
  if(n>=maxFrames){done=true;try{subOff(tick);}catch{}camStart.gpu='not-installed:no-device';camStartPublish();G.out('[QF_GPU] probe NOT installed reason=no-device frames='+n);}};
 camStart.gpu='pending';camStartPublish();try{subOn(tick);}catch(e){camStart.gpu='not-installed:no-frame-hook';camStartPublish();G.out('[QF_GPU] probe NOT installed reason=no-frame-hook:'+String(e).slice(0,80));return 'nohook';}
 return 'deferred';}
/*QF_PROBE_END*/export function camLogStart(query?:string,g:any=globalThis):boolean{
 if(started)return camLog.on;started=true;
 let q=query;if(q===undefined)q=debugSearch(g)/* full8: + wx launch/enter query + __qfQuery */;
 camLog.on=camLogEnabled(q,g);camLog.stacks=camLog.on&&camStacksEnabled(q,g);
 if(camLog.on){camLog.t0=typeof performance!=='undefined'?performance.now():Date.now();cameraWriteHook.log=camLogWrite;try{(g||globalThis).__qfCamTag={t:camTag,d:camTagDefault};}catch{}}
 /*QF_PROBE_BEGIN*/if(storageProbeWanted(q||'',camLog.on)){try{installStorageProbe((sys as any).localStorage);}catch{}try{installSyncProbe(g||globalThis,(sys as any).localStorage,(g||globalThis as any).wx,sys);}catch{}}camStartLine(q||'',g,camLog.on);if(camLog.on)gpuProbeStart(()=>(director as any).root?.device,assetManager);/*QF_PROBE_END*/
 return camLog.on;
}
/** test-only */
export function camLogReset():void{camSink.buf=[];camSink.bytes=0;camSink.dropFlush=0;camSink.sinkDropped=0;camSink.flushes=0;camSink.last=0;if(camSink.timer!==null){try{clearTimeout(camSink.timer);}catch{}camSink.timer=null;}camStates=new WeakMap();camIds=0;stall.key='';stall.since=-1;stall.said=-1;st.fr=0;st.bad='';try{delete (globalThis as any).__qfCamTag;}catch{}started=false;/*QF_PROBE_BEGIN*/probe.actor=null;probe.cut=null;probe.cuts=0;probe.occ=[];probe.occFr=-1e9;probe.herFr=-1e9;try{if(probe.hooked)director.off(Director.EVENT_AFTER_DRAW,probeAfterDraw);delete (globalThis as any).__QF_PROBE_HER;}catch{}probe.hooked=false;/*QF_PROBE_END*/camLog.on=false;camLog.tag='';camLog.n=0;camLog.has=false;camLog.fr=-1;camLog.fw=0;camLog.stacks=false;camLog.busy=false;camLog.reentry=0;camLog.dropped=0;camLog.stackN=0;camLog.win=-1;camLog.winN=0;camLog.last='';cameraWriteHook.log=null;}
/** Read the switch once, at module load (game init). */
/*QF_PROBE_BEGIN*//** P2 lakeside gate probe (TEST ONLY, same camLog.on gate as the probes above): [QF_P2_SCENE] at trace frame 2400 and every 10th
 *  frame of the balloon ascent: active camera, clear colour, fog, active domes and the LK_* renderers the camera can see. */
const p2={lake:null as any,phase:''};
export function camProbeLake(model:any,phase:string):void{if(!camLog.on)return;if(model)p2.lake=model;p2.phase=phase;}
function probeSceneFrame(camera:any,fr:number):void{
 if(!camLog.on||!(fr===2400||(p2.phase==='ascent'&&fr%10===0)))return;
 try{const vis=(camera.visibility|0)>>>0,sc=camera.node?.scene,g=sc?.globals,fog=g?.fog,lk:string[]=[],dome:string[]=[];
  const walk=(n:any)=>{if(!n||!n.activeInHierarchy)return;const nm=String(n.name||'');
   const r=(n.components||[]).find((c:any)=>c&&c.enabledInHierarchy&&typeof c.sharedMaterials!=='undefined');
   if(r&&(vis&(n.layer>>>0))!==0){if(/^LK_|LakesideJourney/.test(nm))lk.push(nm);if(/dome|sky/i.test(nm))dome.push(nm);}
   for(const c of n.children||[])walk(c);};
  walk(sc);const c=camera.clearColor;
  camLog.out('[QF_P2_SCENE] '+JSON.stringify({fr,phase:p2.phase||'-',cam:camera.node?.name,clear:c?[c.r,c.g,c.b]:null,flags:camera.clearFlags,
   fog:fog?{on:fog.enabled,type:fog.type,color:[fog.fogColor.r,fog.fogColor.g,fog.fogColor.b]}:null,dome,lkN:lk.length,lk:lk.slice(0,12),pn:+pnow().toFixed(1)}));
 }catch{/* probe never throws */}}
/*QF_PROBE_END*/
camLogStart();
