'use strict';
// Grok Bot (b20 + island rebake 05702f02): islandToMeadow seg1+seg2 ≤ 42.5 s, MEASURED.
// Definition used (TransitionStaging.ts TRANSITION_DURATIONS comment, "islandToMeadow cap … counts seg1+seg2 only"): seg1 = I4→I6 node walk
// + dock walk + gangway + sit down; seg2 = dock settle + stand up + off boat + jetty→M1 walk; the sail ride clock is NOT part of it.
// Measured: the I4→I6 walk is the REAL planner on the baked island nodes (NodeWalker.planWalk('island','I4','I6') → visibleSeconds, i.e.
// path length / WALK_SPEED_MPS, speed untouched); jetty→M1 = its documented meadow polyline 24.266 m / WALK_SPEED_MPS (meadow not touched
// by the rebake; checked against the table). Totals through the production transitionTimeline(). Negative self-test: a walk 3 s longer
// (the pre-b20 15.6 s I4→I6) must exceed the budget.
const assert=require('node:assert/strict'),{load}=require('./load.cjs');
const W=load('region/NodeWalker.ts'),TS=load('region/TransitionStaging.ts'),D=TS.TRANSITION_DURATIONS,CAP=42.5;
assert.equal(W.WALK_SPEED_MPS,1.2,'walking speed unchanged (1.2 m/s)');
const plan=W.planWalk('island','I4','I6'),walk=W.visibleSeconds(plan),len=plan.segments.reduce((s,x)=>s+W.pathLength(x.path),0);
assert(Math.abs(walk-(plan.cut?walk:len/W.WALK_SPEED_MPS))<1e-6,'walk seconds = path length / walk speed');
const jetty=24.266/W.WALK_SPEED_MPS;assert(Math.abs(jetty-D.seg2.jettyToM1)<0.01,'jetty→M1 table = 24.266 m / speed');
const total=D2=>TS.transitionTimeline(D2).totals;
const M={...D,seg1:{...D.seg1,nodeWalkI4toI6:walk},seg2:{...D.seg2,jettyToM1:jetty}},t=total(M);
const seg12=+(t.seg1+t.seg2).toFixed(3);
assert(seg12<=CAP,`islandToMeadow seg1+seg2 measured ${seg12} s > ${CAP} s`);
const neg=total({...M,seg1:{...M.seg1,nodeWalkI4toI6:15.6}});assert(neg.seg1+neg.seg2>CAP,'negative: the pre-b20 15.6 s I4→I6 walk must exceed the cap ('+(neg.seg1+neg.seg2).toFixed(2)+')');
const tab=total(D);
console.log(`PASS islandToMeadow seg1+seg2 measured ${seg12} s ≤ ${CAP} s (seg1 ${t.seg1.toFixed(3)} incl. I4→I6 walk ${walk.toFixed(3)} s / ${len.toFixed(3)} m${plan.cut?' cut':''}, seg2 ${t.seg2.toFixed(3)}); table value ${(tab.seg1+tab.seg2).toFixed(3)} s (nodeWalkI4toI6 ${D.seg1.nodeWalkI4toI6})`);
console.log(`PASS negative self-test: 15.6 s I4→I6 → ${(neg.seg1+neg.seg2).toFixed(2)} s > ${CAP}`);
