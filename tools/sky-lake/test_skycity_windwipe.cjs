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
// full9c-b: every entry path that reaches the meadow→skycity balloon (with or without the sail) must reach 0 fallback
assert.equal(typeof TC.simulateSkyEntry,'function','no per-entry-path timeline (resume at the meadow is still cold)');
assert.ok(TC.simulateSkyEntry(0,TC.SKY_WARM_GAP_FAST_MS).fallback,'model sanity: no head start reproduces the fallback');
assert.ok(TC.SKY_WARM_GAP_FAST_MS>=100,'fast gap must still leave several frames between stages');
const need=['ensureRegion, sail','preTransition','balloonPreview from island','resume at meadow','meadow level','balloonPreview at meadow'];
const rows=TC.SKY_ENTRY_PATHS.map(p=>({...p,...TC.simulateSkyEntry(p.headStartMs,p.gapMs)}));
for(const n of need)assert.ok(rows.some(r=>r.id.includes(n)),'entry path not covered: '+n);
for(const r of rows)assert.ok(!r.fallback,`${r.id}: prepare ${r.prepareMs} ms >= 3000`);
const wn=src('world-r2/WorldNativeComposition.ts');
assert.match(wn,/private warmSkyIfMeadow\(/);assert.match(wn,/warmSkycityLegStaged\(SKY_WARM_GAP_FAST_MS\)/);
for(const w of ['boot','meadow-level','ensure','preview'])assert.ok(wn.includes(`warmSkyIfMeadow?.('${w}'`),'warm not wired: '+w);
assert.match(wn,/world\.initialize\(levels[^\n]*\n[^\n]*\n\s*\(this as any\)\.warmSkyIfMeadow\?\.\('boot'\)/);
console.log('skycity-windwipe: PASS',JSON.stringify({cold,warm,rows:rows.map(r=>[r.id,r.headStartMs,r.warmDoneMs,r.prepareMs])}));
