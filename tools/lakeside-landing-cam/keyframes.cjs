'use strict';
// Old-vs-new keyframe shot list for render_shots.py (same τ on both rides; old T 22 s, new T 30 s). Usage: node keyframes.cjs out.json [w h]
const A=require('./audit.cjs'),Jn=require('../journey-integration/journey-scene.cjs'),fs=require('fs');
const w=+(process.argv[3]||585),h=+(process.argv[4]||1266),scr=[390,844],land=A.landingFor(scr),from=A.startCamera(0);
const scene={lakeYawDeg:A.LJ.yawDeg,lakeRoot:A.LJ.root,skyYawDeg:Jn.yaw,skyOff:Jn.sOff,repo:Jn.ROOT};
const O=A.oldShot(),N=A.newShot(land),shots=[];
const yawOf=(a,b)=>Math.atan2(b[0]-a[0],b[2]-a[2]);
const TAU=[0,.13,.3,.43,.6,.77,.9,1];
for(const [k,tau] of TAU.entries())for(const s of [O,N]){const T=s.timing.durationS,t=tau*T,c=s.camera(t,from),v=s.vehicle(t),g=s.girl(t);
 shots.push({name:`k${k}_${s.name}_t${t.toFixed(1)}`,res:[w,h],cam:{position:c.position,target:c.target,fov:c.fovVerticalDeg||48},vehicle:v,girl:{pos:s.name==='old'?g:[v[0],v[1]-.0,v[2]],yawRad:s.name==='old'?yawOf(A.S6,A.bank):N.F.girlYawRad}});}
// old: frame after the ride (controller re-applies the set-off camera; she stands on the bank) vs new: same frame = E
shots.push({name:'k8_old_after',res:[w,h],cam:{position:from.position,target:from.target,fov:48},vehicle:A.bank,girl:{pos:A.bank,yawRad:Math.PI}});
shots.push({name:'k8_new_after',res:[w,h],cam:{position:land.position,target:land.target,fov:land.fovVerticalDeg},vehicle:A.bank,girl:{pos:A.bank,yawRad:N.F.girlYawRad}});
fs.writeFileSync(process.argv[2],JSON.stringify({scene,shots},null,1));console.log(shots.length,'shots');
