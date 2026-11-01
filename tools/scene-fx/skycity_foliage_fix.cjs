'use strict';
/* 场景特效bot r5 S3 (运镜bot feedback): floating grass clumps in env_skycity.glb env_sky_static_foliage_cards (M_sky_foliage_cards,
 * under skycity_float_root). Pre-existing in the source art: some clumps hang in the air (e.g. lake-local (-2, 4.8, 58.7), 4.2 m above the
 * floor under the great-tree root arch, canopy 34 m above), visible while she walks to the balloon (3.5-6.9 s).
 *   scan:  node skycity_foliage_fix.cjs scan  <env_skycity.glb> [out.json]   list every clump with its gap to the nearest surface below / beside
 *   fix:   node skycity_foliage_fix.cjs fix   <env_skycity.glb> <out.glb>    drop each floating clump straight down onto the surface under it
 *          (its lowest point 2 cm into that surface); a clump with nothing below within 40 m is removed. The fixed cards are encoded as ONE new
 *          draco primitive appended at the end of the BIN chunk (+ new accessors); mesh env_sky_static_foliage_cards points at it. Every
 *          existing bufferView / accessor keeps its bytes and index (the old foliage view stays, unreferenced).
 * A clump = cards sharing vertices, then joined when their boxes come within 0.25 m. Floating = the clump's base (lowest 15% of its
 * height) has no surface within 0.45 m straight under it (a surface up to 0.3 m above the lowest point counts: sunk-in bases), is not
 * within 0.2 m (0.45 m at floor level, base y < 1: the rim edge) of a face at most 45 deg from level (rim edges; the steep side of the trunk does not count), and for a card taller than 2 m its top band is too (floor, ruins, rock strata, floor seal, tree, vines, floating rocks, state
 * meshes). Decoder space = glb_geometry.cjs world (float root applied). DRACO3D, QF_TYPESCRIPT_MODULE as for lakeside_skycity_mask.cjs. */
var fs = require('fs'), path = require('path');
var G = require('../camera-frame-test/glb_geometry.cjs');
var NAME = 'env_sky_static_foliage_cards';
var SUPPORT = /static_palette|floor_seal|ruins|rock_strata|greattree_canopy$|island_vines$|floatingrocks_\d$|^state_(court|gate|bridge)_(after|before)$|rope_root/;
var GAP = 0.45, CELL = 1.0, SINK = 0.02, UPMIN = 0.7, ABOVE = 0.3, TOUCH = 0.2;
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
function worldOf(j, ni) { var parent = {}; j.nodes.forEach(function (n, i) { (n.children || []).forEach(function (c) { parent[c] = i; }); });
  var chain = []; for (var k = ni; k !== undefined; k = parent[k]) chain.push(j.nodes[k]);
  return { fwd: function (v) { var p = v; for (var i = 0; i < chain.length; i++) { var n = chain[i], s = n.scale || [1, 1, 1], r = n.rotation || [0, 0, 0, 1], t = n.translation || [0, 0, 0]; p = qrot(r, [p[0] * s[0], p[1] * s[1], p[2] * s[2]]); p = [p[0] + t[0], p[1] + t[1], p[2] + t[2]]; } return p; },
    inv: function (v) { var p = v; for (var i = chain.length - 1; i >= 0; i--) { var n = chain[i], s = n.scale || [1, 1, 1], r = n.rotation || [0, 0, 0, 1], t = n.translation || [0, 0, 0]; p = [p[0] - t[0], p[1] - t[1], p[2] - t[2]]; p = qrot([-r[0], -r[1], -r[2], r[3]], p); p = [p[0] / s[0], p[1] / s[1], p[2] / s[2]]; } return p; } }; }
/* raw decode of the foliage primitive: every attribute (float), indices */
function decodeFoliage(D, j, bin) {
  var mi = -1; j.meshes.forEach(function (m, i) { if (m.name === NAME) mi = i; });
  var pr = j.meshes[mi].primitives[0], ext = pr.extensions.KHR_draco_mesh_compression, bv = j.bufferViews[ext.bufferView];
  var data = bin.slice(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength);
  var d = new D.Decoder(), buf = new D.DecoderBuffer(); buf.Init(new Int8Array(data.buffer, data.byteOffset, data.byteLength), data.byteLength);
  var mesh = new D.Mesh(); if (!d.DecodeBufferToMesh(buf, mesh).ok()) throw Error('decode failed');
  var nv = mesh.num_points(), nf = mesh.num_faces(), out = { nv: nv, nf: nf, attrs: {}, I: [] };
  Object.keys(ext.attributes).forEach(function (k) { var a = d.GetAttributeByUniqueId(mesh, ext.attributes[k]), arr = new D.DracoFloat32Array(); d.GetAttributeFloatForAllPoints(mesh, a, arr);
    var c = a.num_components(), v = new Float32Array(nv * c); for (var i = 0; i < v.length; i++) v[i] = arr.GetValue(i); out.attrs[k] = { c: c, v: v }; D.destroy(arr); });
  var f = new D.DracoInt32Array(); for (var i = 0; i < nf; i++) { d.GetFaceFromMesh(mesh, i, f); out.I.push(f.GetValue(0), f.GetValue(1), f.GetValue(2)); }
  [f, mesh, buf, d].forEach(function (o) { D.destroy(o); });
  out.mesh = mi; out.ext = ext; return out;
}
function supportIndex(geo) {
  var grid = new Map(), tris = [];
  Object.keys(geo.meshes).forEach(function (n) { if (!SUPPORT.test(n)) return; geo.meshes[n].forEach(function (t) {
    var e1 = sub(t[1], t[0]), e2 = sub(t[2], t[0]), nx = e1[1] * e2[2] - e1[2] * e2[1], ny = e1[2] * e2[0] - e1[0] * e2[2], nz = e1[0] * e2[1] - e1[1] * e2[0], l = Math.hypot(nx, ny, nz) || 1;
    tris.push({ n: n, t: t, up: Math.abs(ny) / l }); }); });
  tris.forEach(function (o, ti) { var t = o.t; for (var i = Math.floor(Math.min(t[0][0], t[1][0], t[2][0]) / CELL); i <= Math.floor(Math.max(t[0][0], t[1][0], t[2][0]) / CELL); i++)
    for (var k = Math.floor(Math.min(t[0][2], t[1][2], t[2][2]) / CELL); k <= Math.floor(Math.max(t[0][2], t[1][2], t[2][2]) / CELL); k++) { var key = i + ',' + k; if (!grid.has(key)) grid.set(key, []); grid.get(key).push(ti); } });
  return { grid: grid, tris: tris };
}
function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; } function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function closest(p, a, b, c) { var ab = sub(b, a), ac = sub(c, a), ap = sub(p, a), d1 = dot(ab, ap), d2 = dot(ac, ap); if (d1 <= 0 && d2 <= 0) return a;
  var bp = sub(p, b), d3 = dot(ab, bp), d4 = dot(ac, bp); if (d3 >= 0 && d4 <= d3) return b; var vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) { var v = d1 / (d1 - d3); return [a[0] + ab[0] * v, a[1] + ab[1] * v, a[2] + ab[2] * v]; }
  var cp = sub(p, c), d5 = dot(ab, cp), d6 = dot(ac, cp); if (d6 >= 0 && d5 <= d6) return c; var vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) { var w = d2 / (d2 - d6); return [a[0] + ac[0] * w, a[1] + ac[1] * w, a[2] + ac[2] * w]; }
  var va = d3 * d6 - d5 * d4; if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { var w2 = (d4 - d3) / ((d4 - d3) + (d5 - d6)); return [b[0] + (c[0] - b[0]) * w2, b[1] + (c[1] - b[1]) * w2, b[2] + (c[2] - b[2]) * w2]; }
  var den = 1 / (va + vb + vc), vv = vb * den, ww = vc * den; return [a[0] + ab[0] * vv + ac[0] * ww, a[1] + ab[1] * vv + ac[1] * ww, a[2] + ab[2] * vv + ac[2] * ww]; }
function nearest(S, p, r, minUp) { var best = 1e9, who = null, mu = minUp || 0;
  for (var i = Math.floor((p[0] - r) / CELL); i <= Math.floor((p[0] + r) / CELL); i++) for (var k = Math.floor((p[2] - r) / CELL); k <= Math.floor((p[2] + r) / CELL); k++) {
    var L = S.grid.get(i + ',' + k); if (!L) continue; for (var q = 0; q < L.length; q++) { var o = S.tris[L[q]]; if (o.up < mu) continue; var t = o.t, c = closest(p, t[0], t[1], t[2]), d = Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2]); if (d < best) { best = d; who = o.n; } } }
  return { d: best, who: who }; }
function below(S, x, y, z) { var L = S.grid.get(Math.floor(x / CELL) + ',' + Math.floor(z / CELL)), best = null; if (!L) return null;
  for (var q = 0; q < L.length; q++) { var o = S.tris[L[q]], t = o.t, ax = t[0][0], az = t[0][2], bx = t[1][0], bz = t[1][2], cx = t[2][0], cz = t[2][2], den = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
    if (Math.abs(den) < 1e-12) continue; var a = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / den, b = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / den, c = 1 - a - b;
    if (a < -1e-9 || b < -1e-9 || c < -1e-9) continue; var yy = a * t[0][1] + b * t[1][1] + c * t[2][1]; if (yy <= y + ABOVE && (best === null || yy > best.y)) best = { y: yy, n: o.n }; }
  return best; }
function clumps(F, W) {
  var par = new Int32Array(F.nv); for (var i = 0; i < F.nv; i++) par[i] = i;
  function fd(a) { while (par[a] !== a) { par[a] = par[par[a]]; a = par[a]; } return a; }
  for (var f = 0; f < F.I.length; f += 3) { var a = fd(F.I[f]), b = fd(F.I[f + 1]), c = fd(F.I[f + 2]); par[b] = a; par[fd(c)] = a; }
  var comp = new Map(); for (var v = 0; v < F.nv; v++) { var r = fd(v); if (!comp.has(r)) comp.set(r, []); comp.get(r).push(v); }
  var list = []; comp.forEach(function (vs) { var lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9]; vs.forEach(function (v) { for (var k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], W[v][k]); hi[k] = Math.max(hi[k], W[v][k]); } }); list.push({ vs: vs, lo: lo, hi: hi }); });
  // join boxes within 0.25 m
  var cp = list.map(function (_, i) { return i; }); function fc(a) { while (cp[a] !== a) { cp[a] = cp[cp[a]]; a = cp[a]; } return a; }
  for (var i2 = 0; i2 < list.length; i2++) for (var j2 = i2 + 1; j2 < list.length; j2++) { var A = list[i2], B = list[j2], g = 0;
    for (var k2 = 0; k2 < 3; k2++) g = Math.max(g, A.lo[k2] - B.hi[k2], B.lo[k2] - A.hi[k2]); if (g <= 0.25) cp[fc(j2)] = fc(i2); }
  var m = new Map(); list.forEach(function (c, i) { var r = fc(i); if (!m.has(r)) m.set(r, { vs: [], lo: [1e9, 1e9, 1e9], hi: [-1e9, -1e9, -1e9] }); var o = m.get(r); o.vs = o.vs.concat(c.vs); for (var k = 0; k < 3; k++) { o.lo[k] = Math.min(o.lo[k], c.lo[k]); o.hi[k] = Math.max(o.hi[k], c.hi[k]); } });
  var out = []; m.forEach(function (o) { out.push(o); }); return out;
}
function lakeLocal() { try { var JI = path.join(__dirname, '../journey-integration/'), Jn = require(JI + 'journey-scene.cjs'), LC = Jn.H.load(Jn.S + 'region/LakesideCameraLayout.ts');
  var S6 = Jn.add(Jn.rotY(Jn.yaw, [0.2, 0.032, -27.8]), Jn.sOff), LJ = LC.lakesideJourney(S6); return function (p) { return Jn.rotY(-LJ.yawDeg, Jn.sub(Jn.add(Jn.rotY(Jn.yaw, p), Jn.sOff), LJ.root)); }; } catch (e) { return null; } }
function analyse(src) {
  var r = readGlb(src);
  return Promise.all([G.decode(src), draco().createDecoderModule({})]).then(function (res) {
    var geo = res[0], D = res[1], F = decodeFoliage(D, r.j, r.bin), ni = -1; r.j.nodes.forEach(function (n, i) { if (n.mesh === F.mesh) ni = i; });
    var X = worldOf(r.j, ni), P = F.attrs.POSITION.v, W = []; for (var v = 0; v < F.nv; v++) W.push(X.fwd([P[v * 3], P[v * 3 + 1], P[v * 3 + 2]]));
    var S = supportIndex(geo), toL = lakeLocal(), cl = clumps(F, W);
    cl.forEach(function (c) { var h = c.hi[1] - c.lo[1], cut = c.lo[1] + Math.max(0.15 * h, 0.05), base = c.vs.filter(function (v) { return W[v][1] <= cut; }), best = { d: 1e9, who: null };
      // the base must sit on ground / a branch top (a face at most ~70 deg from level), not stick out of the side of the trunk
      base.forEach(function (v) { var n = nearest(S, W[v], GAP + 0.5, UPMIN); if (n.d < best.d) best = n; });
      var cx = (c.lo[0] + c.hi[0]) / 2, cz = (c.lo[2] + c.hi[2]) / 2, bl = null; base.forEach(function (v) { var q = below(S, W[v][0], W[v][1], W[v][2]); if (q && (!bl || q.y > bl.y)) bl = q; });
      // a tall card hanging from a rim / branch (top band within GAP of a surface) is attached, not floating
      var top = { d: 1e9 }; if (h > 2) c.vs.forEach(function (v) { if (W[v][1] >= c.hi[1] - Math.max(0.15 * h, 0.05)) { var n = nearest(S, W[v], GAP + 0.5); if (n.d < top.d) top = n; } });
      c.gap = best.d; c.topGap = top.d; c.touch = best.who; c.below = bl; c.centre = [cx, c.lo[1], cz]; c.lake = toL ? toL(c.centre).map(function (x) { return +x.toFixed(2); }) : null; c.drop = bl ? c.lo[1] - bl.y : null; c.floating = !(c.drop !== null && c.drop <= GAP) && best.d > (c.lo[1] < 1 ? GAP : TOUCH) && top.d > GAP; });
    return { r: r, F: F, W: W, X: X, cl: cl, D: D };
  });
}
function scan(src, out) { return analyse(src).then(function (A) { var fl = A.cl.filter(function (c) { return c.floating; });
  var rows = fl.map(function (c) { return { verts: c.vs.length, height: +(c.hi[1] - c.lo[1]).toFixed(2), gap: +c.gap.toFixed(2), baseY: +c.lo[1].toFixed(2), below: c.below ? { drop: +(c.lo[1] - c.below.y).toFixed(2), on: c.below.n } : null, sky: c.centre.map(function (x) { return +x.toFixed(2); }), lake: c.lake }; });
  rows.sort(function (a, b) { return b.gap - a.gap; });
  if (process.env.QF_FOL_CLUMPS) fs.writeFileSync(process.env.QF_FOL_CLUMPS, JSON.stringify(A.cl.map(function (c) { return { c: [(c.lo[0] + c.hi[0]) / 2, c.lo[1], (c.lo[2] + c.hi[2]) / 2].map(function (x) { return +x.toFixed(2); }), h: +(c.hi[1] - c.lo[1]).toFixed(2), gap: +c.gap.toFixed(2), top: +c.topGap.toFixed(2), fl: c.floating, on: c.touch, drop: c.drop === null ? null : +c.drop.toFixed(2) }; })));   // QA
  var res = { clumps: A.cl.length, verts: A.F.nv, tris: A.F.nf, floating: rows.length, rows: rows }; if (out) fs.writeFileSync(out, JSON.stringify(res, null, 1));
  if (out) { var set = new Uint8Array(A.F.nv), o = []; fl.forEach(function (c) { c.vs.forEach(function (v) { set[v] = 1; }); });   // QA: the floating cards as an OBJ (decoder space)
    for (var v = 0; v < A.F.nv; v++) o.push('v ' + A.W[v].join(' ')); for (var f = 0; f < A.F.I.length; f += 3) if (set[A.F.I[f]]) o.push('f ' + (A.F.I[f] + 1) + ' ' + (A.F.I[f + 1] + 1) + ' ' + (A.F.I[f + 2] + 1));
    fs.writeFileSync(out.replace(/\.json$/, '') + '.obj', o.join('\n') + '\n'); } console.log(JSON.stringify(res, null, 1)); return res; }); }
function fix(src, out) { return analyse(src).then(function (A) {
  var F = A.F, P = F.attrs.POSITION.v, drop = new Uint8Array(F.nv), log = [];
  A.cl.forEach(function (c) { if (!c.floating) return;
    if (c.below && c.lo[1] - c.below.y < 40) { var dy = c.below.y - SINK - c.lo[1];
      c.vs.forEach(function (v) { var w = A.W[v], l = A.X.inv([w[0], w[1] + dy, w[2]]); P[v * 3] = l[0]; P[v * 3 + 1] = l[1]; P[v * 3 + 2] = l[2]; });
      log.push({ act: 'drop', dy: +dy.toFixed(2), on: c.below.n, lake: c.lake });
    } else { c.vs.forEach(function (v) { drop[v] = 1; }); log.push({ act: 'remove', lake: c.lake }); } });
  var I = []; for (var f = 0; f < F.I.length; f += 3) if (!drop[F.I[f]] && !drop[F.I[f + 1]] && !drop[F.I[f + 2]]) I.push(F.I[f], F.I[f + 1], F.I[f + 2]);
  // compact (removed clumps leave unused vertices)
  var map = new Int32Array(F.nv).fill(-1), nv = 0, keep = []; for (var i = 0; i < I.length; i++) { if (map[I[i]] < 0) { map[I[i]] = nv++; keep.push(I[i]); } I[i] = map[I[i]]; }
  return draco().createEncoderModule({}).then(function (E) {
    var mb = new E.MeshBuilder(), mesh = new E.Mesh(), enc = new E.Encoder(); mb.AddFacesToMesh(mesh, I.length / 3, new Uint32Array(I));
    var order = ['POSITION', 'NORMAL', 'TEXCOORD_0', 'COLOR_0'], sem = { POSITION: E.POSITION, NORMAL: E.NORMAL, TEXCOORD_0: E.TEX_COORD, COLOR_0: E.COLOR }, ids = {}, data = {};
    order.forEach(function (k) { var a = F.attrs[k]; if (!a) return; var v = new Float32Array(nv * a.c); for (var q = 0; q < nv; q++) for (var e = 0; e < a.c; e++) v[q * a.c + e] = a.v[keep[q] * a.c + e];
      data[k] = { c: a.c, v: v }; ids[k] = mb.AddFloatAttributeToMesh(mesh, sem[k], nv, a.c, v); });
    // same quantisation as the source export (Blender glTF defaults: pos 14, normal 10, uv 12, color 10)
    enc.SetAttributeQuantization(E.POSITION, 14); enc.SetAttributeQuantization(E.NORMAL, 10); enc.SetAttributeQuantization(E.TEX_COORD, 12); enc.SetAttributeQuantization(E.COLOR, 10);
    enc.SetEncodingMethod(E.MESH_EDGEBREAKER_ENCODING); enc.SetSpeedOptions(5, 5);
    var da = new E.DracoInt8Array(), len = enc.EncodeMeshToDracoBuffer(mesh, da); if (!len) throw Error('encode failed');
    var buf = Buffer.alloc(len); for (var k = 0; k < len; k++) buf[k] = da.GetValue(k); [da, enc, mesh, mb].forEach(function (o) { E.destroy(o); });
    var j = A.r.j, pad = (4 - A.r.bin.length % 4) % 4, off = A.r.bin.length + pad, bin = Buffer.concat([A.r.bin, Buffer.alloc(pad, 0), buf]);
    var bvi = j.bufferViews.length; j.bufferViews.push({ buffer: 0, byteOffset: off, byteLength: len }); j.buffers[0].byteLength = bin.length;
    var pr = j.meshes[F.mesh].primitives[0], attrs = {}, a0 = j.accessors.length;
    order.forEach(function (k) { if (!data[k]) return; var old = j.accessors[pr.attributes[k]], acc = { componentType: old.componentType, count: nv, type: old.type };
      if (old.normalized) acc.normalized = old.normalized;
      if (k === 'POSITION') { var lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9]; for (var q = 0; q < nv; q++) for (var e = 0; e < 3; e++) { lo[e] = Math.min(lo[e], data[k].v[q * 3 + e]); hi[e] = Math.max(hi[e], data[k].v[q * 3 + e]); } acc.min = lo; acc.max = hi; }
      attrs[k] = j.accessors.length; j.accessors.push(acc); });
    var oi = j.accessors[pr.indices]; var ii = j.accessors.length; j.accessors.push({ componentType: nv > 65535 ? 5125 : oi.componentType, count: I.length, type: 'SCALAR' });
    pr.attributes = attrs; pr.indices = ii; pr.extensions.KHR_draco_mesh_compression = { bufferView: bvi, attributes: ids };
    writeGlb(out, j, bin);
    var res = { fixed: log.length, log: log, verts: [F.nv, nv], tris: [F.nf, I.length / 3], dracoBytes: [j.bufferViews[A.F.ext.bufferView].byteLength, len], bytes: [fs.statSync(src).size, fs.statSync(out).size], firstNewAccessor: a0 };
    console.log(JSON.stringify(res, null, 1)); return res; }); }); }
var a = process.argv.slice(2);
(a[0] === 'scan' ? scan(a[1], a[2]) : a[0] === 'fix' ? fix(a[1], a[2]) : Promise.reject(Error('usage: scan|fix'))).catch(function (e) { console.error(e); process.exit(1); });
