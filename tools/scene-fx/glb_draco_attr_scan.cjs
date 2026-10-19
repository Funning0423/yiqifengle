'use strict';
/* 场景特效bot r5 S3 r4c (QA only). node glb_draco_attr_scan.cjs out.json file.glb...: every KHR_draco primitive: decoded attribute type / normalized / count / value range vs its accessor. DRACO3D as for skycity_foliage_fix.cjs. */
const fs=require('fs'),path=require('path');const D3=require(require('path').join(require('../camera-frame-test/glb_geometry.cjs').dracoDir(),'draco3d.js'));
const DT={1:5120,2:5121,3:5122,4:5123,6:5125,9:5126},NM={1:'i8',2:'u8',3:'i16',4:'u16',5:'i32',6:'u32',9:'f32'},CT={5120:'i8',5121:'u8',5122:'i16',5123:'u16',5125:'u32',5126:'f32'};
D3.createDecoderModule({}).then(D=>{const out={};for(const f of process.argv.slice(3)){const b=fs.readFileSync(f);if(b.readUInt32LE(0)!==0x46546C67)continue;const jl=b.readUInt32LE(12),j=JSON.parse(b.slice(20,20+jl)),bin=b.length>28+jl?b.slice(28+jl,28+jl+b.readUInt32LE(20+jl)):null;
 const iss=[];let prims=0;(j.meshes||[]).forEach((m,mi)=>m.primitives.forEach((pr,pi)=>{const ext=(pr.extensions||{}).KHR_draco_mesh_compression;if(!ext)return;prims++;const bv=j.bufferViews[ext.bufferView];
  const data=bin.slice(bv.byteOffset||0,(bv.byteOffset||0)+bv.byteLength);const d=new D.Decoder(),buf=new D.DecoderBuffer();buf.Init(new Int8Array(data.buffer,data.byteOffset,data.byteLength),data.byteLength);const mesh=new D.Mesh();
  if(!d.DecodeBufferToMesh(buf,mesh).ok()){iss.push({mesh:m.name,prim:pi,issue:'decode failed'});return;}const np=mesh.num_points(),nf=mesh.num_faces();
  if(pr.indices!==undefined&&j.accessors[pr.indices].count!==nf*3)iss.push({mesh:m.name,prim:pi,attr:'indices',issue:'count '+j.accessors[pr.indices].count+' vs faces*3 '+nf*3});
  for(const k in ext.attributes){const a=d.GetAttributeByUniqueId(mesh,ext.attributes[k]),acc=j.accessors[pr.attributes[k]];if(!acc){iss.push({mesh:m.name,prim:pi,attr:k,issue:'no accessor'});continue;}
   const dt=a.data_type(),arr=new D.DracoFloat32Array();d.GetAttributeFloatForAllPoints(mesh,a,arr);let lo=1e30,hi=-1e30;for(let i=0;i<np*a.num_components();i++){const v=arr.GetValue(i);if(v<lo)lo=v;if(v>hi)hi=v;}D.destroy(arr);
   const r={mesh:m.name,prim:pi,attr:k,draco:NM[dt]+(a.normalized()?'n':''),accessor:CT[acc.componentType]+(acc.normalized?'n':''),range:[+lo.toFixed(4),+hi.toFixed(4)]},p=[];
   if(DT[dt]!==acc.componentType)p.push('componentType');if(!!a.normalized()!==!!acc.normalized&&dt!==9)p.push('normalized');if(acc.count!==np)p.push('count '+acc.count+' vs '+np);
   if(dt===9&&acc.componentType!==5126)p.push('float data behind integer accessor');if(k.startsWith('COLOR')&&dt===9&&(hi>1.0001||lo<-0.0001))p.push('float colour outside 0..1');
   if(p.length){r.issue=p.join('; ');iss.push(r);}}
  [mesh,buf,d].forEach(o=>D.destroy(o));}));out[f]={dracoPrims:prims,issues:iss};}
 fs.writeFileSync(process.argv[2],JSON.stringify(out,null,1));for(const f in out)if(out[f].issues.length)console.log(f,JSON.stringify(out[f].issues));console.log('files',Object.keys(out).length,'with draco',Object.values(out).filter(o=>o.dracoPrims).length);});
