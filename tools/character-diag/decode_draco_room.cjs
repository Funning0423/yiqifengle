'use strict';
// QA-only lossless-to-decoded topology transport. Reads source, writes a separate GLB.
// No transforms, materials, textures, animations, skins or node identities are changed.
const fs=require('fs'),crypto=require('crypto'),path=require('path');
const [input,output,modulePath]=process.argv.slice(2);
if(!input||!output||!modulePath)throw Error('Usage: node decode_draco_room.cjs INPUT OUTPUT /absolute/draco3dgltf');
if(path.resolve(input)===path.resolve(output))throw Error('Refuse source overwrite');
const raw=fs.readFileSync(input),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
if(raw.readUInt32LE(0)!==0x46546c67||raw.readUInt32LE(4)!==2||raw.readUInt32LE(8)!==raw.length)throw Error('Bad GLB');
const jlen=raw.readUInt32LE(12),j=JSON.parse(raw.subarray(20,20+jlen)),o=20+jlen;
const orig=raw.subarray(o+8,o+8+raw.readUInt32LE(o)),bins=[orig];let length=orig.length;
const pre=JSON.stringify({nodes:j.nodes,skins:j.skins,materials:j.materials,images:j.images,animations:j.animations});
const types={5126:[Float32Array,'DracoFloat32Array','GetAttributeFloatForAllPoints'],5121:[Uint8Array,'DracoUInt8Array','GetAttributeUInt8ForAllPoints'],5123:[Uint16Array,'DracoUInt16Array','GetAttributeUInt16ForAllPoints'],5125:[Uint32Array,'DracoUInt32Array','GetAttributeUInt32ForAllPoints']};
const nc={SCALAR:1,VEC2:2,VEC3:3,VEC4:4};
function append(typed,template,target){const pad=(4-length%4)%4;if(pad){bins.push(Buffer.alloc(pad));length+=pad;}const b=Buffer.from(typed.buffer,typed.byteOffset,typed.byteLength),bv=j.bufferViews.length;j.bufferViews.push({buffer:0,byteOffset:length,byteLength:b.length,target});bins.push(b);length+=b.length;const a={...template,bufferView:bv,byteOffset:0,count:typed.length/nc[template.type]};delete a.sparse;const i=j.accessors.length;j.accessors.push(a);return i;}
(async()=>{const pkg=require(modulePath),version=require(path.join(modulePath,'package.json')).version,d=await pkg.createDecoderModule({});const primitives=[];
for(let mi=0;mi<j.meshes.length;mi++)for(let pi=0;pi<j.meshes[mi].primitives.length;pi++){
 const p=j.meshes[mi].primitives[pi],ext=p.extensions?.KHR_draco_mesh_compression;if(!ext)continue;
 const bv=j.bufferViews[ext.bufferView],bytes=orig.subarray(bv.byteOffset||0,(bv.byteOffset||0)+bv.byteLength),dec=new d.Decoder(),buf=new d.DecoderBuffer(),mesh=new d.Mesh();buf.Init(new Int8Array(bytes.buffer,bytes.byteOffset,bytes.length),bytes.length);
 const status=dec.DecodeBufferToMesh(buf,mesh);if(!status.ok())throw Error(status.error_msg());const n=mesh.num_points(),f=mesh.num_faces(),fields={};
 for(const [name,id] of Object.entries(ext.attributes)){
  const old=p.attributes[name],a=j.accessors[old],spec=types[a.componentType];if(!spec)throw Error('Unsupported component type');const attr=dec.GetAttributeByUniqueId(mesh,id);if(attr.num_components()!==nc[a.type])throw Error('Attribute width mismatch');const data=new d[spec[1]]();if(!dec[spec[2]](mesh,attr,data))throw Error('attribute decode failed');if(data.size()!==n*nc[a.type])throw Error('attribute count mismatch');const arr=new spec[0](data.size());for(let k=0;k<arr.length;k++)arr[k]=data.GetValue(k);p.attributes[name]=append(arr,a,34962);fields[name]={vertices:n,components:nc[a.type],componentType:a.componentType,normalized:!!a.normalized,data_sha256:sha(Buffer.from(arr.buffer))};d.destroy(data);
 }
 const a=j.accessors[p.indices],C=a.componentType===5123?Uint16Array:Uint32Array;if(n>65535&&C===Uint16Array)throw Error('index overflow');const faces=new C(f*3),face=new d.DracoInt32Array();for(let k=0;k<f;k++){dec.GetFaceFromMesh(mesh,k,face);for(let e=0;e<3;e++){const v=face.GetValue(e);if(v<0||v>=n)throw Error('invalid triangle index');faces[k*3+e]=v;}}p.indices=append(faces,a,34963);delete p.extensions.KHR_draco_mesh_compression;if(!Object.keys(p.extensions).length)delete p.extensions;
 primitives.push({mesh:mi,name:j.meshes[mi].name,primitive:pi,vertices:n,triangles:f,attributes:fields});for(const x of [face,mesh,buf,dec])d.destroy(x);
}
for(const k of ['extensionsUsed','extensionsRequired'])if(j[k]){j[k]=j[k].filter(s=>s!=='KHR_draco_mesh_compression');if(!j[k].length)delete j[k];}
if(JSON.stringify({nodes:j.nodes,skins:j.skins,materials:j.materials,images:j.images,animations:j.animations})!==pre)throw Error('Unexpected metadata mutation');
const pad=(4-length%4)%4;if(pad){bins.push(Buffer.alloc(pad));length+=pad;}j.buffers[0].byteLength=length;let js=Buffer.from(JSON.stringify(j));js=Buffer.concat([js,Buffer.alloc((4-js.length%4)%4,32)]);const bin=Buffer.concat(bins),h=Buffer.alloc(20),bh=Buffer.alloc(8);h.writeUInt32LE(0x46546c67,0);h.writeUInt32LE(2,4);h.writeUInt32LE(28+js.length+bin.length,8);h.writeUInt32LE(js.length,12);h.write('JSON',16);bh.writeUInt32LE(bin.length,0);bh.write('BIN\0',4);const result=Buffer.concat([h,js,bh,bin]);fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,result);
const report={source_sha256:sha(raw),source_bytes:raw.length,decoded_sha256:sha(result),decoded_bytes:result.length,decoder:{name:'draco3dgltf',version},unchanged_metadata:true,original_binary_prefix_identical:bin.subarray(0,orig.length).equals(orig),meshes:j.meshes.length,nodes:j.nodes.length,decoded_primitives:primitives.length,triangles:primitives.reduce((s,p)=>s+p.triangles,0),primitives};fs.writeFileSync(output+'.decode.json',JSON.stringify(report,null,2));console.log(JSON.stringify({...report,primitives:undefined}));
})().catch(e=>{console.error(e);process.exitCode=1;});
