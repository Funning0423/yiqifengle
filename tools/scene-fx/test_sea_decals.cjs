'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('node:assert/strict');
const ts = require('../qf-env.cjs').typescript(), root = path.resolve(__dirname, '../..');
const dir = path.join(root, 'creator-build-project/assets/scripts');
function load(rel) {
  const m = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(dir, rel), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, { exports: m.exports, module: m });
  return m.exports;
}
const L = require('../t9-island-props/load_ts.cjs').load(['world-r1/CameraPose', 'world-r2/IslandPropsLayout']).IslandPropsLayout;
const S = load('render/ShoreBreakCore.ts'), F = load('render/IslandAtmosphereFxCore.ts');
const P = L.ISLAND_PROPS, shadowLift = P.signpost.water.ripple.lift * 0.5, rippleLift = P.signpost.water.ripple.lift, poolLift = P.signpost.lampLight.reflection.lift;
const oldShadowY = P.seaY + shadowLift;
let minGap = Infinity, maxGap = -Infinity, oldHidden = 0, samples = 0, minSea = Infinity, maxSea = -Infinity;
for (let i = 0; i <= 960; i++) {
  const t = i * S.SHORE.loopS / 960, sea = S.SHORE.seaBaseY + S.seaSheetLift(t);
  minSea = Math.min(minSea, sea); maxSea = Math.max(maxSea, sea);
  if (sea > oldShadowY) oldHidden++;
  for (const lift of [shadowLift, rippleLift, poolLift]) {
    const y = L.seaDecalY(sea, lift), gap = y - sea;
    minGap = Math.min(minGap, gap); maxGap = Math.max(maxGap, gap);
    assert.ok(Math.abs(gap - (L.SEA_SURFACE_LIFT + lift)) < 1e-12);
    samples++;
  }
  const glint = sea + F.ISLAND_FX.band.surfaceLiftM;
  assert.ok(Math.abs(glint - sea - L.SEA_SURFACE_LIFT) < 1e-12);
}
assert.equal(L.SEA_SURFACE_LIFT, F.ISLAND_FX.band.surfaceLiftM);
assert.ok(oldHidden > 0, 'a fixed rest-height shadow is buried by the opaque sheet on some frames');
assert.ok(maxSea - minSea > 0.1, 'the sheet still heaves');
for (const y of [undefined, NaN, Infinity]) assert.equal(L.liveSeaY(y), P.seaY);
assert.equal(L.seaDecalY(undefined, shadowLift), P.seaY + L.SEA_SURFACE_LIFT + shadowLift);
const world = fs.readFileSync(path.join(dir, 'world-r1/WorldFlowComponent.ts'), 'utf8');
const moon = 'this.atmosphere?.advance(dt,this.worldCamera?.node??null,this.getWindStrength(),this.shore?.surfaceWorldY());';
assert.ok(world.includes(moon));
assert.ok(world.indexOf(moon) < world.indexOf('applySeaSurface(this.shore?.surfaceWorldY())'));
const fx = fs.readFileSync(path.join(dir, 'render/IslandAtmosphereFx.ts'), 'utf8');
assert.ok(fx.includes('seaSurfaceY + ISLAND_FX.band.surfaceLiftM'));
assert.ok(fx.includes('this.place(this.glint, [ISLAND_FX.lamp[0], glintY, ISLAND_FX.lamp[2]]'));
assert.ok(!fx.includes('overridePipelineStates'));
const props = fs.readFileSync(path.join(dir, 'world-r2/IslandProps.ts'), 'utf8');
assert.ok(props.includes('seaDecalY(sea, lift * 0.5)'));
assert.ok(props.includes('seaDecalY(sea, lift)'));
assert.ok(props.includes('seaDecalY(sea, S.lampLight.reflection.lift)'));
assert.ok(props.includes('screenPropPose(pose, this.buttonRef'));
assert.ok(props.includes(', this.seaYLive)'));
assert.ok(props.includes("technique: 3"));
assert.ok(!props.includes('overridePipelineStates'));
const boot = fs.readFileSync(path.join(dir, 'WorldIntegrationBoot.ts'), 'utf8');
assert.ok(!boot.includes('测试包'));
assert.ok(!boot.includes('flowTestMark'));
const out = { pass: true, scope: 'CPU sheet clearance and source wiring; no GPU claim', loopS: S.SHORE.loopS, samples, seaRange: [minSea, maxSea], beforeOccludedSamples: oldHidden, afterClearance: [L.SEA_SURFACE_LIFT + shadowLift, L.SEA_SURFACE_LIFT + poolLift], gapRange: [minGap, maxGap], depthPolicy: 'unchanged builtin-unlit, depthTest stays on; decals follow the live sheet' };
console.log(JSON.stringify(out, null, 2));
