'use strict';
// Dumps world-space (glb-root) triangles of a glb inside an XZ box to a compact binary for the offline checks/plots.
// usage: node dump-mesh.cjs <glb> <x0,z0,x1,z1> <out.json> [nameRegex]
const fs=require('node:fs'),path=require('node:path');
const [file,box,out,re]=process.argv.slice(2);const [bx0,bz0,bx1,bz1]=box.split(',').map(Number);const R=re?new RegExp(re):null;
const ROOT=path.resolve(__dirname,'../..');
(async()=>{
 const raw=fs.readFileSync(file);const jl=raw.readUInt32LE(12),doc=JSON.parse(raw.subarray(20,20+jl).toString());
 const bin=raw.subarray(20+jl+8,20+jl+8+raw.readUInt32LE(20+jl));
 const parent={};doc.nodes.forEach((n,i)=>(n.children||[]).forEach(c=>{parent[c]=i;}));
 const mul=(A,B)=>{const C=new Array(16).fill(0);for(let r=0;r<4;r++)for(let c=0;c<4;c++)for(let k=0;k<4;k++)C[c*4+r]+=A[k*4+r]*B[c*4+k];return C;};
 const trs=n=>{if(n.matrix)return n.matrix.slice();const [x,y,z,w]=n.rotation||[0,0,0,1],[sx,sy,sz]=n.scale||[1,1,1],t=n.translation||[0,0,0];
  return [(1-2*(y*y+z*z))*sx,2*(x*y+z*w)*sx,2*(x*z-y*w)*sx,0,2*(x*y-z*w)*sy,(1-2*(x*x+z*z))*sy,2*(y*z+x*w)*sy,0,2*(x*z+y*w)*sz,2*(y*z-x*w)*sz,(1-2*(x*x+y*y))*sz,0,t[0],t[1],t[2],1];};
 const glob=i=>{let M=trs(doc.nodes[i]);for(let k=parent[i];k!==undefined;k=parent[k])M=mul(trs(doc.nodes[k]),M);return M;};
 const xf=(M,v)=>[M[0]*v[0]+M[4]*v[1]+M[8]*v[2]+M[12],M[1]*v[0]+M[5]*v[1]+M[9]*v[2]+M[13],M[2]*v[0]+M[6]*v[1]+M[10]*v[2]+M[14]];
 let dec=null;const res={};
 const C={5120:Int8Array,5121:Uint8Array,5122:Int16Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array},NC={SCALAR:1,VEC3:3};
 const acc=i=>{const a=doc.accessors[i],v=doc.bufferViews[a.bufferView],T=C[a.componentType],n=NC[a.type]||3,st=v.byteStride||T.BYTES_PER_ELEMENT*n,o=(v.byteOffset||0)+(a.byteOffset||0),out=[];
  for(let k=0;k<a.count;k++){const r=[];for(let c=0;c<n;c++){const p=o+k*st+c*T.BYTES_PER_ELEMENT;r.push(T===Float32Array?bin.readFloatLE(p):T===Uint32Array?bin.readUInt32LE(p):T===Uint16Array?bin.readUInt16LE(p):bin.readUInt8(p));}out.push(n===1?r[0]:r);}return out;};
 for(let i=0;i<doc.nodes.length;i++){const node=doc.nodes[i];if(node.mesh===undefined)continue;const name=node.name||'';if(R&&!R.test(name))continue;const M=glob(i),T=[];
  for(const pr of doc.meshes[node.mesh].primitives){const ext=pr.extensions&&pr.extensions.KHR_draco_mesh_compression;let P,F;
   if(ext){if(!dec){const d3=require('/tmp/draco3d/node_modules/draco3d/draco3d.js');dec=await d3.createDecoderModule({});}
    const bv=doc.bufferViews[ext.bufferView],data=bin.subarray(bv.byteOffset||0,(bv.byteOffset||0)+bv.byteLength);
    const d=new dec.Decoder(),buf=new dec.DecoderBuffer();buf.Init(new Int8Array(data.buffer,data.byteOffset,data.byteLength),data.byteLength);
    const mesh=new dec.Mesh();if(!d.DecodeBufferToMesh(buf,mesh).ok())throw Error('draco '+name);
    const attr=d.GetAttributeByUniqueId(mesh,ext.attributes.POSITION),nv=mesh.num_points(),nf=mesh.num_faces(),pos=new dec.DracoFloat32Array();
    d.GetAttributeFloatForAllPoints(mesh,attr,pos);P=[];for(let v=0;v<nv;v++)P.push([pos.GetValue(v*3),pos.GetValue(v*3+1),pos.GetValue(v*3+2)]);
    const face=new dec.DracoInt32Array();F=[];for(let f=0;f<nf;f++){d.GetFaceFromMesh(mesh,f,face);F.push(face.GetValue(0),face.GetValue(1),face.GetValue(2));}
    [pos,face,mesh,buf,d].forEach(o=>dec.destroy(o));}
   else{if(pr.attributes.POSITION===undefined)continue;P=acc(pr.attributes.POSITION);F=pr.indices!==undefined?acc(pr.indices):P.map((_,k)=>k);}
   const W=P.map(p=>xf(M,p));
   for(let f=0;f<F.length;f+=3){const a=W[F[f]],b=W[F[f+1]],c=W[F[f+2]];
    if(Math.max(a[0],b[0],c[0])<bx0||Math.min(a[0],b[0],c[0])>bx1||Math.max(a[2],b[2],c[2])<bz0||Math.min(a[2],b[2],c[2])>bz1)continue;
    T.push(...a.map(v=>+v.toFixed(4)),...b.map(v=>+v.toFixed(4)),...c.map(v=>+v.toFixed(4)));}}
  if(T.length)res[name]=(res[name]||[]).concat(T);}
 fs.writeFileSync(out,JSON.stringify(res));console.log(out,Object.keys(res).length,'nodes',Object.values(res).reduce((s,t)=>s+t.length/9,0),'tris');
})();
