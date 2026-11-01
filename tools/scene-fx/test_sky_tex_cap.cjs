'use strict';
/** r5 S3 fix_r1 1c: the two sky textures stay inside the L3 cap (max side 1024, docs/r5/scene-lod-scale.md) and the GLBs keep
 * every node / mesh / material / texture / sampler / image name (Cocos sub-asset ids). Loose ES5. node tools/scene-fx/test_sky_tex_cap.cjs */
var fs = require('fs'), path = require('path');
var B = path.resolve(__dirname, '../../creator-build-project/assets/bundles');
var checks = [];
function check(name, ok, info) { checks.push({ name: name, ok: !!ok }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (info === undefined ? '' : ' ' + JSON.stringify(info))); }
function glb(f) { var b = fs.readFileSync(f), jl = b.readUInt32LE(12); return { j: JSON.parse(b.slice(20, 20 + jl).toString('utf8')), bin: b.slice(28 + jl, 28 + jl + b.readUInt32LE(20 + jl)) }; }
function imgSize(buf) {
  if (buf.readUInt32BE(0) === 0x89504E47) return { mime: 'image/png', w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  for (var i = 2; i < buf.length - 9;) { if (buf[i] !== 0xFF) return null; var m = buf[i + 1], L = buf.readUInt16BE(i + 2);
    if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) return { mime: 'image/jpeg', h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    i += 2 + L; }
  return null;
}
var CASES = [
  { f: 'region_meadow/env_meadow.glb', img: 'meadow_sky_4096x1024', mat: 'M_meadow_sky', want: [1024, 512], images: 4, mime: 'image/jpeg' },
  { f: 'region_transit_balloon/transit_night_dome.glb', img: 'transit_night_dome_equirect_2048', mat: 'M_transit_night_dome', want: [1024, 512], images: 1, mime: 'image/png' }
];
CASES.forEach(function (c) {
  var G = glb(path.join(B, c.f)), j = G.j, k = -1;
  j.images.forEach(function (im, i) { if (im.name === c.img) k = i; });
  var im = j.images[k], bv = im && j.bufferViews[im.bufferView], data = bv && G.bin.slice(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength), s = data && imgSize(data);
  check(c.f + ' sky-size', s && s.w === c.want[0] && s.h === c.want[1] && Math.max(s.w, s.h) <= 1024 && s.mime === im.mimeType && s.mime === c.mime, s);
  var mat = j.materials.filter(function (m) { return m.name === c.mat; })[0], tex = mat && j.textures[mat.pbrMetallicRoughness.baseColorTexture.index];
  check(c.f + ' material-binding', j.images.length === c.images && tex && tex.source === k && mat.extensions && mat.extensions.KHR_materials_unlit, { images: j.images.length, source: tex && tex.source });
  var smp = tex && j.samplers[tex.sampler]; check(c.f + ' sampler-linear-mip', smp && smp.magFilter === 9729 && smp.minFilter === 9987, smp);
  var ok = true; j.images.forEach(function (x) { var v = j.bufferViews[x.bufferView], d = G.bin.slice(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength), z = imgSize(d); if (!z || Math.max(z.w, z.h) > 1024) ok = false; });
  check(c.f + ' all-images-le-1024', ok);
});
var failed = checks.filter(function (c) { return !c.ok; });
console.log(failed.length ? 'FAILED ' + failed.length + '/' + checks.length : 'ALL PASS sky-tex-cap (' + checks.length + ')');
process.exitCode = failed.length ? 1 : 0;
