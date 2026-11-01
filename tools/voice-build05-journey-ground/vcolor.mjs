// Vertex-colour variation on env_sky_static_palette (glb-local), zero added geometry. Deterministic.
// node vcolor.mjs in.glb route.csv tmp_out.glb   (then splice.mjs in.glb tmp_out.glb out.glb env_sky_static_palette)
import {NodeIO} from '@gltf-transform/core';import {ALL_EXTENSIONS,KHRDracoMeshCompression} from '@gltf-transform/extensions';import draco3d from 'draco3dgltf';import fs from 'fs';
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'draco3d.decoder':await draco3d.createDecoderModule(),'draco3d.encoder':await draco3d.createEncoderModule()});
const [src,csv,out]=process.argv.slice(2);const doc=await io.read(src);
const rows=fs.readFileSync(csv,'utf8').trim().split('\n');const H=rows[0].split(',');const ix=k=>H.indexOf(k);
const R=rows.slice(1).map(r=>r.split(',')).map(c=>({d:+c[0],p:[+c[ix('sky_local_x')],+c[ix('sky_local_y')],+c[ix('sky_local_z')]]}));
const DMIN=+(process.env.VB_DMIN||25),RAD=+(process.env.VB_RAD||28);const route=R.filter(r=>r.d>=DMIN).map(r=>r.p);
// 09 board-background camera (SkycityVisitPose) — anchors in glTF local
const A=[-1.4,-0.068,32.6],B=[0,-0.066,30.0];
const board=asp=>{const c=[(A[0]+B[0])/2,(A[1]+B[1])/2+1,(A[2]+B[2])/2],span=Math.hypot(A[0]-B[0],A[1]-B[1],A[2]-B[2]),r=Math.max(6,span*.65+2),fov=55,half=Math.atan(Math.tan(fov*Math.PI/360)*Math.min(1,asp)),d=r/Math.sin(half)*1.12,n=Math.hypot(.3,.55,1.3);return {C:[c[0]+d*.3/n,c[1]+d*.55/n,c[2]+d*1.3/n],T:c,fov,asp};};
const norm=v=>{const l=Math.hypot(...v)||1;return v.map(x=>x/l)},cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const boards=[9/19.5,9/16,3/4,1,16/9,2.2].map(board).map(b=>{const f=norm(b.T.map((x,i)=>x-b.C[i])),r=norm(cross(f,[0,1,0])),u=cross(r,f);return {...b,f,r,u,t:Math.tan(b.fov*Math.PI/360)};});
const inBoard=(v,m)=>boards.some(b=>{const d=v.map((x,i)=>x-b.C[i]),z=dot(d,b.f);if(z<=0.05)return false;return Math.abs(dot(d,b.r)/(z*b.t*b.asp))<m&&Math.abs(dot(d,b.u)/(z*b.t))<m;});
// smooth value noise
const hash=(x,y,z)=>{let h=(x*374761393+y*668265263+z*2147483647)|0;h=(h^(h>>>13))*1274126177|0;return ((h^(h>>>16))>>>0)/4294967295;};
const sm=t=>t*t*(3-2*t);
const noise=(x,y,z)=>{const X=Math.floor(x),Y=Math.floor(y),Z=Math.floor(z),fx=sm(x-X),fy=sm(y-Y),fz=sm(z-Z);let s=0;for(let a=0;a<2;a++)for(let b=0;b<2;b++)for(let c=0;c<2;c++)s+=hash(X+a,Y+b,Z+c)*(a?fx:1-fx)*(b?fy:1-fy)*(c?fz:1-fz);return s;};
const m=doc.getRoot().listMeshes().find(m=>m.getName()==='env_sky_static_palette'),p=m.listPrimitives()[0];
// --- subdivide big flat ground triangles near the late route (coplanar: surface unchanged, only lets colour vary)
const SEM=['POSITION','NORMAL','TEXCOORD_0','COLOR_0'],att=Object.fromEntries(SEM.map(k=>[k,Array.from(p.getAttribute(k).getArray())])),sz=Object.fromEntries(SEM.map(k=>[k,p.getAttribute(k).getElementSize()]));
let I0=Array.from(p.getIndices().getArray());const AREA=+(process.env.VB_AREA||3),EDGE=+(process.env.VB_EDGE||1.4);
const pv=i=>[att.POSITION[3*i],att.POSITION[3*i+1],att.POSITION[3*i+2]];
const near=v=>{let m=1e9;for(const r of route){const d=Math.hypot(v[0]-r[0],v[2]-r[2]);if(d<m)m=d;}return m;};
const keep=[];let subT=0,addV=0;
for(let t=0;t<I0.length;t+=3){const f=[I0[t],I0[t+1],I0[t+2]],a=pv(f[0]),b=pv(f[1]),c=pv(f[2]);
 const e1=b.map((x,i)=>x-a[i]),e2=c.map((x,i)=>x-a[i]),cr=cross(e1,e2),area=Math.hypot(...cr)/2,ny=cr[1]/(2*area||1);
 if(area<AREA||Math.abs(ny)<0.75||f.some(i=>near(pv(i))>RAD)||f.some(i=>inBoard(pv(i),2.0))){keep.push(...f);continue;}
 const L=Math.max(Math.hypot(...e1),Math.hypot(...e2),Math.hypot(...c.map((x,i)=>x-b[i]))),n=Math.min(12,Math.ceil(L/EDGE));
 const id={};const vid=(i,j)=>{const k=i+','+j;if(k in id)return id[k];if(i===0&&j===0)return id[k]=f[0];if(i===n&&j===0)return id[k]=f[1];if(i===0&&j===n)return id[k]=f[2];
  const u=i/n,w=j/n,v0=1-u-w,nv=att.POSITION.length/3;for(const s of SEM){const z=sz[s];for(let q=0;q<z;q++)att[s].push(att[s][z*f[0]+q]*v0+att[s][z*f[1]+q]*u+att[s][z*f[2]+q]*w);}addV++;return id[k]=nv;};
 const o=[];for(let i=0;i<n;i++)for(let j=0;j<n-i;j++){o.push(vid(i,j),vid(i+1,j),vid(i,j+1));if(i+j<n-1)o.push(vid(i+1,j),vid(i+1,j+1),vid(i,j+1));}
 keep.push(...o);subT++;}
for(const s of SEM){const A0=p.getAttribute(s).getArray();p.getAttribute(s).setArray(new A0.constructor(att[s]));}
p.getIndices().setArray(att.POSITION.length/3>65535?new Uint32Array(keep):new Uint16Array(keep));console.log(JSON.stringify({subdividedTris:subT,addedVerts:addV,trisBefore:I0.length/3,trisAfter:keep.length/3}));
const P=p.getAttribute('POSITION').getArray(),col=p.getAttribute('COLOR_0'),C=col.getArray().slice(),I=p.getIndices().getArray(),N=P.length/3;
const lock=new Uint8Array(N);const V=i=>[P[3*i],P[3*i+1],P[3*i+2]];
for(let t=0;t<I.length;t+=3){const f=[I[t],I[t+1],I[t+2]];if(f.some(i=>inBoard(V(i),2.0)))f.forEach(i=>lock[i]=1);}
let changed=0,locked=0;
for(let i=0;i<N;i++){const v=V(i);let dmin=1e9;for(const r of route){const d=Math.hypot(v[0]-r[0],v[2]-r[2]);if(d<dmin)dmin=d;}
 if(dmin>RAD)continue;if(lock[i]){locked++;continue;}
 const w=Math.min(1,(RAD-dmin)/4); // fade in at the region edge
 const n1=noise(v[0]/2.4,v[1]/2.4,v[2]/2.4),n2=noise(v[0]/1.1+17,v[1]/1.1,v[2]/1.1+5),n3=noise(v[0]/7+40,0,v[2]/7);
 const bright=0.58+0.42*(0.6*n1+0.4*n2);             // 0.58..1.00 linear (~0.78..1 sRGB)
 const warm=Math.max(0,n3-0.42)*1.3;                  // dry/yellow patches
 const cool=Math.max(0,0.45-n3)*0.5;                  // deeper green patches
 const tint=[bright*(1-cool*0.25), bright, bright*(1-warm*0.55-cool*0.1)];
 for(let k=0;k<3;k++)C[3*i+k]=1+(tint[k]-1)*w; changed++;}
col.setArray(C);console.log(JSON.stringify({changed,locked,verts:N,DMIN,RAD}));
doc.getRoot().listExtensionsUsed().find(e=>e.extensionName==='KHR_draco_mesh_compression').setEncoderOptions({method:KHRDracoMeshCompression.EncoderMethod.EDGEBREAKER,encodeSpeed:0,decodeSpeed:5,quantizationBits:{POSITION:16,NORMAL:12,TEX_COORD:14,COLOR:10,GENERIC:12}});
await io.write(out,doc);
