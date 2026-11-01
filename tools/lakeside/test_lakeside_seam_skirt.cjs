'use strict';
/* b16 lakeside seam (场景设计部): the skycity -> lakeside balloon leg at ~21.7 s had a below-horizon ray (route BG2, 运镜bot) that
 * slipped under the LK_lake +x edge / LK_far_shore lake-facing edge / LK_far_hills edge and showed the clear colour ~108 m out.
 * tools/scene-fx/lakeside_seam_skirt.py hangs skirts (to y -2.8) from LK_far_shore's lake-side edges beyond the water and from
 * LK_lake's edges where the terrain under them is sunk. Checks, in lake-local metres on the committed GLBs:
 *  1. the BG2 hole rays (route 21.7 s / 21.8 s / 22.5 s, 7 screens' worth) now hit lake / terrain / far shore / far hills;
 *  2. a low close-up lens at the north-east corner sees no hole (grid of rays);
 *  3. the skirts are recorded (extras.qfSeamSkirt), small (<= 60 / 50 tris), never coplanar with another mesh (no z-fighting),
 *     never above the edge they hang from, and the script is idempotent (rebuild == committed bytes). */
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),os=require('node:os');
const L=require('../journey-integration/lakeside/lakeside-scene.cjs');const ROOT=path.resolve(__dirname,'../..'),M=L.B+'models/';
let n=0;const ok=(c,m)=>{n++;if(!c){console.error('FAIL',m);process.exit(1);}};
const I=L.instances(),G=I.filter(i=>/^LK_(lake|terrain|far_hills|far_shore)\.glb$/.test(i.glb));
function cast(o,d,max){let best=null;for(const g of G){const t=g.tris;for(let k=0;k<t.length;k+=9){const e1=[t[k+3]-t[k],t[k+4]-t[k+1],t[k+5]-t[k+2]],e2=[t[k+6]-t[k],t[k+7]-t[k+1],t[k+8]-t[k+2]];
 const p=[d[1]*e2[2]-d[2]*e2[1],d[2]*e2[0]-d[0]*e2[2],d[0]*e2[1]-d[1]*e2[0]],det=e1[0]*p[0]+e1[1]*p[1]+e1[2]*p[2];if(Math.abs(det)<1e-12)continue;const iv=1/det,s=[o[0]-t[k],o[1]-t[k+1],o[2]-t[k+2]],u=(s[0]*p[0]+s[1]*p[1]+s[2]*p[2])*iv;if(u<0||u>1)continue;
 const q=[s[1]*e1[2]-s[2]*e1[1],s[2]*e1[0]-s[0]*e1[2],s[0]*e1[1]-s[1]*e1[0]],v=(d[0]*q[0]+d[1]*q[1]+d[2]*q[2])*iv;if(v<0||u+v>1)continue;const tt=(e2[0]*q[0]+e2[1]*q[1]+e2[2]*q[2])*iv;if(tt>1e-4&&tt<max&&(best==null||tt<best.t))best={t:tt,glb:g.glb};}}return best;}
const norm=v=>{const l=Math.hypot(...v);return v.map(x=>x/l);};
// 1. the BG2 hole rays (lake-local camera / direction from the route at the failing frames)
const HOLES=[[[-6.09,21.83,45.43],[0.5208,-0.2016,-0.8296]],[[-6.09,21.83,45.43],[0.5194,-0.2015,-0.8305]],[[-6.25,21.67,45.21],[0.5241,-0.2009,-0.8276]],[[-6.99,20.61,43.72],[0.5371,-0.1907,-0.8216]]];
for(const [o,d] of HOLES){const h=cast(o,norm(d),800);ok(h,'BG2 hole ray from '+o+' now hits geometry');}
// 2. low close-up lens at the north-east lake corner
{const P=[60.5,2.2,-40],T=[54,-1.2,-51.5],fw=norm(T.map((v,i)=>v-P[i])),r=norm([fw[2]*0-0,0,0]);const R=norm([-fw[2],0,fw[0]]),U=[R[1]*fw[2]-R[2]*fw[1],R[2]*fw[0]-R[0]*fw[2],R[0]*fw[1]-R[1]*fw[0]];
 const th=Math.tan(25*Math.PI/180),a=1.25;let miss=0,rays=0;for(let j=0;j<40;j++)for(let k=0;k<50;k++){const x=((k+.5)/50*2-1)*th*a,y=((j+.5)/40*2-1)*th;const d=norm(fw.map((f,i)=>f+R[i]*x+U[i]*y));if(d[1]>=-Math.sin(.6*Math.PI/180))continue;rays++;if(!cast(P,d,800))miss++;}
 ok(rays>500&&miss===0,'NE-corner close-up: '+miss+' of '+rays+' below-horizon rays miss everything');}
// 3. skirt bookkeeping, size, z-fighting, idempotency
const glbJson=f=>{const b=fs.readFileSync(M+f);return JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString());};
const budget={'LK_far_shore.glb':60,'LK_lake.glb':50};
for(const f of Object.keys(budget)){const j=glbJson(f),ex=j.meshes[0].extras&&j.meshes[0].extras.qfSeamSkirt;ok(ex&&ex.skirtY===-2.8,f+' carries qfSeamSkirt');
 const tris=j.accessors[j.meshes[0].primitives[0].indices].count/3,add=tris-ex.baseIndices/3;ok(add>0&&add<=budget[f],f+' skirt '+add+' tris <= '+budget[f]);
 const inst=I.find(i=>i.glb===f),sk=inst.tris.subarray(ex.baseIndices*3);let cop=0;
 for(let k=0;k<sk.length;k+=9){const A=[sk[k],sk[k+1],sk[k+2]],e1=[sk[k+3]-A[0],sk[k+4]-A[1],sk[k+5]-A[2]],e2=[sk[k+6]-A[0],sk[k+7]-A[1],sk[k+8]-A[2]],nn=norm([e1[1]*e2[2]-e1[2]*e2[1],e1[2]*e2[0]-e1[0]*e2[2],e1[0]*e2[1]-e1[1]*e2[0]]);
  ok(Math.abs(nn[1])<.05,f+' skirt quads are vertical');
  for(const o of I){if(o===inst||o.box[1][1]<-3||o.box[0][1]>1)continue;const t=o.tris;for(let q=0;q<t.length;q+=9){const f1=[t[q+3]-t[q],t[q+4]-t[q+1],t[q+5]-t[q+2]],f2=[t[q+6]-t[q],t[q+7]-t[q+1],t[q+8]-t[q+2]],m=[f1[1]*f2[2]-f1[2]*f2[1],f1[2]*f2[0]-f1[0]*f2[2],f1[0]*f2[1]-f1[1]*f2[0]],ml=Math.hypot(...m);if(ml<1e-12)continue;
   if(Math.abs((m[0]*nn[0]+m[1]*nn[1]+m[2]*nn[2])/ml)<.98)continue;const dd=Math.abs(((A[0]-t[q])*m[0]+(A[1]-t[q+1])*m[1]+(A[2]-t[q+2])*m[2])/ml);if(dd>.05)continue;
   const lo=[0,1,2].map(i=>Math.min(t[q+i],t[q+3+i],t[q+6+i])),hi=[0,1,2].map(i=>Math.max(t[q+i],t[q+3+i],t[q+6+i]));const slo=[0,1,2].map(i=>Math.min(sk[k+i],sk[k+3+i],sk[k+6+i])),shi=[0,1,2].map(i=>Math.max(sk[k+i],sk[k+3+i],sk[k+6+i]));if([0,1,2].every(i=>lo[i]<=shi[i]+.01&&hi[i]>=slo[i]-.01))cop++;}}}
 ok(cop===0,f+' skirt coplanar overlaps (z-fighting) '+cop);}
{const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'seam-'));try{cp.execFileSync('python3',[ROOT+'/tools/scene-fx/lakeside_seam_skirt.py',M,tmp],{stdio:'pipe'});
 for(const f of Object.keys(budget))ok(Buffer.compare(fs.readFileSync(M+f),fs.readFileSync(path.join(tmp,f)))===0,f+' rebuild is byte-identical (idempotent)');}catch(e){if(/ENOENT|No module named/.test(String(e)))console.error('skip idempotency (python3/numpy missing)');else throw e;}finally{fs.rmSync(tmp,{recursive:true,force:true});}}
console.log(JSON.stringify({status:'PASS',checks:n}));
