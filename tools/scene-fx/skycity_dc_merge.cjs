'use strict';
/* b15 (场景特效bot): skycity draw-call merge, look-preserving (asset tool, not shipped).
 *   node skycity_dc_merge.cjs <in env_skycity.glb> <out.glb>
 * 1) STATIC: env_sky_floor_seal (M_sky_palette, identity under skycity_float_root, no own animation, never toggled) is
 *    appended to env_sky_ruins' M_sky_palette primitive (same parent, same identity transform, same material).
 *    The ruins' M_sky_palette_emissive primitive keeps its original bytes. Node env_sky_floor_seal is removed.
 * 2) SKIN: small M_sky_palette props that each carry their OWN sky_ambient_loop channel are folded into one skinned mesh
 *    per group; every original node stays (same name/TRS/animation channel) and becomes a JOINT, each vertex weighted 1.0
 *    to its old node, inverseBind = inverse(rest world). So the clip, SkycityPennantWind, ExploreInput pulse etc. still
 *    drive exactly what they drove: jointWorld(t)*inverse(restWorld)*restWorldVertex = nodeWorld(t)*localVertex.
 *    Groups are split by what the ride code toggles: ropes (CITY_RIDE_HIDE) apart from the always-on props.
 * Unreferenced accessors / bufferViews are dropped and the BIN chunk repacked. draco3d from $DRACO3D. */
var fs = require('fs'), path = require('path');
var G = require('../camera-frame-test/glb_geometry.cjs');
var GROUPS = {
  env_sky_rope_roots_skin: ['env_sky_rope_root_01', 'env_sky_rope_root_02', 'env_sky_rope_root_03', 'env_sky_rope_root_04',
    'env_sky_rope_root_05', 'env_sky_rope_root_06', 'env_sky_rope_root_07', 'env_sky_rope_root_08'],
  env_sky_ambient_props_skin: ['env_sky_pennant_01', 'env_sky_pennant_02', 'env_sky_birds']
};
/* STATIC merge OFF (b15 test result): env_sky_floor_seal is a named terrain mesh (test_region_nodes_data) and the region-node
 * bake treats env_sky_ruins as floor/solid, so folding the seal into the ruins drifts the baked grid. env_sky_windchime_01 is a
 * named solid in bake-region-nodes.cjs, so it stays its own mesh too. */
var STATIC_INTO = 'env_sky_ruins', STATIC_FROM = [];
function readGlb(f) { var b = fs.readFileSync(f), jl = b.readUInt32LE(12); return { j: JSON.parse(b.slice(20, 20 + jl).toString('utf8')), bin: b.slice(28 + jl, 28 + jl + b.readUInt32LE(20 + jl)) }; }
function writeGlb(f, j, bin) {
  var js = Buffer.from(JSON.stringify(j), 'utf8'); js = Buffer.concat([js, Buffer.alloc((4 - js.length % 4) % 4, 0x20)]); bin = Buffer.concat([bin, Buffer.alloc((4 - bin.length % 4) % 4, 0)]);
  var h = Buffer.alloc(12); h.writeUInt32LE(0x46546C67, 0); h.writeUInt32LE(2, 4); h.writeUInt32LE(28 + js.length + bin.length, 8);
  var c0 = Buffer.alloc(8); c0.writeUInt32LE(js.length, 0); c0.writeUInt32LE(0x4E4F534A, 4); var c1 = Buffer.alloc(8); c1.writeUInt32LE(bin.length, 0); c1.writeUInt32LE(0x004E4942, 4);
  fs.writeFileSync(f, Buffer.concat([h, c0, js, c1, bin]));
}
// ---- math (column-major 4x4)
function trs(n) {
  var t = n.translation || [0, 0, 0], q = n.rotation || [0, 0, 0, 1], s = n.scale || [1, 1, 1], x = q[0], y = q[1], z = q[2], w = q[3];
  return [(1 - 2 * (y * y + z * z)) * s[0], (2 * (x * y + z * w)) * s[0], (2 * (x * z - y * w)) * s[0], 0,
    (2 * (x * y - z * w)) * s[1], (1 - 2 * (x * x + z * z)) * s[1], (2 * (y * z + x * w)) * s[1], 0,
    (2 * (x * z + y * w)) * s[2], (2 * (y * z - x * w)) * s[2], (1 - 2 * (x * x + y * y)) * s[2], 0, t[0], t[1], t[2], 1];
}
function mul(a, b) { var o = new Array(16); for (var c = 0; c < 4; c++) for (var r = 0; r < 4; r++) { var v = 0; for (var k = 0; k < 4; k++) v += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = v; } return o; }
function inv(m) { // affine inverse
  var a = m, det = a[0] * (a[5] * a[10] - a[9] * a[6]) - a[4] * (a[1] * a[10] - a[9] * a[2]) + a[8] * (a[1] * a[6] - a[5] * a[2]), d = 1 / det;
  var r = [(a[5] * a[10] - a[6] * a[9]) * d, (a[2] * a[9] - a[1] * a[10]) * d, (a[1] * a[6] - a[2] * a[5]) * d, 0,
    (a[6] * a[8] - a[4] * a[10]) * d, (a[0] * a[10] - a[2] * a[8]) * d, (a[2] * a[4] - a[0] * a[6]) * d, 0,
    (a[4] * a[9] - a[5] * a[8]) * d, (a[1] * a[8] - a[0] * a[9]) * d, (a[0] * a[5] - a[1] * a[4]) * d, 0, 0, 0, 0, 1];
  r[12] = -(r[0] * a[12] + r[4] * a[13] + r[8] * a[14]); r[13] = -(r[1] * a[12] + r[5] * a[13] + r[9] * a[14]); r[14] = -(r[2] * a[12] + r[6] * a[13] + r[10] * a[14]); return r;
}
function xp(m, x, y, z) { return [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]]; }
function xn(m, x, y, z) { var v = [m[0] * x + m[4] * y + m[8] * z, m[1] * x + m[5] * y + m[9] * z, m[2] * x + m[6] * y + m[10] * z], l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
// ---- draco
function decodePrim(D, j, bin, p) {
  var ext = p.extensions.KHR_draco_mesh_compression, bv = j.bufferViews[ext.bufferView], data = new Int8Array(bin.buffer, bin.byteOffset + (bv.byteOffset || 0), bv.byteLength);
  var buf = new D.DecoderBuffer(); buf.Init(data, data.length); var dec = new D.Decoder(), mesh = new D.Mesh(), st = dec.DecodeBufferToMesh(buf, mesh); if (!st.ok()) throw Error(st.error_msg());
  var np = mesh.num_points(), nf = mesh.num_faces(), out = { np: np };
  function attr(id, n, u8) { var a = dec.GetAttributeByUniqueId(mesh, id), arr = u8 ? new D.DracoUInt8Array() : new D.DracoFloat32Array();
    if (u8) dec.GetAttributeUInt8ForAllPoints(mesh, a, arr); else dec.GetAttributeFloatForAllPoints(mesh, a, arr);
    var r = u8 ? new Uint8Array(np * n) : new Float32Array(np * n); for (var i = 0; i < np * n; i++) r[i] = arr.GetValue(i); D.destroy(arr); return r; }
  out.P = attr(ext.attributes.POSITION, 3); out.N = attr(ext.attributes.NORMAL, 3); out.T = attr(ext.attributes.TEXCOORD_0, 2); out.C = attr(ext.attributes.COLOR_0, 4, true);
  var ia = null; out.I = new Uint32Array(nf * 3);
  // portable path: per-face
  var fa = new D.DracoInt32Array(); for (var f = 0; f < nf; f++) { dec.GetFaceFromMesh(mesh, f, fa); out.I[f * 3] = fa.GetValue(0); out.I[f * 3 + 1] = fa.GetValue(1); out.I[f * 3 + 2] = fa.GetValue(2); }
  D.destroy(fa); D.destroy(mesh); D.destroy(dec); D.destroy(buf); return out;
}
function encodePrim(E, g) {
  var nv = g.P.length / 3, nf = g.I.length / 3, mb = new E.MeshBuilder(), mesh = new E.Mesh(), enc = new E.Encoder();
  mb.AddFacesToMesh(mesh, nf, g.I);
  var ids = { POSITION: mb.AddFloatAttributeToMesh(mesh, E.POSITION, nv, 3, g.P), NORMAL: mb.AddFloatAttributeToMesh(mesh, E.NORMAL, nv, 3, g.N),
    TEXCOORD_0: mb.AddFloatAttributeToMesh(mesh, E.TEX_COORD, nv, 2, g.T), COLOR_0: mb.AddUInt8Attribute(mesh, E.COLOR, nv, 4, g.C) };
  if (mb.SetNormalizedFlagForAttribute) mb.SetNormalizedFlagForAttribute(mesh, ids.COLOR_0, true);
  enc.SetAttributeQuantization(E.POSITION, 16); enc.SetAttributeQuantization(E.NORMAL, 12); enc.SetAttributeQuantization(E.TEX_COORD, 14);
  enc.SetEncodingMethod(E.MESH_EDGEBREAKER_ENCODING); enc.SetSpeedOptions(5, 5);
  var da = new E.DracoInt8Array(), len = enc.EncodeMeshToDracoBuffer(mesh, da); if (!len) throw Error('encode failed');
  var b = Buffer.alloc(len); for (var k = 0; k < len; k++) b[k] = da.GetValue(k) & 255; E.destroy(da); E.destroy(enc); E.destroy(mesh); E.destroy(mb);
  return { data: b, ids: ids, nv: nv };
}
function mm(a, c) { var lo = [], hi = []; for (var q = 0; q < c; q++) { lo.push(Infinity); hi.push(-Infinity); } for (var i = 0; i < a.length; i++) { var k = i % c; if (a[i] < lo[k]) lo[k] = a[i]; if (a[i] > hi[k]) hi[k] = a[i]; } return [lo, hi]; }
async function main(src, out) {
  var r = readGlb(src), j = r.j, bin = r.bin, dir = G.dracoDir(), d3 = require(path.join(dir, 'draco3d.js'));
  var D = await d3.createDecoderModule({}), E = await d3.createEncoderModule({});
  var byName = {}; j.nodes.forEach(function (n, i) { byName[n.name] = i; });
  var parent = {}; j.nodes.forEach(function (n, i) { (n.children || []).forEach(function (c) { parent[c] = i; }); });
  function world(i) { var m = trs(j.nodes[i]); for (var k = parent[i]; k !== undefined; k = parent[k]) m = mul(trs(j.nodes[k]), m); return m; }
  var palette = -1; j.materials.forEach(function (m, i) { if (m.name === 'M_sky_palette') palette = i; });
  var extra = [], report = { static: {}, skins: {} };
  function addBV(buf, target) { var off = bin.length + extra.reduce(function (s, b) { return s + b.length; }, 0), pad = (4 - off % 4) % 4; if (pad) { extra.push(Buffer.alloc(pad)); off += pad; }
    extra.push(buf); j.bufferViews.push(target ? { buffer: 0, byteOffset: off, byteLength: buf.length, target: target } : { buffer: 0, byteOffset: off, byteLength: buf.length }); return j.bufferViews.length - 1; }
  function addAcc(arr, ct, type, n, extraProps) { var a = { componentType: ct, count: n, type: type }; for (var k in extraProps) a[k] = extraProps[k]; j.accessors.push(a); return j.accessors.length - 1; }
  // ---- 1) static merge
  var removeNodes = [];
  if (STATIC_FROM.length) {
  var into = j.nodes[byName[STATIC_INTO]], im = j.meshes[into.mesh], ip = im.primitives.filter(function (p) { return p.material === palette; })[0];
  var parts = [decodePrim(D, j, bin, ip)], nt0 = parts[0].I.length / 3;
  STATIC_FROM.forEach(function (nm) { var n = j.nodes[byName[nm]]; if (trs(n).some(function (v, k) { return Math.abs(v - [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1][k]) > 1e-9; }) || parent[byName[nm]] !== parent[byName[STATIC_INTO]]) throw Error(nm + ' transform differs');
    j.meshes[n.mesh].primitives.forEach(function (p) { if (p.material !== palette) throw Error('material'); parts.push(decodePrim(D, j, bin, p)); }); });
  var tv = 0, ti = 0; parts.forEach(function (g) { tv += g.np; ti += g.I.length; });
  var M = { P: new Float32Array(tv * 3), N: new Float32Array(tv * 3), T: new Float32Array(tv * 2), C: new Uint8Array(tv * 4), I: new Uint32Array(ti) }, vo = 0, io = 0;
  parts.forEach(function (g) { M.P.set(g.P, vo * 3); M.N.set(g.N, vo * 3); M.T.set(g.T, vo * 2); M.C.set(g.C, vo * 4); for (var k = 0; k < g.I.length; k++) M.I[io + k] = g.I[k] + vo; vo += g.np; io += g.I.length; });
  var enc = encodePrim(E, M), pm = mm(M.P, 3), bvi = addBV(enc.data);
  var a0 = addAcc(null, 5126, 'VEC3', enc.nv, { min: pm[0], max: pm[1] }); addAcc(null, 5126, 'VEC3', enc.nv); addAcc(null, 5126, 'VEC2', enc.nv); addAcc(null, 5121, 'VEC4', enc.nv, { normalized: true });
  var aI = addAcc(null, tv > 65535 ? 5125 : 5123, 'SCALAR', ti);
  im.primitives[im.primitives.indexOf(ip)] = { attributes: { POSITION: a0, NORMAL: a0 + 1, TEXCOORD_0: a0 + 2, COLOR_0: a0 + 3 }, indices: aI, material: palette, mode: 4,
    extensions: { KHR_draco_mesh_compression: { bufferView: bvi, attributes: enc.ids } } };
  report.static = { into: STATIC_INTO, from: STATIC_FROM, tris: ti / 3, trisRuinsPalette: nt0, verts: tv };
  removeNodes = STATIC_FROM.map(function (nm) { return byName[nm]; });
  }
  // ---- 2) skins
  Object.keys(GROUPS).forEach(function (gname) {
    var names = GROUPS[gname], P = [], N = [], T = [], C = [], J = [], W = [], I = [], ibm = [], joints = [], base = 0;
    names.forEach(function (nm, ji) { var ni = byName[nm], n = j.nodes[ni]; if (n.mesh === undefined) throw Error(nm + ' no mesh');
      var Wm = world(ni); joints.push(ni); ibm.push(inv(Wm));
      j.meshes[n.mesh].primitives.forEach(function (p) { if (p.material !== palette) throw Error(nm + ' material');
        var g = decodePrim(D, j, bin, p);
        for (var v = 0; v < g.np; v++) { var q = xp(Wm, g.P[v * 3], g.P[v * 3 + 1], g.P[v * 3 + 2]), nn = xn(Wm, g.N[v * 3], g.N[v * 3 + 1], g.N[v * 3 + 2]);
          P.push(q[0], q[1], q[2]); N.push(nn[0], nn[1], nn[2]); T.push(g.T[v * 2], g.T[v * 2 + 1]); C.push(g.C[v * 4], g.C[v * 4 + 1], g.C[v * 4 + 2], g.C[v * 4 + 3]); J.push(ji, 0, 0, 0); W.push(1, 0, 0, 0); }
        for (var k = 0; k < g.I.length; k++) I.push(g.I[k] + base); base += g.np; });
      delete n.mesh; });
    var nv = P.length / 3, pmm = mm(P, 3);
    // draco like every other skycity primitive (the QA decoders, tools/camera-frame-test/glb_geometry.cjs, only read draco)
    var mb = new E.MeshBuilder(), dm = new E.Mesh(), en = new E.Encoder();
    mb.AddFacesToMesh(dm, I.length / 3, new Uint32Array(I));
    var sid = { POSITION: mb.AddFloatAttributeToMesh(dm, E.POSITION, nv, 3, new Float32Array(P)), NORMAL: mb.AddFloatAttributeToMesh(dm, E.NORMAL, nv, 3, new Float32Array(N)),
      TEXCOORD_0: mb.AddFloatAttributeToMesh(dm, E.TEX_COORD, nv, 2, new Float32Array(T)), COLOR_0: mb.AddUInt8Attribute(dm, E.COLOR, nv, 4, new Uint8Array(C)),
      JOINTS_0: mb.AddUInt8Attribute(dm, E.GENERIC, nv, 4, new Uint8Array(J)), WEIGHTS_0: mb.AddFloatAttributeToMesh(dm, E.GENERIC, nv, 4, new Float32Array(W)) };
    if (mb.SetNormalizedFlagForAttribute) mb.SetNormalizedFlagForAttribute(dm, sid.COLOR_0, true);
    en.SetAttributeQuantization(E.POSITION, 16); en.SetAttributeQuantization(E.NORMAL, 12); en.SetAttributeQuantization(E.TEX_COORD, 14);
    en.SetEncodingMethod(E.MESH_EDGEBREAKER_ENCODING); en.SetSpeedOptions(5, 5);
    var dda = new E.DracoInt8Array(), dl = en.EncodeMeshToDracoBuffer(dm, dda); if (!dl) throw Error('encode failed');
    var db = Buffer.alloc(dl); for (var k2 = 0; k2 < dl; k2++) db[k2] = dda.GetValue(k2) & 255; E.destroy(dda); E.destroy(en); E.destroy(dm); E.destroy(mb);
    var dbv = addBV(db);
    var aP = addAcc(null, 5126, 'VEC3', nv, { min: pmm[0], max: pmm[1] }), aN = addAcc(null, 5126, 'VEC3', nv), aT = addAcc(null, 5126, 'VEC2', nv),
      aC = addAcc(null, 5121, 'VEC4', nv, { normalized: true }), aJ = addAcc(null, 5121, 'VEC4', nv), aW = addAcc(null, 5126, 'VEC4', nv), aI2 = addAcc(null, 5123, 'SCALAR', I.length);
    var ib = []; ibm.forEach(function (m) { ib.push.apply(ib, m); });
    var aB = addAcc(null, 5126, 'MAT4', ibm.length, { bufferView: addBV(Buffer.from(new Float32Array(ib).buffer)) });
    j.meshes.push({ name: gname, primitives: [{ attributes: { POSITION: aP, NORMAL: aN, TEXCOORD_0: aT, COLOR_0: aC, JOINTS_0: aJ, WEIGHTS_0: aW }, indices: aI2, material: palette, mode: 4, extensions: { KHR_draco_mesh_compression: { bufferView: dbv, attributes: sid } } }] });
    j.skins = j.skins || []; j.skins.push({ name: gname, joints: joints, inverseBindMatrices: aB, skeleton: byName.skycity_float_root });
    j.nodes.push({ name: gname, mesh: j.meshes.length - 1, skin: j.skins.length - 1 }); j.scenes[0].nodes.push(j.nodes.length - 1);
    report.skins[gname] = { joints: names, verts: nv, tris: I.length / 3 };
  });
  // ---- remove nodes (remap indices)
  removeNodes.sort(function (a, b) { return b - a; }).forEach(function (ri) {
    var fix = function (i) { return i > ri ? i - 1 : i; };
    j.nodes.splice(ri, 1);
    j.nodes.forEach(function (n) { if (n.children) n.children = n.children.filter(function (c) { return c !== ri; }).map(fix); });
    j.scenes.forEach(function (s) { s.nodes = s.nodes.filter(function (c) { return c !== ri; }).map(fix); });
    (j.skins || []).forEach(function (s) { s.joints = s.joints.map(fix); if (s.skeleton !== undefined) s.skeleton = fix(s.skeleton); });
    (j.animations || []).forEach(function (a) { a.channels.forEach(function (c) { if (c.target.node === ri) throw Error('animated removed node'); c.target.node = fix(c.target.node); }); });
  });
  // ---- GC meshes, accessors, bufferViews; repack
  var usedMesh = {}; j.nodes.forEach(function (n) { if (n.mesh !== undefined) usedMesh[n.mesh] = 1; });
  var meshMap = {}, meshes = []; j.meshes.forEach(function (m, i) { if (usedMesh[i]) { meshMap[i] = meshes.length; meshes.push(m); } }); j.meshes = meshes; j.nodes.forEach(function (n) { if (n.mesh !== undefined) n.mesh = meshMap[n.mesh]; });
  var usedAcc = {}, usedBV = {};
  j.meshes.forEach(function (m) { m.primitives.forEach(function (p) { for (var k in p.attributes) usedAcc[p.attributes[k]] = 1; if (p.indices !== undefined) usedAcc[p.indices] = 1; if (p.extensions && p.extensions.KHR_draco_mesh_compression) usedBV[p.extensions.KHR_draco_mesh_compression.bufferView] = 1; (p.targets || []).forEach(function (t) { for (var k2 in t) usedAcc[t[k2]] = 1; }); }); });
  (j.skins || []).forEach(function (s) { if (s.inverseBindMatrices !== undefined) usedAcc[s.inverseBindMatrices] = 1; });
  (j.animations || []).forEach(function (a) { a.samplers.forEach(function (s) { usedAcc[s.input] = 1; usedAcc[s.output] = 1; }); });
  var accMap = {}, accs = []; j.accessors.forEach(function (a, i) { if (usedAcc[i]) { accMap[i] = accs.length; accs.push(a); if (a.bufferView !== undefined) usedBV[a.bufferView] = 1; } });
  (j.images || []).forEach(function (im2) { if (im2.bufferView !== undefined) usedBV[im2.bufferView] = 1; });
  var all = Buffer.concat([bin].concat(extra)), parts2 = [], off = 0, bvMap = {}, bvs = [];
  j.bufferViews.forEach(function (bv, i) { if (!usedBV[i]) return; var pad = (4 - off % 4) % 4; if (pad) { parts2.push(Buffer.alloc(pad)); off += pad; }
    var s = all.slice(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength); parts2.push(s); var nb = {}; for (var k in bv) nb[k] = bv[k]; nb.byteOffset = off; off += s.length; bvMap[i] = bvs.length; bvs.push(nb); });
  j.bufferViews = bvs; j.accessors = accs;
  j.accessors.forEach(function (a) { if (a.bufferView !== undefined) a.bufferView = bvMap[a.bufferView]; });
  (j.images || []).forEach(function (im2) { if (im2.bufferView !== undefined) im2.bufferView = bvMap[im2.bufferView]; });
  function ra(x) { return accMap[x]; }
  j.meshes.forEach(function (m) { m.primitives.forEach(function (p) { for (var k in p.attributes) p.attributes[k] = ra(p.attributes[k]); if (p.indices !== undefined) p.indices = ra(p.indices); if (p.extensions && p.extensions.KHR_draco_mesh_compression) p.extensions.KHR_draco_mesh_compression.bufferView = bvMap[p.extensions.KHR_draco_mesh_compression.bufferView]; (p.targets || []).forEach(function (t) { for (var k2 in t) t[k2] = ra(t[k2]); }); }); });
  (j.skins || []).forEach(function (s) { if (s.inverseBindMatrices !== undefined) s.inverseBindMatrices = ra(s.inverseBindMatrices); });
  (j.animations || []).forEach(function (a) { a.samplers.forEach(function (s) { s.input = ra(s.input); s.output = ra(s.output); }); });
  var nbin = Buffer.concat(parts2); j.buffers[0].byteLength = nbin.length;
  writeGlb(out, j, nbin); report.out = out; report.bytes = fs.statSync(out).size; console.log(JSON.stringify(report, null, 1));
}
main(process.argv[2], process.argv[3]).catch(function (e) { console.error(e); process.exit(1); });
