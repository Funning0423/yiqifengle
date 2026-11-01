// Transplant only the modified primitives' Draco payloads from new.glb into the untouched original GLB.
import fs from 'fs';
const rd=f=>{const b=fs.readFileSync(f);const jl=b.readUInt32LE(12);const j=JSON.parse(b.slice(20,20+jl).toString());const bo=20+jl;const bl=b.readUInt32LE(bo);return {j,bin:b.slice(bo+8,bo+8+bl)};};
const [origF,newF,outF,...names]=process.argv.slice(2);const O=rd(origF),N=rd(newF);
const view=(G,i)=>{const v=G.j.bufferViews[i];return G.bin.slice(v.byteOffset||0,(v.byteOffset||0)+v.byteLength);};
const drop=new Set(),repl={};
for(const name of names){const om=O.j.meshes.find(m=>m.name===name),nm=N.j.meshes.find(m=>m.name===name);
 om.primitives.forEach((op,pi)=>{const np=nm.primitives[pi];const oe=op.extensions.KHR_draco_mesh_compression,ne=np.extensions.KHR_draco_mesh_compression;
  drop.add(oe.bufferView);repl[oe.bufferView]=view(N,ne.bufferView);oe.attributes=ne.attributes;
  for(const s of Object.keys(op.attributes)){const oa=O.j.accessors[op.attributes[s]],na=N.j.accessors[np.attributes[s]];oa.count=na.count;if(na.min)oa.min=na.min;if(na.max)oa.max=na.max;if(oa.componentType!==na.componentType||oa.normalized!==na.normalized)throw Error('attr type change '+s);}
  const oi=O.j.accessors[op.indices],ni=N.j.accessors[np.indices];oi.count=ni.count;oi.componentType=ni.componentType;delete oi.min;delete oi.max;if(ni.min){oi.min=ni.min;oi.max=ni.max;}
 });}
// rebuild BIN in original view order, replacing modified views in place
const parts=[];let off=0;
O.j.bufferViews.forEach((v,i)=>{const data=i in repl?repl[i]:view(O,i);const pad=(4-off%4)%4;if(pad){parts.push(Buffer.alloc(pad));off+=pad;}v.byteOffset=off;v.byteLength=data.length;parts.push(data);off+=data.length;});
let bin=Buffer.concat(parts);bin=Buffer.concat([bin,Buffer.alloc((4-bin.length%4)%4)]);O.j.buffers[0].byteLength=bin.length;
let js=Buffer.from(JSON.stringify(O.j));js=Buffer.concat([js,Buffer.alloc((4-js.length%4)%4,0x20)]);
const h=Buffer.alloc(12);h.writeUInt32LE(0x46546C67,0);h.writeUInt32LE(2,4);h.writeUInt32LE(12+8+js.length+8+bin.length,8);
const c=(t,d)=>{const x=Buffer.alloc(8);x.writeUInt32LE(d.length,0);x.writeUInt32LE(t,4);return Buffer.concat([x,d]);};
fs.writeFileSync(outF,Buffer.concat([h,c(0x4E4F534A,js),c(0x004E4942,bin)]));
