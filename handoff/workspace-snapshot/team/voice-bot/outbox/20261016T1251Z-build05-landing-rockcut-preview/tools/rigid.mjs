// Turn rc.mjs's per-vertex drops into a rigid vertical move of each touched connected piece (keeps the low-poly shape).
import {NodeIO} from '@gltf-transform/core';import {ALL_EXTENSIONS,KHRDracoMeshCompression} from '@gltf-transform/extensions';import draco3d from 'draco3dgltf';import fs from 'fs';
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'draco3d.decoder':await draco3d.createDecoderModule(),'draco3d.encoder':await draco3d.createEncoderModule()});
const [src,repf,out]=process.argv.slice(2);const rep=JSON.parse(fs.readFileSync(repf));const doc=await io.read(src);const R=JSON.parse(fs.readFileSync('/tmp/rc/route.json'));
const res={};
// pass 1: palette touched components -> DY and the piece's bbox
const comps=(p)=>{const P=p.getAttribute('POSITION').getArray(),I=p.getIndices().getArray(),N=P.length/3;const key=i=>[0,1,2].map(q=>Math.round(P[3*i+q]*1000)).join(',');const par=new Int32Array(N).map((_,i)=>i);const fd=x=>par[x]===x?x:(par[x]=fd(par[x]));const un=(a,b)=>{a=fd(a);b=fd(b);if(a!==b)par[a]=b;};
 const km=new Map();for(let i=0;i<N;i++){const k=key(i);if(km.has(k))un(i,km.get(k));else km.set(k,i);}for(let t=0;t<I.length;t+=3){un(I[t],I[t+1]);un(I[t],I[t+2]);}
 const C=new Map();for(let i=0;i<N;i++){const r=fd(i);const c=C.get(r)||{ids:[],mn:[1e9,1e9,1e9],mx:[-1e9,-1e9,-1e9]};c.ids.push(i);for(let k=0;k<3;k++){c.mn[k]=Math.min(c.mn[k],P[3*i+k]);c.mx[k]=Math.max(c.mx[k],P[3*i+k]);}C.set(r,c);}return {P,C,fd};};
const mesh=nm=>doc.getRoot().listMeshes().find(m=>m.getName()===nm).listPrimitives()[0];
const pal=mesh('env_sky_static_palette'),PC=comps(pal);const info=rep.meshes.env_sky_static_palette;let DY=0;const touched=new Set();
for(const i of info.vertexIds){DY=Math.min(DY,info.drops[i]);touched.add(PC.fd(i));}DY-=0.05+(+(process.env.EXTRA||0));
const box=[[1e9,1e9,1e9],[-1e9,-1e9,-1e9]];for(const r of touched){const c=PC.C.get(r);for(let k=0;k<3;k++){box[0][k]=Math.min(box[0][k],c.mn[k]);box[1][k]=Math.max(box[1][k],c.mx[k]);}}
res.DY=+DY.toFixed(3);res.pieceBBoxBefore=box.map(v=>v.map(x=>+x.toFixed(2)));
const inside=c=>c.mn[0]>=box[0][0]-0.3&&c.mx[0]<=box[1][0]+0.3&&c.mn[2]>=box[0][2]-0.3&&c.mx[2]<=box[1][2]+0.3&&c.mx[1]>-3.4&&c.mx[1]<=box[1][1]+2.0;
for(const nm of ['env_sky_static_palette','env_sky_static_foliage_cards']){const p=mesh(nm),X=nm==='env_sky_static_palette'?PC:comps(p),P=X.P.slice();res[nm]=[];
 for(const [r,c] of X.C){if(!(touched.has(r)&&nm==='env_sky_static_palette')&&!inside(c))continue;for(const i of c.ids)P[3*i+1]+=DY;
  let cl=1e9;for(const rr of R)for(const h of [0.1,0.8,1.6])for(const i of c.ids){const d=Math.hypot(P[3*i]-rr[0],P[3*i+1]-(rr[1]+h),P[3*i+2]-rr[2]);if(d<cl)cl=d;}
  res[nm].push({verts:c.ids.length,vertexIdRange:[Math.min(...c.ids),Math.max(...c.ids)],bboxBefore:[c.mn.map(x=>+x.toFixed(2)),c.mx.map(x=>+x.toFixed(2))],minVertDistToRouteBody:+cl.toFixed(2)});}
 p.getAttribute('POSITION').setArray(P);}
console.log(JSON.stringify(res,null,1));fs.writeFileSync(out+'.json',JSON.stringify(res,null,1));
doc.getRoot().listExtensionsUsed().find(e=>e.extensionName==='KHR_draco_mesh_compression').setEncoderOptions({method:KHRDracoMeshCompression.EncoderMethod.EDGEBREAKER,encodeSpeed:0,decodeSpeed:5,quantizationBits:{POSITION:16,NORMAL:12,TEX_COORD:14,COLOR:10,GENERIC:12}});
await io.write(out,doc);
