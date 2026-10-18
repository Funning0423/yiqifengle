import {Color, EffectAsset, Material, MeshRenderer, Node, Prefab, assetManager, instantiate} from 'cc';
import type {Vec} from '../world-r1/WorldFlowCore';
/** Basket stand point. `stand_point` / `basket_floor` is the controller root while she is idle in the balloon. */
export function seatWorld(floor:Vec,yawRad:number):{controllerRoot:Vec;yawRad:number}{
 return {controllerRoot:[floor[0],floor[1],floor[2]],yawRad};
}
function find(node:Node,name:string):Node|null{if(node.name===name)return node;for(const child of node.children){const hit=find(child,name);if(hit)return hit;}return null;}
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
