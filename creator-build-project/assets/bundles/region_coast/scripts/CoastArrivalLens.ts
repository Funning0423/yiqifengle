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
export type HerFrame=Readonly<{root:V3;clip:string;clipTime:number;heading:V3}>;
/** her root (world) and the clip/time she plays at t. */
export function arrivalHer(t:number):HerFrame{if(!herRows)herRows=dec(K.her,K.n_her,3);const r=at(herRows,Math.min(t,K.total)),C=K.clips,[ws,we]=K.walk;
 const r2=at(herRows,Math.min(t+0.1,K.total)),hd=[r2[0]-r[0],0,r2[2]-r[2]],l=Math.hypot(hd[0],hd[2]);
 let clip:string=C.idle,ct=0;
 if(t<ws){const p=at(herRows,Math.max(0,t-0.1)),moving=Math.hypot(r2[0]-p[0],r2[2]-p[2])>0.02;clip=moving?C.walk:C.idle;ct=t;}
 else if(t<C.loopAt){clip=C.walkStart;ct=t-ws;}else if(t<C.stopAt){clip=C.walk;ct=t-C.loopAt;}else if(t<we){clip=C.stop;ct=t-C.stopAt;}else{clip=C.idle;ct=t-we;}
 return {root:[r[0],r[1],r[2]] as V3,clip,clipTime:ct,heading:(l>1e-4?[hd[0]/l,0,hd[2]/l]:[0,0,1]) as V3};}
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
