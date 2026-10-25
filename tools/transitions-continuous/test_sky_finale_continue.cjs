#!/usr/bin/env node
'use strict';
/* skyfix (界面验收部 cand-stage5 P1): T-02 sky finale → continuous skycity→lakeside must actually start.
 * Real WorldNativeComposition (claimRegionAndWalk / continueFromSkyFinale / continueJourney / enterMainline / selectProvider /
 * ensureRegion), real SkyLakeRegister + TransitionChain + SkyFinaleDeparture, real mainline-12 checkpoint, through the board-ui
 * harness. Stubs: the world flow (state machine: the finale runs over the mainline-12 RESULT board = state 'level'), the stage
 * (mirrors RegionNodeStage arm/disarm/gesture lines, checked against the source below) and a fake clock.
 * Paths: (a) no input → auto-start 3.4 s after the claim; (b) drag before the walk cancels the auto-continue, 继续旅程 is shown
 * and starts it; (c) bounded fallback: continuous path null / throws → WindWipe ride, counted in __QF_TRANSITION_FALLBACK. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'../..'),S=ROOT+'/creator-build-project/assets/scripts/',src=f=>fs.readFileSync(S+f,'utf8');
const {createHarness}=require('../board-ui/harness.cjs');
// 继续旅程 visibility, verbatim rule from WorldIntegrationBoot.syncControls (asserted against the source)
const BOOT_RULE="k==='mainline'?(['island','meadow','lakeside'].includes(s.state)||s.state==='skycity'&&s.journey?.region==='skycity')";
const mainlineShown=s=>!s.needsResume&&(['island','meadow','lakeside'].includes(s.state)||s.state==='skycity'&&s.journey?.region==='skycity');
function rig(){
 const h=createHarness({debug:true}),C=h.load('world-r2/WorldNativeComposition').WorldNativeComposition;
 const SR=h.load('region/SkyLakeRegister'),TC=h.load('region/TransitionChain'),SD=h.load('region/SkyFinaleDeparture');
 const cp=h.load('world-r2/RegionFlowTest').createRegionFlowCheckpoint(12),ctl=cp.mainline.createController();
 assert(ctl.resume().ok);const pv=ctl.previewAction(cp.lastAction);assert(pv.ok);assert(ctl.commitAction(pv.token).ok);
 while(ctl.snapshot().visual)assert(ctl.finishVisualStep(ctl.snapshot().visual.token).ok);
 const c=new C(),ev=[];c.mainline=cp.mainline;c.persistence=cp.r5;
 // world: she cleared mainline-12 in sky city; the result board (state 'level', origin skycity) is still up under the finale
 const snap={state:'level',journey:{region:'skycity',target:null},needsResume:false};
 c.world={commands:()=>({snapshot:()=>snap,
  exitLevel(){if(snap.state!=='level')return {ok:false,reason:'not-in-level'};ev.push(['exitLevel']);snap.state=snap.journey.region;return {ok:true};},
  async travelRegion(to){ev.push(['travel',to,TC.continuousTransitions()?'continuous':'windwipe']);snap.state=to;snap.journey.region=to;return {ok:true};},
  async enterLevel(id){ev.push(['enter',id]);snap.state='level';return {ok:true};},
  abandonLakesideJourney(){ev.push(['island']);snap.state='island';snap.journey.region='island';return {ok:true};}})};
 c.mainlineReward=(cmd)=>{ev.push(['reward',cmd]);return {ok:true};};
 // stage double: same rules as RegionNodeStage.armFinaleContinue / disarmFinale / markFinaleDeparture / gesture (line ~960)
 let clock=0;const st={region:'skycity',exploring:true,finaleApproachS:1.4,arm:null,departAt:0,
  finaleEndCamera(){return this.region==='skycity'&&this.exploring?{position:[1,2,3],rotation:[0,0,0,1],fovVerticalDeg:48,velocity:[0,0,0],angularVelocityDegS:0,at:0}:null;},
  bindCharacter(){},async playFinale(){ev.push(['finale']);},holdFinaleView(){ev.push(['holdView']);return true;},
  armFinaleContinue(go){this.disarmFinale();this.departAt=0;if(this.region!=='skycity'||!this.exploring)return false;this.arm={at:clock,go};return true;},
  disarmFinale(){this.arm=null;},markFinaleDeparture(){this.disarmFinale();this.departAt=clock||1e-9;},
  gesture(g){if(this.arm&&(g==='drag'||g==='pinch'||g==='tap'))this.disarmFinale();},
  tick(dt){clock+=dt;const a=this.arm;if(a&&clock-a.at>=SD.finaleAutoContinueAtS(this.finaleApproachS)-1e-9){this.disarmFinale();a.go();}}};
 c.activeSession={snapshot:()=>({provider:'mainline-v33',active:{stageId:'mainline-12',level:12}})};c.stage=()=>st;c.boundCharacter={__qfWalkTail:undefined};delete c.boundCharacter.__qfWalkTail;
 const off=SR.registerSkyLakeContinuous(c);
 globalThis.__QF_TRANSITION_FALLBACK={count:0,events:[]};
 const flush=()=>new Promise(r=>setImmediate(r));
 const run=async(s)=>{for(let t=0;t<s-1e-9;t+=0.1){st.tick(0.1);await flush();}for(let i=0;i<20;i++)await flush();};
 return {c,ev,snap,st,run,off,TC,SD,clock:()=>clock};
}
const travels=ev=>ev.filter(e=>e[0]==='travel');
let n=0,fail=0;const T=async(m,f)=>{try{await f();n++;console.log('PASS',m);}catch(e){fail++;console.log('FAIL',m,'\n ',e&&e.message||e);}};
(async()=>{
 await T('source contracts: stage double mirrors RegionNodeStage; Boot 继续旅程 rule; button → continueJourney',async()=>{
  const stg=src('world-r2/RegionNodeStage.ts'),boot=src('WorldIntegrationBoot.ts');
  assert.match(stg,/armFinaleContinue\(go:\(\)=>void,now=Date\.now\(\)\)\{this\.disarmFinale\(\);this\.departAt=0;if\(this\.region!=='skycity'\|\|!this\.exploring\)return false;/);
  assert.match(stg,/finaleAutoContinueAtS\(this\.finaleApproachS\)\*1000/);
  assert.match(stg,/if\(this\.finaleArm&&\(gesture==='drag'\|\|gesture==='pinch'\|\|gesture==='tap'\)\)this\.disarmFinale\(\)/);
  assert.ok(boot.includes(BOOT_RULE),'Boot mainline visibility rule unchanged');
  assert.match(boot,/this\.button\('mainline','继续旅程  →',\(\)=>this\.composition\.continueJourney\(\)\)/);
  const {SD}=rig();assert.equal(SD.finaleAutoContinueAtS(1.4),3.4);});
 await T('(a) no input: auto-continue 3.4 s after the claim starts the sky→lake travel (continuous, no fallback)',async()=>{
  const R=rig();await R.c.claimRegionAndWalk(3);
  assert.ok(R.st.arm,'auto-continue armed after the claim');
  await R.run(3.3);assert.equal(travels(R.ev).length,0,'not before 3.4 s');
  await R.run(0.2);
  assert.deepEqual(travels(R.ev),[['travel','lakeside','continuous']],'travel started: '+JSON.stringify(R.ev));
  assert.ok(R.st.departAt>0,'departure marked (walk owns the camera, gestures swallowed)');
  assert.ok(globalThis.__QF_SKY_CONTINUE,'continuous handler took over');
  assert.equal(globalThis.__QF_TRANSITION_FALLBACK.count,0,'0 WindWipe fallbacks');
  assert.ok(R.ev.some(e=>e[0]==='enter'&&e[1]==='r04-lake-01'),'lake board L13 entered');});
 await T('(b) drag before the walk cancels auto-continue; 继续旅程 is shown and tapping it starts the travel',async()=>{
  const R=rig();await R.c.claimRegionAndWalk(3);
  await R.run(1.0);R.st.gesture('drag');await R.run(10);
  assert.equal(travels(R.ev).length,0,'cancelled: she keeps gazing');
  assert.ok(R.c.skyFinaleActive(),'still the held finale');
  assert.ok(mainlineShown(R.snap),'继续旅程 visible (state '+R.snap.state+')');
  await R.c.continueJourney();for(let i=0;i<20;i++)await new Promise(r=>setImmediate(r));
  assert.deepEqual(travels(R.ev),[['travel','lakeside','continuous']],'button started: '+JSON.stringify(R.ev));
  assert.equal(globalThis.__QF_TRANSITION_FALLBACK.count,0,'(b) 0 WindWipe fallbacks');});
 for(const [name,mk] of [['returns null',()=>()=>null],['throws',()=>()=>{throw Error('boom');}],['resolves null',()=>()=>Promise.resolve(null)],['enterMainline rejects',null]]){
  await T('(c) bounded fallback when the continuous path '+name+': she still leaves sky city via WindWipe, logged',async()=>{
   const R=rig();
   if(mk){R.off();R.c.onSkyFinaleContinue(mk());}
   else{const real=R.c.enterMainline.bind(R.c);let first=true;R.c.enterMainline=async()=>{if(first){first=false;throw Error('start failed');}return real();};}
   const warns=[],w0=console.warn;console.warn=(...a)=>{warns.push(a.join(' '));};
   try{await R.c.claimRegionAndWalk(3);await R.run(3.6);}finally{console.warn=w0;}
   assert.ok(warns.some(x=>x.includes('[QF_TRANSITION_FALLBACK]')&&x.includes('Acceptance requires 0')),'loud tagged warn');assert.ok(warns.some(x=>x.includes('[QF_TRANSITION] WindWipe fallback #1')),'counted warn');
   assert.deepEqual(travels(R.ev),[['travel','lakeside','windwipe']],JSON.stringify(R.ev));
   assert.equal(globalThis.__QF_TRANSITION_FALLBACK.count,1,'fallback logged once');
   assert.equal(globalThis.__QF_TRANSITION_FALLBACK.events[0].leg,'lakeside');
   assert.ok(R.TC.continuousTransitions(),'legacy override is one-shot');});
 }
 console.log(JSON.stringify({status:fail?'FAIL':'PASS',passed:n,failed:fail}));process.exit(fail?1:0);
})();
