import {Color, EffectAsset, Material, MeshRenderer, Node, Prefab, Vec3, assetManager, gfx, instantiate} from 'cc';
import type {Vec} from '../world-r1/WorldFlowCore';
/** Basket stand point. `stand_point` / `basket_floor` is the controller root while she is idle in the balloon. */
export function seatWorld(floor:Vec,yawRad:number):{controllerRoot:Vec;yawRad:number}{
 return {controllerRoot:[floor[0],floor[1],floor[2]],yawRad};
}
function find(node:Node,name:string):Node|null{if(node.name===name)return node;for(const child of node.children){const hit=find(child,name);if(hit)return hit;}return null;}
export function basketFloor(root:Node):Node{return find(root,'stand_point')??find(root,'basket_floor')??root;}
export function flameNode(root:Node):Node|null{return find(root,'burner_flame');}
const nightMat=new WeakMap<MeshRenderer,Material>();
const dayMat=new WeakMap<MeshRenderer,Material>();
const nightApplied=new WeakSet<MeshRenderer>();
const dayApplied=new WeakSet<MeshRenderer>();
/** Day envelope was standard-lit. After the seam the camera sits on the shadow side, so red/yellow fall to ~120. */
const DAY_LIFT=new Vec3(1.12,1.12,1.12);
function albedoOf(r:MeshRenderer):unknown{
 try{const shared=r.getSharedMaterial(0);return shared?.getProperty('mainTexture')??shared?.getProperty('albedoMap')??null;}catch{return null;}
}
/**
 * Day: unlit × albedo × linear 1.12 (builtin-unlit colorScale) so cruise matches the lit liftoff / v2.3 renders.
 * Night: unlit × albedo × RGB(118,110,116). Flame stays authored. glTF standard ignores mainColor.
 */
export function applyVehicleNight(root:Node,night:boolean):void{
 const walk=(n:Node)=>{
  if(n.name!=='burner_flame')for(const r of n.getComponents(MeshRenderer)){
   if(night){
    dayApplied.delete(r);
    if(nightApplied.has(r))continue;
    if(!EffectAsset.get('builtin-unlit'))continue;
    const tex=albedoOf(r);
    let m=nightMat.get(r);
    if(!m){
     m=new Material();
     m.initialize({effectName:'builtin-unlit',technique:0,defines:tex?{USE_TEXTURE:true}:{}});
     try{m.setProperty('mainColor',new Color(118,110,116,255));}catch{}
     if(tex){try{m.setProperty('mainTexture',tex as any);}catch{}}
     nightMat.set(r,m);
    }
    try{r.setMaterialInstance(0,m);m.overridePipelineStates({rasterizerState:{cullMode:gfx.CullMode.NONE}},0);nightApplied.add(r);}catch{/* */}
    continue;
   }
   nightApplied.delete(r);
   if(dayApplied.has(r))continue;
   if(!EffectAsset.get('builtin-unlit'))continue;
   const tex=albedoOf(r);
   let m=dayMat.get(r);
   if(!m){
    m=new Material();
    m.initialize({effectName:'builtin-unlit',technique:0,defines:tex?{USE_TEXTURE:true}:{}});
    try{m.setProperty('mainColor',new Color(255,255,255,255));}catch{}
    try{m.setProperty('colorScale',DAY_LIFT);}catch{}
    if(tex){try{m.setProperty('mainTexture',tex as any);}catch{}}
    dayMat.set(r,m);
   }
   try{r.setMaterialInstance(0,m);m.overridePipelineStates({rasterizerState:{cullMode:gfx.CullMode.NONE}},0);dayApplied.add(r);}catch{/* */}
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
