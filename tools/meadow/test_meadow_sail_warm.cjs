'use strict';
/** b20 warm-up C. Probe B: 69 createShader of env_meadow on the sail frame, 1601 ms.
 *  The scheduler kicks one variant and cache-hit-compiles one variant when both fit in 4 ms.
 *  The sail frame itself kicks and compiles nothing. Unfinished renderers stay disabled.
 *  Offline proof is this cost model. Mac measures wall-clock frame time. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||'typescript');
const ROOT=path.join(__dirname,'../..');
const SRC=path.join(ROOT,'creator-build-project/assets/scripts/region/MeadowSailWarm.ts');
const src=fs.readFileSync(SRC,'utf8');
const evDir=path.join(ROOT,'docs/r5/b20-hotfix/evidence');
function load(clock){
  const listeners=[];
  const director={on(ev,f){if(!clock)return;listeners.push(f);},off(ev,f){if(!clock)return;for(let i=listeners.length-1;i>=0;i--)if(listeners[i]===f)listeners.splice(i,1);},root:{device:{gl:null}}};
  if(!clock){director.on=undefined;director.off=undefined;}
  class Material{constructor(){this.passes=[{defines:{USE_VERTEX_COLOR:true}}];this.destroyed=false;}initialize(o){this.effectAsset=o.effectAsset;this.effectName=o.effectAsset&&o.effectAsset.name;}destroy(){this.destroyed=true;}}
  class MeshRenderer{constructor(){this.enabled=true;this.sharedMaterials=[];this.mesh={struct:{vertexBundles:[{attributes:[{name:'a_position'}]}]}};this.node=null;this.compiles=0;}
    setSharedMaterial(m,i){this.sharedMaterials[i]=m;}
    getMaterialInstance(i){const m=this.sharedMaterials[i]||this.sharedMaterials[0];return {passes:m&&m.passes||[],recompileShaders:()=>{this.compiles++;}};}
  }
  class Node{constructor(name){this.name=name;this.children=[];this.parent=null;this.comps=[];this.isValid=true;}
    addChild(c){c.parent=this;this.children.push(c);}
    addComponent(C){const c=new C();c.node=this;this.comps.push(c);return c;}
    getComponentsInChildren(C){const out=[];const walk=n=>{for(let i=0;i<n.comps.length;i++)if(n.comps[i] instanceof C)out.push(n.comps[i]);for(let i=0;i<n.children.length;i++)walk(n.children[i]);};walk(this);return out;}
  }
  const board={loadWindEffect:()=>Promise.resolve({name:'meadow-grass-wind'})};
  const cc={director,Material,MeshRenderer,Node,isValid:(o)=>!!o&&o.isValid!==false};
  const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
  const m={exports:{}};
  vm.runInNewContext(js,{module:m,exports:m.exports,console,Promise,performance,Date,globalThis:{},require:s=>s==='cc'?cc:s==='./MeadowBoardBackground'?board:{}},{filename:'MeadowSailWarm.js'});
  return {M:m.exports,listeners,MeshRenderer,Node,fire(){const ls=listeners.slice();for(let i=0;i<ls.length;i++)ls[i]();}};
}
const {M}=load(true);
assert.equal(M.meadowUnfixedSailMs(),1601);
assert.equal(M.meadowUnfixedSailMs(69),1601);
assert.equal(M.meadowVertexColorPatch(false,true),true);
assert.equal(M.meadowVertexColorPatch(true,true),false);
const grass=M.meadowFinalVariant({effect:'builtin-standard',defines:{USE_VERTEX_COLOR:true},grass:true,meshHasColor:false,pass:0});
assert.equal(grass.effect,'meadow-grass-wind');assert.equal(grass.vcOff,false);assert.ok(grass.key.indexOf('meadow-grass-wind|')===0);
const plain=M.meadowFinalVariant({effect:'lit',defines:{USE_VERTEX_COLOR:true,FOO:1},grass:false,meshHasColor:false,pass:1});
assert.equal(plain.vcOff,true);assert.ok(plain.defines.indexOf('USE_VERTEX_COLOR=false')>=0);assert.ok(plain.defines.indexOf('FOO=1')>=0);
assert.equal(M.meadowWarmItems([plain,plain]).length,1,'duplicate variant keys collapse');
const one=M.meadowWarmPlan(69,0),both=M.meadowWarmPlan(68,1);
assert.equal(one.kicks,1);assert.equal(one.compiles,0);assert.ok(one.ms<=M.MEADOW_WARM_BUDGET_MS);
assert.equal(both.kicks,1);assert.equal(both.compiles,1);assert.ok(both.ms<=M.MEADOW_WARM_BUDGET_MS);
assert.ok(M.meadowWarmFrameCost('kick',1)+M.meadowWarmFrameCost('cache-hit',1)<=4);
const specs=[];
for(let i=0;i<69;i++)specs.push({effect:'fx'+i,defines:{USE_VERTEX_COLOR:true,N:i},grass:false,meshHasColor:false,pass:0});
const items=M.meadowWarmItems(specs);
assert.equal(items.length,69);
const d0=(()=>{let k=0,c=0,maxK=0,maxC=0,maxMs=0;const st=M.stageMeadowSailWarm(items,{kick(){k++;},compile(){c++;return true;}});
  const step=()=>{const k0=k,c0=c;st.step();const dk=k-k0,dc=c-c0;if(dk>maxK)maxK=dk;if(dc>maxC)maxC=dc;const ms=M.meadowWarmFrameCost('kick',dk)+M.meadowWarmFrameCost('cache-hit',dc);if(ms>maxMs)maxMs=ms;assert.ok(dk<=1&&dc<=1&&ms<=4,'frame over budget '+JSON.stringify({dk,dc,ms}));return {dk,dc,ms};};
  return {st,step,get k(){return k;},get c(){return c;},get maxK(){return maxK;},get maxC(){return maxC;},get maxMs(){return maxMs;}};})();
for(let f=0;f<5;f++)d0.step();
d0.st.noteSail();
const skipped=d0.step();
assert.deepEqual(skipped,{dk:0,dc:0,ms:0},'early sail frame does no warm work');
let guard=0;while(!d0.st.stats().done){d0.step();if(++guard>200)throw Error('warm did not finish');}
assert.equal(d0.c,69,'every variant compiled once');assert.equal(d0.k,69);
assert.equal(d0.maxK,1);assert.equal(d0.maxC,1);assert.ok(d0.maxMs<=4);assert.ok(d0.st.stats().maxFrameMs<=4);
d0.st.noteSail();const after=d0.step();
assert.deepEqual(after,{dk:0,dc:0,ms:0},'sail after the set is done still compiles nothing');
assert.equal(d0.st.stats().sailSkips,2);
const finals=d0.st.stats().finalKeys;assert.equal(finals.length,69);
// no clock → prepare keeps the old path
assert.equal(load(false).M.beginMeadowSailWarm({isValid:true}),null);
// real begin: park, one compile per fired frame, sail frame compiles nothing, want flags stick
(async()=>{
  const L=load(true);
  const model=new L.Node('env_meadow');
  const g=new L.Node('meadow_grass_instances.0');model.addChild(g);const gr=g.addComponent(L.MeshRenderer);gr.sharedMaterials=[{passes:[{defines:{USE_VERTEX_COLOR:true}}],effectName:'builtin'}];
  const p=new L.Node('meadow_path');model.addChild(p);const pr=p.addComponent(L.MeshRenderer);pr.sharedMaterials=[{passes:[{defines:{USE_VERTEX_COLOR:true,FOO:1}}],effectName:'lit'}];
  const h=new L.Node('meadow_far_hills');model.addChild(h);const hr=h.addComponent(L.MeshRenderer);hr.sharedMaterials=[{passes:[{defines:{USE_VERTEX_COLOR:true}}],effectName:'hills'}];
  hr.__qfSailWant=0;pr.__qfSailWant=1;
  const warm=L.M.beginMeadowSailWarm(model);
  assert.ok(warm);assert.equal(L.M.beginMeadowSailWarm(model),warm);
  await warm.whenReady();
  assert.equal(gr.enabled,false,'grass parked');assert.equal(pr.enabled,false,'path parked');assert.equal(hr.enabled,false,'hills parked');
  L.M.noteMeadowSailFrame(model);
  const c0=gr.compiles+pr.compiles+hr.compiles;L.fire();
  assert.equal(gr.compiles+pr.compiles+hr.compiles,c0,'set-off frame compiles nothing');
  let guard=0;while(warm.stats()&&!warm.stats().done){const before=gr.compiles+pr.compiles+hr.compiles;L.fire();const delta=gr.compiles+pr.compiles+hr.compiles-before;assert.ok(delta<=1,'more than one compile in a frame');if(++guard>30)throw Error('begin warm did not finish');}
  assert.equal(gr.enabled,true,'grass restored');assert.equal(pr.enabled,true,'night/want-on restored after compile');assert.equal(hr.enabled,false,'want-off stays off');
  assert.ok(warm.finalDefines().some(k=>k.indexOf('meadow-grass-wind|')===0));
  assert.ok(warm.finalDefines().some(k=>k.indexOf('USE_VERTEX_COLOR=false')>=0));
  const sail=fs.readFileSync(path.join(ROOT,'creator-build-project/assets/scripts/region/SailPreload.ts'),'utf8');
  const ad=fs.readFileSync(path.join(ROOT,'creator-build-project/assets/scripts/region/RegionJourneyAdapter.ts'),'utf8');
  assert.match(sail,/beginMeadowSailWarm\(model\)/);assert.ok(!/rig\.active=true/.test(sail),'warm rig stays inactive');
  assert.match(ad,/noteMeadowSailFrame\(model\)/);
  assert.match(ad,/if\(!warm\)configureMeadowVertexColors\(model\)/);
  assert.match(ad,/__qfSailWant=0/);assert.match(ad,/__qfSailWant=1/);
  assert.match(ad,/for\(const r of grass\)for\(let i=0;i<r\.sharedMaterials\.length;i\+\+\)r\.setSharedMaterial\(material,i\)/);
  assert.match(ad,/loadWindEffect\(\)/);assert.match(ad,/mountMeadowNightSky\(model\);/);
  assert.match(ad,/motion\.journeyNight=true;motion\.clouds=meadowCloudMaterials\(find\(model,'meadow_clouds_near'\)\)/);
  assert.match(ad,/motion\.grounds=meadowGroundMaterials\(\[find\(model,'meadow_terrain'\),find\(model,'meadow_river_bank'\)\]\)/);
  assert.doesNotMatch(src,/\bnew (Map|Set)\b/);assert.doesNotMatch(src,/for\s*\(\s*(const|let|var)\s+[^;]*\bof\b/);
  const es5=ts.transpileModule(src,{compilerOptions:{module:1,target:1,...(ts.version.startsWith('6.')?{ignoreDeprecations:'6.0'}:{})},reportDiagnostics:true});
  assert.equal((es5.diagnostics||[]).length,0,'ES5 transpile');
  const evidence={model:'meadow-sail-warm-c',unfixedVariants:69,unfixedSailMs:1601,budgetMs:4,
    frameCostMs:{kick:M.MEADOW_WARM_COST.kickMs,cacheHit:M.MEADOW_WARM_COST.cacheHitMs,kickPlusCacheHit:M.meadowWarmFrameCost('kick',1)+M.meadowWarmFrameCost('cache-hit',1)},
    earlySailAtFrame:5,earlySailKicks:0,earlySailCompiles:0,totalCompiles:d0.c,maxKicksPerFrame:d0.maxK,maxCompilesPerFrame:d0.maxC,maxFrameMs:d0.st.stats().maxFrameMs,
    sailSkips:d0.st.stats().sailSkips,finalDefineKeys:finals.length,
    note:'Offline cost model. One synchronous driver compile is not sliced; the sail frame does none, and unfinished MeshRenderers stay disabled. Mac measures real frame ms.'};
  fs.mkdirSync(evDir,{recursive:true});
  fs.writeFileSync(path.join(evDir,'warmup-c-cost.json'),JSON.stringify(evidence,null,2)+'\n');
  console.log('PASS meadow-sail-warm unfixed=1601ms budget=4 maxFrameMs='+evidence.maxFrameMs+' compiles='+d0.c+' sailSkips='+evidence.sailSkips);
})().catch(e=>{console.error(e);process.exit(1);});
