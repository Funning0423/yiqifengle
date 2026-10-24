#!/usr/bin/env node
'use strict';
/**
 * b17 skycity-walk-r2: skycity orbit-lens occluder proxies (MODEL-LOCAL metres of env_skycity.glb) ->
 * creator-build-project/assets/scripts/region/SkycityLensOccluders.ts. The sky houses / ruins / walls are merged meshes far over
 * the 14 m cap of RegionNodeStage.refreshOrbitBoxes, so the free-explore lens went into the blue-roof house east of S3
 * (p0drag6). Same recipe as the island proxies (gen-lens-occluders.cjs): 1 m × 0.8 m cells, each the AABB of the triangles that
 * touch it, then one box per 1 m column; ground skin dropped (a cell must rise ≥ 0.6 m over the walkable floor under / next to it); only cells within 7 m
 * (plan) of the walkable area and below floor + 8 m (where the orbit lens can be).  Usage: node gen-skycity-lens-occluders.cjs [--check]
 */
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'../..');
const OUT=path.join(ROOT,'creator-build-project/assets/scripts/region/SkycityLensOccluders.ts');
const FILE='creator-build-project/assets/bundles/region_skycity/env_skycity.glb';
const MESH=/^(env_sky_static_palette|env_sky_ruins|state_gate_after|state_court_after)$/;
const {load}=require('../region-nodes/load.cjs');const RW=load('region/RegionWalkable.ts');
(async()=>{
 const draco=require((process.env.DRACO3D||'/tmp/draco3d/node_modules/draco3d')+'/draco3d.js'),decMod=await draco.createDecoderModule({});
 const raw=fs.readFileSync(path.join(ROOT,FILE)),jl=raw.readUInt32LE(12),doc=JSON.parse(raw.subarray(20,20+jl).toString());
 const binOff=20+jl+8,bin=raw.subarray(binOff,binOff+raw.readUInt32LE(20+jl));
 const parent={};doc.nodes.forEach((n,i)=>(n.children||[]).forEach(c=>{parent[c]=i;}));
 const mul=(A,B)=>{const C=new Array(16).fill(0);for(let r=0;r<4;r++)for(let c=0;c<4;c++)for(let k=0;k<4;k++)C[c*4+r]+=A[k*4+r]*B[c*4+k];return C;};
 const trs=n=>{if(n.matrix)return n.matrix.slice();const [x,y,z,w]=n.rotation||[0,0,0,1],[sx,sy,sz]=n.scale||[1,1,1],t=n.translation||[0,0,0];
  return [(1-2*(y*y+z*z))*sx,2*(x*y+z*w)*sx,2*(x*z-y*w)*sx,0,2*(x*y-z*w)*sy,(1-2*(x*x+z*z))*sy,2*(y*z+x*w)*sy,0,2*(x*z+y*w)*sz,2*(y*z-x*w)*sz,(1-2*(x*x+y*y))*sz,0,t[0],t[1],t[2],1];};
 const glob=i=>{let M=trs(doc.nodes[i]);for(let k=parent[i];k!==undefined;k=parent[k])M=mul(trs(doc.nodes[k]),M);return M;};
 const xf=(M,v)=>[M[0]*v[0]+M[4]*v[1]+M[8]*v[2]+M[12],M[1]*v[0]+M[5]*v[1]+M[9]*v[2]+M[13],M[2]*v[0]+M[6]*v[1]+M[10]*v[2]+M[14]];
 // walkable floor near each 1 m column: max floor within 1 m (plan); null = no floor within 10 m
 const g=RW.walkGrid('skycity'),C=1.0,CY=0.8,floorNear=new Map(),farOK=new Set();
 for(let i=0;i<g.W*g.H;i++){const y=g.h[i];if(Number.isNaN(y))continue;const x=g.x0+(i%g.W+.5)*g.c,z=g.z0+(((i/g.W)|0)+.5)*g.c,gx=Math.floor(x/C),gz=Math.floor(z/C);
  for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++){const k=(gx+dx)+','+(gz+dz),f=floorNear.get(k);if(f===undefined||y>f)floorNear.set(k,y);}
  for(let dx=-7;dx<=7;dx++)for(let dz=-7;dz<=7;dz++)if(dx*dx+dz*dz<=49)farOK.add((gx+dx)+','+(gz+dz));}
 const minFloor=g.minY,cells=new Map();
 doc.nodes.forEach((node,i)=>{if(node.mesh===undefined||!MESH.test(node.name||''))return;const M=glob(i);
  for(const pr of doc.meshes[node.mesh].primitives){const ext=pr.extensions&&pr.extensions.KHR_draco_mesh_compression;if(!ext)continue;
   const bv=doc.bufferViews[ext.bufferView],data=bin.subarray(bv.byteOffset||0,(bv.byteOffset||0)+bv.byteLength);
   const d=new decMod.Decoder(),buf=new decMod.DecoderBuffer();buf.Init(new Int8Array(data.buffer,data.byteOffset,data.byteLength),data.byteLength);
   const mesh=new decMod.Mesh();if(!d.DecodeBufferToMesh(buf,mesh).ok())throw Error('draco '+node.name);
   const attr=d.GetAttributeByUniqueId(mesh,ext.attributes.POSITION),nv=mesh.num_points(),nf=mesh.num_faces(),pos=new decMod.DracoFloat32Array();
   d.GetAttributeFloatForAllPoints(mesh,attr,pos);const P=[];for(let v=0;v<nv;v++)P[v]=xf(M,[pos.GetValue(v*3),pos.GetValue(v*3+1),pos.GetValue(v*3+2)]);
   const face=new decMod.DracoInt32Array();
   for(let f=0;f<nf;f++){d.GetFaceFromMesh(mesh,f,face);const T=[0,1,2].map(k=>P[face.GetValue(k)]);
    const lo=[0,1,2].map(a=>Math.min(T[0][a],T[1][a],T[2][a])),hi=[0,1,2].map(a=>Math.max(T[0][a],T[1][a],T[2][a]));
    // clip the triangle AABB to each 1 m × 0.8 m cell it touches
    for(let gx=Math.floor(lo[0]/C);gx<=Math.floor(hi[0]/C);gx++)for(let gz=Math.floor(lo[2]/C);gz<=Math.floor(hi[2]/C);gz++){const ck=gx+','+gz;if(!farOK.has(ck))continue;
     for(let gy=Math.floor(lo[1]/CY);gy<=Math.floor(hi[1]/CY);gy++){const k=ck+','+gy;
      const b=[Math.max(lo[0],gx*C),Math.max(lo[1],gy*CY),Math.max(lo[2],gz*C),Math.min(hi[0],(gx+1)*C),Math.min(hi[1],(gy+1)*CY),Math.min(hi[2],(gz+1)*C)];
      let c=cells.get(k);if(!c)cells.set(k,c={ck,b:b.slice()});else for(let a=0;a<3;a++){c.b[a]=Math.min(c.b[a],b[a]);c.b[a+3]=Math.max(c.b[a+3],b[a+3]);}}}}
   [pos,face,mesh,buf,d].forEach(o=>decMod.destroy(o));}});
 const rows=[],col=new Map();
 for(const c of cells.values()){const f=floorNear.get(c.ck),base=f===undefined?minFloor:f,b=c.b;
  if(b[4]<base+.6)continue;            // ground skin, kerbs, steps she walks on
  if(b[1]>base+8)continue;             // over the lens
  if(f!==undefined&&b[4]-b[1]<.15&&b[1]<base+.4)continue;
  const m=col.get(c.ck);if(!m)col.set(c.ck,b.slice());else for(let a=0;a<3;a++){m[a]=Math.min(m[a],b[a]);m[a+3]=Math.max(m[a+3],b[a+3]);}}
 // one box per 1 m column (the stacked 0.8 m cells merged): the lens only needs the solid's plan + height span
 for(const b of col.values())rows.push(b.map(v=>+v.toFixed(2)));
 rows.sort((p,q)=>p[0]-q[0]||p[2]-q[2]||p[1]-q[1]);
 const text=['/** GENERATED by tools/region-walkable/gen-skycity-lens-occluders.cjs - do not edit. b17 skycity-walk-r2.',
  ` *  Skycity lens-occluder proxies, MODEL-LOCAL metres (env_skycity.glb frame): [minX,minY,minZ,maxX,maxY,maxZ]. ${rows.length} 1 m`,
  ' *  columns of the houses / ruins / walls near the walkable area. RegionNodeStage turns them to world with the skycity model matrix. */',
  `export const SKYCITY_LENS_OCCLUDERS_SCENE:readonly (readonly number[])[]=${JSON.stringify(rows)};`,''].join('\n');
 /* p0drag7 merge: the file holds the cine set too; this generator owns only the <scene> block */
 const cur=fs.existsSync(OUT)?fs.readFileSync(OUT,'utf8'):'',blk='// <scene>\n'+text.replace(/\n$/,'')+'\n// </scene>\n',re=/\/\/ <scene>\n[\s\S]*?\/\/ <\/scene>\n/;
 if(process.argv.includes('--check')){const m=cur.match(re);if(!m||m[0]!==blk){console.error('SKYCITY OCCLUDER DRIFT');process.exit(1);}console.log('check-ok',rows.length);return;}
 if(!re.test(cur)){console.error('no <scene> block in '+OUT);process.exit(1);}fs.writeFileSync(OUT,cur.replace(re,blk));console.log('rows',rows.length,'bytes',text.length);
})().catch(e=>{console.error(e);process.exit(1);});
