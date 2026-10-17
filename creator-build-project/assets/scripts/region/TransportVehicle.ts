import {Color, Material, MeshRenderer, Node, Prefab, assetManager, instantiate} from 'cc';
import type {Vec} from '../world-r1/WorldFlowCore';
/** Basket stand point. `basket_floor` is the controller root while she is idle in the balloon. */
export function seatWorld(floor:Vec,yawRad:number):{controllerRoot:Vec;yawRad:number}{
 return {controllerRoot:[floor[0],floor[1],floor[2]],yawRad};
}
function find(node:Node,name:string):Node|null{if(node.name===name)return node;for(const child of node.children){const hit=find(child,name);if(hit)return hit;}return null;}
export function basketFloor(root:Node):Node{return find(root,'basket_floor')??root;}
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
/** Loads one prefab from the `transport_balloon` bundle. A missing asset returns null. */
export function loadBundlePrefab(name:string):Promise<Prefab|null>{
 return new Promise(ok=>{
  assetManager.loadBundle('transport_balloon',(err,bundle)=>{
   if(err||!bundle){ok(null);return;}
   bundle.load(name,Prefab,(e,prefab)=>{ok(e||!prefab?null:prefab);});
  });
 });
}
export function mountVehicle(prefab:Prefab|null,parent:Node):Node{
 if(!prefab){const empty=new Node('transport_balloon');parent.addChild(empty);const floor=new Node('basket_floor');empty.addChild(floor);const flame=new Node('burner_flame');empty.addChild(flame);return empty;}
 const node=instantiate(prefab);node.name='transport_balloon';parent.addChild(node);return node;
}
void Material;
