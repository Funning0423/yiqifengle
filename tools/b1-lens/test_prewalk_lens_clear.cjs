#!/usr/bin/env node
'use strict';
/** full8 P1-a: replay the m2 Mac prewalk/B1 poses through LensClear (MeadowLensBoxes + walk-floor clearance) and run 运镜bot's
 *  collision-gate.cjs on the result. Original m2 must still FAIL; cleared: 0 enclosed, windmill-free except ≤1 frame, and the
 *  residual (trees at the prewalk-end blend, B1 terrain) recorded. Residual is NOT claimed fixed — it comes from the wrong c0
 *  (planAgree gap ≈30 m, local-vs-world meadow yaw), which needs a Mac run with [QF_B1_FRAME] to confirm. */
const assert=require('node:assert/strict'),cp=require('child_process'),path=require('path'),os=require('os');
const T=path.join(__dirname,'..','transitions-continuous','fixtures','m2-camtrace-full.txt'),O=path.join(os.tmpdir(),'m2-cleared-'+process.pid+'.txt');
const fs=require('fs');const gate=f=>{const j=f+'.gate.json';const r=cp.spawnSync(process.execPath,[path.join(__dirname,'..','journey-integration','collision-gate.cjs'),'--trace',f,'--json',j,'--meadow-frame','bridge'],{encoding:'utf8'});const d=JSON.parse(fs.readFileSync(j,'utf8'));fs.rmSync(j,{force:true});d.spans=d.spans||[];return {code:r.status,d};};
cp.execFileSync(process.execPath,[path.join(__dirname,'make_cleared_trace.cjs'),T,O],{stdio:'inherit'});
const a=gate(T),b=gate(O);
assert.notEqual(a.code,0,'m2 original must fail the gate');
assert.equal(b.d.enclosed,0,'cleared: no enclosed lens');
const mill=b.d.spans.filter(s=>JSON.stringify(s).includes('windmill')).reduce((n,s)=>n+s.n,0);
assert.equal(b.d.violations,0,'cleared m2 replay must be violation-free: '+JSON.stringify(b.d.spans));
// the shipped grid must be the one the generator makes from today's meadow glb (no stale data)
const vf=path.join(__dirname,'../../creator-build-project/assets/scripts/region/MeadowLensVoxels.ts'),before=fs.readFileSync(vf,'utf8');
cp.execFileSync(process.execPath,[path.join(__dirname,'make_lens_voxels.cjs')],{stdio:'ignore'});const after=fs.readFileSync(vf,'utf8');if(after!==before){fs.writeFileSync(vf,before);assert.fail('MeadowLensVoxels.ts is stale: rerun tools/b1-lens/make_lens_voxels.cjs');}
// smoothness report: largest per-frame lens step (prewalk+B1) before/after
const steps=f=>{let last=null,mx=0,at=0;for(const l of fs.readFileSync(f,'utf8').split('\n')){const m=l.match(/t=([\d.]+) pos=([-\d.e,]+).*? w=BalloonTransit:(?:prewalk|B1)\b/);if(!m)continue;const p=m[2].split(',').map(Number);if(last){const d=Math.hypot(p[0]-last[0],p[1]-last[1],p[2]-last[2]);if(d>mx){mx=d;at=+m[1];}}last=p;}return {maxStepM:+mx.toFixed(3),at};};
console.log('REPORT step',JSON.stringify({m2:steps(T),cleared:steps(O)}));
console.log(JSON.stringify({m2:{violations:a.d.violations,enclosed:a.d.enclosed},cleared:{violations:b.d.violations,enclosed:b.d.enclosed,windmillFrames:mill,residualSpans:b.d.spans.map(s=>[s.t0,s.t1,s.n,s.tags?s.tags.join('+'):''])}}));
console.log('PASS prewalk-lens-clear (m2 replay 0 violations / 0 enclosed)');
