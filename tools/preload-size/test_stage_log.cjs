'use strict';
// stage-log ok flag + gate selftest with the Mac dedf8853 numbers (tint1-3). Runs the REAL TransitionChain.stageOk and check-stage-log.
const assert=require('assert'),{createHarness}=require('../board-ui/harness.cjs'),{stageOk,MEADOW_LEG_STAGES,SKY_LEG_STAGES}=createHarness().load('region/TransitionChain');
const {parse,verdict}=require('./check-stage-log.cjs');
const B=Object.fromEntries([...MEADOW_LEG_STAGES,...SKY_LEG_STAGES].map(s=>[s.id,s.ms]));
// budgets are what the dedf8853 run logged (no budget raised or loosened)
assert.equal(B['split:env_meadow'],1200);assert.equal(B['bundle:transport_sail'],400);assert.equal(B['mount:meadow-warm-rig'],700);assert.equal(B['bundle:region_skycity'],1800);
const mac=[['split:env_meadow',[32304,31634,31116]],['bundle:transport_sail',[783,861,1048]],['mount:meadow-warm-rig',[1572,1638,1764]]];
for(const [id,list] of mac)for(const ms of list)assert.equal(stageOk(true,ms,B[id]),false,id+' '+ms+' must be ok:false');
assert.equal(stageOk(true,965,1800),true);assert.equal(stageOk(true,700,700),true);assert.equal(stageOk(false,10,700),false);assert.equal(stageOk(true,NaN,700),false);
// the exact dedf8853 lines (logged ok:true) must FAIL the gate; a clean set PASSes
const L=(o)=>'2026-10-30T07:07:47.500Z info [QF_PRELOAD_STAGE] '+JSON.stringify(o);
const old=[L({target:'meadow',stage:'bundle:region_meadow',ms:965,budgetMs:1800,frameMaxMs:494,ok:true}),L({target:'meadow',stage:'bundle:transport_sail',ms:861,budgetMs:400,frameMaxMs:64,ok:true}),
 L({target:'meadow',stage:'split:env_meadow',ms:32304,budgetMs:1200,frameMaxMs:850,ok:true}),L({target:'meadow',stage:'prefab:env_meadow',ms:40,budgetMs:450,frameMaxMs:24,ok:true}),
 L({target:'meadow',stage:'mount:meadow-warm-rig',ms:1638,budgetMs:700,frameMaxMs:259,ok:false})].join('\n');
const f=verdict(parse(old));assert.equal(f.length,3,JSON.stringify(f));
for(const id of ['bundle:transport_sail','split:env_meadow','mount:meadow-warm-rig'])assert.ok(f.some(x=>x.includes(id)),id+' not failed');
assert.deepEqual(verdict(parse(L({target:'skycity',stage:'bundle:region_skycity',ms:1700,budgetMs:1800,loaded:true,ok:true}))),[]);
assert.equal(verdict(parse(L({target:'skycity',stage:'bundle:region_skycity',ms:1801,budgetMs:1800,loaded:true,ok:false}))).length,1,'skycity 1800 ms budget must fail at 1801');
console.log('stage-log-selftest: PASS (dedf8853: split 31-32 s/1200, transport_sail 783-1048/400, warm-rig 1572-1764/700 -> FAIL)');
