#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),vm=require('node:vm');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||require('../qf-env.cjs').typescript());
const S=path.resolve(__dirname,'../../creator-build-project/assets/scripts');
const boot=fs.readFileSync(path.join(S,'WorldIntegrationBoot.ts'),'utf8');
const section=boot.slice(boot.indexOf('class FlowReferenceStandin'),boot.indexOf("@ccclass('WorldIntegrationBoot')"));
assert(!/setWorldPosition/.test(section.split('private advanceStep')[1].split("if(j.action.kind==='walk')")[0]),'advanceStep does not move the root before the job switch');
const sit=section.slice(section.indexOf("else if(j.action.kind==='stand'||j.action.kind==='sit')"),section.indexOf('if((!j||j.foldS>0)&&this.stopRoot'));
assert(/setWorldPosition/.test(sit),'sit job writes the seat captured at perform(), while the hull is still');
const after=section.slice(section.indexOf('if(j&&j.elapsed===j.duration)'));
assert(/kind==='sit'\)this\.playNamed\(CLIP_ROLES\.sitHold/.test(after),'sit resolves into sit_hold and drops the job');
assert(!/setWorldPosition/.test(after.slice(0,after.indexOf('private idleGustTick'))),'sit_hold has no per-frame world write');
const tsLoad=rel=>{const file=path.join(S,rel);const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;const m={exports:{}};vm.runInNewContext(js,{module:m,exports:m.exports,require:()=>({}),console},{filename:file});return m.exports;};
const layout=tsLoad('region/RegionJourneyLayout.ts');
const leg=(()=>{const file=path.join(S,'region/TransportLeg.ts');const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;const m={exports:{}};vm.runInNewContext(js,{module:m,exports:m.exports,require:spec=>spec.includes('Layout')?layout:{},console},{filename:file});return m.exports;})();
let moved=0;const parent={x:0,z:0},local={x:0,y:0.02,z:0.05};
for(let i=0;i<30*60;i++){parent.z+=50/(30*60);moved=Math.hypot(parent.x+local.x,local.y,parent.z+local.z);}
const err=Math.abs(Math.hypot(local.x,local.y,50+local.z)-moved);
assert(err<=0.01,'error m '+err);
assert(leg.parentingErrorM(50)<=0.01);
const t0=process.hrtime.bigint();
for(let i=0;i<1000;i++)leg.seatFromBench([i,0,0],0.2);
const us=Number(process.hrtime.bigint()-t0)/1000/1000;
console.log(JSON.stringify({status:'PASS',mode:'parent-after-sit_hold',errorM:err,fallbackResetUs:us,fallbackNeeded:false}));
