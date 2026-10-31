#!/usr/bin/env node
'use strict';
/** QA storage timing probe ([QF_STORAGE]) in CamTraceLog: fake storage → one line per write with key, UTF-8 bytes, measured ms,
 *  caller; value still stored; idempotent; off unless camTrace/storageTrace; release strip removes every trace and the
 *  release probe-free gate flags an unstripped build. Negative self-tests on mutants. */
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||'typescript');
const {stripText}=require('../build-guard/strip-probes.cjs'),{probeFree}=require('../build-guard/release-gates.cjs');
const F=path.join(__dirname,'../../creator-build-project/assets/scripts/region/CamTraceLog.ts'),SRC=fs.readFileSync(F,'utf8');
function load(src,store){const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 const box=vm.createContext({console:{log(){},warn(){},info(){}},performance});box.globalThis=box;const m={exports:{}};
 const req=s=>s==='cc'?{director:{on(){}},Director:{},view:{on(){}},screen:{on(){}},sys:{localStorage:store}}:s.includes('DebugQuery')?{debugSearch:()=>''}:s.includes('CameraPose')?{cameraWriteHook:{}}:{};
 vm.runInContext(js,Object.assign(box,{module:m,exports:m.exports,require:req}),{filename:F});return m.exports;}
function fake(delayMs){const data={},o={setItem(k,v){const t=performance.now();while(performance.now()-t<delayMs){}data[k]=String(v);},getItem:k=>data[k]??null,data};return o;}
function check(src){
 const st=fake(5);const C=load(src,st);const lines=[];
 assert.equal(typeof C.installStorageProbe,'function','probe exported');
 assert.equal(C.installStorageProbe(st,s=>lines.push(s)),true,'installs');assert.equal(C.installStorageProbe(st,s=>lines.push(s)),false,'idempotent');
 const big='x'.repeat(12000)+'雲';st.setItem('dot-runtime-diagnostics-20261010:world-flow',big);
 assert.equal(st.data['dot-runtime-diagnostics-20261010:world-flow'],big,'value still stored');
 assert.equal(lines.length,1,'one line per write');
 const m=/^\[QF_STORAGE\] key=dot-runtime-diagnostics-20261010:world-flow bytes=(\d+) ms=([\d.]+) caller=(.*)$/.exec(lines[0]);assert.ok(m,lines[0]);
 assert.equal(+m[1],12003,'UTF-8 bytes');assert.ok(+m[2]>=4.5,'measured ms '+m[2]);
 assert.equal(C.storageProbeWanted('',false),false,'default off');assert.equal(C.storageProbeWanted('?storageTrace=1',false),true);assert.equal(C.storageProbeWanted('',true),true,'on with camTrace');
 // throwing storage still logs and rethrows
 const bad={setItem(){throw Error('quota');}};const l2=[];C.installStorageProbe(bad,s=>l2.push(s));assert.throws(()=>bad.setItem('k','v'),/quota/);assert.equal(l2.length,1);
 // release strip
 const rel=stripText(src).out;for(const w of ['QF_STORAGE','installStorageProbe','__qfStorageProbe','storageTrace'])assert.ok(!rel.includes(w),'release still has '+w);
 assert.ok(probeFree([{name:'CamTraceLog.ts',text:src}]).hits.some(h=>h.rule==='QF_STORAGE'),'probe-free gate flags unstripped QF_STORAGE');
 assert.equal(probeFree([{name:'CamTraceLog.ts',text:rel}]).hits.length,0,'stripped passes probe-free');}
check(SRC);
let caught=0;const neg=(n,f)=>{let ok=false;try{f();}catch{ok=true;}assert.ok(ok,'self-test missed: '+n);caught++;};
neg('probe outside QF_PROBE (ships in release)',()=>check(SRC.replace("/*QF_PROBE_BEGIN*//** Storage timing probe","/** Storage timing probe").replace("/*QF_PROBE_END*/export function camLogStart","export function camLogStart")));
neg('ms not measured',()=>check(SRC.replace("const ms=now()-t0;","const ms=0;")));
neg('value not forwarded',()=>check(SRC.replace("return orig.call(this===timed?store:this,key,value);","return;")));
console.log('PASS storage-probe self-tests='+caught);
