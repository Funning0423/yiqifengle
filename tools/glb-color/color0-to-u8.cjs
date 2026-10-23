'use strict';
// Deterministic: rewrite every FLOAT COLOR_n accessor of a glb to normalized UNSIGNED_BYTE VEC4 (alpha 255 if VEC3).
// Geometry/index/normal bytes are copied unchanged; the BIN chunk is repacked in bufferView order (4-byte aligned).
// Usage: node tools/glb-color/color0-to-u8.cjs <file.glb>...   (in place; no-op if no float colour)
const fs=require('node:fs');
const N={SCALAR:1,VEC2:2,VEC3:3,VEC4:4};
function convert(file){
 const d=fs.readFileSync(file);
 if(d.readUInt32LE(0)!==0x46546c67)throw new Error('not glb '+file);
 const jl=d.readUInt32LE(12);const j=JSON.parse(d.subarray(20,20+jl).toString('utf8'));
 const bo=20+jl;const bl=d.readUInt32LE(bo);const bin=d.subarray(bo+8,bo+8+bl);
 const colorAcc=new Set();
 for(const m of j.meshes||[])for(const p of m.primitives||[])for(const[k,i]of Object.entries(p.attributes||{}))if(/^COLOR_/.test(k)&&j.accessors[i].componentType===5126)colorAcc.add(i);
 if(!colorAcc.size)return {file,changed:0};
 const views=j.bufferViews.map(bv=>Buffer.from(bin.subarray(bv.byteOffset||0,(bv.byteOffset||0)+bv.byteLength)));
 for(const i of [...colorAcc].sort((a,b)=>a-b)){
  const a=j.accessors[i];const bv=j.bufferViews[a.bufferView];
  const used=j.accessors.filter(x=>x.bufferView===a.bufferView).length;
  if(used!==1)throw new Error('shared colour bufferView');
  const c=N[a.type];const st=bv.byteStride||c*4;const src=views[a.bufferView];const out=Buffer.alloc(a.count*4);
  for(let v=0;v<a.count;v++)for(let k=0;k<4;k++){
   let x=k<c?src.readFloatLE((a.byteOffset||0)+v*st+k*4):1;
   if(!Number.isFinite(x))x=k===3?1:0;
   out[v*4+k]=Math.round(Math.min(1,Math.max(0,x))*255);
  }
  views[a.bufferView]=out;delete bv.byteStride;
  a.componentType=5121;a.normalized=true;a.type='VEC4';a.byteOffset=0;delete a.min;delete a.max;
 }
 let off=0;const parts=[];
 j.bufferViews.forEach((bv,i)=>{const pad=(4-off%4)%4;if(pad){parts.push(Buffer.alloc(pad));off+=pad;}bv.byteOffset=off;bv.byteLength=views[i].length;parts.push(views[i]);off+=views[i].length;});
 const pad=(4-off%4)%4;if(pad)parts.push(Buffer.alloc(pad));
 const nb=Buffer.concat(parts);j.buffers[0].byteLength=off;
 let js=Buffer.from(JSON.stringify(j),'utf8');js=Buffer.concat([js,Buffer.alloc((4-js.length%4)%4,0x20)]);
 const h=Buffer.alloc(12);h.writeUInt32LE(0x46546c67,0);h.writeUInt32LE(2,4);h.writeUInt32LE(12+8+js.length+8+nb.length,8);
 const ch=(len,type)=>{const b=Buffer.alloc(8);b.writeUInt32LE(len,0);b.writeUInt32LE(type,4);return b;};
 fs.writeFileSync(file,Buffer.concat([h,ch(js.length,0x4e4f534a),js,ch(nb.length,0x004e4942),nb]));
 return {file,changed:colorAcc.size,before:d.length,after:12+8+js.length+8+nb.length};
}
for(const f of process.argv.slice(2))console.log(JSON.stringify(convert(f)));
