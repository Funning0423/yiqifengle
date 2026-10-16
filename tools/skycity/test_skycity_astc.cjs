'use strict';
/** Skycity WeChat textures use one GPU format each. Normals are ASTC 4x4; everything else is ASTC 6x6.
 *  wx_astc6_etc2 stays in the project but must not be selected: it packs ASTC and ETC2 together. */
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '../..');
const read = p => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const builder = read('creator-build-project/settings/v2/packages/builder.json');
const presets = builder.textureCompressConfig.userPreset;
function only(id, format) {
  const options = presets[id] && presets[id].options;
  assert(options, id);
  const keys = Object.keys(options);
  assert.deepEqual(keys, ['miniGame'], id + ' platforms');
  assert.deepEqual(Object.keys(options.miniGame), [format], id + ' formats');
  assert(!JSON.stringify(options).includes('etc'), id + ' must not pack ETC');
}
only('wx_astc6x6', 'astc_6x6');
only('wx_astc4x4', 'astc_4x4');
assert(presets.wx_astc6_etc2.options.miniGame.etc2_rgba, 'the old dual preset remains unused, not deleted');

const glb = read('creator-build-project/assets/bundles/region_skycity/env_skycity.glb.meta');
const images = Object.values(glb.subMetas).filter(s => s.importer === 'gltf-embeded-image');
const byName = new Map(images.map(s => [s.name.replace(/\.image$/, ''), s]));
const raw = fs.readFileSync(path.join(root, 'creator-build-project/assets/bundles/region_skycity/env_skycity.glb'));
const jsonLen = raw.readUInt32LE(12);
const gltf = JSON.parse(raw.subarray(20, 20 + jsonLen));
const wanted = gltf.images.map(im => im.name);
assert.equal(wanted.length, 17);
for (const name of wanted) {
  const sub = byName.get(name);
  assert(sub, 'missing compress target ' + name);
  const cs = sub.userData.compressSettings;
  const preset = name.includes('normal') ? 'wx_astc4x4' : 'wx_astc6x6';
  assert.equal(cs.useCompressTexture, true, name);
  assert.equal(cs.presetId, preset, name);
  assert.equal(sub.userData.gltfIndex, gltf.images.findIndex(im => im.name === name), name + ' gltf index');
}
const jpg = read('creator-build-project/assets/bundles/region_skycity/board/bg_skycity_board.jpg.meta');
assert.equal(jpg.userData.compressSettings, undefined, '750x1624 board JPEG stays JPEG; ASTC 6x6 is larger');
for (const banned of ['region_meadow', 'region_island', 'static_seat_preview']) {
  const dir = path.join(root, 'creator-build-project/assets/bundles', banned);
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.meta')) continue;
    const text = fs.readFileSync(path.join(dir, file), 'utf8');
    assert(!text.includes('wx_astc6x6') && !text.includes('wx_astc4x4'), banned + '/' + file);
  }
}
console.log(JSON.stringify({
  status: 'PASS',
  colorPreset: 'wx_astc6x6',
  normalPreset: 'wx_astc4x4',
  images: wanted.length,
  boardJpeg: 'left uncompressed (ASTC 6x6 of 750x1624 is larger than the JPEG)',
  untouched: ['region_meadow', 'region_island', 'static_seat_preview'],
}, null, 2));
