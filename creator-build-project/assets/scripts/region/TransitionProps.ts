import {MeshRenderer,Node,primitives,utils,type Material} from 'cc';
import type {Vec} from '../world-r1/WorldFlowCore';
/** transitions-continuous: procedural pier / gangplank boxes (no new assets: one box mesh each, the sailboat hull's existing
 *  material). Positions come from TransitionStaging (placeholders for 场景设计部). No @ccclass here. */
export function plankBetween(parent:Node,name:string,a:Vec,b:Vec,widthM:number,thickM:number,material:Material|null):Node|null{
 try{
  const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],h=Math.hypot(dx,dz),L=Math.hypot(dx,dy,dz);if(!(L>0.05))return null;
  const n=new Node(name);parent.addChild(n);
  n.setWorldPosition((a[0]+b[0])/2,(a[1]+b[1])/2-thickM/2,(a[2]+b[2])/2);
  n.setRotationFromEuler(-Math.atan2(dy,h)*180/Math.PI,Math.atan2(dx,dz)*180/Math.PI,0);
  const r=n.addComponent(MeshRenderer);r.mesh=utils.createMesh(primitives.box({width:widthM,height:thickM,length:L}));
  if(material)r.setSharedMaterial(material,0);
  return n;
 }catch(error){try{console.warn('[QF_TRANSITION] plank '+name+' skipped: '+String(error));}catch{}return null;}
}
export function firstMaterial(root:Node|null):Material|null{if(!root)return null;try{for(const r of root.getComponentsInChildren(MeshRenderer)){const m=r.getSharedMaterial(0);if(m)return m;}}catch{}return null;}
// ── b19 dock models: real model vs placeholder (cand7) ─────────────────────────────────────────────────────────────────
/** Real-model name a placeholder stands in for (island_dock_ramp stands in for part of island_dock). */
const PLACEHOLDER_REAL:Readonly<Record<string,string>>={island_dock:'island_dock',island_dock_ramp:'island_dock',sail_gangway:'sail_gangway',sail_gangway_meadow:'sail_gangway'};
const placeholders=new Map<string,Node[]>();
const realModels=new Map<string,Node>();
const realHooks=new Map<string,Array<()=>void>>();
const PH='__qfTransitionPlaceholder';
/** True for a plankBetween placeholder (or any node under one). The night silhouette (BalloonTransit dimCityNight) skips these. */
export function isTransitionPlaceholder(n:Node|null):boolean{for(let p:Node|null=n;p;p=p.parent)if((p as any)[PH])return true;return false;}
function alive(n:Node|null|undefined):n is Node{try{return !!n&&n.isValid;}catch{return false;}}
/** A registered real model (e.g. IslandProps' island_dock) that is still alive. */
export function realModelPresent(real:string):boolean{const n=realModels.get(real);if(alive(n))return true;realModels.delete(real);return false;}
/** Called by the owner of a real model the moment it is mounted (same call stack, so no frame draws both): destroys every
 *  placeholder standing in for it and runs the hooks (e.g. SailArt's transit_pier off). */
export function realModelArrived(real:string,node:Node):void{
 realModels.set(real,node);
 for(const [name,list] of placeholders){if(PLACEHOLDER_REAL[name]!==real)continue;for(const p of list)if(alive(p)){p.active=false;p.destroy();}placeholders.delete(name);}
 const hooks=realHooks.get(real)||[];realHooks.delete(real);for(const h of hooks){try{h();}catch{/* hook optional */}}
}
/** Runs fn now if the real model is present, else once when it arrives. */
export function onRealModel(real:string,fn:()=>void):void{if(realModelPresent(real)){fn();return;}const l=realHooks.get(real)||[];l.push(fn);realHooks.set(real,l);}
/** plankBetween as a fallback placeholder: null when the real model is already present; otherwise tagged + registered so a
 *  late real model removes it (realModelArrived) and region exit hides it (hidePlaceholders). */
export function placeholderPlank(parent:Node,name:string,a:Vec,b:Vec,widthM:number,thickM:number,material:Material|null):Node|null{
 const real=PLACEHOLDER_REAL[name]||name;if(realModelPresent(real))return null;
 const n=plankBetween(parent,name,a,b,widthM,thickM,material);if(!n)return null;
 (n as any)[PH]=true;const l=placeholders.get(name)||[];l.push(n);placeholders.set(name,l);
 return n;
}
/** Hide (destroy=false) or destroy every live placeholder under root (all when root is null). */
export function hidePlaceholders(root:Node|null,destroy=false,names?:readonly string[]):number{
 let k=0;
 for(const [name,list] of placeholders){if(names&&!names.includes(name))continue;
  for(const p of list){if(!alive(p))continue;let under=!root;for(let q:Node|null=p;q&&!under;q=q.parent)if(q===root)under=true;if(!under)continue;p.active=false;if(destroy)p.destroy();k++;}
  if(destroy)placeholders.set(name,list.filter(p=>alive(p)&&!(p as any).isDestroying));}
 return k;
}
/** Depth-first search by exact name (cc find() is a path from the scene root, not a deep search). */
export function findDeep(root:Node|null,name:string):Node|null{if(!root)return null;if(root.name===name)return root;for(const c of root.children){const r=findDeep(c,name);if(r)return r;}return null;}
