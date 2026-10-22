import {EffectAsset,Material,MeshRenderer,Node,Vec4,isValid,resources,utils} from 'cc';
import {LANTERN_GLOW,lanternGlowFor,lanternGlowIntensity,lanternGlowQuad} from './LanternGlowCore';
import {onDayNightChange} from '../world-r1/DayNightContract';
/** R5 hand-lantern glow (场景特效bot): one camera-facing additive quad (resources/world/lantern-glow.effect) as a CHILD of the
 *  lantern's core node, so it swings with the lantern. No texture, no real-time light. Night on, day off.
 *  Usage: attachLanternGlow(lanternRoot, {heightM}) once the prop is mounted on socket.lantern; dispose() on unmount. */
export const LANTERN_GLOW_EFFECT='world/lantern-glow';
export const LANTERN_CORE_NODE='lantern.core';
function findNode(n:Node,name:string):Node|null{if(n.name===name)return n;for(let i=0;i<n.children.length;i++){const h=findNode(n.children[i],name);if(h)return h;}return null;}
function isNight():boolean{try{const s=(globalThis as any).__worldDayNight;return !!s&&!!s.snapshot&&s.snapshot().mode==='night';}catch(e){return false;}}
export type LanternGlowHandle={node:Node|null;setHeight(h:number):void;dispose():void};
export function attachLanternGlow(root:Node,opts?:{heightM?:number;coreOffset?:[number,number,number]}):LanternGlowHandle{
 let dead=false,node:Node|null=null,mat:Material|null=null,off=()=>{};let h=opts&&opts.heightM?opts.heightM:LANTERN_GLOW.refHeightM;
 const handle:LanternGlowHandle={node:null,setHeight:(v:number)=>{h=v;apply();},dispose:()=>{dead=true;off();if(node&&isValid(node,true))node.destroy();node=null;handle.node=null;if(mat){mat.destroy();mat=null;}}};
 const apply=()=>{if(!node||!mat)return;const g=lanternGlowFor(h,opts&&opts.coreOffset);
  // the glow sits ON the core (core node origin); only its size follows the lantern height
  mat.setProperty('tint',new Vec4(LANTERN_GLOW.color[0],LANTERN_GLOW.color[1],LANTERN_GLOW.color[2],lanternGlowIntensity(isNight())));
  mat.setProperty('glowParams',new Vec4(g.radius,LANTERN_GLOW.halo,LANTERN_GLOW.breathe,LANTERN_GLOW.flicker));
  mat.setProperty('faceGuard',new Vec4(LANTERN_GLOW.faceMin,LANTERN_GLOW.faceDistM,0,0));node.active=isNight()||LANTERN_GLOW.day>0;};
 const core=findNode(root,LANTERN_CORE_NODE);if(!core){console.warn('[SCENE_FX] lantern glow: no '+LANTERN_CORE_NODE+' under '+root.name);return handle;}
 resources.load(LANTERN_GLOW_EFFECT,EffectAsset,(err:Error|null,fx:EffectAsset|null)=>{
  if(dead||!isValid(core,true))return;if(err||!fx){console.warn('[SCENE_FX] lantern glow effect missing: '+String(err));return;}
  mat=new Material();mat.initialize({effectAsset:fx,technique:0});
  const q=lanternGlowQuad();node=new Node('lantern.glow');node.layer=core.layer;core.addChild(node);handle.node=node;
  const r=node.addComponent(MeshRenderer);r.mesh=utils.MeshUtils.createMesh({positions:q.positions,uvs:q.uvs,indices:q.indices,minPos:{x:-.3,y:-.3,z:-.3} as any,maxPos:{x:.3,y:.3,z:.3} as any});r.setSharedMaterial(mat,0);r.shadowCastingMode=0;
  apply();off=onDayNightChange(()=>{if(!dead)apply();});});
 return handle;
}
