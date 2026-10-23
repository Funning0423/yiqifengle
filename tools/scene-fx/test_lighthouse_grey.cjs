// 场景特效bot r5: lighthouse coast grey-box GLB contract (budget, shared palette, named nodes for levels 21-24).
'use strict';
const fs = require('fs'), path = require('path');
const F = path.join(__dirname, '../../creator-build-project/assets/bundles/region_lighthouse/models/LH_lighthouse.glb');
let fail = 0; const check = (n, ok, d) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d === undefined ? '' : ' ' + JSON.stringify(d))); };
const b = fs.readFileSync(F), jl = b.readUInt32LE(12), j = JSON.parse(b.slice(20, 20 + jl).toString());
check('glb-v2', b.readUInt32LE(0) === 0x46546c67 && b.readUInt32LE(4) === 2);
let tris = 0; for (const m of j.meshes) for (const p of m.primitives) tris += (p.indices !== undefined ? j.accessors[p.indices].count : j.accessors[p.attributes.POSITION].count) / 3;
check('triangle-budget<=50k', tris <= 50000, tris);
check('one-shared-palette-material', j.materials.length === 1 && j.materials[0].name === 'M_LK_palette', j.materials.map(m => m.name));
check('palette-image', (j.images || []).length === 1 && j.images[0].name === 'T_LK_palette_256');
const names = j.nodes.map(n => n.name);
for (const n of ['LH_lighthouse', 'LH_tower', 'LH_lantern_room', 'LH_vane', 'LH_beam', 'LH_rock', 'LH_beach', 'LH_sea', 'LH_pier', 'LH_cottage', 'LH_stand', 'LH_ladder', 'LH_props', 'LH_tower_axis', 'LH_heroine_stand', 'LH_cottage_window_B', 'LH_lantern_core', 'LH_lantern_grip'])
  check('node ' + n, names.indexOf(n) >= 0);
check('level empties 21-24', [21, 22, 23, 24].every(i => names.indexOf('LH_level_' + i) >= 0));
check('level lanterns 21-24', [21, 22, 23, 24].every(i => names.indexOf('LH_stone_lantern_' + i) >= 0));
check('no-animations-no-skins', !j.animations && !j.skins);
// beam must be empty (no mesh) — find node LH_beam and ensure no mesh index
const beam = j.nodes.find(n => n.name === 'LH_beam');
check('beam-is-empty-node', !!beam && beam.mesh === undefined, beam && { mesh: beam.mesh });
console.log(fail ? 'FAIL lighthouse grey ' + fail : 'PASS lighthouse grey (' + tris + ' tris, shared palette, levels 21-24, empty beam)');
process.exit(fail ? 1 : 0);
