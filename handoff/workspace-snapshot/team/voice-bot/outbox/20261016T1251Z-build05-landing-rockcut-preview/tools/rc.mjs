// Landing rock-cut preview: lower (vertical-only) vertices of env_skycity pieces that block
//  (a) A's final camera -> plaza line of sight, (b) a lowered mid-path camera (d41-45) -> her head/chest.
// Locks: verts within ROUTE_LOCK m (xz) of the route; verts inside the 09 board frustum (BOARD_M margin).
import {NodeIO} from '@gltf-transform/core';import {ALL_EXTENSIONS,KHRDracoMeshCompression} from '@gltf-transform/extensions';import draco3d from 'draco3dgltf';import fs from 'fs';
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'draco3d.decoder':await draco3d.createDecoderModule(),'draco3d.encoder':await draco3d.createEncoderModule()});
const [src,out,repf]=process.argv.slice(2);const doc=await io.read(src);
const J=JSON.parse(fs.readFileSync('/tmp/rc/poses.json')),R=JSON.parse(fs.readFileSync('/tmp/rc/route.json'));
const LOW=+(process.env.LOW||9),ROUTE_LOCK=+(process.env.RL||1.5),BOARD_M=+(process.env.BM||1.3),MARGIN=0.15;
const EDIT=(process.env.EDIT||'env_sky_static_palette,env_sky_static_foliage_cards').split(',');
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],norm=v=>{const l=Math.hypot(...v)||1;return v.map(x=>x/l)},sub=(a,b)=>a.map((x,i)=>x-b[i]);
const A=[-1.4,-0.068,32.6],B=[0,-0.066,30.0];
const board=asp=>{const c=[(A[0]+B[0])/2,(A[1]+B[1])/2+1,(A[2]+B[2])/2],span=Math.hypot(A[0]-B[0],A[1]-B[1],A[2]-B[2]),r=Math.max(6,span*.65+2),fov=55,half=Math.atan(Math.tan(fov*Math.PI/360)*Math.min(1,asp)),d=r/Math.sin(half)*1.12,n=Math.hypot(.3,.55,1.3);return {C:[c[0]+d*.3/n,c[1]+d*.55/n,c[2]+d*1.3/n],T:c,fov,asp};};
const boards=[9/19.5,9/16,3/4,1,16/9,2.2].map(board).map(b=>{const f=norm(sub(b.T,b.C)),r=norm(cross(f,[0,1,0])),u=cross(r,f);return {...b,f,r,u,t:Math.tan(b.fov*Math.PI/360)};});
const inBoard=(v,m)=>boards.some(b=>{const d=sub(v,b.C),z=dot(d,b.f);if(z<=0.05)return false;return Math.abs(dot(d,b.r)/(z*b.t*b.asp))<m&&Math.abs(dot(d,b.u)/(z*b.t))<m;});
// meshes in world (scene) space
const M={};for(const n of doc.getRoot().listNodes()){const m=n.getMesh();if(!m)continue;const nm=m.getName();if(!/^env_sky_(static_palette|static_foliage_cards|ruins|static_rock_strata|island_vines|greattree_canopy)$/.test(nm))continue;
 const W=n.getWorldMatrix();for(const [pi,p] of m.listPrimitives().entries()){const P=p.getAttribute('POSITION').getArray(),I=p.getIndices().getArray(),N=P.length/3,Wp=new Float64Array(P.length);
  for(let i=0;i<N;i++){const x=P[3*i],y=P[3*i+1],z=P[3*i+2];for(let k=0;k<3;k++)Wp[3*i+k]=W[k]*x+W[4+k]*y+W[8+k]*z+W[12+k];}
  M[nm+'#'+pi]={nm,p,P,I,Wp,W,edit:EDIT.includes(nm)};}}
function hit(o,e){const d=sub(e,o),L=Math.hypot(...d),u=d.map(x=>x/L);let best=null;
 for(const [key,m] of Object.entries(M)){const {I,Wp}=m;for(let t=0;t<I.length;t+=3){const a=3*I[t],b=3*I[t+1],c=3*I[t+2];
  // quick reject by bbox of segment
  const ax=Wp[a],ay=Wp[a+1],az=Wp[a+2];const e1=[Wp[b]-ax,Wp[b+1]-ay,Wp[b+2]-az],e2=[Wp[c]-ax,Wp[c+1]-ay,Wp[c+2]-az];
  const pv=cross(u,e2),det=dot(e1,pv);if(Math.abs(det)<1e-12)continue;const iv=1/det,tv=[o[0]-ax,o[1]-ay,o[2]-az],uu=dot(tv,pv)*iv;if(uu<0||uu>1)continue;const q=cross(tv,e1),vv=dot(u,q)*iv;if(vv<0||uu+vv>1)continue;const tt=dot(e2,q)*iv;
  if(tt>0.05&&tt<L-0.05&&(!best||tt<best.t))best={t:tt,key,tri:t/3};}}return best;}
// rays
const MODE=process.env.MODE||'both';const rays=[];const fin=J.A[J.A.length-1],F=J.focus;
for(let dx=-6;dx<=6;dx+=1.5)for(let dz=-6;dz<=6;dz+=1.5)for(const dy of [0.3,1.0,1.5])if(MODE!=='mid')rays.push({kind:'final',o:fin.position,e:[F[0]+dx,F[1]+dy,F[2]+dz]});
for(const x of J.A){if(x.d<41||x.d>45.01)continue;const c=[x.position[0],process.env.CAMH?x.char[1]+(+process.env.CAMH):x.position[1]-LOW,x.position[2]];for(const hy of [1.1,1.3,1.5])if(MODE!=='final')rays.push({kind:'mid',o:c,e:[x.char[0],x.char[1]+hy,x.char[2]]});}
const nearRoute=v=>{for(const r of R)if(Math.hypot(v[0]-r[0],v[2]-r[2])<ROUTE_LOCK)return true;return false;};
// position-keyed vertex groups per mesh (so coincident duplicates move together)
for(const m of Object.values(M)){m.grp=new Map();for(let i=0;i<m.P.length/3;i++){const k=[0,1,2].map(q=>Math.round(m.P[3*i+q]*1000)).join(',');(m.grp.get(k)||m.grp.set(k,[]).get(k)).push(i);}const k0=[];for(let i=0;i<m.P.length/3;i++)k0.push([0,1,2].map(q=>Math.round(m.P[3*i+q]*1000)).join(','));m.keyOf=i=>k0[i];m.moved=new Map();m.facesHit=new Set();}
const stuck={};let it=0;
for(;it<60;it++){let changed=0,blocked={final:0,mid:0};
 for(const r of rays){const h=hit(r.o,r.e);if(!h)continue;blocked[r.kind]++;const m=M[h.key];
  if(!m.edit){stuck[m.nm+':'+h.tri]=(stuck[m.nm+':'+h.tri]||0)+1;continue;}
  m.facesHit.add(h.tri);
  const d=sub(r.e,r.o);
  for(const j of [0,1,2]){const vi=m.I[3*h.tri+j],w=[m.Wp[3*vi],m.Wp[3*vi+1],m.Wp[3*vi+2]];
   if(nearRoute(w)||inBoard(w,BOARD_M)){stuck[m.nm+':'+h.tri+':locked']=1;continue;}
   const tt=Math.max(0,Math.min(1,((w[0]-r.o[0])*d[0]+(w[2]-r.o[2])*d[2])/(d[0]*d[0]+d[2]*d[2])));const yl=r.o[1]+d[1]*tt-MARGIN;
   if(w[1]>yl){const dy=Math.max(yl,w[1]-6)-w[1];for(const g of m.grp.get(m.keyOf(vi))){m.Wp[3*g+1]+=dy;m.P[3*g+1]+=dy/m.W[5];m.moved.set(g,(m.moved.get(g)||0)+dy);}changed++;}}}
 console.error('iter',it,JSON.stringify(blocked),'changed',changed);if(!changed)break;}
// final blocked counts
const fb={final:0,mid:0},fbw={};for(const r of rays){const h=hit(r.o,r.e);if(h){fb[r.kind]++;const k=r.kind+':'+M[h.key].nm;fbw[k]=(fbw[k]||0)+1;}}
const rep={rays:{final:rays.filter(r=>r.kind==='final').length,mid:rays.filter(r=>r.kind==='mid').length},stillBlocked:fb,stillBlockedBy:fbw,LOW,ROUTE_LOCK,BOARD_M,meshes:{}};
for(const m of Object.values(M)){if(!m.moved.size)continue;const ids=[...m.moved.keys()],pos=ids.map(i=>[m.Wp[3*i],m.Wp[3*i+1]-m.moved.get(i),m.Wp[3*i+2]]);
 rep.meshes[m.nm]={vertsMoved:ids.length,maxDrop:+Math.min(...m.moved.values()).toFixed(2),bboxBefore:[[0,1,2].map(k=>+Math.min(...pos.map(p=>p[k])).toFixed(2)),[0,1,2].map(k=>+Math.max(...pos.map(p=>p[k])).toFixed(2))],facesOnBlockedRays:[...m.facesHit].sort((a,b)=>a-b),vertexIds:ids.sort((a,b)=>a-b),drops:Object.fromEntries(ids.map(i=>[i,+m.moved.get(i).toFixed(4)]))};
 m.p.getAttribute('POSITION').setArray(new Float32Array(m.P));}
fs.writeFileSync(repf,JSON.stringify(rep,null,1));console.log(JSON.stringify({...rep,meshes:Object.fromEntries(Object.entries(rep.meshes).map(([k,v])=>[k,{vertsMoved:v.vertsMoved,maxDrop:v.maxDrop,bbox:v.bboxBefore,faces:v.facesOnBlockedRays.length}]))}));
console.log('stuck',JSON.stringify(Object.entries(stuck).sort((a,b)=>b[1]-a[1]).slice(0,15)));
doc.getRoot().listExtensionsUsed().find(e=>e.extensionName==='KHR_draco_mesh_compression').setEncoderOptions({method:KHRDracoMeshCompression.EncoderMethod.EDGEBREAKER,encodeSpeed:0,decodeSpeed:5,quantizationBits:{POSITION:16,NORMAL:12,TEX_COORD:14,COLOR:10,GENERIC:12}});
await io.write(out,doc);
