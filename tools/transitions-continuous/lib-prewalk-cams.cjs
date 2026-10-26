'use strict';
// 运镜bot full8: the windmill→balloon segment as a camera leg, for the solid-colour and camera-collision gates.
// = B1 pre-walk follow (b1PreWalkLens, same simulation as test_meadow_prewalk_follow: her heading turns ≤360°/s toward each
// path edge, 60 fps) from sail M1 to the yard gate, then the balloon leg's own B1 (t = 0..B1S). Geometry for every frame = the
// balloon leg at t=0 (meadow + basket + windmill), so a lens inside the windmill / a grey clear frame shows up here.
const R=require('../journey-integration/route/route-legs.cjs'),J=R.J,{add,sub,rotY}=J;
const RN=J.H.load(J.S+'region/RegionNodes.ts'),B1=J.H.load(J.S+'region/BalloonB1Start.ts'),EC=J.H.load(J.S+'region/ExploreCameraCore.ts');
const W=p=>add(rotY(180,p),J.mOff);
const B1S=8;
function windmillBalloonLeg(geo,scr,fps=4){const [w,h]=scr,bl=R.balloonLeg(geo,scr),c0=bl.cam(0);
 const M1=RN.REGION_NODES.meadow.nodes.find(n=>n.key==='M1').at,pre=B1.b1PreWalk(M1);if(!pre)throw Error('no pre-walk from M1');
 const P=pre.path.map(W),segL=[];for(let i=1;i<P.length;i++)segL.push(Math.hypot(...sub(P[i],P[i-1])));
 const at=s=>{let d=s*1.2;for(let i=0;i<segL.length;i++){if(d<=segL[i]||i===segL.length-1){const k=Math.min(1,d/segL[i]);return {p:add(P[i],sub(P[i+1],P[i]).map(v=>v*k)),hd:Math.atan2(P[i+1][0]-P[i][0],P[i+1][2]-P[i][2])};}d-=segL[i];}};
 const T=pre.durationS,dt=1/60,a0=at(0),live=EC.followPose(a0.p,a0.hd,w,h,0),poses=[];let yaw=a0.hd,fol=null,k=0;
 for(let t=0;t<=T+1e-9;t+=dt,k++){const s=at(t),dy=((s.hd-yaw)*180/Math.PI+540)%360-180,mx=360*dt;yaw+=Math.max(-mx,Math.min(mx,dy))*Math.PI/180;
  const L=B1.b1PreWalkLens({her:s.p,yawRad:yaw,w,h,dt,t,durationS:T,live,c0,prev:fol});fol=L.state;if(k%Math.round(60/fps)===0)poses.push({t,pose:L.pose,her:s.p,phase:'prewalk'});}
 for(let t=0;t<=B1S+1e-9;t+=1/fps)poses.push({t:T+t,pose:bl.cam(t),phase:'B1'});
 return {id:'windmill-balloon',T:T+B1S,preS:T,poses,los:(_t,a,b)=>bl.los(0,a,b),scripted:true};}
module.exports={windmillBalloonLeg,B1S};
