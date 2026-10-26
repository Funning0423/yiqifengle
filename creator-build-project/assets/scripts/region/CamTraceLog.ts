/** 运镜bot full7-cam: per-frame camera console trace for device cut hunting (GGbot request).
 *  On with URL `?camTrace=1` OR `globalThis.__QF_CAM_TRACE` truthy (set before the game scripts load), checked ONCE when this
 *  module loads (camLogStart at the bottom; imported by WorldFlowComponent / BalloonTransit / RegionBoardLanding).
 *  Off (default): no hook is installed (cameraWriteHook.log stays null), camTag() is one boolean test, nothing allocates.
 *  On: every applyCameraPose write prints ONE console.log line (never warn/error: Console-0 gate):
 *   [QF_CAM_TRACE] f=<write#> t=<s> pos=x,y,z yaw=<deg> pitch=<deg> fov=<deg> w=<writer>[ CHANGE<-prev][ JUMP=<m>m/<deg>deg]
 *  writer = the last camTag() set since the previous write (TransitionCamera, LiveHandoff, SkyWalkShot, BalloonTransit:*,
 *  enter-level, regionBoardHandoff, regionLandingToBoard, RegionJourneyCore:*), else applyCameraPose's own source.
 *  JUMP = position step > CAM_LOG_CAP.m (TRANSITION_CAM per-frame lens cap ·1.05) or view step > CAM_LOG_CAP.deg in one write. */
import { cameraWriteHook } from '../world-r1/CameraPose';
export const CAM_LOG_CAP=Object.freeze({m:5/60*1.05,deg:3});
export const camLog={on:false,tag:'',n:0,t0:0,last:'',lp:[0,0,0] as number[],ly:0,lpi:0,has:false,out:(s:string)=>console.log(s)};
export function camLogEnabled(query:string,g:any):boolean{return /(?:^|[?&])camTrace=1(?:&|$)/.test(query||'')||!!(g&&g.__QF_CAM_TRACE);}
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
let started=false;
/** Read the switch once. Returns whether tracing is on. */
export function camLogStart(query?:string,g:any=globalThis):boolean{
 if(started)return camLog.on;started=true;
 let q=query;if(q===undefined){try{q=typeof location!=='undefined'?String(location.search||''):'';}catch{q='';}}
 camLog.on=camLogEnabled(q,g);
 if(camLog.on){camLog.t0=typeof performance!=='undefined'?performance.now():Date.now();cameraWriteHook.log=camLogWrite;try{(g||globalThis).__qfCamTag={t:camTag,d:camTagDefault};}catch{}}
 return camLog.on;
}
/** test-only */
export function camLogReset():void{st.fr=0;st.bad='';try{delete (globalThis as any).__qfCamTag;}catch{}started=false;camLog.on=false;camLog.tag='';camLog.n=0;camLog.has=false;camLog.last='';cameraWriteHook.log=null;}
/** Read the switch once, at module load (game init). */
camLogStart();
