'use strict';
// board-kit-fallback-zero: BoardKit.kitFallback is counted and printed with the marker run-suite scans for; the scanner counts
// every trigger; the default kit never falls back on any of the 7 screens. Self-check: one forced fallback is seen (count 1).
const assert=require('node:assert/strict');const {createHarness}=require('./harness.cjs');const H=createHarness();
const K=H.load('ui/BoardKit'),L=H.load('ui/BoardLayout'),F=require('./board-kit-fallback.cjs');
assert.equal(K.KIT_FALLBACK_MARKER,F.MARKER,'marker drifted between BoardKit.ts and run-suite');
for(const [w,h] of [[390,844],[414,896],[360,780],[375,667],[320,568],[390,520],[768,1024]]){const l=L.boardLayout(w,h,{top:20,bottom:0,left:0,right:0,capsule:null});
 const g=K.kitGrid(K.boardKitFor(null),l);assert.equal(g.centers.length,49);assert.equal(g.projected,false);}
assert.equal(K.kitFallbackCount(),0,'default kit fell back');
const logs=[],warn=console.warn;console.warn=(...a)=>logs.push(a.join(' '));
try{K.kitGrid({...K.DEFAULT_KIT,id:'selftest',board:{anchor:[0,0,0],yawDeg:0,cellM:1,topY:0}},L.boardLayout(390,844,{top:47,bottom:34,left:0,right:0,capsule:null}));}finally{console.warn=warn;}
assert.equal(K.kitFallbackCount(),1,'forced fallback not counted');assert.equal(F.count(logs.join('\n')),1,'forced fallback not seen by the run-suite scanner');
assert.equal(F.count('x\n'+F.MARKER+' a\n'+F.MARKER+' b'),2);assert.equal(F.count(''),0);
console.log('ok   self-check: 1 forced fallback → counter 1, scanner 1 (run-suite would FAIL that test)');
console.log('board-kit-fallback-zero: PASS (default kit: 0 fallbacks on 7 screens)');
