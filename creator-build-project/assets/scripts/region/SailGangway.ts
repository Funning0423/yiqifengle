import {Node, Vec3, tween, type Tween} from 'cc';
import type {Vec} from '../world-r1/WorldFlowCore';
import {SAIL_GANGWAY_EXTRAS} from './SailGangwayExtras';
/** b19 dock models (cand7): drives the real sail_gangway (sailboat.glb: transport_sailboat > sail_gangway_hinge > sail_gangway)
 *  from the hinge node's glTF extras. Creator's glTF import does not keep node extras on the runtime Node, so the extras are
 *  extracted at build time into SailGangwayExtras.ts (tools/dock-models/gen-gangway-extras.cjs, checked against the glb by
 *  tools/dock-models/test_gangway_extras.cjs). A runtime extras/userData object on the node wins if one is ever present.
 *  The fallback constants are used only when neither exists, with one console.warn (warn level only). No @ccclass here. */
export type GangwayExtras={stowedDeg:number;meadowDeployDeg:number;islandHinge:Vec;islandYawDeg:number;islandDeployDeg:number;lengthM:number;widthM:number;meadowHinge:Vec};
export const GANGWAY_FALLBACK:Readonly<GangwayExtras>=Object.freeze({stowedDeg:95,meadowDeployDeg:-16,islandHinge:[-0.8,0.585,0.15] as Vec,islandYawDeg:180,islandDeployDeg:23,lengthM:0.625,widthM:0.5,meadowHinge:[0.8,0.585,0.15] as Vec});
const num=(v:unknown,d:number)=>typeof v==='number'&&Number.isFinite(v)?v:d;
const v3=(v:unknown,d:Vec):Vec=>Array.isArray(v)&&v.length===3&&v.every(x=>typeof x==='number'&&Number.isFinite(x))?[v[0],v[1],v[2]]:d;
/** Pure: merge an extras object over the defaults (missing / bad fields keep the default). */
export function gangwayExtrasFrom(src:any,defaults:GangwayExtras=GANGWAY_FALLBACK):GangwayExtras{
 const s=src||{};return {stowedDeg:num(s.stowedDeg,defaults.stowedDeg),meadowDeployDeg:num(s.meadowDeployDeg,defaults.meadowDeployDeg),islandHinge:v3(s.islandHinge,defaults.islandHinge),
  islandYawDeg:num(s.islandYawDeg,defaults.islandYawDeg),islandDeployDeg:num(s.islandDeployDeg,defaults.islandDeployDeg),lengthM:num(s.lengthM,defaults.lengthM),widthM:num(s.widthM,defaults.widthM),meadowHinge:v3(s.meadowHinge,defaults.meadowHinge)};
}
let warned=false;
export function resolveGangwayExtras(hinge:Node|null):{extras:GangwayExtras;source:'node'|'baked'|'fallback'}{
 const rt=(hinge as any)?.extras??(hinge as any)?.userData?.extras??null;
 if(rt&&typeof rt==='object')return {extras:gangwayExtrasFrom(rt),source:'node'};
 if(SAIL_GANGWAY_EXTRAS)return {extras:gangwayExtrasFrom(SAIL_GANGWAY_EXTRAS),source:'baked'};
 if(!warned){warned=true;try{console.warn('[QF_SAIL] sail_gangway_hinge extras missing; gangway uses fallback constants');}catch{}}
 return {extras:{...GANGWAY_FALLBACK},source:'fallback'};
}
export type GangwayState='stowed-meadow'|'stowed-island'|'island'|'meadow';
/** Pure: hinge local pose (boat-local position + Euler degrees, cc Y-Z-X order) for a state. */
export function gangwayPose(e:GangwayExtras,s:GangwayState):{pos:Vec;euler:Vec}{
 const island=s==='island'||s==='stowed-island';
 const z=s==='island'?e.islandDeployDeg:s==='meadow'?e.meadowDeployDeg:e.stowedDeg;
 return {pos:island?e.islandHinge:e.meadowHinge,euler:[0,island?e.islandYawDeg:0,z]};
}
/** cand8: pure keyframe plan for a swing. A side switch is never a snap: the board is raised on its current side,
 *  then swung across (hinge position and yaw interpolated together, eased) to the stowed pose on the other side, then lowered.
 *  Every consecutive pair of keys differs only by a continuous tween; no key repeats a pose change in zero time. */
export type GangwayKey={pos:Vec;euler:Vec;seconds:number};
export const GANGWAY_CROSS_SECONDS=1.2;
export function gangwaySequence(e:GangwayExtras,from:GangwayState,to:GangwayState,seconds=0.6):GangwayKey[]{
 const side=(x:GangwayState)=>x==='island'||x==='stowed-island';const sec=Math.max(0.05,seconds);const keys:GangwayKey[]=[];
 const push=(s:GangwayState,t:number)=>{const q=gangwayPose(e,s);keys.push({pos:q.pos,euler:q.euler,seconds:t});};
 if(side(from)!==side(to)){
  const upFrom:GangwayState=side(from)?'stowed-island':'stowed-meadow',upTo:GangwayState=side(to)?'stowed-island':'stowed-meadow';
  if(from!==upFrom)push(upFrom,sec);
  push(upTo,GANGWAY_CROSS_SECONDS);
  if(to!==upTo)push(to,sec);
 }else push(to,sec);
 return keys;
}
export function gangwaySequenceSeconds(e:GangwayExtras,from:GangwayState,to:GangwayState,seconds=0.6):number{return gangwaySequence(e,from,to,seconds).reduce((a,k)=>a+k.seconds,0);}
export type GangwayDriver={hinge:Node;extras:GangwayExtras;source:string;set(s:GangwayState):void;swing(s:GangwayState,seconds?:number):void;state():GangwayState};
/** null when the boat has no sail_gangway_hinge (old sailboat.glb): the caller keeps the placeholder planks. */
export function createGangwayDriver(boat:Node|null,findDeep:(r:Node|null,n:string)=>Node|null):GangwayDriver|null{
 const hinge=findDeep(boat,'sail_gangway_hinge');if(!hinge)return null;
 const r=resolveGangwayExtras(hinge),e=r.extras;
 // meadow hinge = the authored rest translation (stowed on the starboard gunwale)
 const p=hinge.position;e.meadowHinge=[p.x,p.y,p.z];
 let cur:GangwayState='stowed-meadow',tw:Tween<Node>|null=null;
 const apply=(s:GangwayState)=>{const q=gangwayPose(e,s);hinge.setPosition(q.pos[0],q.pos[1],q.pos[2]);hinge.setRotationFromEuler(q.euler[0],q.euler[1],q.euler[2]);};
 const stop=()=>{try{tw?.stop();}catch{}tw=null;};
 return {hinge,extras:e,source:r.source,state:()=>cur,
  set(s){stop();cur=s;if(hinge.isValid)apply(s);},
  swing(s,seconds=0.6){stop();if(!hinge.isValid)return;const keys=gangwaySequence(e,cur,s,seconds);cur=s;
   let t=tween(hinge);
   for(const k of keys)t=t.to(k.seconds,{position:new Vec3(k.pos[0],k.pos[1],k.pos[2]),eulerAngles:new Vec3(k.euler[0],k.euler[1],k.euler[2])},{easing:'sineInOut'});
   tw=t.start();}};
}
