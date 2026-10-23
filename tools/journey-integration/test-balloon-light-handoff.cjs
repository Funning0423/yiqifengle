'use strict';
// b17r10 P1: meadow→skycity balloon light handoff must be a blend, day and night.
//  - light direction as the player sees it (content-relative, camera re-bases with content at the seam): ≤0.5°/frame @60fps
//  - world-space light direction: ≤0.5°/frame except the single seam re-base frame, where it must equal the content
//    re-base (−LIGHT_RAMP_YAW) so it is invisible (camera and content jump together)
//  - illuminance factor and night cloud colour: no one-frame cut at CITY_ON_T (≤3%/frame, ≤8/255 per channel/frame)
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{createHarness}=require('../board-ui/harness.cjs');
const H=createHarness(),F=H.load('region/BalloonFlight.ts');
const json=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../creator-build-project/assets/bundles/region_transit_balloon/balloon_flightpath.json'),'utf8'));
const src=fs.readFileSync(path.resolve(__dirname,'../../creator-build-project/assets/scripts/region/BalloonTransit.ts'),'utf8');
const pre=F.MW_JSON.yawDeg,post=F.postSeamFrame(json).yawDeg,wrap=a=>((a%360)+540)%360-180;
assert.ok(!/mainIllum0\*0\.22/.test(src),'no one-frame night illuminance cut');
assert.ok(/balloonIllumFactor\(t,night\)/.test(src),'illuminance follows balloonIllumFactor');
assert.ok(/tintCloudSea\(clouds,nightCloudColor\(t\)\)/.test(src),'night cloud sea colour follows nightCloudColor');
assert.ok(/nightCityBlend\(t\)/.test(src),'city night grade follows nightCityBlend');
const MAX_DIR=0.5,MAX_ILLUM=0.03,MAX_RGB=8,dt=1/60,END=F.FLIGHT_DURATION+1,out={};
for(const night of [false,true]){
 let pRel=null,pWorld=null,pI=null,pC=null,maxRel=0,maxWorld=0,seamFrames=0,maxI=0,maxC=0;
 for(let i=0;i*dt<=END+1e-9;i++){
  const t=i*dt,off=F.balloonLightYawOffset(t),rebase=t+1e-9>=F.SEAM_T?wrap(post-pre):0;
  const rel=wrap(off-rebase),world=off,I=F.balloonIllumFactor(t,night),C=night?F.nightCloudColor(t):[255,255,255];
  if(pRel!=null){
   maxRel=Math.max(maxRel,Math.abs(wrap(rel-pRel)));
   const ws=Math.abs(wrap(world-pWorld));
   if(ws>MAX_DIR){seamFrames++;assert.ok(Math.abs(t-F.SEAM_T)<dt+1e-9,'world light jump off the seam at '+t.toFixed(3)+' ('+ws.toFixed(2)+'°)');
    assert.ok(Math.abs(wrap(world-pWorld)-wrap(post-pre))<MAX_DIR,'world jump equals the content re-base');}
   else maxWorld=Math.max(maxWorld,ws);
   maxI=Math.max(maxI,Math.abs(I-pI));maxC=Math.max(maxC,...C.map((v,k)=>Math.abs(v-pC[k])));
  }
  pRel=rel;pWorld=world;pI=I;pC=C;
 }
 const mode=night?'night':'day';
 assert.ok(maxRel<=MAX_DIR,mode+' visible light step '+maxRel.toFixed(3)+'°/frame');
 assert.ok(seamFrames<=1,mode+' world re-base frames '+seamFrames);
 assert.ok(maxI<=MAX_ILLUM,mode+' illuminance step '+maxI.toFixed(4)+'/frame');
 assert.ok(maxC<=MAX_RGB,mode+' cloud colour step '+maxC+'/frame');
 out[mode]={maxVisibleDegPerFrame:+maxRel.toFixed(4),maxWorldDegPerFrameOffSeam:+maxWorld.toFixed(4),seamRebaseFrames:seamFrames,maxIllumStep:+maxI.toFixed(4),maxCloudRgbStep:maxC};
}
assert.equal(F.balloonIllumFactor(F.CITY_ON_T-0.01,true),1);
assert.ok(Math.abs(F.balloonIllumFactor(F.CITY_ON_T+F.NIGHT_BLEND_S,true)-F.NIGHT_CITY_ILLUM)<1e-9,'night ends at x0.22');
assert.deepEqual(F.nightCloudColor(F.CITY_ON_T+F.NIGHT_BLEND_S),[68,80,94]);
assert.equal(F.balloonIllumFactor(20,false),1,'day illuminance untouched');
console.log('PASS balloon-light-handoff '+JSON.stringify(out));
