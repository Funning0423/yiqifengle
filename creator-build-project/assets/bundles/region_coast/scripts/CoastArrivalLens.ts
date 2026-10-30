/**
 * 运镜bot cine/b20-coast-arrival-runtime — island->coast arrival (海岸到达) at runtime, coast kit only (?qfcoastkit=1 /
 * __qfCoastBoardKit===true, via regional-r05/runtime/coast-kit.js enabled()). Lives in the region_coast bundle (subpackage).
 * Plays the accepted camera (ref_transition.json = 46459044, Grok Bot) and her real clips, then ends EXACTLY on
 * coastBoardPose(w,h) so the enter-level push-in holds (WorldFlowComponent samePose -> 0 writes): one camera writer per frame.
 * S6 pause at coast (0,0,10.25); S7 walk 35.575-39.825 s to stop (0,0,5.15) at 1.2 m/s: walk_start -> walk_loop (37.108)
 * -> walk_stop_bodyL (38.358) -> idle_breathing_loop; board pose lands at 42.175 s. Pure: no 'cc' import (node-testable);
 * the engine side comes in through deps (camera write = applyCameraPose only, her clip/time/root, frame clock).
 */
import { applyCameraPose, fromLookAt, type CameraLike, type LookAtPose, type V3 } from '../../../scripts/world-r1/CameraPose';
import { coastBoardPose } from '../../../scripts/region/CoastBoardLens';
import { COAST_ARRIVAL_TRACK as K } from './CoastArrivalTrack';
export const COAST_ARRIVAL_SOURCE='coast.arrival';
export const COAST_ARRIVAL_SCREENS=Object.freeze(Object.keys(K.s7));
type Rows=number[][];
function dec(a:readonly number[],n:number,cols:number):Rows{const out:Rows=Array.from({length:n},()=>new Array(cols).fill(0));
 for(let c=0;c<cols;c++){let v=0;for(let i=0;i<n;i++){v+=a[c*n+i];out[i][c]=v/K.scale;}}return out;}
const cache=new Map<string,Rows>();let herRows:Rows|null=null;
/** the baked track for the nearest authored screen (exact key, else closest aspect). */
export function arrivalScreen(w:number,h:number):string{const k=w+'x'+h;if((K.s7 as any)[k])return k;let best=COAST_ARRIVAL_SCREENS[0],d=1e9;
 for(const s of COAST_ARRIVAL_SCREENS){const [a,b]=s.split('x').map(Number),e=Math.abs(a/b-w/h);if(e<d){d=e;best=s;}}return best;}
export function arrivalRows(screen:string):Rows{let r=cache.get(screen);if(r)return r;const sh=dec(K.shared,K.n_shared,7),s7=dec((K.s7 as any)[screen],(K.s7_len as any)[screen],7);
 r=sh.concat(s7.slice(1));cache.set(screen,r);return r;}
export const COAST_ARRIVAL_TOTAL_S:number=K.total;
const lerp=(a:number[],b:number[],u:number)=>a.map((v,i)=>v+(b[i]-v)*u);
function at(rows:Rows,t:number):number[]{const f=Math.max(0,Math.min(rows.length-1,t*K.fps)),i=Math.min(rows.length-2,Math.floor(f));return lerp(rows[i],rows[i+1],f-i);}
/** camera look-at at time t (s) on a w x h screen; t >= total -> exactly the coast board pose. */
export function arrivalPose(w:number,h:number,t:number):LookAtPose{if(t>=K.total-1e-9)return coastBoardPose(w,h);const r=at(arrivalRows(arrivalScreen(w,h)),t);
 return {position:[r[0],r[1],r[2]] as V3,target:[r[3],r[4],r[5]] as V3,fovVerticalDeg:r[6]};}
export type HerFrame=Readonly<{root:V3;clip:string;clipTime:number;heading:V3;t?:number}>;
/** her root (world) and the clip/time she plays at t. */
export function arrivalHer(t:number):HerFrame{if(!herRows)herRows=dec(K.her,K.n_her,3);const r=at(herRows,Math.min(t,K.total)),C=K.clips,[ws,we]=K.walk;
 const r2=at(herRows,Math.min(t+0.1,K.total)),hd=[r2[0]-r[0],0,r2[2]-r[2]],l=Math.hypot(hd[0],hd[2]);
 let clip:string=C.idle,ct=0;
 if(t<ws){const p=at(herRows,Math.max(0,t-0.1)),moving=Math.hypot(r2[0]-p[0],r2[2]-p[2])>0.02;clip=moving?C.walk:C.idle;ct=t;}
 else if(t<C.loopAt){clip=C.walkStart;ct=t-ws;}else if(t<C.stopAt){clip=C.walk;ct=t-C.loopAt;}else if(t<we){clip=C.stop;ct=t-C.stopAt;}else{clip=C.idle;ct=t-we;}
 return {t,root:[r[0],r[1],r[2]] as V3,clip,clipTime:ct,heading:(l>1e-4?[hd[0]/l,0,hd[2]/l]:[0,0,1]) as V3};}
export type CoastArrivalDeps=Readonly<{
 camera:CameraLike;
 viewport():Readonly<{width:number;height:number}>;
 nextFrame():Promise<number>;      // resolves with the frame dt (s)
 her?(f:HerFrame):void;            // engine side: SkeletalAnimation clip + time, root position/heading (CharacterMotion untouched)
 cancelled?():boolean;
}>;
/** Play the arrival; resolves when the camera sits exactly on the coast board pose (or on cancel). Writes only via applyCameraPose. */
export async function playCoastArrival(deps:CoastArrivalDeps):Promise<{ok:boolean;frames:number;seconds:number}>{
 let t=0,frames=0;
 for(;;){const v=deps.viewport(),pose=arrivalPose(v.width,v.height,t);
  applyCameraPose(deps.camera,fromLookAt(pose,pose.fovVerticalDeg??50),COAST_ARRIVAL_SOURCE);deps.her?.(arrivalHer(t));frames++;
  if(t>=K.total-1e-9)return {ok:true,frames,seconds:t};
  if(deps.cancelled?.())return {ok:false,frames,seconds:t};
  const dt=await deps.nextFrame();t=Math.min(K.total,t+Math.max(0,dt));}
}

/* ---- GGbot ggbot/coast-arrival-her: coastArrivalHer(world)(f) — her side of the arrival, no frozen file, CharacterMotion untouched.
 * Her pose is owned by CharacterMotion (FlowReferenceStandin, WorldIntegrationBoot.ts:88): WorldFlowCore.advance (WorldFlowCore.ts:660)
 * ticks adapter.advance(dt) every frame and its AnimRig/MotionClock is the SOLE animation clock (engine SkeletalAnimation states are
 * stopped on purpose, region/EngineAnimStop.ts). Writing f.clip/f.clipTime into the SkeletalAnimation would be overwritten by the
 * rig on the next advance (two writers). So her clips go through the adapter's public action API, exactly like SailRide
 * (region/SailRide.ts:309-317): one perform({kind:'walk',path,duration,stopAtEnd:true}) per baked walk; CharacterMotion itself plays
 * walk_start -> walk_loop -> walk_stop_bodyL -> idle_breathing_loop. No yield needed: between walks we write nothing.
 * Adapter lookup = the existing WindAudio route (audio/WindAudio.ts:208-210): scene WorldIntegrationBoot._referenceAdapter
 * (WorldIntegrationBoot.ts:437), adapter.node = her root (SailRide.ts:309). No 'cc' import (string component lookup). */
export type CoastWalk=Readonly<{start:number;end:number;path:V3[]}>;
let walks:CoastWalk[]|null=null;
/** baked walks: moving spans of her root (>=0.02 m per 0.1 s), path decimated to <=0.02 m chord error (keeps S7 straight = 2 points). */
export function coastArrivalWalks():CoastWalk[]{if(walks)return walks;if(!herRows)herRows=dec(K.her,K.n_her,3);const R=herRows,[ws,we]=K.walk,fps=K.fps,out:CoastWalk[]=[];
 const n=Math.min(R.length,Math.floor(ws*fps)-7),mv=(i:number)=>{const a=R[Math.max(0,i-6)],b=R[Math.min(R.length-1,i+6)];return Math.hypot(b[0]-a[0],b[2]-a[2])>0.02;};
 // before S7: moving spans of her root (same 0.02 m / 0.2 s test as arrivalHer), path decimated to <=0.02 m chord error
 let i=0;while(i<n){if(!mv(i)){i++;continue;}let j=i;while(j+1<n&&mv(j+1))j++;
  let s0=i,e0=j;while(s0>0&&d2(R[s0-1],R[s0])>1e-9)s0--;while(e0+1<n&&d2(R[e0+1],R[e0])>1e-9)e0++;
  out.push({start:s0/fps,end:e0/fps,path:simplify(R,s0,e0,0.02).map(k=>[R[k][0],R[k][1],R[k][2]] as V3)});i=e0+1;}
 // S7: authored window K.walk exactly (walk_start -> walk_loop -> walk_stop_bodyL inside CharacterMotion)
 const a=at(R,ws),z=R[R.length-1]/* settled stop root (S7 stop, coast (0,0,5.15)) */;out.push({start:ws,end:we,path:[[a[0],a[1],a[2]] as V3,[z[0],z[1],z[2]] as V3]});
 walks=out;return out;}
const d2=(a:number[],b:number[])=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
function simplify(R:Rows,a:number,b:number,tol:number):number[]{let m=-1,d=0;const A=R[a],B=R[b],L=Math.hypot(B[0]-A[0],B[1]-A[1],B[2]-A[2])||1e-9;
 for(let k=a+1;k<b;k++){const P=R[k],u=Math.max(0,Math.min(1,((P[0]-A[0])*(B[0]-A[0])+(P[1]-A[1])*(B[1]-A[1])+(P[2]-A[2])*(B[2]-A[2]))/(L*L)));
  const e=Math.hypot(P[0]-A[0]-u*(B[0]-A[0]),P[1]-A[1]-u*(B[1]-A[1]),P[2]-A[2]-u*(B[2]-A[2]));if(e>d){d=e;m=k;}}
 return d>tol&&m>0?simplify(R,a,m,tol).slice(0,-1).concat(simplify(R,m,b,tol)):[a,b];}
/** minimal Cancellation duck (WorldFlowCore.ts:24 contract: cancelled/check/onCancel/cancel/wait) so the lens needs no WorldFlowCore import. */
class HerToken{cancelled=false;private l:Array<()=>void>=[];check(){if(this.cancelled)throw Error('coast-arrival-cancelled');}
 onCancel(fn:()=>void){if(this.cancelled)fn();else this.l.push(fn);return ()=>{const i=this.l.indexOf(fn);if(i>=0)this.l.splice(i,1);};}
 cancel(){if(this.cancelled)return;this.cancelled=true;const a=this.l;this.l=[];for(const f of a)f();}
 wait<T>(p:Promise<T>):Promise<T>{return new Promise<T>((ok,no)=>{const off=this.onCancel(()=>no(Error('coast-arrival-cancelled')));p.then(v=>{off();ok(v);},e=>{off();no(e);});});}}
export type HerAdapterLike={node?:any;perform(a:any,token:any):Promise<void>};
/** her adapter from the world: explicit world.coastArrivalAdapter (tests) -> scene WorldIntegrationBoot._referenceAdapter. */
export function coastHerAdapter(world:any):HerAdapterLike|null{try{if(world?.coastArrivalAdapter)return world.coastArrivalAdapter;
 const scene=world?.node?.scene;const boot=scene?.getComponentInChildren?.('WorldIntegrationBoot');const a=boot?._referenceAdapter;return a&&typeof a.perform==='function'?a:null;}catch{return null;}}
export type CoastHerDriver=((f:HerFrame)=>void)&{dispose():void;readonly started:number;readonly errors:string[]};
/** world.coastArrivalHer equivalent: const her=coastArrivalHer(world); playCoastArrival({...,her}); her.dispose() after.
 *  First frame: if her root is >0.05 m off f.root she is placed there once (setWorldPosition + facing f.heading) — she is not walking then.
 *  Each baked walk starts once when f.t reaches its start; nothing else is written (no per-frame allocation besides the 1-time walk). */
export function coastArrivalHer(world:any):CoastHerDriver{const W=coastArrivalWalks(),token=new HerToken(),errors:string[]=[];let next=0,first=true,started=0,busy=false;
 const drv=((f:HerFrame)=>{if(token.cancelled)return;const a=coastHerAdapter(world);if(!a){if(!errors.length){errors.push('no-adapter');console.warn('[QF_COAST] arrival: her adapter missing');}return;}
  const t=f.t??0,node=a.node;
  if(first){first=false;try{const p=node?.worldPosition;if(node&&p&&Math.hypot(p.x-f.root[0],p.y-f.root[1],p.z-f.root[2])>0.05&&!busy){node.setWorldPosition(f.root[0],f.root[1],f.root[2]);
    const y=Math.atan2(f.heading[0],f.heading[2]);node.setRotationFromEuler?.(0,y*180/Math.PI,0);}}catch(e){errors.push(String(e));}}
  while(next<W.length&&t+1e-9>=W[next].start&&!busy){const w=W[next++];if(t>w.end)continue;busy=true;started++;
   a.perform({kind:'walk',path:w.path,duration:Math.max(0.35,w.end-t),stopAtEnd:true},token).then(()=>{busy=false;},e=>{busy=false;if(!token.cancelled){errors.push(String(e));console.warn('[QF_COAST] arrival walk',String(e));}});}
 }) as CoastHerDriver;
 drv.dispose=()=>token.cancel();Object.defineProperty(drv,'started',{get:()=>started});(drv as any).errors=errors;return drv;}
/** puts the driver on the existing world object (no WorldFlowComponent edit): world.coastArrivalHer(f); returns dispose. */
export function installCoastArrivalHer(world:any):()=>void{const d=coastArrivalHer(world);world.coastArrivalHer=d;return ()=>{d.dispose();if(world.coastArrivalHer===d)delete world.coastArrivalHer;};}
