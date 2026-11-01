#!/usr/bin/env node
'use strict';
/* b16 P0 regression (运镜bot): balloon landing → board state progression on 风铃湖畔.
 * Bug (build16 e57b92ce): the exit-walk tail ended with an UNCONDITIONAL `ticker.step=()=>{}`. Since 89e31f78 the door→board
 * blend runs on pure game time (lakesideDoorBlendDurS ≈ 6.87 s) and is still running when the tail finishes (≈ 0.1 s later on
 * every screen), so the tail blanked the BLEND's step: its clock froze, ride() never resolved and RegionJourneyController stayed
 * in phase 'ready' (WorldFlow region-travel/ready) forever, day and night.
 * 1) real timings (LakesideBalloon/LakesideCameraLayout through the board-ui harness) on the 7 screens, day + night;
 * 2) source contract: the tail clears ticker.step only while it still owns it;
 * 3) the real RegionJourneyController driven frame by frame with a lease whose ride() reproduces the adapter's ticker hand-over
 *    (tail step → blend wraps it → tail end) at those timings: phase must reach 'arrived'; the old hand-over must stall (guard). */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'../..'),S=ROOT+'/creator-build-project/assets/scripts/';
const {createHarness}=require('../board-ui/harness.cjs'),H=createHarness();
const B=H.load(S+'region/LakesideBalloon.ts'),LC=H.load(S+'region/LakesideCameraLayout.ts'),C=H.load(S+'world-r1/RegionJourneyCore.ts'),BL=H.load(S+'ui/BoardLayout.ts'),WF=H.load(S+'world-r1/WorldFlowCore.ts');
const SCREENS=[[390,844],[375,667],[414,896],[360,780],[430,932],[390,520],[768,1024]],FPS=60;
const L=LC.lakesideJourney([2,.58,63.2]),M=B.lakesideBalloonMooring(L.arrival.at(-1),L.toWorld),SD=B.LAKESIDE_STEPDOWN,K=B.LAKESIDE_BALLOON_LANDING,DH=B.LAKESIDE_DOOR_HOLD;
function timings(w,h){
 const fr=LC.lakesideScreenFrame(w,h,BL.boardSafeInsets(w,h)),lan=LC.lakesideScreenLanding(L,fr,LC.LAKESIDE_CAMERA_LAYOUT.stopLocal);
 const E=C.arrivalPose([L.arrival.at(-1),L.toWorld([...LC.LAKESIDE_CAMERA_LAYOUT.stopLocal])],L.focus,lan),land={position:E.position,target:E.target,fovVerticalDeg:lan.arrivalFovDeg};
 const blendS=B.lakesideDoorBlendS(land,land)/* door lens unknown offline: the SPEC minimum (shortest blend = least overlap) */,entryM=B.lakesideBoardEntryM(M.walk,land,w/h,DH.outM),mean=M.length/M.walkS;
 const durS=B.lakesideDoorBlendDurS(blendS,DH.outM,entryM,mean),walkAt=M.walkStartAt+SD.durationS,rest=B.walkFrom(M.walk,SD.forwardEnd),restLen=C.routeLength(rest);
 const walkS=Math.max(.5,(restLen-.5)/K.exitWalkMps+1.4667),outT=Math.min(M.walkStartAt+DH.outM/mean+DH.capPadS,walkAt+Math.max(0,DH.outM-SD.forwardEnd)/K.exitWalkMps);
 return {durS,outT,tailEndT:walkAt+walkS,blendEndT:outT+durS};
}
// 2) source contract
const src=fs.readFileSync(S+'region/RegionJourneyAdapter.ts','utf8');
assert(!/[;{]ticker\.step=\(\)=>\{\};tailDone=true/.test(src),'tail end must not blank ticker.step unconditionally (it may belong to the door→board blend)');
assert(/if\(ticker\.step===tailStep\)ticker\.step=\(\)=>\{\};tailDone=true/.test(src),'tail end clears only its own step');
assert(/const tailStep=\(dt:number\)=>\{t\+=dt;/.test(src)&&/ticker\.step=tailStep;/.test(src),'tail step installed through a handle');
assert(/if\(!tailDone\)prevStep\(dt\);el\+=dt;/.test(src),'blend wraps the tail step and stops calling it once tailDone');
// 3) controller progression
function makeLease(T,fixed){
 const ticker={step:()=>{}};let t=0;
 const ride=async()=>{
  let outOk;const out=new Promise(r=>{outOk=r;});let tailDone=false;
  const tailStep=dt=>{t+=dt;if(t>=T.outT)outOk();};ticker.step=tailStep;
  const tail=(async()=>{await new Promise(r=>{const chk=()=>{if(t>=T.tailEndT)r();else setImmediate(chk);};chk();});
   if(fixed){if(ticker.step===tailStep)ticker.step=()=>{};}else ticker.step=()=>{}/* e57b92ce */;tailDone=true;outOk();})();
  tail.then(()=>outOk());await out;let el=0;
  await new Promise(ok=>{const prevStep=ticker.step;ticker.step=dt=>{if(!tailDone)prevStep(dt);else t+=dt;el+=dt;if(Math.min(1,el/T.durS)>=1){ticker.step=tailDone?()=>{}:prevStep;ok();}};});
 };
 const path=[[0,0,0],[0,0,5],[0,0,10]];
 return {ticker,lease:{route:{from:'skycity',to:'lakeside',path,bridgeStart:1,bridgeEnd:9,speed:1},show(){},progress(){},dispose(){},ride},clock:()=>t};
}
async function drive(T,fixed){
 const m=makeLease(T,fixed),J=new C.RegionJourneyController({prepare:async()=>m.lease,readCamera:()=>({position:[0,2,-4],target:[0,1,0]})}),tok=new WF.Cancellation();J.region='skycity'/* previous leg done (meadow→skycity) */;
 await J.prepare('lakeside',[0,0,0],tok);assert.equal(J.snapshot().phase,'ready');
 const actor={walkProgress:()=>1,cancelAndReset(){},perform:async()=>{}},world={setCamera(){}};
 let done=false;const run=J.walk(actor,world,tok).then(()=>{done=true;},e=>{done=true;if(process.env.DBG)console.error('walk rejected',e);});
 const limit=T.blendEndT+5;for(let f=0;f<limit*FPS&&!done;f++){m.ticker.step(1/FPS);await new Promise(r=>setImmediate(r));}
 const ph=done?J.snapshot().phase:'stuck in '+J.snapshot().phase;tok.cancel();await run.catch(()=>{});return {phase:ph,t:m.clock()};
}
(async()=>{const rows=[];
 for(const mode of ['day','night']){globalThis.__worldDayNight={snapshot:()=>({mode})};
  for(const [w,h] of SCREENS){const T=timings(w,h);
   assert([T.durS,T.outT,T.tailEndT].every(Number.isFinite),'finite timings '+w+'x'+h);
   const fixed=await drive(T,true);assert.equal(fixed.phase,'arrived',`${mode} ${w}x${h}: landing → board must leave 'ready' (got ${fixed.phase})`);
   const overlap=T.blendEndT>T.tailEndT;let old=null;if(overlap){old=await drive(T,false);assert.notEqual(old.phase,'arrived','guard: the e57b92ce hand-over stalls when the blend outlives the tail');}
   rows.push({mode,screen:w+'x'+h,outT:+T.outT.toFixed(3),tailEndT:+T.tailEndT.toFixed(3),blendEndT:+T.blendEndT.toFixed(3),overlapS:+(T.blendEndT-T.tailEndT).toFixed(3),fixed:fixed.phase,e57b92ce:old?old.phase:'n/a'});}}
 console.log(JSON.stringify(rows));console.log('lakeside-landing-board-progress: PASS ('+rows.length+' runs)');
})().catch(e=>{console.error(e);process.exit(1);});
