/** Slow sail and balloon loads hold the current cover and retry. */
export type VehicleKind='sail'|'balloon';
export type TransportClock={now():number;sleep(ms:number):Promise<void>};
export type TransportWaitSnapshot={
 active:boolean;
 kind:VehicleKind|null;
 attempt:number;
 elapsedMs:number;
 coverAlpha:number;
 gentle:true;
 cameraHeld:true;
};
/** Sail/balloon asset requests may outlast the old 6 s bridge fallback and the 20 s region deadline. */
export const VEHICLE_ASSET_WAIT_MS=120000;
export const TRANSPORT_RETRY_GAP_MS=400;
export const TRANSPORT_RETRY_CAP=8;
let snapshot:TransportWaitSnapshot={active:false,kind:null,attempt:0,elapsedMs:0,coverAlpha:0,gentle:true,cameraHeld:true};
export function transportWaitSnapshot():TransportWaitSnapshot{return snapshot;}
export function resetTransportWait():void{
 snapshot={active:false,kind:null,attempt:0,elapsedMs:0,coverAlpha:0,gentle:true,cameraHeld:true};
 try{delete (globalThis as any).__QF_TRANSPORT_WAIT;}catch{/* no host */}
}
function publish(next:TransportWaitSnapshot):void{
 snapshot=next;
 try{(globalThis as any).__QF_TRANSPORT_WAIT=snapshot;}catch{/* no host */}
 if(next.active){try{console.info('[QF_TRANSPORT_WAIT] '+JSON.stringify(snapshot));}catch{/* ignore */}}
}
/** Virtual or real clock. `sleep` steps so a cover hook can sample the wait without a black frame. */
export function createTransportClock(onTick?:(t:number)=>void,stepMs=250):TransportClock{
 let t=0;
 return {
  now(){return t;},
  async sleep(ms:number){
   let left=Math.max(0,ms);
   while(left>0){
    const d=Math.min(stepMs,left);
    t+=d;left-=d;
    onTick?.(t);
    await Promise.resolve();
   }
  },
 };
}
const realClock:TransportClock={
 now:()=>Date.now(),
 sleep:(ms)=>new Promise(resolve=>{setTimeout(resolve,ms);}),
};
function fatalWait(error:unknown):boolean{
 const text=String((error as {message?:string})?.message||error);
 return /cancel|stale|destroyed|disposed/.test(text);
}
/** True when every sample stays on the alpha the wait started with. */
export function coverStayedContinuous(samples:readonly number[],epsilon=0.02):boolean{
 if(samples.length<2)return false;
 for(let i=1;i<samples.length;i++)if(Math.abs(samples[i]-samples[0])>epsilon)return false;
 return true;
}
/**
 * Wait out a slow or failed sail/balloon load.
 * The cover alpha captured at the start is written back unchanged (no fade to black, no clear).
 * The camera is not written. Cancellation and a destroyed owner abort; other failures retry.
 */
export async function awaitVehicle<T>(opts:{
 kind:VehicleKind;
 load:(attempt:number)=>Promise<T>;
 cancelled?:()=>boolean;
 clock?:TransportClock;
 coverAlpha?:()=>number;
 onCover?:(alpha:number)=>void;
 retryGapMs?:number;
 maxAttempts?:number;
}):Promise<{kind:VehicleKind;value:T;attempts:number;cover:number[]}>{
 const clock=opts.clock??realClock;
 const gap=opts.retryGapMs??TRANSPORT_RETRY_GAP_MS;
 const cap=opts.maxAttempts??TRANSPORT_RETRY_CAP;
 const alpha0=opts.coverAlpha?opts.coverAlpha():0;
 const samples:number[]=[];
 const hold=()=>{samples.push(alpha0);opts.onCover?.(alpha0);};
 const started=clock.now();
 let attempt=0;
 let last:unknown=Error('transport-wait-exhausted');
 while(attempt<cap){
  if(opts.cancelled?.())throw Error('transport-wait-cancelled');
  attempt++;
  publish({active:true,kind:opts.kind,attempt,elapsedMs:clock.now()-started,coverAlpha:alpha0,gentle:true,cameraHeld:true});
  hold();
  try{
   const value=await opts.load(attempt);
   hold();
   publish({active:false,kind:opts.kind,attempt,elapsedMs:clock.now()-started,coverAlpha:alpha0,gentle:true,cameraHeld:true});
   return {kind:opts.kind,value,attempts:attempt,cover:samples.slice()};
  }catch(error){
   last=error;
   if(opts.cancelled?.()||fatalWait(error)){
    publish({active:false,kind:opts.kind,attempt,elapsedMs:clock.now()-started,coverAlpha:alpha0,gentle:true,cameraHeld:true});
    throw error;
   }
   hold();
   if(attempt>=cap)break;
   await clock.sleep(gap);
   hold();
  }
 }
 publish({active:false,kind:opts.kind,attempt,elapsedMs:clock.now()-started,coverAlpha:alpha0,gentle:true,cameraHeld:true});
 throw last;
}
