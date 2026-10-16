'use strict';
/** Skycity GLB images use the existing project preset wx_astc6_etc2.
 *  Creator 3.8.8 UserCompressConfig.userPreset stores each format as { quality },
 *  not a bare string (a string has no .quality, so astcenc is invoked as -undefined).
 *  ASTC quality is IASTCQuality; ETC2 quality is IETCQuality (texture-compress.d.ts).
 *  Sub-asset ids are asset-db nameToId(name) so a reimport keeps compressSettings. */
const assert = require('node:assert/strict'), crypto = require('node:crypto'), fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '../..');
const read = p => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
function nameToId(name) {
  const hex = crypto.createHash('md5').update(name).digest('hex');
  return hex[0] + hex[6] + hex[16] + hex[25] + hex[31];
}
const ASTC = new Set(['veryfast', 'fast', 'medium', 'thorough', 'exhaustive']);
const ETC = new Set(['slow', 'fast']);
const builder = read('creator-build-project/settings/v2/packages/builder.json');
const presets = builder.textureCompressConfig.userPreset;
assert.equal(presets.wx_astc6x6, undefined, 'do not add a separate astc_6x6 preset');
assert.equal(presets.wx_astc4x4, undefined, 'do not add a separate astc_4x4 preset');
const preset = presets.wx_astc6_etc2;
assert.equal(preset.name, 'wx_astc6_etc2');
for (const platform of Object.keys(preset.options)) {
  const formats = preset.options[platform];
  for (const [format, value] of Object.entries(formats)) {
    assert.equal(typeof value, 'object', format + ' quality must be an object');
    assert.ok(value && Object.prototype.hasOwnProperty.call(value, 'quality'), format);
    assert.equal(typeof value.quality === 'string' || typeof value.quality === 'number', true, format);
    if (format.startsWith('astc_')) assert.ok(ASTC.has(value.quality), format + ' ' + value.quality);
    if (format.startsWith('etc')) assert.ok(ETC.has(value.quality), format + ' ' + value.quality);
  }
}
assert.equal(preset.options.miniGame.astc_6x6.quality, 'medium');
assert.equal(preset.options.miniGame.etc2_rgba.quality, 'slow');

const glb = read('creator-build-project/assets/bundles/region_skycity/env_skycity.glb.meta');
const parent = glb.uuid;
const images = Object.values(glb.subMetas).filter(s => s.importer === 'gltf-embeded-image');
const byName = new Map(images.map(s => [s.name.replace(/\.image$/, ''), s]));
const raw = fs.readFileSync(path.join(root, 'creator-build-project/assets/bundles/region_skycity/env_skycity.glb'));
const gltf = JSON.parse(raw.subarray(20, 20 + raw.readUInt32LE(12)));
const wanted = gltf.images.map(im => im.name);
assert.equal(wanted.length, 17, 'GLB image count');
assert.equal(images.length, 17, 'stale unmatched image sub-assets must not remain');
for (const name of wanted) {
  const sub = byName.get(name);
  assert(sub, 'missing compress target ' + name);
  assert.equal(sub.id, nameToId(name + '.image'), name + ' sub-asset id');
  assert.equal(sub.uuid, parent + '@' + sub.id, name);
  const cs = sub.userData.compressSettings;
  assert.equal(cs.useCompressTexture, true, name);
  assert.equal(cs.presetId, 'wx_astc6_etc2', name);
  assert.equal(sub.userData.gltfIndex, gltf.images.findIndex(im => im.name === name), name + ' gltf index');
  assert.equal(sub.userData.legacyUnmatchedImage, undefined, name);
}
const metas = glb.userData.imageMetas;
assert.deepEqual(metas.map(m => m.name), wanted);
for (const row of metas) assert.equal(row.uri, parent + '@' + nameToId(row.name + '.image'), row.name);
const jpg = read('creator-build-project/assets/bundles/region_skycity/board/bg_skycity_board.jpg.meta');
assert.equal(jpg.userData.compressSettings, undefined, '750x1624 board JPEG stays JPEG; ASTC 6x6 plus ETC2 is larger');
for (const banned of ['region_meadow', 'region_island', 'static_seat_preview']) {
  const dir = path.join(root, 'creator-build-project/assets/bundles', banned);
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.meta')) continue;
    const text = fs.readFileSync(path.join(dir, file), 'utf8');
    assert(!text.includes('wx_astc6_etc2') && !text.includes('wx_astc6x6') && !text.includes('wx_astc4x4'), banned + '/' + file);
  }
}
console.log(JSON.stringify({
  status: 'PASS',
  preset: 'wx_astc6_etc2',
  quality: preset.options.miniGame,
  glbImages: wanted.length,
  skycityImages: wanted.length + 1,
  presets: images.length,
  id: 'nameToId',
  boardJpeg: 'left uncompressed',
  untouched: ['region_meadow', 'region_island', 'static_seat_preview'],
}, null, 2));
