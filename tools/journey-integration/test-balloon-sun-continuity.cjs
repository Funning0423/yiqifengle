'use strict';
// Balloon meadow→skycity sun: content-relative yaw must be continuous (no 104° pre-seam spin / snap-back),
// bounded angular speed, and end exactly on the skycity board light (offset 0) before the board cut.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{createHarness}=require('../board-ui/harness.cjs');
const H=createHarness(),F=H.load('region/BalloonFlight.ts');
const json=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../creator-build-project/assets/bundles/region_transit_balloon/balloon_flightpath.json'),'utf8'));
const pre=F.MW_JSON.yawDeg,post=F.postSeamFrame(json).yawDeg;
const wrap=a=>((a%360)+540)%360-180;
assert.ok(Math.abs(wrap(post-pre)+F.LIGHT_RAMP_YAW)<1e-3,'seam re-base is −LIGHT_RAMP_YAW: '+wrap(post-pre));
const src=fs.readFileSync(path.resolve(__dirname,'../../creator-build-project/assets/scripts/region/BalloonTransit.ts'),'utf8');
assert.ok(/mainYaw0\+balloonLightYawOffset\(t\)/.test(src),'applyLight uses balloonLightYawOffset');
assert.ok(!/LIGHT_RAMP_T0/.test(src),'old pre-seam ramp gone');
const MAX_DEG_PER_S=12,END=F.FLIGHT_DURATION+1,out={};
for(const mode of ['day','night']){
 const dt=mode==='day'?1/240:1/60;let prev=null,prevStep=0,maxStep=0,reversals=0,maxRate=0;
 for(let i=0;i*dt<=END+1e-9;i++){
  const t=i*dt,content=t+1e-9>=F.SEAM_T?post:pre;
  const rel=wrap(F.balloonLightYawOffset(t)-(content-pre)); // sun yaw as the player sees it
  if(prev!=null){const s=wrap(rel-prev);maxStep=Math.max(maxStep,Math.abs(s));maxRate=Math.max(maxRate,Math.abs(s)/dt);
   if(Math.abs(s)>1e-4&&Math.abs(prevStep)>1e-4&&Math.sign(s)!==Math.sign(prevStep))reversals++; if(Math.abs(s)>1e-4)prevStep=s;}
  prev=rel;
 }
 assert.ok(maxRate<=MAX_DEG_PER_S,mode+' angular speed '+maxRate.toFixed(2)+'°/s');
 assert.equal(reversals,0,mode+' sun direction reversed');
 assert.equal(F.balloonLightYawOffset(0),0);
 assert.equal(F.balloonLightYawOffset(F.LAND_T),0,'arrival light = board light');
 assert.equal(F.balloonLightYawOffset(END),0);
 assert.ok(Math.abs(F.balloonLightYawOffset(F.LAND_T-1e-4))<1e-6,'no snap at board cut');
 for(let k=1070;k<1139;k++){const t=k/100;assert.equal(F.balloonLightYawOffset(t),0,'no pre-seam spin at '+t);}
 out[mode]={maxStepDeg:+maxStep.toFixed(4),maxDegPerS:+maxRate.toFixed(3),reversals};
}
console.log(JSON.stringify(out));
