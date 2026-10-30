'use strict';
// C3 rule for region/TransitionChain.ts (fullN, Grok Bot approved dedf8853): vs the base, only the preload section
// ('// ── preload' .. PRELOAD_MEMORY_BUDGET_MB) may be rewritten, and it must hold the generated QF_GEN_PRELOAD_BYTES block;
// every other base line must survive unchanged, in order (additions only). Throws AssertionError on violation.
const assert=require('assert');
const A='// ── preload',Z='export const PRELOAD_MEMORY_BUDGET_MB';
function checkTransitionChain(base,src,label='region/TransitionChain.ts',baseRef='base'){
 const cut=s=>{const i=s.indexOf(A),j=s.indexOf(Z);assert.ok(i>=0&&j>i,'C3: '+label+' preload section markers moved');return s.slice(0,i)+s.slice(j);};
 const bl=cut(base).split('\n'),sl=cut(src).split('\n');let k=0;for(const l of sl)if(k<bl.length&&l===bl[k])k++;
 assert.equal(k,bl.length,'C3: '+label+' changed vs '+baseRef+' outside the preload section (first missing base line: '+JSON.stringify(bl[k])+')');
 assert.ok(/QF_GEN_PRELOAD_BYTES_BEGIN[\s\S]*QF_GEN_PRELOAD_BYTES_END/.test(src),'C3: '+label+' preload section is not the generated PRELOAD_BYTES block');
}
module.exports={checkTransitionChain};
