#!/usr/bin/env node
'use strict';
/** Replays the 1ecd8 QF_SYNC failure (steadyCalls 10393, d5b5 was 0) and locks the fix.
 *  stepJourneyPrime ran from WorldFlowComponent.update. It compiled through withAssignMacros(SETCAM),
 *  and that wrapper deletes CC_SHADOW_TYPE from the object Object.assign returns. getProgramVariant
 *  assigns the live pipeline macros, so the delete stuck. Every later steady frame missed the program
 *  cache and called localStorage.getItem. A meadow pass compiled against that key (mainline-06 windmill)
 *  can block the JS thread: console, state and [QF_GPU] stop together.
 *  Boot frames (first 300) are allowed, matching CamTraceLog.SYNC_BOOT_FRAMES. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||require('../qf-env.cjs').typescript());
const ROOT=path.join(__dirname,'../..');
const S=path.join(ROOT,'creator-build-project/assets/scripts');
const BOOT=300,STEADY=2000,KEY='forest-mainline-cocos-r1-active';

function loadTsw(){
 const listeners=[];
 const macros={CC_DIR_SHADOW_PCF_TYPE:0,CC_SHADOW_TYPE:1,CC_USE_FOG:4};
 const engineMacros={CC_DIR_SHADOW_PCF_TYPE:0,CC_SHADOW_TYPE:1,CC_USE_FOG:4};
 const programLib={pipeline:{macros:engineMacros},getProgramVariant(_d,_p,name,defines){Object.assign(defines,engineMacros);return {shader:{name}};}};
 const director={on(ev,f){listeners.push(f);},off(){},root:{device:{id:1},pipeline:{macros,programLib}}};
 class Material{constructor(){this.passes=[];}}
 class MeshRenderer{}
 class Node{constructor(name){this.name=name;this.children=[];this.components=[];this.parent=null;}}
 const cc={director,Material,MeshRenderer,Node,isValid:o=>!!o};
 const opts={compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}};
 const meadowSrc=fs.readFileSync(path.join(S,'region/MeadowSailWarm.ts'),'utf8');
 const src=fs.readFileSync(path.join(S,'region/TransitionShaderWarm.ts'),'utf8');
 const meadowJs=ts.transpileModule(meadowSrc,opts).outputText;
 const js=ts.transpileModule(src,opts).outputText;
 const meadow={exports:{}};
 vm.runInNewContext(meadowJs,{module:meadow,exports:meadow.exports,console,Promise,performance,Date,Object,globalThis:{},require:s=>s==='cc'?cc:s==='./MeadowBoardBackground'?{loadWindEffect:()=>Promise.resolve({})}:{}},{filename:'MeadowSailWarm.js'});
 const m={exports:{}};
 vm.runInNewContext(js,{module:m,exports:m.exports,console,Promise,performance,Date,Object,globalThis:{},require:s=>s==='cc'?cc:s==='./MeadowSailWarm'?meadow.exports:{}},{filename:'TransitionShaderWarm.js'});
 return m.exports;
}
function loadJourney(){
 const src=fs.readFileSync(path.join(S,'region/JourneyShaderPrime.ts'),'utf8');
 const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 const m={exports:{}};
 vm.runInNewContext(js,{module:m,exports:m.exports,console,require:()=>({}),Object,globalThis:{}},{filename:'JourneyShaderPrime.js'});
 return m.exports;
}

/** 1ecd8 step: one setcam compile. getShaderVariant assigns onto the live macros (the engine does this). */
function legacyCompile(T,live,store){
 const pass={
  getShaderVariant(){
   Object.assign(live,{CC_USE_HDR:1});
   store.getItem('program-cache');
   if(!Object.prototype.hasOwnProperty.call(live,'CC_SHADOW_TYPE'))pass.blocked=true;
   return {name:'setcam'};
  },
  blocked:false,
 };
 T.withAssignMacros(T.SETCAM_SHADOW_MACROS,()=>{pass.getShaderVariant(null);});
 return pass;
}
function run(frames,bootAt,each){
 let frame=0,steady=0;
 const store={
  getItem(k){if(frame>=BOOT)steady++;return null;},
  setItem(){},
 };
 for(;frame<frames;frame++)each(frame,store);
 return steady;
}

const T=loadTsw();
const live={CC_SHADOW_TYPE:2,CC_USE_FOG:4,CC_USE_HDR:1,CC_DIR_SHADOW_PCF_TYPE:2};
const legacySteady=run(BOOT+STEADY,BOOT,(frame,store)=>{
 if(frame===0)legacyCompile(T,live,store);
 else if(!Object.prototype.hasOwnProperty.call(live,'CC_SHADOW_TYPE'))store.getItem(KEY);
});
assert.equal(Object.prototype.hasOwnProperty.call(live,'CC_SHADOW_TYPE'),false,'SETCAM assign deletes live CC_SHADOW_TYPE');
assert.equal(legacySteady,STEADY,'one localStorage.getItem per steady frame after the macro delete');

const hangLive={CC_SHADOW_TYPE:2,CC_USE_HDR:1};
const blocked=legacyCompile(T,hangLive,{getItem(){},setItem(){}});
assert.equal(blocked.blocked,true,'the setCamera compile sees CC_SHADOW_TYPE already deleted');

const fixedLive={CC_SHADOW_TYPE:2,CC_USE_FOG:4,CC_USE_HDR:1};
const J=loadJourney();
const fixedSteady=run(BOOT+STEADY,BOOT,(frame,store)=>{
 J.stepJourneyPrime();
 if(!Object.prototype.hasOwnProperty.call(fixedLive,'CC_SHADOW_TYPE'))store.getItem(KEY);
});
assert.equal(fixedSteady,0,'fixed journey prime does not sync-read in steady frames');
assert.equal(fixedLive.CC_SHADOW_TYPE,2,'live macros stay intact');
assert.equal(J.stepJourneyPrime(),0);
assert.equal(J.journeyPrimePending(),0);

const flow=fs.readFileSync(path.join(S,'world-r1/WorldFlowComponent.ts'),'utf8');
const prime=fs.readFileSync(path.join(S,'region/JourneyShaderPrime.ts'),'utf8');
const preload=fs.readFileSync(path.join(S,'region/TransitionPreload.ts'),'utf8');
const adapter=fs.readFileSync(path.join(S,'region/RegionJourneyAdapter.ts'),'utf8');
const balloon=fs.readFileSync(path.join(S,'region/BalloonTransit.ts'),'utf8');
assert.equal(flow.includes('stepJourneyPrime'),false,'world update does not step a compile');
assert.doesNotMatch(prime,/getShaderVariant|tryCompile|withAssignMacros/);
assert.equal(preload.includes('__qfJourneyPrime'),false);
assert.ok(preload.includes("await preloadMeadowForSail(parent);"));
assert.equal(adapter.includes('__qfJourneyPrime'),false);
assert.ok(balloon.includes('armFlightShaderPrime'),'balloon takeoff prime stays');
assert.equal(balloon.includes('__qfJourneyPrime'),false);
assert.match(fs.readFileSync(path.join(S,'region/TransitionShaderWarm.ts'),'utf8'),/TRANSITION_SHADER_WARM_ENABLED\s*=\s*false/);

console.log(JSON.stringify({legacySteadyCalls:legacySteady,fixedSteadyCalls:fixedSteady,bootFrames:BOOT,steadyFrames:STEADY,key:KEY}));
console.log('PASS qf-sync-steady');
