'use strict';
/* 场景特效bot r5 S3 r4b: seal the skycity free-cam exposure that 35e1545d (ground the floating grass clumps) re-opened.
 * The floating clumps under the great-tree root arch and past the south rim used to hide (exposure_audit.cjs vs bc81575f):
 *   - the open sky below the rim (void rays: nothing within 400 m)                     -> a far cloud bank + a cloud-sea fill
 *   - the underside (back face) of thin palette surfaces at the root arch / ledges       -> an underside copy 3 cm below each such face
 * Geometry lives in skycity_regression_seal.json (world = glb_geometry.cjs decoder space):
 *   cloudWall  quads [topL, topR, botR, botL]  appended to env_sky_cloudsea (M_sky_cloud): ring segments R 300 (south, az 95..265) and R 260
 *                                            (north, az -95..95), y -150..+2 = the cloud-sea horizon bank
 *   cloudFill  tris                           appended to env_sky_cloudsea: disc y -150, R 330, under the existing cloud sea (fills its holes)
 *   undersideSeal.sourceTris                  env_sky_static_palette faces seen from behind by the regressed poses: each gets a copy
 *                                            offsetM along -normal, wound to face away from it, appended to env_sky_floor_seal (M_sky_palette,
 *                                            uv / colour of the matching source vertices; floor_seal is the b9ccb89c seal mesh)
 * Hanging vine cards were tried and dropped: the game arm only collides with AABBs, so cards under the arch fill the lens.
 * Usage: node skycity_regression_seal.cjs <env_skycity.glb> <out.glb> [spec.json]
 * Each target primitive is re-encoded (old points + new) as one draco blob appended to the BIN chunk with new accessors; every existing
 * bufferView / accessor keeps its bytes and index (the two old views stay, unreferenced). Attribute data types are kept.
 * Refuses a GLB whose target meshes already carry extras.qfRegressionSeal. ES5. DRACO3D as for skycity_foliage_fix.cjs. */
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
function draco() { return require(path.join(G.dracoDir(), 'draco3d.js')); }
function qrot(q, v) { var x = q[0], y = q[1], z = q[2], w = q[3], ix = w * v[0] + y * v[2] - z * v[1], iy = w * v[1] + z * v[0] - x * v[2], iz = w * v[2] + x * v[1] - y * v[0], iw = -x * v[0] - y * v[1] - z * v[2];
  return [ix * w + iw * -x + iy * -z - iz * -y, iy * w + iw * -y + iz * -x - ix * -z, iz * w + iw * -z + ix * -y - iy * -x]; }
function chainOf(j, ni) { var parent = {}; j.nodes.forEach(function (n, i) { (n.children || []).forEach(function (c) { parent[c] = i; }); });
  var chain = []; for (var k = ni; k !== undefined; k = parent[k]) chain.push(j.nodes[k]); return chain; }
function toLocal(chain, v) { var p = v; for (var i = chain.length - 1; i >= 0; i--) { var n = chain[i], s = n.scale || [1, 1, 1], r = n.rotation || [0, 0, 0, 1], t = n.translation || [0, 0, 0];
  p = [p[0] - t[0], p[1] - t[1], p[2] - t[2]]; p = qrot([-r[0], -r[1], -r[2], r[3]], p); p = [p[0] / s[0], p[1] / s[1], p[2] / s[2]]; } return p; }
function toWorld(chain, v) { var p = v; for (var i = 0; i < chain.length; i++) { var n = chain[i], s = n.scale || [1, 1, 1], r = n.rotation || [0, 0, 0, 1], t = n.translation || [0, 0, 0];
  p = qrot(r, [p[0] * s[0], p[1] * s[1], p[2] * s[2]]); p = [p[0] + t[0], p[1] + t[1], p[2] + t[2]]; } return p; }
function dirLocal(chain, v) { var p = v; for (var i = chain.length - 1; i >= 0; i--) { var r = chain[i].rotation || [0, 0, 0, 1]; p = qrot([-r[0], -r[1], -r[2], r[3]], p); } var l = Math.sqrt(p[0] * p[0] + p[1] * p[1] + p[2] * p[2]) || 1; return [p[0] / l, p[1] / l, p[2] / l]; }
function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function unit(a) { var l = Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
var SEM = ['POSITION', 'NORMAL', 'TEXCOORD_0', 'COLOR_0'];
function decodePrim(D, j, bin, name) {
  var mi = -1; j.meshes.forEach(function (m, i) { if (m.name === name) mi = i; }); if (mi < 0) throw Error('no mesh ' + name);
  if ((j.meshes[mi].extras || {}).qfRegressionSeal) throw Error(name + ' already sealed');
  var pr = j.meshes[mi].primitives[0], ext = pr.extensions.KHR_draco_mesh_compression, bv = j.bufferViews[ext.bufferView];
  var data = bin.slice(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength);
  var d = new D.Decoder(), buf = new D.DecoderBuffer(); buf.Init(new Int8Array(data.buffer, data.byteOffset, data.byteLength), data.byteLength);
  var mesh = new D.Mesh(); if (!d.DecodeBufferToMesh(buf, mesh).ok()) throw Error('decode failed ' + name);
  var nv = mesh.num_points(), nf = mesh.num_faces(), out = { mi: mi, nv: nv, nf: nf, attrs: {}, I: [], ext: ext };
  Object.keys(ext.attributes).forEach(function (k) { var a = d.GetAttributeByUniqueId(mesh, ext.attributes[k]), arr = new D.DracoFloat32Array(); d.GetAttributeFloatForAllPoints(mesh, a, arr);
    var c = a.num_components(), v = []; for (var i = 0; i < nv * c; i++) v.push(arr.GetValue(i)); out.attrs[k] = { c: c, v: v, dtype: a.data_type() }; D.destroy(arr); });
  var f = new D.DracoInt32Array(); for (var i = 0; i < nf; i++) { d.GetFaceFromMesh(mesh, i, f); out.I.push(f.GetValue(0), f.GetValue(1), f.GetValue(2)); }
  [f, mesh, buf, d].forEach(function (o) { D.destroy(o); });
  j.nodes.forEach(function (n, i) { if (n.mesh === mi) out.node = i; }); out.chain = chainOf(j, out.node); return out;
}
function push(P, pos, nrm, uv, col) { var A = P.attrs; P.chainPos = P.chainPos || 0;
  var l = toLocal(P.chain, pos), n = dirLocal(P.chain, nrm); A.POSITION.v.push(l[0], l[1], l[2]); A.NORMAL.v.push(n[0], n[1], n[2]); A.TEXCOORD_0.v.push(uv[0], uv[1]);
  for (var e = 0; e < A.COLOR_0.c; e++) A.COLOR_0.v.push(col[e]); return P.nv++; }
function seal(src, out, specPath) {
  var spec = JSON.parse(fs.readFileSync(specPath || path.join(__dirname, 'skycity_regression_seal.json'), 'utf8')), r = readGlb(src);
  return Promise.all([draco().createDecoderModule({}), draco().createEncoderModule({})]).then(function (M) {
    var D = M[0], E = M[1], C = decodePrim(D, r.j, r.bin, 'env_sky_cloudsea'), F = decodePrim(D, r.j, r.bin, 'env_sky_floor_seal'), S = decodePrim(D, r.j, r.bin, 'env_sky_static_palette');
    var add = { cloud: [C.nv, C.nf], seal: [F.nv, F.nf] };
    function quad(P, q, n, uvs, cols) { var b = P.nv, w = cross(sub(q[1], q[0]), sub(q[3], q[0])), same = w[0] * n[0] + w[1] * n[1] + w[2] * n[2] >= 0;
      for (var i = 0; i < 4; i++) push(P, q[i], n, uvs[i], cols[i]);
      if (same) P.I.push(b, b + 1, b + 3, b + 1, b + 2, b + 3); else P.I.push(b, b + 3, b + 1, b + 1, b + 3, b + 2); }
    // source palette vertices in world space, hashed on 5 cm cells
    var SW = {}, SP = S.attrs.POSITION.v; for (var v = 0; v < S.nv; v++) { var w = toWorld(S.chain, [SP[v * 3], SP[v * 3 + 1], SP[v * 3 + 2]]), k = w.map(function (x) { return Math.round(x * 20); }).join(',');
      (SW[k] = SW[k] || []).push({ v: v, w: w }); }
    function srcVert(p) { var best = null, bd = 1e9, c = p.map(function (x) { return Math.round(x * 20); });
      for (var dx = -1; dx <= 1; dx++) for (var dy = -1; dy <= 1; dy++) for (var dz = -1; dz <= 1; dz++) { var L = SW[(c[0] + dx) + ',' + (c[1] + dy) + ',' + (c[2] + dz)]; if (!L) continue;
        L.forEach(function (o) { var d = Math.hypot(o.w[0] - p[0], o.w[1] - p[1], o.w[2] - p[2]); if (d < bd) { bd = d; best = o.v; } }); }
      if (bd > 0.02) throw Error('no palette vertex at ' + p.join(',')); return best; }
    var off = spec.undersideSeal.offsetM, A = S.attrs, sealed = 0;
    spec.undersideSeal.sourceTris.forEach(function (t) { var n = unit(cross(sub(t[1], t[0]), sub(t[2], t[0]))), m = [-n[0], -n[1], -n[2]], b = F.nv;
      [0, 2, 1].forEach(function (i) { var sv = srcVert(t[i]), q = [t[i][0] - n[0] * off, t[i][1] - n[1] * off, t[i][2] - n[2] * off];
        push(F, q, m, [A.TEXCOORD_0.v[sv * 2], A.TEXCOORD_0.v[sv * 2 + 1]], A.COLOR_0.v.slice(sv * A.COLOR_0.c, sv * A.COLOR_0.c + A.COLOR_0.c)); });
      F.I.push(b, b + 1, b + 2); sealed++; });
    var cTop = [0.95, 0.955, 0.94], cBot = [0.72, 0.80, 0.86], cFill = [0.80, 0.86, 0.89], uvC = [C.attrs.TEXCOORD_0.v[0], C.attrs.TEXCOORD_0.v[1]];
    spec.cloudWall.forEach(function (q) { var mid = [(q[0][0] + q[2][0]) / 2, 0, (q[0][2] + q[2][2]) / 2], n = unit([-mid[0], 0, -mid[2]]);   // faces the island
      quad(C, q, n, [uvC, uvC, uvC, uvC], [cTop, cTop, cBot, cBot]); });
    spec.cloudFill.forEach(function (t) { var b = C.nv; for (var i = 0; i < 3; i++) push(C, t[i], [0, 1, 0], uvC, cFill);
      var fn = cross(sub(t[1], t[0]), sub(t[2], t[0])); if (fn[1] >= 0) C.I.push(b, b + 1, b + 2); else C.I.push(b, b + 2, b + 1); });
    var j = r.j, bin = r.bin, res = { undersideSeal: sealed, cloudWallQuads: spec.cloudWall.length, cloudFillTris: spec.cloudFill.length };
    [['cloud', C], ['seal', F]].forEach(function (pair) { var P = pair[1];
      var mb = new E.MeshBuilder(), mesh = new E.Mesh(), enc = new E.Encoder(); mb.AddFacesToMesh(mesh, P.I.length / 3, new Uint32Array(P.I));
      var sem = { POSITION: E.POSITION, NORMAL: E.NORMAL, TEXCOORD_0: E.TEX_COORD, COLOR_0: E.COLOR }, ids = {};
      SEM.forEach(function (k) { var a = P.attrs[k];
        if (a.dtype === 4) { var u = new Uint16Array(a.v.length); for (var q = 0; q < u.length; q++) u[q] = Math.max(0, Math.min(65535, Math.round(a.v[q]))); ids[k] = mb.AddUInt16Attribute(mesh, sem[k], P.nv, a.c, u); }
        else if (a.dtype === 9) ids[k] = mb.AddFloatAttributeToMesh(mesh, sem[k], P.nv, a.c, new Float32Array(a.v));
        else throw Error('unexpected draco dtype ' + a.dtype + ' ' + k); });
      enc.SetAttributeQuantization(E.POSITION, 14); enc.SetAttributeQuantization(E.NORMAL, 10); enc.SetAttributeQuantization(E.TEX_COORD, 12); enc.SetAttributeQuantization(E.COLOR, 10);
      enc.SetEncodingMethod(E.MESH_EDGEBREAKER_ENCODING); enc.SetSpeedOptions(5, 5);
      var da = new E.DracoInt8Array(), len = enc.EncodeMeshToDracoBuffer(mesh, da); if (!len) throw Error('encode failed');
      var buf = Buffer.alloc(len); for (var k = 0; k < len; k++) buf[k] = da.GetValue(k); [da, enc, mesh, mb].forEach(function (o) { E.destroy(o); });
      // the encoder merges identical points: the accessors must carry the decoded point count / bounds
      var dd = new D.Decoder(), db = new D.DecoderBuffer(), dm = new D.Mesh(); db.Init(new Int8Array(buf.buffer, buf.byteOffset, buf.byteLength), buf.byteLength);
      if (!dd.DecodeBufferToMesh(db, dm).ok()) throw Error('re-decode failed'); var np = dm.num_points(), nfo = dm.num_faces(), pa = dd.GetAttributeByUniqueId(dm, ids.POSITION), pv = new D.DracoFloat32Array();
      dd.GetAttributeFloatForAllPoints(dm, pa, pv); var lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9]; for (var q0 = 0; q0 < np; q0++) for (var e0 = 0; e0 < 3; e0++) { var w0 = pv.GetValue(q0 * 3 + e0); lo[e0] = Math.min(lo[e0], w0); hi[e0] = Math.max(hi[e0], w0); }
      [pv, dm, db, dd].forEach(function (o) { D.destroy(o); }); var dropped = P.I.length / 3 - nfo;   // the encoder drops faces that are degenerate after quantisation
      var pad = (4 - bin.length % 4) % 4, off = bin.length + pad; bin = Buffer.concat([bin, Buffer.alloc(pad, 0), buf]);
      var bvi = j.bufferViews.length; j.bufferViews.push({ buffer: 0, byteOffset: off, byteLength: len });
      var m = j.meshes[P.mi], pr = m.primitives[0], attrs = {};
      SEM.forEach(function (k) { var old = j.accessors[pr.attributes[k]], acc = { componentType: old.componentType, count: np, type: old.type };
        if (old.normalized) acc.normalized = old.normalized;
        if (k === 'POSITION') { acc.min = lo; acc.max = hi; }
        attrs[k] = j.accessors.length; j.accessors.push(acc); });
      var oi = j.accessors[pr.indices], ii = j.accessors.length; j.accessors.push({ componentType: np > 65535 ? 5125 : oi.componentType, count: nfo * 3, type: 'SCALAR' });
      pr.attributes = attrs; pr.indices = ii; pr.extensions.KHR_draco_mesh_compression = { bufferView: bvi, attributes: ids };
      m.extras = m.extras || {}; m.extras.qfRegressionSeal = 1;
      res[pair[0]] = { mesh: m.name, verts: [add[pair[0]][0], np], tris: [add[pair[0]][1], nfo], degenerateDropped: dropped, dracoBytes: len }; });
    j.buffers[0].byteLength = bin.length + (4 - bin.length % 4) % 4;
    writeGlb(out, j, bin); res.bytes = [fs.statSync(src).size, fs.statSync(out).size]; console.log(JSON.stringify(res, null, 1)); return res; }); }
var a = process.argv.slice(2);
if (a.length < 2) { console.error('usage: node skycity_regression_seal.cjs <env_skycity.glb> <out.glb> [spec.json]'); process.exit(2); }
seal(a[0], a[1], a[2]).catch(function (e) { console.error(e); process.exit(1); });
