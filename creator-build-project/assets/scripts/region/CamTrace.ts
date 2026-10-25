/** Test-only per-frame camera trace (?camTrace=1, web only). Off by default: every hook is one boolean check, no allocation.
 *  On: each frame keeps {t, region, cam pos, yaw/pitch, writers (applyCameraPose sources + sub-path), LensGuard, FreeOrbit, her pos, walking, occFace / occChest (p0drag10: her face / chest hidden by a proxy box)}
 *  in a 60 s ring (3600 frames). Console: __qfCamTrace.dump() → JSON string; copy(__qfCamTrace.dump()); __qfCamTrace.save('name') downloads a .json. */
import { cameraWriteHook } from '../world-r1/CameraPose';
export type CamTraceFrame={[k:string]:unknown};
export const camTrace={on:false,sub:'',writers:[] as string[],frames:[] as CamTraceFrame[],head:0,max:3600,t0:0,count:0};
export function camTraceParse(q:string):boolean{return /(?:^|[?&])camTrace=1(?:&|$)/.test(q);}
export function camTraceInit(q?:string):boolean{
 let s=q;if(s===undefined){try{s=typeof location!=='undefined'?String(location.search||''):'';}catch{s='';}}
 camTrace.on=camTraceParse(s);camTrace.frames=[];camTrace.head=0;camTrace.count=0;camTrace.writers=[];camTrace.sub='';camTrace.t0=Date.now();
 const g=globalThis as any;cameraWriteHook.trace=camTrace.on?camTraceWrite:null;g.__qfCamTraceSub=camTrace.on?camTraceSub:undefined;
 g.__qfCamTrace=camTrace.on?{frame:camTraceFrame,round:camTraceRound,dump:camTraceDump,save:camTraceSave,clear:()=>{camTrace.frames=[];camTrace.head=0;camTrace.count=0;},get size(){return camTrace.frames.length;}}:undefined;
 return camTrace.on;
}
/** applyCameraPose hook. */
export function camTraceWrite(source:string):void{if(!camTrace.on)return;camTrace.writers.push(camTrace.sub?source+':'+camTrace.sub:source);camTrace.sub='';}
export function camTraceSub(sub:string):void{if(camTrace.on)camTrace.sub=sub;}
const r3=(v:number)=>Math.round(v*1000)/1000;
export function camTraceRound(v:readonly number[]):number[]{const o=new Array(v.length);for(let i=0;i<v.length;i++)o[i]=r3(v[i]);return o;}
/** Call once per frame, only inside `if(camTrace.on)`. */
export function camTraceFrame(state:CamTraceFrame):void{
 if(!camTrace.on)return;
 state.t=r3((Date.now()-camTrace.t0)/1000);state.w=camTrace.writers;camTrace.writers=[];camTrace.sub='';camTrace.count++;
 if(camTrace.frames.length<camTrace.max)camTrace.frames.push(state);else{camTrace.frames[camTrace.head]=state;camTrace.head=(camTrace.head+1)%camTrace.max;}
}
export function camTraceOrdered():CamTraceFrame[]{const f=camTrace.frames;return f.length<camTrace.max?f.slice():f.slice(camTrace.head).concat(f.slice(0,camTrace.head));}
export function camTraceDump():string{return JSON.stringify({kind:'qf-camtrace',v:1,frames:camTrace.count,kept:camTrace.frames.length,trace:camTraceOrdered()});}
export function camTraceSave(name='camtrace'):string{
 const s=camTraceDump();
 try{const d=(globalThis as any).document;const a=d.createElement('a');a.href=URL.createObjectURL(new Blob([s],{type:'application/json'}));a.download=name+'.json';d.body.appendChild(a);a.click();a.remove();}catch(e){console.log('camTrace save failed, use copy(__qfCamTrace.dump())',e);}
 return name+'.json ('+s.length+' B)';
}
let started=false;
/** RegionNodeStage.attach: read ?camTrace=1 once per page. */
export function camTraceStart():void{if(started)return;started=true;camTraceInit();}
