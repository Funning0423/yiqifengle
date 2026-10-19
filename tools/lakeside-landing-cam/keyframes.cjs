'use strict';
// Old-vs-new keyframes + parked-balloon options A/B for render_shots.py. Usage: node keyframes.cjs out.json [w h] [--knobs JSON]
const A=require('./audit.cjs'),Jn=require('../journey-integration/journey-scene.cjs'),fs=require('fs');
const w=+(process.argv[3]||585),h=+(process.argv[4]||1266),scr=[390,844],land=A.landingFor(scr),from=A.startCamera(0);
const scene={lakeYawDeg:A.LJ.yawDeg,lakeRoot:A.LJ.root,skyYawDeg:Jn.yaw,skyOff:Jn.sOff,repo:Jn.ROOT};
const O=A.oldShot(),N=A.newShot(land),R=N.R,shots=[];
const yawOf=(a,b)=>Math.atan2(b[0]-a[0],b[2]-a[2]);
const TN=[0,4,R.walkS-.3,R.cutT+.9,R.cutT+5,R.cutT+10,R.cutT+15,R.cutT+20,R.T];
for(const [k,tn] of TN.entries()){const tau=tn/R.T;
 {const t=tau*O.timing.durationS,c=O.camera(t,from),v=O.vehicle(t);shots.push({name:`k${k}_old_t${t.toFixed(1)}`,res:[w,h],cam:{position:c.position,target:c.target,fov:c.fovVerticalDeg||48},vehicle:v,girl:{pos:A.S6,yawRad:yawOf(A.S6,A.bank)}});}
 {const t=tn,c=N.camera(t,from),v=N.vehicle(t),g=N.girl(t);shots.push({name:`k${k}_new_t${t.toFixed(1)}`,res:[w,h],cam:{position:c.position,target:c.target,fov:c.fovVerticalDeg||48},vehicle:v,girl:{pos:g,yawRad:R.girlYaw(t)}});}}
shots.push({name:'k9_old_after',res:[w,h],cam:{position:from.position,target:from.target,fov:48},vehicle:A.bank,girl:{pos:A.bank,yawRad:Math.PI}});
// parked balloon options in the 390×844 board view (E); she stands on the bank
const gy=R.flight.girlYawRad,girl={pos:A.bank,yawRad:gy},L=p=>A.LJ.toWorld(p),bankL=A.toLocal(A.bank);
const tether=L([7,.55,23]);
shots.push({name:'optA_board',res:[w,h],cam:{position:land.position,target:land.target,fov:land.fovVerticalDeg},vehicle:tether,girl});
const turn=(pose,deg)=>{const a=deg*Math.PI/180,d=[pose.target[0]-pose.position[0],pose.target[1]-pose.position[1],pose.target[2]-pose.position[2]],c=Math.cos(a),s=Math.sin(a);return {position:pose.position,target:[pose.position[0]+d[0]*c+d[2]*s,pose.position[1]+d[1],pose.position[2]-d[0]*s+d[2]*c]};};
for(const deg of[35,-35]){const p=turn(land,deg);shots.push({name:`optA_turn${deg>0?'+':''}${deg}`,res:[w,h],cam:{position:p.position,target:p.target,fov:land.fovVerticalDeg},vehicle:tether,girl});}
for(const [i,[up,dz]] of [[2.5,0],[8,-2],[18,-6]].entries()){shots.push({name:`optB_float${i+1}`,res:[w,h],cam:{position:land.position,target:land.target,fov:land.fovVerticalDeg},vehicle:L([bankL[0]+.6,bankL[1]+up,bankL[2]+dz-1.5]),girl});}
shots.push({name:'optB_board_after',res:[w,h],cam:{position:land.position,target:land.target,fov:land.fovVerticalDeg},vehicle:L([0,-200,0]),girl});
fs.writeFileSync(process.argv[2],JSON.stringify({scene,shots},null,1));console.log(shots.length,'shots',JSON.stringify(TN.map(x=>+x.toFixed(2))));
