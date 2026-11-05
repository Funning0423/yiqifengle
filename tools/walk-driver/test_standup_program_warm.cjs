'use strict';
/**
 * Standup-only COUNT16/15/3 program warm (independent of TransitionShaderWarm).
 * Gates: zero TSW import/burst; APRON16/DRESS15/BODY15/BOW3 bag; multi-frame step; MorphDriver budget.
 */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'..','..');
const S=path.join(ROOT,'creator-build-project/assets/scripts');
const ts=process.env.QF_TYPESCRIPT_MODULE?require(process.env.QF_TYPESCRIPT_MODULE):require('../qf-env.cjs').typescript();
const tx=src=>ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;

const warmSrc=fs.readFileSync(path.join(S,'region/StandupProgramWarm.ts'),'utf8');
const tswSrc=fs.readFileSync(path.join(S,'region/TransitionShaderWarm.ts'),'utf8');
const bootSrc=fs.readFileSync(path.join(S,'WorldIntegrationBoot.ts'),'utf8');
const cmSrc=fs.readFileSync(path.join(S,'CharacterMotion.ts'),'utf8');
const adSrc=fs.readFileSync(path.join(S,'region/RegionJourneyAdapter.ts'),'utf8');
const balloonSrc=fs.readFileSync(path.join(S,'region/BalloonTransit.ts'),'utf8');

/* Isolation: StandupProgramWarm never touches TSW */
assert.doesNotMatch(warmSrc,/from\s+['"]\.\/TransitionShaderWarm['"]/);
assert.doesNotMatch(warmSrc,/\barmStandupShaderBurst\s*\(|export\s+function\s+armStandupShaderBurst/);
assert.doesNotMatch(warmSrc,/\bbeginTransitionShaderWarm\s*\(|\bholdTransitionShaders\s*\(|\bresetTransitionShaderWarm\s*\(/);
assert.match(warmSrc,/getProgramVariant/);
assert.match(warmSrc,/CC_MORPH_TARGET_COUNT/);
assert.match(warmSrc,/STANDUP_MORPH_APRON\s*=\s*16/);
assert.match(warmSrc,/STANDUP_MORPH_DRESS\s*=\s*15/);
assert.match(warmSrc,/STANDUP_MORPH_BODY\s*=\s*15/);
assert.match(warmSrc,/STANDUP_MORPH_BOW\s*=\s*3/);
assert.match(warmSrc,/STANDUP_MORPH_COUNTS/);
assert.match(warmSrc,/STANDUP_MORPH_COUNT\s*=\s*STANDUP_MORPH_APRON/);
assert.doesNotMatch(warmSrc,/STANDUP_MORPH_COUNT\s*=\s*53/);
assert.doesNotMatch(warmSrc,/CC_MORPH_TARGET_COUNT53/);
assert.doesNotMatch(warmSrc,/CC_MORPH_TARGET_COUNT73/);
assert.match(warmSrc,/STANDUP_WARM_PER_FRAME/);

/* TSW must stay free of standup program warm / burst wiring */
assert.doesNotMatch(tswSrc,/StandupProgramWarm/);
assert.doesNotMatch(tswSrc,/armStandupProgramWarm/);
assert.doesNotMatch(tswSrc,/\barmStandupShaderBurst\s*\(|export\s+function\s+armStandupShaderBurst/);
assert.doesNotMatch(tswSrc,/warmSampleStandUp/);

/* Boot wires sit_hold window gate; still no TSW burst; warmSample stays off bindVisual */
assert.match(bootSrc,/openStandupWarmWindow/);
assert.match(bootSrc,/closeStandupWarmWindow/);
assert.match(bootSrc,/standupWarmWindowOpen/);
assert.match(bootSrc,/stepStandupProgramWarm/);
assert.match(bootSrc,/flushStandupProgramWarmBeforeStand/);
assert.match(bootSrc,/standupMorphBudgetLeft/);
assert.doesNotMatch(bootSrc,/\barmStandupShaderBurst\s*\(/);
const bindSnip=bootSrc.slice(bootSrc.indexOf('bindVisual(visual:Node)'),bootSrc.indexOf('private requireClip'));
assert.doesNotMatch(bindSnip,/warmSampleStandUp/,'warmSample must NOT run in bindVisual');
assert.match(bindSnip,/openStandupWarmWindow/);
assert.doesNotMatch(balloonSrc,/StandupProgramWarm|armStandupProgramWarm|openStandupWarmWindow|warmSampleStandUp/);

/* MorphDriver budget + sparse morphWeights + GPU enableMorph gate */
assert.match(cmSrc,/apply\(w:\{\[target:string\]:number\},maxCalls\?:number\)/);
assert.match(cmSrc,/起身段无整表清零重写/);
assert.match(cmSrc,/MORPH_EPS/);
assert.match(cmSrc,/morphActiveTargets/);
assert.match(cmSrc,/syncGpuGate/);
assert.match(cmSrc,/enableMorph/);
assert.match(cmSrc,/applyRendererMorphGate/);
assert.match(cmSrc,/_watchMorphInMesh/);
assert.match(cmSrc,/setMorphRendering/);
assert.match(cmSrc,/mesh-reassign/);
assert.match(warmSrc,/STANDUP_PROGRAM_WARM_ENABLED/);
assert.match(warmSrc,/windowOpen/);
assert.match(warmSrc,/openStandupWarmWindow/);
assert.match(warmSrc,/closeStandupWarmWindow/);

/* Load module under mock cc */
const fakeDirector={getScene:()=>null,root:{device:{id:'mock-device'},pipeline:{macros:{}}}};
const fakeLib={
  pipeline:{macros:{}},
  calls:[],
  getProgramVariant(device,phase,name,defines){
    this.calls.push({device,phase,name,defines:Object.assign({},defines)});
    const parts=[name];
    const keys=Object.keys(defines||{}).sort();
    for(const k of keys){const v=defines[k];if(v===0||v===false||v===undefined)continue;parts.push(k+(v===true||v===1?'1':String(v)));}
    return {name:parts.join('|')};
  },
};
const ccStub={
  Node:function Node(){this.children=[];this.components=[];},
  director:fakeDirector,
  isValid:()=>true,
  legacyCC:{programLib:fakeLib,rendering:{programLib:fakeLib}},
  cclegacy:{programLib:fakeLib},
};
const exportsObj={};
vm.runInNewContext(tx(warmSrc),{
  exports:exportsObj,require:(m)=>{if(m==='cc')return ccStub;throw new Error('unexpected '+m);},
  console,Math,Object,Array,String,Number,Boolean,Error,globalThis:{cc:ccStub,CC:ccStub,legacyCC:ccStub},
});
const W=exportsObj;
assert.equal(W.STANDUP_MORPH_APRON,16);
assert.equal(W.STANDUP_MORPH_DRESS,15);
assert.equal(W.STANDUP_MORPH_BODY,15);
assert.equal(W.STANDUP_MORPH_BOW,3);
assert.deepEqual([...W.STANDUP_MORPH_COUNTS],[16,15,3]);
assert.equal(W.STANDUP_MORPH_COUNT,16);
assert.equal(W.STANDUP_WARM_PER_FRAME,2);

W.resetStandupProgramWarm();
const syn=W.buildStandupWarmQueueSynthetic();
assert.ok(syn.length>=8,'synthetic queue');
const counts=new Set(syn.map(j=>Number(j.defines.CC_MORPH_TARGET_COUNT)));
assert.ok(counts.has(16)&&counts.has(15)&&counts.has(3),'bag must cover 16/15/3 got '+[...counts]);
assert.ok(syn.every(j=>j.defines.CC_USE_SKINNING&&j.defines.CC_USE_MORPH));
assert.ok(syn.every(j=>[16,15,3].includes(Number(j.defines.CC_MORPH_TARGET_COUNT))));
assert.ok(!syn.some(j=>Number(j.defines.CC_MORPH_TARGET_COUNT)===53||Number(j.defines.CC_MORPH_TARGET_COUNT)===73),'must NOT warm legacy 53/73');

/* arm alone does NOT open window — step must no-op (walk/UI leak guard) */
const armedOnly=W.armStandupProgramWarm(null);
assert.equal(armedOnly.armed,true);
assert.equal(armedOnly.windowOpen,false);
assert.equal(armedOnly.bagReady,true);
assert.equal(armedOnly.count53,false);
const leakCalls=fakeLib.calls.length;
const noop=W.stepStandupProgramWarm(W.STANDUP_WARM_PER_FRAME);
assert.equal(noop.warmed,0,'step without window must not compile');
assert.equal(fakeLib.calls.length,leakCalls,'no getProgramVariant outside sit_hold window');

/* open window → multi-frame spread */
const arm=W.openStandupWarmWindow(null);
assert.equal(arm.armed,true);
assert.equal(arm.windowOpen,true);
assert.equal(arm.bagReady,true);
assert.ok(arm.pending>=8);

const per=W.STANDUP_WARM_PER_FRAME;
let steps=0,prevPending=arm.pending;
while(steps<W.STANDUP_WARM_MAX_FRAMES+2){
  const st=W.stepStandupProgramWarm(per);
  steps++;
  assert.ok(st.pending<=prevPending,'pending must not grow');
  prevPending=st.pending;
  if(st.pending===0)break;
}
assert.ok(steps>=3&&steps<=W.STANDUP_WARM_MAX_FRAMES+1,'spread across frames got '+steps);
const after=W.standupProgramWarmStats();
assert.ok(after.warmed>=4,'warmed via getProgramVariant got '+after.warmed);
assert.ok(fakeLib.calls.length>=4,'lib calls '+fakeLib.calls.length);
assert.ok(fakeLib.calls.some(c=>Number(c.defines.CC_MORPH_TARGET_COUNT)===16));
assert.ok(fakeLib.calls.some(c=>Number(c.defines.CC_MORPH_TARGET_COUNT)===15));
assert.ok(fakeLib.calls.some(c=>c.defines.CC_USE_SKINNING===true&&c.defines.CC_USE_MORPH===true));
assert.ok(!fakeLib.calls.some(c=>Number(c.defines.CC_MORPH_TARGET_COUNT)===53));

/* close → disarm; further step no-op */
W.closeStandupWarmWindow();
const closed=W.standupProgramWarmStats();
assert.equal(closed.windowOpen,false);
assert.equal(closed.armed,false);
assert.equal(closed.pending,0);
const afterCloseCalls=fakeLib.calls.length;
W.stepStandupProgramWarm(per);
assert.equal(fakeLib.calls.length,afterCloseCalls);

/* flush before stand only takes a couple (force-opens window) */
W.resetStandupProgramWarm();
W.armStandupProgramWarm(null); // armed but window closed
const before=fakeLib.calls.length;
const fl=W.flushStandupProgramWarmBeforeStand(2);
assert.ok(fl.warmed<=2);
assert.ok(fakeLib.calls.length-before<=2);
assert.equal(fl.windowOpen,true);

/* MorphDriver maxCalls + GPU gate (real tear-down, not flag-only) */
const motion={};
vm.runInNewContext(tx(fs.readFileSync(path.join(S,'CharacterMotion.ts'),'utf8')),{exports:motion,Math,Float64Array,RegExp,Object,Array,String,Number,isFinite,Error});
const targets={a:0,b:1,c:2,d:3,e:4,f:5};
const calls=[];
const watchLog=[];
const morphSetLog=[];
const model={_morph:Object,setMorphRendering(inst){morphSetLog.push(inst);this._morph=inst;},onMacroPatchesChanged(){morphSetLog.push('patches');}};
const renderer={node:{name:'apron'},mesh:{name:'apron',struct:{morph:{subMeshMorphs:[{targets:new Array(8).fill(0)}],targetNames:[]}}},enableMorph:true,
  _morphInstance:{id:'live'},model,
  _watchMorphInMesh(){watchLog.push(this.enableMorph);if(this.enableMorph===false){this._morphInstance=null;}else{this._morphInstance={id:'live'};if(this.model)this.model.setMorphRendering(this._morphInstance);}},
  setWeight(w,sub,shape){calls.push([w,sub,shape]);}};
const md=new motion.MorphDriver('apron',targets);
assert.equal(md.bind([renderer]),'ok');
const n1=md.apply({a:1,b:1,c:1,d:1,e:1,f:1},2);
assert.equal(n1,2,'budget 2 → 2 setWeight');
assert.equal(calls.length,2);
assert.equal(renderer.enableMorph,true,'live weights keep enableMorph');
const n2=md.apply({a:1,b:1,c:1,d:1,e:1,f:1},4);
assert.ok(n2>=1&&calls.length<=6);
// drain remaining then zero → GPU unload (watch + clear MorphModel)
md.apply({a:1,b:1,c:1,d:1,e:1,f:1});
const flipsBefore=md.gateFlips;
md.apply({a:0,b:0,c:0,d:0,e:0,f:0});
assert.equal(renderer.enableMorph,false,'all-zero tips unload enableMorph (idle/walk DRESS/BOW)');
assert.ok(md.gateFlips>flipsBefore,'gateFlips increments');
assert.ok(watchLog.indexOf(false)>=0,'_watchMorphInMesh ran on unload');
assert.equal(renderer._morphInstance,null,'morph instance destroyed');
assert.ok(morphSetLog.indexOf(null)>=0,'setMorphRendering(null) on unload');
assert.equal(md.diagnostics().gpuGateOn,false);
assert.equal(md.diagnostics().gatePath,'watch');
// steady zero early-return does not re-watch
const watchN=watchLog.length;md.apply({a:0,b:0,c:0,d:0,e:0,f:0});
assert.equal(watchLog.length,watchN,'steady zero skips tip walk / re-watch');
md.apply({a:0.5,b:0,c:0,d:0,e:0,f:0});
assert.equal(renderer.enableMorph,true,'non-zero re-enables before setWeight (standup window)');
assert.ok(renderer._morphInstance,'morph instance recreated');
assert.equal(md.diagnostics().gpuGateOn,true);
// STRIP fallback path when _watchMorphInMesh missing
const meshAssign=[];
const r2={node:{name:'dress'},mesh:{name:'dress',struct:{morph:{subMeshMorphs:[{targets:new Array(4).fill(0)}],targetNames:[]}}},enableMorph:true,_morphInstance:{id:'x'},
  model:{setMorphRendering(inst){this.last=inst;},onMacroPatchesChanged(){}},
  set mesh(v){this._mesh=v;meshAssign.push(this.enableMorph);if(this.enableMorph===false)this._morphInstance=null;else this._morphInstance={id:'x'};},
  get mesh(){return this._mesh||{name:'dress',struct:{morph:{subMeshMorphs:[{targets:new Array(4).fill(0)}]}}};},
  setWeight(){}};
r2._mesh=r2.mesh;
const md2=new motion.MorphDriver('dress',{a:0,b:1});
assert.equal(md2.bind([r2]),'ok');
md2.apply({a:1,b:0});md2.apply({a:0,b:0});
assert.equal(r2.enableMorph,false);
assert.ok(meshAssign.indexOf(false)>=0,'STRIP fallback mesh-reassign on unload');
assert.equal(md2.diagnostics().gatePath,'mesh-reassign');
// kill switch
assert.equal(typeof W.setStandupProgramWarmEnabled,'function');
W.resetStandupProgramWarm();
W.setStandupProgramWarmEnabled(false);
const disabled=W.openStandupWarmWindow(null);
assert.equal(disabled.windowOpen,false);
assert.equal(disabled.armed,false);
const killCalls=fakeLib.calls.length;
W.stepStandupProgramWarm(4);
assert.equal(fakeLib.calls.length,killCalls,'kill switch: step compiles nothing');
assert.equal(W.flushStandupProgramWarmBeforeStand(2).armed,false);
W.setStandupProgramWarmEnabled(true);

/* sparse morphWeights: walk only evaluates active curves, not full tip table */
const cfg=motion.defaultMotionConfig();
cfg.morphMeshes=[{mesh:'LOD0_G2_APRON',targets:{task21_walk_layer_gap:0,seat_bake_sit_0:1,sit_drape:2}},
  {mesh:'LOD0_G2_DRESS',targets:{seat_bake_sit_0:0,sit_drape:1,cloth_envelope_stand_up_0:2}}];
cfg.clips.walk_loop=Object.assign({},cfg.clips.walk_loop||{},{morph:{curves:{task21_walk_layer_gap:[[0,0.4],[1,0.4]]}}});
cfg.clips.sit_hold=Object.assign({},cfg.clips.sit_hold||{},{morph:{curves:{seat_bake_sit_0:[[0,1],[1,1]],sit_drape:[[0,1],[1,1]]}}});
const walkPlan={base:{clip:'walk_loop',time:0.2,loop:true},out:null,layers:[],morph:[]};
const active=motion.morphActiveTargets(cfg,walkPlan,0);
assert.deepEqual(Object.keys(active).sort(),['task21_walk_layer_gap']);
const bag={seat_bake_sit_0:1,sit_drape:1,task21_walk_layer_gap:0}; // leftover from sit
const wWalk=motion.morphWeights(cfg,walkPlan,0,bag);
assert.equal(wWalk.task21_walk_layer_gap,0.4);
assert.equal(wWalk.seat_bake_sit_0,0,'sit leftovers zeroed without curveAt');
assert.equal(wWalk.sit_drape,0);
const sitPlan={base:{clip:'sit_hold',time:0,loop:true},out:null,layers:[],morph:[]};
const wSit=motion.morphWeights(cfg,sitPlan,0,{});
assert.equal(wSit.seat_bake_sit_0,1);
assert.equal(wSit.sit_drape,1);
assert.ok(!Object.prototype.hasOwnProperty.call(motion.morphActiveTargets(cfg,sitPlan,0),'task21_walk_layer_gap'));

const out={
  status:'PASS',
  gate:'morph-drive-fps+standup-window',
  isolation:{TransitionShaderWarm:false,armStandupShaderBurst:false,BalloonTransit:false},
  bag:{APRON:16,DRESS:15,BODY:15,BOW:3,unique:[...W.STANDUP_MORPH_COUNTS]},
  synthetic:syn.length,
  syntheticCounts:[...counts].sort((a,b)=>a-b),
  spreadSteps:steps,
  warmed:after.warmed,
  libCalls:fakeLib.calls.length,
  windowGate:{armNoStep:true,closeDisarm:true},
  morphBudget:{first:n1,second:n2,totalCalls:calls.length},
  morphSparse:{walkActive:Object.keys(active),sitSeat:true},
  gpuGate:{unloadOnZero:true,reloadOnLive:true,watchTearDown:true,stripFallback:true,killSwitch:true},
  acceptance:'whole-UI FPS + standup feel — NOT setCamera/board=0 veto',
  stackNote:'pairs COUNT GLB e3fbce98 + meta 6fd22962; REAL enableMorph tear-down (_watchMorphInMesh/setMorphRendering); StandupProgramWarm kill switch A/B',
};
console.log(JSON.stringify(out,null,1));
