'use strict';
// v2.1 changed frames only (walk 0…cut, basket-corner window 10.6–11.0 s) for render_shots.py. Usage: node keyframes_v21.cjs out.json repoRoot [w h]
const A=require('./audit.cjs'),Jn=require('../journey-integration/journey-scene.cjs'),fs=require('fs');
const w=+(process.argv[4]||390),h=+(process.argv[5]||844),land=A.landingFor([390,844]),from=A.startCamera(0),N=A.newShot(land),R=N.R;
const scene={lakeYawDeg:A.LJ.yawDeg,lakeRoot:A.LJ.root,skyYawDeg:Jn.yaw,skyOff:Jn.sOff,repo:process.argv[3]};
const T=[0,1,2,2.6,3.5,5,6.9,+(R.walkS-.3).toFixed(2),10.65,10.8,10.95];N.camera(0,from);
const shots=T.map(t=>{const c=N.camera(t,from);return {name:`v21_t${t.toFixed(2)}`,res:[w,h],cam:{position:c.position,target:c.target,fov:c.fovVerticalDeg||48},vehicle:N.vehicle(t),girl:{pos:N.girl(t),yawRad:R.girlYaw(t)}};});
fs.writeFileSync(process.argv[2],JSON.stringify({scene,shots},null,1));console.log(shots.length,'shots',JSON.stringify(T));
