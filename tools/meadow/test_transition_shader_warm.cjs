'use strict';
/** b20: the animateCamera spikes (70 + 31 createShader) move into a meadow-C schedule.
 *  One kick and one compile per frame, sail frame 0, hold frame 0. The camera track is not awaited or held. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||'typescript');
const ROOT=path.join(__dirname,'../..');
const SRC=path.join(ROOT,'creator-build-project/assets/scripts/region/TransitionShaderWarm.ts');
const MEADOW=path.join(ROOT,'creator-build-project/assets/scripts/region/MeadowSailWarm.ts');
const src=fs.readFileSync(SRC,'utf8'),meadowSrc=fs.readFileSync(MEADOW,'utf8');
const evDir=path.join(ROOT,'docs/r5/b20-hotfix/evidence');
function load(){
 const listeners=[],recorded=[];
 const macros={CC_DIR_SHADOW_PCF_TYPE:0,CC_SHADOW_TYPE:1,CC_USE_FOG:4};
 const engineMacros={CC_DIR_SHADOW_PCF_TYPE:0,CC_SHADOW_TYPE:1,CC_USE_FOG:4};
 const programLib={pipeline:{macros:engineMacros},getProgramVariant(_d,_p,name,defines){
  Object.assign(defines,engineMacros);const snap={name};const keys=Object.keys(defines);for(let i=0;i<keys.length;i++)snap[keys[i]]=defines[keys[i]];recorded.push(snap);
  const parts=[name];
  if(defines.CC_DIR_SHADOW_PCF_TYPE===2)parts.push('CC_DIR_SHADOW_PCF_TYPE2');
  if(defines.CC_SHADOW_TYPE===2)parts.push('CC_SHADOW_TYPE2');
  if(defines.CC_USE_SKINNING)parts.push('CC_USE_SKINNING1');
  if(defines.CC_RECEIVE_SHADOW)parts.push('CC_RECEIVE_SHADOW1');
  if(defines.CC_MORPH_TARGET_COUNT)parts.push('CC_MORPH_TARGET_COUNT'+defines.CC_MORPH_TARGET_COUNT);
  if(defines.CC_FORWARD_ADD)parts.push('CC_FORWARD_ADD1');
  if(defines.CC_PIPELINE_TYPE)parts.push('CC_PIPELINE_TYPE1');
  if(defines.USE_VERTEX_COLOR)parts.push('USE_VERTEX_COLOR1');
  if(String(name).indexOf('reflect-map-fs')>=0)parts.push('reflect-map-fs');
  return {shader:{name:parts.join('|')}};
 }};
 const director={on(ev,f){listeners.push(f);},off(ev,f){for(let i=listeners.length-1;i>=0;i--)if(listeners[i]===f)listeners.splice(i,1);},root:{device:{id:1},pipeline:{macros,programLib}}};
 class Material{constructor(){this.passes=[];}}
 class MeshRenderer{}
 class Node{constructor(name){this.name=name;this.children=[];this.components=[];this.parent=null;}addChild(c){c.parent=this;this.children.push(c);} }
 const cc={director,Material,MeshRenderer,Node,isValid:o=>!!o};
 const opts={compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}};
 const meadowJs=ts.transpileModule(meadowSrc,opts).outputText;
 const js=ts.transpileModule(src,opts).outputText;
 const board={loadWindEffect:()=>Promise.resolve({name:'meadow-grass-wind'})};
 const meadow={exports:{}};
 vm.runInNewContext(meadowJs,{module:meadow,exports:meadow.exports,console,Promise,performance,Date,Object,globalThis:{},require:s=>s==='cc'?cc:s==='./MeadowBoardBackground'?board:{}},{filename:'MeadowSailWarm.js'});
 const m={exports:{}};
 vm.runInNewContext(js,{module:m,exports:m.exports,console,Promise,performance,Date,Object,globalThis:{},require:s=>s==='cc'?cc:s==='./MeadowSailWarm'?meadow.exports:{}},{filename:'TransitionShaderWarm.js'});
 return {api:m.exports,listeners,macros,engineMacros,recorded,director};
}
const L=load();
const T=L.api;
function node(name){return {name,children:[],components:[],parent:null};}
function add(parent,child){child.parent=parent;parent.children.push(child);return child;}
function renderer(mesh,materials,extra){return Object.assign({sharedMaterials:materials,mesh:mesh||{struct:{}},model:null},extra||{});}
const girl=node('girl');
const counts=[53,16,3];
for(let i=0;i<counts.length;i++){
 const n=node('morph'+counts[i]);add(girl,n);
 const baseDefines={USE_VERTEX_COLOR:1,USE_ALBEDO_MAP:1};
 const pass={program:'builtin-standard|standard-vs|standard-fs',programName:'builtin-standard|standard-vs|standard-fs',phaseID:7,device:{id:1},defines:baseDefines,getShaderVariant(){this.n=(this.n||0)+1;}};
 const addDefines={USE_VERTEX_COLOR:1,CC_FORWARD_ADD:1,CC_PIPELINE_TYPE:1};
 const addPass={program:'builtin-standard|standard-vs|standard-fs',phaseID:7,device:{id:1},defines:addDefines,blendState:{targets:[{blend:true}]},getShaderVariant(){}};
 const reflect={program:'builtin-standard|standard-vs|reflect-map-fs',phaseID:7,device:{id:1},defines:{USE_VERTEX_COLOR:1,USE_ALBEDO_MAP:1},getShaderVariant(){}};
 const passes=i===0?[pass,addPass,reflect]:[pass];
 n.components.push(renderer({struct:{morph:{subMeshMorphs:[{targets:new Array(counts[i]),attributes:['a_position']}]}}},[{effectName:'builtin-standard',passes}],{skeleton:{},receiveShadow:true}));
}
const alpha=node('foliage');add(girl,alpha);
function stdPass(defines,program){return {program:program||'builtin-standard|standard-vs|standard-fs',programName:program||'builtin-standard|standard-vs|standard-fs',phaseID:7,device:{id:1},defines:defines,getShaderVariant(){}};}
alpha.components.push(renderer(null,[{effectName:'builtin-standard',passes:[stdPass({USE_ALBEDO_MAP:1,USE_ALPHA_TEST:1})]}]));
const uv=node('second');add(girl,uv);
uv.components.push(renderer(null,[{effectName:'builtin-standard',passes:[stdPass({HAS_SECOND_UV:1,USE_ALBEDO_MAP:1})]}]));
const unlit=node('card');add(girl,unlit);
unlit.components.push(renderer(null,[{effectName:'builtin-unlit',passes:[stdPass({USE_VERTEX_COLOR:1,USE_TEXTURE:1},'builtin-unlit|unlit-vs|unlit-fs')]}]));
const grass=node('meadow_grass_instances.0');add(girl,grass);
grass.components.push(renderer(null,[{effectName:'meadow-grass-wind',passes:[stdPass({},'meadow-grass-wind|meadow-grass-vs|meadow-grass-fs')]}]));
const dup=node('morph53b');add(girl,dup);
dup.components.push(renderer({struct:{morph:{subMeshMorphs:[{targets:new Array(53),attributes:['a_position']}]}}},[{effectName:'builtin-standard',passes:[stdPass({USE_VERTEX_COLOR:1,USE_ALBEDO_MAP:1})]}],{skeleton:{},receiveShadow:true}));
const jobs=T.collectTransitionPasses(girl);
assert.ok(T.transitionWarmCoversMac(jobs.map(j=>j.key)),'Mac 1841/1938 variants missing '+jobs.map(j=>j.key).join('\n'));
const morph53=jobs.filter(j=>j.key.indexOf('CC_MORPH_TARGET_COUNT=53')>=0&&j.key.indexOf('standard-fs')>=0&&j.key.indexOf('CC_FORWARD_ADD')<0);
assert.equal(morph53.length,1,'duplicate morph-53 keys collapse');
assert.ok(jobs.some(j=>j.hot&&j.key.indexOf('CC_USE_SKINNING=true')>=0));
assert.ok(jobs.some(j=>j.key.indexOf('CC_RECEIVE_SHADOW=true')>=0&&j.key.indexOf('CC_MORPH_TARGET_COUNT=16')>=0));
const items=[];for(let i=0;i<40;i++)items.push({key:'k'+i});
const run=(()=>{let k=0,c=0,maxK=0,maxC=0;const st=T.stageTransitionWarm(items,{kick(){k++;},compile(){c++;return true;}});
 const step=()=>{const k0=k,c0=c;st.step();const dk=k-k0,dc=c-c0;if(dk>maxK)maxK=dk;if(dc>maxC)maxC=dc;
  const ms=0.25*dk+0.5*dc;assert.ok(dk<=1&&dc<=1&&ms<=4,'frame over budget '+JSON.stringify({dk,dc,ms}));return {dk,dc};};return {st,step,get k(){return k;},get c(){return c;},get maxK(){return maxK;},get maxC(){return maxC;}};})();
run.st.hold(true);run.st.noteSail();
assert.deepEqual(run.step(),{dk:0,dc:0},'held frame compiles nothing and keeps the sail skip');
run.st.hold(false);
assert.deepEqual(run.step(),{dk:0,dc:0},'sail frame compiles nothing');
let guard=0;while(!run.st.stats().done){run.step();if(++guard>200)throw Error('warm did not finish');}
assert.equal(run.c,40);assert.equal(run.k,40);assert.equal(run.maxK,1);assert.equal(run.maxC,1);
assert.ok(run.st.stats().maxFrameMs<=4);assert.equal(run.st.stats().sailSkips,1);
const flow=fs.readFileSync(path.join(ROOT,'creator-build-project/assets/scripts/world-r1/WorldFlowCore.ts'),'utf8');
const comp=fs.readFileSync(path.join(ROOT,'creator-build-project/assets/scripts/world-r1/WorldFlowComponent.ts'),'utf8');
const preload=fs.readFileSync(path.join(ROOT,'creator-build-project/assets/scripts/region/TransitionPreload.ts'),'utf8');
const sail=fs.readFileSync(path.join(ROOT,'creator-build-project/assets/scripts/region/SailPreload.ts'),'utf8');
const ad=fs.readFileSync(path.join(ROOT,'creator-build-project/assets/scripts/region/RegionJourneyAdapter.ts'),'utf8');
assert.equal(flow.indexOf('warmBeforeDeparture'),-1,'camera is not gated on the warm');
assert.match(flow,/const fail=this\.blocked\('home',true\);if\(fail\)return fail;\s*return this\.operate\('standing'/);
assert.match(comp,/armTransitionShaderWarm\(\)/);assert.match(comp,/beginTransitionShaderWarm\(\)/);assert.match(comp,/watchTransitionRoot\(scene\)/);
assert.equal(comp.indexOf('holdTransitionShaders'),-1,'animateCamera does not pause the warm');
assert.match(comp,/animateCamera:\(path,seconds,t,options,progress,onSample\)=>\{const track=createCameraTrack\(camera,path,'world\.animateCamera'/);
const cam=comp.slice(comp.indexOf("animateCamera:(path"),comp.indexOf("animateCamera:(path")+700);
assert.equal(cam.indexOf('await'),-1,'animateCamera does not wait');
assert.ok(preload.includes("while((s=stable())===false)await wait(gap);if(s==='gone')throw Error('left-island');await preloadMeadowForSail(parent);"));
const wnc=fs.readFileSync(path.join(ROOT,'creator-build-project/assets/scripts/world-r2/WorldNativeComposition.ts'),'utf8');
assert.ok(wnc.includes("target!=='meadow'")&&wnc.includes("target==='meadow'"),'meadow target still mounts');
assert.ok(!wnc.includes("!!s.journey?.target?'gone'"));
assert.ok(src.includes('CC_DIR_SHADOW_PCF_TYPE')&&src.includes('CC_SHADOW_TYPE'));
assert.equal(T.departureAlreadyLive({CC_DIR_SHADOW_PCF_TYPE:0,CC_SHADOW_TYPE:2}),false);
assert.equal(T.departureAlreadyLive({CC_DIR_SHADOW_PCF_TYPE:2,CC_SHADOW_TYPE:2}),true);
const savedPcf=L.macros.CC_DIR_SHADOW_PCF_TYPE,savedType=L.macros.CC_SHADOW_TYPE;
const restored=T.withDepartureMacros(L.macros,()=>{assert.equal(L.macros.CC_DIR_SHADOW_PCF_TYPE,2);assert.equal(L.macros.CC_SHADOW_TYPE,2);return 1;});
assert.equal(restored,1);assert.equal(L.macros.CC_DIR_SHADOW_PCF_TYPE,savedPcf);assert.equal(L.macros.CC_SHADOW_TYPE,savedType);
assert.equal(T.CRITICAL_PER_FRAME,3);
assert.equal(T.reflectProgramName('builtin-standard|standard-vs|standard-fs'),'builtin-standard|standard-vs|reflect-map-fs');
assert.ok(T.shaderShowsDeparture('builtin-standard|standard-vs|standard-fs|CC_DIR_SHADOW_PCF_TYPE2|CC_SHADOW_TYPE2'));
assert.equal(T.shaderShowsDeparture('builtin-standard|standard-vs|standard-fs|CC_DIR_SHADOW_PCF_TYPE0|CC_SHADOW_TYPE2'),false);
const assigned=T.withAssignDeparture(()=>Object.assign({USE_VERTEX_COLOR:1},{CC_USE_HDR:1,CC_DIR_SHADOW_PCF_TYPE:0,CC_SHADOW_TYPE:1}));
assert.equal(assigned.CC_DIR_SHADOW_PCF_TYPE,2);assert.equal(assigned.CC_SHADOW_TYPE,2);assert.equal(assigned.CC_USE_HDR,1);
assert.ok(T.isCriticalWarm(true,{},'fx','p'));
assert.ok(T.isCriticalWarm(false,{USE_VERTEX_COLOR:1},'fx','p'));
assert.ok(T.isCriticalWarm(false,{},'builtin-standard','standard-vs|standard-fs'));
T.resetTransitionShaderWarm();T.watchTransitionRoot(girl);assert.equal(L.listeners.length,1);
const girlPass=girl.children[0].components[0].sharedMaterials[0].passes[0];
let maxCompile=0;
for(let i=0;i<80;i++){const n0=L.recorded.length;L.listeners[0]();const dn=L.recorded.length-n0;if(dn>maxCompile)maxCompile=dn;
 assert.ok(dn<=T.CRITICAL_PER_FRAME*2,'critical frame compiled too many '+dn);
 assert.equal(L.macros.CC_DIR_SHADOW_PCF_TYPE,0);assert.equal(L.engineMacros.CC_DIR_SHADOW_PCF_TYPE,0);assert.equal(L.engineMacros.CC_SHADOW_TYPE,1);
 assert.notEqual(girlPass.defines.CC_DIR_SHADOW_PCF_TYPE,2,'departure compile stuck PCF on the pass');}
assert.ok(maxCompile>=1&&maxCompile<=T.CRITICAL_PER_FRAME*2);
assert.ok(L.recorded.length>=6,'departure variants did not compile');
const pcf2=L.recorded.filter(r=>r.CC_DIR_SHADOW_PCF_TYPE===2&&r.CC_SHADOW_TYPE===2);
assert.ok(pcf2.length>=6,'spike macros missing '+JSON.stringify(L.recorded.slice(0,6)));
assert.ok(pcf2.some(r=>r.CC_MORPH_TARGET_COUNT===53&&r.CC_USE_SKINNING===true&&r.CC_RECEIVE_SHADOW===true&&r.CC_USE_MORPH===true));
assert.ok(pcf2.some(r=>r.CC_FORWARD_ADD===1&&r.CC_IS_TRANSPARENCY_PASS===1&&r.CC_MORPH_TARGET_COUNT===53));
assert.ok(pcf2.some(r=>r.CC_PIPELINE_TYPE===1&&r.CC_MORPH_TARGET_COUNT===53));
assert.ok(pcf2.some(r=>String(r.name).indexOf('reflect-map-fs')>=0&&r.CC_MORPH_TARGET_COUNT===53));
assert.equal(T.transitionWarmStats().criticalPending,0,'criticalPending must wait for live cache names');
const nSail=L.recorded.length;T.noteTransitionSailFrame();L.listeners[0]();assert.equal(L.recorded.length,nSail,'sail frame compiles nothing');
const hidden={CC_DIR_SHADOW_PCF_TYPE:0,CC_SHADOW_TYPE:1,CC_USE_FOG:4};
const propDefines={USE_VERTEX_COLOR:1};
let propShader={id:'live'};
const prop=node('prop');
const hiddenPass={defines:propDefines,_shader:propShader,program:'builtin-standard|standard-vs|standard-fs',phaseID:7,device:{id:1},_root:{pipeline:{macros:hidden,setMacroInt(n,v){hidden[n]=v;}}},getShaderVariant(patches){
 const d=this.defines;if(patches)for(let i=0;i<patches.length;i++)d[patches[i].name]=patches[i].value;
 Object.assign(d,this._root.pipeline.macros);L.recorded.push(Object.assign({via:'hidden'},d));
 const nm=['builtin-standard|standard-vs|standard-fs'];
 if(d.USE_VERTEX_COLOR)nm.push('USE_VERTEX_COLOR1');
 if(d.CC_DIR_SHADOW_PCF_TYPE===2)nm.push('CC_DIR_SHADOW_PCF_TYPE2');
 if(d.CC_SHADOW_TYPE===2)nm.push('CC_SHADOW_TYPE2');
 if(patches)for(let i=0;i<patches.length;i++)delete d[patches[i].name];this._shader={id:'depart',name:nm.join('|')};return this._shader;
}};
prop.components.push(renderer(null,[{effectName:'builtin-standard',passes:[hiddenPass]}]));
delete L.director.root.pipeline.programLib;
T.resetTransitionShaderWarm();T.watchTransitionRoot(prop);
const before=L.recorded.length;L.listeners[0]();
const hid=L.recorded.filter(r=>r.via==='hidden');
assert.ok(hid.length>=1,'hidden pipeline bag was not compiled');
assert.equal(hid[0].CC_DIR_SHADOW_PCF_TYPE,2);assert.equal(hid[0].CC_SHADOW_TYPE,2);
assert.equal(propDefines.CC_DIR_SHADOW_PCF_TYPE,undefined,'fallback left PCF on the pass');
assert.equal(hidden.CC_DIR_SHADOW_PCF_TYPE,0);assert.equal(hidden.CC_SHADOW_TYPE,1);
assert.equal(hiddenPass._shader.id,'live');
assert.equal(L.macros.CC_DIR_SHADOW_PCF_TYPE,0);assert.equal(L.macros.CC_SHADOW_TYPE,1);
assert.match(comp,/herAdapter as any/);
assert.match(preload,/beginTransitionShaderWarm\(\);watchTransitionRoot\(parent\);/);
assert.match(sail,/watchTransitionRoot\(model\)/);
assert.match(ad,/noteMeadowSailFrame\(model\);noteTransitionSailFrame\(\)/);
assert.doesNotMatch(src,/\bnew (Map|Set)\b/);assert.doesNotMatch(src,/for\s*\(\s*(const|let|var)\s+[^;]*\bof\b/);
assert.doesNotMatch(meadowSrc,/\bnew (Map|Set)\b/);assert.doesNotMatch(meadowSrc,/for\s*\(\s*(const|let|var)\s+[^;]*\bof\b/);
const es5opts={compilerOptions:{module:1,target:1,...(ts.version.startsWith('6.')?{ignoreDeprecations:'6.0'}:{})},reportDiagnostics:true};
for(const file of [src,meadowSrc]){const es5=ts.transpileModule(file,es5opts);assert.equal((es5.diagnostics||[]).length,0,'ES5 transpile');}
const evidence={model:'transition-shader-warm',macFrames:{animateCamera1803:{ms:772,shaders:70,tip:'8e93c02b'}},
 budgetMs:4,criticalPerFrame:T.CRITICAL_PER_FRAME,variants:jobs.length,morphCounts:[53,16,3],
 departureMacros:['CC_DIR_SHADOW_PCF_TYPE=2','CC_SHADOW_TYPE=2'],
 extraFamilies:['CC_FORWARD_ADD+CC_IS_TRANSPARENCY_PASS','CC_PIPELINE_TYPE','reflect-map-fs'],
 maxKicksPerFrame:run.maxK,maxCompilesPerFrame:run.maxC,runtimeCompilesPerFrame:maxCompile,maxFrameMs:run.st.stats().maxFrameMs,
 sailSkips:1,heldFrameCompiles:0,cameraDelayed:false,meadowTargetMounts:true,
 note:'criticalPending is 0 only when the live program cache has the Mac createShader names (PCF2 + SHADOW_TYPE2 plus morph/skin/vertex-color/forward-add/reflect/pipeline). Object.assign is wrapped during compile so getProgramVariant keys those macros. animateCamera is not awaited and the stepper is not held.'};
fs.mkdirSync(evDir,{recursive:true});
fs.writeFileSync(path.join(evDir,'transition-shader-warm.json'),JSON.stringify(evidence,null,2)+'\n');
console.log('PASS transition-shader-warm variants='+jobs.length+' maxFrameMs='+evidence.maxFrameMs+' compiles='+run.c);
