'use strict';
/** r3 gate (fin r6 3689d151: DepthStencil893/896 1024² destroyed + re-created every frame while the result-chest RenderTexture camera
 *  renders; cre=191/s at s=1793491191, 332/s at s=1793491213). Model = the 3.8.8 web executor rule traced for the shadow maps
 *  (test_shadow_churn_gate.cjs): every MANAGED device texture not in resourceUses (empty) is released in execute(), then each pass
 *  creates what it misses. An off-screen window <id> has Color<id> (the RenderTexture, external) + DepthStencil<id> (MANAGED).
 *  Every new RenderTexture gets a NEW window id (chest 893 → 896 → …).
 *  Gate: (1) steady ≤ 1 create per N=600 frames with a chest RT on screen; (2) 5 chest open/close cycles (new id each) leave live
 *  count/bytes flat (dead windows' pinned textures released — no leak); (3) main window + shadow pair unchanged.
 *  Negative: the 3689d151 RoomLightingRig (shadow-only pinning) churns DepthStencil<id> every frame → FAIL. */
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm'),cp=require('child_process');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||'typescript');
const REL='creator-build-project/assets/scripts/render/RoomLightingRig.ts';
const cur=fs.readFileSync(path.join(__dirname,'../..',REL),'utf8');
const old=cp.execFileSync('git',['show','3689d151:'+REL],{cwd:path.join(__dirname,'../..'),encoding:'utf8'});
const N=600,WARM=10;
function engine(){
  const verts=[];const dev={creates:0,live:new Set(),bytes:0,byName:{}};
  const rg={numVertices:()=>verts.length,vertexName:v=>verts[v].name,getTraits:v=>verts[v].traits,getDesc:v=>verts[v].desc,find:n=>{const i=verts.findIndex(v=>v.name===n);return i<0?4294967295:i;}};
  const add=(name,res,w,h,fmt)=>{const i=rg.find(name);if(i!==4294967295){verts[i].desc.width=w;verts[i].desc.height=h;return;}verts.push({name,traits:{residency:res},desc:{width:w,height:h,format:fmt}});};
  const dt=new Map();
  const mk=n=>{const d=verts[rg.find(n)].desc;const t={width:d.width,height:d.height,dead:false,destroy(){if(this.dead)return;this.dead=true;dev.live.delete(this);dev.bytes-=this.width*this.height*4;}};
    dev.creates++;dev.byName[n]=(dev.byName[n]||0)+1;dev.live.add(t);dev.bytes+=t.width*t.height*4;return {texture:t,release(){t.destroy();}};};
  const windows=[{renderWindowId:0}];
  const pipeline={resourceUses:[],resourceGraph:rg,_executor:{_context:{deviceTextures:dt}},
    frame(){add('Color0',3,390,750,35);add('DepthStencil0',3,390,750,55);add('ShadowMap0',0,1024,1024,35);add('ShadowDepth0',0,1024,1024,55);
      for(const w of windows)if(w.renderWindowId){add('Color'+w.renderWindowId,3,1024,1024,35);add('DepthStencil'+w.renderWindowId,0,1024,1024,55);}this.execute();},
    execute(){for(const [n,r] of Array.from(dt)){const v=rg.find(n);if(rg.getTraits(v).residency===0){r.release();dt.delete(n);}}
      const need=['ShadowMap0','ShadowDepth0'];for(const w of windows)if(w.renderWindowId)need.push('DepthStencil'+w.renderWindowId);
      for(const n of need)if(!dt.has(n))dt.set(n,mk(n));}};
  return {pipeline,dev,windows,dt};
}
function load(src){
  const handlers={};const E=engine();
  const director={on(ev,f){(handlers[ev]=handlers[ev]||[]).push(f);},off(ev,f){handlers[ev]=(handlers[ev]||[]).filter(x=>x!==f);},root:{pipeline:E.pipeline,windows:E.windows}};
  const any=new Proxy(function(){},{get:(t,k)=>k==='prototype'?{}:any,apply:()=>any,construct:()=>({})});
  const cc=new Proxy({director,Director:{EVENT_BEFORE_DRAW:'bd',EVENT_AFTER_DRAW:'ad'}},{get:(t,k)=>k in t?t[k]:any});
  const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
  const m={exports:{}};vm.runInNewContext(js,{module:m,exports:m.exports,console,globalThis:{},require:s=>s==='cc'?cc:any});
  return {E,M:m.exports,tick:()=>{for(const f of (handlers.bd||[]).slice())f();E.pipeline.frame();}};
}
function run(src){const {E,M,tick}=load(src);let id=893;E.windows.push({renderWindowId:id});
  for(let i=0;i<WARM;i++)tick();const c0=E.dev.creates,l0=E.dev.live.size,b0=E.dev.bytes;for(let i=0;i<N;i++)tick();
  const steady=E.dev.creates-c0;const liveSteady=E.dev.live.size===l0&&E.dev.bytes===b0;
  // 5 chest cycles: close (window gone), reopen with a NEW id
  for(let k=0;k<5;k++){E.windows.pop();for(let i=0;i<30;i++)tick();id+=3;E.windows.push({renderWindowId:id});for(let i=0;i<30;i++)tick();}
  return {steady,liveSteady,l0,b0,liveAfter:E.dev.live.size,bytesAfter:E.dev.bytes,pass:steady<=1&&liveSteady&&E.dev.live.size===l0&&E.dev.bytes===b0,M,E};}
const f=run(cur),o=run(old);
console.log('fixed',JSON.stringify({steady:f.steady,live:[f.l0,f.liveAfter],MB:[f.b0/1048576,f.bytesAfter/1048576],stats:f.M.shadowResidencyStats()}));
console.log('old  ',JSON.stringify({steady:o.steady,live:[o.l0,o.liveAfter]}));
assert.equal(f.pass,true,'gate: ≤1 create / '+N+' frames with a chest RT, live flat across 5 RT cycles');
assert.equal(f.steady,0);assert.equal(f.liveAfter,3,'shadow pair + current chest depth only');assert.ok(f.M.shadowResidencyStats().deadReleased>=5,'dead chest windows released');
assert.equal(f.E.dt.has('ShadowMap0')&&f.E.dt.has('ShadowDepth0'),true,'shadow pair kept');
// negative: 3689d151 churns the chest depth every frame
assert.equal(o.pass,false,'negative: 3689d151 must FAIL');assert.equal(o.steady,N,'old: one DepthStencil create per frame');
// pure helpers
{const dt=new Map([['DepthStencil5',{release(){this.r=1;}}],['DepthStencil0',{release(){}}],['SpotShadowMap3',{release(){}}],['ShadowMap7',{release(){}}]]);
 assert.equal(f.M.releaseDeadWindows(dt,new Set([0])),2);assert.deepEqual([...dt.keys()],['DepthStencil0','SpotShadowMap3']);
 assert.equal(f.M.releaseDeadWindows(dt,new Set()),0,'empty id set never releases');assert.equal(f.M.aliveWindowIds({windows:[{renderWindowId:0},{}]}),null,'no ids exposed → null');}
console.log('PASS rt-depth-churn-gate N='+N+' fixed steady creates='+f.steady+' live '+f.l0+'->'+f.liveAfter+' | old steady creates='+o.steady+' (FAIL as expected)');
