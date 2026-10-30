'use strict';
// P0 wipe (Mac 19bd812a, 2026-10-29 report 20261029T2135): `WindWipe fallback #1 {leg:meadow, waitedS:3.06 / 3.17, prepare-slow}`
// in finstart and m; m flat frames 125–147 (cream cover). Neither console has a [QF_PRELOAD] meadow line: the island→meadow warm
// only ran at the mainline-04 board, so a sail from the island without L4 in this session paid region_meadow (5.5 MB) +
// transport_sail + the meadow instantiate inside CHAIN_FALLBACK.waitS (m: sail wait 01:17:56.8 → region-travel 01:18:12.9 = 16.1 s).
// The journey prepare also instantiated a second, throwaway meadow even when the warm rig existed. FAILS on 19bd812a / d3b8e5e4.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const H=require('../board-ui/harness.cjs').createHarness();
const S=path.join(__dirname,'../../creator-build-project/assets/scripts/');
const src=f=>fs.readFileSync(path.join(S,f),'utf8');
const TC=H.load('region/TransitionChain.ts');
assert.equal(TC.CHAIN_FALLBACK.waitS,3,'fallback threshold unchanged');
assert.ok(Array.isArray(TC.MEADOW_LEG_STAGES),'no staged island→meadow warm (pre-fix: meadow warm only at the mainline-04 board)');
const ids=TC.MEADOW_LEG_STAGES.map(s=>s.id);
assert.deepEqual(ids,['bundle:region_meadow','bundle:transport_sail','prefab:env_meadow','mount:meadow-warm-rig'],'one load per stage, mount last');
for(const s of TC.MEADOW_LEG_STAGES)assert.ok(s.ms<=2000,s.id);assert.ok(TC.SKY_WARM_GAP_MS>=17,'a frame between stages');
// timeline on the Mac numbers: home at t=0, sail tap at 48.4 s (m), island stable from 44.8 s; cold prepare 16.1 s (swap) scaled per stage
const scale=16100/TC.MEADOW_LEG_STAGES.reduce((a,s)=>a+s.ms,0);
function sim(warm,{tapMs=48400,islandMs=44800,homeIdleMs=6500}={}){
 if(!warm){return {prepareMs:16100,fallback:true};}
 let t=0;const loads=TC.MEADOW_LEG_STAGES.filter(s=>!s.id.startsWith('mount'));for(const s of loads)t+=s.ms*scale+TC.SKY_WARM_GAP_MS;
 const mount=TC.MEADOW_LEG_STAGES.find(s=>s.id.startsWith('mount')).ms*scale;
 const start=t<=homeIdleMs?t:Math.max(t,islandMs);const done=start+mount;     // mount only at home or on the island, never on the walk
 const left=Math.max(0,done-tapMs);return {loadsDoneMs:Math.round(t),mountStartMs:Math.round(start),warmDoneMs:Math.round(done),prepareMs:Math.round(left),fallback:left>=TC.CHAIN_FALLBACK.waitS*1000};}
const cold=sim(false),warm=sim(true);
assert.ok(cold.fallback,'model reproduces the Mac fallback');assert.ok(!warm.fallback,'warmed prepare '+warm.prepareMs+' ms >= 3000');
// wiring: boot, ensureRegion from the island, preTransition (before the home→island walk); mount only in a stable place
const tp=src('region/TransitionPreload.ts'),wn=src('world-r2/WorldNativeComposition.ts'),pr=src('world-r2/PreTransitionRun.ts'),ad=src('region/RegionJourneyAdapter.ts');
assert.match(tp,/export function warmMeadowLegStaged\(parent:Node,stable:\(\)=>boolean/);assert.match(tp,/while\(!stable\(\)\)await wait\(gap\);await preloadMeadowForSail\(parent\)/);
assert.match(tp,/frameMaxMs:max/,'each stage logs its longest frame');
assert.match(wn,/warmMeadowIfIsland\(_why:string,force=false\)/);assert.match(wn,/\['home','island'\]\.includes\(w\.commands\(\)\.snapshot\(\)\.state\)/);
for(const w of ['boot','ensure'])assert.ok(wn.includes(`warmMeadowIfIsland?.('${w}'`),'warm not wired: '+w);
assert.match(pr,/warmMeadowIfIsland\?\.\('pre',true\)[^\n]*\n\s*let r=await this\.toPlace\('island'\)/,'preTransition warms before the walk to the island');
// the journey prepare reuses the warm rig instead of instantiating (and destroying) a second meadow
assert.ok(!/model=mountRegion\(def,prefab,rig\);[\s\S]{0,400}if\(warmed\)\{model\.removeFromParent\(\);model\.destroy\(\)/.test(ad),'prepare still instantiates a throwaway meadow');
assert.match(ad,/if\(warmed\)\{model=warmed;rig\.addChild\(model\);\}else model=mountRegion\(def,prefab,rig\);/);
// the mainline-04 path is kept
assert.ok(src('world-r1/WorldFlowComponent.ts').includes("Promise.all([preloadMeadowForSail(scene),warmTransition('meadow')])"));
console.log('meadow-windwipe: PASS '+JSON.stringify({cold,warm}));
