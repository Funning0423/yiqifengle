#!/usr/bin/env node
'use strict';
/** full8 P1-a (Mac m2 23bae2d6: B1 dragged the lens ≈10 m in ≈1.1 s ≈ 9 m/s into the windmill, then grey frames).
 *  Ours: the cam0→close-spot blend is paced by distance (≤ 2.5 m/s) on top of the walk-time blend; the close spot itself
 *  (basketCloseSpot, windmill/tree avoidance) is 运镜bot's and is not changed here. */
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const src=fs.readFileSync(path.join(__dirname,'../../creator-build-project/assets/scripts/region/BalloonTransit.ts'),'utf8');
const c=/export const B1_LENS_MPS=([\d.]+);/.exec(src);assert.ok(c);const mps=+c[1];assert.ok(mps<=2.5);
assert.match(src,/const b1Dist=spotB1\?Math\.hypot\(/,'blend distance');
assert.match(src,/b1In=Math\.max\([^;]*,b1Dist\/B1_LENS_MPS\)/,'distance-paced blend');
const A=[-20.587,8.248,89.609],B=[-10.129,6.8,97.028],d=Math.hypot(B[0]-A[0],B[1]-A[1],B[2]-A[2]);
assert.ok(d/mps>=4,'m2 drag would take ≥4 s, was ≈1.1 s ('+d.toFixed(2)+' m)');
console.log('PASS b1-lens-pacing '+JSON.stringify({dragM:+d.toFixed(2),minS:+(d/mps).toFixed(2)}));
