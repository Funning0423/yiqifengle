// 黎明云海 blockout: subpackage budget, one palette, named nodes, and a flat terrace under the 7×7.
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '../..');
const DIR = path.join(ROOT, 'creator-build-project/assets/bundles/region_cloudsea');
const F = path.join(DIR, 'models/env_cloudsea.glb');
const { cloudseaBoardBounds, CLOUDSEA_PLATFORM } = require('../board-ui/harness.cjs').createHarness().load('region/CloudseaSceneData');
let fail = 0; const check = (n, ok, d) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d === undefined ? '' : ' ' + JSON.stringify(d))); };
function walk(dir, out = []) { for (const name of fs.readdirSync(dir)) { const p = path.join(dir, name); const st = fs.statSync(p); if (st.isDirectory()) walk(p, out); else out.push(st.size); } return out; }
const bytes = walk(DIR).reduce((a, b) => a + b, 0);
check('subpackage-budget<=943718', bytes <= 943718, bytes);
const b = fs.readFileSync(F), jl = b.readUInt32LE(12), j = JSON.parse(b.slice(20, 20 + jl).toString());
const chunkAt = 20 + jl, binLen = b.readUInt32LE(chunkAt), bin = b.slice(chunkAt + 8, chunkAt + 8 + binLen);
check('glb-v2', b.readUInt32LE(0) === 0x46546c67 && b.readUInt32LE(4) === 2);
let tris = 0; for (const m of j.meshes) for (const p of m.primitives) tris += (p.indices !== undefined ? j.accessors[p.indices].count : j.accessors[p.attributes.POSITION].count) / 3;
check('triangle-budget<=4000', tris <= 4000, tris);
check('one-palette-material', j.materials.length === 1 && j.materials[0].name === 'M_CS_palette', j.materials.map(m => m.name));
check('palette-image-16', (j.images || []).length === 1 && j.images[0].name === 'T_CS_palette_16');
check('nearest-sampler', j.samplers && j.samplers[0].magFilter === 9728 && j.samplers[0].minFilter === 9728);
const names = j.nodes.map(n => n.name);
for (const n of ['env_cloudsea', 'CS_platform', 'CS_clouds', 'CS_walk', 'CS_pads', 'CS_flags', 'CS_birds', 'CS_sun']) check('node ' + n, names.indexOf(n) >= 0);
check('no-animations-no-skins', !j.animations && !j.skins);
function floats(accIndex) {
  const a = j.accessors[accIndex], v = j.bufferViews[a.bufferView];
  const start = (v.byteOffset || 0) + (a.byteOffset || 0);
  const n = a.type === 'VEC3' ? 3 : a.type === 'VEC2' ? 2 : 1;
  const out = [];
  for (let i = 0; i < a.count; i++) { const p = []; for (let k = 0; k < n; k++) p.push(bin.readFloatLE(start + (i * n + k) * 4)); out.push(p); }
  return out;
}
function indices(accIndex) {
  const a = j.accessors[accIndex], v = j.bufferViews[a.bufferView];
  const start = (v.byteOffset || 0) + (a.byteOffset || 0);
  const out = [];
  for (let i = 0; i < a.count; i++) out.push(a.componentType === 5123 ? bin.readUInt16LE(start + i * 2) : bin.readUInt32LE(start + i * 4));
  return out;
}
const board = cloudseaBoardBounds(), y = CLOUDSEA_PLATFORM.y;
const eps = 1e-4;
let top = 0, crossed = 0, above = 0;
for (const node of j.nodes) {
  if (node.mesh === undefined) continue;
  const mesh = j.meshes[node.mesh];
  for (const prim of mesh.primitives) {
    const pos = floats(prim.attributes.POSITION), idx = indices(prim.indices);
    for (let i = 0; i < idx.length; i += 3) {
      const t = [pos[idx[i]], pos[idx[i + 1]], pos[idx[i + 2]]];
      const min = [0, 1, 2].map(k => Math.min(t[0][k], t[1][k], t[2][k]));
      const max = [0, 1, 2].map(k => Math.max(t[0][k], t[1][k], t[2][k]));
      if (node.name === 'CS_platform' && min[1] > y - eps && max[1] < y + eps) top++;
      const overlap = max[0] > board.min[0] + eps && min[0] < board.max[0] - eps && max[2] > board.min[2] + eps && min[2] < board.max[2] - eps;
      if (!overlap) continue;
      if (max[1] > y + eps) above++;
      if (min[1] < y - eps && max[1] > y + eps) crossed++;
    }
  }
}
check('platform-top-is-horizontal', top >= 2, top);
check('board-does-not-float-or-cut', above === 0 && crossed === 0, { above, crossed, y });
const plat = j.nodes.find(n => n.name === 'CS_platform');
const ppos = floats(j.meshes[plat.mesh].primitives[0].attributes.POSITION);
const tops = ppos.filter(p => Math.abs(p[1] - y) < eps);
check('platform-top-covers-shelf', tops.length >= 4 && Math.min(...tops.map(p => p[0])) === CLOUDSEA_PLATFORM.minX && Math.max(...tops.map(p => p[0])) === CLOUDSEA_PLATFORM.maxX && Math.min(...tops.map(p => p[2])) === CLOUDSEA_PLATFORM.minZ && Math.max(...tops.map(p => p[2])) === CLOUDSEA_PLATFORM.maxZ, { verts: tops.length });
console.log(fail ? 'FAIL cloudsea grey ' + fail : 'PASS cloudsea grey (' + tris + ' tris, ' + bytes + ' B, terrace y ' + y + ')');
process.exit(fail ? 1 : 0);
