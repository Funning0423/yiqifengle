import {Color, EffectAsset, Material, MeshRenderer, Node, Prefab, Quat, Vec3, assetManager, instantiate} from 'cc';
import type {Vec} from '../world-r1/WorldFlowCore';
import {seatFromBench} from './TransportLeg';
function find(node:Node,name:string):Node|null{if(node.name===name)return node;for(const c of node.children){const h=find(c,name);if(h)return h;}return null;}
export function loadTransportPrefab(name:string):Promise<Prefab>{
 return new Promise((ok,fail)=>assetManager.loadBundle('transport_sail',(e,b)=>{
  if(e||!b){fail(e||Error('transport_sail'));return;}
  b.load(name+'/'+name,Prefab,(e2,p)=>{if(e2||!p)fail(e2||Error(name));else ok(p as Prefab);});
 }));
}
export async function mountSailboat(parent:Node):Promise<{root:Node;seat:Node|null;sail:Node|null}>{
 const prefab=await loadTransportPrefab('sailboat');
 const root=instantiate(prefab);root.name='sailboat';parent.addChild(root);
 return {root,seat:find(root,'seated_root_anchor')||find(root,'seat_bench'),sail:find(root,'sail_root')};
}
/** Sail: bench node. Balloon: floor point plus yaw. */
export function seatWorld(seat:Node):ReturnType<typeof seatFromBench>;
export function seatWorld(floor:Vec,yawRad:number):{controllerRoot:Vec;yawRad:number};
export function seatWorld(seatOrFloor:Node|Vec,yawRad?:number):ReturnType<typeof seatFromBench>|{controllerRoot:Vec;yawRad:number}{
 if(typeof yawRad==='number'){const floor=seatOrFloor as Vec;return {controllerRoot:[floor[0],floor[1],floor[2]],yawRad};}
 const seat=seatOrFloor as Node;
 const p=seat.worldPosition,q=seat.worldRotation,f=new Vec3(0,0,1);
 Vec3.transformQuat(f,f,q);
 const yaw=Math.atan2(f.x,f.z);
 return seatFromBench([p.x,p.y,p.z],yaw);
}
/** sit_hold does not write worldPosition, so the anchor carries her. Local zero keeps her on the bench, not inside the hull. */
export function attachRider(rider:Node,seat:Node):void{rider.setParent(seat,true);rider.setPosition(0,0,0);rider.setRotationFromEuler(0,0,0);}
export function detachRider(rider:Node,parent:Node):void{rider.setParent(parent,true);}
/** @deprecated Furling is `SailArt.sync` (boom + sail_furled). Left so older callers still compile. */
export function applySailScale(sail:Node|null,scale:number):void{if(sail)sail.setScale(1,Math.max(0.001,scale),1);}
export function placeBoat(root:Node,pos:Vec,yaw:number,roll:number):void{
 root.setWorldPosition(pos[0],pos[1],pos[2]);
 const q=new Quat();Quat.fromEuler(q,roll*180/Math.PI,yaw*180/Math.PI,0);root.setWorldRotation(q);
}
export function basketFloor(root:Node):Node{return find(root,'stand_point')??find(root,'basket_floor')??root;}
export function flameNode(root:Node):Node|null{return find(root,'burner_flame');}
const nightMat=new WeakMap<MeshRenderer,Material>();
const nightApplied=new WeakSet<MeshRenderer>();
/**
 * Night balloon: glTF standard ignores mainColor, so the envelope stayed day-bright.
 * Swap to unlit × albedo (no emissive) at a cool dim multiply. Flame stays authored. Day restores the shared glTF mat.
 */
export function applyVehicleNight(root:Node,night:boolean):void{
 const walk=(n:Node)=>{
  if(n.name!=='burner_flame')for(const r of n.getComponents(MeshRenderer)){
   if(!night){
    if(nightApplied.has(r)){const shared=r.getSharedMaterial(0);if(shared)try{r.setSharedMaterial(shared,0);}catch{/* */}nightApplied.delete(r);}
    continue;
   }
   if(nightApplied.has(r))continue;
   if(!EffectAsset.get('builtin-unlit'))continue;
   let tex:unknown=null;
   try{const shared=r.getSharedMaterial(0);tex=shared?.getProperty('mainTexture')??shared?.getProperty('albedoMap')??null;}catch{tex=null;}
   let m=nightMat.get(r);
   if(!m){
    m=new Material();
    m.initialize({effectName:'builtin-unlit',technique:0,defines:tex?{USE_TEXTURE:true}:{}});
    try{m.setProperty('mainColor',new Color(118,110,116,255));}catch{}
    if(tex){try{m.setProperty('mainTexture',tex as any);}catch{}}
    nightMat.set(r,m);
   }
   try{r.setMaterialInstance(0,m);nightApplied.add(r);}catch{/* */}
  }
  for(const child of n.children)walk(child);
 };
 walk(root);
}
/**
 * The glTF scene is a Prefab *sub-asset*. `bundle.load(fileName, Prefab)` misses it.
 * `loadDir` finds the imported scene prefab by name. A miss returns null; callers must not invent a mesh.
 */
export function loadBundlePrefab(name:string,bundleName='region_transit_balloon'):Promise<Prefab|null>{
 return new Promise(ok=>{
  assetManager.loadBundle(bundleName,(err,bundle)=>{
   if(err||!bundle){ok(null);return;}
   const pick=(list:Prefab[]|null)=>{
    const hit=(list||[]).find(x=>x&&(x.name===name||x.name===name+'.prefab'||x.name===name+'.glb'));
    ok(hit||null);
   };
   bundle.load(name,Prefab,(e,prefab)=>{
    if(!e&&prefab){ok(prefab);return;}
    bundle.loadDir('',Prefab,(e2,list)=>pick(e2?null:list||[]));
   });
  });
 });
}
export function mountVehicle(prefab:Prefab|null,parent:Node):Node{
 if(!prefab)throw Error('balloon-art-missing');
 const node=instantiate(prefab);node.name='transport_balloon';parent.addChild(node);return node;
}
