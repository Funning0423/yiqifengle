'use strict';
// b18 T-04: at the 11.4 s seam the camera re-bases by worldJump (−104.253° yaw). The sun (directional light) already follows
// (balloonLightYawOffset); the camera-centred sky domes (env_sky_dome / transit_night_dome) did not, so the sky + painted sun
// turned 104° (86° in 3D at 30° elevation) against the camera in one frame. Now domes yaw with the same offset.
// Check: camera-relative sun direction AND dome yaw change ≤ 3°/frame at 60 fps over the whole ride.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{createHarness}=require('../board-ui/harness.cjs');
const H=createHarness(),F=H.load('region/BalloonFlight.ts');
const src=fs.readFileSync(path.resolve(__dirname,'../../creator-build-project/assets/scripts/region/BalloonTransit.ts'),'utf8');
assert.ok(/const off=balloonLightYawOffset\(t\);\s*for\(const n of nightDome\?\[\.\.\.domes,nightDome\]:domes\)/.test(src),'applyLight yaws the sky domes with the sun');
assert.ok(/n\.setRotationFromEuler\(e\[0\],e\[1\]\+off,e\[2\]\)/.test(src),'dome yaw = base + offset');
assert.ok(/domeYaw0\.forEach\(\(e,n\)=>\{if\(isValid\(n,true\)\)try\{n\.setRotationFromEuler\(e\[0\],e\[1\],e\[2\]\)/.test(src),'release restores dome rotation');
const R=Math.PI/180,dir=(pitch,yaw)=>[Math.cos(pitch*R)*Math.sin(yaw*R),Math.sin(pitch*R),Math.cos(pitch*R)*Math.cos(yaw*R)];
const ang=(a,b)=>Math.acos(Math.max(-1,Math.min(1,a[0]*b[0]+a[1]*b[1]+a[2]*b[2])))/R;
const JUMP=-F.LIGHT_RAMP_YAW,dt=1/60,END=F.FLIGHT_DURATION+1;let prevL=null,prevD=null,maxL=0,maxD=0,worldMax=0,prevW=null;
for(let i=0;i*dt<=END;i++){const t=i*dt,cam=t+1e-9>=F.SEAM_T?JUMP:0,off=F.balloonLightYawOffset(t);
 const L=dir(-30,-30+off-cam),D=dir(0,off-cam),W=dir(-30,-30+off);
 if(prevL){maxL=Math.max(maxL,ang(L,prevL));maxD=Math.max(maxD,ang(D,prevD));worldMax=Math.max(worldMax,ang(W,prevW));}prevL=L;prevD=D;prevW=W;}
assert.ok(maxL<=3,'camera-relative sun '+maxL.toFixed(3)+'°/frame');
assert.ok(maxD<=3,'camera-relative sky dome '+maxD.toFixed(3)+'°/frame');
console.log(JSON.stringify({sunCamRelMaxDegPerFrame:+maxL.toFixed(3),domeCamRelMaxDegPerFrame:+maxD.toFixed(3),worldLightSeamJumpDeg:+worldMax.toFixed(1),note:'world jump cancels: camera/content re-base by the same yaw'}));
