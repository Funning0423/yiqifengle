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
export const CAM_LOG_CAP=Object.freeze({m:5/60*1.05,deg:3});
export const camLog={on:false,tag:'',n:0,t0:0,last:'',lp:[0,0,0] as number[],ly:0,lpi:0,has:false,out:(s:string)=>console.log(s)};
export function camLogEnabled(query:string,g:any):boolean{return /(?:^|[?&])camTrace=1(?:&|$)/.test(query||'')||camFlagOn(g&&g.__QF_CAM_TRACE);}
/** Global switch accepts exactly true / 1 / '1' (also 'true'); '0', 'false', '' and others stay off. */
export function camFlagOn(v:unknown):boolean{return v===true||v===1||v==='1'||v==='true';}
/** Writers name themselves just before world.setCamera; no-op when off. */
export function camTag(name:string):void{if(camLog.on)camLog.tag=name;}
/** Only if no more specific writer tagged this frame (e.g. RegionJourneyCore after a SkyWalkShot onFrame). */
export function camTagDefault(name:string):void{if(camLog.on&&!camLog.tag)camLog.tag=name;}
const f3=(v:number)=>(Math.round(v*1000)/1000).toString();
export function camLogWrite(camera:any,pose:{position:readonly number[];rotation:readonly number[];fovVerticalDeg:number},source:string):void{
 if(!camLog.on)return;
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
 camLog.has=true;camLog.last=w;camLog.lp[0]=x;camLog.lp[1]=y;camLog.lp[2]=z;camLog.ly=yaw;camLog.lpi=pitch;
 camLog.out(s);
}
/** Default world layer bit (cc Layers.Enum.DEFAULT = 1<<30). */
export const CAM_LOG_WORLD_LAYER=1<<30;
const st={fr:0,bad:''};
/** Per-frame state probe (WorldFlowComponent.lateUpdate, only inside `if(camLog.on)`): one line per frame while the world camera
 *  is disabled / missing or its visibility lacks the world layer, and one line when it recovers. */
export function camLogFrame(camera:any):void{
 if(!camLog.on)return;st.fr++;
 const bad=!camera||!camera.node||(camera.node.isValid===false)?'CAM_MISSING':camera.enabledInHierarchy===false||camera.enabled===false?'CAM_OFF':(((camera.visibility|0)&CAM_LOG_WORLD_LAYER)===0?'WORLD_LAYER_OFF':'');
 if(bad)camLog.out('[QF_CAM_TRACE] frame='+st.fr+' '+bad+(camera&&typeof camera.visibility==='number'?' vis=0x'+(camera.visibility>>>0).toString(16):''));
 else if(st.bad)camLog.out('[QF_CAM_TRACE] frame='+st.fr+' CAM_OK<-'+st.bad);
 st.bad=bad;
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
  camLog.out('[QF_CAM_TRACE] t='+f3(t)+' ACTOR_STALL step='+step+' heldS='+f3(held)+' her='+f3(x)+','+f3(y)+','+f3(z));}
}
/** full8: actor/vehicle placement probe (≈4 Hz while the trace is on): her + boat/vehicle WORLD positions, plus the plan's boat
 *  position when given (runtime vs plan delta in metres). No `pos=` field, so collision-gate.cjs never reads it as a camera write. */
let actorAt=-1;
export function camActorPose(step:string,her:{x:number,y:number,z:number}|null,boat:{x:number,y:number,z:number}|null,planBoat?:readonly number[]|null):void{
 if(!camLog.on)return;const t=((typeof performance!=='undefined'?performance.now():Date.now())-camLog.t0)/1000;if(actorAt>=0&&t-actorAt<0.25&&t>=actorAt)return;actorAt=t;
 const v=(q:{x:number,y:number,z:number}|null)=>q?f3(q.x)+','+f3(q.y)+','+f3(q.z):'-';
 const d=boat&&planBoat?' boatVsPlanM='+f3(Math.hypot(boat.x-planBoat[0],boat.y-planBoat[1],boat.z-planBoat[2])):'';
 camLog.out('[QF_CAM_TRACE] t='+f3(t)+' ACTOR step='+step+' her='+v(her)+' boat='+v(boat)+(planBoat?' planBoat='+planBoat.map(f3).join(','):'')+d);}
let started=false;
/** Read the switch once. Returns whether tracing is on. */
export function camLogStart(query?:string,g:any=globalThis):boolean{
 if(started)return camLog.on;started=true;
 let q=query;if(q===undefined)q=debugSearch(g)/* full8: + wx launch/enter query + __qfQuery */;
 camLog.on=camLogEnabled(q,g);
 if(camLog.on){camLog.t0=typeof performance!=='undefined'?performance.now():Date.now();cameraWriteHook.log=camLogWrite;try{(g||globalThis).__qfCamTag={t:camTag,d:camTagDefault};}catch{}}
 return camLog.on;
}
/** test-only */
export function camLogReset():void{stall.key='';stall.since=-1;stall.said=-1;st.fr=0;st.bad='';try{delete (globalThis as any).__qfCamTag;}catch{}started=false;camLog.on=false;camLog.tag='';camLog.n=0;camLog.has=false;camLog.last='';cameraWriteHook.log=null;}
/** Read the switch once, at module load (game init). */
camLogStart();
