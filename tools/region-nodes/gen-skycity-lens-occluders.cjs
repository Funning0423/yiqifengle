'use strict';
/* p0drag7: skycity house / wall lens occluder proxies, generated from the real env_skycity.glb (Draco, decoded with draco3d).
 * Triangles of the static buildings (env_sky_ruins / env_sky_static_palette) on the plateau, standing above the walk floor, are voxelised
 * (0.5 m; flat floors / terrace slabs below 2.2 m dropped), then binned into 3 m xz columns, one tight AABB per column ≥ 1.2 m high
 * (model-local = walk-local). Small output.
 *   DRACO3D=/tmp/draco3d/node_modules/draco3d node tools/region-nodes/gen-skycity-lens-occluders.cjs [--write]  */
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.join(__dirname,'../..');
const OUT=path.join(ROOT,'creator-build-project/assets/scripts/region/SkycityLensOccluders.ts');
/* p0drag11 (Mac p0drag10: house posts, pillars and the dark bushes hid her for 2–10 s, grey post full-screen at the nook): the set
 * now starts 0.3 m over the floor (was 2.2 m — everything below, i.e. the bushes and the bottom of every post, was missing), 1 m
 * tiles (was 2 m) and a min thickness so 1-plank fences / rails stay see-through. Day and night use the same meshes (night = grade). */
/* full9c (运镜bot endshots: S3>S4 arrival — the star ring hid her on 7/7 screens): the before-state star ring gets its own pass — 0.5 m
 * voxels, 1 m xz tiles split into vertical runs (the ring floats 4–29 m up; one column box would wall off the plateau under it). */
const RING={meshes:/^state_ring_before$/,yMin:3,yMax:14};
const CFG={meshes:/^(env_sky_ruins|env_sky_static_palette)$/,xz:[-30,-40,40,60],yMin:0.3,yMax:16,vox:0.5,minH:1.0,minFoot:0.5,minThick:0.75,tile:1,floorNy:0.85,floorTop:2.2};
(async()=>{
 const dir=process.env.DRACO3D||'/tmp/draco3d/node_modules/draco3d';const draco=require(path.join(dir,'draco3d.js'));const decMod=await draco.createDecoderModule({});
 const raw=fs.readFileSync(path.join(ROOT,'creator-build-project/assets/bundles/region_skycity/env_skycity.glb'));
 const jl=raw.readUInt32LE(12),doc=JSON.parse(raw.subarray(20,20+jl).toString()),bin=raw.subarray(20+jl+8,20+jl+8+raw.readUInt32LE(20+jl));
 const parent={};doc.nodes.forEach((n,i)=>(n.children||[]).forEach(c=>{parent[c]=i;}));
 const mul=(A,B)=>{const M=new Array(16).fill(0);for(let r=0;r<4;r++)for(let c=0;c<4;c++)for(let k=0;k<4;k++)M[c*4+r]+=A[k*4+r]*B[c*4+k];return M;};
 const trs=n=>{if(n.matrix)return n.matrix.slice();const [x,y,z,w]=n.rotation||[0,0,0,1],[sx,sy,sz]=n.scale||[1,1,1],t=n.translation||[0,0,0];
  return [(1-2*(y*y+z*z))*sx,2*(x*y+z*w)*sx,2*(x*z-y*w)*sx,0,2*(x*y-z*w)*sy,(1-2*(x*x+z*z))*sy,2*(y*z+x*w)*sy,0,2*(x*z+y*w)*sz,2*(y*z-x*w)*sz,(1-2*(x*x+y*y))*sz,0,t[0],t[1],t[2],1];};
 const glob=i=>{let M=trs(doc.nodes[i]);for(let k=parent[i];k!==undefined;k=parent[k])M=mul(trs(doc.nodes[k]),M);return M;};
 const xf=(M,v)=>[M[0]*v[0]+M[4]*v[1]+M[8]*v[2]+M[12],M[1]*v[0]+M[5]*v[1]+M[9]*v[2]+M[13],M[2]*v[0]+M[6]*v[1]+M[10]*v[2]+M[14]];
 const V=CFG.vox,cells=new Map(),rcells=new Map(),key=(i,j,k)=>i+','+j+','+k;
 for(let i=0;i<doc.nodes.length;i++){const node=doc.nodes[i];const isRing=RING.meshes.test(node.name||'');if(node.mesh===undefined||(!isRing&&!CFG.meshes.test(node.name||'')))continue;const M=glob(i);const Y0=isRing?RING.yMin:CFG.yMin,Y1=isRing?RING.yMax:CFG.yMax,CM=isRing?rcells:cells;
  for(const pr of doc.meshes[node.mesh].primitives){const ext=pr.extensions&&pr.extensions.KHR_draco_mesh_compression;if(!ext)continue;
   const bv=doc.bufferViews[ext.bufferView],data=bin.subarray(bv.byteOffset||0,(bv.byteOffset||0)+bv.byteLength);
   const d=new decMod.Decoder(),buf=new decMod.DecoderBuffer();buf.Init(new Int8Array(data.buffer,data.byteOffset,data.byteLength),data.byteLength);
   const mesh=new decMod.Mesh();if(!d.DecodeBufferToMesh(buf,mesh).ok())throw Error('draco '+node.name);
   const attr=d.GetAttributeByUniqueId(mesh,ext.attributes.POSITION),nv=mesh.num_points(),nf=mesh.num_faces(),pos=new decMod.DracoFloat32Array();
   d.GetAttributeFloatForAllPoints(mesh,attr,pos);const P=new Array(nv);for(let v=0;v<nv;v++)P[v]=xf(M,[pos.GetValue(v*3),pos.GetValue(v*3+1),pos.GetValue(v*3+2)]);
   const face=new decMod.DracoInt32Array();
   for(let f=0;f<nf;f++){d.GetFaceFromMesh(mesh,f,face);const t=[P[face.GetValue(0)],P[face.GetValue(1)],P[face.GetValue(2)]];
    const lo=[0,1,2].map(a=>Math.min(t[0][a],t[1][a],t[2][a])),hi=[0,1,2].map(a=>Math.max(t[0][a],t[1][a],t[2][a]));
    if(hi[1]<Y0||lo[1]>Y1||hi[0]<CFG.xz[0]||lo[0]>CFG.xz[2]||hi[2]<CFG.xz[1]||lo[2]>CFG.xz[3])continue;
    {const u=[0,1,2].map(a=>t[1][a]-t[0][a]),w=[0,1,2].map(a=>t[2][a]-t[0][a]),n=[u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0]],L=Math.hypot(...n)||1;
     if(!isRing&&Math.abs(n[1])/L>CFG.floorNy&&hi[1]<CFG.floorTop)continue;/* walk floors / terrace slabs are not walls */}
    // rasterise the triangle by sampling (barycentric grid at ≤ V/2)
    const e=Math.max(Math.hypot(...[0,1,2].map(a=>t[1][a]-t[0][a])),Math.hypot(...[0,1,2].map(a=>t[2][a]-t[0][a])));const n=Math.max(1,Math.ceil(e/(V/2)));
    for(let a=0;a<=n;a++)for(let b=0;a+b<=n;b++){const u=a/n,w=b/n,p=[0,1,2].map(k=>t[0][k]+(t[1][k]-t[0][k])*u+(t[2][k]-t[0][k])*w);
     if(p[1]<Y0||p[1]>Y1)continue;const c=[Math.floor(p[0]/V),Math.floor(p[1]/V),Math.floor(p[2]/V)];const k=key(...c);if(!CM.has(k))CM.set(k,c);}}
   [pos,face,mesh,buf,d].forEach(o=>decMod.destroy(o));}}
 // connected clusters
 const seen=new Set(),boxes=[];
 for(const [k,c0] of cells){if(seen.has(k))continue;const st=[c0];seen.add(k);const lo=c0.slice(),hi=c0.slice();
  while(st.length){const c=st.pop();for(let a=0;a<3;a++){lo[a]=Math.min(lo[a],c[a]);hi[a]=Math.max(hi[a],c[a]);}
   for(const [dx,dy,dz] of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]){const n=[c[0]+dx,c[1]+dy,c[2]+dz],nk=key(...n);if(cells.has(nk)&&!seen.has(nk)){seen.add(nk);st.push(n);}}}
  void lo;void hi;}
 // per cluster member cells were not kept: tile all solid cells into CFG.tile m xz columns, one tight AABB per (cluster-agnostic) tile column
 const T=CFG.tile,cols=new Map();for(const c of cells.values()){const k=Math.floor(c[0]*V/T)+','+Math.floor(c[2]*V/T);const b=cols.get(k)||[1e9,1e9,1e9,-1e9,-1e9,-1e9];
  b[0]=Math.min(b[0],c[0]*V);b[1]=Math.min(b[1],c[1]*V);b[2]=Math.min(b[2],c[2]*V);b[3]=Math.max(b[3],(c[0]+1)*V);b[4]=Math.max(b[4],(c[1]+1)*V);b[5]=Math.max(b[5],(c[2]+1)*V);cols.set(k,b);}
 for(const b of cols.values()){const h=b[4]-b[1];if(h>=CFG.minH&&Math.max(b[3]-b[0],b[5]-b[2])>=CFG.minFoot&&Math.min(b[3]-b[0],b[5]-b[2])>=CFG.minThick)boxes.push(b.map(v=>+v.toFixed(2)));}
 const ringBoxes=[];{const T=CFG.tile,col=new Map();for(const c of rcells.values()){const k=Math.floor(c[0]*V/T)+','+Math.floor(c[2]*V/T);(col.get(k)||col.set(k,[]).get(k)).push(c);}
  for(const cs of col.values()){cs.sort((a,b)=>a[1]-b[1]);let run=null;const flush=()=>{if(run)ringBoxes.push(run.map(v=>+v.toFixed(2)));run=null;};
   for(const c of cs){if(run&&c[1]*V<=run[4]+V){run[0]=Math.min(run[0],c[0]*V);run[2]=Math.min(run[2],c[2]*V);run[3]=Math.max(run[3],(c[0]+1)*V);run[4]=Math.max(run[4],(c[1]+1)*V);run[5]=Math.max(run[5],(c[2]+1)*V);}else{flush();run=[c[0]*V,c[1]*V,c[2]*V,(c[0]+1)*V,(c[1]+1)*V,(c[2]+1)*V];}}flush();}}
 boxes.sort((a,b)=>a[0]-b[0]||a[2]-b[2]);ringBoxes.sort((a,b)=>a[0]-b[0]||a[2]-b[2]);
 const ts=`/** p0drag7 (Mac p0drag6: skycity east edge — lens inside a blue-roof house wall / single-colour frames). Generated by
 *  tools/region-nodes/gen-skycity-lens-occluders.cjs from env_skycity.glb (${CFG.meshes.source}, voxel ${V} m, from ${CFG.yMin} m over the floor, ${CFG.tile} m tiles ≥ ${CFG.minH} m high, ≥ ${CFG.minThick} m thick).
 *  Rows: model-local AABB [minX,minY,minZ,maxX,maxY,maxZ] (model-local = walk-local). Do not edit by hand. */
export const SKYCITY_LENS_OCCLUDERS_CINE:readonly (readonly number[])[]=${JSON.stringify(boxes)};
`;
 console.log(JSON.stringify({cells:cells.size,boxes:boxes.length,bytes:ts.length}));
 const rts=`/** full9c (运镜bot endshots): before-state star ring proxies — tools/region-nodes/gen-skycity-lens-occluders.cjs --ring from env_skycity.glb
 *  (${RING.meshes.source}, ${RING.yMin}–${RING.yMax} m, 0.5 m voxels, 1 m xz tiles split into vertical runs). Model-local AABBs. Do not edit by hand. */
export const SKYCITY_LENS_OCCLUDERS_CINE_RING:readonly (readonly number[])[]=${JSON.stringify(ringBoxes)};
`;
 if(process.argv.includes('--ring')){const cur=fs.readFileSync(OUT,'utf8'),re=/\/\/ <cine-ring>\n[\s\S]*?\/\/ <\/cine-ring>\n/,blk='// <cine-ring>\n'+rts.replace(/\n$/,'')+'\n// </cine-ring>\n';
  let nx=re.test(cur)?cur.replace(re,blk):cur.replace('// </cine>\n','// </cine>\n'+blk);nx=nx.replace('[...SKYCITY_LENS_OCCLUDERS_CINE,...SKYCITY_LENS_OCCLUDERS_SCENE]','[...SKYCITY_LENS_OCCLUDERS_CINE,...SKYCITY_LENS_OCCLUDERS_CINE_RING,...SKYCITY_LENS_OCCLUDERS_SCENE]');fs.writeFileSync(OUT,nx);console.log(JSON.stringify({ringBoxes:ringBoxes.length}));return;}
 if(process.argv.includes('--write')){/* p0drag7 merge: owns only the <cine> block */const cur=fs.readFileSync(OUT,'utf8'),re=/\/\/ <cine>\n[\s\S]*?\/\/ <\/cine>\n/;if(!re.test(cur))throw new Error('no <cine> block');fs.writeFileSync(OUT,cur.replace(re,'// <cine>\n'+ts.replace(/\n$/,'')+'\n// </cine>\n'));}else console.log(boxes.map(b=>b.join(',')).join('\n'));
})().catch(e=>{console.error(e);process.exit(1);});
