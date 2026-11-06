'use strict';
// skycity-lakeside test hook: __qfTeleport is registered at RegionNodeStage.attach only when the gate is already open.
// DevTools `cli open` ignores 启动参数, so attach happens first and __qfPreTransition('enable') used to only flip
// __qfHooksEnable — L1 then returns no-teleport-hook (S6). A script launchQuery of ?qfPre=skycity-lakeside also never
// reached preTransitionKey when location.search was already ?contextName=game&id=2, so the auto setup never left home
// and waitState skycity sat there for 300s (L2, shots=0). These cases must fail fast when the hook is missing, and
// reach state skycity when the hook is armed in either startup order. The natural lakeside route (resumeSkyAtS6) is
// not this path. Timeouts are the existing ones: a missing hook returns immediately, it does not wait 300s.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createHarness}=require('../board-ui/harness.cjs');
const {stateNames}=require('../wx-autoplay/qf-autoplay.js');
const ROOT=path.resolve(__dirname,'../..');
const src=p=>fs.readFileSync(path.join(ROOT,'creator-build-project/assets/scripts',p),'utf8');
const H=createHarness({debug:false,overrides:{'region/LakesideBoardBackground':{prewarmLakesideAssets(){return Promise.resolve();}}}});
H.cc.director.getScheduler=()=>({setTimeScale(){}});
const K=H.load('world-r2/PreTransitionKeys'),Q=H.load('world-r2/QaSkip'),RUN=H.load('world-r2/PreTransitionRun');

function devHost(extra){
 return {location:{search:'?contextName=game&id=2'},wx:{getAccountInfoSync:()=>({miniProgram:{envVersion:'develop'}}),getLaunchOptionsSync:()=>({query:{}}),getEnterOptionsSync:()=>({query:{}})},...extra};
}
function world(){
 let state='home';const legs=[];
 const wc={snapshot:()=>({state,needsResume:false,journey:{region:state==='home'?'island':state,phase:'arrived'}}),
  leaveHome(){state='island';return {ok:true};},returnHome(){state='home';return {ok:true};},exitLevel(){return {ok:true};},exitSkycity(){state='island';return {ok:true};},
  travelRegion(t){legs.push(t);state=t;return {ok:true};},hitLighthouse(){return false;}};
 const composition={worldCommands:()=>wc,preTransitionProfile:()=>({ok:true,stageId:'mainline-12',seed:1,lastAction:['swap',0,1]}),warmMeadowIfIsland(){},enterMainline(){return {ok:true};},enterMainlineStage(){return {ok:true};},testProfile:{}};
 return {legs,composition,get state(){return state;},reset(){state='home';legs.length=0;}};
}
function deps(w){
 return {composition:w.composition,board:()=>null,control:()=>null,call:async fn=>fn(),idle:()=>true,islandJourney:()=>null,glassSign:()=>null,roomExplore:()=>null,
  frame:()=>({width:390,height:844}),signRect:()=>null,leave(){},enterMainline(){},returnHome(){},nextFrame:async()=>{}};
}
function wipe(){for(const k of ['__qfPreTransition','__qfHooksEnable','__qfTeleport','__qfBindTeleportHooks','__qfOpenExplore','__qfAimAt','__qfQuery'])delete globalThis[k];}

(async()=>{
 const saved={location:globalThis.location,wx:globalThis.wx};
 const w=world();
 try{
  // DevTools location hides a harness ?qfPre= unless __qfQuery carries it. Without it the auto setup never starts (stuck at home).
  const hidden=devHost();
  assert.equal(K.preTransitionKey(null,hidden),null,'contextName search alone is not a pre key');
  assert.equal(Q.qaHooksEnabled(null,hidden),false);
  assert.deepEqual(stateNames({state:'home'}),['home'],'waitState skycity does not match home');
  assert.equal(stateNames({state:'home'}).indexOf('skycity'),-1);
  const seen=devHost({__qfQuery:'?qfPre=skycity-lakeside'});
  assert.equal(K.preTransitionKey(null,seen),'skycity-lakeside','__qfQuery wins over the DevTools search');
  assert.equal(Q.qaHooksEnabled(null,seen),true,'a real qfPre key opens the teleport gate');
  assert.equal(Q.qaHooksEnabled('?qfPre=nope',{}),false,'unknown qfPre does not open hooks');
  assert.equal(Q.qaHooksEnabled('?qfPre=skycity-lakeside',{wx:{getAccountInfoSync:()=>({miniProgram:{envVersion:'release'}})}}),false,'release stays closed');
  assert.equal(Q.qaQuery({location:{search:'?qfPre=home-island'},wx:{getLaunchOptionsSync:()=>({query:{qfPre:'island-board'}})},__qfQuery:'?qfPre=skycity-lakeside'}).match(/qfPre=([a-z-]+)/)[1],'skycity-lakeside','harness query wins');
  assert.match(src('region/TransitionShaderWarm.ts'),/export let TRANSITION_SHADER_WARM_ENABLED=false/,'TSW default stays OFF');
  assert.match(src('world-r2/WorldNativeComposition.ts'),/if\(next==='skycity'\)await this\.resumeSkyAtS6\(\)/,'natural skycity arrival still walks to S6');
  assert.doesNotMatch(src('world-r2/PreTransitionRun.ts'),/resumeSkyAtS6/,'preTransition does not take over that walk');

  globalThis.location={search:'?qfHooks=1'};
  delete globalThis.wx;
  wipe();
  assert.equal(RUN.installPreTransition(deps(w)),true);
  const pre=globalThis.__qfPreTransition;

  // L1 negative: hook never registered. Must return no-teleport-hook without burning the 300s script budget.
  w.reset();
  let t0=Date.now();
  let r=await pre('skycity-lakeside');
  assert.equal(r.ok,false);assert.equal(r.reason,'no-teleport-hook (S6)');
  assert.ok(Date.now()-t0<5000,'missing hook returns immediately (not the 300s waitState)');
  assert.deepEqual(w.legs,['meadow','skycity'],'setup still uses the real travel commands');
  assert.equal(w.state,'skycity');

  // startup timing negative: binder exists but the hook appears only after the check has already returned
  w.reset();wipe();assert.equal(RUN.installPreTransition(deps(w)),true);
  globalThis.__qfBindTeleportHooks=()=>{setTimeout(()=>{globalThis.__qfTeleport=()=>({ok:true});},0);return false;};
  t0=Date.now();
  r=await globalThis.__qfPreTransition('skycity-lakeside');
  assert.equal(r.reason,'no-teleport-hook (S6)','hook that arrives after the check does not pass');
  assert.ok(Date.now()-t0<5000,'late hook is not waited out to the script timeout');
  await new Promise(done=>setTimeout(done,20));
  assert.equal(typeof globalThis.__qfTeleport,'function','the late assignment really was after the check');

  // enable AFTER attach: binder was installed while the gate was closed; enable() must bind before the key
  w.reset();wipe();assert.equal(RUN.installPreTransition(deps(w)),true);
  const stood=[];
  globalThis.__qfBindTeleportHooks=()=>{if(globalThis.__qfHooksEnable!==true)return false;globalThis.__qfTeleport=k=>{stood.push(k);return {ok:true,region:'skycity'};};return true;};
  assert.equal(globalThis.__qfBindTeleportHooks(),false,'attach-time bind while the gate is closed');
  assert.equal(typeof globalThis.__qfTeleport,'undefined');
  const en=await globalThis.__qfPreTransition('enable');
  assert.equal(en.ok,true);assert.equal(en.teleport,true);
  r=await globalThis.__qfPreTransition('skycity-lakeside');
  assert.equal(r.ok,true,JSON.stringify(r));assert.equal(r.state,'skycity');
  assert.deepEqual(stood,['S6']);
  assert.ok(stateNames({state:r.state}).indexOf('skycity')>=0,'waitState skycity matches the setup snapshot');

  // attach AFTER enable: the flag is already on, so the stage's own bind (same predicate) registers the hook
  w.reset();wipe();assert.equal(RUN.installPreTransition(deps(w)),true);
  const stood2=[];
  assert.equal((await globalThis.__qfPreTransition('enable')).teleport,false,'no stage yet');
  globalThis.__qfBindTeleportHooks=()=>{if(globalThis.__qfHooksEnable!==true)return false;globalThis.__qfTeleport=k=>{stood2.push(k);return {ok:true};};return true;};
  assert.equal(globalThis.__qfBindTeleportHooks(),true);
  r=await globalThis.__qfPreTransition('skycity-lakeside');
  assert.equal(r.ok,true);assert.equal(r.state,'skycity');assert.deepEqual(stood2,['S6']);

  // explore not open yet: one test-only open, then the same teleport. A second explore-not-open still fails (no retry loop).
  w.reset();wipe();assert.equal(RUN.installPreTransition(deps(w)),true);
  let n=0;const opened=[];
  globalThis.__qfHooksEnable=true;
  globalThis.__qfBindTeleportHooks=()=>{globalThis.__qfTeleport=()=>{n++;return n===1?{ok:false,reason:'explore-not-open'}:{ok:true,at:['S6']};};globalThis.__qfOpenExplore=region=>{opened.push(region);return true;};return true;};
  r=await globalThis.__qfPreTransition('skycity-lakeside');
  assert.equal(r.ok,true);assert.deepEqual(opened,['skycity']);assert.equal(n,2);

  w.reset();wipe();assert.equal(RUN.installPreTransition(deps(w)),true);
  globalThis.__qfHooksEnable=true;
  globalThis.__qfBindTeleportHooks=()=>{globalThis.__qfTeleport=()=>({ok:false,reason:'explore-not-open'});return true;};
  r=await globalThis.__qfPreTransition('skycity-lakeside');
  assert.equal(r.reason,'teleport-S6: explore-not-open');

  console.log('PASS pre-transition teleport (missing-hook + late-hook negatives, enable/attach order, waitState skycity)');
 }finally{
  wipe();
  if(saved.location===undefined)delete globalThis.location;else globalThis.location=saved.location;
  if(saved.wx===undefined)delete globalThis.wx;else globalThis.wx=saved.wx;
 }
})().catch(e=>{console.error(e);process.exit(1);});
