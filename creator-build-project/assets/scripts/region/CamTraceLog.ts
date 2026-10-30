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
import {Director,MeshRenderer,Vec3,director,sys} from 'cc';
/** full9b P0 (Mac A/B: camTrace ON froze the renderer, OFF completed): bounded trace. ≤ linesPerS write lines per wall second
 *  (over budget: counted, the next line carries DROPPED=<n>); ≤ maxStacks CALLER stacks per session; re-entry never writes. */
export const CAM_LOG_BUDGET=Object.freeze({linesPerS:60,maxStacks:200});
export const CAM_LOG_CAP=Object.freeze({m:5/60*1.05,deg:3});
export const camLog={on:false,tag:'',n:0,t0:0,last:'',lp:[0,0,0] as number[],ly:0,lpi:0,has:false,fr:-1,fw:0,stacks:false,busy:false,reentry:0,dropped:0,stackN:0,win:-1,winN:0,out:(s:string)=>console.log(s)};
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
 camLog.busy=true;try{camLogWriteInner(camera,pose,source);}finally{camLog.busy=false;}
}
function publishStats():void{try{(globalThis as any).__qfCamTraceStats={reentry:camLog.reentry,dropped:camLog.dropped,stacks:camLog.stackN,lines:camLog.n};}catch{}}
function camLogWriteInner(camera:any,pose:{position:readonly number[];rotation:readonly number[];fovVerticalDeg:number},source:string):void{
 void camera;
 const [x,y,z]=pose.position,[qx,qy,qz,qw]=pose.rotation;
 const fx=-2*(qx*qz+qw*qy),fy=-2*(qy*qz-qw*qx),fz=-(1-2*(qx*qx+qy*qy));// forward = q·(0,0,-1)
 const yaw=Math.atan2(fx,-fz)*180/Math.PI,pitch=Math.asin(Math.max(-1,Math.min(1,fy)))*180/Math.PI;
 const w=camLog.tag||source;camLog.tag='';camLog.n++;
 const t=((typeof performance!=='undefined'?performance.now():Date.now())-camLog.t0)/1000;
 let s='[QF_CAM_TRACE] f='+camLog.n+' t='+f3(t)+' pos='+f3(x)+','+f3(y)+','+f3(z)+' yaw='+f3(yaw)+' pitch='+f3(pitch)+' fov='+f3(pose.fovVerticalDeg)+' w='+w;
 if(camLog.has){
  if(w!==camLog.last)s+=' CHANGE<-'+camLog.last;
  const dm=Math.hypot(x-camLog.lp[0],y-camLog.lp[1],z-camLog.lp[2]);let dy=Math.abs(yaw-camLog.ly);if(dy>180)dy=360-dy;const dd=Math.max(dy,Math.abs(pitch-camLog.lpi));
  if(dm>CAM_LOG_CAP.m||dd>CAM_LOG_CAP.deg)s+=' JUMP='+f3(dm)+'m/'+f3(dd)+'deg';
 }
 {/* full9b: writers per frame (gate: ==1). The 2nd+ write in one engine frame names its caller (stack) so an extra writer is traceable. */
  let fr=-1;try{const d=(globalThis as any).cc?.director;fr=d&&typeof d.getTotalFrames==='function'?d.getTotalFrames():-1;}catch{fr=-1;}
  if(fr>=0&&fr===camLog.fr){camLog.fw++;s+=' MULTI='+camLog.fw;if(camLog.stacks&&camLog.stackN<CAM_LOG_BUDGET.maxStacks){camLog.stackN++;let caller='';try{caller=String(new Error().stack||'').split('\n').slice(3,6).map(x=>x.trim()).join(' < ');}catch{}s+=' CALLER='+caller;}}else{camLog.fr=fr;camLog.fw=1;}
  if(fr>=0)s+=' fr='+fr;}
 if(camLog.has&&w!==camLog.last)probe.cut={n:++probe.cuts,from:camLog.last,to:w,t0:pnow()}/* full9c probe: first draw after every cut */;
 camLog.has=true;camLog.last=w;camLog.lp[0]=x;camLog.lp[1]=y;camLog.lp[2]=z;camLog.ly=yaw;camLog.lpi=pitch;
 {const sec=Math.floor(t);if(sec!==camLog.win){camLog.win=sec;camLog.winN=0;}
  if(++camLog.winN>CAM_LOG_BUDGET.linesPerS){camLog.dropped++;publishStats();return;}}
 if(camLog.dropped)s+=' DROPPED='+camLog.dropped;if(camLog.reentry)s+=' REENTRY='+camLog.reentry;
 camLog.out(s+' pn='+f3(pnow()));if((camLog.n&63)===0)publishStats();
}
/** Default world layer bit (cc Layers.Enum.DEFAULT = 1<<30). */
export const CAM_LOG_WORLD_LAYER=1<<30;
const st={fr:0,bad:''};
/** Per-frame state probe (WorldFlowComponent.lateUpdate, only inside `if(camLog.on)`): one line per frame while the world camera
 *  is disabled / missing or its visibility lacks the world layer, and one line when it recovers. */
export function camLogFrame(camera:any):void{
 if(!camLog.on)return;st.fr++;
 const bad=!camera||!camera.node||(camera.node.isValid===false)?'CAM_MISSING':camera.enabledInHierarchy===false||camera.enabled===false?'CAM_OFF':(((camera.visibility|0)&CAM_LOG_WORLD_LAYER)===0?'WORLD_LAYER_OFF':'');
 if(bad)camLog.out('[QF_CAM_TRACE] frame='+st.fr+' '+bad+(camera&&typeof camera.visibility==='number'?' vis=0x'+(camera.visibility>>>0).toString(16):'')+' pn='+f3(pnow()));
 else if(st.bad)camLog.out('[QF_CAM_TRACE] frame='+st.fr+' CAM_OK<-'+st.bad+' pn='+f3(pnow()));
 st.bad=bad;
 if(!bad)probeHerFrame(camera,st.fr);
}
/** full9c probes (界面验收部 acceptance, Grok Bot 2026-10-29). TEST ONLY: every entry point returns at `if(!camLog.on)`, and
 *  the draw listener is only installed from camLogFrame (called only inside `if(camLog.on)`), so the release path runs none of it.
 *  - [QF_B1_GAP] {cut,from,to,firstDrawMs,pn}: writer change (= camera cut) → first AFTER_DRAW, at every cut (B1's own line stays).
 *  - her = the bound CharacterAdapter's own node (explicit reference from WorldFlowComponent.initialize/bindCharacter), never a
 *    name or "first skinned mesh" search; exposed as globalThis.__QF_PROBE_HER() for tools/wx-autoplay state.jsonl.
 *  - [QF_HER_FRAME] per frame: her screen bbox (px, origin bottom-left), occluded fraction (15 rays camera→her AABB grid vs other
 *    renderers' AABBs; conservative), safe-area rect. Every probe line carries pn=performance.now() ms. */
const pnow=()=>typeof performance!=='undefined'?performance.now():Date.now();
export const probe={actor:null as any,cut:null as null|{n:number;from:string;to:string;t0:number},cuts:0,hooked:false,occ:[] as number[][],occFr:-1e9};
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
function probeHerFrame(camera:any,fr:number):void{
 if(!camLog.on)return;
 if(!probe.hooked){probe.hooked=true;try{director.on(Director.EVENT_AFTER_DRAW,probeAfterDraw);}catch{}}
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
  let sa:any=null;try{sa=(sys as any).getSafeAreaRect?.();}catch{}
  camLog.out('[QF_HER_FRAME] fr='+fr+' bbox='+[x0,y0,x1,y1].map(f3).join(',')+' occ='+f3(occ)+' n='+smp.length+' safe='+(sa?[sa.x,sa.y,sa.width,sa.height].map(f3).join(','):'-')+' pn='+f3(pnow()));
 }catch{/* probe only */}
}
/** Stall probe (Grok Bot 2026-10-26): while a walk / board step is active, her position unchanged (< ACTOR_STALL.m) for more
 *  than ACTOR_STALL.s → ONE `[QF_CAM_TRACE] ACTOR_STALL` line (repeated every ACTOR_STALL.s while it lasts). Trace only, the camera is
 *  never moved. Callers guard with `if(camLog.on)`. */
export const ACTOR_STALL=Object.freeze({s:3,m:0.02});
const stall={key:'',x:0,y:0,z:0,since:-1,said:-1};
export function camActorProbe(x:number,y:number,z:number,active:boolean,step:string,nowS?:number):void{
 if(!camLog.on)return;const t=nowS??(((typeof performance!=='undefined'?performance.now():Date.now())-camLog.t0)/1000);
 if(!active||stall.key!==step||Math.hypot(x-stall.x,y-stall.y,z-stall.z)>=ACTOR_STALL.m){stall.key=active?step:'';stall.x=x;stall.y=y;stall.z=z;stall.since=t;stall.said=-1;return;}
 const held=t-stall.since;if(held>ACTOR_STALL.s&&(stall.said<0||t-stall.said>=ACTOR_STALL.s)){stall.said=t;
  camLog.out('[QF_CAM_TRACE] t='+f3(t)+' ACTOR_STALL step='+step+' heldS='+f3(held)+' her='+f3(x)+','+f3(y)+','+f3(z)+' pn='+f3(pnow()));}
}
/** full8: actor/vehicle placement probe (≈4 Hz while the trace is on): her + boat/vehicle WORLD positions, plus the plan's boat
 *  position when given (runtime vs plan delta in metres). No `pos=` field, so collision-gate.cjs never reads it as a camera write. */
let actorAt=-1;
export function camActorPose(step:string,her:{x:number,y:number,z:number}|null,boat:{x:number,y:number,z:number}|null,planBoat?:readonly number[]|null):void{
 if(!camLog.on)return;const t=((typeof performance!=='undefined'?performance.now():Date.now())-camLog.t0)/1000;if(actorAt>=0&&t-actorAt<0.25&&t>=actorAt)return;actorAt=t;
 const v=(q:{x:number,y:number,z:number}|null)=>q?f3(q.x)+','+f3(q.y)+','+f3(q.z):'-';
 const d=boat&&planBoat?' boatVsPlanM='+f3(Math.hypot(boat.x-planBoat[0],boat.y-planBoat[1],boat.z-planBoat[2])):'';
 camLog.out('[QF_CAM_TRACE] t='+f3(t)+' ACTOR step='+step+' her='+v(her)+' boat='+v(boat)+(planBoat?' planBoat='+planBoat.map(f3).join(','):'')+d+' pn='+f3(pnow()));}
let started=false;
/** Read the switch once. Returns whether tracing is on. */
export function camLogStart(query?:string,g:any=globalThis):boolean{
 if(started)return camLog.on;started=true;
 let q=query;if(q===undefined)q=debugSearch(g)/* full8: + wx launch/enter query + __qfQuery */;
 camLog.on=camLogEnabled(q,g);camLog.stacks=camLog.on&&camStacksEnabled(q,g);
 if(camLog.on){camLog.t0=typeof performance!=='undefined'?performance.now():Date.now();cameraWriteHook.log=camLogWrite;try{(g||globalThis).__qfCamTag={t:camTag,d:camTagDefault};}catch{}}
 return camLog.on;
}
/** test-only */
export function camLogReset():void{stall.key='';stall.since=-1;stall.said=-1;st.fr=0;st.bad='';try{delete (globalThis as any).__qfCamTag;}catch{}started=false;probe.actor=null;probe.cut=null;probe.cuts=0;probe.occ=[];probe.occFr=-1e9;try{if(probe.hooked)director.off(Director.EVENT_AFTER_DRAW,probeAfterDraw);delete (globalThis as any).__QF_PROBE_HER;}catch{}probe.hooked=false;camLog.on=false;camLog.tag='';camLog.n=0;camLog.has=false;camLog.fr=-1;camLog.fw=0;camLog.stacks=false;camLog.busy=false;camLog.reentry=0;camLog.dropped=0;camLog.stackN=0;camLog.win=-1;camLog.winN=0;camLog.last='';cameraWriteHook.log=null;}
/** Read the switch once, at module load (game init). */
camLogStart();
