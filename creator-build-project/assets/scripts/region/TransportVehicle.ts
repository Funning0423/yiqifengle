import {Color, Material, MeshRenderer, Node, Prefab, assetManager, instantiate} from 'cc';
import type {Vec} from '../world-r1/WorldFlowCore';
/** Basket stand point. `stand_point` / `basket_floor` is the controller root while she is idle in the balloon. */
export function seatWorld(floor:Vec,yawRad:number):{controllerRoot:Vec;yawRad:number}{
 return {controllerRoot:[floor[0],floor[1],floor[2]],yawRad};
}
function find(node:Node,name:string):Node|null{if(node.name===name)return node;for(const child of node.children){const hit=find(child,name);if(hit)return hit;}return null;}
export function basketFloor(root:Node):Node{return find(root,'stand_point')??find(root,'basket_floor')??root;}
export function flameNode(root:Node):Node|null{return find(root,'burner_flame');}
const nightBase=new WeakMap<Material,Color>();
/** Night multiplies vehicle materials by 0.6 once from the authored color. The burner flame stays full brightness. */
export function applyVehicleNight(root:Node,night:boolean):void{
 const scale=night?0.6:1;
 const walk=(n:Node)=>{
  if(n.name!=='burner_flame')for(const r of n.getComponents(MeshRenderer)){const m=r.getMaterialInstance(0);if(!m)continue;const live=m.getProperty('mainColor') as Color|null;if(!live)continue;if(!nightBase.has(m))nightBase.set(m,new Color(live.r,live.g,live.b,live.a));const src=nightBase.get(m)!;m.setProperty('mainColor',new Color(Math.round(src.r*scale),Math.round(src.g*scale),Math.round(src.b*scale),src.a));}
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
