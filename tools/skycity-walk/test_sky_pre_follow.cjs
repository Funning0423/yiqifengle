'use strict';
// 运镜bot cine/b19-s6-follow: off-S6 pre-walk follow lens (SkyPreFollow, wired in RegionJourneyAdapter preDraw) on GGbot's SkyLakePreWalk
// paths from S0/S3/S5, 7 screens. Gate: walk yaw ≤120 °/s, p99 ≤300 °/s², her face+chest in frame, hidden ≤0.5 s, lens never in a box.
// Baseline (QF_LENS=ggbot, e079dfcc eased pose): S0/S3 yaw 172 °/s.
const fs=require('fs'),path=require('path');const ROOT=process.cwd();const {createHarness}=require(ROOT+'/tools/board-ui/harness.cjs');
const H=createHarness(),SP=H.load('region/SkyLakePreWalk.ts'),S=H.load('region/SkyWalkShot.ts'),TS=H.load('region/TransitionStaging.ts'),LB=H.load('region/LakesideBalloon.ts'),HS=H.load('region/HerShot.ts'),NW=H.load('region/NodeWalker.ts'),RN=H.load('region/RegionNodes.ts');
const ALT=process.env.QF_LENS==='ggbot'?null:H.load('region/SkyPreFollow.ts');// default = the shipped SkyPreFollow lens; QF_LENS=ggbot replays the e079dfcc baseline (report)
const M=TS.TRANSITION_STAGING.skyMooring5a,occ=JSON.parse(fs.readFileSync(ROOT+'/tools/transitions-continuous/transition-occluders.json','utf8'));
const boxes=Object.values(occ.boxes).flatMap(v=>Array.isArray(v)?v:[v.open100]);
const SCREENS=[[390,844],[414,896],[360,780],[375,667],[320,568],[390,520],[768,1024]],FPS=60,dt=1/FPS;
const proj=(p,q,fov,asp)=>{const f=[p.target[0]-p.position[0],p.target[1]-p.position[1],p.target[2]-p.position[2]],n=Math.hypot(...f);f.forEach((v,i)=>f[i]=v/n);
 const r=[f[2],0,-f[0]],rn=Math.hypot(r[0],r[2]);r[0]/=rn;r[2]/=rn;const u=[f[1]*r[2]-f[2]*r[1],f[2]*r[0]-f[0]*r[2],f[0]*r[1]-f[1]*r[0]];
 const d=[q[0]-p.position[0],q[1]-p.position[1],q[2]-p.position[2]],z=d[0]*f[0]+d[1]*f[1]+d[2]*f[2];if(z<=0)return null;const th=Math.tan(fov*Math.PI/360);return [-(d[0]*r[0]+d[2]*r[2])/z/(th*asp),(d[0]*u[0]+d[1]*u[1]+d[2]*u[2])/z/th];};
const rows=[];let bad=0;
for(const K of (process.env.QF_FROM||'S0,S3,S5').split(',')){const start=S.skyLocalToWorld(M,RN.REGION_NODES.skycity.nodes.find(n=>n.key===K).at),pre=SP.skyLakePreWalk(start,M);const P=pre.path;
 const segL=[];for(let i=1;i<P.length;i++)segL.push(Math.hypot(P[i][0]-P[i-1][0],P[i][1]-P[i-1][1],P[i][2]-P[i-1][2]));
 const herAt=t=>{let d=t*NW.WALK_SPEED_MPS;for(let i=0;i<segL.length;i++){if(d<=segL[i]||i===segL.length-1){const k=Math.min(1,d/segL[i]);return P[i].map((v,c)=>v+(P[i+1][c]-v)*k);}d-=segL[i];}};
 for(const [w,h] of SCREENS){const asp=w/h,c0=SP.skyPreFollowPose(P[0],[P[1][0]-P[0][0],0,P[1][2]-P[0][2]]);let smooth=null,st=0,prevYaw=null,prevRate=null,yawMax=0,acc=[],herMin=9,occS=0,occMax=0,inBox=0,clr=9,step=0,prevP=null,state=null;
  for(let t=0;t<=pre.durationS+1e-9;t+=dt){st+=dt;const her=herAt(t);let cam;
   if(ALT){const r=ALT.skyPreFollowLens({her,path:P,dt,t:st,live:c0,prev:state,w,h});state=r.state;cam=r.pose;}
   else{let k=0,b=Infinity;for(let i=0;i+1<P.length;i++){const a=P[i],c=P[i+1],vx=c[0]-a[0],vz=c[2]-a[2],l2=vx*vx+vz*vz||1,u=Math.max(0,Math.min(1,((her[0]-a[0])*vx+(her[2]-a[2])*vz)/l2)),dx=a[0]+vx*u-her[0],dz=a[2]+vz*u-her[2],d=dx*dx+dz*dz;if(d<b){b=d;k=i;}}
    const dir=[P[k+1][0]-P[k][0],0,P[k+1][2]-P[k][2]],want=SP.skyPreFollowPose(her,dir),a=1-Math.pow(.5,dt/SP.SKY_PRE_FOLLOW.halfLifeS);smooth=smooth?LB.blendPose(smooth,want,a):want;
    cam=st<SP.SKY_PRE_FOLLOW.blendInS?LB.blendPose(c0,smooth,st/SP.SKY_PRE_FOLLOW.blendInS):smooth;}
   const yaw=Math.atan2(cam.target[0]-cam.position[0],cam.target[2]-cam.position[2])*180/Math.PI;
   if(prevYaw!==null){const r=(((yaw-prevYaw)+540)%360-180)/dt;yawMax=Math.max(yawMax,Math.abs(r));if(prevRate!==null)acc.push(Math.abs(r-prevRate)/dt);prevRate=r;}prevYaw=yaw;
   if(prevP)step=Math.max(step,Math.hypot(...cam.position.map((v,i)=>v-prevP[i])));prevP=cam.position;
   const face=[her[0],her[1]+1.5,her[2]],chest=[her[0],her[1]+1.2,her[2]];for(const q of [face,chest]){const v=proj(cam,q,cam.fovVerticalDeg,asp);herMin=Math.min(herMin,v?1-Math.max(Math.abs(v[0]),Math.abs(v[1])):-1);}
   const hid=boxes.some(b=>HS.segBox(cam.position,face,b)||HS.segBox(cam.position,chest,b));occS=hid?occS+dt:0;occMax=Math.max(occMax,occS);
   for(const b of boxes){if(HS.inBox(cam.position,b))inBox++;}}
  acc.sort((a,b)=>a-b);const row={from:K,scr:`${w}x${h}`,walkS:+pre.durationS.toFixed(2),m:+pre.lengthM.toFixed(1),yawMax:+yawMax.toFixed(1),accP99:Math.round(acc[Math.floor(acc.length*.99)]),stepM:+step.toFixed(3),herMargin:+herMin.toFixed(3),occMaxS:+occMax.toFixed(2),lensInBox:inBox};
  rows.push(row);if(!(row.yawMax<=120&&row.accP99<=300&&row.herMargin>0&&row.occMaxS<=.5&&!inBox))bad++;}}
const ad=fs.readFileSync(ROOT+'/creator-build-project/assets/scripts/region/RegionJourneyAdapter.ts','utf8');const wired=/const L=skyPreFollowLens\(\{her,path:P,dt,t:st,live:c0,prev:smooth\}\);smooth=L\.state;world\.setCamera\(L\.pose\);/.test(ad);
console.table(rows);const ok=ALT?bad===0&&wired:true;console.log(JSON.stringify({test:'sky-pre-follow',lens:ALT?'SkyPreFollow (运镜bot)':'GGbot e079dfcc preDraw (report)',rowsFailing:bad,wired,status:ok?'PASS':'FAIL'}));process.exit(ok?0:1);
