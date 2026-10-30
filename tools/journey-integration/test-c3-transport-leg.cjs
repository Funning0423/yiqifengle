'use strict';
// Negative self-test for the b1-yard-balloon C3 TransportLeg rule. All mutations are in memory; the real file is only read.
const assert=require('assert'),fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const {checkTransportLeg,PINS}=require('./c3-transport-leg.cjs');
const ROOT=path.resolve(__dirname,'../..'),F='creator-build-project/assets/scripts/region/TransportLeg.ts',BASE='19bd812a';
const src=fs.readFileSync(path.join(ROOT,F),'utf8'),base=execFileSync('git',['show',BASE+':'+F],{cwd:ROOT,encoding:'utf8',maxBuffer:1<<26});
const fails=(s,what)=>{assert.notEqual(s,src,'mutation not applied: '+what);assert.throws(()=>checkTransportLeg(base,s,F,BASE),e=>e instanceof assert.AssertionError&&/C3:/.test(e.message),what+' did not FAIL');console.log('ok   '+what+' FAILs C3');};
const sub=(s,a,b)=>{assert.ok(s.split(a).length===2,'not unique: '+a);return s.replace(a,b);};
// 0) committed file passes; base passes; both pins applied passes (merge with 8a63be5b)
checkTransportLeg(base,src,F,BASE);console.log('ok   committed TransportLeg.ts passes C3');
checkTransportLeg(base,base,F,BASE);console.log('ok   base passes C3');
let both=base;for(const p of PINS)both=sub(both,p.old,p.new);checkTransportLeg(base,both,F,BASE);console.log('ok   SAIL_M1_LOCAL+K0 pinned passes C3');
for(const variant of [src,both]){const tag=variant===src?'[head]':'[merged]';
 const K=PINS.find(p=>p.key==='K0').new,M=PINS.find(p=>p.key==='SAIL_M1_LOCAL').new;
 const v=variant.includes(K)?variant:sub(variant,PINS[1].old,K);
 // (i) any other line changed / added / deleted
 fails(sub(v,'export const SAIL_K0_BLEND_S=5;','export const SAIL_K0_BLEND_S=6;'),tag+' other line (SAIL_K0_BLEND_S) edit');
 fails(sub(v,'export const SAIL_K0_BLEND_S=5;','export const SAIL_K0_BLEND_S=5; '),tag+' other line trailing space');
 fails(sub(v,K,'/* c */\n'+K),tag+' added line above K0');
 fails(sub(v,'export const SAIL_K0_BLEND_S=5;\n',''),tag+' deleted other line');
 // (ii) every K0 number
 for(const [k,a,b] of [['back','10.5','10.6'],['side','-4.2','-4.3'],['up','4','4.1'],['fov','60','61'],['look','0.5','0.6'],['orb','0','1']])
  fails(sub(v,K,K.replace(k+':'+a+',',k+':'+b+',').replace(k+':'+a+'}',k+':'+b+'}')),tag+' K0 '+k+' '+a+'->'+b);
 // SAIL_M1_LOCAL: each number, and a variant of the pinned text
 const m=v.includes(M)?v:sub(v,PINS[0].old,M);
 for(const [a,b] of [['[2.2,','[2.3,'],[',2.803,',',2.804,'],[',6.8];',',6.9];']])fails(sub(m,M,M.replace(a,b)),tag+' SAIL_M1_LOCAL '+a+'->'+b);
 fails(sub(m,M,M.split('/*')[0]),tag+' SAIL_M1_LOCAL without its pinned comment');
}
assert.equal(fs.readFileSync(path.join(ROOT,F),'utf8'),src,'real file changed');
console.log('c3-transport-leg-selftest: PASS');
