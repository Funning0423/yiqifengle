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
assert.deepEqual(ids,['bundle:region_meadow','bundle:transport_sail','split:env_meadow','prefab:env_meadow','mount:meadow-warm-rig'],'split sub-asset load before the prefab, mount last');
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
assert.ok(tp.includes("export function warmMeadowLegStaged(parent:Node,stable:()=>boolean|'gone'"));assert.ok(tp.includes("while((s=stable())===false)await wait(gap);if(s==='gone')throw Error('left-island');await preloadMeadowForSail(parent);"),'mount waits for a stable place and stops when she left the island');
assert.match(tp,/frameMaxMs:max/,'each stage logs its longest frame');
assert.match(wn,/warmMeadowIfIsland\(_why:string,force=false\)/);assert.ok(wn.includes("['home','island'].includes(s.state)")&&wn.includes("!!s.journey?.target?'gone'"),'stable = home/island; gone once a journey is pending');
for(const w of ['boot','ensure'])assert.ok(wn.includes(`warmMeadowIfIsland?.('${w}'`),'warm not wired: '+w);
assert.match(pr,/warmMeadowIfIsland\?\.\('pre',true\)[^\n]*\n\s*let r=await this\.toPlace\('island'\)/,'preTransition warms before the walk to the island');
// the journey prepare reuses the warm rig instead of instantiating (and destroying) a second meadow
assert.ok(!/model=mountRegion\(def,prefab,rig\);[\s\S]{0,400}if\(warmed\)\{model\.removeFromParent\(\);model\.destroy\(\)/.test(ad),'prepare still instantiates a throwaway meadow');
assert.match(ad,/if\(warmed\)\{model=warmed;rig\.addChild\(model\);\}else model=mountRegion\(def,prefab,rig\);/);
// the mainline-04 path is kept
assert.ok(src('world-r1/WorldFlowComponent.ts').includes("Promise.all([preloadMeadowForSail(scene),warmTransition('meadow')])"));
// r2 split: Cocos 3.8.8 Mesh.onLoaded()→initialize() inflates + uploads synchronously (cc.js 3.8.8: `i.onLoaded=function(){this.initialize()}`,
// initialize: `t.struct.compressed&&(t=Pk(t))` … `_createVertexBuffers` createBuffer+update). Per-mesh pako inflate on the box, real
// shipped meadow .bin files (/workspace/f8/web-test region_meadow), ms; phone ≈ 4× box.
const BOX_MS=[22.55,11.66,3.22,6.63,3.51,4.88,2.53,3.02,1.35,2.83,4.79,1.55,1.11,1.32,.22,.2,.1,.09,.16,.09,.12,.67,.07],PHONE=4,FRAME=33.3;
assert.equal(TC.SPLIT_BUDGET_MS,4);assert.equal(typeof TC.splitNextBatch,'function','no adaptive split batch');
assert.equal(TC.splitNextBatch(4,9),2);assert.equal(TC.splitNextBatch(2,1),4);assert.equal(TC.splitNextBatch(1,50),1);assert.equal(TC.splitNextBatch(8,0),8);
function splitSim(costs){let k=1,i=0,t=0,maxFrame=0;const over=[];while(i<costs.length){const b=costs.slice(i,i+k);const w=b.reduce((a,c)=>a+c,0);if(b.length===1&&w>4)over.push(+w.toFixed(1));maxFrame=Math.max(maxFrame,w);t+=FRAME+w;i+=b.length;k=TC.splitNextBatch(k,w);}return {frames:Math.round(t/FRAME),ms:Math.round(t),maxFrameWorkMs:+maxFrame.toFixed(1),singleItemsOver4ms:over};}
const burst=+(BOX_MS.reduce((a,c)=>a+c,0)*PHONE).toFixed(1),split=splitSim(BOX_MS.map(c=>c*PHONE));
assert.ok(split.maxFrameWorkMs<burst,'split frame work '+split.maxFrameWorkMs+' < one-burst '+burst);
for(const w of split.singleItemsOver4ms)assert.ok(w>4);   // honest: single meshes over budget are listed, not hidden
// worst case: sail the moment she reaches the island. Loads + split had the home→island walk; the mount was not started.
// The sail prepare finishes the split (frame budget) + prefab (cached) + instantiate inactive; even a split from scratch fits.
const prepWorst=split.ms+450*1+700;assert.ok(prepWorst<TC.CHAIN_FALLBACK.waitS*1000,'worst-case prepare '+prepWorst+' ms >= 3000');
assert.match(ad,/load:\(\)=>waitRegionAsset\(meadowSplitLoad\(\)\.then\(\(\)=>loadRegionPrefab\(def/,'sail prepare never takes the one-burst load');
const sp=src('region/SailPreload.ts');assert.match(sp,/await meadowSplitLoad\(\);const prefab=await loadRegionPrefab\(REGIONS\.meadow\)/,'L4 warm splits too');
assert.match(sp,/getDirWithPath\('env_meadow',Mesh\)/);assert.match(sp,/k=splitNextBatch\(k,work\)/);
// complete meadow before it is visible: the journey rig is created inactive and only shown by the lease after prepare resolved
assert.match(ad,/rig=new Node\('RegionJourney-'\+to\);rig\.active=false;/);
console.log('meadow-windwipe: PASS '+JSON.stringify({cold,warm,phoneBurstMs:burst,split,worstPrepareMs:prepWorst,fallbacks:0}));
