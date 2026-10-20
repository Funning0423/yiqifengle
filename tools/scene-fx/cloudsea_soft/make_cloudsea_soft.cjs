'use strict';
/* 场景特效bot r5 skyground: env_sky_cloudsea_soft.glb — soft low-poly cloud sea + horizon cumulus for the skycity board.
 *   DRACO3D=<draco3d dir> node make_cloudsea_soft.cjs <island_hull.json> <out.glb> [extra.json]
 * Space: env_skycity.glb node space (same as the env_sky_cloudsea node: scene root, identity). Mount as a sibling of the
 * env_skycity instance with that instance's transform. One mesh, one primitive, material "M_env_palette" (no texture in the
 * GLB; rebound at runtime to the shared palette material). POSITION/NORMAL/TEXCOORD_0 only; all UVs on palette row 12
 * (periwinkle -> lavender white), haze = u pushed toward the pale end with distance. Deterministic (seeded).
 * island_hull.json: XZ convex hull of the island (everything under skycity_float_root); asserted: 0 triangles over it with y>-8.
 * extra.json (optional): {skycity:{env_sky_cloudsea_soft:[[v0,v1,v2],...]}} for exposure_audit.cjs --extra. */
var fs = require('fs'), path = require('path');
var HULL = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')), OUT = process.argv[3], EXTRA = process.argv[4];
var O = [-3, 12], V_ROW = 200 / 256, Y_LIMIT = -8;
var seed = 20261020; function rnd() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
function ss(a, b, x) { var t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
function mix(a, b, t) { return a + (b - a) * t; }
// smooth billows: few rotated sines (no hash noise -> no spikes)
var W = []; for (var i = 0; i < 5; i++) W.push({ a: rnd() * Math.PI, k: (0.012 + 0.03 * rnd()) * (i < 2 ? 0.6 : 1), p: rnd() * 6.28, w: i < 2 ? 1 : 0.55 });
function bill(x, z) { var s = 0, n = 0; W.forEach(function (q) { s += q.w * Math.sin((x * Math.cos(q.a) + z * Math.sin(q.a)) * q.k + q.p); n += q.w; }); return s / n * 1.6; }
function base(r) { return -36 + 36 * Math.pow(ss(70, 470, r), 1.25) + 6 * ss(470, 820, r); }
function amp(r) { return 3.6 + 6.5 * ss(60, 520, r); }
function seaH(x, z) { var r = Math.hypot(x - O[0], z - O[1]); return base(r) + amp(r) * Math.max(-1, Math.min(1, bill(x, z))); }
function haze(r) { return ss(140, 720, r); }
var P = [], N = [], U = [], I = [];
// ---- sea: polar lattice, odd rings offset half a step
var RINGS = [0, 26, 52, 80, 110, 145, 185, 230, 280, 335, 395, 460, 530, 610, 700, 820], SEG = 60, ring0 = [];
RINGS.forEach(function (r, ri) {
  var row = [], n = ri === 0 ? 1 : SEG;
  for (var s = 0; s < n; s++) {
    var t = (s + (ri % 2 ? 0.5 : 0)) / SEG * Math.PI * 2, x = O[0] + r * Math.cos(t), z = O[1] + r * Math.sin(t), y = seaH(x, z);
    var c = (y - base(r)) / amp(r), u = mix(0.60 + 0.26 * c, 0.90, 0.6 * haze(r));
    row.push(P.length / 3); P.push(x, y, z); U.push(Math.max(0.30, Math.min(0.99, u)), V_ROW);
  }
  ring0.push(row);
});
for (var ri = 1; ri < RINGS.length; ri++) {
  var a = ring0[ri - 1], b = ring0[ri];
  for (var s = 0; s < SEG; s++) {
    var s1 = (s + 1) % SEG;
    if (ri === 1) { I.push(a[0], b[s1], b[s]); continue; }
    if (ri % 2) { I.push(a[s], a[s1], b[s]); I.push(a[s1], b[s1], b[s]); }       // ring ri offset +0.5
    else { I.push(a[s], b[s1], b[s]); I.push(a[s], a[s1], b[s1]); }               // ring ri-1 offset +0.5
  }
}
var seaTris = I.length / 3;
// ---- horizon cumulus: clusters of squashed icospheres (subdiv 1), bottoms flattened into the sea
function ico() {
  var t = (1 + Math.sqrt(5)) / 2, v = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]],
    f = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  v = v.map(function (p) { var l = Math.hypot(p[0], p[1], p[2]); return [p[0] / l, p[1] / l, p[2] / l]; });
  var mid = {}, f2 = [];
  function m(a, b) { var k = a < b ? a + '_' + b : b + '_' + a; if (mid[k] === undefined) { var p = [v[a][0] + v[b][0], v[a][1] + v[b][1], v[a][2] + v[b][2]], l = Math.hypot(p[0], p[1], p[2]); mid[k] = v.length; v.push([p[0] / l, p[1] / l, p[2] / l]); } return mid[k]; }
  f.forEach(function (q) { var ab = m(q[0], q[1]), bc = m(q[1], q[2]), ca = m(q[2], q[0]); f2.push([q[0], ab, ca], [q[1], bc, ab], [q[2], ca, bc], [ab, bc, ca]); });
  return { v: v, f: f2 };
}
var ICO = ico(), NCL = 18, clusters = [];
for (var c = 0; c < NCL; c++) {
  var th = (c + 0.25 + 0.5 * rnd()) / NCL * Math.PI * 2, R = 380 + 170 * rnd(), cx = O[0] + R * Math.cos(th), cz = O[1] + R * Math.sin(th);
  var nb = 3 + Math.floor(rnd() * 3), big = 0.75 + 0.5 * rnd(); clusters.push([+cx.toFixed(1), +cz.toFixed(1), nb]);
  var tx = -Math.sin(th), tz = Math.cos(th);   // tangent: clusters spread along the horizon
  for (var bI = 0; bI < nb; bI++) {
    var off = (bI - (nb - 1) / 2) * 30 * big + (rnd() - 0.5) * 12, bx = cx + tx * off + (rnd() - 0.5) * 20, bz = cz + tz * off + (rnd() - 0.5) * 20;
    var mid = Math.abs(bI - (nb - 1) / 2) < 0.6 ? 1 : 0.7, sx = (24 + 16 * rnd()) * big, sy = (13 + 12 * rnd()) * big * mid, sz = (24 + 16 * rnd()) * big;
    var floorY = seaH(bx, bz) - 2, cyy = floorY + sy * 0.55, rot = rnd() * 6.28, cr = Math.cos(rot), sr = Math.sin(rot), r0 = Math.hypot(bx - O[0], bz - O[1]);
    var start = P.length / 3;
    ICO.v.forEach(function (q) {
      var lx = q[0] * sx, lz = q[2] * sz, x = bx + lx * cr - lz * sr, z = bz + lx * sr + lz * cr, y = Math.max(floorY, cyy + q[1] * sy);
      var hgt = (y - floorY) / (sy * 1.55), u = mix(0.50 + 0.46 * hgt, 0.90, 0.45 * haze(r0));
      P.push(x, y, z); U.push(Math.max(0.30, Math.min(0.99, u)), V_ROW);
    });
    ICO.f.forEach(function (q) { I.push(start + q[0], start + q[1], start + q[2]); });   // icosahedron table is CCW outward
  }
}
// winding check for ico (outward): flip whole set if needed
function triN(a, b, c) { var ax = P[b * 3] - P[a * 3], ay = P[b * 3 + 1] - P[a * 3 + 1], az = P[b * 3 + 2] - P[a * 3 + 2], bx = P[c * 3] - P[a * 3], by = P[c * 3 + 1] - P[a * 3 + 1], bz = P[c * 3 + 2] - P[a * 3 + 2]; return [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx]; }
(function () { var n = triN(I[0], I[1], I[2]); if (n[1] < 0) for (var k = 0; k < seaTris * 3; k += 3) { var t = I[k + 1]; I[k + 1] = I[k + 2]; I[k + 2] = t; } })();
(function () { var f = seaTris * 3, n = triN(I[f], I[f + 1], I[f + 2]), cx = (P[I[f] * 3] + P[I[f + 1] * 3] + P[I[f + 2] * 3]) / 3; /* checked below via centroid */ })();
// drop fully-buried cumulus tris (all three vertices on the flattened floor) -> smaller and no hidden overdraw
var keep = []; for (var k = 0; k < I.length; k += 3) {
  if (k >= seaTris * 3) { var ys = [P[I[k] * 3 + 1], P[I[k + 1] * 3 + 1], P[I[k + 2] * 3 + 1]], fl = Math.min(ys[0], ys[1], ys[2]); if (ys[0] - fl < 1e-4 && ys[1] - fl < 1e-4 && ys[2] - fl < 1e-4) { var nn = triN(I[k], I[k + 1], I[k + 2]); if (nn[1] < 0 || Math.abs(nn[1]) > 0) continue; } }
  keep.push(I[k], I[k + 1], I[k + 2]); }
I = keep;
// compact: drop vertices no kept triangle uses (draco would drop them and the accessor counts would disagree)
(function () { var map = new Int32Array(P.length / 3).fill(-1), P2 = [], U2 = [], n = 0; for (var k = 0; k < I.length; k++) { var v = I[k]; if (map[v] < 0) { map[v] = n++; P2.push(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]); U2.push(U[v * 2], U[v * 2 + 1]); } I[k] = map[v]; } P = P2; U = U2; })();
// smooth normals
var NV = P.length / 3; N = new Float32Array(NV * 3);
for (var k = 0; k < I.length; k += 3) { var n = triN(I[k], I[k + 1], I[k + 2]); for (var e = 0; e < 3; e++) { N[I[k + e] * 3] += n[0]; N[I[k + e] * 3 + 1] += n[1]; N[I[k + e] * 3 + 2] += n[2]; } }
for (var q = 0; q < NV; q++) { var l = Math.hypot(N[q * 3], N[q * 3 + 1], N[q * 3 + 2]) || 1; N[q * 3] /= l; N[q * 3 + 1] /= l; N[q * 3 + 2] /= l; }
// ---- island projection rule
function inHull(x, z) { var n = HULL.length, s = 0; for (var i = 0; i < n; i++) { var a = HULL[i], b = HULL[(i + 1) % n], cr = (b[0] - a[0]) * (z - a[1]) - (b[1] - a[1]) * (x - a[0]); if (cr < 0) return false; } return true; }
function segX(p, q, a, b) { function o(u, v, w) { return (v[0] - u[0]) * (w[1] - u[1]) - (v[1] - u[1]) * (w[0] - u[0]); } return o(p, q, a) * o(p, q, b) < 0 && o(a, b, p) * o(a, b, q) < 0; }
var over = 0, overHigh = 0, ymaxOver = -1e9;
for (var k = 0; k < I.length; k += 3) {
  var t = [0, 1, 2].map(function (e) { return [P[I[k + e] * 3], P[I[k + e] * 3 + 1], P[I[k + e] * 3 + 2]]; }), hit = t.some(function (p) { return inHull(p[0], p[2]); });
  if (!hit) for (var e = 0; e < 3 && !hit; e++) for (var h = 0; h < HULL.length && !hit; h++) hit = segX([t[e][0], t[e][2]], [t[(e + 1) % 3][0], t[(e + 1) % 3][2]], HULL[h], HULL[(h + 1) % HULL.length]);
  if (!hit) { var cxz = [(t[0][0] + t[1][0] + t[2][0]) / 3, (t[0][2] + t[1][2] + t[2][2]) / 3]; hit = HULL.every(function () { return false; }); /* hull inside a tri: hull centre test */ hit = (function () { var hc = [0, 0]; HULL.forEach(function (p) { hc[0] += p[0] / HULL.length; hc[1] += p[1] / HULL.length; }); function sgn(a, b, c) { return (a[0] - c[0]) * (b[1] - c[1]) - (b[0] - c[0]) * (a[1] - c[1]); } var p = hc, A = [t[0][0], t[0][2]], B = [t[1][0], t[1][2]], C = [t[2][0], t[2][2]], d1 = sgn(p, A, B), d2 = sgn(p, B, C), d3 = sgn(p, C, A); return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0)); })(); }
  if (hit) { over++; var ym = Math.max(t[0][1], t[1][1], t[2][1]); ymaxOver = Math.max(ymaxOver, ym); if (ym > Y_LIMIT) overHigh++; }
}
if (overHigh) throw Error('island projection rule: ' + overHigh + ' tris over the island with y>' + Y_LIMIT);
// ---- encode
var G = require(path.resolve(__dirname, '../../camera-frame-test/glb_geometry.cjs')), D3 = require(path.join(G.dracoDir(), 'draco3d.js'));
D3.createEncoderModule({}).then(function (E) {
  var mb = new E.MeshBuilder(), em = new E.Mesh(), enc = new E.Encoder(), nf = I.length / 3;
  mb.AddFacesToMesh(em, nf, new Uint32Array(I));
  var ids = { POSITION: mb.AddFloatAttributeToMesh(em, E.POSITION, NV, 3, new Float32Array(P)), NORMAL: mb.AddFloatAttributeToMesh(em, E.NORMAL, NV, 3, N), TEXCOORD_0: mb.AddFloatAttributeToMesh(em, E.TEX_COORD, NV, 2, new Float32Array(U)) };
  enc.SetAttributeQuantization(E.POSITION, 14); enc.SetAttributeQuantization(E.NORMAL, 8); enc.SetAttributeQuantization(E.TEX_COORD, 10);
  enc.SetEncodingMethod(E.MESH_EDGEBREAKER_ENCODING); enc.SetSpeedOptions(3, 3);
  var da = new E.DracoInt8Array(), len = enc.EncodeMeshToDracoBuffer(em, da); if (!len) throw Error('encode failed');
  var buf = Buffer.alloc(len); for (var i = 0; i < len; i++) buf[i] = da.GetValue(i);
  var lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9]; for (var p = 0; p < NV; p++) for (var e = 0; e < 3; e++) { lo[e] = Math.min(lo[e], P[p * 3 + e]); hi[e] = Math.max(hi[e], P[p * 3 + e]); }
  var j = { asset: { version: '2.0', generator: '场景特效bot make_cloudsea_soft.cjs' }, extensionsUsed: ['KHR_draco_mesh_compression'], extensionsRequired: ['KHR_draco_mesh_compression'],
    scene: 0, scenes: [{ nodes: [0] }], nodes: [{ name: 'env_sky_cloudsea_soft', mesh: 0, extras: { qfSpace: 'env_skycity.glb node space (sibling of env_sky_cloudsea)', seaTris: seaTris, clusters: clusters } }],
    materials: [{ name: 'M_env_palette', doubleSided: true, pbrMetallicRoughness: { metallicFactor: 0, roughnessFactor: 0.9 } }],
    meshes: [{ name: 'env_sky_cloudsea_soft', primitives: [{ attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 }, indices: 3, material: 0, mode: 4, extensions: { KHR_draco_mesh_compression: { bufferView: 0, attributes: ids } } }] }],
    accessors: [{ componentType: 5126, count: NV, type: 'VEC3', min: lo, max: hi }, { componentType: 5126, count: NV, type: 'VEC3' }, { componentType: 5126, count: NV, type: 'VEC2' }, { componentType: NV > 65535 ? 5125 : 5123, count: nf * 3, type: 'SCALAR' }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: len }], buffers: [{ byteLength: (len + 3) & ~3 }] };
  var js = Buffer.from(JSON.stringify(j)); js = Buffer.concat([js, Buffer.alloc((4 - js.length % 4) % 4, 0x20)]);
  var bn = Buffer.concat([buf, Buffer.alloc((4 - len % 4) % 4, 0)]), hd = Buffer.alloc(12), jh = Buffer.alloc(8), bh = Buffer.alloc(8);
  hd.writeUInt32LE(0x46546C67, 0); hd.writeUInt32LE(2, 4); hd.writeUInt32LE(12 + 8 + js.length + 8 + bn.length, 8);
  jh.writeUInt32LE(js.length, 0); jh.writeUInt32LE(0x4E4F534A, 4); bh.writeUInt32LE(bn.length, 0); bh.writeUInt32LE(0x004E4942, 4);
  fs.writeFileSync(OUT, Buffer.concat([hd, jh, js, bh, bn]));
  if (EXTRA) { var tr = []; for (var k = 0; k < I.length; k += 3) tr.push([0, 1, 2].map(function (e) { return [+P[I[k + e] * 3].toFixed(3), +P[I[k + e] * 3 + 1].toFixed(3), +P[I[k + e] * 3 + 2].toFixed(3)]; })); fs.writeFileSync(EXTRA, JSON.stringify({ skycity: { env_sky_cloudsea_soft: tr } })); }
  console.log(JSON.stringify({ out: OUT, bytes: fs.statSync(OUT).size, verts: NV, tris: nf, seaTris: seaTris, cumulusTris: nf - seaTris, clusters: NCL, bboxMin: lo.map(function (v) { return +v.toFixed(2); }), bboxMax: hi.map(function (v) { return +v.toFixed(2); }), overIsland: over, overIslandYmax: +ymaxOver.toFixed(2), overIslandAboveLimit: overHigh }));
});
