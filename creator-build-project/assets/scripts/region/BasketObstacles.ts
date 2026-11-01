/** b19 dock models (cand7): state-toggled balloon-basket walk obstacles. Pure: no 'cc' (node tests load it).
 *  Data format requested from 场景设计部 (transition-anchors.json "basketObstacles", or RegionWalkableData):
 *    {id, region:'meadow'|'skycity', at:[x,z] (region model-local m), r (m), clearM (m),
 *     initial:boolean, on:string[] (events that activate it), off:string[] (events that clear it), baked:boolean}
 *  Events are TransitionChain marks 'leg:seg' (e.g. 'balloon:B3-flight') plus 'node:<key>' (level node reached, e.g. 'node:M4')
 *  and 'balloon:released' / 'lakeside:released' (the vehicle is gone).
 *  cand9: the rows below are GENERATED from 场景设计部's transition-anchors.json (7d5f4b90: r 1.03, clearM 0.4, baked:false —
 *  the walkable bake no longer contains the discs, so an inactive obstacle really re-opens its cells; meadow 43 / dock 36 / 5a 41).
 *  A baked (true) row (old data) would mean the disc is also in the bake and clearing cannot re-open it. Event names = the real chain marks
 *  (BalloonTransit B3-flight / B4-settle, RegionJourneyAdapter C1-basket-in / C3-flight, release hooks) and node:<key> from
 *  RegionNodePlay (departure start and arrival). */
export type BasketObstacle=Readonly<{id:string;region:'meadow'|'skycity';at:readonly [number,number];r:number;clearM:number;initial:boolean;on:readonly string[];off:readonly string[];baked:boolean}>;
export const BASKET_OBSTACLES:readonly BasketObstacle[]=Object.freeze([
// BEGIN GENERATED basketObstacles (tools/transition-spaces/gen-basket-obstacle-data.cjs from transition-anchors.json; do not edit)
 {"id":"meadow_basket","region":"meadow","at":[3.6,-23.4],"r":1.03,"clearM":0.4,"initial":false,"on":["node:M4"],"off":["balloon:B3-flight","balloon:released"],"baked":false},
 {"id":"skycity_landing_basket","region":"skycity","at":[5.4,43.8],"r":1.03,"clearM":0.4,"initial":false,"on":["balloon:B4-settle"],"off":["balloon:released"],"baked":false},
 {"id":"skycity_5a_basket","region":"skycity","at":[-14.8,-38.8],"r":1.03,"clearM":0.4,"initial":false,"on":["lakeside:C1-basket-in"],"off":["lakeside:C3-flight","lakeside:released"],"baked":false},
// END GENERATED basketObstacles
]);
const state=new Map<string,boolean>();
export function resetBasketObstacles():void{state.clear();}
export function basketObstacleActive(id:string):boolean{const o=BASKET_OBSTACLES.find(x=>x.id===id);if(!o)return false;return state.has(id)?state.get(id)!:o.initial;}
/** Feed one event; returns the ids whose state changed. */
export function basketObstacleEvent(ev:string):string[]{
 const changed:string[]=[];
 for(const o of BASKET_OBSTACLES){const was=basketObstacleActive(o.id);let now=was;if(o.on.includes(ev))now=true;if(o.off.includes(ev))now=false;if(now!==was){state.set(o.id,now);changed.push(o.id);}}
 return changed;
}
/** Overlay used by RegionWalkable: true when an ACTIVE obstacle of this region covers local (x,z). */
export function basketBlocked(region:string,x:number,z:number):boolean{
 for(const o of BASKET_OBSTACLES){if(o.region!==region||!basketObstacleActive(o.id))continue;if(Math.hypot(x-o.at[0],z-o.at[1])<=o.r+o.clearM)return true;}
 return false;
}
/** Installed on load (BalloonTransit / RegionJourneyAdapter import this module): TransitionChain.chainMark → events, RegionWalkable → overlay. */
export function installBasketObstacles():void{try{const g=globalThis as any;
 g.__QF_CHAIN_HOOK=(leg:string,seg:string,i:number)=>{if(leg==='sail'&&i===0)resetBasketObstacles();basketObstacleEvent(leg+':'+seg);};
 g.__QF_WALK_OVERLAY=(region:string,x:number,z:number)=>basketBlocked(region,x,z);
 g.__QF_BASKET_OBSTACLES={event:basketObstacleEvent,active:basketObstacleActive,reset:resetBasketObstacles};}catch{/* no global */}}
installBasketObstacles();
