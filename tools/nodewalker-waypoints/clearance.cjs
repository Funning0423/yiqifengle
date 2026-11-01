'use strict';
/* b21 clearance reference for the waypoint gate (Grok Bot): skin-CORRECTED obstacle points, decoded from the frozen region GLBs.
 * Skinned nodes are placed at the glTF bind pose Σ w·(jointWorld·inverseBind)·v (what Creator renders; 96986d56 glb-skin-bounds,
 * the positions 场景设计部 rebaked on in a1c4c07d), never at the node matrix. Rules (see test_nodewalker_waypoints.cjs):
 *   trunks  = vertices of the island palms below 0.7 m above their own base (skin.cjs / 96986d56 trunk definition) → ≥ 1 m
 *   foliage = every vertex of palms / plants / canopy / vine / foliage-card meshes (+ the skinned robot gardener, a solid)
 *             → none inside her head band at ≤ body radius
 *   routeAvoid discs = scene/b20-island-walk-fixes @ a1c4c07d tools/region-nodes/bake-region-nodes.cjs:33 (island) and :69 (skycity)
 * Surface-sampled every ≤ 0.1 m, thinned to one point per 0.1 m voxel; decoded at test time (needs DRACO3D, as glb-skin-bounds). */
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const ROOT=path.resolve(__dirname,'../..'),YMAX=8/* no walk floor is above 3.1 m: head band ≤ 4.9 m */;
const SRC={island:{file:'creator-build-project/assets/bundles/static_seat_preview/room/room_no_original_chair.glb',
  trunk:/env_prop_palm_(lean|tall|young)_01|env_rear_window_palm/,foliage:/palm|plant/,
  routeAvoid:[[3.04,2.64,1.45],[4.6,3.8,0.35],[3.85,4.8,0.3]]},
 skycity:{file:'creator-build-project/assets/bundles/region_skycity/env_skycity.glb',trunk:null,
  foliage:/greattree_canopy|vine|foliage_cards|chr_robot_gardener/,routeAvoid:[[5.4,0.8,1.3]]}};
const mul=(A,B)=>{const C=new Array(16).fill(0);for(let r=0;r<4;r++)for(let c=0;c<4;c++)for(let k=0;k<4;k++)C[c*4+r]+=A[k*4+r]*B[c*4+k];return C;};
const trs=n=>{if(n.matrix)return n.matrix.slice();const [x,y,z,w]=n.rotation||[0,0,0,1],[sx,sy,sz]=n.scale||[1,1,1],t=n.translation||[0,0,0];
 return [(1-2*(y*y+z*z))*sx,2*(x*y+z*w)*sx,2*(x*z-y*w)*sx,0,2*(x*y-z*w)*sy,(1-2*(x*x+z*z))*sy,2*(y*z+x*w)*sy,0,2*(x*z+y*w)*sz,2*(y*z-x*w)*sz,(1-2*(x*x+y*y))*sz,0,t[0],t[1],t[2],1];};
const xf=(M,v)=>[M[0]*v[0]+M[4]*v[1]+M[8]*v[2]+M[12],M[1]*v[0]+M[5]*v[1]+M[9]*v[2]+M[13],M[2]*v[0]+M[6]*v[1]+M[10]*v[2]+M[14]];
async function decode(spec,dm){const raw=fs.readFileSync(path.join(ROOT,spec.file)),jl=raw.readUInt32LE(12),doc=JSON.parse(raw.subarray(20,20+jl)),bo=20+jl+8,bin=raw.subarray(bo,bo+raw.readUInt32LE(20+jl));
 const parent={};doc.nodes.forEach((n,i)=>(n.children||[]).forEach(c=>{parent[c]=i;}));const W=doc.nodes.map((_,i)=>{let M=trs(doc.nodes[i]);for(let k=parent[i];k!==undefined;k=parent[k])M=mul(trs(doc.nodes[k]),M);return M;});
 const acc=i=>{const A=doc.accessors[i],v=doc.bufferViews[A.bufferView],o=(v.byteOffset||0)+(A.byteOffset||0);return k=>Array.from({length:16},(_,e)=>bin.readFloatLE(o+(k*16+e)*4));};
 const out={trunks:[],foliage:[]};
 for(const [i,n] of doc.nodes.entries()){if(n.mesh===undefined)continue;const name=n.name||'',isT=spec.trunk&&spec.trunk.test(name),isF=spec.foliage.test(name);if(!isT&&!isF)continue;
  let pal=null;if(n.skin!==undefined){const s=doc.skins[n.skin],ibm=acc(s.inverseBindMatrices);pal=s.joints.map((j,k)=>mul(W[j],ibm(k)));}
  const pts=[];
  for(const pr of doc.meshes[n.mesh].primitives){const ext=pr.extensions&&pr.extensions.KHR_draco_mesh_compression;if(!ext)throw Error('expected draco '+name);
   const bv=doc.bufferViews[ext.bufferView],data=bin.subarray(bv.byteOffset||0,(bv.byteOffset||0)+bv.byteLength),d=new dm.Decoder(),buf=new dm.DecoderBuffer();
   buf.Init(new Int8Array(data.buffer,data.byteOffset,data.byteLength),data.byteLength);const mesh=new dm.Mesh();if(!d.DecodeBufferToMesh(buf,mesh).ok())throw Error('draco '+name);const nv=mesh.num_points();
   const rd=(id,w)=>{const a=d.GetAttributeByUniqueId(mesh,id),arr=new dm.DracoFloat32Array();d.GetAttributeFloatForAllPoints(mesh,a,arr);const nc=a.num_components(),o=new Float64Array(nv*w);for(let v=0;v<nv;v++)for(let c=0;c<Math.min(w,nc);c++)o[v*w+c]=arr.GetValue(v*nc+c);dm.destroy(arr);return o;};
   const P=rd(ext.attributes.POSITION,3),J=pal?rd(ext.attributes.JOINTS_0,4):null,Wt=pal?rd(ext.attributes.WEIGHTS_0,4):null,nf=mesh.num_faces(),F=new Int32Array(nf*3),fa=new dm.DracoInt32Array();
   for(let f=0;f<nf;f++){d.GetFaceFromMesh(mesh,f,fa);F[f*3]=fa.GetValue(0);F[f*3+1]=fa.GetValue(1);F[f*3+2]=fa.GetValue(2);}[fa,mesh,buf,d].forEach(o=>dm.destroy(o));const Q=[];
   for(let v=0;v<nv;v++){const p=[P[v*3],P[v*3+1],P[v*3+2]];let q;
    if(pal){q=[0,0,0];let ws=0;for(let k=0;k<4;k++){const w=Wt[v*4+k];if(!w)continue;const r=xf(pal[J[v*4+k]],p);q[0]+=w*r[0];q[1]+=w*r[1];q[2]+=w*r[2];ws+=w;}if(ws>0&&Math.abs(ws-1)>1e-6)q=q.map(x=>x/ws);}else q=xf(W[i],p);
    Q.push(q);}
   // surface samples every ≤ 0.1 m (a foliage card is a few big triangles: its vertices alone would miss her head)
   for(let f=0;f<nf;f++){const a=Q[F[f*3]],b=Q[F[f*3+1]],c=Q[F[f*3+2]],L=Math.max(Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2]),Math.hypot(c[0]-a[0],c[1]-a[1],c[2]-a[2]),Math.hypot(c[0]-b[0],c[1]-b[1],c[2]-b[2])),n=Math.max(1,Math.ceil(L/0.1));
    for(let u=0;u<=n;u++)for(let v=0;u+v<=n;v++){const w=n-u-v;pts.push([(a[0]*w+b[0]*u+c[0]*v)/n,(a[1]*w+b[1]*u+c[1]*v)/n,(a[2]*w+b[2]*u+c[2]*v)/n]);}}}
  let base=Infinity;for(const p of pts)if(p[1]<base)base=p[1];const vox=new Map();for(const p of pts)vox.set(p.map(x=>Math.round(x*10)).join(','),p.map(x=>+x.toFixed(2)));const thin=[...vox.values()].filter(p=>p[1]<=YMAX);
  if(isT){const tv=new Map();for(const p of pts)if(p[1]<base+0.7)tv.set(Math.round(p[0]*10)+','+Math.round(p[2]*10),[+p[0].toFixed(2),+p[2].toFixed(2)]);out.trunks.push({name,skinned:!!pal,baseY:+base.toFixed(2),xz:[...tv.values()]});}
  if(isF)out.foliage.push({name,skinned:!!pal,pts:thin});}
 return out;}
let memo=null;
function clearance(){return memo||(memo=(async()=>{const dir=[process.env.DRACO3D,path.join(ROOT,'tools/vendor-node/node_modules/draco3d')].filter(Boolean).find(d=>fs.existsSync(path.join(d,'draco3d.js')));if(!dir)throw Error('DRACO3D');
 const dm=await require(path.join(dir,'draco3d.js')).createDecoderModule({}),res={format:'qf-walk-clearance/1',source:'tools/nodewalker-waypoints/clearance.cjs',regions:{}};
 for(const [r,spec] of Object.entries(SRC)){const o=await decode(spec,dm);res.regions[r]={glb:spec.file,glbSha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,spec.file))).digest('hex'),
  routeAvoid:spec.routeAvoid,routeAvoidSource:'scene/b20-island-walk-fixes@a1c4c07d tools/region-nodes/bake-region-nodes.cjs:'+(r==='island'?33:69),...o};}
 return res;})());}
module.exports={clearance,SRC};
if(require.main===module)clearance().then(r=>{for(const [k,o] of Object.entries(r.regions))console.log(k,o.trunks.map(t=>t.name+' '+t.xz.length),o.foliage.map(f=>f.name+' '+f.pts.length));});
