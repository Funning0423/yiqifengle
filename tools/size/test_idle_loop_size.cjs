#!/usr/bin/env node
'use strict';
// v3.2 size: static_seat_preview idle_loop. (1) no channel left whose keys all equal the node rest TRS (lossless strip);
// (2) Creator bake rate = 24 fps = the authoring key grid (every source key on 1/24 s), so the bake reproduces the keys.
const fs=require('fs'),path=require('path'),assert=require('assert');const {strip}=require('./strip-rest-anim-channels.cjs');
const G=path.resolve(__dirname,'../../creator-build-project/assets/bundles/static_seat_preview/room/room_no_original_chair.glb');
const buf=fs.readFileSync(G),{report}=strip(buf);assert.equal(report[0].dropped,0,'rest-constant channels remain');assert.equal(report[0].kept,132);
const jl=buf.readUInt32LE(12),j=JSON.parse(buf.slice(20,20+jl)),bin=buf.slice(20+jl+8);let off=0,n=0;
for(const a of j.animations)for(const c of a.channels){const ac=j.accessors[a.samplers[c.sampler].input],bv=j.bufferViews[ac.bufferView],o=(bv.byteOffset||0)+(ac.byteOffset||0);for(let k=0;k<ac.count;k++){const t=bin.readFloatLE(o+4*k);n++;if(Math.abs(t*24-Math.round(t*24))>1e-3)off++;}}
assert.equal(off,0,'source keys off the 24 fps grid');
const m=JSON.parse(fs.readFileSync(G+'.meta','utf8'));assert.equal(m.subMetas.f2bf2.userData.sample,24);assert.equal(m.userData.animationImportSettings.find(s=>s.name==='idle_loop').fps,24);
const W={translation:12,rotation:16,scale:12},dense=j.animations[0].channels.reduce((s,c)=>s+W[c.target.path],0)*Math.ceil(12.0417*24+1);
console.log('PASS idle_loop: 132 animated channels, 24 fps bake on the authoring grid; dense estimate',dense,'B (was ~1,458,232 B built)');
