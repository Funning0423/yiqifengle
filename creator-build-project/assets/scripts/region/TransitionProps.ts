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
