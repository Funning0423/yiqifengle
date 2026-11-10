// true terrain top (ray-down) from the TERRAIN meshes + dock; y-over-terrain along every island edge (5 cm samples) and at vertices
const fs=require('fs'),path=require('path');const {nodeWorlds,vertexMapper}=require('../journey-integration/occlusion/lib-glb.cjs');const L=require('./lib.cjs');
const ROOT=path.resolve(__dirname,'../..');
async function load(file,rx,decMod){const raw=fs.readFileSync(path.join(ROOT,file));const jl=raw.readUInt32LE(12),doc=JSON.parse(raw.subarray(20,20+jl));
 const binOff=20+jl+8,bin=raw.subarray(binOff,binOff+raw.readUInt32LE(20+jl));const worlds=nodeWorlds(doc);const T=[];
 doc.nodes.forEach((node,i)=>{if(node.mesh===undefined||!rx.test(node.name||''))return;const map=vertexMapper(doc,i,worlds,null);
  for(const pr of doc.meshes[node.mesh].primitives){const ext=pr.extensions&&pr.extensions.KHR_draco_mesh_compression;let P=[],F=[];
   if(ext){const bv=doc.bufferViews[ext.bufferView],data=bin.subarray(bv.byteOffset||0,(bv.byteOffset||0)+bv.byteLength);const d=new decMod.Decoder(),buf=new decMod.DecoderBuffer();buf.Init(new Int8Array(data.buffer,data.byteOffset,data.byteLength),data.byteLength);const mesh=new decMod.Mesh();d.DecodeBufferToMesh(buf,mesh);
    const attr=d.GetAttributeByUniqueId(mesh,ext.attributes.POSITION),nv=mesh.num_points(),nf=mesh.num_faces(),pos=new decMod.DracoFloat32Array();d.GetAttributeFloatForAllPoints(mesh,attr,pos);
    for(let v=0;v<nv;v++)P.push(map([pos.GetValue(v*3),pos.GetValue(v*3+1),pos.GetValue(v*3+2)]));const face=new decMod.DracoInt32Array();for(let f=0;f<nf;f++){d.GetFaceFromMesh(mesh,f,face);T.push([P[face.GetValue(0)],P[face.GetValue(1)],P[face.GetValue(2)]]);}}
   else{const acc=k=>{const A=doc.accessors[k],v=doc.bufferViews[A.bufferView],o=(v.byteOffset||0)+(A.byteOffset||0);return {A,o,v};};const {A,o}=acc(pr.attributes.POSITION);for(let v=0;v<A.count;v++)P.push(map([bin.readFloatLE(o+v*12),bin.readFloatLE(o+v*12+4),bin.readFloatLE(o+v*12+8)]));
    const I=acc(pr.indices);const sz=I.A.componentType===5125?4:2;for(let k=0;k<I.A.count;k+=3){const g=j=>sz===4?bin.readUInt32LE(I.o+(k+j)*4):bin.readUInt16LE(I.o+(k+j)*2);T.push([P[g(0)],P[g(1)],P[g(2)]]);}}}});return T;}
module.exports=async function terrain(){const decMod=await require('/tmp/draco3d/node_modules/draco3d/draco3d.js').createDecoderModule({});
 const T=[...(process.env.DOCKONLY?[]:await load('creator-build-project/assets/bundles/static_seat_preview/room/room_no_original_chair.glb',/env_island_main|env_beach_wet_sand|env_beach_tide_pools|env_lighthouse_ext/,decMod)),...await load('creator-build-project/assets/bundles/region_island/ui-props/island_dock.glb',/island_dock/,decMod)];
 const G=new Map(),B=.5,k=(i,j)=>i+','+j;for(const t of T){const xs=t.map(p=>p[0]),zs=t.map(p=>p[2]);for(let i=Math.floor(Math.min(...xs)/B);i<=Math.floor(Math.max(...xs)/B);i++)for(let j=Math.floor(Math.min(...zs)/B);j<=Math.floor(Math.max(...zs)/B);j++){if(!G.has(k(i,j)))G.set(k(i,j),[]);G.get(k(i,j)).push(t);}}
 return (x,z,below=9)=>{let best=null;for(const t of G.get(k(Math.floor(x/B),Math.floor(z/B)))||[]){const [a,b,c]=t;const d=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);if(Math.abs(d)<1e-12)continue;
  const l1=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/d,l2=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/d,l3=1-l1-l2;if(l1<-1e-6||l2<-1e-6||l3<-1e-6)continue;const y=l1*a[1]+l2*b[1]+l3*c[1];if(y<=below&&(best===null||y>best))best=y;}return best;};};
if(require.main===module)(async()=>{const ty=await module.exports();for(const f of process.argv.slice(2)){console.log(f);for(const e of JSON.parse(fs.readFileSync(f)).island.edges){const Lt=L.plen(e.path);let m={d:-9},vm={d:-9};
 for(let s=0;s<=Lt+1e-9;s+=0.05){const g=L.along(e.path,s);const t=ty(g[0],g[2],g[1]+0.6);if(t===null)continue;if(g[1]-t>m.d)m={d:+(g[1]-t).toFixed(3),at:[+g[0].toFixed(2),+g[2].toFixed(2)],y:g[1].toFixed(3),terr:t.toFixed(3)};}
 for(const p of e.path){const t=ty(p[0],p[2],p[1]+0.6);if(t!==null&&p[1]-t>vm.d)vm={d:+(p[1]-t).toFixed(3),at:[p[0],p[2]],y:p[1],terr:+t.toFixed(3)};}
 console.log(' ',e.a+'-'+e.b,'along',JSON.stringify(m),'vertex',JSON.stringify(vm));}}})();
