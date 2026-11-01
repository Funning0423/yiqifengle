#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||require('../qf-env.cjs').typescript());
const S=path.resolve(__dirname,'../../creator-build-project/assets/scripts');
function load(rel,req){const file=path.join(S,rel);const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;const m={exports:{}};vm.runInNewContext(js,{module:m,exports:m.exports,require:req,console},{filename:file});return m.exports;}
const layout=load('region/RegionJourneyLayout.ts',()=>({}));
const leg=load('region/TransportLeg.ts',spec=>spec.includes('Layout')?layout:{});
const audio=load('region/TransitAudioHooks.ts',()=>({}));
const bg=load('region/TransitBackdrop.ts',()=>({}));
for(const wall of [0,5,60,600]){
 const clock=leg.createSailClock();
 const t0=clock.t;clock.hide(wall);assert.equal(clock.t,t0,'hidden '+wall+' did not move the timeline');
 clock.show(0.1);assert(Math.abs(clock.t-0.1)<1e-9,'resumes in place');
 if(wall>30)assert.equal(clock.fade,0.35);else assert.equal(clock.fade,0);
}
const killed=leg.sailResumeAfterKill(4);
assert.equal(killed.atSea,false);assert.equal(killed.region,'meadow');assert.equal(killed.board,'mainline-05');
assert.equal(leg.sailResumeAfterKill(2).atSea,false);
audio.resetTransitCues();
const heard=[];audio.onTransitCue((c)=>heard.push(c));
audio.setTransitHidden(true);audio.emitTransit('sail-cruise-loop-start',{t:1,region:'meadow'});
assert.deepEqual(heard,[]);
audio.setTransitHidden(false);assert.deepEqual(heard,['sail-cruise-loop-start']);
assert.equal(bg.vehicleNightScale(true),0.6);assert.equal(bg.vehicleNightScale(false),1);
const day=bg.transitScene([0,4,0],[0,0,0],0,[0,1,40],false).filter(m=>m.tag==='dome');
const night=bg.transitScene([0,4,0],[0,0,0],0,[0,1,40],true).filter(m=>m.tag==='dome');
assert.equal(day.length,1);assert.equal(night.length,1);assert.notEqual(day[0].name,night[0].name);
console.log(JSON.stringify({status:'PASS',hides:[0,5,60,600],kill:killed}));
void fs;
