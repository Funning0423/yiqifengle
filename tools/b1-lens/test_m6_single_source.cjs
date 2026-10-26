#!/usr/bin/env node
'use strict';
/** full8 P1-a: the balloon M6 anchor has ONE copy (BalloonFlight; BalloonTransit imports it); its delta to the walk-graph M6 is
 *  reported (decision pending); [QF_B1_PREWALK] logs meadow transform, her start, live c0 and plan.camera(0). */
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const R=path.join(__dirname,'../../creator-build-project/assets/scripts/region'),rd=f=>fs.readFileSync(path.join(R,f),'utf8');
const nodes=rd('RegionNodes.ts'),m=/\{key:"M6",region:"meadow",at:\[([-\d.,]+)\]/.exec(nodes);assert.ok(m,'graph M6');
const graphM6=m[1].split(',').map(Number);
const bt=rd('BalloonTransit.ts'),bf=rd('BalloonFlight.ts');
assert.match(bt,/import \{M6_LOCAL\} from '\.\/BalloonFlight'/,'BalloonTransit imports the one M6');
const a=/export const M6_LOCAL:Vec=\[([-\d.,]+)\]/.exec(bf);assert.ok(a,'BalloonFlight M6');const anchor=a[1].split(',').map(Number);
const dXZ=Math.hypot(anchor[0]-graphM6[0],anchor[2]-graphM6[2]);
// REPORT (not a failure until Grok Bot decides): basket anchor vs walk-graph M6
console.log('REPORT m6 anchor vs graph '+JSON.stringify({anchor,graphM6,dXZ:+dXZ.toFixed(3)}));
for(const [f,s] of [['BalloonTransit.ts',bt]])assert.doesNotMatch(s,/M6_LOCAL:Vec=\[/,f+' has its own M6 literal');
assert.match(bt,/meadowPos:r3\(meadow\.worldPosition\),meadowEuler:r3\(meadow\.eulerAngles\),meadowScale:r3\(meadow\.worldScale\),herStart:r3\(gp0\)[\s\S]{0,120}c0:live\?rv\(live\.position\):null,plan0:rv\(p0\.position\)/,'QF_B1_PREWALK fields');
console.log('PASS m6-single-source '+JSON.stringify({graphM6}));
