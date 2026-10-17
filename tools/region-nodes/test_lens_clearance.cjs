'use strict';
/**
 * Finale and map lenses stay ≥ 0.6 m from scene meshes.
 * Walk grids follow maps/topmap.cjs (normal |ny|/len > 0.72, step 0.36 * hypot * (cell/0.4));
 * the camera test uses the decoded skycity triangles, which are the scene bounds those grids were built from.
 */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {load,ROOT}=require('./load.cjs');
const C=load('region/ExploreCameraCore.ts');

assert.equal(C.LENS_CLEAR_M,0.6);
const bake=fs.readFileSync(path.join(ROOT,'tools/region-nodes/bake-region-nodes.cjs'),'utf8');
assert.ok(bake.includes('up>.72'),'floor rule matches topmap.cjs');
assert.ok(bake.includes('STEP=.36'),'step rule matches topmap.cjs');
const topmap=fs.readFileSync(path.join(ROOT,'../../r5-region-nodes-r3/maps/topmap.cjs'),'utf8');
assert.ok(topmap.includes('up>.72')&&topmap.includes('STEP=.36'));

const girl=[0.2,0.03,-27.8],ring=[-0.238,20,-24.327],head=[girl[0],girl[1]+1.55,girl[2]];
const look=C.finaleLook(girl,ring);
for(const p of [girl,head,ring]){
 const n=C.projectNdc(look,p,390,844);
 assert.ok(n.z>0.5&&Math.abs(n.x)<0.95&&Math.abs(n.y)<0.98, 'finale keeps the subject in frame');
}
assert.ok(C.projectNdc(look,ring,390,844).y>C.projectNdc(look,head,390,844).y,'ring sits above her');

const blocking={min:[look.position[0]-0.1,look.position[1]-0.1,look.position[2]-0.1],max:[look.position[0]+0.1,look.position[1]+0.1,look.position[2]+0.1]};
assert.equal(C.boxGap(look.position,blocking),0);
const retreated=C.retreatClear(look,[blocking]);
assert.ok(C.nearestGap(retreated.position,[blocking])>=C.LENS_CLEAR_M-1e-6);
assert.ok(C.nearestGap([retreated.position[0],retreated.position[1],retreated.position[2]],[blocking])>=0.6);
const map=C.mapPose(girl,1.2,390,844);
const shoved=C.retreatClear(map,[blocking]);
assert.ok(C.nearestGap(shoved.position,[blocking])>=0.6);

function distPointTri(p,a,b,c){
 const ab=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],ac=[c[0]-a[0],c[1]-a[1],c[2]-a[2]],ap=[p[0]-a[0],p[1]-a[1],p[2]-a[2]];
 const d1=ab[0]*ap[0]+ab[1]*ap[1]+ab[2]*ap[2],d2=ac[0]*ap[0]+ac[1]*ap[1]+ac[2]*ap[2];
 if(d1<=0&&d2<=0)return Math.hypot(ap[0],ap[1],ap[2]);
 const bp=[p[0]-b[0],p[1]-b[1],p[2]-b[2]],d3=ab[0]*bp[0]+ab[1]*bp[1]+ab[2]*bp[2],d4=ac[0]*bp[0]+ac[1]*bp[1]+ac[2]*bp[2];
 if(d3>=0&&d4<=d3)return Math.hypot(bp[0],bp[1],bp[2]);
 const vc=d1*d4-d3*d2;if(vc<=0&&d1>=0&&d3<=0){const v=d1/(d1-d3);return Math.hypot(a[0]+ab[0]*v-p[0],a[1]+ab[1]*v-p[1],a[2]+ab[2]*v-p[2]);}
 const cp=[p[0]-c[0],p[1]-c[1],p[2]-c[2]],d5=ab[0]*cp[0]+ab[1]*cp[1]+ab[2]*cp[2],d6=ac[0]*cp[0]+ac[1]*cp[1]+ac[2]*cp[2];
 if(d6>=0&&d5<=d6)return Math.hypot(cp[0],cp[1],cp[2]);
 const vb=d5*d2-d1*d6;if(vb<=0&&d2>=0&&d6<=0){const w=d2/(d2-d6);return Math.hypot(a[0]+ac[0]*w-p[0],a[1]+ac[1]*w-p[1],a[2]+ac[2]*w-p[2]);}
 const va=d3*d6-d5*d4;if(va<=0&&(d4-d3)>=0&&(d5-d6)>=0){const w=(d4-d3)/((d4-d3)+(d5-d6));return Math.hypot(b[0]+(c[0]-b[0])*w-p[0],b[1]+(c[1]-b[1])*w-p[1],b[2]+(c[2]-b[2])*w-p[2]);}
 const denom=1/(va+vb+vc),v=vb*denom,w=vc*denom;
 return Math.hypot(a[0]+ab[0]*v+ac[0]*w-p[0],a[1]+ab[1]*v+ac[1]*w-p[1],a[2]+ab[2]*v+ac[2]*w-p[2]);
}
function rayTri(o,d,a,b,c){
 const e1=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],e2=[c[0]-a[0],c[1]-a[1],c[2]-a[2]];
 const p=[d[1]*e2[2]-d[2]*e2[1],d[2]*e2[0]-d[0]*e2[2],d[0]*e2[1]-d[1]*e2[0]];
 const det=e1[0]*p[0]+e1[1]*p[1]+e1[2]*p[2];if(Math.abs(det)<1e-8)return null;
 const inv=1/det,tvec=[o[0]-a[0],o[1]-a[1],o[2]-a[2]];
 const u=(tvec[0]*p[0]+tvec[1]*p[1]+tvec[2]*p[2])*inv;if(u<0||u>1)return null;
 const q=[tvec[1]*e1[2]-tvec[2]*e1[1],tvec[2]*e1[0]-tvec[0]*e1[2],tvec[0]*e1[1]-tvec[1]*e1[0]];
 const v=(d[0]*q[0]+d[1]*q[1]+d[2]*q[2])*inv;if(v<0||u+v>1)return null;
 const t=(e2[0]*q[0]+e2[1]*q[1]+e2[2]*q[2])*inv;return t>0.05?t:null;
}

(async()=>{
 const dir=path.join('/tmp/draco3d/node_modules/draco3d');
 const draco=require(path.join(dir,'draco3d.js'));
 const decMod=await draco.createDecoderModule({});
 const file=path.join(ROOT,'creator-build-project/assets/bundles/region_skycity/env_skycity.glb');
 const raw=fs.readFileSync(file);
 const jl=raw.readUInt32LE(12),doc=JSON.parse(raw.subarray(20,20+jl).toString());
 const binOff=20+jl+8,bin=raw.subarray(binOff,binOff+raw.readUInt32LE(20+jl));
 const parent={};doc.nodes.forEach((n,i)=>(n.children||[]).forEach(c=>{parent[c]=i;}));
 const mul=(A,B)=>{const M=new Array(16).fill(0);for(let r=0;r<4;r++)for(let c=0;c<4;c++)for(let k=0;k<4;k++)M[c*4+r]+=A[k*4+r]*B[c*4+k];return M;};
 const trs=n=>{if(n.matrix)return n.matrix.slice();const [x,y,z,w]=n.rotation||[0,0,0,1],[sx,sy,sz]=n.scale||[1,1,1],t=n.translation||[0,0,0];
  return [(1-2*(y*y+z*z))*sx,2*(x*y+z*w)*sx,2*(x*z-y*w)*sx,0,2*(x*y-z*w)*sy,(1-2*(x*x+z*z))*sy,2*(y*z+x*w)*sy,0,2*(x*z+y*w)*sz,2*(y*z-x*w)*sz,(1-2*(x*x+y*y))*sz,0,t[0],t[1],t[2],1];};
 const glob=i=>{let M=trs(doc.nodes[i]);for(let k=parent[i];k!==undefined;k=parent[k])M=mul(trs(doc.nodes[k]),M);return M;};
 const xf=(M,v)=>[M[0]*v[0]+M[4]*v[1]+M[8]*v[2]+M[12],M[1]*v[0]+M[5]*v[1]+M[9]*v[2]+M[13],M[2]*v[0]+M[6]*v[1]+M[10]*v[2]+M[14]];
 const meshes=[];
 for(let i=0;i<doc.nodes.length;i++){
  const node=doc.nodes[i];if(node.mesh===undefined)continue;
  if(/cloud|cumulus|cloudsea|birds|greattree/.test(node.name||''))continue;
  const M=glob(i),tris=[];
  for(const pr of doc.meshes[node.mesh].primitives){
   const ext=pr.extensions&&pr.extensions.KHR_draco_mesh_compression;if(!ext)continue;
   const bv=doc.bufferViews[ext.bufferView],data=bin.subarray(bv.byteOffset||0,(bv.byteOffset||0)+bv.byteLength);
   const d=new decMod.Decoder(),buf=new decMod.DecoderBuffer();
   buf.Init(new Int8Array(data.buffer,data.byteOffset,data.byteLength),data.byteLength);
   const mesh=new decMod.Mesh();if(!d.DecodeBufferToMesh(buf,mesh).ok())throw Error('draco '+node.name);
   const attr=d.GetAttributeByUniqueId(mesh,ext.attributes.POSITION),nv=mesh.num_points(),nf=mesh.num_faces(),pos=new decMod.DracoFloat32Array();
   d.GetAttributeFloatForAllPoints(mesh,attr,pos);const P=new Array(nv);
   for(let v=0;v<nv;v++)P[v]=xf(M,[pos.GetValue(v*3),pos.GetValue(v*3+1),pos.GetValue(v*3+2)]);
   const face=new decMod.DracoInt32Array();
   for(let f=0;f<nf;f++){d.GetFaceFromMesh(mesh,f,face);tris.push(P[face.GetValue(0)],P[face.GetValue(1)],P[face.GetValue(2)]);}
   [pos,face,mesh,buf,d].forEach(o=>decMod.destroy(o));
  }
  if(tris.length)meshes.push({name:node.name,tris});
 }
 const cam=look.position;
 let gap=1e9,gapName='';
 for(const m of meshes){const t=m.tris;for(let i=0;i<t.length;i+=3){const d=distPointTri(cam,t[i],t[i+1],t[i+2]);if(d<gap){gap=d;gapName=m.name;}}}
 assert.ok(gap>=0.6,'finale camera '+gap.toFixed(2)+'m from '+gapName);
 const F=[look.target[0]-cam[0],look.target[1]-cam[1],look.target[2]-cam[2]];
 const FL=Math.hypot(F[0],F[1],F[2])||1;F[0]/=FL;F[1]/=FL;F[2]/=FL;
 const nearP=[cam[0]+F[0]*0.2,cam[1]+F[1]*0.2,cam[2]+F[2]*0.2];
 let nearGap=1e9;
 for(const m of meshes){const t=m.tris;for(let i=0;i<t.length;i+=3){const d=distPointTri(nearP,t[i],t[i+1],t[i+2]);if(d<nearGap)nearGap=d;}}
 assert.ok(nearGap>=0.6,'near plane '+nearGap.toFixed(2)+'m');
 function first(target,skip){
  const d=[target[0]-cam[0],target[1]-cam[1],target[2]-cam[2]],L=Math.hypot(d[0],d[1],d[2])||1,u=d.map(x=>x/L);
  let best=L,name='';
  for(const m of meshes){if(skip&&skip.test(m.name))continue;const t=m.tris;for(let i=0;i<t.length;i+=3){const hit=rayTri(cam,u,t[i],t[i+1],t[i+2]);if(hit&&hit<best){best=hit;name=m.name;}}}
  return name&&best<L-0.35?name:'';
 }
 assert.equal(first(head,null),'','girl ray blocked');
 assert.equal(first(ring,/starring/),'','star ring ray blocked');
 console.log('lens-clearance PASS',gap.toFixed(2),gapName);
})().catch(e=>{console.error(e);process.exit(1);});
