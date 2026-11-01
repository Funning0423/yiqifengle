'use strict';
/* b15 (场景特效bot): balloon basket door per 角色动画bot DOOR_SPEC (previews/角色动画bot/b15-balloon/door/DOOR_SPEC.md).
 *   node balloon_basket_door.cjs <in transport_balloon.glb> <out.glb>
 * Basket-local Cocos/glTF axes: origin = basket root (her feet), +Y up, +Z = door outward normal (shore), +X = her LEFT
 * facing the door from inside. All numbers in SPEC below; change them and re-run when the spec moves.
 * - cuts the flat +Z basket wall (wicker, rim, padding) between X ±HALF_W over the full height (no sill, no lintel),
 *   seals both cut faces with door-frame posts (POST_W wide, from the slanted wall out to the leaf's inner plane);
 * - lowers the inner floor (and the inner-wall foot) FLOOR_FROM → FLOOR_TO, drops the hidden skid blocks and the old
 *   bottom plate (the floor is double-sided and is the bottom now) and adds the wall-foot ring under the wall;
 * - adds node `basket_door` (child of transport_balloon, origin ON the hinge axis, rotate about local +Y, +OPEN_DEG = out)
 *   with child `basket_door_leaf` (mesh, same M_balloon_basket): wicker leaf, rim-coloured top rail, brass push plate on
 *   the inner face, two brass hinge straps, and the front charm that used to hang on the cut rim moved onto the leaf.
 * Single material, no new textures. Stand_point / basket_floor nodes are NOT moved (b14 seats her at stand_point − 0.1). */
var fs = require('fs');
var SPEC = {
  HALF_W: 0.40,            // clear opening X −0.40 … +0.40
  CUT_TOP: 1.16,           // cut everything of the +Z wall below this (rim padding top is 1.12)
  LEAF_Y0: 0.01, LEAF_Y1: 1.15, LEAF_Z_IN: 0.80, LEAF_T: 0.04,
  HINGE_X: 0.40,           // +X side = her left from inside (hinge at the outer face, Z = LEAF_Z_IN + LEAF_T)
  OPEN_DEG: 100,
  PLATE: { x: -0.08, y: 1.13, w: 0.12, h: 0.10 },   // centre on the inner face; clipped to the leaf top
  FLOOR_FROM: 0.10, FLOOR_TO: 0.0,
  POST_W: 0.06,
  LOCK_JAMB_ZMAX: 0.795,
  FLOOR_T: 0.03,           // b15 floor fix: woven floor board, top at FLOOR_TO (her feet), bottom at -FLOOR_T, sealed sides
  CHARM_DZ: 0.09           // charm (front ornament) pushed out so its back sits on the leaf outer face
};
var UV = { rail: [0.094, 0.531], frame: [0.031, 0.531], brass: [0.469, 0.531], foot: [0.219, 0.531] };
function readGlb(f) { var b = fs.readFileSync(f), jl = b.readUInt32LE(12); return { j: JSON.parse(b.slice(20, 20 + jl).toString('utf8')), bin: b.slice(28 + jl, 28 + jl + b.readUInt32LE(20 + jl)) }; }
function writeGlb(f, j, bin) {
  var js = Buffer.from(JSON.stringify(j), 'utf8'); js = Buffer.concat([js, Buffer.alloc((4 - js.length % 4) % 4, 0x20)]); bin = Buffer.concat([bin, Buffer.alloc((4 - bin.length % 4) % 4, 0)]);
  var h = Buffer.alloc(12); h.writeUInt32LE(0x46546C67, 0); h.writeUInt32LE(2, 4); h.writeUInt32LE(28 + js.length + bin.length, 8);
  var c0 = Buffer.alloc(8); c0.writeUInt32LE(js.length, 0); c0.writeUInt32LE(0x4E4F534A, 4); var c1 = Buffer.alloc(8); c1.writeUInt32LE(bin.length, 0); c1.writeUInt32LE(0x004E4942, 4);
  fs.writeFileSync(f, Buffer.concat([h, c0, js, c1, bin]));
}
function main(src, out) {
  var r = readGlb(src), j = r.j, bin = r.bin, S = SPEC;
  function acc(i) { var a = j.accessors[i], bv = j.bufferViews[a.bufferView], n = { SCALAR: 1, VEC2: 2, VEC3: 3 }[a.type], T = a.componentType === 5126 ? Float32Array : a.componentType === 5123 ? Uint16Array : Uint32Array, o = bin.byteOffset + (bv.byteOffset || 0) + (a.byteOffset || 0);
    return new T(bin.buffer.slice(o, o + a.count * n * T.BYTES_PER_ELEMENT)); }
  var bi = -1; j.nodes.forEach(function (n, i) { if (n.name === 'balloon_basket') bi = i; });
  if (j.nodes.some(function (n) { return n.name === 'basket_door'; })) throw Error('already has basket_door');
  var mesh = j.meshes[j.nodes[bi].mesh], prim = mesh.primitives[0], P = acc(prim.attributes.POSITION), N = acc(prim.attributes.NORMAL), T = acc(prim.attributes.TEXCOORD_0), I = acc(prim.indices);
  var near = function (a, b) { return Math.abs(a - b) < 1e-3; };
  // ---- triangles as vertex records {p,n,t}
  var tris = [], charm = [];
  for (var t = 0; t < I.length / 3; t++) {
    var tri = [0, 1, 2].map(function (e) { var k = I[t * 3 + e]; return { p: [P[k * 3], P[k * 3 + 1], P[k * 3 + 2]], n: [N[k * 3], N[k * 3 + 1], N[k * 3 + 2]], t: [T[k * 2], T[k * 2 + 1]] }; });
    var cy = (tri[0].p[1] + tri[1].p[1] + tri[2].p[1]) / 3, cz = (tri[0].p[2] + tri[1].p[2] + tri[2].p[2]) / 3, cx = (tri[0].p[0] + tri[1].p[0] + tri[2].p[0]) / 3;
    var maxY = Math.max(tri[0].p[1], tri[1].p[1], tri[2].p[1]), allY = function (y) { return tri.every(function (v) { return near(v.p[1], y); }); };
    if (maxY <= 0.071 && !allY(0) && Math.abs(Math.abs(cx) - 0.42) < 0.06) continue;                      // skid block sides/top
    if (allY(0) && Math.abs(Math.abs(cx) - 0.42) < 0.06 && Math.abs(tri[0].p[0] - tri[1].p[0]) < 0.11 && Math.abs(tri[0].p[0]) > 0.36 && Math.abs(tri[0].p[0]) < 0.48 && tri.every(function (v) { return Math.abs(v.p[0]) > 0.36 && Math.abs(v.p[0]) < 0.48; })) continue; // skid bottoms
    if (allY(0) && tri[0].n[1] < -0.9) continue;                                                        // old bottom plate
    if (cz > 0.7 && cy > 0.5 && cy < 1.05 && Math.abs(cx) < 0.12 && Math.abs(tri[0].n[0]) + Math.abs(tri[0].n[1]) > 0.05 || (t >= 420 && t < 440 && Math.abs(cx) < 0.12)) { charm.push(tri); continue; }
    tris.push(tri);
  }
  // ---- lower the floor + inner-wall foot
  tris.forEach(function (tr) { tr.forEach(function (v) { if (near(v.p[1], S.FLOOR_FROM)) v.p[1] = S.FLOOR_TO; }); });
  // ---- wall-foot ring (outer bottom octagon → inner foot octagon), facing down
  var OUT = [[0.53, 0.68], [0.68, 0.53], [0.68, -0.53], [0.53, -0.68], [-0.53, -0.68], [-0.68, -0.53], [-0.68, 0.53], [-0.53, 0.68]];
  var INN = [[0.52, 0.62], [0.62, 0.52], [0.62, -0.52], [0.52, -0.62], [-0.52, -0.62], [-0.62, -0.52], [-0.62, 0.52], [-0.52, 0.62]];
  function V(p, n, uv) { return { p: p.slice(), n: n.slice(), t: uv.slice() }; }
  var down = [0, -1, 0];
  for (var q = 0; q < 8; q++) { var a = OUT[q], b = OUT[(q + 1) % 8], c = INN[(q + 1) % 8], d = INN[q];
    tris.push([V([a[0], 0, a[1]], down, UV.foot), V([d[0], 0, d[1]], down, UV.foot), V([c[0], 0, c[1]], down, UV.foot)]);
    tris.push([V([a[0], 0, a[1]], down, UV.foot), V([c[0], 0, c[1]], down, UV.foot), V([b[0], 0, b[1]], down, UV.foot)]); }
  // ---- cut the flat +Z wall: clip every front-facing (nx≈0) +Z-side triangle against |x| ≥ HALF_W
  function lerpV(a, b, s) { return { p: a.p.map(function (x, i) { return x + (b.p[i] - x) * s; }), n: a.n.slice(), t: a.t.map(function (x, i) { return x + (b.t[i] - x) * s; }) }; }
  function clip(poly, sign) { // keep sign*x >= HALF_W
    var o = []; for (var i = 0; i < poly.length; i++) { var A = poly[i], B = poly[(i + 1) % poly.length], da = sign * A.p[0] - S.HALF_W, db = sign * B.p[0] - S.HALF_W;
      if (da >= 0) o.push(A); if ((da >= 0) !== (db >= 0)) o.push(lerpV(A, B, da / (da - db))); } return o; }
  var kept = [];
  tris.forEach(function (tr) {
    var cz = (tr[0].p[2] + tr[1].p[2] + tr[2].p[2]) / 3, cy = (tr[0].p[1] + tr[1].p[1] + tr[2].p[1]) / 3;
    var front = cz > 0.5 && cy < S.CUT_TOP && tr.every(function (v) { return v.p[2] > 0.5; }) && Math.min(tr[0].p[0], tr[1].p[0], tr[2].p[0]) < S.HALF_W && Math.max(tr[0].p[0], tr[1].p[0], tr[2].p[0]) > -S.HALF_W;
    var isFloor = tr.every(function (v) { return near(v.p[1], S.FLOOR_TO); }) && tr[0].n[1] > 0.9;
    if (!front || isFloor) { kept.push(tr); return; }
    [1, -1].forEach(function (sg) {
    var pl = clip(tr, sg);
    // lock side: the cut end of the rim is pulled in to Z ≤ LOCK_JAMB_ZMAX, matching its jamb cap (stays sealed)
    if (sg < 0) pl = pl.map(function (v) { if (Math.abs(v.p[0] + S.HALF_W) < 1e-4 && v.p[2] > S.LOCK_JAMB_ZMAX) { v = { p: v.p.slice(), n: v.n.slice(), t: v.t.slice() }; v.p[2] = S.LOCK_JAMB_ZMAX; } return v; }); for (var k = 1; k + 1 < pl.length; k++) kept.push([pl[0], pl[k], pl[k + 1]]); });
  });
  tris = kept;
  // ---- frame posts + jamb caps (both sides)
  var wallZ = function (y) { return 0.68 + 0.08 * y; }; // outer wicker plane (planar, x-independent)
  function quad(list, a, b, c, d, n, uv) { list.push([V(a, n, uv), V(b, n, uv), V(c, n, uv)]); list.push([V(a, n, uv), V(c, n, uv), V(d, n, uv)]); }
  function poly(list, pts, n, uv) { for (var k = 1; k + 1 < pts.length; k++) list.push([V(pts[0], n, uv), V(pts[k], n, uv), V(pts[k + 1], n, uv)]); }
  var ZI = S.LEAF_Z_IN, PW = S.POST_W;
  [1, -1].forEach(function (sg) {
    // lock side (X −0.40, sg −1): rim jamb point held to Z ≤ 0.795, inside the leaf's inner plane (0.80), so the leaf's free
    // inner corner clears it at every angle; hinge side keeps its 0.81 (the leaf never sweeps it).
    // lock side (X −0.40, sg −1): rim jamb point held to Z ≤ 0.795, inside the leaf's inner plane (0.80), so the leaf's free
    // inner corner clears it at every angle; hinge side keeps its 0.81 (the leaf never sweeps it).
    var jz = sg < 0 ? S.LOCK_JAMB_ZMAX : 0.81;
    var x0 = sg * S.HALF_W, x1 = sg * (S.HALF_W + PW), nIn = [-sg, 0, 0];
    var footIn = 0.62; // inner wall foot after lowering (z at y = 0)
    poly(tris, [[x0, 0, footIn], [x0, 0, ZI], [x0, 1.0, ZI], [x0, 1.0, 0.68]], nIn, UV.frame);                         // jamb A
    poly(tris, [[x0, 1.0, 0.68], [x0, 1.0, ZI], [x0, 1.07, jz], [x0, 1.12, 0.78], [x0, 1.12, 0.67]], nIn, UV.frame);  // jamb B (rim)
    poly(tris, [[x1, 0, wallZ(0)], [x1, 1.0, wallZ(1.0)], [x1, 1.0, ZI], [x1, 0, ZI]], [sg, 0, 0], UV.rail);           // post side
    quad(tris, [x0, 0, ZI], [x1, 0, ZI], [x1, 1.0, ZI], [x0, 1.0, ZI], [0, 0, 1], UV.rail);                              // post front
    quad(tris, [x0, 0, wallZ(0)], [x0, 0, ZI], [x1, 0, ZI], [x1, 0, wallZ(0)], down, UV.foot);                         // post foot
  });
  // threshold: the floor runs out flush to the closed leaf (no sill, no sky/ground strip under the leaf from inside)
  quad(tris, [-S.HALF_W, S.FLOOR_TO, 0.62], [-S.HALF_W, S.FLOOR_TO, ZI], [S.HALF_W, S.FLOOR_TO, ZI], [S.HALF_W, S.FLOOR_TO, 0.62], [0, 1, 0], [0.281, 0.531]);
  // ---- b15 floor fix: one solid woven floor board replaces every y = 0 sheet (floor, threshold, wall-foot ring, post feet).
  // b14/b15 had a single zero-thickness floor at the basket bottom, so the moored basket (pressed 0-0.7 cm into the lawn)
  // put the grass above her floor: looking down from inside she saw only grass. Now the board top stays at 0 (feet,
  // DOOR_SPEC floor) and the board is FLOOR_T thick; the mooring lifts the basket by FLOOR_T (LakesideBalloon).
  tris = tris.filter(function (tr) { return !tr.every(function (v) { return Math.abs(v.p[1] - S.FLOOR_TO) < 1e-4; }); });
  (function () {
    var y0 = S.FLOOR_TO, y1 = S.FLOOR_TO - S.FLOOR_T, ax = S.HALF_W + S.POST_W, az0 = wallZ(0), az1 = ZI;
    var woven = function (x, z) { return [0.02 + 0.96 * (x + 0.68) / 1.36, 0.49 - 0.48 * (z + 0.68) / 1.48]; }; // inside the wicker tile (v 0.01-0.49; v < 0 wraps onto a dark palette row)
    var up = [0, 1, 0], dn = [0, -1, 0];
    function cap(pts, top) { var y = top ? y0 : y1, n = top ? up : dn;
      for (var k = 1; k + 1 < pts.length; k++) tris.push([pts[0], pts[k], pts[k + 1]].map(function (q) { return V([q[0], y, q[1]], n, top ? woven(q[0], q[1]) : UV.foot); })); }
    var apron = [[-ax, az0], [ax, az0], [ax, az1], [-ax, az1]];
    cap(OUT, true); cap(apron, true); cap(OUT, false); cap(apron, false);
    // under the closed leaf (Z 0.80-0.84, X ±0.40): the board runs out to the leaf's outer face, so no slit of lawn shows below
    // the leaf's 1 cm bottom gap (leaf Y >= 0.01 keeps clear of the board top at every angle)
    var lip = [[-S.HALF_W, ZI], [S.HALF_W, ZI], [S.HALF_W, ZI + S.LEAF_T], [-S.HALF_W, ZI + S.LEAF_T]], zo2 = ZI + S.LEAF_T;
    cap(lip, true); cap(lip, false);
    quad(tris, [-S.HALF_W, y0, zo2], [S.HALF_W, y0, zo2], [S.HALF_W, y1, zo2], [-S.HALF_W, y1, zo2], [0, 0, 1], UV.rail);
    [-1, 1].forEach(function (sg) { var x = sg * S.HALF_W; quad(tris, [x, y0, ZI], [x, y0, zo2], [x, y1, zo2], [x, y1, ZI], [sg, 0, 0], UV.rail); });
    // outline (octagon with the door apron): sealed sides, rim colour
    var ol = [[0.53, 0.68], [0.68, 0.53], [0.68, -0.53], [0.53, -0.68], [-0.53, -0.68], [-0.68, -0.53], [-0.68, 0.53], [-0.53, 0.68], [-ax, az0], [-ax, az1], [ax, az1], [ax, az0]];
    for (var e = 0; e < ol.length; e++) { var a = ol[e], b = ol[(e + 1) % ol.length], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz), n = [dz / l, 0, -dx / l];
      if (n[0] * (a[0] + b[0]) + n[2] * (a[1] + b[1]) < 0 && !(Math.abs(a[1] - az0) < 1e-6 && Math.abs(b[1] - az0) < 1e-6)) n = [-n[0], 0, -n[2]];
      if (Math.abs(a[1] - az0) < 1e-6 && Math.abs(b[1] - az0) < 1e-6) n = [0, 0, 1];
      quad(tris, [a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], [a[0], y1, a[1]], n, UV.rail); }
  })();
  // ---- leaf (door-local: hinge origin, leaf X −2·HALF_W … 0, Z −LEAF_T … 0)
  var HX = S.HINGE_X, HZ = ZI + S.LEAF_T, W = 2 * S.HALF_W, L = [];
  var wick = function (X, y) { return [0.02 + 0.96 * (X + 0.53) / 1.06, 0.5 * (1 - Math.min(1, y))]; };
  function lq(X0, X1, y0, y1, z, n, uvf) { var pts = [[X0, y0], [X1, y0], [X1, y1], [X0, y1]]; if (n[2] < 0) pts.reverse();
    var vs = pts.map(function (p) { return { p: [p[0] - HX, p[1], z - HZ], n: n.slice(), t: uvf(p[0], p[1]) }; }); L.push([vs[0], vs[1], vs[2]]); L.push([vs[0], vs[2], vs[3]]); }
  var Xa = -S.HALF_W, Xb = S.HALF_W, y0 = S.LEAF_Y0, y1 = S.LEAF_Y1, zo = HZ, zi = ZI, c = function (uv) { return function () { return uv; }; };
  lq(Xa, Xb, y0, 1.0, zo, [0, 0, 1], wick); lq(Xa, Xb, 1.0, y1, zo, [0, 0, 1], c(UV.rail));                // outer
  lq(Xa, Xb, y0, 1.0, zi, [0, 0, -1], wick);                                                               // inner wicker
  var pl = S.PLATE, px0 = pl.x - pl.w / 2, px1 = pl.x + pl.w / 2, py0 = Math.min(pl.y - pl.h / 2, y1 - 0.08);
  lq(Xa, Xb, 1.0, py0, zi, [0, 0, -1], c(UV.rail)); lq(Xa, px0, py0, y1, zi, [0, 0, -1], c(UV.rail)); lq(px1, Xb, py0, y1, zi, [0, 0, -1], c(UV.rail));
  lq(px0, px1, py0, y1, zi, [0, 0, -1], c(UV.brass));                                                       // push plate (flush: her fingers stop 1 mm off the leaf)
  function edge(a, b, n, uv) { var vs = [a[0], a[1], b[1], b[0]].map(function (p) { return { p: [p[0] - HX, p[1], p[2] - HZ], n: n.slice(), t: uv }; }); L.push([vs[0], vs[1], vs[2]]); L.push([vs[0], vs[2], vs[3]]); }
  edge([[Xa, y1, zi], [Xb, y1, zi]], [[Xa, y1, zo], [Xb, y1, zo]], [0, 1, 0], UV.frame);
  edge([[Xa, y0, zo], [Xb, y0, zo]], [[Xa, y0, zi], [Xb, y0, zi]], [0, -1, 0], UV.frame);
  edge([[Xb, y0, zi], [Xb, y1, zi]], [[Xb, y0, zo], [Xb, y1, zo]], [1, 0, 0], UV.frame);
  edge([[Xa, y0, zo], [Xa, y1, zo]], [[Xa, y0, zi], [Xa, y1, zi]], [-1, 0, 0], UV.frame);
  function box(X0, X1, Y0, Y1, Z0, Z1, uv) { // 5 faces (no back)
    lq(X0, X1, Y0, Y1, Z1, [0, 0, 1], c(uv));
    edge([[X0, Y1, Z0], [X1, Y1, Z0]], [[X0, Y1, Z1], [X1, Y1, Z1]], [0, 1, 0], uv); edge([[X0, Y0, Z1], [X1, Y0, Z1]], [[X0, Y0, Z0], [X1, Y0, Z0]], [0, -1, 0], uv);
    edge([[X1, Y0, Z0], [X1, Y1, Z0]], [[X1, Y0, Z1], [X1, Y1, Z1]], [1, 0, 0], uv); edge([[X0, Y0, Z1], [X0, Y1, Z1]], [[X0, Y0, Z0], [X0, Y1, Z0]], [-1, 0, 0], uv); }
  box(Xb - 0.15, Xb, 0.20, 0.26, zo, zo + 0.006, UV.brass); box(Xb - 0.15, Xb, 0.86, 0.92, zo, zo + 0.006, UV.brass);   // hinge straps (outer face)
  charm.forEach(function (tr) { L.push(tr.map(function (v) { return { p: [v.p[0] - HX, v.p[1], v.p[2] + S.CHARM_DZ - HZ], n: v.n.slice(), t: v.t.slice() }; })); });
  // ---- pack
  function pack(list) { var p = [], n = [], u = [], idx = [], lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
    // winding follows the authored normal (CCW front face), so the geometric face and its normal agree everywhere
    list = list.map(function (tr) { var a = tr[0].p, b = tr[1].p, c = tr[2].p, e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]],
      g = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]], nn = tr[0].n;
      return g[0] * nn[0] + g[1] * nn[1] + g[2] * nn[2] < 0 ? [tr[0], tr[2], tr[1]] : tr; });
    list.forEach(function (tr) { tr.forEach(function (v) { idx.push(p.length / 3); p.push(v.p[0], v.p[1], v.p[2]); n.push(v.n[0], v.n[1], v.n[2]); u.push(v.t[0], v.t[1]); for (var e = 0; e < 3; e++) { lo[e] = Math.min(lo[e], v.p[e]); hi[e] = Math.max(hi[e], v.p[e]); } }); });
    return { P: new Float32Array(p), N: new Float32Array(n), T: new Float32Array(u), I: new Uint16Array(idx), lo: lo, hi: hi, tris: list.length }; }
  var extra = [], off = bin.length;
  function bv(buf, target) { var pad = (4 - off % 4) % 4; if (pad) { extra.push(Buffer.alloc(pad)); off += pad; } extra.push(buf); j.bufferViews.push({ buffer: 0, byteOffset: off, byteLength: buf.length, target: target }); off += buf.length; return j.bufferViews.length - 1; }
  function accs(g) { var b0 = j.accessors.length;
    j.accessors.push({ bufferView: bv(Buffer.from(g.P.buffer), 34962), componentType: 5126, count: g.P.length / 3, type: 'VEC3', min: g.lo, max: g.hi });
    j.accessors.push({ bufferView: bv(Buffer.from(g.N.buffer), 34962), componentType: 5126, count: g.N.length / 3, type: 'VEC3' });
    j.accessors.push({ bufferView: bv(Buffer.from(g.T.buffer), 34962), componentType: 5126, count: g.T.length / 2, type: 'VEC2' });
    j.accessors.push({ bufferView: bv(Buffer.from(g.I.buffer), 34963), componentType: 5123, count: g.I.length, type: 'SCALAR' });
    return { POSITION: b0, NORMAL: b0 + 1, TEXCOORD_0: b0 + 2, idx: b0 + 3 }; }
  var gb = pack(tris), gl = pack(L), ab = accs(gb), al = accs(gl);
  prim.attributes = { POSITION: ab.POSITION, NORMAL: ab.NORMAL, TEXCOORD_0: ab.TEXCOORD_0 }; prim.indices = ab.idx;
  j.meshes.push({ name: 'basket_door_leaf', primitives: [{ attributes: { POSITION: al.POSITION, NORMAL: al.NORMAL, TEXCOORD_0: al.TEXCOORD_0 }, indices: al.idx, material: prim.material, mode: 4 }] });
  j.nodes.push({ name: 'basket_door_leaf', mesh: j.meshes.length - 1 });
  j.nodes.push({ name: 'basket_door', translation: [HX, 0, HZ], children: [j.nodes.length - 1], extras: { openAxis: 'localY', openDeg: S.OPEN_DEG, spec: 'previews/角色动画bot/b15-balloon/door/DOOR_SPEC.md' } });
  var root = -1; j.nodes.forEach(function (n, i) { if (n.name === 'transport_balloon') root = i; }); j.nodes[root].children.push(j.nodes.length - 1);
  // drop the basket's now-unused old accessors/bufferViews and repack
  var all = Buffer.concat([bin].concat(extra)), used = {}, ua = {};
  j.meshes.forEach(function (m) { m.primitives.forEach(function (p) { for (var k in p.attributes) ua[p.attributes[k]] = 1; ua[p.indices] = 1; }); });
  (j.animations || []).forEach(function (a) { a.samplers.forEach(function (s) { ua[s.input] = 1; ua[s.output] = 1; }); });
  (j.skins || []).forEach(function (s) { if (s.inverseBindMatrices !== undefined) ua[s.inverseBindMatrices] = 1; });
  var amap = {}, A2 = []; j.accessors.forEach(function (a, i) { if (ua[i]) { amap[i] = A2.length; A2.push(a); used[a.bufferView] = 1; } });
  (j.images || []).forEach(function (im) { if (im.bufferView !== undefined) used[im.bufferView] = 1; });
  var bmap = {}, B2 = [], parts = [], o2 = 0;
  j.bufferViews.forEach(function (v, i) { if (!used[i]) return; var pad = (4 - o2 % 4) % 4; if (pad) { parts.push(Buffer.alloc(pad)); o2 += pad; }
    parts.push(all.slice(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength)); var nv = JSON.parse(JSON.stringify(v)); nv.byteOffset = o2; o2 += v.byteLength; bmap[i] = B2.length; B2.push(nv); });
  A2.forEach(function (a) { a.bufferView = bmap[a.bufferView]; }); (j.images || []).forEach(function (im) { if (im.bufferView !== undefined) im.bufferView = bmap[im.bufferView]; });
  j.accessors = A2; j.bufferViews = B2;
  j.meshes.forEach(function (m) { m.primitives.forEach(function (p) { for (var k in p.attributes) p.attributes[k] = amap[p.attributes[k]]; p.indices = amap[p.indices]; }); });
  (j.animations || []).forEach(function (a) { a.samplers.forEach(function (s) { s.input = amap[s.input]; s.output = amap[s.output]; }); });
  (j.skins || []).forEach(function (s) { if (s.inverseBindMatrices !== undefined) s.inverseBindMatrices = amap[s.inverseBindMatrices]; });
  var nbin = Buffer.concat(parts); j.buffers[0].byteLength = nbin.length;
  writeGlb(out, j, nbin);
  console.log(JSON.stringify({ basketTris: gb.tris, leafTris: gl.tris, charmTris: charm.length, out: out, bytes: fs.statSync(out).size, spec: S }));
}
main(process.argv[2], process.argv[3]);
