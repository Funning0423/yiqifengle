process.chdir('/workspace/scratch-clip19');const fs=require('fs');
(async()=>{const m=await require('/workspace/scratch-clip19/tools/journey-integration/clip3/sky-lake-model.cjs')();const S=m.legs[0].S;
const RM=require('/workspace/scratch-clip19/tools/region-nodes/sky-rail-model.cjs'),{createHarness}=require('/workspace/scratch-clip19/tools/board-ui/harness.cjs'),H=createHarness(),SW=H.load('region/SkyWalkShot.ts'),M5=H.load('region/TransitionStaging.ts').TRANSITION_STAGING.skyMooring5a;
const out=[];let f=1,t=300;const ang=(p,q)=>{const d=[q[0]-p[0],q[1]-p[1],q[2]-p[2]],l=Math.hypot(...d);return [-Math.atan2(-d[0],-d[2])*180/Math.PI,Math.asin(d[1]/l)*180/Math.PI];};
const put=(p,tg,fov,w)=>{const [y,pi]=ang(p,tg);out.push(`x log [QF_CAM_TRACE] f=${f++} t=${(t+=1/60).toFixed(3)} pos=${p.map(v=>v.toFixed(3)).join(',')} yaw=${y.toFixed(3)} pitch=${pi.toFixed(3)} fov=${fov} w=${w} fr=${f}`);};
for(const s of RM.samples('S4>S6',[390,844]))put(SW.skyLocalToWorld(M5,s.p.position),SW.skyLocalToWorld(M5,s.p.target),48,'region.node-lens');
t=330;for(let tau=0;tau<=S.touchdownAt;tau+=1/60){const p=S.cam(tau,null);put(p.position,p.target,p.fovVerticalDeg||48,tau<S.walkS?'SkyWalkShot':'world.setCamera');}
fs.writeFileSync('/workspace/clip19/model-trace-after.log',out.join('\n'));console.log(out.length);})();
