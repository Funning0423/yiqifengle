#!/usr/bin/env node
'use strict';
/**
 * full8 plan E (sea-distance PROPOSAL §2/§4/§5): the island→meadow sail reads as open sea.
 * - Stand-in transform (−11.6,−0.91,492.0)·0.7·yaw180; handoff state machine never swaps on screen, ≥ t=17.4 s.
 * - On all 7 SAIL_SCREENS: at the handoff frame the stand-in AND the real meadow are outside the frustum (60 fps sweep).
 * - Three coverage ratios reported per screen (stand-in at K1, stand-in at K2, real meadow after handoff) — report only
 *   until 场景设计部's far_meadow_impostor mesh lands (placeholder = far_meadow_coast card at the same transform).
 * - Lowland y-map, exact restore, prewarm, no fog / sea-shader / sky edits, clouds unchanged, leg ≤ 45 s, sail bundle ≤ 1 MiB.
 */
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const L=require('../transitions/sail_farsea_lib.cjs'),leg=L.leg,voy=L.load('region/SailVoyage.ts',s=>s.includes('TransportLeg')?leg:{});
const ROOT=path.resolve(__dirname,'../..'),SRC=path.join(ROOT,'creator-build-project/assets/scripts/region');
const sea=L.load('region/SeaReveal.ts');
assert.deepEqual([...sea.SEA_STANDIN.pos],[-11.6,-0.91,492.0]);assert.equal(sea.SEA_STANDIN.scale,.7);assert.equal(sea.SEA_STANDIN.yawDeg,180);
assert.equal(sea.SEA_HANDOFF_T,17.4);
// state machine: no swap before 17.4, defers while either box is visible
{const r=sea.createSeaReveal();assert.equal(r.step(10,false,false),'standin');assert.equal(r.step(17.4,true,false),'pending');assert.equal(r.step(17.5,false,true),'pending');assert.equal(r.step(17.6,false,false),'real');assert.ok(Math.abs(r.deferredS-.2)<1e-9);assert.equal(r.step(18,true,true),'real');}
// lowland
assert.equal(sea.lowlandY(0,.4,44.9),-1.3);assert.equal(sea.lowlandY(0,.4,45),.4);assert.equal(sea.lowlandY(0,-2,10),-2);
// boxes: one ABOVE-WATER box per real-meadow mesh (env_meadow.glb world tris after the lowland sink; verts with y ≤ sea level dropped —
// same rule as the runtime aboveWaterTiles, 4 m tiles; a whole-terrain bbox contains the boat and would never pass). Stand-in = meadow extents ×0.7.
const sc=L.scene(),boxes=[],SEA_Y=-0.91;let mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9];
for(const m of sc.meadow){const t=m.tris;if(!t.length)continue;const sink=sea.SEA_LOWLAND.meshes.test(m.name),pts=new Float64Array(t.length);
 for(let i=0;i<t.length;i+=3){pts[i]=t[i];pts[i+1]=sink?sea.lowlandY(t[i],t[i+1],t[i+2]):t[i+1];pts[i+2]=t[i+2];for(let k=0;k<3;k++){mn[k]=Math.min(mn[k],t[i+k]);mx[k]=Math.max(mx[k],t[i+k]);}}
 boxes.push(...sea.aboveWaterTiles(pts,SEA_Y));}
// stand-in = the meadow ×0.7 about the meadow root moved to the stand-in centre (as voyage_lib / SailArt placement), above water only
const S=sea.SEA_STANDIN,root=leg.sailMeadowRoot(),sp=[];
for(const m of sc.meadow){const t=m.tris;for(let i=0;i<t.length;i+=3)sp.push(S.pos[0]+(t[i]-root[0])*S.scale,S.pos[1]+(t[i+1]-root[1])*S.scale,S.pos[2]+(t[i+2]-root[2])*S.scale);}
const standinT=sea.aboveWaterTiles(sp,SEA_Y,sea.SEA_TILE_M*S.scale),standin=sea.aboveWaterBox(sp,SEA_Y);assert.ok(standin&&standinT.length,'stand-in above water');
const route=leg.sailRoute(),tl=leg.sailBeats(route.length),st=leg.sailStillTimes(tl);
assert.ok(tl.build05S<=45,'sail leg '+tl.build05S);
const anyIn=(c,asp,bs)=>bs.some(b=>sea.boxInFrustum(c,asp,b));
// Lens used for the sweep: shipped sailCamera, with the PROPOSAL §2.2 prototype open-sea lateral shot in 11.4–18.0 s (运镜bot owns the
// final framing). Also recorded: whether the shipped camera alone ever allows a frustum-safe handoff (it does not → plan E stays opt-in).
const lens=(t,s,proto)=>proto?voy.sailVoyageCamera(tl,route.samples,t,s)/* 运镜bot 4012da49 plan E lens */:leg.sailCamera(tl,route.samples,t,s);
const report=[];let shippedHandoff=0;
for(const s of leg.SAIL_SCREENS){
 const asp=s.w/s.h,sweep=proto=>{const r=sea.createSeaReveal();for(let t=0;t<=tl.build05S+1e-9;t+=1/60){const c=lens(t,s,proto),a=anyIn(c,asp,standinT),b=anyIn(c,asp,boxes);const p=r.phase;r.step(t,a,b);if(p!=='real'&&r.phase==='real')return {t,a,b,r};}return null;};
 const handoff=sweep(true);if(sweep(false))shippedHandoff++;
 assert.ok(handoff,'no handoff on '+s.w+'x'+s.h);
 assert.ok(!handoff.a&&!handoff.b,'swap on screen '+s.w+'x'+s.h);
 assert.ok(handoff.t>=17.4-1e-9&&handoff.t<=18.0,'handoff outside window '+handoff.t);
 const frac=(t,b)=>sea.boxScreenFrac(lens(t,s,true),asp,b);
 report.push({screen:s.w+'x'+s.h,handoffT:+handoff.t.toFixed(3),deferredS:+handoff.r.deferredS.toFixed(3),
  standinDock:+frac(0,standin).toFixed(5),standinK2:+frac(st.k2,standin).toFixed(5),realDockMaxTile:+Math.max(...boxes.map(b=>frac(tl.build05S,b))).toFixed(4)});
}
assert.equal(sea.SEA_REVEAL_DEFAULT,false,'plan E stays opt-in with ?sailVoyage=1 (shipped default lens handoffs: '+shippedHandoff+')');
// runtime wiring (static): handoff driven by presentation t, prewarm, exact restore, no fog / sky / sea shader edits, clouds untouched
const art=fs.readFileSync(path.join(SRC,'SailArt.ts'),'utf8'),ride=fs.readFileSync(path.join(SRC,'SailRide.ts'),'utf8');
assert.match(ride,/art\?\.sync\(v,pose\.position,dt,sailNight\(\),pose\.target,t\)/,'presentation t into SailArt');
assert.match(ride,/const pose=sailLens\(/,'voyage lens drives the ride');
assert.match(art,/prewarmLeft>0&&!stillFrame\)\{prewarmLeft--;showMeadow\(true\)/,'prewarm (not on SailShot stills)');
assert.match(art,/realBox=SEA_BOUNDS_NOTE\.real\|\|boundsOf/,'above-water / notes bounds');
assert.match(art,/restoreLowland\(\);showMeadow\(true\)/,'dispose restores');
assert.match(art,/h\.r\.mesh=h\.mesh/,'restore = original mesh object');
assert.doesNotMatch(art,/fog/i,'no fog');
assert.match(art,/mid\[0\]\+Math\.cos\(a\)\*150,38\+\(i%3\)\*12,mid\[2\]\+Math\.sin\(a\)\*150/,'clouds unchanged');
assert.ok(sea.SEA_LOWLAND.meshes.test('meadow_river'),'river sunk + restored too');
assert.match(art,/far_island_lighthouse/,'lighthouse card still off');
// sail subpackage
const DIR=path.join(ROOT,'creator-build-project/assets/bundles/transport_sail');let bytes=0;
for(const f of fs.readdirSync(DIR,{recursive:true})){const p=path.join(DIR,f);if(fs.statSync(p).isFile()&&!p.endsWith('.meta'))bytes+=fs.statSync(p).size;}
assert.ok(bytes<=1024*1024,'sail bundle '+bytes);
const mesh=['far_meadow_impostor','sea_reef_cluster'].map(n=>({n,delivered:fs.readdirSync(DIR,{recursive:true}).some(f=>String(f).includes(n))}));
console.log(JSON.stringify({ok:true,shippedCameraHandoffScreens:shippedHandoff,legS:+tl.build05S.toFixed(3),sailBundleBytes:bytes,mesh,report}));
console.log('PASS sail-sea-distance');
