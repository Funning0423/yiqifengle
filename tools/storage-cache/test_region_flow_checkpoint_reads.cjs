'use strict';
/** P0 finR: createRegionFlowCheckpoint (pre-transition/region-flow QA profile) did 7183 sync localStorage.getItem in ONE frame on
 *  device (f1836). Budget: a checkpoint reads each distinct key at most once from storage, plus one verification re-read per write
 *  (write-through). N = distinctKeys + writes; independent of how many controller steps/snapshots the replay performs.
 *  Negative: the pre-fix raw storage lanes blow the budget. */
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),{createHarness}=require('../board-ui/harness.cjs');
function run(H){const ls=H.cc.sys.localStorage,get=ls.getItem.bind(ls),set=ls.setItem.bind(ls);const reads=[],writes=[];
 ls.getItem=k=>{reads.push(k);return get(k);};ls.setItem=(k,v)=>{writes.push(k);return set(k,v);};
 const M=H.load('world-r2/RegionFlowTest');const p=M.createRegionFlowCheckpoint(12,{allowQa:true,finish:true,anyCheckpoint:true});
 void p.mainline.inspect();void p.r5.inspect();
 ls.getItem=get;ls.setItem=set;return {reads,writes,distinct:new Set(reads).size};}
const r=run(createHarness({debug:true}));const N=r.distinct+r.writes.length;
console.log('checkpoint12 reads='+r.reads.length+' writes='+r.writes.length+' distinct='+r.distinct+' budget='+N);
assert.ok(r.reads.length<=N,'checkpoint storage reads '+r.reads.length+' > budget '+N);
assert.ok(r.distinct<=16,'distinct keys '+r.distinct);
// negative: pre-fix lanes (raw sys.localStorage per call)
const F=path.join(__dirname,'../../creator-build-project/assets/scripts/world-r2/RegionFlowTest.ts'),orig=fs.readFileSync(F,'utf8');
let caught=false;try{fs.writeFileSync(F,require('child_process').execFileSync('git',['show','dc48cb42:creator-build-project/assets/scripts/world-r2/RegionFlowTest.ts'],{cwd:path.join(__dirname,'../..'),encoding:'utf8'}));
 const b=run(createHarness({debug:true}));console.log('pre-fix reads='+b.reads.length);caught=b.reads.length>b.distinct+b.writes.length;}finally{fs.writeFileSync(F,orig);}
assert.ok(caught,'self-test: pre-fix raw lanes not caught');
console.log('PASS region-flow-checkpoint-reads');
