'use strict';
/* 场景特效bot r5 S3 r4c: make a draco primitive's COLOR_0 data agree with its accessor, as UNSIGNED_BYTE normalized.
 * 35e1545d (skycity_foliage_fix.cjs) re-encoded env_sky_static_foliage_cards with COLOR_0 as a FLOAT draco attribute holding 0..65535
 * behind an UNSIGNED_SHORT normalized accessor. A loader that decodes to the accessor type gets the right colour by luck of the cast; one
 * that trusts the draco type gets floats up to 65535. Here the colour is read as the accessor says (u16 normalized: v / 65535), stored as
 * round(v / 65535 * 255) in a UINT8 draco attribute, accessor UNSIGNED_BYTE normalized. Every other attribute is re-added from its decoded
 * values with the source quantisation bits (pos 14, normal 10, uv 12: the Blender glTF defaults used by the export), edgebreaker.
 * The new blob is appended to the BIN chunk with new accessors; old bufferView / accessors stay (unreferenced), as in skycity_foliage_fix.cjs.
 * Usage: node draco_color_u8.cjs <in.glb> <out.glb> <meshName> [<meshName>...]       ES5. DRACO3D as for skycity_foliage_fix.cjs. */
var fs = require('fs'), path = require('path');
var G = require('../camera-frame-test/glb_geometry.cjs');
function readGlb(f) { var b = fs.readFileSync(f), jl = b.readUInt32LE(12); return { j: JSON.parse(b.slice(20, 20 + jl).toString('utf8')), bin: b.slice(28 + jl, 28 + jl + b.readUInt32LE(20 + jl)) }; }
function writeGlb(f, j, bin) {
  var js = Buffer.from(JSON.stringify(j), 'utf8'), jp = (4 - js.length % 4) % 4, bp = (4 - bin.length % 4) % 4;
  js = Buffer.concat([js, Buffer.alloc(jp, 0x20)]); bin = Buffer.concat([bin, Buffer.alloc(bp, 0)]);
  var h = Buffer.alloc(12); h.writeUInt32LE(0x46546C67, 0); h.writeUInt32LE(2, 4); h.writeUInt32LE(28 + js.length + bin.length, 8);
  var c0 = Buffer.alloc(8); c0.writeUInt32LE(js.length, 0); c0.writeUInt32LE(0x4E4F534A, 4);
  var c1 = Buffer.alloc(8); c1.writeUInt32LE(bin.length, 0); c1.writeUInt32LE(0x004E4942, 4);
  fs.writeFileSync(f, Buffer.concat([h, c0, js, c1, bin]));
}
var MAXV = { 5121: 255, 5123: 65535, 5126: 1 }, QBITS = { POSITION: 14, NORMAL: 10, TEXCOORD_0: 12, TEXCOORD_1: 12 };
function run(src, out, names) {
  var r = readGlb(src), j = r.j, bin = r.bin, D3 = require(path.join(G.dracoDir(), 'draco3d.js'));
  return Promise.all([D3.createDecoderModule({}), D3.createEncoderModule({})]).then(function (M) {
    var D = M[0], E = M[1], res = [];
    names.forEach(function (name) {
      var mi = -1; j.meshes.forEach(function (m, i) { if (m.name === name) mi = i; }); if (mi < 0) throw Error('no mesh ' + name);
      j.meshes[mi].primitives.forEach(function (pr, pi) {
        var ext = pr.extensions && pr.extensions.KHR_draco_mesh_compression; if (!ext) throw Error(name + ' prim ' + pi + ' is not draco');
        var cacc = j.accessors[pr.attributes.COLOR_0]; if (!cacc) throw Error(name + ' has no COLOR_0');
        var bv = j.bufferViews[ext.bufferView], data = bin.slice(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength);
        var d = new D.Decoder(), db = new D.DecoderBuffer(), mesh = new D.Mesh(); db.Init(new Int8Array(data.buffer, data.byteOffset, data.byteLength), data.byteLength);
        if (!d.DecodeBufferToMesh(db, mesh).ok()) throw Error('decode failed ' + name);
        var np = mesh.num_points(), nf = mesh.num_faces(), I = new Uint32Array(nf * 3), fa = new D.DracoInt32Array();
        for (var f = 0; f < nf; f++) { d.GetFaceFromMesh(mesh, f, fa); I[f * 3] = fa.GetValue(0); I[f * 3 + 1] = fa.GetValue(1); I[f * 3 + 2] = fa.GetValue(2); }
        var mb = new E.MeshBuilder(), em = new E.Mesh(), enc = new E.Encoder(), ids = {}, before = {};
        mb.AddFacesToMesh(em, nf, I);
        var sem = { POSITION: E.POSITION, NORMAL: E.NORMAL, TEXCOORD_0: E.TEX_COORD, TEXCOORD_1: E.TEX_COORD, COLOR_0: E.COLOR };
        Object.keys(ext.attributes).forEach(function (k) {
          var a = d.GetAttributeByUniqueId(mesh, ext.attributes[k]), c = a.num_components(), arr = new D.DracoFloat32Array(); d.GetAttributeFloatForAllPoints(mesh, a, arr);
          var v = new Float32Array(np * c); for (var i = 0; i < v.length; i++) v[i] = arr.GetValue(i); D.destroy(arr);
          if (sem[k] === undefined) throw Error('unhandled attribute ' + k);
          if (k === 'COLOR_0') {
            var acc = j.accessors[pr.attributes[k]], scale = acc.normalized ? MAXV[acc.componentType] : 1;   // the colour as the accessor says
            if (!scale) throw Error('COLOR_0 accessor type ' + acc.componentType);
            var u = new Uint8Array(v.length); for (var q = 0; q < v.length; q++) u[q] = Math.max(0, Math.min(255, Math.round(v[q] / scale * 255)));
            before[k] = { c: c, v: v, scale: scale }; ids[k] = mb.AddUInt8Attribute(em, sem[k], np, c, u);
          } else { if (a.data_type() !== 9) throw Error(k + ' is not float'); ids[k] = mb.AddFloatAttributeToMesh(em, sem[k], np, c, v); }
        });
        enc.SetAttributeQuantization(E.POSITION, QBITS.POSITION); enc.SetAttributeQuantization(E.NORMAL, QBITS.NORMAL); enc.SetAttributeQuantization(E.TEX_COORD, QBITS.TEXCOORD_0);
        enc.SetEncodingMethod(E.MESH_EDGEBREAKER_ENCODING); enc.SetSpeedOptions(5, 5);
        var da = new E.DracoInt8Array(), len = enc.EncodeMeshToDracoBuffer(em, da); if (!len) throw Error('encode failed');
        var buf = Buffer.alloc(len); for (var k2 = 0; k2 < len; k2++) buf[k2] = da.GetValue(k2); [da, enc, em, mb].forEach(function (o) { E.destroy(o); });
        [fa, mesh, db, d].forEach(function (o) { D.destroy(o); });
        // re-decode: point count, bounds
        var d2 = new D.Decoder(), b2 = new D.DecoderBuffer(), m2 = new D.Mesh(); b2.Init(new Int8Array(buf.buffer, buf.byteOffset, buf.byteLength), buf.byteLength);
        if (!d2.DecodeBufferToMesh(b2, m2).ok()) throw Error('re-decode failed'); var np2 = m2.num_points(), nf2 = m2.num_faces();
        var pa = d2.GetAttributeByUniqueId(m2, ids.POSITION), pv = new D.DracoFloat32Array(); d2.GetAttributeFloatForAllPoints(m2, pa, pv);
        var lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9]; for (var p = 0; p < np2; p++) for (var e = 0; e < 3; e++) { var w = pv.GetValue(p * 3 + e); lo[e] = Math.min(lo[e], w); hi[e] = Math.max(hi[e], w); }
        [pv, m2, b2, d2].forEach(function (o) { D.destroy(o); });
        var pad = (4 - bin.length % 4) % 4, off = bin.length + pad; bin = Buffer.concat([bin, Buffer.alloc(pad, 0), buf]);
        var bvi = j.bufferViews.length; j.bufferViews.push({ buffer: 0, byteOffset: off, byteLength: len });
        var attrs = {};
        Object.keys(pr.attributes).forEach(function (k) { var old = j.accessors[pr.attributes[k]], acc = { componentType: old.componentType, count: np2, type: old.type };
          if (k === 'COLOR_0') { acc.componentType = 5121; acc.normalized = true; } else if (old.normalized) acc.normalized = true;
          if (k === 'POSITION') { acc.min = lo; acc.max = hi; }
          attrs[k] = j.accessors.length; j.accessors.push(acc); });
        var oi = j.accessors[pr.indices], ii = j.accessors.length; j.accessors.push({ componentType: np2 > 65535 ? 5125 : oi.componentType, count: nf2 * 3, type: 'SCALAR' });
        pr.attributes = attrs; pr.indices = ii; pr.extensions.KHR_draco_mesh_compression = { bufferView: bvi, attributes: ids };
        res.push({ mesh: name, prim: pi, points: [np, np2], faces: [nf, nf2], colorFrom: (cacc.normalized ? 'u' + (cacc.componentType === 5123 ? 16 : 8) + 'n' : 'f32') + ' accessor', dracoBytes: [bv.byteLength, len] });
      });
    });
    j.buffers[0].byteLength = bin.length + (4 - bin.length % 4) % 4;
    writeGlb(out, j, bin); var o = { prims: res, bytes: [fs.statSync(src).size, fs.statSync(out).size] }; console.log(JSON.stringify(o, null, 1)); return o;
  });
}
var a = process.argv.slice(2);
if (a.length < 3) { console.error('usage: node draco_color_u8.cjs <in.glb> <out.glb> <meshName>...'); process.exit(2); }
run(a[0], a[1], a.slice(2)).catch(function (e) { console.error(e); process.exit(1); });
