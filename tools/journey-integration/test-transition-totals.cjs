'use strict';
// full9c transition totals (Grok Bot): island→meadow ≤45 s, meadow→skycity ≤50 s, skycity→lakeside ≤50 s, computed from the
// runtime data (TransitionStaging.transitionTimeline with the real lakeside walk lakeWalkS()). A total over its cap fails;
// self-check: the same computation on a copy with a beat stretched past the cap must fail.
const assert=require('node:assert/strict'),path=require('node:path');
const root=process.env.QF_JOURNEY_SOURCE_ROOT||path.resolve(__dirname,'../..');
const H=require('../board-ui/harness.cjs').createHarness();
const TS=H.load(root+'/creator-build-project/assets/scripts/region/TransitionStaging.ts');
const CAPS={islandToMeadow:45,meadowToSkycity:50,skycityToLakeside:50};
const check=D=>{const t=TS.transitionTimeline(D,{lakeWalkS:TS.lakeWalkS()}).totals;return Object.entries(CAPS).map(([k,cap])=>({leg:k,totalS:t[k],capS:cap,ok:Number.isFinite(t[k])&&t[k]<=cap}));};
const rows=check(TS.TRANSITION_DURATIONS);console.log(JSON.stringify({test:'transition-totals',rows}));
const D=TS.TRANSITION_DURATIONS,over=k=>{const c=JSON.parse(JSON.stringify(D));return c;};
const m1=over();m1.seg2.jettyToM1+=60;const m2=over();m2.seg3.flight+=60;const m3=over();m3.seg5a.flight+=60;
assert.ok(!check(m1).find(r=>r.leg==='islandToMeadow').ok,'self-check: stretched island→meadow not caught');
assert.ok(!check(m2).find(r=>r.leg==='meadowToSkycity').ok,'self-check: stretched meadow→skycity not caught');
assert.ok(!check(m3).find(r=>r.leg==='skycityToLakeside').ok,'self-check: stretched skycity→lakeside not caught');
for(const r of rows)assert.ok(r.ok,`${r.leg} ${r.totalS} s > ${r.capS} s`);
console.log('transition-totals: PASS');
