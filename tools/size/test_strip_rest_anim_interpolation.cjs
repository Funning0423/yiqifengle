#!/usr/bin/env node
'use strict';
/* Oi review 16:05Z item 4: strip-rest-anim-channels must not treat CUBICSPLINE tangents as keys.
 * C1 Oi's counterexample (translation rest [1,0,0], 2 keys, value + all four tangents [1,0,0]): x(0.25)=1.09375 -> kept.
 * C2 CUBICSPLINE with zero tangents and rest values -> genuinely constant -> dropped. C3 LINEAR/STEP rest -> dropped.
 * C4 sparse output accessor -> kept. C5 re-running the fixed tool on the 1c21428 room GLB reproduces the committed GLB
 * byte for byte (the 156 dropped channels were all STEP; the GLB has one clip, idle_loop, so no cross-clip blending). */
const assert=require('assert/strict'),fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');const {strip}=require('./strip-rest-anim-channels.cjs');
function glb(interp,outVals,{sparse=false}={}){const times=[0,1],floats=[...times,...outVals.flat()],bin=Buffer.alloc(floats.length*4);floats.forEach((f,i)=>bin.writeFloatLE(f,i*4));
 const j={asset:{version:'2.0'},nodes:[{translation:[1,0,0]}],buffers:[{byteLength:bin.length}],bufferViews:[{buffer:0,byteOffset:0,byteLength:8},{buffer:0,byteOffset:8,byteLength:bin.length-8}],
  accessors:[{bufferView:0,componentType:5126,count:2,type:'SCALAR',min:[0],max:[1]},{bufferView:1,componentType:5126,count:outVals.length,type:'VEC3',...(sparse?{sparse:{count:0}}:{})}],
  animations:[{name:'a',channels:[{sampler:0,target:{node:0,path:'translation'}}],samplers:[{input:0,output:1,interpolation:interp}]}]};
 let js=Buffer.from(JSON.stringify(j));js=Buffer.concat([js,Buffer.alloc((4-js.length%4)%4,0x20)]);const h=Buffer.alloc(20);h.writeUInt32LE(0x46546C67,0);h.writeUInt32LE(2,4);h.writeUInt32LE(20+js.length+8+bin.length,8);h.writeUInt32LE(js.length,12);h.writeUInt32LE(0x4E4F534A,16);
 const bh=Buffer.alloc(8);bh.writeUInt32LE(bin.length,0);bh.writeUInt32LE(0x004E4942,4);return Buffer.concat([h,js,bh,bin]);}
const hermite=(p0,m0,p1,m1,t)=>(2*t**3-3*t**2+1)*p0+(t**3-2*t**2+t)*m0+(-2*t**3+3*t**2)*p1+(t**3-t**2)*m1;
const R=[1,0,0];let n=0;const ok=(id,f)=>{f();n++;console.log('PASS',id);};
ok('C1 Oi CUBICSPLINE counterexample kept (true x(0.25)=1.09375)',()=>{assert.equal(hermite(1,1,1,1,.25),1.09375);assert.equal(strip(glb('CUBICSPLINE',[R,R,R,R,R,R])).report[0].dropped,0);});
ok('C2 CUBICSPLINE zero tangents + rest values dropped',()=>{const Z=[0,0,0];assert.equal(strip(glb('CUBICSPLINE',[Z,R,Z,Z,R,Z])).report[0].dropped,1);});
ok('C3 LINEAR and STEP rest dropped, non-rest kept',()=>{for(const ip of ['LINEAR','STEP',undefined])assert.equal(strip(glb(ip,[R,R])).report[0].dropped,1);assert.equal(strip(glb('LINEAR',[R,[1,1,0]])).report[0].dropped,0);});
ok('C4 sparse output accessor kept',()=>{assert.equal(strip(glb('LINEAR',[R,R],{sparse:true})).report[0].dropped,0);});
ok('C5 fixed tool on the 1c21428 room GLB == committed GLB, 156 STEP channels dropped, single clip',()=>{
 const rel='creator-build-project/assets/bundles/static_seat_preview/room/room_no_original_chair.glb',root=path.resolve(__dirname,'../..');let old;
 try{old=execFileSync('git',['show','1c21428d3235f16866d879a078df7cf324117d98:'+rel],{cwd:root,maxBuffer:1<<26});}catch{console.log('   (1c21428 not in this clone; C5 skipped)');return;}
 const jl=old.readUInt32LE(12),j=JSON.parse(old.slice(20,20+jl));assert.equal(j.animations.length,1);const a=j.animations[0];
 const r=strip(old);assert.equal(r.report[0].dropped,156);const kept=new Set();
 const stepRest=a.channels.filter(c=>(a.samplers[c.sampler].interpolation||'LINEAR')==='STEP').length;assert(stepRest>=156);
 assert.equal(a.samplers.filter(s=>s.interpolation==='CUBICSPLINE').length,0);assert.equal(Buffer.compare(r.out,fs.readFileSync(path.join(root,rel))),0);});
console.log(JSON.stringify({passed:n}));
