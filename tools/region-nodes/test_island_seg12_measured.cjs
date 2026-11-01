#!/usr/bin/env node
'use strict';
/**
 * b20 seg1+seg2 MEASURED (场景设计部, Grok Bot): islandToMeadow = seg1+seg2 <= 42.5 s with the island walk I4>I6 taken from the real
 * NodeWalker plan on the baked graph (region/NodeWalker.ts planWalk + visibleSeconds at WALK_SPEED_MPS 1.2), not from the
 * TRANSITION_DURATIONS table entry seg1.nodeWalkI4toI6. Every other beat (dock walk, gangway, sit, settle, stand, off boat,
 * jetty→M1) is the production table value, and the total is the production transitionTimeline() fed with the measured walk.
 * Negative self-test: the same sum with a walk 0.1 s over the remaining budget must FAIL.
 */
const assert=require('node:assert/strict');const {load}=require('./load.cjs');
const W=load('region/NodeWalker.ts'),ST=load('region/TransitionStaging.ts'),N=load('region/RegionNodes.ts');
const LIMIT=42.5;
const plan=W.planWalk('island','I4','I6');assert.ok(!plan.cut,'I4>I6 must be one continuous walk');
const walkS=W.visibleSeconds(plan),edge=N.REGION_NODES.island.edges.find(e=>e.a==='I4'&&e.b==='I6'),polyS=W.pathLength(edge.path)/W.WALK_SPEED_MPS;
assert.ok(Math.abs(walkS-polyS)<1e-6,'walk seconds = baked polyline / 1.2 ('+walkS+' vs '+polyS+')');
const seg12=w=>{const D=JSON.parse(JSON.stringify(ST.TRANSITION_DURATIONS));D.seg1.nodeWalkI4toI6=w;const t=ST.transitionTimeline(D).totals;return {seg1:t.seg1,seg2:t.seg2,sum:+(t.seg1+t.seg2).toFixed(3)};};
const m=seg12(walkS),table=seg12(ST.TRANSITION_DURATIONS.seg1.nodeWalkI4toI6);
// negative self-test: a walk that overruns the budget by 0.1 s must exceed the limit
{const bad=seg12(walkS+(LIMIT-m.sum)+0.1);assert.ok(bad.sum>LIMIT,'self-test: over-budget walk not caught ('+bad.sum+')');console.log('self-test walk +'+(LIMIT-m.sum+0.1).toFixed(2)+' s -> seg1+seg2',bad.sum,'> '+LIMIT+' FAIL as expected');}
console.log(JSON.stringify({I4I6:{lengthM:+W.pathLength(edge.path).toFixed(3),walkS:+walkS.toFixed(3)},seg1:m.seg1,seg2:m.seg2,seg1PlusSeg2:m.sum,limit:LIMIT,tableWalkS:ST.TRANSITION_DURATIONS.seg1.nodeWalkI4toI6,tableSum:table.sum}));
assert.ok(m.sum<=LIMIT,'seg1+seg2 measured '+m.sum+' s > '+LIMIT);
console.log('island-seg12-measured PASS',m.sum,'s <=',LIMIT);
