'use strict';
// full9c WindWipe (Mac dc86ade2, finstartB x2): `WindWipe fallback #1 {leg:skycity, reason:prepare-slow}` after 3.04 s.
// Cold flows (preTransition, ensureRegion island→skycity) never ran the mainline-08 warm, so the balloon prepare paid the whole
// region_skycity + transit-prefab load inside CHAIN_FALLBACK.waitS. Simulated timeline with budgeted costs: the staged warm
// armed for the sail ride must finish before the balloon prepare and leave < waitS of work. FAILS on 9ec5323c, PASSES after.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const H=require('../board-ui/harness.cjs').createHarness();
const S=path.join(__dirname,'../../creator-build-project/assets/scripts/');
const TC=H.load('region/TransitionChain.ts');
const src=f=>fs.readFileSync(path.join(S,f),'utf8');
assert.equal(typeof TC.simulateSkyPrepare,'function','no skycity-leg warm timeline (pre-fix: prepare-slow fallback)');
const cold=TC.simulateSkyPrepare(false),warm=TC.simulateSkyPrepare(true);
assert.ok(cold.fallback,`model sanity: cold prepare ${cold.prepareMs} ms must reproduce the Mac fallback`);
assert.ok(warm.warmDoneMs<=warm.prepareStartMs,`warm done ${warm.warmDoneMs} ms after prepare start ${warm.prepareStartMs} ms`);
assert.ok(!warm.fallback,`warmed prepare ${warm.prepareMs} ms >= ${TC.CHAIN_FALLBACK.waitS*1000} ms`);
// waitS is not lengthened
assert.equal(TC.CHAIN_FALLBACK.waitS,3);
// spread: one stage at a time, at least one 60 fps frame between stages, no stage over a 2 s budget
assert.ok(TC.SKY_WARM_GAP_MS>=17);for(const s of TC.SKY_LEG_STAGES)assert.ok(s.ms<=2000,s.id);
// every transit prefab BalloonTransit mounts is in the warm
const bt=src('region/BalloonTransit.ts');
for(const n of ['transport_balloon','transit_clouds_merged','transit_night_dome','far_meadow_card'])
 {assert.ok(bt.includes(`'${n}'`),'BalloonTransit no longer loads '+n);assert.ok(TC.SKY_LEG_STAGES.some(s=>s.id==='prefab:'+n),'warm misses '+n);}
// wiring: sail ride starts the warm; both cold flows arm it
const tp=src('region/TransitionPreload.ts');
assert.match(tp,/export function sailRideStarted\(\)/);assert.match(tp,/warmSkycityLegStaged/);
assert.match(src('region/RegionJourneyAdapter.ts'),/ride:\(actor,world,token\)=>\{sailRideStarted\(\);/);
assert.match(src('world-r2/PreTransitionRun.ts'),/armSkycityWarmOnSailRide\(\);[^\n]*\n\s*r=await this\.step\(\(\)=>this\.wc\(\)\.travelRegion\('meadow'\)/);
assert.match(src('world-r2/WorldNativeComposition.ts'),/current==='island'&&order\.indexOf\(target\)>=order\.indexOf\('skycity'\)&&typeof armSkycityWarmOnSailRide==='function'\)armSkycityWarmOnSailRide\(\)/);
console.log('skycity-windwipe: PASS',JSON.stringify({cold,warm}));
