'use strict';
// 运镜bot full2-cam: draco glb triangles by node-name regex (same decode as bake-region-nodes.cjs), plus brute-force
// segment/triangle hit, point/triangle distance, ray/AABB. For the b19 dock-model checks (task 5).
const fs=require('fs'),path=require('path'),ROOT=path.resolve(__dirname,'../..');
const mul=(A,B)=>{const C=new Array(16).fill(0);for(let r=0;r<4;r++)for(let c=0;c<4;c++)for(let k=0;k<4;k++)C[c*4+r]+=A[k*4+r]*B[c*4+k];return C;};
const trs=n=>{if(n.matrix)return n.matrix.slice();const [x,y,z,w]=n.rotation||[0,0,0,1],[sx,sy,sz]=n.scale||[1,1,1],t=n.translation||[0,0,0];
 return [(1-2*(y*y+z*z))*sx,2*(x*y+z*w)*sx,2*(x*z-y*w)*sx,0,2*(x*y-z*w)*sy,(1-2*(x*x+z*z))*sy,2*(y*z+x*w)*sy,0,2*(x*z+y*w)*sz,2*(y*z-x*w)*sz,(1-2*(x*x+y*y))*sz,0,t[0],t[1],t[2],1];};
const xf=(M,v)=>[M[0]*v[0]+M[4]*v[1]+M[8]*v[2]+M[12],M[1]*v[0]+M[5]*v[1]+M[9]*v[2]+M[13],M[2]*v[0]+M[6]*v[1]+M[10]*v[2]+M[14]];
async function glbTris(rel,rx,toWorld=p=>p){
 const draco=require('/tmp/draco3d/node_modules/draco3d/draco3d.js'),decMod=await draco.createDecoderModule({});
 const raw=fs.readFileSync(path.join(ROOT,rel)),jl=raw.readUInt32LE(12),doc=JSON.parse(raw.subarray(20,20+jl).toString()),binOff=20+jl+8,bin=raw.subarray(binOff,binOff+raw.readUInt32LE(20+jl));
 const parent={};doc.nodes.forEach((n,i)=>(n.children||[]).forEach(c=>{parent[c]=i;}));
 const glob=i=>{let M=trs(doc.nodes[i]);for(let k=parent[i];k!==undefined;k=parent[k])M=mul(trs(doc.nodes[k]),M);return M;};
 const out={};doc.nodes.forEach((node,i)=>{if(node.mesh===undefined||!rx.test(node.name||''))return;const M=glob(i),T=out[node.name]=out[node.name]||[];
  for(const pr of doc.meshes[node.mesh].primitives){const ext=pr.extensions&&pr.extensions.KHR_draco_mesh_compression;if(!ext)continue;
   const bv=doc.bufferViews[ext.bufferView],data=bin.subarray(bv.byteOffset||0,(bv.byteOffset||0)+bv.byteLength);
   const d=new decMod.Decoder(),buf=new decMod.DecoderBuffer();buf.Init(new Int8Array(data.buffer,data.byteOffset,data.byteLength),data.byteLength);
   const mesh=new decMod.Mesh();if(!d.DecodeBufferToMesh(buf,mesh).ok())throw Error('draco '+node.name);
   const attr=d.GetAttributeByUniqueId(mesh,ext.attributes.POSITION),nv=mesh.num_points(),nf=mesh.num_faces(),pos=new decMod.DracoFloat32Array();d.GetAttributeFloatForAllPoints(mesh,attr,pos);
   const P=[];for(let v=0;v<nv;v++)P.push(toWorld(xf(M,[pos.GetValue(v*3),pos.GetValue(v*3+1),pos.GetValue(v*3+2)])));
   const face=new decMod.DracoInt32Array();for(let f=0;f<nf;f++){d.GetFaceFromMesh(mesh,f,face);T.push([P[face.GetValue(0)],P[face.GetValue(1)],P[face.GetValue(2)]]);}
   [pos,face,mesh,buf,d].forEach(o=>decMod.destroy(o));}});
 return out;}
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function segTri(a,b,[p0,p1,p2]){const d=sub(b,a),e1=sub(p1,p0),e2=sub(p2,p0),h=cross(d,e2),det=dot(e1,h);if(Math.abs(det)<1e-12)return false;const f=1/det,s=sub(a,p0),u=f*dot(s,h);if(u<0||u>1)return false;
 const q=cross(s,e1),v=f*dot(d,q);if(v<0||u+v>1)return false;const t=f*dot(e2,q);return t>1e-4&&t<1-1e-4;}
const bbOf=T=>{const lo=[1e9,1e9,1e9],hi=[-1e9,-1e9,-1e9];for(const t of T)for(const p of t)for(let i=0;i<3;i++){lo[i]=Math.min(lo[i],p[i]);hi[i]=Math.max(hi[i],p[i]);}return [...lo,...hi];};
function segBox(a,b,bx){let t0=0,t1=1;for(let i=0;i<3;i++){const d=b[i]-a[i];if(Math.abs(d)<1e-12){if(a[i]<bx[i]||a[i]>bx[i+3])return false;continue;}let u=(bx[i]-a[i])/d,v=(bx[i+3]-a[i])/d;if(u>v)[u,v]=[v,u];t0=Math.max(t0,u);t1=Math.min(t1,v);if(t0>t1)return false;}return true;}
/** groups: {name:{tris,bb}}; hit(a,b) → name or null */
function group(trisByName){const G=Object.entries(trisByName).map(([n,T])=>({n,T,bb:bbOf(T)}));
 return {G,hit:(a,b)=>{for(const g of G){if(!segBox(a,b,g.bb))continue;for(const t of g.T)if(segTri(a,b,t))return g.n;}return null;},
  dist:(p,cap=5)=>{let best=cap;for(const g of G){const bb=g.bb;let dd=0;for(let i=0;i<3;i++){const v=Math.max(bb[i]-p[i],0,p[i]-bb[i+3]);dd+=v*v;}if(Math.sqrt(dd)>=best)continue;for(const t of g.T)best=Math.min(best,ptTri(p,t));}return best;}};}
function ptTri(p,[a,b,c]){const ab=sub(b,a),ac=sub(c,a),ap=sub(p,a),d1=dot(ab,ap),d2=dot(ac,ap);const L=q=>Math.hypot(...sub(p,q));if(d1<=0&&d2<=0)return L(a);
 const bp=sub(p,b),d3=dot(ab,bp),d4=dot(ac,bp);if(d3>=0&&d4<=d3)return L(b);const vc=d1*d4-d3*d2;if(vc<=0&&d1>=0&&d3<=0){const v=d1/(d1-d3);return L([a[0]+ab[0]*v,a[1]+ab[1]*v,a[2]+ab[2]*v]);}
 const cp=sub(p,c),d5=dot(ab,cp),d6=dot(ac,cp);if(d6>=0&&d5<=d6)return L(c);const vb=d5*d2-d1*d6;if(vb<=0&&d2>=0&&d6<=0){const w=d2/(d2-d6);return L([a[0]+ac[0]*w,a[1]+ac[1]*w,a[2]+ac[2]*w]);}
 const va=d3*d6-d5*d4;if(va<=0&&(d4-d3)>=0&&(d5-d6)>=0){const w=(d4-d3)/((d4-d3)+(d5-d6));return L([b[0]+(c[0]-b[0])*w,b[1]+(c[1]-b[1])*w,b[2]+(c[2]-b[2])*w]);}
 const den=1/(va+vb+vc),v=vb*den,w=vc*den;return L([a[0]+ab[0]*v+ac[0]*w,a[1]+ab[1]*v+ac[1]*w,a[2]+ab[2]*v+ac[2]*w]);}
const inBox=(p,b)=>p[0]>=b[0]&&p[0]<=b[3]&&p[1]>=b[1]&&p[1]<=b[4]&&p[2]>=b[2]&&p[2]<=b[5];
const boxDist=(p,b)=>{let s=0;for(let i=0;i<3;i++){const d=Math.max(b[i]-p[i],0,p[i]-b[i+3]);s+=d*d;}return Math.sqrt(s);};
module.exports={glbTris,group,segTri,segBox,ptTri,bbOf,inBox,boxDist,ROOT};
