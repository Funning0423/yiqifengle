#!/usr/bin/env node
'use strict';
// Self-test: PRELOAD_BYTES block parse/regenerate + drift gate (an off-by-more-than-tol sample must FAIL).
const fs=require('fs'),path=require('path'),os=require('os'),assert=require('assert'),cp=require('child_process');
const P=require('./preload-bytes.cjs');const TS=path.join(__dirname,'../../creator-build-project/assets/scripts/region/TransitionChain.ts');
const src=fs.readFileSync(TS,'utf8'),blk=P.readBlock(src);let n=0;const ok=(c,m)=>{assert.ok(c,m);n++;};
ok(Object.keys(blk.bytes).length===5&&Object.values(blk.bytes).every(v=>Number.isInteger(v)&&v>0),'committed block parsed');
ok(/^\/\/ QF_GEN_PRELOAD_BYTES_BEGIN — GENERATED/m.test(src)&&blk.source.length>5,'generated header + source label');
// regenerate from 场景设计部's table json reproduces the committed block byte-for-byte
const rows=JSON.parse(fs.readFileSync(path.join(__dirname,'table_f8-web-test.json'),'utf8'));const fromTable={};for(const k of Object.keys(blk.bytes))fromTable[k]=rows.find(r=>r.bundle===k).actual;
ok(P.rewrite(src,fromTable,blk.source)===src||!/table_f8-web-test/.test(blk.source),'regenerated from the labelled table == committed');
ok(P.rewrite(src,blk.bytes,blk.source)===src,'render(parse(block)) round-trips');
// every PRELOAD_PLAN bundle is in the block (no hand numbers in the plan)
const plan=src.slice(src.indexOf('export const PRELOAD_PLAN'),src.indexOf('export const PRELOAD_MEMORY_BUDGET_MB'));
ok(!/bytes:\d/.test(plan),'PRELOAD_PLAN has no literal byte numbers');for(const m of plan.matchAll(/bundle:'(\w+)'/g))ok(m[1] in blk.bytes,'block has '+m[1]);
// gate on fake builds
const root=fs.mkdtempSync(path.join(process.env.QF_SCRATCH_ROOT||path.join(os.homedir(),'wt'),'qf-preload-test-'));
try{const mk=(name,scale,skip)=>{const b=path.join(root,name);for(const [k,v] of Object.entries(blk.bytes)){if(k===skip)continue;const d=path.join(b,k==='region_meadow'?'subpackages':'assets',k,'native');fs.mkdirSync(d,{recursive:true});fs.writeFileSync(path.join(d,'x.bin'),Buffer.alloc(Math.round(v*scale)));}return b;};
 const run=(b,...x)=>cp.spawnSync(process.execPath,[path.join(__dirname,'preload-bytes.cjs'),'--check',b,...x],{encoding:'utf8'});
 ok(run(mk('same',1)).status===0,'exact build passes');
 ok(run(mk('near',1.015)).status===0,'1.5% drift passes (tol 2%)');
 const far=run(mk('far',1.03));ok(far.status===1&&/DRIFT region_skycity/.test(far.stdout),'3% drift FAILS');
 const miss=run(mk('miss',1,'region_lakeside'));ok(miss.status===1&&/MISSING region_lakeside/.test(miss.stdout),'missing bundle FAILS');
 ok(run(mk('far2',1.03),'--tol','0.05').status===0,'--tol override');
 // the original (source-dir) plan numbers would fail against the measured build
 ok(P.check({region_skycity:1961205},{region_skycity:{bytes:3979071}}).bad.length===1,'old source-dir skycity number FAILS');
}finally{fs.rmSync(root,{recursive:true,force:true});}
console.log(`PASS test_preload_bytes (${n} checks)`);
