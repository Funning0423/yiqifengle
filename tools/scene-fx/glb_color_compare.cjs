'use strict';
/* 场景特效bot r5 S3 r4c (QA only). node glb_color_compare.cjs a.glb b.glb meshName: COLOR_0 per vertex as each accessor says (vertices matched on pos/normal/uv), faces as corner sets; pass = all matched and max error <= 1/255. DRACO3D as for skycity_foliage_fix.cjs. */
const fs=require('fs');const D3=require(require('path').join(require('../camera-frame-test/glb_geometry.cjs').dracoDir(),'draco3d.js'));
function dec(D,f,name){const b=fs.readFileSync(f),jl=b.readUInt32LE(12),j=JSON.parse(b.slice(20,20+jl)),bin=b.slice(28+jl,28+jl+b.readUInt32LE(20+jl));const m=j.meshes.find(m=>m.name===name),pr=m.primitives[0],ext=pr.extensions.KHR_draco_mesh_compression,bv=j.bufferViews[ext.bufferView];
 const data=bin.slice(bv.byteOffset,bv.byteOffset+bv.byteLength);const d=new D.Decoder(),db=new D.DecoderBuffer(),mesh=new D.Mesh();db.Init(new Int8Array(data.buffer,data.byteOffset,data.byteLength),data.byteLength);d.DecodeBufferToMesh(db,mesh);
 const np=mesh.num_points(),A={};for(const k in ext.attributes){const a=d.GetAttributeByUniqueId(mesh,ext.attributes[k]),c=a.num_components(),arr=new D.DracoFloat32Array();d.GetAttributeFloatForAllPoints(mesh,a,arr);const v=[];for(let i=0;i<np*c;i++)v.push(arr.GetValue(i));
  const acc=j.accessors[pr.attributes[k]];const sc=acc.normalized?{5121:255,5123:65535}[acc.componentType]:1;A[k]={c,v:v.map(x=>x/sc),acc:acc.componentType+(acc.normalized?'n':''),dt:a.data_type()};}
 const F=[],fa=new D.DracoInt32Array();for(let i=0;i<mesh.num_faces();i++){d.GetFaceFromMesh(mesh,i,fa);F.push([fa.GetValue(0),fa.GetValue(1),fa.GetValue(2)]);}return {np,A,F};}
D3.createDecoderModule({}).then(D=>{const [fa,fb,name]=process.argv.slice(2);const X=dec(D,fa,name),Y=dec(D,fb,name);
 const key=(M,i)=>['POSITION','NORMAL','TEXCOORD_0'].map(k=>M.A[k].v.slice(i*M.A[k].c,(i+1)*M.A[k].c).map(x=>x.toFixed(4)).join(',')).join('|');
 const H=new Map();for(let i=0;i<Y.np;i++){const k=key(Y,i);if(!H.has(k))H.set(k,[]);H.get(k).push(i);}
 let unmatched=0,maxC=0,maxCi=-1,amb=0;const map=new Int32Array(X.np).fill(-1);
 for(let i=0;i<X.np;i++){const L=H.get(key(X,i));if(!L){unmatched++;continue;}if(L.length>1)amb++;let best=-1,bd=1e9;for(const j of L){let dd=0;for(let e=0;e<X.A.COLOR_0.c;e++)dd=Math.max(dd,Math.abs(X.A.COLOR_0.v[i*X.A.COLOR_0.c+e]-Y.A.COLOR_0.v[j*Y.A.COLOR_0.c+e]));if(dd<bd){bd=dd;best=j;}}map[i]=best;if(bd>maxC){maxC=bd;maxCi=i;}}
 const fk=(f)=>f.slice().sort().join(',');const FY=new Set(Y.F.map(f=>fk(f.map(v=>key(Y,v)))));let fmiss=0;for(const f of X.F)if(!FY.has(fk(f.map(v=>key(X,v)))))fmiss++;
 console.log(JSON.stringify({mesh:name,points:[X.np,Y.np],faces:[X.F.length,Y.F.length],colorAccessor:[X.A.COLOR_0.acc,Y.A.COLOR_0.acc],colorDraco:[X.A.COLOR_0.dt,Y.A.COLOR_0.dt],unmatchedVerts:unmatched,ambiguousKeys:amb,facesNotFound:fmiss,
  maxColorErr:+maxC.toFixed(6),maxColorErrIn255:+(maxC*255).toFixed(4),pass:unmatched===0&&fmiss===0&&maxC<=1/255+1e-9,worstVertex:maxCi>=0?{a:X.A.COLOR_0.v.slice(maxCi*4,maxCi*4+4),b:Y.A.COLOR_0.v.slice(map[maxCi]*4,map[maxCi]*4+4)}:null}));});
