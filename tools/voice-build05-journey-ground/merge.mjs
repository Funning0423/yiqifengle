import {NodeIO} from '@gltf-transform/core';import {ALL_EXTENSIONS} from '@gltf-transform/extensions';import draco3d from 'draco3dgltf';import fs from 'fs';
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'draco3d.decoder':await draco3d.createDecoderModule(),'draco3d.encoder':await draco3d.createEncoderModule()});
const [src,add,out]=process.argv.slice(2);const doc=await io.read(src);const A=JSON.parse(fs.readFileSync(add));
for(const m of doc.getRoot().listMeshes()){const a=A[m.getName()];if(!a)continue;const p=m.listPrimitives()[0];const n0=p.getAttribute('POSITION').getCount(),n=a.pos.length;
 const ext=(sem,rows)=>{const acc=p.getAttribute(sem);const old=acc.getArray();const sz=acc.getElementSize();const arr=new old.constructor(old.length+rows.length*sz);arr.set(old);rows.forEach((r,i)=>{for(let k=0;k<sz;k++)arr[old.length+i*sz+k]=r[k];});acc.setArray(arr);};
 ext('POSITION',a.pos);ext('NORMAL',a.nor);ext('TEXCOORD_0',a.uv);
 const col=p.getAttribute('COLOR_0');const white=col.getComponentType()===5123?65535:1;ext('COLOR_0',a.pos.map(()=>Array(col.getElementSize()).fill(white)));
 const ia=p.getIndices();const old=ia.getArray();const need=n0+n>65535?Uint32Array:old.constructor;const arr=new need(old.length+a.idx.length);arr.set(old);a.idx.forEach((v,i)=>arr[old.length+i]=v+n0);ia.setArray(arr);
 console.log(m.getName(),'verts',n0,'->',n0+n,'tris +',a.idx.length/3);}
import {KHRDracoMeshCompression} from '@gltf-transform/extensions';
doc.getRoot().listExtensionsUsed().find(e=>e.extensionName==='KHR_draco_mesh_compression').setEncoderOptions({method:KHRDracoMeshCompression.EncoderMethod.EDGEBREAKER,encodeSpeed:0,decodeSpeed:5,quantizationBits:{POSITION:16,NORMAL:12,TEX_COORD:14,COLOR:10,GENERIC:12}});
await io.write(out,doc);
