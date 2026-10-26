#!/usr/bin/env node
'use strict';
/** full8 P1-a (Mac m2 23bae2d6 f588–594: B1 lens dragged ~9.5 m in 0.5 s through the windmill, then 3 grey frames).
 *  Root cause: the windmill is not among TRANSITION_OCCLUDERS, so B1's close spot / cam0→spot blend never saw it.
 *  Gate: (1) b1PathBlocked flags the m2 trace segment against the real windmill bounds (env_meadow.glb, ≥1.1 m clearance);
 *  (2) BalloonTransit adds the live windmill boxes, drops a blocked spot (holds the live prewalk lens) and paces the blend
 *  by distance (≤ 2.5 m/s). */
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||'typescript');
const src=fs.readFileSync(path.join(__dirname,'../../creator-build-project/assets/scripts/region/BalloonTransit.ts'),'utf8');
const fn=/export function b1PathBlocked\([\s\S]*?\n return false;\}\n/.exec(src);assert.ok(fn,'b1PathBlocked');
const consts=/export const B1_LENS_MPS=([\d.]+),B1_LENS_CLEAR_M=([\d.]+);/.exec(src);assert.ok(consts);assert.equal(+consts[2],1.1);assert.ok(+consts[1]<=2.5);
const js=ts.transpileModule(fn[0].replace('export ',''),{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText;
const blocked=new Function('B1_LENS_CLEAR_M',js+';return b1PathBlocked;')(+consts[2]);
// windmill world box in the live meadow placement: the m2 trace runs in the same world frame as the sail copy (meadow root unchanged)
const L=require('../transitions/sail_farsea_lib.cjs');const mill=[1e9,1e9,1e9,-1e9,-1e9,-1e9];
for(const m of L.scene().meadow){if(!m.mill)continue;const t=m.tris;for(let i=0;i<t.length;i+=3)for(let k=0;k<3;k++){mill[k]=Math.min(mill[k],t[i+k]);mill[k+3]=Math.max(mill[k+3],t[i+k]);}}
const A=[-20.587,8.248,89.609],B=[-11.2,6.9,96.3];
console.log(JSON.stringify({mill:mill.map(x=>+x.toFixed(2))}));
// a blend straight through the windmill is rejected; the m2 drag (≈10 m in ≈1.1 s ≈ 9 m/s) is now paced to ≥ 10/2.5 = 4 s
const mid=[(mill[0]+mill[3])/2,(mill[1]+mill[4])/2,(mill[2]+mill[5])/2];
assert.equal(blocked([mid[0]-12,mid[1],mid[2]],[mid[0]+12,mid[1],mid[2]],[mill]),true,'through the windmill');
const dAB=Math.hypot(B[0]-A[0],B[1]-A[1],B[2]-A[2]);assert.ok(dAB/(+consts[1])>=3.7,'m2 drag paced '+dAB.toFixed(2));
assert.equal(blocked([0,0,0],[1,0,0],[[10,10,10,11,11,11]]),false);
assert.equal(blocked([0,0,0],[1,0,0],[[1.5,-1,-1,2,1,1]]),true,'clearance 1.1 m');
assert.match(src,/const b1Boxes=\[\.\.\.\(transitionOccluderBoxes\(\) as any\[\]\),\.\.\.meadowMillBoxes\(meadow\)\]/,'live windmill boxes');
assert.match(src,/basketCloseSpot\(doorB1,oB,b1Boxes as any/,'close spot sees the windmill');
assert.match(src,/if\(spotB1&&b1PathBlocked\(cam0\.position,spotB1\.position,b1Boxes\)\)\{[\s\S]{0,160}?spotB1=null;\}/,'blocked path → hold');
assert.match(src,/b1In=Math\.max\(b1InS\(walkS\),b1Dist\/B1_LENS_MPS\)/,'distance-paced blend');
console.log('PASS b1-lens-windmill');
