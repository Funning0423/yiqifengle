'use strict';
// Minimal dependency-free glTF-binary reader: node hierarchy + world-space triangle soup per node.
const fs=require('node:fs');
const C={5120:Int8Array,5121:Uint8Array,5122:Int16Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array},N={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16};
function readGlb(file){const b=fs.readFileSync(file);if(b.readUInt32LE(0)!==0x46546c67)throw Error('not glb '+file);let o=12,json=null,bin=null;
 while(o<b.length){const len=b.readUInt32LE(o),type=b.readUInt32LE(o+4),chunk=b.subarray(o+8,o+8+len);if(type===0x4e4f534a)json=JSON.parse(chunk.toString('utf8'));else if(type===0x004e4942)bin=chunk;o+=8+len;}
 return {json,bin};}
function accessor(g,i){const a=g.json.accessors[i],v=g.json.bufferViews[a.bufferView],T=C[a.componentType],n=N[a.type],stride=v.byteStride||T.BYTES_PER_ELEMENT*n,out=new Float64Array(a.count*n),base=(v.byteOffset||0)+(a.byteOffset||0);
 const dv=new DataView(g.bin.buffer,g.bin.byteOffset);const rd={5126:(p)=>dv.getFloat32(p,true),5125:p=>dv.getUint32(p,true),5123:p=>dv.getUint16(p,true),5121:p=>dv.getUint8(p),5122:p=>dv.getInt16(p,true),5120:p=>dv.getInt8(p)}[a.componentType];
 for(let k=0;k<a.count;k++)for(let c=0;c<n;c++)out[k*n+c]=rd(base+k*stride+c*T.BYTES_PER_ELEMENT);return out;}
const mul=(a,b)=>{const r=new Array(16).fill(0);for(let c=0;c<4;c++)for(let rr=0;rr<4;rr++)for(let k=0;k<4;k++)r[c*4+rr]+=a[k*4+rr]*b[c*4+k];return r;};
function trs(n){if(n.matrix)return n.matrix.slice();const [x,y,z,w]=n.rotation||[0,0,0,1],[sx,sy,sz]=n.scale||[1,1,1],[tx,ty,tz]=n.translation||[0,0,0];
 return [(1-2*(y*y+z*z))*sx,(2*(x*y+z*w))*sx,(2*(x*z-y*w))*sx,0,(2*(x*y-z*w))*sy,(1-2*(x*x+z*z))*sy,(2*(y*z+x*w))*sy,0,(2*(x*z+y*w))*sz,(2*(y*z-x*w))*sz,(1-2*(x*x+y*y))*sz,0,tx,ty,tz,1];}
const I=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const xf=(m,p)=>[m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12],m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13],m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]];
/** Returns {nodes:[{name,path,world(matrix), meshTris:Float64Array(9 per tri) in node-local->root space}]} */
function load(file,{tris=true}={}){const g=readGlb(file),out=[];const scene=g.json.scenes[g.json.scene||0];
 const walk=(i,parent,pathStr)=>{const n=g.json.nodes[i],w=mul(parent,trs(n)),name=n.name||('node'+i),p=pathStr?pathStr+'/'+name:name;const rec={name,path:p,world:w,mesh:n.mesh,tris:null};
  if(tris&&n.mesh!==undefined){const list=[];for(const prim of g.json.meshes[n.mesh].primitives){if(prim.mode!==undefined&&prim.mode!==4)continue;const P=accessor(g,prim.attributes.POSITION),idx=prim.indices!==undefined?accessor(g,prim.indices):Float64Array.from({length:P.length/3},(_,k)=>k);
   const W=[];for(let k=0;k<P.length;k+=3)W.push(xf(w,[P[k],P[k+1],P[k+2]]));for(let k=0;k+2<idx.length;k+=3)list.push(...W[idx[k]],...W[idx[k+1]],...W[idx[k+2]]);}rec.tris=Float64Array.from(list);}
  out.push(rec);for(const c of n.children||[])walk(c,w,p);};
 for(const r of scene.nodes)walk(r,I,'');return out;}
module.exports={load,xf,mul,trs};
