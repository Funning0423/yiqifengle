'use strict';
// 运镜bot full7-cam: meadow B1 pre-walk follow (BalloonTransit preDraw, GGbot a053220b; lens = BalloonB1Start.b1PreWalkLens) on the
// node walk M1→…→M6 (b1PreWalk path, 1.2 m/s, unchanged), 7 screens, for the current M6 and 场景设计部's moved M6 (e4ae91c1:
// local (0.2,6.493,−24.8)); M6 + the edges come from the baked node table (run in an e4ae91c1 tree for the moved M6). Her heading turns toward each
// segment at ≤ HER_TURN_DEGS (NodeWalker-like). Caps: walk yaw ≤120 °/s, p99 ≤300 °/s², lens step ≤0.6 m, face/chest hidden ≤0.5 s
// (meadow obstacle triangles), lens ≥1.1 m from them (scripted-shot clearance), ends exactly on the B1 first lens (no step).
const R=require('../journey-integration/route/route-legs.cjs'),J=R.J,{add,sub,rotY}=J;
const G=require('./lib-meadow-obst.cjs');
const SCREENS=[[390,844],[414,896],[360,780],[375,667],[320,568],[390,520],[768,1024]],HER_TURN_DEGS=360,FPS=60;
const RN=J.H.load(J.S+'region/RegionNodes.ts'),m6n=RN.REGION_NODES.meadow.nodes.find(n=>n.key==='M6');
const B1=J.H.load(J.S+'region/BalloonB1Start.ts'),EC=J.H.load(J.S+'region/ExploreCameraCore.ts'),TC=J.H.load(J.S+'region/TransitionCamera.ts');
const W=p=>add(rotY(180,p),J.mOff),Lc=p=>rotY(-180,sub(p,J.mOff));
const tris=[];for(const n of G.obs){const t=n.tris;for(let o=0;o<t.length;o+=9)tris.push(t.slice(o,o+9));}
function seg(a,b){const d=sub(b,a);for(const t of tris){const v0=[t[0],t[1],t[2]],e1=sub([t[3],t[4],t[5]],v0),e2=sub([t[6],t[7],t[8]],v0),p=[d[1]*e2[2]-d[2]*e2[1],d[2]*e2[0]-d[0]*e2[2],d[0]*e2[1]-d[1]*e2[0]],det=e1[0]*p[0]+e1[1]*p[1]+e1[2]*p[2];if(Math.abs(det)<1e-12)continue;const iv=1/det,s=sub(a,v0),u=(s[0]*p[0]+s[1]*p[1]+s[2]*p[2])*iv;if(u<0||u>1)continue;const q=[s[1]*e1[2]-s[2]*e1[1],s[2]*e1[0]-s[0]*e1[2],s[0]*e1[1]-s[1]*e1[0]],v=(d[0]*q[0]+d[1]*q[1]+d[2]*q[2])*iv;if(v<0||u+v>1)continue;const tt=(e2[0]*q[0]+e2[1]*q[1]+e2[2]*q[2])*iv;if(tt>1e-4&&tt<.995)return true;}return false;}
const dist=require('./lib-meadow-obst.cjs').pointTriDist;const near=p=>{let b=9;for(const t of tris){const xm=Math.min(t[0],t[3],t[6]),xM=Math.max(t[0],t[3],t[6]),zm=Math.min(t[2],t[5],t[8]),zM=Math.max(t[2],t[5],t[8]);if(xm>p[0]+b||xM<p[0]-b||zm>p[2]+b||zM<p[2]-b)continue;b=Math.min(b,dist(p,t));}return b;};// exact point-triangle distance
(async()=>{const geo=await R.geometry(),rows=[];let fail=0;
 const M1=RN.REGION_NODES.meadow.nodes.find(n=>n.key==='M1').at,pre=B1.b1PreWalk(M1);if(!pre)throw Error('no pre-walk from M1');
 const P=pre.path.map(W),segL=[];for(let i=1;i<P.length;i++)segL.push(Math.hypot(...sub(P[i],P[i-1])));
 const at=s=>{let d=s*1.2;for(let i=0;i<segL.length;i++){if(d<=segL[i]||i===segL.length-1){const k=Math.min(1,d/segL[i]);return {p:add(P[i],sub(P[i+1],P[i]).map(v=>v*k)),hd:Math.atan2(P[i+1][0]-P[i][0],P[i+1][2]-P[i][2])};}d-=segL[i];}};
 for(const scr of SCREENS){const [w,h]=scr,c0=R.balloonLeg(geo,scr).cam(0),a0=at(0),live=EC.followPose(a0.p,a0.hd,w,h,0);let yaw=a0.hd,fol=null;
  const T=pre.durationS,dt=1/FPS,cams=[],hid=[];let occ=0,occMax=0,clr=9,step=0;
  for(let t=0;t<=T+1e-9;t+=dt){const s=at(t),dy=((s.hd-yaw)*180/Math.PI+540)%360-180,mx=HER_TURN_DEGS*dt;yaw+=Math.max(-mx,Math.min(mx,dy))*Math.PI/180;
   const p=B1.b1PreWalkLens?B1.b1PreWalkLens({her:s.p,yawRad:yaw,w,h,dt,t,durationS:T,live,c0,prev:fol}):null;let cam;
   if(p){fol=p.state;cam=p.pose;}else{const want=EC.followPose(s.p,yaw,w,h);fol=fol?TC.blendPose(fol,want,1-Math.exp(-dt*3)):want;cam=fol;if(t<1)cam=TC.blendPose(live,cam,TC.minJerk(t/1));const left=T-t;if(left<1.5)cam=TC.blendPose(cam,c0,TC.minJerk(1-Math.max(0,left)/1.5));}
   if(cams.length)step=Math.max(step,Math.hypot(...sub(cam.position,cams.at(-1).position)));cams.push(cam);
   const lp=Lc(cam.position),f=Lc(add(s.p,[0,1.55,0])),c=Lc(add(s.p,[0,1.2,0]));const hd=seg(lp,f)||seg(lp,c);occ=hd?occ+dt:0;occMax=Math.max(occMax,occ);{const c=near(lp);if(c<clr)clr=c;if(process.env.DBG&&w===390&&h===844&&cams.length%15===0)console.log('T',t.toFixed(2),'clr',c.toFixed(2),'left',(T-t).toFixed(2));}}
  const ys=[],ac=[];for(let i=1;i<cams.length;i++){const y=q=>Math.atan2(q.target[0]-q.position[0],q.target[2]-q.position[2])*180/Math.PI;ys.push((((y(cams[i])-y(cams[i-1]))+540)%360-180)*FPS);}
  for(let i=1;i<ys.length;i++)ac.push(Math.abs(ys[i]-ys[i-1])*FPS);if(process.env.DBG&&w===390&&h===844){const big=ac.map((v,i)=>[v,i/FPS]).filter(x=>x[0]>300);console.log("DBG >300 frames",big.length,JSON.stringify(big.filter((x,i)=>i%10===0).map(x=>[Math.round(x[0]),+x[1].toFixed(2)])));}ac.sort((a,b)=>a-b);
  const end=cams.at(-1),endGap=Math.hypot(...sub(end.position,c0.position));
  const row={scr:scr.join('x'),walkS:+T.toFixed(2),yawMax:+Math.max(...ys.map(Math.abs)).toFixed(1),accP99:Math.round(ac[Math.floor(ac.length*.99)]),stepM:+step.toFixed(3),occMaxS:+occMax.toFixed(2),clrVertM:+clr.toFixed(2),endGapM:+endGap.toFixed(4)};rows.push(row);
  if(!(row.yawMax<=120&&row.accP99<=300&&row.stepM<=.6&&row.occMaxS<=.5&&row.endGapM<1e-3)){fail++;console.log('FAIL',JSON.stringify(row));}}
 const bt=require('fs').readFileSync(J.S+'region/BalloonTransit.ts','utf8');if(!/const L=b1PreWalkLens\(\{her:\[g\.x,g\.y,g\.z\]/.test(bt)){fail++;console.log('FAIL wiring: preDraw uses b1PreWalkLens');}
 console.table(rows);console.log(JSON.stringify({test:'meadow-prewalk-follow',M6:m6n.at,lens:B1.b1PreWalkLens?'BalloonB1Start.b1PreWalkLens':'BalloonTransit preDraw (inline)',from:pre.fromKey,m:+pre.lengthM.toFixed(2),status:fail?'FAIL':'PASS'}));process.exit(fail?1:0);})().catch(e=>{console.error(e);process.exit(1);});
