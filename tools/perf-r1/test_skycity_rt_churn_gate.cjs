'use strict';
/** perf-r1 extension of rt-depth-churn-gate to skycity (Mac perf b3394140, skycity.landing-board 16 s: cre≈399/s, DepthStencil<n>
 *  +2 per frame, 527 MB uploaded). Root: WarmButtonSkin re-keyed (new RenderTexture + off-screen window + readback) every frame while
 *  the invisible sign hit-area followed the flying board camera. Gate: 16 s × 60 fps of per-frame size changes then a stable size →
 *  ≤ 2 RenderTextures total (initial + one settled re-bake), final key = settled size, live RTs ≤ 1.
 *  Negative: the b3394140 WarmButtonSkin creates one RT per frame → FAIL. */
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm'),cp=require('child_process');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||'typescript');
const ROOT=path.join(__dirname,'../..'),REL='creator-build-project/assets/scripts/ui/WarmButtonSkin.ts';
const cur=fs.readFileSync(path.join(ROOT,REL),'utf8'),old=cp.execFileSync('git',['show','b3394140:'+REL],{cwd:ROOT,encoding:'utf8'});
function run(src){
  let frame=0,rtNew=0,rtLive=0;const ev={};
  const on=(k,f,t)=>{(ev[k]=ev[k]||[]).push({f,t,once:false});},once=(k,f,t)=>{(ev[k]=ev[k]||[]).push({f,t,once:true});},off=(k,f,t)=>{ev[k]=(ev[k]||[]).filter(x=>!(x.f===f&&x.t===t));};
  class Node{constructor(n){this.name=n;this.children=[];this.layer=0;this.comps=[];this.isValid=true;}addChild(c){this.children.push(c);c.parent=this;}setSiblingIndex(){}setPosition(){}
    addComponent(C){const c=new C();c.node=this;this.comps.push(c);return c;}getComponent(C){return this.comps.find(c=>c instanceof C)||null;}getComponentsInChildren(){return [];}destroy(){this.isValid=false;}}
  class UITransform{setContentSize(w,h){this.width=w;this.height=h;}}class Sprite{}Sprite.SizeMode={CUSTOM:0};
  class Camera{}Camera.ProjectionType={ORTHO:0};Camera.ClearFlag={SOLID_COLOR:0};class MeshRenderer{setSharedMaterial(){}}
  class RenderTexture{constructor(){rtNew++;rtLive++;}reset(o){this.width=o.width;this.height=o.height;}readPixels(x,y,w){const a=new Uint8Array(w*4).fill(255);return a;}destroy(){rtLive--;}}
  class SpriteFrame{reset(){}destroy(){}}class Material{constructor(){this.passes=[1];}initialize(){}destroy(){}}
  const scene=new Node('scene');const effect={addRef(){},decRef(){}};
  const director={getScene:()=>scene,getTotalFrames:()=>frame,on,once,off};
  const cc={Camera,Color:class{},director,Director:{EVENT_AFTER_DRAW:'ad'},EffectAsset:class{},isValid:o=>!!o&&o.isValid!==false,Material,Mesh:class{},MeshRenderer,Node,Rect:class{},RenderTexture,
    resources:{load:(p,T,cb)=>cb(null,effect)},Size:class{},Sprite,SpriteFrame,UITransform,utils:{createMesh:()=>({destroy(){}})}};
  const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
  const m={exports:{}};vm.runInNewContext(js,{module:m,exports:m.exports,console:{warn(){},log(){}},require:s=>s==='cc'?cc:s.includes('WarmButtonGeometry')?{warmButtonPairGeometry:()=>({})}:{}});
  const tick=()=>{frame++;for(const h of (ev.ad||[]).slice()){if(h.once)off('ad',h.f,h.t);h.f.call(h.t);}};
  const parent=new Node('sign');parent.isValid=true;const skin=new m.exports.WarmButtonSkin(parent);let readies=0;
  skin.configure(120,40,false,()=>readies++);for(let i=0;i<5;i++)tick();
  const r0=rtNew;
  for(let i=0;i<16*60;i++){skin.configure(120+(i%37)*0.5+i*0.01,40+(i%5)*0.25,false,()=>readies++);tick();}
  skin.configure(150,44,false,()=>readies++);for(let i=0;i<40;i++){skin.configure(150,44,false,()=>readies++);tick();}
  const k=skin.key;skin.destroy();
  return {initial:r0,total:rtNew,during:rtNew-r0,key:k,liveAfterDestroy:rtLive,readies};
}
const f=run(cur),o=run(old);
console.log('fixed',JSON.stringify(f));console.log('old  ',JSON.stringify({total:o.total,during:o.during}));
assert.equal(f.initial,1,'first configure bakes immediately (no behaviour change for static buttons)');
assert.ok(f.during<=1,'≤1 RT for 16 s of per-frame resizes + settle, got '+f.during);
assert.equal(f.key,'150:44:0','settled size is baked');assert.equal(f.liveAfterDestroy,0,'no RT leak');assert.ok(f.readies>=2,'ready fires for initial and settled bake');
assert.ok(o.during>=900,'negative: b3394140 must churn one RT per frame (got '+o.during+')');
console.log('PASS skycity-rt-churn-gate fixed RTs during 16 s='+f.during+' | old='+o.during+' (FAIL as expected)');
