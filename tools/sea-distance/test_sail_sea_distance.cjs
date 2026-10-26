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
const L=require('../transitions/sail_farsea_lib.cjs'),leg=L.leg;
const ROOT=path.resolve(__dirname,'../..'),SRC=path.join(ROOT,'creator-build-project/assets/scripts/region');
const sea=L.load('region/SeaReveal.ts');
assert.deepEqual([...sea.SEA_STANDIN.pos],[-5.6,-0.91,242.0]);assert.equal(sea.SEA_STANDIN.scale,.335);assert.equal(sea.SEA_STANDIN.yawDeg,180);
assert.equal(sea.SEA_HANDOFF_T,17.4);
// state machine: no swap before 17.4, defers while either box is visible
{const r=sea.createSeaReveal();assert.equal(r.step(10,false,false),'standin');assert.equal(r.step(17.4,true,false),'pending');assert.equal(r.step(17.5,false,true),'pending');assert.equal(r.step(17.6,false,false),'real');assert.ok(Math.abs(r.deferredS-.2)<1e-9);assert.equal(r.step(18,true,true),'real');}
// lowland
assert.equal(sea.lowlandY(0,.4,44.9),-1.3);assert.equal(sea.lowlandY(0,.4,45),.4);assert.equal(sea.lowlandY(0,-2,10),-2);
// boxes: one per real-meadow mesh from env_meadow.glb world tris (sky dome / near clouds / far hills skipped, as SailArt hides them
// with the meadow); sunk lowland meshes clipped to z ≥ 45 (seaClipLowland, same as runtime). Stand-in = meadow extents ×0.7.
const sc=L.scene(),boxes=[];let mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9];
for(const m of sc.meadow){const t=m.tris;if(!t.length||sea.SEA_ALWAYS_DRAWN.test(m.name))continue;const b={min:[1e9,1e9,1e9],max:[-1e9,-1e9,-1e9]};
 for(let i=0;i<t.length;i+=3)for(let k=0;k<3;k++){b.min[k]=Math.min(b.min[k],t[i+k]);b.max[k]=Math.max(b.max[k],t[i+k]);mn[k]=Math.min(mn[k],t[i+k]);mx[k]=Math.max(mx[k],t[i+k]);}
 boxes.push(sea.SEA_LOWLAND.meshes.test(m.name)?sea.seaClipLowland(b):b);}
const S=sea.SEA_STANDIN,hx=(mx[0]-mn[0])/2*S.scale,hz=(mx[2]-mn[2])/2*S.scale,hy=(mx[1]-mn[1])*S.scale;
const standin={min:[S.pos[0]-hx,S.pos[1],S.pos[2]-hz],max:[S.pos[0]+hx,S.pos[1]+hy,S.pos[2]+hz]};
const route=leg.sailRoute(),tl=leg.sailBeats(route.length),st=leg.sailStillTimes(tl);
assert.ok(tl.build05S<=45,'sail leg '+tl.build05S);
const anyIn=(c,asp,bs)=>bs.some(b=>sea.boxInFrustum(c,asp,b));
// Lens used for the sweep: shipped sailCamera, with the PROPOSAL §2.2 prototype open-sea lateral shot in 11.4–18.0 s (运镜bot owns the
// final framing). Also recorded: whether the shipped camera alone ever allows a frustum-safe handoff (it does not → plan E stays opt-in).
const lens=(t,s,proto)=>proto&&t>=11.4&&t<=18.0?sea.seaLateralPose(leg.sailVehicle(tl,route.samples,t).pos):leg.sailCamera(tl,route.samples,t,s);
const report=[];let shippedHandoff=0;
for(const s of leg.SAIL_SCREENS){
 const asp=s.w/s.h,sweep=proto=>{const r=sea.createSeaReveal();for(let t=0;t<=tl.build05S+1e-9;t+=1/60){const c=lens(t,s,proto),a=sea.boxInFrustum(c,asp,standin),b=anyIn(c,asp,boxes);const p=r.phase;r.step(t,a,b);if(p!=='real'&&r.phase==='real')return {t,a,b,r};}return null;};
 const handoff=sweep(true);if(sweep(false))shippedHandoff++;
 assert.ok(handoff,'no handoff on '+s.w+'x'+s.h);
 assert.ok(!handoff.a&&!handoff.b,'swap on screen '+s.w+'x'+s.h);
 assert.ok(handoff.t>=17.4-1e-9&&handoff.t<=18.0,'handoff outside window '+handoff.t);
 const frac=(t,b)=>sea.boxScreenFrac(lens(t,s,true),asp,b);
 report.push({screen:s.w+'x'+s.h,handoffT:+handoff.t.toFixed(3),deferredS:+handoff.r.deferredS.toFixed(3),
  standinDock:+frac(0,standin).toFixed(5),standinK2:+frac(st.k2,standin).toFixed(5),realDockBoxUpper:+Math.max(...boxes.map(b=>frac(tl.build05S,b))).toFixed(4)});
}
assert.equal(sea.SEA_REVEAL_DEFAULT,false,'plan E must stay opt-in until the open-sea camera lands (shipped camera handoffs: '+shippedHandoff+')');
// runtime wiring (static): handoff driven by presentation t, prewarm, exact restore, no fog / sky / sea shader edits, clouds untouched
const art=fs.readFileSync(path.join(SRC,'SailArt.ts'),'utf8'),ride=fs.readFileSync(path.join(SRC,'SailRide.ts'),'utf8');
assert.match(ride,/art\?\.sync\(v,pose\.position,dt,sailNight\(\),pose\.target,t\)/,'presentation t into SailArt');
assert.match(art,/prewarmLeft>0\)\{prewarmLeft--;showMeadow\(true\)/,'prewarm');
assert.match(art,/restoreLowland\(\);showMeadow\(true\)/,'dispose restores');
assert.match(art,/h\.r\.mesh=h\.mesh/,'restore = original mesh object');
assert.doesNotMatch(art,/fog/i,'no fog');
assert.match(art,/mid\[0\]\+Math\.cos\(a\)\*150,38\+\(i%3\)\*12,mid\[2\]\+Math\.sin\(a\)\*150/,'clouds unchanged');
assert.match(art,/filter\(r=>!SEA_ALWAYS_DRAWN\.test/,'river mouth stays drawn');
assert.match(art,/far_island_lighthouse/,'lighthouse card still off');
// sail subpackage
const DIR=path.join(ROOT,'creator-build-project/assets/bundles/transport_sail');let bytes=0;
for(const f of fs.readdirSync(DIR,{recursive:true})){const p=path.join(DIR,f);if(fs.statSync(p).isFile()&&!p.endsWith('.meta'))bytes+=fs.statSync(p).size;}
assert.ok(bytes<=1024*1024,'sail bundle '+bytes);
const mesh=['far_meadow_impostor','sea_reef_cluster'].map(n=>({n,delivered:fs.readdirSync(DIR,{recursive:true}).some(f=>String(f).includes(n))}));
console.log(JSON.stringify({ok:true,shippedCameraHandoffScreens:shippedHandoff,legS:+tl.build05S.toFixed(3),sailBundleBytes:bytes,mesh,report}));
console.log('PASS sail-sea-distance');
