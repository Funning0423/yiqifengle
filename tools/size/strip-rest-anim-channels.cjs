#!/usr/bin/env node
'use strict';
/* Lossless (LINEAR/STEP; CUBICSPLINE only when all tangents are 0): drop glTF animation channels whose every key equals the node's rest TRS (|Δ| < 1e-6 per component).
 * Creator bakes every channel densely at the clip's sample rate, so a constant rest channel costs ~362 frames x 12–16 B
 * and changes nothing on screen (the node already sits at its rest TRS). Only the JSON chunk changes; the BIN chunk
 * (meshes, Draco, images, unused accessors) is byte-identical. Usage: node strip-rest-anim-channels.cjs <in.glb> <out.glb> */
const fs=require('fs');
function strip(buf){const jl=buf.readUInt32LE(12),j=JSON.parse(buf.slice(20,20+jl).toString('utf8')),rest=buf.slice(20+jl),bin=rest.slice(8);
 const NC={SCALAR:1,VEC2:2,VEC3:3,VEC4:4},rd=i=>{const a=j.accessors[i],bv=j.bufferViews[a.bufferView],n=NC[a.type],o=(bv.byteOffset||0)+(a.byteOffset||0),st=bv.byteStride||4*n,out=[];if(a.componentType!==5126||a.sparse||a.bufferView===undefined||a.normalized)return null;for(let k=0;k<a.count;k++){const r=[];for(let c=0;c<n;c++)r.push(bin.readFloatLE(o+k*st+c*4));out.push(r);}return out;};
 const report=[];
 for(const a of j.animations||[]){const keep=[],used=new Map(),samplers=[];let dropped=0;
  for(const c of a.channels){const s=a.samplers[c.sampler],v=rd(s.output),n=j.nodes[c.target.node];
   const restv=c.target.path==='translation'?(n.translation||[0,0,0]):c.target.path==='rotation'?(n.rotation||[0,0,0,1]):c.target.path==='scale'?(n.scale||[1,1,1]):null;
   // Oi review 16:05Z: CUBICSPLINE output is [inTangent, value, outTangent] per key; the curve is constant only if every
   // value equals rest AND every tangent is zero. Unknown interpolation, sparse/normalized/non-float accessors: keep.
   const ip=s.interpolation||'LINEAR';let isRest=false;
   if(v&&restv&&(ip==='LINEAR'||ip==='STEP'))isRest=v.every(x=>x.every((y,i)=>Math.abs(y-restv[i])<1e-6));
   else if(v&&restv&&ip==='CUBICSPLINE'&&v.length%3===0)isRest=v.every((x,k)=>x.every((y,i)=>k%3===1?Math.abs(y-restv[i])<1e-6:Math.abs(y)<1e-6));
   if(isRest){dropped++;continue;}
   if(!used.has(c.sampler)){used.set(c.sampler,samplers.length);samplers.push(s);}keep.push({...c,sampler:used.get(c.sampler)});}
  report.push({animation:a.name,channels:a.channels.length,dropped,kept:keep.length});a.channels=keep;a.samplers=samplers;}
 let js=Buffer.from(JSON.stringify(j),'utf8');const pad=(4-js.length%4)%4;js=Buffer.concat([js,Buffer.alloc(pad,0x20)]);
 const out=Buffer.alloc(12+8+js.length+rest.length);out.writeUInt32LE(0x46546C67,0);out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);out.writeUInt32LE(js.length,12);out.writeUInt32LE(0x4E4F534A,16);js.copy(out,20);rest.copy(out,20+js.length);
 return {out,report};}
module.exports={strip};
if(require.main===module){const [i,o]=process.argv.slice(2);const {out,report}=strip(fs.readFileSync(i));fs.writeFileSync(o,out);console.log(JSON.stringify(report));}
