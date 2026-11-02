'use strict';
/** p0-shadow-churn gate (fin e8cd7c1e finV: 1024² ShadowMap/ShadowDepth destroyed + re-created every frame, 112–116 creates/s on the Mac).
 *  Emulates the Cocos 3.8.8 web custom-pipeline executor exactly as traced headless (tools/shadow-churn/README.md):
 *   - builtin windowResize registers ShadowMap<win>/ShadowDepth<win> as MANAGED (residency 0) with desc = shadows.size;
 *   - execute(): _removeDeviceResource releases every MANAGED device texture not in pipeline.resourceUses — which is EMPTY
 *     at that point every frame (headless trace: uses=[] before=[Color0,DepthStencil0,ShadowMap0,ShadowDepth0] after=[Color0,DepthStencil0]);
 *     then the shadow pass creates any missing device texture from its desc (an existing texture is NOT re-checked for size).
 *  Gate: steady state ≤ 1 shadow-texture create per N=600 frames (10 s at 60 fps). Live count/bytes flat after warm-up.
 *  A shadow-size change (RoomLightingRig 512 → 1024) must re-create the pair exactly once at the new size.
 *  Negative: the same harness without the RoomLightingRig residency hook (old code) must FAIL the gate. */
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||'typescript');
const F=path.join(__dirname,'../../creator-build-project/assets/scripts/render/RoomLightingRig.ts'),src=fs.readFileSync(F,'utf8');
const N=600,WARM=10;
function engine(){
  const verts=[];const dev={creates:0,destroys:0,live:new Set(),bytes:0,byW:{}};
  const rg={x:verts,numVertices:()=>verts.length,vertexName:v=>verts[v].name,getTraits:v=>verts[v].traits,getDesc:v=>verts[v].desc,
    find:n=>{const i=verts.findIndex(v=>v.name===n);return i<0?4294967295:i;}};
  const add=(name,res,w,h,fmt)=>{const i=rg.find(name);if(i!==4294967295){verts[i].desc.width=w;verts[i].desc.height=h;return;}verts.push({name,traits:{residency:res},desc:{width:w,height:h,format:fmt}});};
  const deviceTextures=new Map();
  const mk=(name)=>{const d=verts[rg.find(name)].desc;const t={width:d.width,height:d.height,format:d.format,dead:false,destroy(){if(this.dead)return;this.dead=true;dev.destroys++;dev.live.delete(this);dev.bytes-=this.width*this.height*4;}};
    dev.creates++;dev.byW[d.width]=(dev.byW[d.width]||0)+1;dev.live.add(t);dev.bytes+=t.width*t.height*4;return {texture:t,release(){t.destroy();}};};
  const pipeline={resourceUses:[],resourceGraph:rg,shadow:{size:1024},_executor:{_context:{deviceTextures}},
    frame(){ // windowResize (resource registration; adding an existing name only updates the desc), compile, execute
      add('Color0',3,390,750,35);add('DepthStencil0',3,390,750,55);
      add('ShadowMap0',0,this.shadow.size,this.shadow.size,35);add('ShadowDepth0',0,this.shadow.size,this.shadow.size,55);
      this.execute();},
    execute(){ // engine: _removeDeviceResource with the (empty) resourceUses, then the shadow pass creates missing textures
      const uses=this.resourceUses;for(const [n,r] of Array.from(deviceTextures)){const v=rg.find(n);if(!uses.includes(n)&&rg.getTraits(v).residency===0){r.release();deviceTextures.delete(n);}}uses.length=0;
      for(const n of ['ShadowMap0','ShadowDepth0'])if(!deviceTextures.has(n))deviceTextures.set(n,mk(n));}};
  return {pipeline,dev};
}
function load(withHook){
  const handlers={};const E=engine();
  const director={on(ev,f){(handlers[ev]=handlers[ev]||[]).push(f);},off(ev,f){handlers[ev]=(handlers[ev]||[]).filter(x=>x!==f);},root:{pipeline:E.pipeline}};
  const any=new Proxy(function(){},{get:(t,k)=>k==='prototype'?{}:any,apply:()=>any,construct:()=>({})});
  const cc=new Proxy({director,Director:{EVENT_BEFORE_DRAW:'bd',EVENT_AFTER_DRAW:'ad'}},{get:(t,k)=>k in t?t[k]:any});
  let M={};
  if(withHook){const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
    const m={exports:{}};vm.runInNewContext(js,{module:m,exports:m.exports,console,globalThis:{},require:s=>s==='cc'?cc:any});M=m.exports;}
  const tick=()=>{for(const f of (handlers.bd||[]).slice())f();E.pipeline.frame();};
  return {E,M,tick};
}
/** The gate. Returns {pass, creates, liveN, liveMB} for N steady frames after WARM warm-up frames. */
function run(withHook){
  const {E,M,tick}=load(withHook);for(let i=0;i<WARM;i++)tick();
  const c0=E.dev.creates,l0=E.dev.live.size,b0=E.dev.bytes;
  for(let i=0;i<N;i++)tick();
  const creates=E.dev.creates-c0;const r={creates,perN:N,liveBefore:l0,liveAfter:E.dev.live.size,mbBefore:b0/1048576,mbAfter:E.dev.bytes/1048576,pass:creates<=1&&E.dev.live.size===l0&&E.dev.bytes===b0};
  return {r,E,M,tick};
}
const fixed=run(true),old=run(false);
console.log('fixed',JSON.stringify(fixed.r));console.log('old  ',JSON.stringify(old.r));
assert.ok(fixed.M.installShadowResidency&&fixed.M.pinShadowResidency,'RoomLightingRig exports the residency hook');
assert.equal(fixed.r.pass,true,'gate: ≤1 shadow create per '+N+' steady frames, live flat');
assert.equal(fixed.r.creates,0,'no steady creates at all without a size change');
assert.equal(fixed.r.liveAfter,2);assert.equal(fixed.r.mbAfter,8);
// negative: old code churns one pair per frame → gate FAILS
assert.equal(old.r.pass,false,'negative: old behaviour must fail the gate');
assert.equal(old.r.creates,2*N,'old: one colour+depth pair per frame');
// size change re-creates exactly once at the new size, then steady again
{const {E,tick}=fixed;E.pipeline.shadow.size=2048;const c0=E.dev.creates;for(let i=0;i<N;i++)tick();
 assert.equal(E.dev.creates-c0,2,'resize: one pair re-created');assert.equal(E.dev.byW[2048],2,'at 2048');
 for(const t of E.dev.live)assert.equal(t.width,2048,'live textures at the new size');assert.equal(E.dev.live.size,2);}
// Bloom0 stays MANAGED. Every other MANAGED vertex is pinned, including names outside the old shadow list.
{const rg={x:[0,1,2],numVertices:()=>3,vertexName:v=>['ShadowMap3','Bloom0','SpotShadowDepth0'][v],getTraits:v=>T[v]};const T=[{residency:0},{residency:0},{residency:0}];
 assert.equal(fixed.M.pinShadowResidency(rg),2);assert.deepEqual(T.map(t=>t.residency),[2,0,2]);}
console.log('PASS shadow-churn-gate N='+N+' fixed creates='+fixed.r.creates+' live '+fixed.r.liveBefore+'->'+fixed.r.liveAfter+' MB '+fixed.r.mbBefore+'->'+fixed.r.mbAfter+' | old creates='+old.r.creates+' (FAIL as expected)');
