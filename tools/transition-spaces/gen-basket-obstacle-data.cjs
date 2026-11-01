#!/usr/bin/env node
'use strict';
// cand9: copy 场景设计部's transition-anchors.json "basketObstacles" (r, clearM, baked, events) into the generated block of
// creator-build-project/assets/scripts/region/BasketObstacles.ts (the JSON lives under tools/, not in the bundle).
// Run after the JSON changes; test-basket-obstacle-runtime.cjs fails when the block is stale. --check: exit 1 if stale.
const fs=require('fs'),path=require('path');
const R=path.resolve(__dirname,'../..'),J=R+'/tools/transitions-continuous/transition-anchors.json',T=R+'/creator-build-project/assets/scripts/region/BasketObstacles.ts';
const O=JSON.parse(fs.readFileSync(J,'utf8')).basketObstacles;if(!Array.isArray(O)||!O.length)throw Error('basketObstacles missing');
const keys=['id','region','at','r','clearM','initial','on','off','baked'];
const rows=O.map(o=>{for(const k of keys)if(!(k in o))throw Error(o.id+' lacks '+k);return ' '+JSON.stringify(Object.fromEntries(keys.map(k=>[k,o[k]])))+',';});
const block='// BEGIN GENERATED basketObstacles (tools/transition-spaces/gen-basket-obstacle-data.cjs from transition-anchors.json; do not edit)\n'+rows.join('\n')+'\n// END GENERATED basketObstacles';
const src=fs.readFileSync(T,'utf8'),re=/\/\/ BEGIN GENERATED basketObstacles[\s\S]*?\/\/ END GENERATED basketObstacles/;
if(!re.test(src))throw Error('generated block markers missing in BasketObstacles.ts');
const out=src.replace(re,block);
if(process.argv.includes('--check')){if(out!==src){console.error('BasketObstacles.ts stale');process.exit(1);}console.log('in sync');}
else{fs.writeFileSync(T,out);console.log('wrote',O.length,'obstacles');}
module.exports={block};
