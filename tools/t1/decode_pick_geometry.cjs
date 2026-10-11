#!/usr/bin/env node
'use strict';
/* T1 几何解码夹具原型（只读 GLB，输出到指定路径；不进生产包）。
 * 准备: (cd tools/vendor-node && npm ci)   # draco3d 1.5.7 精确锁定
 * 用法: [DRACO3D=…] node decode_pick_geometry.cjs <combined_visual_m.glb> <out.json>
 * 解码 env_lighthouse_ext / env_lighthouse_door / env_interior_shell 的 KHR_draco_mesh_compression 三角流，
 * 写入身份：GLB sha256、节点索引/TRS、解码器版本、每条流 sha256、计数与 min/max。 */
const fs=require('fs'),crypto=require('crypto'),path=require('path');
const [glbPath,outPath]=process.argv.slice(2);if(!glbPath||!outPath)throw Error('usage: decode_pick_geometry.cjs GLB OUT');
const dracoDir=process.env.DRACO3D||path.resolve(__dirname,'../vendor-node/node_modules/draco3d');
const draco=require(path.join(dracoDir,'draco3d.js'));const dracoPkg=JSON.parse(fs.readFileSync(path.join(dracoDir,'package.json'),'utf8'));
const NAMES=['env_lighthouse_ext','env_lighthouse_door','env_interior_shell'];
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
(async()=>{
 const raw=fs.readFileSync(glbPath);if(raw.readUInt32LE(0)!==0x46546c67)throw Error('not GLB');
 const jl=raw.readUInt32LE(12),doc=JSON.parse(raw.subarray(20,20+jl).toString()),binOff=20+jl+8,bin=raw.subarray(binOff,binOff+raw.readUInt32LE(20+jl));
 const dec=await draco.createDecoderModule({});const nodes=[];
 for(const [index,node] of doc.nodes.entries()){
  if(!NAMES.includes(node.name))continue;
  const prims=[];
  for(const pr of doc.meshes[node.mesh].primitives){
   const ext=pr.extensions?.KHR_draco_mesh_compression;if(!ext)throw Error('expected draco primitive: '+node.name);
   const bv=doc.bufferViews[ext.bufferView],data=bin.subarray(bv.byteOffset||0,(bv.byteOffset||0)+bv.byteLength);
   const decoder=new dec.Decoder(),buf=new dec.DecoderBuffer();buf.Init(new Int8Array(data.buffer,data.byteOffset,data.byteLength),data.byteLength);
   if(decoder.GetEncodedGeometryType(buf)!==dec.TRIANGULAR_MESH)throw Error('not triangular mesh');
   const mesh=new dec.Mesh(),st=decoder.DecodeBufferToMesh(buf,mesh);if(!st.ok())throw Error('draco decode failed: '+st.error_msg());
   const attr=decoder.GetAttributeByUniqueId(mesh,ext.attributes.POSITION),nv=mesh.num_points(),nf=mesh.num_faces();
   const pos=new dec.DracoFloat32Array();decoder.GetAttributeFloatForAllPoints(mesh,attr,pos);const P=new Float32Array(nv*3);for(let i=0;i<nv*3;i++)P[i]=pos.GetValue(i);
   const I=new Uint32Array(nf*3),face=new dec.DracoInt32Array();for(let f=0;f<nf;f++){decoder.GetFaceFromMesh(mesh,f,face);I[f*3]=face.GetValue(0);I[f*3+1]=face.GetValue(1);I[f*3+2]=face.GetValue(2);}
   [pos,face,mesh,buf,decoder].forEach(o=>dec.destroy(o));
   const acc=doc.accessors[pr.attributes.POSITION],idx=doc.accessors[pr.indices];
   if(acc.count!==nv||idx.count!==nf*3)throw Error(`count mismatch ${node.name}: accessor ${acc.count}/${idx.count} vs decoded ${nv}/${nf*3}`);
   let min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<nv;i++)for(let k=0;k<3;k++){min[k]=Math.min(min[k],P[i*3+k]);max[k]=Math.max(max[k],P[i*3+k]);}
   const tol=1e-3;for(let k=0;k<3;k++)if(Math.abs(min[k]-acc.min[k])>tol||Math.abs(max[k]-acc.max[k])>tol)throw Error('bounds mismatch '+node.name);
   prims.push({vertexCount:nv,indexCount:nf*3,min,max,accessorMin:acc.min,accessorMax:acc.max,positionsSHA256:sha(Buffer.from(P.buffer)),indicesSHA256:sha(Buffer.from(I.buffer)),positions:Array.from(P),indices:Array.from(I)});
  }
  nodes.push({index,name:node.name,translation:node.translation||[0,0,0],rotation:node.rotation||[0,0,0,1],scale:node.scale||[1,1,1],primitives:prims});
 }
 if(nodes.length!==3)throw Error('expected 3 lighthouse pick nodes, got '+nodes.length);
 const out={schema:'t1-lighthouse-pick-geometry/v1',input:{path:path.basename(glbPath),sha256:sha(raw),bytes:raw.length},decoder:{name:'draco3d',version:dracoPkg.version},scope:'QA-only fixture; NOT shipped; regenerate whenever GLB sha256 changes',nodes};
 fs.writeFileSync(outPath,JSON.stringify(out)+'\n');
 console.log(JSON.stringify({input:out.input,decoder:out.decoder,nodes:nodes.map(n=>({name:n.name,index:n.index,prims:n.primitives.map(p=>({v:p.vertexCount,i:p.indexCount,pos:p.positionsSHA256.slice(0,12),idx:p.indicesSHA256.slice(0,12)}))})),outBytes:fs.statSync(outPath).size}));
})().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
