'use strict';
const assert=require('node:assert/strict'),{createHarness}=require('./harness.cjs');
(async()=>{
 const H=createHarness({debug:true}),C=H.load('world-r2/WorldNativeComposition').WorldNativeComposition,c=new C();
 const normal={mainline:c.mainline,r4:c.r4,persistence:c.persistence,selection:c.selection};
 let state='island';c.world={commands:()=>({snapshot:()=>({state}),enterLevel:async()=>{state='level';return {ok:true};}})};
 const reads=[],writes=[],storage=H.cc.sys.localStorage,get=storage.getItem.bind(storage),set=storage.setItem.bind(storage);storage.getItem=k=>{reads.push(k);return get(k)};storage.setItem=(k,v)=>{writes.push(k);return set(k,v)};
 assert((await c.startRegionFlowTest(4)).ok);const x=c.regionFlowTestStatus();assert(x);assert(reads.every(k=>k.startsWith(x.namespace)));assert(writes.every(k=>k.startsWith(x.namespace)));assert.notEqual(c.mainline,normal.mainline);assert.notEqual(c.r4,normal.r4);assert.notEqual(c.persistence,normal.persistence);assert.equal(c.r4.journey,c.mainline.journey);assert.equal(c.persistence.journey,c.mainline.journey);
 assert(!c.exitRegionFlowTest().ok);state='island';const counts=[reads.length,writes.length];assert(c.exitRegionFlowTest().ok);for(const k of Object.keys(normal))assert.equal(c[k],normal[k]);assert.deepEqual([reads.length,writes.length],counts);assert.equal(c.regionFlowTestStatus(),null);
 const r=createHarness(),Release=r.load('world-r2/WorldNativeComposition').WorldNativeComposition;assert(!(await new Release().startRegionFlowTest(4)).ok);
 console.log(JSON.stringify({status:'PASS',allReadsAndWritesWithinFreshRoot:true,mainlineR4R5ShareJourney:true,normalPortsRestoredWithoutStorageIO:true,releaseBlocked:true,scope:'Temporary node/engine harness, no native or normal-save field inspection'},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
