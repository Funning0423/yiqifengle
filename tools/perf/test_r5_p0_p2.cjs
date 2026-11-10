#!/usr/bin/env node
'use strict';
/** Headless before/after for perf/r5-p0-p2.
 *  Mac baseline is the 95dc672d probe report (iPhone heat is infer-only). After numbers are this scheduler,
 *  run with a fake device: one compile per step, no TransitionShaderWarm after_draw listener. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||require('../qf-env.cjs').typescript());
const ROOT=path.join(__dirname,'../..');
const S=path.join(ROOT,'creator-build-project/assets/scripts');
function load(rel,req){
 const src=fs.readFileSync(path.join(S,rel),'utf8');
 const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 const m={exports:{}};
 vm.runInNewContext(js,{module:m,exports:m.exports,console,require:req||(()=>{}),Math,Date,Object,Array,String,Number,Map,Set,WeakSet,Promise,globalThis:{}},{filename:rel});
 return m.exports;
}
const P=load('region/PerfBudget.ts');
const flight=P.flightWarmSchedule(9,20);
assert.equal(flight.before.flightFrameShaders,9);
assert.equal(flight.before.maxFrameMs,180);
assert.equal(flight.after.flightFrameShaders,0);
assert.equal(flight.after.maxFrameMs,20);
assert.equal(flight.after.warmFrames,9);
assert.equal(JSON.stringify(P.flightCutFrames().map(f=>f.setCamera)),JSON.stringify(['hold','new']));

const B1=load('region/BalloonB1Start.ts',s=>s.endsWith('RegionNodes')?{REGION_NODES:{meadow:{nodes:[{key:'M1',at:[0,0,0]}]}}}:s.endsWith('NodeWalker')?{routeKeys:()=>({path:[[0,0,0],[2.6,6.341,-20.8]]}),WALK_SPEED_MPS:1.2}:s.endsWith('WorldFlowCore')?{}:s.endsWith('ExploreCameraCore')?{followPose:()=>({position:[0,0,0],target:[0,0,1]})}:s.endsWith('TransitionCamera')?{blendPose:(a)=>a,minJerk:u=>u}:{});
assert.equal(B1.b1ShaderWarmFrames(10,8),18*60);
assert.equal(B1.b1ShaderWarmFrames(0,0),0);
const pre=B1.b1PreWalk([0,6,0],[2.6,6.3,-20]);
assert.ok(pre===null||pre.durationS>=0,'prewalk geometry still returns');

function glb(file){
 const d=fs.readFileSync(file);const L=d.readUInt32LE(12);
 return JSON.parse(d.subarray(20,20+L).toString('utf8'));
}
const sky=glb(path.join(ROOT,'creator-build-project/assets/bundles/region_skycity/env_skycity.glb'));
const mergeMats=new Map();
for(const n of sky.nodes){
 if(!('mesh' in n)||'skin' in n)continue;
 const mesh=sky.meshes[n.mesh];
 const prims=(mesh.primitives||[]).length||1;
 const mat=String((mesh.primitives[0]||{}).material);
 const g=mergeMats.get(mat)||{material:mat,prims:0,merge:true};
 g.prims+=prims;mergeMats.set(mat,g);
}
const draws=P.boardDraws([...mergeMats.values()]);
assert.ok(draws.before>draws.after,JSON.stringify(draws));
const reveal=P.boardRevealSchedule(draws.before,17,draws.after);
assert.equal(reveal.before.frameMs,181);
assert.equal(reveal.before.drawCalls,261);
assert.ok(reveal.after.maxRenderers<=4);
assert.ok(reveal.after.maxUploads<=2);
assert.ok(reveal.after.steadyDraws<reveal.before.steadyDraws);

const lease=P.leaseCreate();
for(const id of ['island','meadow','sail','balloon','skycity'])P.leaseAcquire(lease,id);
P.leaseAcquire(lease,'skycity');
const textures={island:87,meadow:39,sail:81,balloon:35,skycity:65};
let destroyed=0;
for(const id of ['island','meadow','sail','balloon']){
 const r=P.leaseRelease(lease,id,textures[id]);
 destroyed+=r.destroyed;
 assert.equal(P.leaseNeedsReload(lease,id),true);
}
assert.equal(P.leaseRelease(lease,'skycity',textures.skycity).destroyed,0,'board still holds skycity');
assert.equal(destroyed,87+39+81+35);
P.leaseRelease(lease,'skycity',textures.skycity);
assert.equal(lease.destroyed.skycity,65);
assert.equal(P.leaseNeedsReload(lease,'skycity'),true);

const motion=[];
for(let i=0;i<8;i++)motion.push(i);
const journey=P.journeyPrimeSchedule(94,motion);
assert.equal(journey.beforeMax,94);
assert.equal(journey.afterMax,1);
assert.equal(journey.compilesOnMotion,0);
assert.equal(journey.listenerRemoved,true);

const ops=[];
for(let i=0;i<60;i++)ops.push({t:i*16,key:'forest-mainline-cocos-r1-active',value:'same'});
const steady=P.dirtyThrottle(ops);
assert.equal(steady.syncWrites,1);
assert.ok(steady.hostWrites<60);
const burst=[];
for(let i=0;i<60;i++)burst.push({t:i*16,key:'dot-runtime-diagnostics-20261010:world-flow',value:'v'+i});
const diag=P.dirtyThrottle(burst);
assert.ok(diag.hostWrites<60&&diag.hostWrites>=2,JSON.stringify(diag));
assert.ok(diag.asyncFlushes>=1);

const tswSrc=fs.readFileSync(path.join(S,'region/TransitionShaderWarm.ts'),'utf8');
assert.match(tswSrc,/TRANSITION_SHADER_WARM_ENABLED\s*=\s*false/);
assert.doesNotMatch(tswSrc,/TRANSITION_SHADER_WARM_ENABLED\s*=\s*true/);
assert.doesNotMatch(fs.readFileSync(path.join(S,'region/FlightShaderPrime.ts'),'utf8'),/director\.on\(/);
assert.doesNotMatch(fs.readFileSync(path.join(S,'region/JourneyShaderPrime.ts'),'utf8'),/director\.on\(/);
assert.doesNotMatch(fs.readFileSync(path.join(S,'region/SkycityBoardBackground.ts'),'utf8'),/batchSkycityBoard|__qfBoardSpread/);
assert.match(fs.readFileSync(path.join(S,'region/RegionBoardLanding.ts'),'utf8'),/primeReveal\?\(\):void/);
assert.match(fs.readFileSync(path.join(S,'world-r2/LevelBackground.ts'),'utf8'),/__qfOnBoardVisible/);
assert.match(fs.readFileSync(path.join(S,'region/LakesideBoardGuest.ts'),'utf8'),/__qfBatchSkycityBoard/);
assert.doesNotMatch(fs.readFileSync(path.join(S,'region/SkycityBoardBatch.ts'),'utf8'),/USE_INSTANCING/);
assert.match(fs.readFileSync(path.join(S,'region/RegionGpuLease.ts'),'utf8'),/_gfxTexture|getGFXTexture/);

const fakeTsw={
 TRANSITION_SHADER_WARM_ENABLED:false,
 SETCAM_SHADOW_MACROS:[{name:'CC_USE_HDR',value:1}],
 LIVE_UNLIT_MACROS:[{name:'CC_USE_FOG',value:4}],
 DEPARTURE_SHADOW_MACROS:[{name:'CC_SHADOW_TYPE',value:2}],
 shaderShowsSetcam:()=>true,shaderShowsUnlitHot:()=>true,shaderShowsAnimate:()=>true,
 withAssignMacros(_bag,run){return run();},
};
const cc={Node:class{}};
const prime=load('region/FlightShaderPrime.ts',s=>s==='cc'?cc:s.endsWith('TransitionShaderWarm')?fakeTsw:{});
const passes=[];
for(let i=0;i<9;i++)passes.push({n:0,tryCompile(){this.n++;},getShaderVariant(){this.n++;return {name:'builtin|CC_DIR_SHADOW_PCF_TYPE2|CC_SHADOWMAP_FORMAT1'};}});
const root={components:[{sharedMaterials:[{effectName:'builtin-standard',passes}]}],children:[]};
assert.equal(prime.armFlightShaderPrime([root]),9);
let steps=0,maxStep=0;
while(prime.flightPrimePending()){const c=prime.stepFlightShaderPrime();steps++;if(c>maxStep)maxStep=c;}
assert.equal(steps,9);assert.equal(maxStep,1);assert.equal(prime.flightPrimePending(),0);
assert.equal(prime.stepFlightShaderPrime(),0,'flight cut compiles nothing once the bag is warm');
assert.equal(fakeTsw.TRANSITION_SHADER_WARM_ENABLED,false);

const jsrc=fs.readFileSync(path.join(S,'region/JourneyShaderPrime.ts'),'utf8');
assert.doesNotMatch(jsrc,/getShaderVariant|tryCompile|withAssignMacros/);
assert.doesNotMatch(fs.readFileSync(path.join(S,'world-r1/WorldFlowComponent.ts'),'utf8'),/stepJourneyPrime/);
const j=load('region/JourneyShaderPrime.ts',s=>s==='cc'?cc:s.endsWith('TransitionShaderWarm')?fakeTsw:{});
const primed=root.components[0].sharedMaterials[0].passes[0];
const before=primed.n;
j.beginJourneyShaderPrime(root);
for(let i=0;i<64;i++)assert.equal(j.stepJourneyPrime(),0);
assert.equal(primed.n,before,'journey prime does not compile on a steady frame');
assert.equal(j.journeyPrimePending(),0);

const gpu=load('region/RegionGpuLease.ts',()=>({assetManager:null}));
assert.equal(JSON.stringify(gpu.sweepUnreferenced(['region_meadow'])),JSON.stringify({released:0,destroyed:0,skipped:0}));
const destroyedTex=[];
const assets=new Map();
function asset(uuid,rc){const a={refCount:rc,_texture:{destroy(){destroyedTex.push(uuid);}}};assets.set(uuid,a);return a;}
asset('meadow-tex',1);asset('live-tex',3);
const am={
 assets,
 getBundle(name){return name==='region_meadow'?{getAssetInfo:(id)=>assets.has(id)}:null;},
 releaseAsset(a){a.released=true;},
 removeBundle(){am.removed=true;},
};
const gpu2=load('region/RegionGpuLease.ts',()=>({assetManager:am}));
gpu2.holdRegionGpu('region_skycity');
const held=gpu2.sweepUnreferenced(['region_skycity']);
assert.equal(held.skipped,1);
const swept=gpu2.sweepUnreferenced(['region_meadow']);
assert.equal(swept.destroyed,1);
assert.equal(destroyedTex.length,1);
assert.equal(assets.get('live-tex').released,undefined,'in-use texture stays');

const summary={
 macBaseline:{flightLongMs:[141,189,158],flightStallS:0.93,boardLongMs:181,boardDc:[38,261],boardUploads:17,boardSteadyDc:265,journeyShaders:[16,62,94],bootRafMs:871,steadyGetItem:1},
 headlessAfter:{
  flight:{maxFrameMs:flight.after.maxFrameMs,flightFrameShaders:flight.after.flightFrameShaders,warmFrames:flight.after.warmFrames},
  board:{drawsBefore:draws.before,drawsAfter:draws.after,revealMaxRenderers:reveal.after.maxRenderers,revealMaxUploads:reveal.after.maxUploads,steadyDraws:reveal.after.steadyDraws},
  gpu:{destroyedOnLeave:destroyed,skycityHeld:true,reloadMarked:true},
  journey:{beforeMax:journey.beforeMax,afterMax:journey.afterMax,compilesOnMotion:journey.compilesOnMotion},
  storage:{steadyHostWrites:steady.hostWrites,steadySyncWrites:steady.syncWrites,burstHostWrites:diag.hostWrites,burstAsyncFlushes:diag.asyncFlushes},
 },
 tsw:'TRANSITION_SHADER_WARM_ENABLED stays false; no new director_after_draw listener',
};
console.log(JSON.stringify(summary,null,2));
console.log('PASS perf-r5-p0-p2');
