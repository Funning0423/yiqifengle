#!/usr/bin/env node
'use strict';
// 运镜bot full9c: NOT_ENGINE before/after of the held T-02 finale shot — before: stand = old planWalk end (0.941,0.044,-27.059) +
// old SKY_FINALE_POSE_LOCAL; after: stand = S6 node + the shifted SKY_FINALE_POSE_LOCAL. Flat-shaded z-buffer of the real skycity mesh
// (route-legs skyLocal, skycity model-local), her = red 0.5×1.7 m box + yellow face dot, WeChat capsule = magenta outline. 7 screens.
// Usage: render_finale_stand_ab.cjs <outDir>  → writes <outDir>/frames.json + one PPM per frame (compose with any image tool).
const fs=require('fs');const ROOT=process.cwd();const {createHarness}=require(ROOT+'/tools/board-ui/harness.cjs');const H=createHarness();
const F=H.load('region/SkyFinaleShot.ts');const RL=require(ROOT+'/tools/journey-integration/route/route-legs.cjs');
const OUT=process.argv[2]||'/tmp/finab';fs.mkdirSync(OUT,{recursive:true});
const SCR=[[390,844],[414,896],[360,780],[375,667],[320,568],[390,520],[768,1024]];
const OLD={feet:[0.941,0.044,-27.059],pose:{position:[1.972,1.542,-18.668],target:[0.377,1.839,-27.012],fovVerticalDeg:45}},NEW={feet:[0.2,0.034,-27.8],pose:F.SKY_FINALE_POSE_LOCAL};
(async()=>{const sky=(await RL.skyLocal()).filter(o=>!/cloudsea|cumulus_far|cloud_small|Icosphere|_after|env_sky_dome/.test(o.name));
 const T=[];for(const o of sky){const t=o.tris;for(let i=0;i<t.length;i+=9)T.push([t[i],t[i+1],t[i+2],t[i+3],t[i+4],t[i+5],t[i+6],t[i+7],t[i+8]]);}
 const box=(f)=>{const x0=f[0]-.25,x1=f[0]+.25,z0=f[2]-.25,z1=f[2]+.25,y0=f[1],y1=f[1]+1.7,v=[[x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1],[x0,y1,z0],[x1,y1,z0],[x1,y1,z1],[x0,y1,z1]],q=[[0,1,2,3],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]],o=[];for(const [a,b,c,d] of q){o.push([...v[a],...v[b],...v[c]],[...v[a],...v[c],...v[d]]);}return o;};
 const frames=[];
 for(const [lab,S] of [['before',OLD],['after',NEW]])for(const [w,h] of SCR){const k=360/h,W=Math.round(w*k),Hh=360;const P=S.pose.position,Tg=S.pose.target;
  const f=[Tg[0]-P[0],Tg[1]-P[1],Tg[2]-P[2]],fl=Math.hypot(...f);for(let i=0;i<3;i++)f[i]/=fl;let r=[-f[2],0,f[0]];const rl=Math.hypot(r[0],r[2]);r=[r[0]/rl,0,r[2]/rl];const u=[r[1]*f[2]-r[2]*f[1],r[2]*f[0]-r[0]*f[2],r[0]*f[1]-r[1]*f[0]];
  const tv=Math.tan(S.pose.fovVerticalDeg*Math.PI/360),th=tv*w/h;const pr=q=>{const d=[q[0]-P[0],q[1]-P[1],q[2]-P[2]],z=d[0]*f[0]+d[1]*f[1]+d[2]*f[2];return [((d[0]*r[0]+d[1]*r[1]+d[2]*r[2])/(z*th)*.5+.5)*W,(.5-(d[0]*u[0]+d[1]*u[1]+d[2]*u[2])/(z*tv)*.5)*Hh,z];};
  const img=Buffer.alloc(W*Hh*3);for(let i=0;i<W*Hh;i++){const y=Math.floor(i/W)/Hh;img[i*3]=150+40*y;img[i*3+1]=175+30*y;img[i*3+2]=215;}const zb=new Float32Array(W*Hh).fill(1e9);
  const draw=(t,col)=>{const a=pr(t.slice(0,3)),b=pr(t.slice(3,6)),c=pr(t.slice(6,9));if(a[2]<.05||b[2]<.05||c[2]<.05)return;const e1=[t[3]-t[0],t[4]-t[1],t[5]-t[2]],e2=[t[6]-t[0],t[7]-t[1],t[8]-t[2]],n=[e1[1]*e2[2]-e1[2]*e2[1],e1[2]*e2[0]-e1[0]*e2[2],e1[0]*e2[1]-e1[1]*e2[0]],nl=Math.hypot(...n)||1,sh=.55+.45*Math.abs((n[0]*.3+n[1]*.8+n[2]*.5)/nl);
   const x0=Math.max(0,Math.floor(Math.min(a[0],b[0],c[0]))),x1=Math.min(W-1,Math.ceil(Math.max(a[0],b[0],c[0]))),y0=Math.max(0,Math.floor(Math.min(a[1],b[1],c[1]))),y1=Math.min(Hh-1,Math.ceil(Math.max(a[1],b[1],c[1])));if(x0>x1||y0>y1)return;
   const den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(den)<1e-9)return;for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const px=x+.5,py=y+.5,l1=((b[1]-c[1])*(px-c[0])+(c[0]-b[0])*(py-c[1]))/den,l2=((c[1]-a[1])*(px-c[0])+(a[0]-c[0])*(py-c[1]))/den,l3=1-l1-l2;if(l1<0||l2<0||l3<0)continue;const z=1/(l1/a[2]+l2/b[2]+l3/c[2]),j=y*W+x;if(z>=zb[j])continue;zb[j]=z;img[j*3]=col[0]*sh;img[j*3+1]=col[1]*sh;img[j*3+2]=col[2]*sh;}};
  for(const t of T)draw(t,[120,125,140]);for(const t of box(S.feet))draw(t,[235,40,40]);
  const fd=pr([S.feet[0],S.feet[1]+1.5,S.feet[2]]);for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++){const x=Math.round(fd[0])+dx,y=Math.round(fd[1])+dy;if(x>=0&&y>=0&&x<W&&y<Hh){img[(y*W+x)*3]=255;img[(y*W+x)*3+1]=230;img[(y*W+x)*3+2]=0;}}
  const cap=[(w-7-87)*k,(48)*k,(w-7)*k,(48+32)*k];for(let x=Math.floor(cap[0]);x<=cap[2];x++)for(const y of [Math.floor(cap[1]),Math.floor(cap[3])]){const j=y*W+x;if(j>=0&&j<W*Hh){img[j*3]=255;img[j*3+1]=0;img[j*3+2]=255;}}for(let y=Math.floor(cap[1]);y<=cap[3];y++)for(const x of [Math.floor(cap[0]),Math.floor(cap[2])]){const j=y*W+x;img[j*3]=255;img[j*3+1]=0;img[j*3+2]=255;}
  const file=`${OUT}/${lab}-${w}x${h}.ppm`;fs.writeFileSync(file,Buffer.concat([Buffer.from(`P6 ${W} ${Hh} 255\n`),img]));frames.push({lab,screen:w+'x'+h,file,facePx:[+(fd[0]/k).toFixed(0),+(fd[1]/k).toFixed(0)]});}
 fs.writeFileSync(OUT+'/frames.json',JSON.stringify(frames,null,1));console.log(JSON.stringify({frames:frames.length,out:OUT}));})().catch(e=>{console.error(e);process.exit(1);});
