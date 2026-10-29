'use strict';
// b19 night-balloon-sky: night landing turns the board light into the moon of transit_night_dome (BalloonFlight MOON_*).
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{createHarness}=require('../board-ui/harness.cjs');
const F=createHarness().load('region/BalloonFlight.ts');
const src=fs.readFileSync(path.resolve(__dirname,'../../creator-build-project/assets/scripts/region/BalloonTransit.ts'),'utf8');
assert.ok(/balloonLightEuler\(t,night,mainPitch0,mainYaw0\+balloonLightYawOffset\(t\)\)/.test(src),'applyLight goes through balloonLightEuler');
const wrap=a=>((a%360)+540)%360-180,v5I=(t,n)=>n?1+(F.NIGHT_CITY_ILLUM-1)*F.nightCityBlend(t):1,P0=-30,Y0=-30,dt=1/60;
// 1) moon bearing = brightest disc of the dome texture through the dome mesh UVs
const b=fs.readFileSync(path.resolve(__dirname,'../../creator-build-project/assets/bundles/region_transit_balloon/transit_night_dome.glb'));
const jl=b.readUInt32LE(12),j=JSON.parse(b.slice(20,20+jl)),bin=b.slice(20+jl+8);
const rd=(ai,n)=>{const a=j.accessors[ai],v=j.bufferViews[a.bufferView],o=(v.byteOffset||0)+(a.byteOffset||0);return i=>Array.from({length:n},(_,k)=>bin.readFloatLE(o+(i*n+k)*4));};
const p=j.meshes[0].primitives[0],Pos=rd(p.attributes.POSITION,3),Uv=rd(p.attributes.TEXCOORD_0,2),MU=0.1403,MV=0.3294;
let best=null;for(let i=0;i<j.accessors[p.attributes.POSITION].count;i++){const u=Uv(i),d=Math.hypot(u[0]-MU,u[1]-MV);if(!best||d<best[0])best=[d,i];}
const m=Pos(best[1]),r=Math.hypot(...m),md=m.map(x=>x/r),el=Math.asin(md[1])*180/Math.PI,az=Math.atan2(-md[0],-md[2])*180/Math.PI;
// light forward = -moonDir: pitch = -elevation, yaw = atan2(mx, mz)
assert.ok(Math.abs(-el-F.MOON_LIGHT_EULER[0])<3,'moon pitch '+(-el).toFixed(1));
assert.ok(Math.abs(wrap(Math.atan2(md[0],md[2])*180/Math.PI-F.MOON_LIGHT_EULER[1]))<4,'moon yaw '+(Math.atan2(md[0],md[2])*180/Math.PI).toFixed(1));
// 2) day and night outside the landing stay v5; arrival = board light exactly
let maxI=0,maxD=0;
for(const night of [false,true]){let pI=null,pE=null;
 for(let i=0;i*dt<=F.FLIGHT_DURATION+1;i++){const t=i*dt,I=F.balloonIllumFactor(t,night),E=F.balloonLightEuler(t,night,P0,Y0+F.balloonLightYawOffset(t));
  if(!night||t<F.MOON_LAND_T0){assert.equal(I,v5I(t,night),'v5 illuminance at '+t);assert.deepEqual(E,[P0,Y0+F.balloonLightYawOffset(t)],'v5 direction at '+t);}
  if(t>=F.FLIGHT_DURATION){assert.deepEqual(E,[P0,Y0],'arrival direction = board light');}
  if(night&&t>=F.MOON_LAND_T1&&t<=F.FLIGHT_DURATION+1)assert.ok(Math.abs(I-F.MOON_LAND_ILLUM)<1e-9,'moon illuminance held at '+t);
  if(pI!=null&&!(Math.abs(t-F.SEAM_T)<dt+1e-9)){maxI=Math.max(maxI,Math.abs(I-pI));maxD=Math.max(maxD,Math.abs(wrap(E[1]-pE[1])),Math.abs(E[0]-pE[0])-0);}
  pI=I;pE=E;}}
assert.ok(maxI<=0.03,'illuminance step '+maxI);
assert.equal(F.MOON_LAND_ILLUM,1,'landing moon = arrival light level (no jump at touchdown)');
console.log('PASS balloon-moon-landing '+JSON.stringify({moonPitch:+(-el).toFixed(2),moonYaw:+(Math.atan2(md[0],md[2])*180/Math.PI).toFixed(2),maxIllumStep:+maxI.toFixed(4),maxDirStepDeg:+maxD.toFixed(3)}));
