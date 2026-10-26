'use strict';
// full9c: B1 start segment timing ([QF_B1_PREWALK] → B1 first camera write). Source contract: one summary line by default,
// phase markers around each B1 setup step, per-frame detail only under camTrace and capped.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const s=fs.readFileSync(path.join(__dirname,'../../creator-build-project/assets/scripts/region/BalloonTransit.ts'),'utf8');
assert.equal((s.match(/'\[QF_B1_GAP\] '/g)||[]).length,1,'one [QF_B1_GAP] summary');
assert.match(s,/console\.info\('\[QF_B1_GAP\] '\+JSON\.stringify\(\{totalMs:[^}]*frames:[^}]*maxDtMs:[^}]*phases:/,'summary fields');
for(const k of['chainMark','vehicleT0','closeSpot','lensSolid','b1Register','b1LensCalc','frame'])assert.ok(s.includes(`gapPh('${k}')`),'phase '+k);
assert.match(s,/if\(camLog\.on&&b1Gap\.lines<30\)\{[^}]*camLog\.out\('\[QF_B1_GAP_FRAME\] '/,'per-frame only under camTrace, ≤30 lines');
assert.ok(s.indexOf("console.info('[QF_B1_PREWALK] ")<s.indexOf('const b1Gap='),'window starts after [QF_B1_PREWALK]');
assert.match(s,/gapPh\('b1LensCalc'\);world\.setCamera\(b1p\);gapEnd\('b1-first-write'\)/,'ends at B1 first write');
assert.match(s,/director\.off\(Director\.EVENT_BEFORE_DRAW,b1Draw\);gapEnd\(/,'always closed');
console.log(JSON.stringify({test:'b1-gap-log',status:'PASS'}));
