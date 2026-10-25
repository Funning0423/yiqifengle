'use strict';
// b19 skycity face budget: every repo camera that looks at the sky city, in env_skycity LOCAL (Cocos, Y-up).
//   compare: the 4 comparison shots (T-02 final, L9-L12 board, balloon arrival, balloon departure) at 390x844.
//   vis:     visibility-analysis lenses (flight keys, sky->lake leg every 0.25 s on all screens, board on all screens, T-02 approach).
// Usage: node cams.cjs > cams.json
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'../../..');
const RL=require(ROOT+'/tools/journey-integration/route/route-legs.cjs'),{createHarness}=require(ROOT+'/tools/board-ui/harness.cjs'),H=createHarness();
const SL=H.load('region/SkyLakeContinuous.ts'),TC=H.load('region/TransitionCamera.ts'),VP=H.load('region/SkycityVisitPose.ts'),SF=H.load('region/SkyFinaleShot.ts'),BF=H.load('region/BalloonFlight.ts');
const CW=BF.CW_JSON,loc=p=>BF.unapplyRigid(CW,p).map(v=>+v.toFixed(4));
const L=P=>({position:loc(P.position),target:loc(P.target),fovVerticalDeg:P.fovVerticalDeg??48});
const flight=JSON.parse(fs.readFileSync(ROOT+'/creator-build-project/assets/bundles/region_transit_balloon/balloon_flightpath.json','utf8'));
const A=JSON.parse(fs.readFileSync('/workspace/b16night/poses.json','utf8')).A;  // anchor_* (local) exported from env_skycity.glb
(async()=>{
 const G=await RL.geometry(),out={compare:{},vis:[]};
 // board (L9-L12 all use boardPose 'default' = skycityVisitPose(anchor_spawn_girl, anchor_starcourt_center, aspect))
 for(const [w,h] of RL.SCREENS){const p=VP.skycityVisitPose(A.anchor_spawn_girl,A.anchor_starcourt_center,w/h);out.vis.push({...p,tag:'board'});if(w===390&&h===844)out.compare.board=p;}
 out.compare.t02_final={...SF.SKY_FINALE_POSE_LOCAL};out.vis.push({...SF.SKY_FINALE_POSE_LOCAL,tag:'t02'});
 // balloon arrival: flight keys in the world frame (landing at LAND_T)
 for(const k of flight.keys){if(k.frame!=='world')continue;out.vis.push({...L({position:k.cam,target:k.camLook,fovVerticalDeg:48}),tag:'flight'});}
 const land=flight.keys.filter(k=>k.frame==='world').reduce((a,k)=>Math.abs(k.t-BF.LAND_T)<Math.abs(a.t-BF.LAND_T)?k:a);
 out.compare.arrival={...L({position:land.cam,target:land.camLook,fovVerticalDeg:48}),t:land.t};
 // balloon departure: sky->lake leg (C1 walk -> board -> lift-off) until the city is left, every 0.25 s, all screens
 for(const s of RL.SCREENS){const leg=RL.lakeLeg(G,s),S=SL.skyLakeContinuous(leg.ride,leg.door,SL.SKY_LAKE_CONT);
  let got=null;const off=TC.onShotContinue(st=>{got=st;});TC.fireShotContinue({pose:leg.start.from});off();
  for(let tau=0;tau<S.flightAt+4;tau+=0.25){const p=S.cam(tau,got.pose);out.vis.push({...L(p),tag:'depart'});}
  if(s[0]===390&&s[1]===844){const tau=S.walkS+SL.SKY_LAKE_CONT.liftS*0.5;out.compare.departure={...L(S.cam(tau,got.pose)),tau:+tau.toFixed(2),note:'sky->lake leg mid lift-off'};}}
 process.stdout.write(JSON.stringify(out));
})().catch(e=>{console.error(e);process.exit(1);});
