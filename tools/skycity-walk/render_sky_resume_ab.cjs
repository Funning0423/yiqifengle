#!/usr/bin/env node
'use strict';
// 运镜bot full9-skyfollow: NOT_ENGINE before/after — old resume lens (SkyPreFollow.skyPreFollowLens) vs new (SkyResumeLens) at the covered
// segments; flat-shaded z-buffer of the real skycity mesh (skyJ set) + her (red 0.5×1.7 m box, face dot). Writes PPMs + frames.json.
const fs=require('fs');const ROOT=process.cwd();const {createHarness}=require(ROOT+'/tools/board-ui/harness.cjs');
const H=createHarness(),SP=H.load('region/SkyLakePreWalk.ts'),S=H.load('region/SkyWalkShot.ts'),TS=H.load('region/TransitionStaging.ts'),NW=H.load('region/NodeWalker.ts'),RN=H.load('region/RegionNodes.ts'),PF=H.load('region/SkyPreFollow.ts'),RS=H.load('region/SkyResumeLens.ts');
const RL=require(ROOT+'/tools/journey-integration/route/route-legs.cjs');const M=TS.TRANSITION_STAGING.skyMooring5a;
const OUT=process.argv[2]||'/tmp/skyab';fs.mkdirSync(OUT,{recursive:true});const W=195,Hh=422,asp=390/844;
const SHOTS={S0:[38,58.5,71.2],S3:[0.8,16.5,30.2]};
(async()=>{const sky=(await RL.skyLocal()).filter(o=>!/cloudsea|cumulus_far|cloud_small|Icosphere|_after|env_sky_dome/.test(o.name));
 const T=[];for(const o of sky){const t=o.tris;for(let i=0;i<t.length;i+=9){const a=S.skyLocalToWorld(M,[t[i],t[i+1],t[i+2]]),b=S.skyLocalToWorld(M,[t[i+3],t[i+4],t[i+5]]),c=S.skyLocalToWorld(M,[t[i+6],t[i+7],t[i+8]]);T.push([a,b,c,/ruins/.test(o.name)?[200,190,160]:/state_ring/.test(o.name)?[150,170,210]:[185,200,185]]);}}
 const frames=[];
 for(const K of Object.keys(SHOTS)){const P=SP.skyLakePreWalk(S.skyLocalToWorld(M,RN.REGION_NODES.skycity.nodes.find(n=>n.key===K).at),M).path,A=RS.arcOf(P);
  const c0=SP.skyPreFollowPose(P[0],[P[1][0]-P[0][0],0,P[1][2]-P[0][2]]),pl=RS.skyResumePlanFor(P,q=>RS.skyWorldToLocal(M,q)).plan;let so=null,sn=null,st=0;const dt=1/60,want=[...SHOTS[K]];
  for(let t=0;want.length&&t<200;t+=dt){st+=dt;const her=RS.arcAt(P,A,Math.min(A[A.length-1],t*NW.WALK_SPEED_MPS));
   const o=PF.skyPreFollowLens({her,path:P,dt,t:st,live:c0,prev:so});so=o.state;const n=RS.skyResumeLens(pl,her,st,c0,dt,sn);sn=n.state;
   if(t*NW.WALK_SPEED_MPS>=want[0]){const arc=want.shift();for(const [tag,cam] of [['old',o.pose],['new',n.pose]]){const f=`${K}_${arc}_${tag}`;render(cam,her,OUT+'/'+f+'.ppm');frames.push({f,K,arc,t:+t.toFixed(2),lens:cam.position.map(v=>+v.toFixed(2))});}}}}
 fs.writeFileSync(OUT+'/frames.json',JSON.stringify(frames,null,1));console.log(JSON.stringify(frames));
 function render(cam,her,file){const p=cam.position,f0=cam.target.map((v,i)=>v-p[i]),fn=Math.hypot(...f0),fw=f0.map(v=>v/fn),r0=[fw[2],0,-fw[0]],rn=Math.hypot(r0[0],r0[2]),r=[r0[0]/rn,0,r0[2]/rn],up=[fw[1]*r[2]-fw[2]*r[1],fw[2]*r[0]-fw[0]*r[2],fw[0]*r[1]-fw[1]*r[0]],th=Math.tan(cam.fovVerticalDeg*Math.PI/360);
  const z=new Float32Array(W*Hh).fill(1e9),img=Buffer.alloc(W*Hh*3);for(let i=0;i<W*Hh;i++){img[i*3]=150;img[i*3+1]=195;img[i*3+2]=235;}
  const pr=q=>{const d=[q[0]-p[0],q[1]-p[1],q[2]-p[2]],zz=d[0]*fw[0]+d[1]*fw[1]+d[2]*fw[2];return [-(d[0]*r[0]+d[2]*r[2])/(zz*th*asp),(d[0]*up[0]+d[1]*up[1]+d[2]*up[2])/(zz*th),zz];};
  const tri=(a,b,c,col)=>{const A=pr(a),B=pr(b),C=pr(c);if(A[2]<0.05||B[2]<0.05||C[2]<0.05)return;const n=[(b[1]-a[1])*(c[2]-a[2])-(b[2]-a[2])*(c[1]-a[1]),(b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2]),(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])],nl=Math.hypot(...n)||1,sh=0.55+0.45*Math.abs((n[0]*0.4+n[1]*0.8+n[2]*0.3)/nl/Math.hypot(.4,.8,.3));
   const X=[A,B,C].map(v=>(v[0]+1)/2*W),Y=[A,B,C].map(v=>(1-v[1])/2*Hh),x0=Math.max(0,Math.floor(Math.min(...X))),x1=Math.min(W-1,Math.ceil(Math.max(...X))),y0=Math.max(0,Math.floor(Math.min(...Y))),y1=Math.min(Hh-1,Math.ceil(Math.max(...Y)));if(x1-x0>4*W)return;
   const den=(Y[1]-Y[2])*(X[0]-X[2])+(X[2]-X[1])*(Y[0]-Y[2]);if(Math.abs(den)<1e-9)return;
   for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const px=x+.5,py=y+.5,l0=((Y[1]-Y[2])*(px-X[2])+(X[2]-X[1])*(py-Y[2]))/den,l1=((Y[2]-Y[0])*(px-X[2])+(X[0]-X[2])*(py-Y[2]))/den,l2=1-l0-l1;if(l0<0||l1<0||l2<0)continue;const zz=l0*A[2]+l1*B[2]+l2*C[2];const k=y*W+x;if(zz<z[k]){z[k]=zz;img[k*3]=col[0]*sh;img[k*3+1]=col[1]*sh;img[k*3+2]=col[2]*sh;}}};
  for(const t of T)tri(t[0],t[1],t[2],t[3]);
  const hb=(x0,y0,z0,x1,y1,z1,col)=>{const v=[[x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0],[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]];for(const [a,b,c,d] of [[0,1,2,3],[4,5,6,7],[0,1,5,4],[3,2,6,7],[0,3,7,4],[1,2,6,5]]){tri(v[a],v[b],v[c],col);tri(v[a],v[c],v[d],col);}};
  hb(her[0]-.25,her[1],her[2]-.25,her[0]+.25,her[1]+1.7,her[2]+.25,[230,40,40]);hb(her[0]-.12,her[1]+1.38,her[2]-.12,her[0]+.12,her[1]+1.62,her[2]+.12,[255,220,60]);
  fs.writeFileSync(file,Buffer.concat([Buffer.from(`P6 ${W} ${Hh} 255\n`),img]));}
})();
