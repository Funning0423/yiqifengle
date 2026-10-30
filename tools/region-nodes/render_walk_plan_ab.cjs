#!/usr/bin/env node
'use strict';
// 运镜bot full9c: NOT_ENGINE frame-by-frame sheet of the 5a walk lens (T-02 finale → mooring C), same t per column:
// A = pre-full9c (old finale pose, old plan), B = restored (S6 finale pose + SKY_FINALE_CITY_LOCAL, plan as baked), C = the rejected
// regen (S6 pose, city dragged by the pose: arm -2.2). Flat z-buffer of the real skycity mesh; her = red box, face = yellow dot. 390x844.
const fs=require('fs');const ROOT=process.cwd();const H=require(ROOT+'/tools/board-ui/harness.cjs').createHarness();
const LSm=H.load('region/LensSmooth.ts'),SW=H.load('region/SkyWalkShot.ts'),FS=H.load('region/SkyFinaleShot.ts'),TS=H.load('region/TransitionStaging.ts'),AD=H.load('region/TransitionAnchorData.ts'),SO=H.load('region/SkycityLensOccluders.ts');
const RL=require(ROOT+'/tools/journey-integration/route/route-legs.cjs');const OUT=process.argv[2]||'/tmp/walkab';fs.mkdirSync(OUT,{recursive:true});
const M5=TS.TRANSITION_STAGING.skyMooring5a,L2W=q=>SW.skyLocalToWorld(M5,q),o0=L2W([0,0,0]),ex=L2W([1,0,0]).map((v,i)=>v-o0[i]),ez=L2W([0,0,1]).map((v,i)=>v-o0[i]);
const W2L=p=>{const d=[p[0]-o0[0],p[2]-o0[2]];return [d[0]*ex[0]+d[1]*ex[2],p[1]-o0[1],d[0]*ez[0]+d[1]*ez[2]];};
const pw=P=>({position:L2W(P.position),target:L2W(P.target),fovVerticalDeg:P.fovVerticalDeg});
const OLDF=pw({position:[1.972,1.542,-18.668],target:[0.377,1.839,-27.012],fovVerticalDeg:45}),NEWF=pw(FS.SKY_FINALE_POSE_LOCAL);
const BX=[...AD.transitionOccluderBoxes(),...SW.skyBoxesToWorld(M5,SO.SKYCITY_LENS_OCCLUDERS,M5.walkWorld)];
const oldPlan=JSON.parse(process.env.QF_OLD_PLAN_JSON||'null')||AD.SKY_5A_WALK_PLAN,rej=JSON.parse(fs.readFileSync(__dirname+'/walk_plan_rejected_arm22.json','utf8'));
const mk=(fin,city,plan)=>SW.skyWalkShot(M5.walkWorld,M5.walkMps,2,BX,city,{...SW.SKY_WALK_SHOT,plan},fin);
const V={A:mk(OLDF,SW.finaleCity(OLDF),oldPlan),B:mk(NEWF,L2W(FS.SKY_FINALE_CITY_LOCAL),AD.SKY_5A_WALK_PLAN),C:mk(NEWF,SW.finaleCity(NEWF),rej)};
const TT=[0,1,2,3,4,5.2,7,9,11,13,15,V.A.total-0.05];
(async()=>{const T=[];for(const o of (await RL.skyLocal()).filter(o=>!/cloudsea|cumulus_far|cloud_small|Icosphere|_after|env_sky_dome/.test(o.name))){const t=o.tris;for(let i=0;i<t.length;i+=9)T.push(Array.from(t.slice(i,i+9)));}
 const w=390,h=844,k=300/h,Wd=Math.round(w*k),Hh=300,frames=[];
 for(const [lab,S] of Object.entries(V))for(const t of TT){const ps=S.pose(t),P=W2L(ps.position),Tg=W2L(ps.target),feet=W2L(S.her(t).feet);
  const f=[Tg[0]-P[0],Tg[1]-P[1],Tg[2]-P[2]],fl=Math.hypot(...f);for(let i=0;i<3;i++)f[i]/=fl;let r=[-f[2],0,f[0]];const rl=Math.hypot(r[0],r[2]);r=[r[0]/rl,0,r[2]/rl];const u=[r[1]*f[2]-r[2]*f[1],r[2]*f[0]-r[0]*f[2],r[0]*f[1]-r[1]*f[0]];
  const tv=Math.tan((ps.fovVerticalDeg||45)*Math.PI/360),th=tv*w/h;const pr=q=>{const d=[q[0]-P[0],q[1]-P[1],q[2]-P[2]],z=d[0]*f[0]+d[1]*f[1]+d[2]*f[2];return [((d[0]*r[0]+d[1]*r[1]+d[2]*r[2])/(z*th)*.5+.5)*Wd,(.5-(d[0]*u[0]+d[1]*u[1]+d[2]*u[2])/(z*tv)*.5)*Hh,z];};
  const img=Buffer.alloc(Wd*Hh*3);for(let i=0;i<Wd*Hh;i++){img[i*3]=160;img[i*3+1]=185;img[i*3+2]=215;}const zb=new Float32Array(Wd*Hh).fill(1e9);
  const draw=(t,col)=>{const a=pr(t.slice(0,3)),b=pr(t.slice(3,6)),c=pr(t.slice(6,9));if(a[2]<.05||b[2]<.05||c[2]<.05)return;const e1=[t[3]-t[0],t[4]-t[1],t[5]-t[2]],e2=[t[6]-t[0],t[7]-t[1],t[8]-t[2]],n=[e1[1]*e2[2]-e1[2]*e2[1],e1[2]*e2[0]-e1[0]*e2[2],e1[0]*e2[1]-e1[1]*e2[0]],nl=Math.hypot(...n)||1,sh=.55+.45*Math.abs((n[0]*.3+n[1]*.8+n[2]*.5)/nl);
   const x0=Math.max(0,Math.floor(Math.min(a[0],b[0],c[0]))),x1=Math.min(Wd-1,Math.ceil(Math.max(a[0],b[0],c[0]))),y0=Math.max(0,Math.floor(Math.min(a[1],b[1],c[1]))),y1=Math.min(Hh-1,Math.ceil(Math.max(a[1],b[1],c[1])));if(x0>x1||y0>y1)return;
   const den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(den)<1e-9)return;for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const px=x+.5,py=y+.5,l1=((b[1]-c[1])*(px-c[0])+(c[0]-b[0])*(py-c[1]))/den,l2=((c[1]-a[1])*(px-c[0])+(a[0]-c[0])*(py-c[1]))/den,l3=1-l1-l2;if(l1<0||l2<0||l3<0)continue;const z=1/(l1/a[2]+l2/b[2]+l3/c[2]),j=y*Wd+x;if(z>=zb[j])continue;zb[j]=z;img[j*3]=col[0]*sh;img[j*3+1]=col[1]*sh;img[j*3+2]=col[2]*sh;}};
  for(const q of T)draw(q,[120,125,140]);const x0=feet[0]-.25,x1=feet[0]+.25,z0=feet[2]-.25,z1=feet[2]+.25,y0=feet[1],y1=feet[1]+1.7,v=[[x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1],[x0,y1,z0],[x1,y1,z0],[x1,y1,z1],[x0,y1,z1]];
  for(const [a,b,c,d] of [[0,1,2,3],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]]){draw([...v[a],...v[b],...v[c]],[235,40,40]);draw([...v[a],...v[c],...v[d]],[235,40,40]);}
  const fd=pr([feet[0],feet[1]+1.5,feet[2]]);for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){const x=Math.round(fd[0])+dx,y=Math.round(fd[1])+dy;if(x>=0&&y>=0&&x<Wd&&y<Hh){const j=y*Wd+x;img[j*3]=255;img[j*3+1]=230;img[j*3+2]=0;}}
  const file=`${OUT}/${lab}-t${t.toFixed(1)}.ppm`;fs.writeFileSync(file,Buffer.concat([Buffer.from(`P6 ${Wd} ${Hh} 255\n`),img]));
  frames.push({lab,t:+t.toFixed(2),file,herMargin7:+Math.min(...LSm.LENS_SMOOTH.screens.map(sc=>LSm.herMargin(ps.position,ps.target,ps.fovVerticalDeg,S.her(t).feet,[sc]))).toFixed(2),camLocal:P.map(v=>+v.toFixed(3)),camStepFromA:null});}
 for(const f of frames){const a=frames.find(g=>g.lab==='A'&&g.t===f.t);f.camStepFromA=+Math.hypot(...f.camLocal.map((v,i)=>v-a.camLocal[i])).toFixed(3);}
 fs.writeFileSync(OUT+'/frames.json',JSON.stringify(frames,null,1));console.log(JSON.stringify(frames.filter(f=>f.lab!=='A').map(f=>[f.lab,f.t,f.camStepFromA])));})().catch(e=>{console.error(e);process.exit(1);});
