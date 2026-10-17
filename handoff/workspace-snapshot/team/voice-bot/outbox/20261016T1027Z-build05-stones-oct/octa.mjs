// Replace the 114 scattered 20-face stones (12 verts) in env_sky_static_palette with 8-face octahedra (6 verts).
// The 6 new verts are a subset of each stone's own 12 (extremes along ±X,±Y,±Z), so the footprint only shrinks:
// route clearance and the 09 board frustum stay satisfied. UV/colour copied from those verts. Deterministic.
// node octa.mjs in.glb tmp.glb add_mid.json add_late.json  → then splice.mjs in.glb tmp.glb out.glb env_sky_static_palette
import {NodeIO} from '@gltf-transform/core';import {ALL_EXTENSIONS,KHRDracoMeshCompression} from '@gltf-transform/extensions';import draco3d from 'draco3dgltf';import fs from 'fs';
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'draco3d.decoder':await draco3d.createDecoderModule(),'draco3d.encoder':await draco3d.createEncoderModule()});
const [src,out,...adds]=process.argv.slice(2);const doc=await io.read(src);
const p=doc.getRoot().listMeshes().find(m=>m.getName()==='env_sky_static_palette').listPrimitives()[0];
const SEM=p.listSemantics(),A=Object.fromEntries(SEM.map(s=>[s,p.getAttribute(s).getArray()])),Z=Object.fromEntries(SEM.map(s=>[s,p.getAttribute(s).getElementSize()]));
const P=A.POSITION,N=P.length/3,I=Array.from(p.getIndices().getArray());
const key=(x,y,z)=>Math.round(x*20)+','+Math.round(y*20)+','+Math.round(z*20);const grid=new Map();
for(let i=0;i<N;i++){const k=key(P[3*i],P[3*i+1],P[3*i+2]);(grid.get(k)||grid.set(k,[]).get(k)).push(i);}
const find=q=>{let best=-1,bd=0.004;const bx=Math.round(q[0]*20),by=Math.round(q[1]*20),bz=Math.round(q[2]*20);
 for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++)for(let c=-1;c<=1;c++)for(const i of grid.get((bx+a)+','+(by+b)+','+(bz+c))||[]){const d=Math.hypot(P[3*i]-q[0],P[3*i+1]-q[1],P[3*i+2]-q[2]);if(d<bd){bd=d;best=i;}}return best;};
const stones=[];for(const f of adds){const a=JSON.parse(fs.readFileSync(f));const n=a.points.stones.length,pos=a.env_sky_static_palette.pos;for(let s=0;s<n;s++)stones.push(pos.slice(s*12,s*12+12));}
const dead=new Uint8Array(N);const groups=[];let missing=0;
for(const st of stones){const ids=st.map(find);if(ids.some(i=>i<0)){missing++;continue;}const u=[...new Set(ids)];u.forEach(i=>dead[i]=1);groups.push(u);}
if(missing)throw Error('unmatched stones '+missing);
// rebuild: keep live verts, drop tris touching stone verts, append octahedra
const remap=new Int32Array(N).fill(-1),NA=Object.fromEntries(SEM.map(s=>[s,[]]));let nv=0;
for(let i=0;i<N;i++){if(dead[i])continue;remap[i]=nv++;for(const s of SEM)for(let k=0;k<Z[s];k++)NA[s].push(A[s][Z[s]*i+k]);}
const NI=[];let dropped=0;for(let t=0;t<I.length;t+=3){const f=[I[t],I[t+1],I[t+2]];if(f.some(i=>dead[i])){if(!f.every(i=>dead[i]))throw Error('mixed tri');dropped++;continue;}NI.push(...f.map(i=>remap[i]));}
for(const g of groups){const v=g.map(i=>[P[3*i],P[3*i+1],P[3*i+2]]),c=[0,1,2].map(k=>v.reduce((s,q)=>s+q[k],0)/v.length);
 const pick=(ax,sg)=>g[v.map((q,j)=>[sg*(q[ax]-c[ax]),j]).sort((a,b)=>b[0]-a[0])[0][1]];
 let ring=[pick(0,1),pick(2,1),pick(0,-1),pick(2,-1)];const top=pick(1,1),bot=pick(1,-1);
 const pv=i=>[P[3*i],P[3*i+1],P[3*i+2]];ring=[...new Set(ring)].filter(i=>i!==top&&i!==bot).sort((a,b)=>Math.atan2(pv(a)[2]-c[2],pv(a)[0]-c[0])-Math.atan2(pv(b)[2]-c[2],pv(b)[0]-c[0]));
 const base=nv,ids=[top,bot,...ring];
 for(const i of ids){for(const s of SEM){if(s==='NORMAL'){const q=pv(i),d=q.map((x,k)=>x-c[k]),l=Math.hypot(...d)||1;NA.NORMAL.push(...d.map(x=>x/l));}else for(let k=0;k<Z[s];k++)NA[s].push(A[s][Z[s]*i+k]);}nv++;}
 const r=ring.length;for(let k=0;k<r;k++){const a=base+2+k,b=base+2+(k+1)%r;NI.push(base,b,a, base+1,a,b);}}
for(const s of SEM)p.getAttribute(s).setArray(new A[s].constructor(NA[s]));p.getIndices().setArray(nv>65535?new Uint32Array(NI):new Uint16Array(NI));
console.log(JSON.stringify({stones:groups.length,vertsBefore:N,vertsAfter:nv,trisBefore:I.length/3,trisAfter:NI.length/3,droppedTris:dropped}));
doc.getRoot().listExtensionsUsed().find(e=>e.extensionName==='KHR_draco_mesh_compression').setEncoderOptions({method:KHRDracoMeshCompression.EncoderMethod.EDGEBREAKER,encodeSpeed:0,decodeSpeed:5,quantizationBits:{POSITION:16,NORMAL:12,TEX_COORD:14,COLOR:10,GENERIC:12}});
await io.write(out,doc);
