'use strict';
// b20 skin-bounds: decode a (Draco or plain) GLB and return, for every skinned mesh node, the box from the OLD node-matrix path and from
// lib-glb's vertexMapper (Creator bind pose). Used by test_glb_skin_bounds.cjs and the island/meadow scan report.
const fs=require('fs'),path=require('path'),LG=require('../journey-integration/occlusion/lib-glb.cjs');
async function skinnedBoxes(file,dracoDir){const raw=fs.readFileSync(file),jl=raw.readUInt32LE(12),doc=JSON.parse(raw.subarray(20,20+jl)),bo=20+jl+8,bin=raw.subarray(bo,bo+raw.readUInt32LE(20+jl));
 const worlds=LG.nodeWorlds(doc),out=[];if(!(doc.skins||[]).length)return out;let dm=null;
 const ibm=si=>{const A=doc.accessors[doc.skins[si].inverseBindMatrices],v=doc.bufferViews[A.bufferView],o=(v.byteOffset||0)+(A.byteOffset||0);return k=>Array.from({length:16},(_,e)=>bin.readFloatLE(o+(k*16+e)*4));};
 const g={json:doc,bin};
 for(const [i,n] of doc.nodes.entries()){if(n.skin===undefined||n.mesh===undefined)continue;const map=LG.vertexMapper(doc,i,worlds,ibm(n.skin));
  const box=()=>({mn:[1e9,1e9,1e9],mx:[-1e9,-1e9,-1e9]}),A=box(),B=box(),add=(b,p)=>{for(let c=0;c<3;c++){b.mn[c]=Math.min(b.mn[c],p[c]);b.mx[c]=Math.max(b.mx[c],p[c]);}};
  for(const pr of doc.meshes[n.mesh].primitives){const ext=pr.extensions&&pr.extensions.KHR_draco_mesh_compression;let P,J,W,nv;
   if(ext){if(!dm){if(!dracoDir)throw Error('draco GLB needs DRACO3D');dm=await require(path.join(dracoDir,'draco3d.js')).createDecoderModule({});}
    const bv=doc.bufferViews[ext.bufferView],data=bin.subarray(bv.byteOffset||0,(bv.byteOffset||0)+bv.byteLength),d=new dm.Decoder(),buf=new dm.DecoderBuffer();
    buf.Init(new Int8Array(data.buffer,data.byteOffset,data.byteLength),data.byteLength);const mesh=new dm.Mesh();if(!d.DecodeBufferToMesh(buf,mesh).ok())throw Error('draco '+n.name);nv=mesh.num_points();
    const rd=(id,w)=>{const a=d.GetAttributeByUniqueId(mesh,id),arr=new dm.DracoFloat32Array();d.GetAttributeFloatForAllPoints(mesh,a,arr);const nc=a.num_components(),o=new Float64Array(nv*w);for(let v=0;v<nv;v++)for(let c=0;c<Math.min(w,nc);c++)o[v*w+c]=arr.GetValue(v*nc+c);dm.destroy(arr);return o;};
    P=rd(ext.attributes.POSITION,3);J=rd(ext.attributes.JOINTS_0,4);W=rd(ext.attributes.WEIGHTS_0,4);[mesh,buf,d].forEach(o=>dm.destroy(o));}
   else{P=LG.accessor(g,pr.attributes.POSITION);J=LG.accessor(g,pr.attributes.JOINTS_0);W=LG.accessor(g,pr.attributes.WEIGHTS_0);nv=P.length/3;}
   for(let v=0;v<nv;v++){const p=[P[v*3],P[v*3+1],P[v*3+2]];add(A,LG.xf(worlds[i],p));add(B,map(p,J.subarray(v*4,v*4+4),W.subarray(v*4,v*4+4)));}}
  const c=b=>b.mn.map((x,k)=>(x+b.mx[k])/2);out.push({name:n.name,old:{center:c(A),min:A.mn,max:A.mx},fixed:{center:c(B),min:B.mn,max:B.mx}});}
 return out;}
module.exports={skinnedBoxes};
