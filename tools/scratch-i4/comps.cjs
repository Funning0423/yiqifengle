// connected components of a GLB node (world space), via quantized positions
const fs=require('fs'),path=require('path');const {nodeWorlds,vertexMapper}=require('../journey-integration/occlusion/lib-glb.cjs');
const ROOT=path.resolve(__dirname,'../..');const NAME=new RegExp(process.argv[2]);
(async()=>{const dir=process.env.DRACO3D||'/tmp/draco3d';const draco=require(path.join(dir,'draco3d.js'));const decMod=await draco.createDecoderModule({});
const raw=fs.readFileSync(path.join(ROOT,'creator-build-project/assets/bundles/static_seat_preview/room/room_no_original_chair.glb'));const jl=raw.readUInt32LE(12),doc=JSON.parse(raw.subarray(20,20+jl));
const binOff=20+jl+8,bin=raw.subarray(binOff,binOff+raw.readUInt32LE(20+jl));const worlds=nodeWorlds(doc);const tris=[];
doc.nodes.forEach((node,i)=>{if(node.mesh===undefined||!NAME.test(node.name||''))return;const map=vertexMapper(doc,i,worlds,null);
 for(const pr of doc.meshes[node.mesh].primitives){const ext=pr.extensions.KHR_draco_mesh_compression;const bv=doc.bufferViews[ext.bufferView],data=bin.subarray(bv.byteOffset||0,(bv.byteOffset||0)+bv.byteLength);
  const d=new decMod.Decoder(),buf=new decMod.DecoderBuffer();buf.Init(new Int8Array(data.buffer,data.byteOffset,data.byteLength),data.byteLength);const mesh=new decMod.Mesh();d.DecodeBufferToMesh(buf,mesh);
  const attr=d.GetAttributeByUniqueId(mesh,ext.attributes.POSITION),nv=mesh.num_points(),nf=mesh.num_faces(),pos=new decMod.DracoFloat32Array();d.GetAttributeFloatForAllPoints(mesh,attr,pos);
  const P=[];for(let v=0;v<nv;v++)P.push(map([pos.GetValue(v*3),pos.GetValue(v*3+1),pos.GetValue(v*3+2)]));const face=new decMod.DracoInt32Array();
  for(let f=0;f<nf;f++){d.GetFaceFromMesh(mesh,f,face);tris.push([0,1,2].map(j=>P[face.GetValue(j)]));}}});
const key=p=>p.map(v=>Math.round(v*1000)).join(',');const id=new Map();const par=[];const find=a=>{while(par[a]!==a)a=par[a]=par[par[a]];return a;};
const vi=p=>{const k=key(p);if(!id.has(k)){id.set(k,par.length);par.push(par.length);}return id.get(k);};
for(const t of tris){const a=vi(t[0]),b=vi(t[1]),c=vi(t[2]);par[find(b)]=find(a);par[find(c)]=find(a);}
const PL=JSON.parse(fs.readFileSync('/workspace/wechat-game/art/x/GROKBOT-ART-001-ISLAND-EXTERIOR-v2.1.0/GROKBOT-ART-001-ISLAND-EXTERIOR-v2.1.0/scene/placements.json','utf8'));const PLs=(PL.placements||PL).filter(p=>/grass_tuft|rock_|flowers|bush|planter|fence|bench/.test(p.asset_id));
const CV=new Map();for(const t of tris){const r=find(vi(t[0]));if(!CV.has(r))CV.set(r,[]);CV.get(r).push(...t);}
const F=PLs.map(p=>({asset:p.asset_id.replace('env_prop_',''),x:p.position_game_m[0],y0:p.position_game_m[1],z:p.position_game_m[2],r:0,top:-9,n:0}));
for(const vs of CV.values()){let cx=0,cz=0;for(const v of vs){cx+=v[0];cz+=v[2];}cx/=vs.length;cz/=vs.length;let b=null,bd=1e9;for(const f of F){const d=Math.hypot(f.x-cx,f.z-cz);if(d<bd){bd=d;b=f;}}
 if(bd>2.5)continue;b.n++;for(const v of vs){b.r=Math.max(b.r,Math.hypot(v[0]-b.x,v[2]-b.z));b.top=Math.max(b.top,v[1]);}}
F.forEach(f=>{f.h=+(f.top-f.y0).toFixed(3);f.r=+f.r.toFixed(3);f.top=+f.top.toFixed(3);});fs.writeFileSync('/workspace/tmp-exp/dec/props_objs.json',JSON.stringify(F));
console.log('unmatched check; n0',F.filter(f=>!f.n).length);
{const G=[...CV.values()].map(vs=>{const o={vs,mn:[1e9,1e9],mx:[-1e9,-1e9]};for(const v of vs){o.mn[0]=Math.min(o.mn[0],v[0]);o.mn[1]=Math.min(o.mn[1],v[2]);o.mx[0]=Math.max(o.mx[0],v[0]);o.mx[1]=Math.max(o.mx[1],v[2]);}return o;});
 const pr=G.map((_,i)=>i);const fd=a=>{while(pr[a]!==a)a=pr[a]=pr[pr[a]];return a;};
 for(let i=0;i<G.length;i++)for(let j=i+1;j<G.length;j++){const a=G[i],b=G[j];if(a.mn[0]<=b.mx[0]+.02&&b.mn[0]<=a.mx[0]+.02&&a.mn[1]<=b.mx[1]+.02&&b.mn[1]<=a.mx[1]+.02)pr[fd(j)]=fd(i);}
 const O=new Map();G.forEach((g,i)=>{const r=fd(i);if(!O.has(r))O.set(r,[]);O.get(r).push(...g.vs);});
 const objs=[...O.values()].map(vs=>{let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9,y0=1e9,y1=-1e9;for(const v of vs){x0=Math.min(x0,v[0]);x1=Math.max(x1,v[0]);z0=Math.min(z0,v[2]);z1=Math.max(z1,v[2]);y0=Math.min(y0,v[1]);y1=Math.max(y1,v[1]);}
  const cx=(x0+x1)/2,cz=(z0+z1)/2;let r=0;for(const v of vs)r=Math.max(r,Math.hypot(v[0]-cx,v[2]-cz));let lab=null,bd=1e9;for(const f of F){const d=Math.hypot(f.x-cx,f.z-cz);if(d<bd){bd=d;lab=f;}}
  return {x:+cx.toFixed(3),z:+cz.toFixed(3),r:+r.toFixed(3),yMin:+y0.toFixed(3),top:+y1.toFixed(3),label:lab.asset+(bd>0.3?'?':''),labelD:+bd.toFixed(2),n:vs.length/3};});
 fs.writeFileSync('/workspace/tmp-exp/dec/props_clusters.json',JSON.stringify(objs));console.log('clusters',objs.length);}
const C=new Map();for(const t of tris){const r=find(vi(t[0]));let o=C.get(r);if(!o)C.set(r,o={n:0,mn:[1e9,1e9,1e9],mx:[-1e9,-1e9,-1e9]});o.n++;for(const p of t)for(let k=0;k<3;k++){o.mn[k]=Math.min(o.mn[k],p[k]);o.mx[k]=Math.max(o.mx[k],p[k]);}}
const out=[...C.values()].map(o=>({tris:o.n,x:[+o.mn[0].toFixed(2),+o.mx[0].toFixed(2)],y:[+o.mn[1].toFixed(2),+o.mx[1].toFixed(2)],z:[+o.mn[2].toFixed(2),+o.mx[2].toFixed(2)]}));
fs.writeFileSync(process.argv[3],JSON.stringify(out,null,0));console.log('tris',tris.length,'comps',out.length);
for(const o of out.sort((a,b)=>(b.x[1]-b.x[0])*(b.z[1]-b.z[0])-(a.x[1]-a.x[0])*(a.z[1]-a.z[0])).slice(0,25))console.log(JSON.stringify(o));})();
