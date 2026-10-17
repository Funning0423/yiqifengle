#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),vm=require('node:vm');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||require('../qf-env.cjs').typescript());
const S=path.resolve(__dirname,'../../creator-build-project/assets/scripts');
function load(rel,sandboxRequire){
 const file=path.join(S,rel);
 const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 const m={exports:{}};
 vm.runInNewContext(js,{module:m,exports:m.exports,require:sandboxRequire,console}, {filename:file});
 return m.exports;
}
const layout=load('region/RegionJourneyLayout.ts',()=>({}));
const landing=load('region/SailLanding.ts',()=>({}));
const leg=load('region/TransportLeg.ts',spec=>spec.includes('RegionJourneyLayout')?layout:spec.includes('SailLanding')?landing:spec.includes('WorldFlowCore')?{}:{});
const route=leg.sailRoute();
const tl=leg.sailBeats(route.length);
const shore=leg.shoreWalkM();
assert(shore<=6.4,'shore walk '+shore);
assert(tl.build05S<=30.5,'build05 '+tl.build05S);
assert(tl.arrivalS<=12+1e-6,'arrival '+tl.arrivalS);
assert(tl.speed.cruiseS>=6,'cruise');
assert(leg.sailMaxAccel(tl.speed)<=2.7+1e-6,'accel '+tl.speed.aAcc+' '+tl.speed.aDec);
assert(tl.speed.aDec<=2.5+1e-6,'decel');
assert(route.minRadius>=25,'radius '+route.minRadius);
const yaw=leg.sailMaxYawRateDeg(tl,route.samples);
assert(yaw<=20,'yaw '+yaw);
const chord=leg.chordM();
assert(Math.abs(chord-52)<0.05,'chord '+chord);
const last=route.samples.slice(-Math.ceil(10/0.5));
const dx=Math.max(...last.map(p=>Math.abs(p[0]-last[last.length-1][0])));
assert(dx<0.35,'berth approach not straight '+dx);
assert(leg.parentingErrorM(50)<=0.01,'parent');
const killed=leg.sailResumeAfterKill(4);
assert.equal(killed.atSea,false);assert.equal(killed.board,'mainline-05');
console.log(JSON.stringify({status:'PASS',build05S:+tl.build05S.toFixed(3),arrivalS:+tl.arrivalS.toFixed(3),routeM:+route.length.toFixed(2),shoreM:+shore.toFixed(3),v:+tl.speed.v.toFixed(3),aAcc:+tl.speed.aAcc.toFixed(3),aDec:+tl.speed.aDec.toFixed(3),yaw:+yaw.toFixed(2),radius:+route.minRadius.toFixed(1),chord}));
