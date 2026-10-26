'use strict';
// 运镜bot full8: S6 resume follow recheck (679a937b, WorldNativeComposition.resumeSkyAtS6 draw: segment-heading skyPreFollowPose,
// exp-eased pose half-life SKY_PRE_FOLLOW.halfLifeS, min-blend from the live lens over blendInS) on SkyLakePreWalk paths from
// S0 (the b19 deck where the balloon lands her), S3, S5; 7 screens, 60 fps. Report: yaw rate / accel p99, her face+chest in frame,
// hidden time by transition boxes AND by the skycity architecture (route-legs skyJ = full skycity at the journey placement),
// lens clearance to skycity triangles (1.1 m ray test). Bars (same as test_sky_pre_follow): yaw ≤120 °/s, p99 ≤300 °/s²,
// margin >0, hidden ≤0.5 s, lens never in a box / within 1.1 m. Report-only (QF_S6_GATE=gate makes it hard).
const fs=require('fs');const ROOT=process.cwd();const {createHarness}=require(ROOT+'/tools/board-ui/harness.cjs');
const H=createHarness(),SP=H.load('region/SkyLakePreWalk.ts'),S=H.load('region/SkyWalkShot.ts'),TS=H.load('region/TransitionStaging.ts'),LB=H.load('region/LakesideBalloon.ts'),HS=H.load('region/HerShot.ts'),NW=H.load('region/NodeWalker.ts'),RN=H.load('region/RegionNodes.ts');
const ALT=process.env.QF_LENS==='alt'&&fs.existsSync(ROOT+'/creator-build-project/assets/scripts/region/SkyPreFollow.ts')?H.load('region/SkyPreFollow.ts'):null;/* QF_LENS=alt: candidate lens in a tree that has region/SkyPreFollow.ts (cine/b19-s6-follow dc08e8cf) */const RL=require(ROOT+'/tools/journey-integration/route/route-legs.cjs');
const M=TS.TRANSITION_STAGING.skyMooring5a,occ=JSON.parse(fs.readFileSync(ROOT+'/tools/transitions-continuous/transition-occluders.json','utf8'));
const boxes=Object.values(occ.boxes).flatMap(v=>Array.isArray(v)?v:[v.open100]);
const SCREENS=[[390,844],[414,896],[360,780],[375,667],[320,568],[390,520],[768,1024]],FPS=60,dt=1/FPS;
const proj=(p,q,fov,asp)=>{const f=[p.target[0]-p.position[0],p.target[1]-p.position[1],p.target[2]-p.position[2]],n=Math.hypot(...f);f.forEach((v,i)=>f[i]=v/n);
 const r=[f[2],0,-f[0]],rn=Math.hypot(r[0],r[2]);r[0]/=rn;r[2]/=rn;const u=[f[1]*r[2]-f[2]*r[1],f[2]*r[0]-f[0]*r[2],f[0]*r[1]-f[1]*r[0]];
 const d=[q[0]-p.position[0],q[1]-p.position[1],q[2]-p.position[2]],z=d[0]*f[0]+d[1]*f[1]+d[2]*f[2];if(z<=0)return null;const th=Math.tan(fov*Math.PI/360);return [-(d[0]*r[0]+d[2]*r[2])/z/(th*asp),(d[0]*u[0]+d[1]*u[1]+d[2]*u[2])/z/th];};
const D26=[];// lens clearance probe dirs; within03 = a surface within 0.35 m (= entering geometry)
for(const x of[-1,0,1])for(const y of[-1,0,1])for(const z of[-1,0,1])if(x||y||z){const L=Math.hypot(x,y,z);D26.push([x/L,y/L,z/L]);}
(async()=>{const geo=await RL.geometry(),sky=(a,b)=>RL.hit(geo.skyJ,a,b);const rows=[];let bad=0;
 for(const K of (process.env.QF_FROM||'S0,S3,S5').split(',')){const start=S.skyLocalToWorld(M,RN.REGION_NODES.skycity.nodes.find(n=>n.key===K).at),pre=SP.skyLakePreWalk(start,M);
  if(!pre){rows.push({from:K,scr:'all',walkS:0,note:'already at S6 (no walk)'});continue;}const P=pre.path;
  const segL=[];for(let i=1;i<P.length;i++)segL.push(Math.hypot(P[i][0]-P[i-1][0],P[i][1]-P[i-1][1],P[i][2]-P[i-1][2]));
  const herAt=t=>{let d=t*NW.WALK_SPEED_MPS;for(let i=0;i<segL.length;i++){if(d<=segL[i]||i===segL.length-1){const k=Math.min(1,d/segL[i]);return P[i].map((v,c)=>v+(P[i+1][c]-v)*k);}d-=segL[i];}};
  for(const [w,h] of SCREENS){const asp=w/h,c0=SP.skyPreFollowPose(P[0],[P[1][0]-P[0][0],0,P[1][2]-P[0][2]]);let smooth=null,state=null,st=0,prevYaw=null,prevRate=null,yawMax=0,acc=[],herMin=9,occS=0,occMax=0,skS=0,skMax=0,inBox=0,clrHits=0,pen=0,step=0,prevP=null,n=0;
   for(let t=0;t<=pre.durationS+1e-9;t+=dt){st+=dt;n++;const her=herAt(t);
    let k=0,b=Infinity;for(let i=0;i+1<P.length;i++){const a=P[i],c=P[i+1],vx=c[0]-a[0],vz=c[2]-a[2],l2=vx*vx+vz*vz||1,u=Math.max(0,Math.min(1,((her[0]-a[0])*vx+(her[2]-a[2])*vz)/l2)),dx=a[0]+vx*u-her[0],dz=a[2]+vz*u-her[2],d=dx*dx+dz*dz;if(d<b){b=d;k=i;}}
    let cam;if(ALT){const r=ALT.skyPreFollowLens({her,path:P,dt,t:st,live:c0,prev:state});state=r.state;cam=r.pose;}else{
    const want=SP.skyPreFollowPose(her,[P[k+1][0]-P[k][0],0,P[k+1][2]-P[k][2]]);smooth=smooth?LB.blendPose(smooth,want,1-Math.pow(.5,dt/SP.SKY_PRE_FOLLOW.halfLifeS)):want;
    cam=st<SP.SKY_PRE_FOLLOW.blendInS?LB.blendPose(c0,smooth,st/SP.SKY_PRE_FOLLOW.blendInS):smooth;}
    const yaw=Math.atan2(cam.target[0]-cam.position[0],cam.target[2]-cam.position[2])*180/Math.PI;
    if(prevYaw!==null){const r=(((yaw-prevYaw)+540)%360-180)/dt;yawMax=Math.max(yawMax,Math.abs(r));if(prevRate!==null)acc.push(Math.abs(r-prevRate)/dt);prevRate=r;}prevYaw=yaw;
    if(prevP)step=Math.max(step,Math.hypot(...cam.position.map((v,i)=>v-prevP[i])));prevP=cam.position;
    const face=[her[0],her[1]+1.5,her[2]],chest=[her[0],her[1]+1.2,her[2]];for(const q of [face,chest]){const v=proj(cam,q,cam.fovVerticalDeg,asp);herMin=Math.min(herMin,v?1-Math.max(Math.abs(v[0]),Math.abs(v[1])):-1);}
    const hid=boxes.some(b=>HS.segBox(cam.position,face,b)||HS.segBox(cam.position,chest,b));occS=hid?occS+dt:0;occMax=Math.max(occMax,occS);
    if(n%3===0){const hs=sky(cam.position,face)&&sky(cam.position,chest);if(process.env.DBG&&w===390&&n%30===0){const c=D26.map(d=>sky(cam.position,cam.position.map((v,i)=>v+d[i]*1.15))).find(Boolean);if(hs||c)console.log("DBG",K,t.toFixed(1),"hid",hs&&sky(cam.position,face),"clr",c);}skS=hs?skS+3*dt:0;skMax=Math.max(skMax,skS);if(D26.some(d=>sky(cam.position,cam.position.map((v,i)=>v+d[i]*1.15))))clrHits++;if(D26.some(d=>sky(cam.position,cam.position.map((v,i)=>v+d[i]*0.35))))pen++;}
    for(const b of boxes){if(HS.inBox(cam.position,b))inBox++;}}
   acc.sort((a,b)=>a-b);const row={from:K,scr:`${w}x${h}`,walkS:+pre.durationS.toFixed(2),m:+pre.lengthM.toFixed(1),yawMax:+yawMax.toFixed(1),accP99:Math.round(acc[Math.floor(acc.length*.99)]),stepM:+step.toFixed(3),herMargin:+herMin.toFixed(3),boxHidS:+occMax.toFixed(2),skyHidS:+skMax.toFixed(2),lensInBox:inBox,clr11Hits:clrHits,within03:pen,samples:Math.floor(n/3)};
   rows.push(row);if(!(row.yawMax<=120&&row.accP99<=300&&row.herMargin>0&&row.boxHidS<=.5&&row.skyHidS<=.5&&!inBox&&!clrHits))bad++;}}
 console.table(rows);const G=process.env.QF_S6_GATE==='gate';console.log(JSON.stringify({test:'sky-resume-follow',lens:ALT?'SkyPreFollow.skyPreFollowLens':'679a937b resumeSkyAtS6 draw',mode:G?'gate':'report-only',rowsFailing:bad,status:bad?(G?'FAIL':'BELOW (report-only)'):'PASS'}));process.exit(G&&bad?1:0);})().catch(e=>{console.error(e);process.exit(1);});
