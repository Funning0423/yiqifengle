'use strict';
/**
 * Standup-only COUNT53 program warm (independent of TransitionShaderWarm).
 * Gates: zero TSW import/burst; COUNT53 skin+morph queue; multi-frame step; MorphDriver budget.
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
assert.match(warmSrc,/STANDUP_MORPH_COUNT\s*=\s*53/);
assert.match(warmSrc,/STANDUP_WARM_PER_FRAME/);

/* TSW must stay free of standup program warm / burst wiring */
assert.doesNotMatch(tswSrc,/StandupProgramWarm/);
assert.doesNotMatch(tswSrc,/armStandupProgramWarm/);
assert.doesNotMatch(tswSrc,/\barmStandupShaderBurst\s*\(|export\s+function\s+armStandupShaderBurst/);
assert.doesNotMatch(tswSrc,/warmSampleStandUp/);

/* Boot wires standalone warm; still no TSW burst; warmSample stays off bindVisual */
assert.match(bootSrc,/armStandupProgramWarm/);
assert.match(bootSrc,/stepStandupProgramWarm/);
assert.match(bootSrc,/flushStandupProgramWarmBeforeStand/);
assert.match(bootSrc,/standupMorphBudgetLeft/);
assert.doesNotMatch(bootSrc,/\barmStandupShaderBurst\s*\(/);
const bindSnip=bootSrc.slice(bootSrc.indexOf('bindVisual(visual:Node)'),bootSrc.indexOf('private requireClip'));
assert.doesNotMatch(bindSnip,/warmSampleStandUp/,'warmSample must NOT run in bindVisual');
assert.match(bindSnip,/armStandupProgramWarm/);
assert.doesNotMatch(balloonSrc,/StandupProgramWarm|armStandupProgramWarm|warmSampleStandUp/);

/* MorphDriver budget API */
assert.match(cmSrc,/apply\(w:\{\[target:string\]:number\},maxCalls\?:number\)/);
assert.match(cmSrc,/起身段无整表清零重写/);
assert.match(cmSrc,/MORPH_EPS/);

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
assert.equal(W.STANDUP_MORPH_COUNT,53);
assert.equal(W.STANDUP_WARM_PER_FRAME,2);

W.resetStandupProgramWarm();
const syn=W.buildStandupWarmQueueSynthetic();
assert.ok(syn.length>=6,'synthetic queue');
assert.ok(syn.every(j=>Number(j.defines.CC_MORPH_TARGET_COUNT)===53&&j.defines.CC_USE_SKINNING&&j.defines.CC_USE_MORPH));

const arm=W.armStandupProgramWarm(null);
assert.equal(arm.armed,true);
assert.equal(arm.count53,true);
assert.ok(arm.pending>=6);

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
assert.ok(fakeLib.calls.some(c=>Number(c.defines.CC_MORPH_TARGET_COUNT)===53));
assert.ok(fakeLib.calls.some(c=>c.defines.CC_USE_SKINNING===true&&c.defines.CC_USE_MORPH===true));

/* flush before stand only takes a couple */
W.resetStandupProgramWarm();
W.armStandupProgramWarm(null);
const before=fakeLib.calls.length;
const fl=W.flushStandupProgramWarmBeforeStand(2);
assert.ok(fl.warmed<=2);
assert.ok(fakeLib.calls.length-before<=2);

/* MorphDriver maxCalls */
const motion={};
vm.runInNewContext(tx(fs.readFileSync(path.join(S,'CharacterMotion.ts'),'utf8')),{exports:motion,Math,Float64Array,RegExp,Object,Array,String,Number,isFinite,Error});
const targets={a:0,b:1,c:2,d:3,e:4,f:5};
const calls=[];
const renderer={node:{name:'apron'},mesh:{name:'apron',struct:{morph:{subMeshMorphs:[{targets:new Array(8).fill(0)}],targetNames:[]}}},enableMorph:true,
  setWeight(w,sub,shape){calls.push([w,sub,shape]);}};
const md=new motion.MorphDriver('apron',targets);
assert.equal(md.bind([renderer]),'ok');
const n1=md.apply({a:1,b:1,c:1,d:1,e:1,f:1},2);
assert.equal(n1,2,'budget 2 → 2 setWeight (1 target × 1 subMesh? wait subMeshes)');
// one subMesh → each target costs 1 call; budget 2 → 2 targets
assert.equal(calls.length,2);
const n2=md.apply({a:1,b:1,c:1,d:1,e:1,f:1},4);
assert.ok(n2>=1&&calls.length<=6);

const out={
  status:'PASS',
  gate:'standup-program-warm-count53',
  isolation:{TransitionShaderWarm:false,armStandupShaderBurst:false,BalloonTransit:false},
  synthetic:syn.length,
  spreadSteps:steps,
  warmed:after.warmed,
  libCalls:fakeLib.calls.length,
  morphBudget:{first:n1,second:n2,totalCalls:calls.length},
  acceptance:'standup feel — NOT setCamera/board=0 veto',
  stackNote:'may stack anim tip that culls mesh COUNT53 morph targets (curves-only cull already falsified)',
};
console.log(JSON.stringify(out,null,1));
