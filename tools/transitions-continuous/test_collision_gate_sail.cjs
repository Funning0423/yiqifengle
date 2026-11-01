'use strict';
// 运镜bot full9c: collision-gate in the SAIL meadow placement (TransportLeg.sailMeadowRoot, RegionJourneyAdapter.ts:126).
// (ii) fixtures/m2-sail-penetrating.txt (make_sail_penetrating_trace.cjs: real m2 poses, prewalk t 137–138 pushed through the windmill
//      tower and a tree canopy in the sail frame) MUST fail with enclosed > 0, auto-detected frame 'sail', plan c0 agreeing.
// (i)  the real m2 Mac trace auto-detects 'sail' with plan gap ≤ 0.5 m. Its windmill/tree screenshots (cand-23bae2d6 m2-blanks.jpg
//      584–590) re-render from these poses in the sail placement with ≥ 14.9 m to the windmill (narrow fov 48), so it is recorded as
//      clean here; the bridge-placement must-fail stays in test_collision_gate_m2.cjs.
const cp=require('child_process'),path=require('path'),fs=require('fs'),os=require('os'),assert=require('node:assert/strict');
const G=path.join(__dirname,'../journey-integration/collision-gate.cjs'),F=n=>path.join(__dirname,'fixtures',n);
const run=(f,extra=[])=>{const j=path.join(os.tmpdir(),'cg-sail-'+process.pid+'-'+path.basename(f)+'.json');const r=cp.spawnSync(process.execPath,[G,'--trace',f,'--require-plan-agree','--json',j,...extra],{encoding:'utf8',maxBuffer:64<<20});const d=JSON.parse(fs.readFileSync(j,'utf8'));fs.rmSync(j,{force:true});return {code:r.status,d};};
// fixture must be reproducible from the generator
const tmp=path.join(os.tmpdir(),'m2-sail-pen-'+process.pid+'.txt');cp.execFileSync(process.execPath,[path.join(__dirname,'make_sail_penetrating_trace.cjs'),F('m2-camtrace-full.txt'),tmp],{stdio:'ignore'});
assert.equal(fs.readFileSync(tmp,'utf8'),fs.readFileSync(F('m2-sail-penetrating.txt'),'utf8'),'m2-sail-penetrating.txt is stale: rerun make_sail_penetrating_trace.cjs');fs.rmSync(tmp,{force:true});
const pen=run(F('m2-sail-penetrating.txt'));
assert.equal(pen.d.meadowFrame.frame,'sail','penetrating fixture must be detected in the sail frame');assert.ok(pen.d.planAgree.ok,'plan c0 must agree');
assert.notEqual(pen.code,0,'sail must-fail trace passed the gate');assert.ok(pen.d.enclosed>0,'sail must-fail: enclosed lens not caught');
assert.ok(pen.d.viol.some(v=>v.inBox.some(b=>/windmill_static_merged/.test(b))),'windmill penetration not attributed');
const m2=run(F('m2-camtrace-full.txt'));assert.equal(m2.d.meadowFrame.frame,'sail');assert.ok(m2.d.planAgree.ok,'m2 plan c0 gap '+m2.d.planAgree.gapM);
console.log(JSON.stringify({sailMustFail:{violations:pen.d.violations,enclosed:pen.d.enclosed},m2Aligned:{violations:m2.d.violations,enclosed:m2.d.enclosed,gapM:m2.d.planAgree.gapM}}));
console.log('PASS collision-gate-sail (sail must-fail caught; m2 aligned recorded)');
