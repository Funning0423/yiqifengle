'use strict';
// Negative self-test for the b1-yard-balloon C3 TransitionChain rule. All mutations are in memory; the real file is only read.
const assert=require('assert'),fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const {checkTransitionChain}=require('./c3-transition-chain.cjs');
const ROOT=path.resolve(__dirname,'../..'),F='creator-build-project/assets/scripts/region/TransitionChain.ts',BASE='19bd812a';
const src=fs.readFileSync(path.join(ROOT,F),'utf8'),base=execFileSync('git',['show',BASE+':'+F],{cwd:ROOT,encoding:'utf8',maxBuffer:1<<26});
const fails=(s,re)=>{assert.throws(()=>checkTransitionChain(base,s,F,BASE),e=>e instanceof assert.AssertionError&&re.test(e.message));};
// 0) the committed file passes
checkTransitionChain(base,src,F,BASE);console.log('ok   committed TransitionChain.ts passes C3');
// 1) counterexample: SKY_WARM_GAP_MS 300 -> 301 (outside the preload section) must FAIL
const m1=src.replace('export const SKY_WARM_GAP_MS=300;','export const SKY_WARM_GAP_MS=301;');assert.notEqual(m1,src,'mutation 1 not applied');
fails(m1,/outside the preload section/);console.log('ok   SKY_WARM_GAP_MS edit FAILs C3');
// 2) a change confined to the QF_GEN_PRELOAD_BYTES block must PASS
const m2=src.replace(/( region_meadow:)(\d+)/,(_,a,n)=>a+(Number(n)+1));assert.notEqual(m2,src,'mutation 2 not applied');
checkTransitionChain(base,m2,F,BASE);console.log('ok   edit inside QF_GEN_PRELOAD_BYTES PASSes C3');
// 3) deleting a base line outside the section must FAIL; 4) removing the generated block must FAIL
const line='export const SKY_WARM_GAP_MS=300;\n';assert.ok(src.includes(line));fails(src.replace(line,''),/outside the preload section/);console.log('ok   deleted base line FAILs C3');
const m4=src.replace(/\/\/ QF_GEN_PRELOAD_BYTES_BEGIN[\s\S]*?\/\/ QF_GEN_PRELOAD_BYTES_END\n/,'');assert.notEqual(m4,src);fails(m4,/not the generated PRELOAD_BYTES block/);console.log('ok   missing generated block FAILs C3');
assert.equal(fs.readFileSync(path.join(ROOT,F),'utf8'),src,'real file changed');
console.log('c3-transition-chain-selftest: PASS');
