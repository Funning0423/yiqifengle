import {Node, Prefab, Quat, Vec3, assetManager, instantiate} from 'cc';
import type {Vec} from '../world-r1/WorldFlowCore';
import {seatFromBench} from './TransportLeg';
function find(node:Node,name:string):Node|null{if(node.name===name)return node;for(const c of node.children){const h=find(c,name);if(h)return h;}return null;}
export function loadTransportPrefab(name:string):Promise<Prefab>{
 return new Promise((ok,fail)=>assetManager.loadBundle('transport_sail',(e,b)=>{
  if(e||!b){fail(e||Error('transport_sail'));return;}
  b.load(name,Prefab,(e2,p)=>{if(e2||!p)fail(e2||Error(name));else ok(p as Prefab);});
 }));
}
export async function mountSailboat(parent:Node):Promise<{root:Node;seat:Node|null;sail:Node|null}>{
 const prefab=await loadTransportPrefab('sailboat');
 const root=instantiate(prefab);root.name='sailboat';parent.addChild(root);
 return {root,seat:find(root,'seated_root_anchor')||find(root,'seat_bench'),sail:find(root,'sail_root')};
}
export function seatWorld(seat:Node){
 const p=seat.worldPosition,q=seat.worldRotation,f=new Vec3(0,0,1);
 Vec3.transformQuat(f,f,q);
 const yaw=Math.atan2(f.x,f.z);
 return seatFromBench([p.x,p.y,p.z],yaw);
}
/** sit_hold does not write worldPosition, so the anchor carries her. Local zero keeps her on the bench, not inside the hull. */
export function attachRider(rider:Node,seat:Node):void{rider.setParent(seat,false);rider.setPosition(0,0,0);rider.setRotationFromEuler(0,0,0);}
export function detachRider(rider:Node,parent:Node):void{rider.setParent(parent,true);}
/** @deprecated Furling is `SailArt.sync` (boom + sail_furled). Left so older callers still compile. */
export function applySailScale(sail:Node|null,scale:number):void{if(sail)sail.setScale(1,Math.max(0.001,scale),1);}
export function placeBoat(root:Node,pos:Vec,yaw:number,roll:number):void{
 root.setWorldPosition(pos[0],pos[1],pos[2]);
 const q=new Quat();Quat.fromEuler(q,roll*180/Math.PI,yaw*180/Math.PI,0);root.setWorldRotation(q);
}
