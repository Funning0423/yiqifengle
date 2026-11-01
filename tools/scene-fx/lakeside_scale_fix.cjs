'use strict';
/* 场景特效bot r5 S3 fix_r1 (1a): lakeside instance SCALES only (scene_r5h_slim_transforms.json), against docs/r5/scene-lod-scale.md
 * (H = heroine 1.74 m). Height of each instance = model height x scale.y; heights are remapped linearly, rank kept:
 *   LK_reed_card   1.29..2.06 m -> 1.2..1.4 m   (uniform)
 *   LK_grass_tuft  0.29..0.94 m -> 0.35..0.5 m  (y full, x/z by sqrt of the factor: the footprint shrinks less, no bare lawn)
 *   LK_tree_round  max 7.06 -> 5.2 m (3H), LK_tree_conifer max 9.16 -> 6.1 m (= the island's tallest palm, env_prop_palm_tall_01
 *   6.07 m); the low end stays (2.53 / 2.17 m, island young palm 2.36 m). Trees: y full, x/z by factor^0.75.
 * Positions, rotations and every other instance are untouched. Idempotent (a remap of an in-range set onto the same range is the
 * identity). Usage: node tools/scene-fx/lakeside_scale_fix.cjs [--dry] */
const fs = require('fs'), path = require('path');
const TF = path.join(__dirname, '../../creator-build-project/assets/bundles/region_lakeside/scene_r5h_slim_transforms.json');
const T = JSON.parse(fs.readFileSync(TF, 'utf8'));
const RULES = {
  'LK_reed_card.glb': { h: 1.60, lo: 1.2, hi: 1.4, keepLo: false, xz: 1 },
  'LK_grass_tuft.glb': { h: 0.36, lo: 0.35, hi: 0.5, keepLo: false, xz: 0.5 },
  'LK_tree_round.glb': { h: 2.6264, hi: 5.2, keepLo: true, xz: 0.75 },
  'LK_tree_conifer.glb': { h: 2.925, hi: 6.1, keepLo: true, xz: 0.75 },
};
const report = {};
for (const g in RULES) {
  const R = RULES[g], list = T.instances.filter(i => i && i.glb === g);
  const hs = list.map(i => R.h * i.scale[1]), h0 = Math.min.apply(null, hs), h1 = Math.max.apply(null, hs);
  const lo = R.keepLo ? h0 : R.lo, hi = R.hi; let before = [h0, h1], after = [1e9, -1e9];
  list.forEach((i, k) => {
    const h = hs[k], t = h1 - h0 > 1e-9 ? (h - h0) / (h1 - h0) : 1, nh = lo + t * (hi - lo), f = nh / h, fx = Math.pow(f, R.xz);
    i.scale = [+(i.scale[0] * fx).toFixed(5), +(i.scale[1] * f).toFixed(5), +(i.scale[2] * fx).toFixed(5)];
    const ah = R.h * i.scale[1]; after = [Math.min(after[0], ah), Math.max(after[1], ah)];
  });
  report[g] = { n: list.length, beforeM: before.map(v => +v.toFixed(3)), afterM: after.map(v => +v.toFixed(3)) };
}
console.log(JSON.stringify(report, null, 1));
if (!process.argv.includes('--dry')) fs.writeFileSync(TF, JSON.stringify(T));
