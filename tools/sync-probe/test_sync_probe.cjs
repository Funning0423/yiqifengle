#!/usr/bin/env node
'use strict';
/** [QF_SYNC] runtime gate (CamTraceLog, QA-only, stripped from release). Fake engine frames + fake wx/localStorage:
 *  boot / tap / hide-show / transition / qa reasons are allowed and counted by reason; a storage read in a steady frame FAILs.
 *  Negative self-tests: chainL replay (render reads journey storage every frame) → FAIL with samples; mutant that does not count
 *  getItem → caught; release strip removes every [QF_SYNC] symbol and probe-free flags the unstripped source. */
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||'typescript');
const {stripText}=require('../build-guard/strip-probes.cjs'),{probeFree}=require('../build-guard/release-gates.cjs');
const F=path.join(__dirname,'../../creator-build-project/assets/scripts/region/CamTraceLog.ts'),SRC=fs.readFileSync(F,'utf8');
function env(src){const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 const box=vm.createContext({console:{log(){},warn(){},info(){}},performance});box.globalThis=box;const m={exports:{}};
 const req=s=>s==='cc'?{director:{on(){}},Director:{},view:{on(){}},screen:{on(){}},sys:{},input:{on(){}},Input:{EventType:{}},game:{on(){}},Game:{}}:s.includes('DebugQuery')?{debugSearch:()=>''}:s.includes('CameraPose')?{cameraWriteHook:{}}:{};
 vm.runInContext(js,Object.assign(box,{module:m,exports:m.exports,require:req}),{filename:F});const C=m.exports;
 const data={},store={getItem:k=>wx.getStorageSync(k),setItem:(k,v)=>{data[k]=v;},removeItem:k=>{delete data[k];},clear(){}};
 const wx={getStorageSync:k=>data[k]??'',getSystemInfoSync:()=>({}),getWindowInfo:()=>({}),onShow(){}};const sysO={getSafeAreaRect:()=>({})};
 let frameEnd,tap,hs;const lines=[];C.syncProbe.out=s=>lines.push(s);
 assert.equal(C.installSyncProbe(box,store,wx,sysO,{onFrameEnd:f=>frameEnd=f,onTap:f=>tap=f,onHideShow:f=>hs=f}),true);
 const frames=(n,body)=>{for(let i=0;i<n;i++){body&&body(i);frameEnd();}};
 return {C,box,store,wx,sysO,frames,tap:()=>tap(),hs:()=>hs(),lines};}
function scenario(src){const E=env(src);const {C,store,wx,frames}=E;
 frames(C.SYNC_BOOT_FRAMES,i=>{if(i%50===0)store.getItem('boot-key');});
 frames(100);assert.equal(C.syncStats().steadyCalls,0,'quiet gameplay');
 E.tap();store.setItem('k','v');store.getItem('k');frames(2,()=>store.getItem('k'));
 frames(10);E.box.__qfWindWipe={mode:'ride'};frames(5,()=>wx.getSystemInfoSync());E.box.__qfWindWipe=null;
 E.box.__worldIntegration={snapshot:()=>({journey:{phase:'travel',target:'lakeside'}})};frames(3,()=>E.sysO.getSafeAreaRect());E.box.__worldIntegration={snapshot:()=>({journey:{phase:'arrived',target:null}})};
 frames(40);E.hs();frames(5,()=>store.getItem('h'));frames(40);
 E.box.__qfSyncAllow='door-shut-write';store.setItem('dot-runtime-diagnostics-20261010:world-flow','{}');E.box.__qfSyncAllow='';frames(1);
 const ok=C.syncStats();
 assert.equal(ok.steadyCalls,0,'allowed only: '+JSON.stringify(ok));assert.equal(ok.verdict,'PASS');
 for(const r of ['boot','tap','transition','hide-show','qa:door-shut-write'])assert.ok(ok.allow[r]>0,'reason counted '+r+' '+JSON.stringify(ok.allow));
 assert.equal(ok.byApi['localStorage.getItem']>0&&!ok.byApi['wx.getStorageSync'],true,'nested adapter call counted once: '+JSON.stringify(ok.byApi));
 // chainL replay: render reads journey storage every frame (4 keys × getters)
 frames(30,()=>{for(let k=0;k<4;k++)store.getItem('forest-v33-journey');});
 const bad=C.syncStats();assert.equal(bad.verdict,'FAIL');assert.equal(bad.steadyCalls,120);assert.equal(bad.maxSteadyPerFrame,4);
 assert.ok(bad.steadySamples[0].key==='forest-v33-journey'&&bad.steadySamples[0].api==='localStorage.getItem');
 assert.ok(E.lines.some(l=>/^\[QF_SYNC\] STEADY frame=\d+ api=localStorage\.getItem key=forest-v33-journey/.test(l)),'STEADY line');
 E.hs();assert.ok(E.lines.some(l=>/^\[QF_SYNC\] frames=\d+ calls=\d+ steadyCalls=120 maxPerFrame=\d+ maxSteadyPerFrame=4 allow=\{.*\} byApi=\{.*\} verdict=FAIL$/.test(l)),'summary line: '+E.lines.slice(-1));
 assert.equal(E.box.__qfSyncStats().steadyCalls,120,'harness hook');}
scenario(SRC);
let caught=0;const neg=(n,f)=>{let ok=false;try{f();}catch{ok=true;}assert.ok(ok,'self-test missed: '+n);caught++;};
neg('getItem not wrapped (chainL invisible)',()=>scenario(SRC.replace("for(const m of ['getItem','setItem','removeItem','clear'])","for(const m of ['setItem','removeItem','clear'])")));
neg('every call allowed (no steady classification)',()=>scenario(SRC.replace("return typeof q==='string'&&q?'qa:'+q:null;}","return 'any';}")));
const rel=stripText(SRC).out;for(const w of ['QF_SYNC','installSyncProbe','__qfSyncStats','syncProbe'])assert.ok(!rel.includes(w),'release still has '+w);
assert.ok(probeFree([{name:'CamTraceLog.ts',text:SRC}]).hits.some(h=>h.rule==='QF_SYNC'),'probe-free flags unstripped QF_SYNC');assert.equal(probeFree([{name:'c',text:rel}]).hits.length,0);
console.log('PASS sync-probe self-tests='+caught);
