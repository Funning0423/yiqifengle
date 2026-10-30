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
import { loadCoastScene, coastIslandMaterial, coastBundleNode } from './CoastSceneLoader';
import { COAST_REUSE_SOURCES } from './CoastSceneLayout';   // 场景设计部 1062a72b, same bundle
export const COAST_ARRIVAL_SOURCE='coast.arrival';
export const COAST_ARRIVAL_SCREENS=Object.freeze(Object.keys(K.s7));
type Rows=number[][];
type Keys=readonly [string,string];   // [frame deltas, value deltas (1e-4 ints)], each a zigzag-varint string (bake_track.py pack())
const A64='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
function unpack(s:string):number[]{const o:number[]=[];let u=0,sh=0;for(let i=0;i<s.length;i++){const d=A64.indexOf(s[i]);u+=(d&31)*2**sh;
 if(d&32){sh+=5;continue;}o.push(u%2?-(u+1)/2:u/2);u=0;sh=0;}return o;}
/** v3 decode: piecewise-linear keys per column -> n frames (float, /scale). */
function col(k:Keys,n:number):number[]{const K:number[]=[],V:number[]=[],f=unpack(k[0]),d=unpack(k[1]);let a=0,b=0;for(let i=0;i<f.length;i++){a+=f[i];b+=d[i];K.push(a);V.push(b);}
 const out=new Array(n);let j=0;for(let i=0;i<n;i++){while(j+1<K.length&&K[j+1]<i)j++;out[i]=(j+1>=K.length?V[V.length-1]:V[j]+(V[j+1]-V[j])*(i-K[j])/(K[j+1]-K[j]))/K_SCALE;}return out;}
const K_SCALE:number=K.scale;
function dec(cols:readonly Keys[],n:number,base?:Rows):Rows{const c=cols.map(k=>col(k,n));return Array.from({length:n},(_,i)=>c.map((x,k)=>x[i]+(base?base[i][k]:0)));}
const cache=new Map<string,Rows>();let herRows:Rows|null=null;
/** the baked track for the nearest authored screen (exact key, else closest aspect). */
export function arrivalScreen(w:number,h:number):string{const k=w+'x'+h;if((K.s7 as any)[k])return k;let best=COAST_ARRIVAL_SCREENS[0],d=1e9;
 for(const s of COAST_ARRIVAL_SCREENS){const [a,b]=s.split('x').map(Number),e=Math.abs(a/b-w/h);if(e<d){d=e;best=s;}}return best;}
export function arrivalRows(screen:string):Rows{let r=cache.get(screen);if(r)return r;const n7=(K.s7_len as any)[screen],sh=dec(K.shared as any,K.n_shared),b7=dec((K.s7 as any)[K.base],n7),s7=screen===K.base?b7:dec((K.s7 as any)[screen],n7,b7);
 r=sh.concat(s7.slice(1));cache.set(screen,r);return r;}
export const COAST_ARRIVAL_TOTAL_S:number=K.total;
/** interpolate rows at frame position f (clamped) into out (no allocation). */
function rowInto(rows:Rows,f:number,out:number[]):number[]{f=Math.max(0,Math.min(rows.length-1,f));const i=Math.min(rows.length-2,Math.floor(f)),u=f-i,A=rows[i],B=rows[i+1];
 for(let k=0;k<A.length;k++)out[k]=A[k]+(B[k]-A[k])*u;return out;}
const at=(rows:Rows,t:number):number[]=>rowInto(rows,t*K.fps,[]);
const S_CAM:number[]=[0,0,0,0,0,0,0];
function poseInto(w:number,h:number,t:number,o:{position:V3;target:V3;fovVerticalDeg:number}):LookAtPose{if(t>=K.total-1e-9)return coastBoardPose(w,h);
 const r=rowInto(arrivalRows(arrivalScreen(w,h)),t*K.fps,S_CAM),p=o.position as number[],q=o.target as number[];p[0]=r[0];p[1]=r[1];p[2]=r[2];q[0]=r[3];q[1]=r[4];q[2]=r[5];o.fovVerticalDeg=r[6];return o;}
/** camera look-at at time t (s) on a w x h screen; t >= total -> exactly the coast board pose. Fresh object (tests/tools); the player reuses one. */
export function arrivalPose(w:number,h:number,t:number):LookAtPose{return poseInto(w,h,t,{position:[0,0,0],target:[0,0,0],fovVerticalDeg:0});}
/** NOTE: playCoastArrival passes ONE reused HerFrame per call; consumers copy what they keep. */
export type HerFrame=Readonly<{root:V3;clip:string;clipTime:number;heading:V3;t?:number}>;
type HerOut={root:V3;clip:string;clipTime:number;heading:V3;t:number};
const S_H0:number[]=[0,0,0],S_H1:number[]=[0,0,0],S_H2:number[]=[0,0,0],LOOK=Math.round(0.1*K.fps);
/** her root/clip at t: one track position per frame (f), the +-0.1 s rows are the same index shifted by LOOK keys (exact at fps 60). */
function herInto(t:number,o:HerOut):HerOut{if(!herRows)herRows=dec(K.her as any,K.n_her);const C=K.clips,[ws,we]=K.walk,f=Math.min(t,K.total)*K.fps,R=herRows;
 const r=rowInto(R,f,S_H0),r2=rowInto(R,Math.min(f+LOOK,K.total*K.fps),S_H1),hx=r2[0]-r[0],hz=r2[2]-r[2],l=Math.hypot(hx,hz);
 let clip:string=C.idle,ct=0;
 if(t<ws){const p=rowInto(R,Math.max(0,f-LOOK),S_H2),moving=Math.hypot(r2[0]-p[0],r2[2]-p[2])>0.02;clip=moving?C.walk:C.idle;ct=t;}
 else if(t<C.loopAt){clip=C.walkStart;ct=t-ws;}else if(t<C.stopAt){clip=C.walk;ct=t-C.loopAt;}else if(t<we){clip=C.stop;ct=t-C.stopAt;}else{clip=C.idle;ct=t-we;}
 const R0=o.root as number[],H=o.heading as number[];o.t=t;R0[0]=r[0];R0[1]=r[1];R0[2]=r[2];o.clip=clip;o.clipTime=ct;
 if(l>1e-4){H[0]=hx/l;H[1]=0;H[2]=hz/l;}else{H[0]=0;H[1]=0;H[2]=1;}return o;}
/** her root (world) and the clip/time she plays at t. Fresh object (tests/tools); the player reuses one. */
export function arrivalHer(t:number):HerFrame{return herInto(t,{t:0,root:[0,0,0],clip:'',clipTime:0,heading:[0,0,1]});}
export type CoastArrivalDeps=Readonly<{
 camera:CameraLike;
 viewport():Readonly<{width:number;height:number}>;
 nextFrame():Promise<number>;      // resolves with the frame dt (s)
 her?(f:HerFrame):void;            // engine side: SkeletalAnimation clip + time, root position/heading (CharacterMotion untouched)
 cancelled?():boolean;
}>;
/** Play the arrival; resolves when the camera sits exactly on the coast board pose (or on cancel). Writes only via applyCameraPose. */
export async function playCoastArrival(deps:CoastArrivalDeps):Promise<{ok:boolean;frames:number;seconds:number}>{
 let t=0,frames=0;const look={position:[0,0,0] as V3,target:[0,0,0] as V3,fovVerticalDeg:50},her:HerOut={t:0,root:[0,0,0],clip:'',clipTime:0,heading:[0,0,1]};
 for(;;){const v=deps.viewport(),pose=poseInto(v.width,v.height,t,look);
  applyCameraPose(deps.camera,fromLookAt(pose,pose.fovVerticalDeg??50),COAST_ARRIVAL_SOURCE);if(deps.her)deps.her(herInto(t,her));frames++;
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
/** S7 walk window at runtime (s): 9.4 s for 5.095 m -> planWalk cruise 0.598 m/s = 0.855 x native 0.7 (band 0.75..1.3), walk_start + walk_stop_bodyL kept; ends 2.10 s before the board pose (lead 1.5..2.5). Chosen by her_walk_replay + her_size_walk (390x520 min 39.35 px). */
export const COAST_S7_WALK:readonly [number,number]=Object.freeze([30.675,40.075]) as any;
export type CoastWalk=Readonly<{start:number;end:number;path:V3[]}>;
let walks:CoastWalk[]|null=null;
/** baked walks: moving spans of her root (>=0.02 m per 0.1 s), path decimated to <=0.02 m chord error (keeps S7 straight = 2 points). */
export function coastArrivalWalks():CoastWalk[]{if(walks)return walks;if(!herRows)herRows=dec(K.her as any,K.n_her);const R=herRows,[ws,we]=K.walk,fps=K.fps,out:CoastWalk[]=[];
 const n=Math.min(R.length,Math.floor(ws*fps)-7),mv=(i:number)=>{const a=R[Math.max(0,i-6)],b=R[Math.min(R.length-1,i+6)];return Math.hypot(b[0]-a[0],b[2]-a[2])>0.02;};
 // before S7: moving spans of her root (same 0.02 m / 0.2 s test as arrivalHer), path decimated to <=0.02 m chord error
 let i=0;while(i<n){if(!mv(i)){i++;continue;}let j=i;while(j+1<n&&mv(j+1))j++;
  let s0=i,e0=j;while(s0>0&&d2(R[s0-1],R[s0])>1e-9)s0--;while(e0+1<n&&d2(R[e0+1],R[e0])>1e-9)e0++;
  out.push({start:s0/fps,end:e0/fps,path:simplify(R,s0,e0,0.02).map(k=>[R[k][0],R[k][1],R[k][2]] as V3)});i=e0+1;}
 // S7: same path (S6 pause root -> stop root), retimed to COAST_S7_WALK so CharacterMotion's planWalk keeps walk_start + stop:
 // the authored K.walk (4.25 s for 5.095 m = 1.2 m/s = 1.71 x native 0.7 m/s) is outside its 0.75..1.3 x native cruise band.
 const a=at(R,ws),z=R[R.length-1]/* settled stop root (S7 stop, coast (0,0,5.15)) */;out.push({start:COAST_S7_WALK[0],end:COAST_S7_WALK[1],path:[[a[0],a[1],a[2]] as V3,[z[0],z[1],z[2]] as V3]});
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
 const drv=((f:HerFrame)=>{if(token.cancelled)return;const a=coastHerAdapter(world);if(!a){if(!errors.length){errors.push('no-adapter');console.error('[QF_COAST] arrival: her adapter missing');}return;}
  const t=f.t??0,node=a.node;
  if(first){first=false;try{const p=node?.worldPosition;if(node&&p&&Math.hypot(p.x-f.root[0],p.y-f.root[1],p.z-f.root[2])>0.05&&!busy){node.setWorldPosition(f.root[0],f.root[1],f.root[2]);
    const y=Math.atan2(f.heading[0],f.heading[2]);node.setRotationFromEuler?.(0,y*180/Math.PI,0);}}catch(e){errors.push(String(e));}}
  while(next<W.length&&t+1e-9>=W[next].start&&!busy){const w=W[next++];if(t>w.end)continue;busy=true;started++;
   a.perform({kind:'walk',path:w.path,duration:Math.max(0.35,w.end-t),stopAtEnd:true},token).then(()=>{busy=false;},e=>{busy=false;if(!token.cancelled){errors.push(String(e));console.error('[QF_COAST] arrival walk',String(e));}});}
 }) as CoastHerDriver;
 drv.dispose=()=>token.cancel();Object.defineProperty(drv,'started',{get:()=>started});(drv as any).errors=errors;return drv;}
/** puts the driver on the existing world object (no WorldFlowComponent edit): world.coastArrivalHer(f); returns dispose. */
export function installCoastArrivalHer(world:any):()=>void{const d=coastArrivalHer(world);world.coastArrivalHer=d;return ()=>{d.dispose();if(world.coastArrivalHer===d)delete world.coastArrivalHer;};}
export type CoastRunOptions=Readonly<{resolveReuse?:(name:string)=>any;cancelled?:()=>boolean;resolveMaterial?:(key:any)=>any;
 /** test seams */ camera?:CameraLike;viewport?:()=>Readonly<{width:number;height:number}>;nextFrame?:()=>Promise<number>}>;
export type CoastRunResult=Readonly<{ok:boolean;reason:string|null;frames:number;seconds:number;scene:any}>;
const qfErr=(why:string,e?:unknown)=>{const m='[QF_COAST] '+JSON.stringify({event:'run-coast-arrival',why,error:e===undefined?null:String(e)});console.error(m);return why;};
/** default resolveReuse: first node named `name` under the world's scene (GGbot's island-material/reuse resolvers replace it when passed). */
function defaultReuse(world:any):(name:string)=>any{const find=(n:any,name:string):any=>{if(!n)return null;if(n.name===name)return n;for(const c of n.children??[]){const r=find(c,name);if(r)return r;}return null;};
 return (name:string)=>find(world?.node?.scene??null,name);}
/** SINGLE ENTRY (contract: team/cinematic/outbox/20261030-coast-arrival-runtime/ENTRY_CONTRACT.md):
 *  globalThis.__qfCoast.runCoastArrival(world,{resolveReuse,resolveMaterial,cancelled}).
 *  1 loadCoastScene(world,{resolveReuse,resolveMaterial,cancelled}) (CoastSceneLoader, same bundle) FIRST:
 *    null + cancelled -> return {ok:false,reason:'cancelled'} quietly; null + not cancelled -> console.error [QF_COAST], NO arrival.
 *  2 installCoastArrivalHer(world); 3 playCoastArrival; finally uninstall.
 *  Scene handle: kept at the arrival's end (the board stands in it); disposed on cancel/teardown/region change (here, or by the caller
 *  via result.scene.dispose()). Never rejects; every failure = console.error [QF_COAST]. */
export async function runCoastArrival(world:any,opts:CoastRunOptions):Promise<CoastRunResult>{
 const out=(ok:boolean,reason:string|null,frames=0,seconds=0,scene:any=null):CoastRunResult=>Object.freeze({ok,reason,frames,seconds,scene});let scene:any=null;
 const drop=()=>{try{scene?.dispose?.();}catch(e){qfErr('scene-dispose',e);}scene=null;};
 try{if(!world)return out(false,qfErr('no-world'));opts=opts??{};
  const cancelled=()=>!!opts.cancelled?.()||world.node?.isValid===false;
  // GGbot defaults (the WNC statement passes neither): island prefab instance (WorldFlowComponent.ownedModel, WFC:378) is the reuse/material source
  const island:any=world.ownedModel??null,islandRoot=island?.getChildByName?.('scene_root')??island;
  const resolveReuse=opts.resolveReuse??(island?createCoastReuseResolver(island,COAST_REUSE_SOURCES,coastBundleNode):defaultReuse(world));
  const mats=opts.resolveMaterial?null:createCoastMaterialResolver({islandMaterial:(n:string)=>coastIslandMaterial(island,n)});
  const resolveMaterial=opts.resolveMaterial??mats!;
  const camera=opts.camera??world.worldCamera;if(!camera?.node)return out(false,qfErr('no-world-camera'));
  const g=globalThis as any;
  scene=await loadCoastScene(islandRoot?{sceneRoot:islandRoot}:world,{resolveReuse,resolveMaterial:resolveMaterial as any,cancelled});
  if(cancelled()){drop();return out(false,'cancelled');}
  if(!scene)return out(false,qfErr('scene-null'));
  const viewport=opts.viewport??(()=>({width:g.window?.innerWidth??0,height:g.window?.innerHeight??0}));
  const nextFrame=opts.nextFrame??(()=>new Promise<number>(res=>world.scheduleOnce((dt:number)=>res(Number.isFinite(dt)&&dt>0?dt:1/60),0)/* Cocos passes the frame dt to the callback */));
  const off=installCoastArrivalHer(world);let r:{ok:boolean;frames:number;seconds:number};
  try{r=await playCoastArrival({camera,viewport,nextFrame,her:(f:HerFrame)=>world.coastArrivalHer?.(f),cancelled});}finally{off();}
  if(!r.ok){drop();return out(false,'cancelled',r.frames,r.seconds);}
  // GGbot: keep the handle reachable after the arrival (the board stands in the coast): __qfCoast.current, idempotent dispose that also clears it.
  const sc=scene,g2=globalThis as any;let gone=false;const handle={...sc,get disposed(){return gone;},dispose(){if(gone)return;gone=true;try{sc.dispose();}catch(e){qfErr('scene-dispose',e);}if(g2.__qfCoast?.current===handle)g2.__qfCoast.current=null;}};
  try{g2.__qfCoast?.current?.dispose?.();}catch{}if(g2.__qfCoast)g2.__qfCoast.current=handle;
  return out(true,null,r.frames,r.seconds,handle);}
 catch(e){drop();return out(false,qfErr('error',e));}}
/** self-registry (merged, not replaced: CoastSceneLoader.ts registers loadCoastScene/unloadCoastScene on the same object). The main
 *  package never imports this bundle script; WNC reads globalThis.__qfCoast.runCoastArrival after assetManager.loadBundle('region_coast'). */
{const g=globalThis as any;const o=g.__qfCoast||(g.__qfCoast={});o.runCoastArrival=runCoastArrival;o.playCoastArrival=playCoastArrival;o.installCoastArrivalHer=installCoastArrivalHer;o.COAST_ARRIVAL_TOTAL_S=COAST_ARRIVAL_TOTAL_S;}
/* ---- GGbot resolveReuse / resolveMaterial for loadCoastScene (CoastSceneLoader.ts 1062a72b contract). Pure (no 'cc').
 * Island model in the scene during the arrival: WorldFlowComponent.ts:378 instantiates firstsliceModel = static_seat_preview
 * room_no_original_chair.glb prefab (RegionLoader.ts:27, WIB:459/523), mounted under the world node until the world is torn down.
 * Nothing is loaded and no bytes are copied: only nodes/materials of that prefab are used. */
type NodeLike={name:string;children:NodeLike[];isValid?:boolean};
function findName(n:NodeLike|null|undefined,name:string):NodeLike|null{if(!n)return null;if(n.name===name)return n;for(const c of n.children||[]){const r=findName(c,name);if(r)return r;}return null;}
/** Island-only reuse names (Grok Bot 2026-10-30 option b): the two palm rigs come from the mounted island prefab; every other reuse
 *  name (grass/flowers/rocks/bush, baked into region_coast by 场景设计部) is looked up in the coast bundle FIRST. */
export const COAST_REUSE_FROM_ISLAND:ReadonlySet<string>=new Set(['reuse_palm_tall','reuse_palm_lean']);
/** resolveReuse(name): 1) coastLookup(name) = node named `name` in the loaded region_coast model prefabs; 2) only for
 *  COAST_REUSE_FROM_ISLAND: island node src+'_rig' (skinned: rig root with skin + bones) or src. Else null + console.error. Cached. */
export function createCoastReuseResolver(islandRoot:any,sources:Readonly<Record<string,{src:string}>>,coastLookup?:(name:string)=>any):(name:string)=>any{const cache=new Map<string,any>();
 return (name:string)=>{if(cache.has(name))return cache.get(name);const s=sources[name];let n:any=null;
  if(!s)console.error('[QF_COAST] reuse: unknown name '+name);
  else{try{n=coastLookup?.(name)??null;}catch{n=null;}
   if(!n&&COAST_REUSE_FROM_ISLAND.has(name))n=findName(islandRoot,s.src+'_rig')||findName(islandRoot,s.src);
   if(!n||n.isValid===false){n=null;console.error('[QF_COAST] reuse: '+name+' not in region_coast models'+(COAST_REUSE_FROM_ISLAND.has(name)?' nor in the island prefab ('+s.src+')':' (awaiting 场景设计部 bake)'));}}
  cache.set(name,n);return n;};}
export type MaterialLike={name?:string;isValid?:boolean;destroy?():void};
/** Grok Bot 2026-10-30: translucent/unlit coast meshes use an EXISTING island material (room_no_original_chair.glb, static_seat_preview),
 *  shared by reference, no per-instance change. null = no suitable island material (reason in MATERIAL_MAP.md) -> console.error. */
export const COAST_SHARED_MATERIALS:Readonly<Record<string,string|null>>=Object.freeze({
 foam:'M_env_sea_foam',foam_inner:'M_env_sea_foam',tide_sheet:'M_env_glass_clear',sidepool:'M_env_glass_clear',
 beacon_line:'M_env_light_beam_v22',beacon_lamp:'M_env_lamp_glow_v22',
 contact:null,blob:null,footprints:null,net:null,crabtrap_mesh:null,seaglass:null,anemone:null});
/** agreed bundle path of 场景设计部's coast palette (region_coast bundle, Texture2D sub-asset) */
/** ONE switch (Grok Bot 2026-10-30): 'island-placeholder' = opaque coast meshes draw with the island's M_env_palette as is (console.warn once);
 *  'coast-palette' = same M_env_palette returned for palette keys, the LOADER copies it and swaps in textures/coast_palette (场景设计部). */
export const COAST_MATERIAL_MODE:'island-placeholder'|'coast-palette'='coast-palette';
/** resolveMaterial(key): opaque std / palette:true -> the island's M_env_palette (shared, never modified; the loader owns any copy);
 *  translucent/unlit -> COAST_SHARED_MATERIALS by reference; NONE/missing -> null + console.error. Never a silent null, never a new Material. */
export function createCoastMaterialResolver(d:Readonly<{islandMaterial(name:string):MaterialLike|null}>){let warned=false;
 const fn=((k:{mesh:string;kind:string;alpha:number;emit:boolean;palette?:boolean})=>{
  if(k.palette===true||(k.kind==='std'&&k.alpha>=1&&!k.emit)){const m=d.islandMaterial('M_env_palette');if(!m||m.isValid===false){console.error('[QF_COAST] material: island M_env_palette not found');return null;}
   if(COAST_MATERIAL_MODE==='island-placeholder'&&!warned){warned=true;console.warn('[QF_COAST] material: PLACEHOLDER island M_env_palette (island palette texture) on opaque coast meshes until coast_palette lands');}
   return m;}
  const name=COAST_SHARED_MATERIALS[k.mesh];
  if(name===undefined){console.error('[QF_COAST] material: '+k.mesh+' ('+k.kind+', alpha '+k.alpha+') not in COAST_SHARED_MATERIALS');return null;}
  if(name===null){console.error('[QF_COAST] material: no suitable island material for '+k.mesh+' (see MATERIAL_MAP.md)');return null;}
  const m=d.islandMaterial(name);if(!m||m.isValid===false){console.error('[QF_COAST] material: island '+name+' for '+k.mesh+' not found');return null;}
  return m;}) as ((k:any)=>MaterialLike|null)&{dispose():void};
 fn.dispose=()=>{};return fn;}
