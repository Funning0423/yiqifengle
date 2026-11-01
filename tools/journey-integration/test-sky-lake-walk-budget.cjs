'use strict';
// full9b: skycity→lakeside walk to the basket (S6 → door) — path length + speed + the from-S6 budget.
// Mac dc86ade2 run B (camTrace off, ≥15 fps): walk 15.04 s, door 2.07, stepIn 1.96, sit→flight 3.14, flight→touchdown 12.99 = 35.21 s.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=process.env.QF_JOURNEY_SOURCE_ROOT||path.resolve(__dirname,'../..'),S=root+'/creator-build-project/assets/scripts/';
const H=require('../board-ui/harness.cjs').createHarness();
const TS=H.load(S+'region/TransitionStaging.ts'),NW=H.load(S+'region/NodeWalker.ts');
const M5=TS.TRANSITION_STAGING.skyMooring5a,D5=TS.TRANSITION_DURATIONS.seg5a,RT=TS.TRANSITION_RETIME;
const res=[];const t=(id,f)=>{try{res.push({id,status:'PASS',...(f()||{})});}catch(e){res.push({id,status:'FAIL',error:String(e.message).slice(0,240)});}};
const W=M5.walkWorld;let L=0;for(let i=1;i<W.length;i++)L+=Math.hypot(W[i][0]-W[i-1][0],W[i][1]-W[i-1][1],W[i][2]-W[i-1][2]);
const straight=Math.hypot(W[W.length-1][0]-W[0][0],W[W.length-1][2]-W[0][2]);
t('path length = data, no detour',()=>{assert.ok(Math.abs(L-M5.walkPathM)<0.02,`walkWorld ${L.toFixed(3)} vs walkPathM ${M5.walkPathM}`);assert.ok(L/straight<=1.15,`detour ratio ${(L/straight).toFixed(3)}`);return {pathM:+L.toFixed(2),straightM:+straight.toFixed(2),ratio:+(L/straight).toFixed(3)};});
t('walk speed 1.2 m/s, basket steps 0.9 m/s (never faster)',()=>{assert.equal(NW.WALK_SPEED_MPS,1.2);assert.equal(M5.walkMps,1.2);assert.equal(TS.TRANSITION_STAGING.walkMps,0.9);
 const rja=fs.readFileSync(S+'region/RegionJourneyAdapter.ts','utf8');assert.ok(/duration:Math\.max\(\.5,L\/TRANSITION_STAGING\.walkMps\)/.test(rja),'basket step-in walk uses TRANSITION_STAGING.walkMps');
 assert.ok(/actor\.perform\(\{kind:'walk',path:R\.walk,duration:R\.walkS/.test(rja),'S6→door walk = R.walk / R.walkS');return {walkS:TS.lakeWalkS()};});
t('design from S6 (game time) ≤ 50 s; LEG_TIME designS is that value',()=>{const stepInS=M5.boardS+D5.turn180+D5.sitDown,design=TS.lakeWalkS()+D5.doorReach+stepInS+RT.lakeLiftS+RT.lakeFlightS;
 assert.ok(design<=50);const rja=fs.readFileSync(S+'region/RegionJourneyAdapter.ts','utf8');assert.ok(/designS:\+\(sl\?sl\.touchdownAt:R\.T\)/.test(rja),'designS must be sl.touchdownAt (not the ride clock R.T)');
 const mac=35.21;assert.ok(mac<=design+3,`Mac B ${mac} vs design ${design}`);return {designS:+design.toFixed(2),macB:mac,overS:+(mac-design).toFixed(2)};});
const status=res.every(r=>r.status==='PASS')?'PASS':'FAIL';console.log(JSON.stringify({test:'sky-lake-walk-budget',status,results:res},null,1));process.exit(status==='PASS'?0:1);
