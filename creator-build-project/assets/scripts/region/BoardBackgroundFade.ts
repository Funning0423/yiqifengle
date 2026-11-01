import {Camera,MeshRenderer,Node,Vec4,gfx,isValid} from 'cc';
/** cand8b (Grok Bot ③): a real 0.3 s dissolve of a board's own-camera 3D background into the live world behind it, without a
 *  RenderTexture. On the first alpha < 1 frame: the board camera stops clearing colour (DEPTH_ONLY, so the world camera's picture
 *  stays underneath), and every MeshRenderer under the rig gets a per-renderer material instance whose pass 0 blends
 *  SRC_ALPHA / ONE_MINUS_SRC_ALPHA; each frame writes mainColor.a = baseAlpha × alpha as a raw uniform (no sRGB re-conversion).
 *  Shared / imported materials are never written. The rig is destroyed right after alpha 0, so instances go with it.
 *  Cost: one material instance per renderer for ≤ 0.3 s (batching off for that window), no texture memory. No @ccclass here. */
export type FadeTarget={handle:number;pass:any;base:Vec4};
export function fadeUniformAlpha(base:number,alpha:number):number{const a=Math.min(1,Math.max(0,Number.isFinite(alpha)?alpha:0));return Math.max(0,Math.min(1,base))*a;}
export function createSceneFade(rig:()=>Node|null,camera:()=>Camera|null,tag:string):(alpha:number)=>void{
 let armed=false,targets:FadeTarget[]=[],last=1,warned=false;
 const warn=(e:unknown)=>{if(warned)return;warned=true;try{console.warn('[QF_BOARD_BG_FADE] '+tag+' partial fade: '+String(e));}catch{}};
 const arm=()=>{armed=true;const r=rig(),c=camera();
  if(c&&isValid(c,true))c.clearFlags=Camera.ClearFlag.DEPTH_ONLY;
  if(!r||!isValid(r,true))return;
  for(const mr of r.getComponentsInChildren(MeshRenderer)){if(!mr.enabled||!mr.node.activeInHierarchy)continue;const n=mr.sharedMaterials.length;
   for(let i=0;i<n;i++){try{const m=mr.getMaterialInstance(i);if(!m)continue;const pass:any=m.passes[0];const h=pass.getHandle('mainColor');if(!h)continue;
    const cur=pass.blendState.targets[0];
    m.overridePipelineStates({blendState:{targets:[{blend:true,blendEq:gfx.BlendOp.ADD,blendSrc:gfx.BlendFactor.SRC_ALPHA,blendDst:gfx.BlendFactor.ONE_MINUS_SRC_ALPHA,
     blendAlphaEq:gfx.BlendOp.ADD,blendSrcAlpha:gfx.BlendFactor.ZERO,blendDstAlpha:gfx.BlendFactor.ONE,blendColorMask:cur?.blendColorMask??gfx.ColorMask.ALL}]}},0);
    const base=new Vec4();pass.getUniform(h,base);targets.push({handle:h,pass:m.passes[0],base});}catch(e){warn(e);}}}};
 return (alpha:number)=>{const a=Math.min(1,Math.max(0,Number.isFinite(alpha)?alpha:0));if(a>last)return/* monotone: a fade never comes back */;last=a;
  if(a>=1)return;if(!armed)arm();
  for(const t of targets){try{t.pass.setUniform(t.handle,new Vec4(t.base.x,t.base.y,t.base.z,fadeUniformAlpha(t.base.w,a)));}catch(e){warn(e);}}};
}
