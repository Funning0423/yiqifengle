'use strict';
/* coast-kit-flag-agree: regional-r05/runtime/coast-kit.js enabled() and BoardProjection.coastBoardKitFromFlag() must agree on every case
 * (true / false / missing / truthy-non-true global, query on / off / substring / middle / malformed location). Self-check: a deliberately
 * different predicate is caught. */
const assert=require('node:assert/strict'),path=require('node:path');const {createHarness}=require('./harness.cjs');
const H=createHarness(),B=H.load('ui/BoardProjection'),CK=require(path.join(__dirname,'../../creator-build-project/assets/scripts/regional-r05/runtime/coast-kit.js'));
const G=[undefined,true,false,1,'true'],Q=[undefined,'','?qfcoastkit=1','?a=1&qfcoastkit=1','?qfcoastkit=1&b=2','?qfcoastkit=0','?qfcoastkit=10','?xqfcoastkit=1','#qfcoastkit=1','THROW',42];
function setEnv(g,q){delete globalThis.__qfCoastBoardKit;delete globalThis.location;if(g!==undefined)globalThis.__qfCoastBoardKit=g;
 if(q==='THROW')Object.defineProperty(globalThis,'location',{configurable:true,get(){return {get search(){throw Error('x');}};}});else if(q!==undefined)globalThis.location={search:q};}
const naive=()=>{const s=globalThis.location&&(()=>{try{return globalThis.location.search}catch{return ''}})();return !!globalThis.__qfCoastBoardKit||(typeof s==='string'&&s.includes('qfcoastkit=1'));};
let n=0,on=0,naiveDiff=0;
try{for(const g of G)for(const q of Q){setEnv(g,q);const a=CK.enabled(),b=B.coastBoardKitFromFlag();assert.equal(a,b,`disagree g=${g} q=${q}: coast-kit ${a} vs board ${b}`);n++;if(a)on++;if(naive()!==a)naiveDiff++;}}
finally{delete globalThis.__qfCoastBoardKit;delete globalThis.location;B.setCoastBoardKit(false);}
assert.ok(on>0&&on<n,'cases cover both outcomes');assert.ok(naiveDiff>0,'self-check: a looser predicate was not distinguished');
setEnv(undefined,undefined);assert.equal(CK.enabled(),false);assert.equal(B.coastBoardKitFromFlag(),false,'missing = off');delete globalThis.location;
console.log(`ok   ${n} cases agree (${on} on); looser predicate differs on ${naiveDiff} → self-check detected`);console.log('coast-kit-flag-agree: PASS');
