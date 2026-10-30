'use strict';
/* coast-tap-area (P1, Grok Bot 10/30 decision 2/3 + P1 note 3). COAST_KIT projected grid on all 7 screens (incl. 390×520, 375×667):
 * - each tile's REAL effective tap size: nearest-centre resolution owns up to the half-way line to each neighbour, capped by the
 *   44 pt box (overlapping boxes are not counted as 44). Far row (row 0) effective short side ≥ 28 pt on every screen, else FAIL.
 * - random taps uniformly within ±8 pt of every cell centre (fixed seed, 600 per tile per screen) resolve to that tile: 0 wrong, else FAIL.
 * - taps well off the board (> 22 pt outside the outer tiles' boxes and quads) hit nothing.
 * Self-checks: one centre moved by 16 pt (more than half a far pitch minus the 8 pt jitter) must give wrong taps; one far tile shrunk (neighbours pulled in) must drop below 28. */
const assert=require('node:assert/strict');const {createHarness}=require('./harness.cjs');const H=createHarness();
const K=H.load('ui/BoardKit'),B=H.load('ui/BoardProjection'),E=require('./coast-board-eval.cjs');
const N=600;let seed=20261030;const rand=()=>((seed=(seed*1103515245+12345)&0x7fffffff)/0x7fffffff);
function taps(grid,truth){let n=0,wrong=0;for(let i=0;i<49;i++){const c=truth.centers[i];for(let k=0;k<N;k++){const x=c.x+(rand()*2-1)*E.TAP_JITTER_PT,y=c.y+(rand()*2-1)*E.TAP_JITTER_PT;n++;if(B.projectedCellAt(grid,x,y)!==i)wrong++;}}return {n,wrong};}
const fails=[],waits=[];let total=0;
for(const [w,h] of E.SCREENS){const b=B.projectBoard(K.COAST_KIT,w,h);assert.ok(b,w+'x'+h+' projection');
 const far=E.farRow(B,b),minFar=Math.min(...far.map(f=>f.short)),vis=b.quads.slice(0,7).map(q=>[Math.hypot(q[1].x-q[0].x,q[1].y-q[0].y),Math.hypot(q[3].x-q[0].x,q[3].y-q[0].y)]);
 const all=[...Array(49).keys()].map(i=>B.effectiveTapSize(b,i)),minAll=Math.min(...all.map(f=>f.short));
 const t=taps(b,b);total+=t.n;
 const off=[[b.centers[0].x-60,b.centers[0].y-60],[b.centers[48].x+60,b.centers[48].y+60],[w/2,b.centers[0].y-70],[w/2,b.centers[48].y+70]].map(([x,y])=>B.projectedCellAt(b,x,y));
 console.log(`     ${w}x${h} D ${b.distanceM}: far row effective ${far.map(f=>f.w.toFixed(1)+'×'+f.h.toFixed(1)).join(' ')} → short ${minFar.toFixed(1)} pt (drawn cell ${vis[3][0].toFixed(1)}×${vis[3][1].toFixed(1)}); all tiles short ≥ ${minAll.toFixed(1)}; ±8 pt taps ${t.n}, wrong ${t.wrong}; off-board ${off.join(',')}`);
 {const fh=Math.min(...vis.map(v=>v[1]));if(fh<E.FAR_MIN_PT)waits.push(`${w}x${h}: far-row drawn cell height ${fh.toFixed(1)} pt < ${E.FAR_MIN_PT} (effective tap short side ${minFar.toFixed(1)}) — WAITING on Grok Bot/运镜bot camera-distance decision, not a pass`);}
 if(minFar<E.FAR_MIN_PT)fails.push(`${w}x${h} far row ${minFar.toFixed(1)} < ${E.FAR_MIN_PT}`);if(t.wrong)fails.push(`${w}x${h} ${t.wrong} wrong taps`);if(off.some(x=>x!==-1))fails.push(`${w}x${h} off-board tap hit a tile`);}
// self-checks
{const b=B.projectBoard(K.COAST_KIT,320,568),moved={...b,centers:b.centers.map((c,i)=>i===3?{x:c.x+16,y:c.y}:c)},t=taps(moved,b);assert.ok(t.wrong>0,'self-check: moved centre not detected');
 const C=b.centers.map(c=>({...c})),c3=C[3];for(const j of [2,4,10]){C[j]={x:c3.x+(C[j].x-c3.x)*0.8,y:c3.y+(C[j].y-c3.y)*0.8};}const s=B.effectiveTapSize({centers:C},3).short;assert.ok(s<E.FAR_MIN_PT,'self-check: shrunk tile not below 28 ('+s+')');
 console.log(`ok   self-checks: centre moved 16 pt → ${t.wrong} wrong taps; tile 3 shrunk → short ${s.toFixed(1)} pt < 28`);}
console.log(`coast-tap-area: ${E.SCREENS.length} screens × 49 tiles, ${total} random taps (seed 20261030, ±${E.TAP_JITTER_PT} pt), ${fails.length} failures`);
for(const x of waits)console.log('     WAITING '+x);for(const f of fails)console.log('     FAIL '+f);
if(fails.length){console.log('coast-tap-area: FAIL');process.exit(1);}
console.log('coast-tap-area: PASS'+(waits.length?` (gates above pass; ${waits.length} screens WAITING on the camera-distance decision: ${waits.map(x=>x.split(':')[0]).join(', ')})`:''));
