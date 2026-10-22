// 场景特效bot r5: snowpass grey-box GLB contract (budget, shared palette, named nodes for chimes / level lanterns).
'use strict';
const fs = require('fs'), path = require('path');
const F = path.join(__dirname, '../../creator-build-project/assets/bundles/region_snowpass/models/SP_snowpass.glb');
let fail = 0; const check = (n, ok, d) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d === undefined ? '' : ' ' + JSON.stringify(d))); };
const b = fs.readFileSync(F), jl = b.readUInt32LE(12), j = JSON.parse(b.slice(20, 20 + jl).toString());
check('glb-v2', b.readUInt32LE(0) === 0x46546c67 && b.readUInt32LE(4) === 2);
let tris = 0; for (const m of j.meshes) for (const p of m.primitives) tris += (p.indices !== undefined ? j.accessors[p.indices].count : j.accessors[p.attributes.POSITION].count) / 3;
check('triangle-budget<=55k', tris <= 55000, tris);
check('one-shared-palette-material', j.materials.length === 1 && j.materials[0].name === 'M_LK_palette', j.materials.map(m => m.name));
check('palette-image', (j.images || []).length === 1 && j.images[0].name === 'T_LK_palette_256');
const names = j.nodes.map(n => n.name);
for (const n of ['SP_snowpass', 'SP_ground', 'SP_gate', 'SP_mtn_near', 'SP_mtn_mid', 'SP_mtn_far', 'SP_steps', 'SP_rubble', 'SP_pines'])
  check('node ' + n, names.indexOf(n) >= 0);
check('5 chime tubes', [0, 1, 2, 3, 4].every(i => names.indexOf('SP_chime_tube_' + i) >= 0));
check('level lanterns 17-20', [17, 18, 19, 20].every(i => names.indexOf('SP_stone_lantern_' + i) >= 0));
check('no-animations-no-skins', !j.animations && !j.skins);
console.log(fail ? 'FAIL snowpass grey ' + fail : 'PASS snowpass grey (' + tris + ' tris, shared palette, chime + lantern nodes)');
process.exit(fail ? 1 : 0);
