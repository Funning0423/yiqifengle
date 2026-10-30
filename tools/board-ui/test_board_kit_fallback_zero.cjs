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
// D1/D2 config: coast kit piece order final, not registered in P0; camera distance per aspect only (pitch/FOV fixed)
assert.deepEqual([...K.COAST_KIT.pieceKeys],['conch','star','coral','float','scallop','badge'].map(n=>'board/piece_'+n));assert.equal(K.boardKitFor('coast'),K.DEFAULT_KIT,'coast kit must not be live in P0');
{const c=K.COAST_KIT.camera,a=K.kitCameraPose(c,390,844),b=K.kitCameraPose({...c,distanceByAspect:{'320:568':20}},320,568);
 const dir=p=>{const d=p.target.map((x,i)=>x-p.position[i]),n=Math.hypot(...d);return d.map(x=>x/n);};assert.ok(Math.abs(a.position[1]-16.178)<0.01,'r5d game camera y');assert.ok(Math.abs(Math.hypot(...b.position.map((x,i)=>x-b.target[i]))-20)<1e-9,'distance along the view line');
 assert.ok(dir(a).every((x,i)=>Math.abs(x-dir(b)[i])<1e-12)&&a.fovVerticalDeg===b.fovVerticalDeg,'a per-aspect distance changed the angle or FOV');}
console.log('ok   self-check: 1 forced fallback → counter 1, scanner 1 (run-suite would FAIL that test)');
console.log('board-kit-fallback-zero: PASS (default kit: 0 fallbacks on 7 screens)');
