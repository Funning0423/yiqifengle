'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert/strict'),ts=require(process.env.QF_TYPESCRIPT_MODULE||'typescript');
const p=path.resolve(__dirname,'../../creator-build-project/assets/scripts/static-seat/PreviewLease.ts');const code=ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020},reportDiagnostics:true});assert.equal(code.diagnostics?.length||0,0);const mod={exports:{}};vm.runInNewContext(code.outputText,{module:mod,exports:mod.exports,setTimeout,clearTimeout,Promise,Error});const {PreviewLease}=mod.exports;
const next=()=>new Promise(r=>setImmediate(r));let checks=0;const pass=()=>checks++;
(async()=>{
 const freed=[],L=new PreviewLease(x=>freed.push(x),15);assert.equal(await L.load(async()=>1),1);pass();assert.equal(await L.load(async()=>2),2);assert.deepEqual(freed,[1]);pass();L.dispose();L.dispose();assert.deepEqual(freed,[1,2]);await assert.rejects(L.load(async()=>3),/disposed/);pass();
 const f=[],X=new PreviewLease(x=>f.push(x),15);let oldResolve;const old=X.load(()=>new Promise(r=>oldResolve=r));await next();const check=assert.rejects(old,/superseded/);assert.equal(await X.load(async()=>5),5);await check;oldResolve(4);await next();assert.deepEqual(f,[4]);pass();X.dispose();assert.deepEqual(f,[4,5]);pass();
 let late;const t=[],T=new PreviewLease(x=>t.push(x),8);await assert.rejects(T.load(()=>new Promise(r=>late=r)),/timeout/);assert.equal(await T.load(async()=>7),7);late(6);await next();assert.deepEqual(t,[6]);T.dispose();assert.deepEqual(t,[6,7]);pass();
 let runs=0;const Z=new PreviewLease(()=>{},20);const z=Z.load(async()=>++runs);const ze=assert.rejects(z,/superseded/);Z.dispose();await ze;await next();assert.equal(runs,0);pass();
 const R=new PreviewLease(()=>{},20);await assert.rejects(R.load(async()=>{throw Error('bad')}),/bad/);assert.equal(await R.load(async()=>9),9);R.dispose();pass();
 const A=new PreviewLease(()=>{},20);await assert.rejects(A.load(()=>{throw Error('sync')}),/sync/);A.dispose();pass();
 const C=new PreviewLease(x=>freed.push(x),20);await C.load(async()=>11);C.clear();assert.equal(await C.load(async()=>12),12);C.dispose();assert.deepEqual(freed.slice(-2),[11,12]);pass();
 console.log(JSON.stringify({status:'PASS',checks,scope:'Actual pure TypeScript lease; no Cocos engine or GPU'}));
})().catch(e=>{console.error(e);process.exitCode=1});
