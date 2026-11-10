// 峡湾极光栈道: subpackage budget, vertex colours, a flat pier under the 7×7, cliffs, water and aurora in frame.
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '../..');
const DIR = path.join(ROOT, 'creator-build-project/assets/bundles/region_fjord');
const F = path.join(DIR, 'models/env_fjord.glb');
const { loadGlb } = require('../fjord/glb_read.cjs');
const { fjordBoardBounds, FJORD_PLATFORM, fjordBoardLook } = require('../board-ui/harness.cjs').createHarness().load('region/FjordSceneData');
let fail = 0; const check = (n, ok, d) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d === undefined ? '' : ' ' + JSON.stringify(d))); };
function walk(dir, out = []) { for (const name of fs.readdirSync(dir)) { const p = path.join(dir, name); const st = fs.statSync(p); if (st.isDirectory()) walk(p, out); else out.push(st.size); } return out; }
const bytes = walk(DIR).reduce((a, b) => a + b, 0);
check('subpackage-budget<=943718', bytes <= 943718, bytes);
const loaded = loadGlb(F), j = loaded.json;
check('glb-v2', fs.readFileSync(F).readUInt32LE(0) === 0x46546c67 && fs.readFileSync(F).readUInt32LE(4) === 2);
let tris = 0; for (const m of j.meshes) for (const p of m.primitives) tris += j.accessors[p.indices].count / 3;
check('triangle-budget<=3000', tris <= 3000 && tris >= 800, tris);
check('vertex-colours-no-texture', !(j.images || []).length && j.materials.some(m => m.name === 'M_FJ_vertex') && j.meshes.every(m => m.primitives.every(p => j.accessors[p.attributes.COLOR_0].type === 'VEC4')));
const auroraMat = j.materials.find(m => m.name === 'M_FJ_unlit');
check('aurora-unlit-blend', !!(auroraMat && auroraMat.alphaMode === 'BLEND' && auroraMat.extensions && auroraMat.extensions.KHR_materials_unlit));
const names = j.nodes.map(n => n.name);
for (const n of ['env_fjord', 'FJ_platform', 'FJ_water', 'FJ_cliffs', 'FJ_cabins', 'FJ_aurora', 'FJ_mountains']) check('node ' + n, names.indexOf(n) >= 0);
check('platform-stays-float32', j.nodes.filter(n => n.name === 'FJ_platform').every(n => !n.matrix));
check('aurora-sway', Array.isArray(j.animations) && j.animations.some(a => a.name === 'aurora_sway'));
const board = fjordBoardBounds(), y = FJORD_PLATFORM.y;
const eps = 1e-4;
let top = 0, crossed = 0, above = 0;
const byName = {};
for (const mesh of loaded.meshes) {
  byName[mesh.name] = mesh.pos;
  const pos = mesh.pos, idx = mesh.idx;
  for (let i = 0; i < idx.length; i += 3) {
    const t = [pos[idx[i]], pos[idx[i + 1]], pos[idx[i + 2]]];
    const min = [0, 1, 2].map(k => Math.min(t[0][k], t[1][k], t[2][k]));
    const max = [0, 1, 2].map(k => Math.max(t[0][k], t[1][k], t[2][k]));
    if (mesh.name === 'FJ_platform' && Math.abs(min[1] - y) < eps && Math.abs(max[1] - y) < eps) top++;
    if (['FJ_sky', 'FJ_stars', 'FJ_aurora', 'FJ_fog', 'FJ_mountains'].includes(mesh.name)) continue;
    const overlap = max[0] > board.min[0] + eps && min[0] < board.max[0] - eps && max[2] > board.min[2] + eps && min[2] < board.max[2] - eps;
    if (!overlap) continue;
    if (max[1] > y + eps) above++;
    if (min[1] < y - eps && max[1] > y + eps) crossed++;
  }
}
check('platform-top-is-horizontal', top >= 2, top);
check('board-does-not-float-or-cut', above === 0 && crossed === 0, { above, crossed, y });
const tops = (byName.FJ_platform || []).filter(p => Math.abs(p[1] - y) < eps);
check('platform-top-covers-shelf', tops.length >= 4 && Math.min(...tops.map(p => p[0])) === FJORD_PLATFORM.minX && Math.max(...tops.map(p => p[0])) === FJORD_PLATFORM.maxX && Math.min(...tops.map(p => p[2])) === FJORD_PLATFORM.minZ && Math.max(...tops.map(p => p[2])) === FJORD_PLATFORM.maxZ, { verts: tops.length, y });
function norm(a) { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
const look = fjordBoardLook(9 / 19.5);
const eye = look.position, target = look.target, f = norm(sub(target, eye)), right = norm(cross(f, [0, 1, 0])), up = cross(right, f);
const fy = Math.tan(look.fovVerticalDeg * Math.PI / 360), fx = fy * (9 / 19.5);
function insideCount(name) {
  let n = 0;
  for (const p of byName[name] || []) {
    const d = sub(p, eye), zc = dot(d, f);
    if (zc <= 0.05) continue;
    const nx = dot(d, right) / zc / fx, ny = dot(d, up) / zc / fy;
    if (Math.abs(nx) < 0.98 && Math.abs(ny) < 0.98) n++;
  }
  return n;
}
for (const name of ['FJ_cliffs', 'FJ_water', 'FJ_aurora']) check(name + '-in-frame', insideCount(name) >= 4, insideCount(name));
check('pier-in-frame', insideCount('FJ_platform') >= 8, insideCount('FJ_platform'));
console.log(fail ? 'FAIL fjord grey ' + fail : 'PASS fjord grey (' + tris + ' tris, ' + bytes + ' B, pier y ' + y + ')');
process.exit(fail ? 1 : 0);
