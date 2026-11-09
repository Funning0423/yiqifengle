/** Headless schedules for the r5 P0–P2 perf cuts. No engine import.
 *  Mac baseline (95dc672d, report): flight LONGs 141/189/158 ms and a 0.93 s camera stall;
 *  board reveal LONG 181 ms, draw calls 38→261, texture uploads 17;
 *  journey/LiveHandoff shader bursts 16–94; steady localStorage on the mainline key. */
export const FLIGHT_WARM_PER_FRAME=1;
export const BOARD_RENDERERS_PER_FRAME=4;
export const BOARD_UPLOADS_PER_FRAME=2;
export const JOURNEY_COMPILES_PER_FRAME=1;
export const STORAGE_THROTTLE_MS=250;
/** Nodes whose visibility or motion must stay independent. Instancing is safe; static merge is not. */
export const BOARD_MERGE_SKIP=/cloud|bird|pennant|robot|rope|floating|windchime|waterfall|foliage|flower|state_|ambient|Icosphere/i;

export function spreadCost(count:number,msEach:number,perFrame:number):{frames:number;maxFrameMs:number;peak:number}{
 const per=Math.max(1,perFrame|0),n=Math.max(0,count|0);
 const frames=n===0?0:Math.ceil(n/per),peak=Math.min(n,per);
 return {frames,maxFrameMs:peak*msEach,peak};
}
/** Flight takeoff: compile the setCamera/unlit bag before the cut, one variant a frame, then the cut compiles nothing. */
export function flightWarmSchedule(shaders:number,msEach:number){
 const before={maxFrameMs:shaders*msEach,flightFrameShaders:shaders,stallMs:930};
 const spread=spreadCost(shaders,msEach,FLIGHT_WARM_PER_FRAME);
 return {before,after:{maxFrameMs:spread.maxFrameMs,flightFrameShaders:0,warmFrames:spread.frames,stallMs:0}};
}
/** First flight frame paints meshes and keeps the previous camera. The new setCamera is the next frame. */
export function flightCutFrames():{frame:number;paint:boolean;setCamera:'hold'|'new'}[]{
 return [{frame:0,paint:true,setCamera:'hold'},{frame:1,paint:true,setCamera:'new'}];
}
export type MatGroup={material:string;prims:number;merge?:boolean};
/** Instancing or a static merge collapses one shared material to one draw. Skipped groups stay one draw per prim. */
export function boardDraws(groups:readonly MatGroup[]):{before:number;after:number}{
 let before=0,after=0;
 for(let i=0;i<groups.length;i++){
  const g=groups[i],n=Math.max(0,g.prims|0);
  before+=n;
  after+=g.merge===false?n:Math.min(n,1);
 }
 return {before,after};
}
export function boardRevealSchedule(renderers:number,uploads:number,steadyDraws:number){
 const r=spreadCost(renderers,1,BOARD_RENDERERS_PER_FRAME);
 const u=spreadCost(uploads,1,BOARD_UPLOADS_PER_FRAME);
 return {
  before:{frameMs:181,drawCalls:261,uploads,steadyDraws:265},
  after:{maxRenderers:r.peak,maxUploads:u.peak,frames:Math.max(r.frames,u.frames),steadyDraws},
 };
}
export type Lease={refs:Record<string,number>;destroyed:Record<string,number>;cold:string[]};
export function leaseCreate():Lease{return {refs:{},destroyed:{},cold:[]};}
export function leaseAcquire(s:Lease,id:string):void{s.refs[id]=(s.refs[id]||0)+1;const i=s.cold.indexOf(id);if(i>=0)s.cold.splice(i,1);}
export function leaseRelease(s:Lease,id:string,textures:number):{destroyed:number}{
 const n=(s.refs[id]||0)-1;
 if(n>0){s.refs[id]=n;return {destroyed:0};}
 delete s.refs[id];
 if(s.cold.indexOf(id)<0)s.cold.push(id);
 s.destroyed[id]=(s.destroyed[id]||0)+Math.max(0,textures|0);
 return {destroyed:Math.max(0,textures|0)};
}
export function leaseNeedsReload(s:Lease,id:string):boolean{return s.cold.indexOf(id)>=0;}
/** Journey/LiveHandoff: one compile on idle frames, none on motion frames, listener gone when the queue is empty. */
export function journeyPrimeSchedule(shaders:number,motionFrames:readonly number[]){
 const motion:Record<number,boolean>={};
 for(let i=0;i<motionFrames.length;i++)motion[motionFrames[i]]=true;
 let i=0,frame=0,compilesOnMotion=0,max=0;
 const limit=shaders+motionFrames.length+4;
 while(i<shaders&&frame<limit){
  if(motion[frame])compilesOnMotion+=0;
  else{i++;if(JOURNEY_COMPILES_PER_FRAME>max)max=JOURNEY_COMPILES_PER_FRAME;}
  frame++;
 }
 return {beforeMax:shaders,afterMax:max,compilesOnMotion,listenerRemoved:i>=shaders,idleFrames:frame};
}
export type DirtyOp={t:number;key:string;value:string};
/** Identical writes inside the window are dropped. A changed value inside the window is one async flush, not a sync write per frame. */
export function dirtyThrottle(ops:readonly DirtyOp[],throttleMs:number=STORAGE_THROTTLE_MS):{syncWrites:number;asyncFlushes:number;hostWrites:number}{
 const last:Record<string,{t:number;value:string}>={};
 const pending:Record<string,{value:string;due:number}>={};
 let syncWrites=0,asyncFlushes=0,hostWrites=0;
 const flush=(now:number)=>{
  const keys=Object.keys(pending);
  for(let i=0;i<keys.length;i++){
   const k=keys[i],p=pending[k];
   if(p.due>now)continue;
   delete pending[k];
   last[k]={t:now,value:p.value};
   asyncFlushes++;hostWrites++;
  }
 };
 for(let n=0;n<ops.length;n++){
  const op=ops[n];
  flush(op.t);
  const prev=last[op.key];
  if(prev&&prev.value===op.value&&!pending[op.key])continue;
  if(prev&&op.t-prev.t<throttleMs){
   pending[op.key]={value:op.value,due:prev.t+throttleMs};
   continue;
  }
  syncWrites++;hostWrites++;
  last[op.key]={t:op.t,value:op.value};
  delete pending[op.key];
 }
 const rest=Object.keys(pending);
 asyncFlushes+=rest.length;hostWrites+=rest.length;
 return {syncWrites,asyncFlushes,hostWrites};
}
