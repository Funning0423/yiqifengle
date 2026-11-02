'use strict';
/** b20 skycity RT churn. Slim acceptance on b3394140: ~400 DepthStencil create/destroy per second for ~16 s
 *  after arriving at skycity. The 3.8.8 builtin forward pipeline registers MANAGED SceneDepth / Radiance /
 *  LdrColor / UiColor (and DepthStencil) per window. resourceUses is empty when _removeDeviceResource runs,
 *  so anything left MANAGED is destroyed and created again. b3394140 pins shadow maps and DepthStencil only
 *  when the vertex count changes, so a stable full-pipeline set — or a residency put back to MANAGED — churns.
 *  Gate: N=600 steady frames, hostile residency reset every frame, fixed creates === 0. Negative is that
 *  commit's RoomLightingRig and must FAIL. Do not loosen N. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),cp=require('node:child_process');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||'typescript');
const ROOT=path.join(__dirname,'../..');
const REL='creator-build-project/assets/scripts/render/RoomLightingRig.ts';
const cur=fs.readFileSync(path.join(ROOT,REL),'utf8');
const old=cp.execFileSync('git',['show','b3394140:'+REL],{cwd:ROOT,encoding:'utf8'});
const N=600,WARM=10;
const FULL=['SceneDepth_0','Radiance0_0','Radiance1_0','LdrColor0_0','LdrColor1_0','UiColor0_0','UiColor1_0','DepthStencil0','ShadowMap0','ShadowDepth0'];
function engine(){
  const verts=[];const dev={creates:0,live:new Set(),bytes:0,byName:{}};
  const rg={numVertices:()=>verts.length,vertexName:v=>verts[v].name,getTraits:v=>verts[v].traits,getDesc:v=>verts[v].desc,find:n=>{const i=verts.findIndex(v=>v.name===n);return i<0?4294967295:i;}};
  const add=(name,res,w,h,fmt)=>{const i=rg.find(name);if(i!==4294967295){verts[i].desc.width=w;verts[i].desc.height=h;return;}verts.push({name,traits:{residency:res},desc:{width:w,height:h,format:fmt}});};
  const dt=new Map();
  const mk=n=>{const d=verts[rg.find(n)].desc;const t={width:d.width,height:d.height,dead:false,destroy(){if(this.dead)return;this.dead=true;dev.live.delete(this);dev.bytes-=this.width*this.height*4;}};
    dev.creates++;dev.byName[n]=(dev.byName[n]||0)+1;dev.live.add(t);dev.bytes+=t.width*t.height*4;return {texture:t,release(){t.destroy();}};};
  const pipeline={resourceUses:[],resourceGraph:rg,_executor:{_context:{deviceTextures:dt}},
    frame(){
      add('Color0',3,390,750,35);add('Bloom0',0,256,256,35);
      for(let i=0;i<FULL.length;i++)add(FULL[i],0,1024,1024,i%2?55:35);
      for(let i=0;i<verts.length;i++)if(FULL.indexOf(verts[i].name)>=0)verts[i].traits.residency=0;
      this.resourceUses.length=0;this.execute();},
    execute(){for(const [n,r] of Array.from(dt)){const v=rg.find(n);if(v===4294967295||rg.getTraits(v).residency===0){r.release();dt.delete(n);}}
      for(let i=0;i<FULL.length;i++)if(!dt.has(FULL[i]))dt.set(FULL[i],mk(FULL[i]));}};
  return {pipeline,dev,dt,rg};
}
function load(src){
  const handlers={};const E=engine();
  const director={on(ev,f){(handlers[ev]=handlers[ev]||[]).push(f);},off(ev,f){handlers[ev]=(handlers[ev]||[]).filter(x=>x!==f);},root:{pipeline:E.pipeline,windows:[{renderWindowId:0}]}};
  const any=new Proxy(function(){},{get:(t,k)=>k==='prototype'?{}:any,apply:()=>any,construct:()=>({})});
  const cc=new Proxy({director,Director:{EVENT_BEFORE_DRAW:'bd',EVENT_AFTER_DRAW:'ad'}},{get:(t,k)=>k in t?t[k]:any});
  const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
  const m={exports:{}};vm.runInNewContext(js,{module:m,exports:m.exports,console,globalThis:{},require:s=>s==='cc'?cc:any});
  return {E,M:m.exports,tick:()=>{for(const f of (handlers.bd||[]).slice())f();E.pipeline.frame();}};
}
function snap(by){const o={};const keys=Object.keys(by);for(let i=0;i<keys.length;i++)o[keys[i]]=by[keys[i]];return o;}
function delta(a,b){const o={};const keys=Object.keys(b);for(let i=0;i<keys.length;i++){const d=b[keys[i]]-(a[keys[i]]||0);if(d)o[keys[i]]=d;}return o;}
function run(src){const {E,M,tick}=load(src);for(let i=0;i<WARM;i++)tick();const c0=E.dev.creates,l0=E.dev.live.size,b0=E.dev.bytes,n0=snap(E.dev.byName);
  for(let i=0;i<N;i++)tick();const steady=E.dev.creates-c0,by=delta(n0,snap(E.dev.byName));
  return {steady,by,liveFlat:E.dev.live.size===l0&&E.dev.bytes===b0,live:E.dev.live.size,M,E};}
const f=run(cur),o=run(old);
console.log('fixed',JSON.stringify({steady:f.steady,live:f.live,by:f.by}));
console.log('b3394140',JSON.stringify({steady:o.steady,by:o.by}));
assert.equal(f.steady,0,'fixed: no DepthStencil/SceneDepth/color-target creates over '+N+' frames');
assert.equal(f.liveFlat,true,'fixed live count flat');
assert.equal(f.by.DepthStencil0||0,0);assert.equal(f.by.SceneDepth_0||0,0);assert.equal(f.by.Radiance0_0||0,0);
assert.equal(o.steady,FULL.length*N,'b3394140 recreates the full-pipeline set every frame');
assert.equal(o.by.DepthStencil0,N,'b3394140 DepthStencil0 once per frame');
assert.equal(o.by.SceneDepth_0,N);
const T=[{residency:0},{residency:0},{residency:0}];
const rg={numVertices:()=>3,vertexName:v=>['ShadowMap3','Bloom0','SpotShadowDepth0'][v],getTraits:v=>T[v]};
assert.equal(f.M.pinShadowResidency(rg),2);assert.deepEqual(T.map(t=>t.residency),[2,0,2],'Bloom0 stays MANAGED');
assert.equal(f.M.windowIdOfPinned('SpotShadowMap3'),null,'spot shadows are per light');
assert.equal(f.M.windowIdOfPinned('SceneDepth_0'),0);assert.equal(f.M.windowIdOfPinned('BloomTex2_1'),2);
{const dt=new Map([['SceneDepth_9',{release(){}}],['SceneDepth_0',{release(){}}],['DepthStencil5',{release(){}}],['DepthStencil0',{release(){}}],['ShadowMap7',{release(){}}],['SpotShadowMap3',{release(){}}]]);
  assert.equal(f.M.releaseDeadWindows(dt,new Set([0])),3);assert.deepEqual([...dt.keys()].sort(),['DepthStencil0','SceneDepth_0','SpotShadowMap3']);}
const sea=fs.readFileSync(path.join(ROOT,'creator-build-project/assets/scripts/region/SkycityCloudsea.ts'),'utf8');
assert.match(sea,/camera\.far<1200\)camera\.far=1200/,'cloudsea far is written only when it is still short');
const evidence={model:'skycity-rt-residency',frames:N,warmFrames:WARM,names:FULL,
  fixedSteadyCreates:f.steady,fixedDepthStencilCreates:f.by.DepthStencil0||0,fixedSceneDepthCreates:f.by.SceneDepth_0||0,
  baselineCommit:'b3394140',baselineSteadyCreates:o.steady,baselineDepthStencilCreates:o.by.DepthStencil0,
  baselineCreatesPerSecondAt60:FULL.length*60,
  note:'Hostile test puts every full-pipeline residency back to MANAGED before execute, with resourceUses empty. Fixed code re-pins every MANAGED vertex each frame (Bloom0 stays MANAGED), so steady creates are 0. b3394140 pin-once of DepthStencil/shadow only fails. Mac 606f434e board-background zero_frac 0.988. Landing from2 cre/des median 114/s is the texture pool in skycity-landing-rt.json, not this pin gate.'};
const evDir=path.join(ROOT,'docs/r5/b20-hotfix/evidence');fs.mkdirSync(evDir,{recursive:true});
fs.writeFileSync(path.join(evDir,'skycity-rt.json'),JSON.stringify(evidence,null,2)+'\n');
console.log('PASS skycity-rt-residency N='+N+' fixed steady='+f.steady+' baseline steady='+o.steady+' (FAIL as expected)');
