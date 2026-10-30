#!/usr/bin/env node
'use strict';
// Self-tests for strip-probes.cjs + release-gates.cjs: each gate must FAIL on an unstripped/oversize sample and PASS on the stripped one.
const fs=require('fs'),path=require('path'),assert=require('assert');
const {stripText}=require('./strip-probes.cjs'),{probeFree,sizeOf}=require('./release-gates.cjs');
const S=path.join(__dirname,'../../creator-build-project/assets/scripts');let n=0;const ok=(c,m)=>{assert.ok(c,m);n++;};
// strip: balance errors
for(const bad of ['a/*QF_PROBE_END*/b','a/*QF_PROBE_BEGIN*/b','/*QF_PROBE_BEGIN*/x/*QF_PROBE_BEGIN*/y/*QF_PROBE_END*/'])ok((()=>{try{stripText(bad);return false;}catch{return true;}})(),'unbalanced must throw: '+bad);
ok(stripText('a/*QF_PROBE_BEGIN*/X/*QF_PROBE_END*/b/*QF_PROBE_BEGIN*/Y/*QF_PROBE_END*/c').out==='abc','strip basic');
// real sources: markers present (probe build), stripped has no probe code, idempotent
const real=['region/CamTraceLog.ts','world-r1/WorldFlowComponent.ts'].map(f=>({name:f,text:fs.readFileSync(path.join(S,f),'utf8')}));
const unstripped=probeFree(real),stripped=probeFree(real.map(x=>({name:x.name,text:stripText(x.text).out})));
ok(unstripped.hits.length>0,'unstripped probe source must FAIL probe-free');
for(const r of ['__QF_PROBE_HER','QF_HER_FRAME','QF_PROBE','B1_GAP_PER_CUT'])ok(unstripped.hits.some(h=>h.rule===r),'unstripped sample hits '+r);
ok(stripped.hits.length===0,'stripped source must PASS probe-free: '+JSON.stringify(stripped.hits.slice(0,2)));
ok(real.every(x=>stripText(stripText(x.text).out).out===stripText(x.text).out),'idempotent');
const st=stripText(real[0].text).out;for(const w of ['pnow','probeHerFrame','camProbeCharacter','EVENT_AFTER_DRAW',' pn='])ok(!st.includes(w),'stripped CamTraceLog has no '+w);
ok(!/camProbeCharacter/.test(stripText(real[1].text).out),'stripped WorldFlowComponent has no camProbeCharacter');
// the pre-existing B1 summary line (BalloonTransit, bdd3c6d7) is kept and not flagged
const bt=fs.readFileSync(path.join(S,'region/BalloonTransit.ts'),'utf8');const b=probeFree([{name:'bt',text:bt}]);ok(b.hits.length===0&&b.keepB1===1,'B1 summary line kept, not a probe hit');
// minified forms
ok(probeFree([{name:'m',text:'o.out("[QF_B1_GAP] "+JSON.stringify({cut:c.n,from:a})'}]).hits.length===1,'minified per-cut line flagged');
ok(probeFree([{name:'m',text:'console.info("[QF_B1_GAP] "+JSON.stringify({totalMs:1})'}]).hits.length===0,'minified B1 summary not flagged');
// size gate
ok(sizeOf([{rel:'game.js',bytes:3999999},{rel:'subpackages/a/x',bytes:20000000}],24641536,4000000).bad.length===0,'size pass');
ok(sizeOf([{rel:'game.js',bytes:4000001}],24641536,4000000).bad[0].startsWith('MAIN'),'main over fails');
ok(sizeOf([{rel:'game.js',bytes:100},{rel:'subpackages/a/x',bytes:24641537}],24641536,4000000).bad[0].startsWith('TOTAL'),'total over fails');
ok(sizeOf([{rel:'game.js',bytes:4000000},{rel:'subpackages/a',bytes:20641536}],24641536,4000000).bad.length===0,'limits inclusive');
console.log(`PASS test_release_gates (${n} checks)`);
// extensibility: a new tag added to the symbol list is enforced (simulated, in memory)
{const rg=require('./release-gates.cjs');const before=rg.FORBID.length;rg.FORBID.push(['LK_ACTIVE_CAM',/\[QF_LK_CAM\]/]);
 assert.ok(rg.probeFree([{name:'x',text:'log("[QF_LK_CAM] a")'}]).hits.length===1,'extended symbol enforced');rg.FORBID.length=before;
 assert.ok(stripText('a/*QF_PROBE_BEGIN*/log("[QF_LK_CAM]")/*QF_PROBE_END*/').out==='a','generic marker strip');console.log('PASS extensibility');}
