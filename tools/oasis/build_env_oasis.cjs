'use strict';
// Desert-oasis courtyard, v2. Vertex colours only. The 7×7 is painted into the
// sand-brick floor at y = 0. Walls enclose the court; dunes sit outside them.
const fs = require('node:fs'), path = require('node:path');
const OUT = path.resolve(__dirname, '../../creator-build-project/assets/bundles/region_oasis/models/env_oasis.glb');
const Y = 0, X0 = -6.5, X1 = 6.5, Z0 = -7, Z1 = 7, HALF = 2.125;
const CELL = (HALF * 2) / 7, LINE = 0.028;
const WALL = 4.18, ZFAR = -5.48, ZNEAR = 5.02;
const rgba = (r, g, b, a = 255) => [r, g, b, a];
const mix = (a, b, t) => rgba(
  a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t,
  a[3] + ((b[3] ?? 255) - a[3]) * t,
);
function mesh() { return { pos: [], nrm: [], col: [], idx: [] }; }
function addTri(m, a, b, c, ca, cb, cc) {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
  const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
  const base = m.pos.length / 3;
  [a, b, c].forEach((p, i) => {
    const col = [ca, cb || ca, cc || ca][i];
    m.pos.push(p[0], p[1], p[2]); m.nrm.push(nx, ny, nz); m.col.push(col[0], col[1], col[2], col[3] ?? 255);
  });
  m.idx.push(base, base + 1, base + 2);
}
function addQuad(m, a, b, c, d, ca, cb, cc, cd) { addTri(m, a, b, c, ca, cb, cc); addTri(m, a, c, d, ca, cc, cd || ca); }
function box(m, x0, y0, z0, x1, y1, z1, c) {
  addQuad(m, [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], c);
  addQuad(m, [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], mix(c, rgba(40, 22, 14), 0.28));
  addQuad(m, [x1, y0, z1], [x1, y1, z1], [x1, y1, z0], [x1, y0, z0], mix(c, rgba(40, 22, 14), 0.14));
  addQuad(m, [x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1], mix(c, rgba(20, 10, 8), 0.2));
  addQuad(m, [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], mix(c, rgba(255, 220, 180), 0.1));
  addQuad(m, [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], mix(c, rgba(20, 10, 8), 0.08));
}
const parts = [];
function part(name, unlit, build) { const m = mesh(); build(m); parts.push({ name, unlit: !!unlit, m }); }

const sandA = rgba(214, 164, 104), sandB = rgba(204, 150, 92), sandC = rgba(222, 176, 116);
const brickA = rgba(228, 184, 124), brickB = rgba(214, 168, 110), seam = rgba(196, 154, 104);
const stoneA = rgba(252, 244, 228), stoneB = rgba(244, 232, 210), stoneLine = rgba(214, 190, 158);
const mosaic = [rgba(42, 156, 142), rgba(38, 96, 156), rgba(214, 154, 64), rgba(236, 214, 176), rgba(72, 168, 154)];

function sand(m, x0, x1, z0, z1) {
  if (x1 - x0 < 0.05 || z1 - z0 < 0.05) return;
  const nx = Math.max(1, Math.round((x1 - x0) / 2.2)), nz = Math.max(1, Math.round((z1 - z0) / 2.2));
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const ax = i === 0 ? x0 : x0 + (x1 - x0) * i / nx, bx = i === nx - 1 ? x1 : x0 + (x1 - x0) * (i + 1) / nx;
    const az = j === 0 ? z0 : z0 + (z1 - z0) * j / nz, bz = j === nz - 1 ? z1 : z0 + (z1 - z0) * (j + 1) / nz;
    const col = [sandA, sandB, sandC][(i + j * 2) % 3];
    addQuad(m, [ax, Y, bz], [bx, Y, bz], [bx, Y, az], [ax, Y, az], col);
  }
}
function bricks(m, x0, x1, z0, z1) {
  if (x1 - x0 < 0.08 || z1 - z0 < 0.08) return;
  const nx = Math.max(1, Math.round((x1 - x0) / 1.35)), nz = Math.max(1, Math.round((z1 - z0) / 1.35));
  const g = 0.012;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const ax = i === 0 ? x0 : x0 + (x1 - x0) * i / nx, bx = i === nx - 1 ? x1 : x0 + (x1 - x0) * (i + 1) / nx;
    const az = j === 0 ? z0 : z0 + (z1 - z0) * j / nz, bz = j === nz - 1 ? z1 : z0 + (z1 - z0) * (j + 1) / nz;
    const ix0 = i === 0 ? ax : ax + g, ix1 = i === nx - 1 ? bx : bx - g;
    const iz0 = j === 0 ? az : az + g, iz1 = j === nz - 1 ? bz : bz - g;
    addQuad(m, [ix0, Y, iz1], [ix1, Y, iz1], [ix1, Y, iz0], [ix0, Y, iz0], (i + j) % 2 ? brickA : brickB);
    if (i > 0) addQuad(m, [ax, Y, iz0], [ax + g, Y, iz0], [ax + g, Y, iz1], [ax, Y, iz1], seam);
    if (j > 0) addQuad(m, [ix0, Y, az], [ix1, Y, az], [ix1, Y, az + g], [ix0, Y, az + g], seam);
  }
}
function mosaicBand(m, x0, x1, z0, z1, row) {
  const n = Math.max(2, Math.round(Math.max(x1 - x0, z1 - z0) / 0.18));
  const alongX = (x1 - x0) >= (z1 - z0);
  for (let i = 0; i < n; i++) {
    const t0 = i / n, t1 = (i + 1) / n;
    const col = mosaic[(i + row) % mosaic.length];
    if (alongX) {
      const a = x0 + (x1 - x0) * t0, b = x0 + (x1 - x0) * t1;
      addQuad(m, [a, Y, z1], [b, Y, z1], [b, Y, z0], [a, Y, z0], col);
    } else {
      const a = z0 + (z1 - z0) * t0, b = z0 + (z1 - z0) * t1;
      addQuad(m, [x0, Y, b], [x1, Y, b], [x1, Y, a], [x0, Y, a], col);
    }
  }
}

part('OA_ground', false, m => {
  sand(m, X0, -WALL, Z0, Z1);
  sand(m, WALL, X1, Z0, Z1);
  sand(m, -WALL, WALL, Z0, ZFAR);
  sand(m, -WALL, -0.95, ZNEAR, Z1);
  sand(m, 0.95, WALL, ZNEAR, Z1);
  bricks(m, -0.95, 0.95, ZNEAR, 6.35);
  const band = 0.22, outer = HALF + band;
  bricks(m, -WALL, -outer, ZFAR, ZNEAR);
  bricks(m, outer, WALL, ZFAR, ZNEAR);
  bricks(m, -outer, outer, ZFAR, -5.15);
  bricks(m, -outer, -1.4, -5.15, -3.45);
  bricks(m, 1.4, outer, -5.15, -3.45);
  bricks(m, -outer, outer, -3.45, -HALF);
  bricks(m, -outer, outer, HALF, ZNEAR);
  mosaicBand(m, -HALF, HALF, HALF, outer, 0);
  mosaicBand(m, -HALF, HALF, -outer, -HALF, 1);
  mosaicBand(m, -outer, -HALF, -HALF, HALF, 2);
  mosaicBand(m, HALF, outer, -HALF, HALF, 3);
  const edges = [];
  for (let i = 0; i <= 7; i++) edges.push(i === 7 ? HALF : -HALF + i * CELL);
  const hL = LINE * 0.5;
  for (let row = 0; row < 7; row++) for (let col = 0; col < 7; col++) {
    const colr = (row + col) % 2 ? stoneA : stoneB;
    const a = edges[col] + hL, b = edges[col + 1] - hL, c = edges[row] + hL, d = edges[row + 1] - hL;
    addQuad(m, [a, Y, d], [b, Y, d], [b, Y, c], [a, Y, c], colr);
  }
  for (let i = 0; i <= 7; i++) {
    const x = edges[i];
    addQuad(m, [x - hL, Y, -HALF], [x + hL, Y, -HALF], [x + hL, Y, HALF], [x - hL, Y, HALF], stoneLine);
  }
  for (let row = 0; row <= 7; row++) for (let col = 0; col < 7; col++) {
    const z = edges[row], a = edges[col] + hL, b = edges[col + 1] - hL;
    addQuad(m, [a, Y, z - hL], [b, Y, z - hL], [b, Y, z + hL], [a, Y, z + hL], stoneLine);
  }
});

function pointedPortal(m, x0, x1, z0, z1, col) {
  const xc = (x0 + x1) / 2, pier = 0.22, spring = 0.78, crown = 2.55;
  const pierCol = mix(col, rgba(120, 68, 40), 0.12);
  box(m, x0, Y, z0, x0 + pier, spring + 0.08, z1, pierCol);
  box(m, x1 - pier, Y, z0, x1, spring + 0.08, z1, pierCol);
  const innerL = x0 + pier + 0.02, innerR = x1 - pier - 0.02, n = 5, pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const tuck = Math.sin(t * Math.PI) * 0.06;
    pts.push([innerL + (xc - innerL) * t - tuck, spring + (crown - spring) * Math.pow(t, 0.72)]);
  }
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const tuck = Math.sin(t * Math.PI) * 0.06;
    pts.push([xc + (innerR - xc) * t + tuck, spring + (crown - spring) * Math.pow(1 - t, 0.72)]);
  }
  const outer = pts.map((p, i) => {
    const prev = pts[Math.max(0, i - 1)], next = pts[Math.min(pts.length - 1, i + 1)];
    let nx = -(next[1] - prev[1]), ny = next[0] - prev[0];
    const len = Math.hypot(nx, ny) || 1; nx /= len; ny /= len;
    if ((p[0] - xc) * nx + (p[1] - spring) * ny < 0) { nx = -nx; ny = -ny; }
    return [p[0] + nx * 0.2, p[1] + ny * 0.18];
  });
  const top = crown + 0.16;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], c = outer[i + 1], d = outer[i];
    const shade = mix(col, rgba(255, 220, 180), i === n ? 0.22 : 0.02);
    addQuad(m, [a[0], a[1], z1], [b[0], b[1], z1], [c[0], c[1], z1], [d[0], d[1], z1], shade);
    addQuad(m, [b[0], b[1], z0], [a[0], a[1], z0], [d[0], d[1], z0], [c[0], c[1], z0], mix(shade, rgba(40, 22, 14), 0.2));
    addQuad(m, [a[0], a[1], z0], [a[0], a[1], z1], [b[0], b[1], z1], [b[0], b[1], z0], mix(col, rgba(255, 232, 200), 0.2));
    addQuad(m, [d[0], d[1], z1], [c[0], c[1], z1], [c[0], c[1], z0], [d[0], d[1], z0], mix(col, rgba(40, 22, 14), 0.1));
    if (d[1] < top - 0.02) {
      addQuad(m, [d[0], d[1], z1], [c[0], c[1], z1], [c[0], top, z1], [d[0], top, z1], col);
      addQuad(m, [d[0], top, z0], [d[0], top, z1], [c[0], top, z1], [c[0], top, z0], mix(col, rgba(255, 220, 180), 0.14));
    }
  }
}

function merlons(m, x0, x1, z, y, alongX, col) {
  const n = alongX ? 5 : 4, span = alongX ? (x1 - x0) : 0;
  for (let i = 0; i < n; i++) {
    if (alongX) {
      const a = x0 + (x1 - x0) * (i + 0.18) / n, b = a + (x1 - x0) / n * 0.46;
      box(m, a, y, z - 0.08, b, y + 0.22, z + 0.08, col);
    } else {
      const a = -0.2 + i * 0.55;
      box(m, x0, y, z + a, x1, y + 0.22, z + a + 0.28, col);
    }
  }
}

part('OA_walls', false, m => {
  const wall = rgba(196, 122, 72), cap = rgba(214, 146, 92), tower = rgba(176, 104, 60);
  const h = 0.92, t = 0.16;
  box(m, -WALL - t, Y, ZFAR, -WALL + t, h, ZNEAR, wall);
  box(m, WALL - t, Y, ZFAR, WALL + t, h, ZNEAR, wall);
  box(m, -WALL, Y, ZFAR - t, WALL, h, ZFAR + t, wall);
  box(m, -WALL, Y, ZNEAR - t, -1.05, h, ZNEAR + t, wall);
  box(m, 1.05, Y, ZNEAR - t, WALL, h, ZNEAR + t, wall);
  box(m, -WALL, h, ZFAR - t, WALL, h + 0.06, ZFAR + t, cap);
  for (const x of [-WALL, WALL]) {
    for (let i = 0; i < 6; i++) {
      const z = ZFAR + 0.35 + i * 1.35;
      if (z > ZNEAR - 0.4) break;
      box(m, x - t - 0.02, h, z, x + t + 0.02, h + 0.2, z + 0.32, cap);
    }
  }
  for (const [x, z] of [[-WALL, ZFAR], [WALL, ZFAR]]) {
    box(m, x - 0.34, Y, z - 0.34, x + 0.34, 1.72, z + 0.34, tower);
    box(m, x - 0.4, 1.72, z - 0.4, x + 0.4, 1.84, z + 0.4, cap);
    for (const [dx, dz] of [[-0.28, -0.28], [0.08, -0.28], [-0.28, 0.08], [0.08, 0.08]]) {
      box(m, x + dx, 1.84, z + dz, x + dx + 0.2, 2.04, z + dz + 0.2, cap);
    }
  }
  merlons(m, -WALL + 0.5, -1.2, ZFAR, h, true, cap);
  merlons(m, 1.2, WALL - 0.5, ZFAR, h, true, cap);
});

part('OA_arcade', false, m => {
  const arch = rgba(186, 112, 64);
  pointedPortal(m, -4.05, -2.28, 2.42, 2.86, arch);
  pointedPortal(m, 2.28, 4.05, 2.42, 2.86, arch);
  pointedPortal(m, -4.05, -2.55, -1.35, -0.98, mix(arch, rgba(150, 90, 52), 0.08));
  pointedPortal(m, 2.55, 4.05, -1.35, -0.98, mix(arch, rgba(150, 90, 52), 0.08));
});

function palm(m, x, z, h, rich) {
  const trunk = rgba(122, 78, 42), ring = rgba(92, 56, 32), frond = rgba(46, 118, 58), frondD = rgba(28, 82, 42), date = rgba(176, 78, 36);
  const sides = 5, segs = rich ? 4 : 3;
  for (let s = 0; s < segs; s++) {
    const y0 = h * s / segs, y1 = h * (s + 1) / segs;
    const r0 = 0.11 * (1 - s * 0.12), r1 = 0.09 * (1 - s * 0.12);
    for (let i = 0; i < sides; i++) {
      const a0 = (i / sides) * Math.PI * 2, a1 = ((i + 1) / sides) * Math.PI * 2;
      addQuad(m,
        [x + Math.cos(a0) * r0, y0, z + Math.sin(a0) * r0],
        [x + Math.cos(a1) * r0, y0, z + Math.sin(a1) * r0],
        [x + Math.cos(a1) * r1, y1, z + Math.sin(a1) * r1],
        [x + Math.cos(a0) * r1, y1, z + Math.sin(a0) * r1],
        i % 2 ? trunk : ring);
    }
    const rr = r0 * 1.35;
    for (let i = 0; i < sides; i++) {
      const a0 = (i / sides) * Math.PI * 2, a1 = ((i + 1) / sides) * Math.PI * 2;
      addQuad(m,
        [x + Math.cos(a0) * r0, y1 - 0.02, z + Math.sin(a0) * r0],
        [x + Math.cos(a1) * r0, y1 - 0.02, z + Math.sin(a1) * r0],
        [x + Math.cos(a1) * rr, y1 + 0.03, z + Math.sin(a1) * rr],
        [x + Math.cos(a0) * rr, y1 + 0.03, z + Math.sin(a0) * rr],
        ring);
    }
  }
  const leaves = rich ? 7 : 5;
  for (let i = 0; i < leaves; i++) {
    const a = (i / leaves) * Math.PI * 2 + 0.4;
    const dx = Math.cos(a), dz = Math.sin(a), px = -dz, pz = dx;
    const p = (k, lift) => [x + dx * k, h * 0.92 + lift, z + dz * k];
    const w = 0.16;
    const A = p(0.04, 0.02), B = p(0.36, 0.42), C = p(0.78, 0.06), D = p(1.22, -0.58);
    const span = (p0, p1, col) => addQuad(m,
      [p0[0] + px * w, p0[1], p0[2] + pz * w], [p1[0] + px * w, p1[1], p1[2] + pz * w],
      [p1[0] - px * w, p1[1], p1[2] - pz * w], [p0[0] - px * w, p0[1], p0[2] - pz * w], col);
    span(A, B, mix(frond, rgba(170, 200, 80), 0.25));
    span(B, C, frond);
    span(C, D, frondD);
  }
  if (rich) for (const [dx, dz] of [[0.12, 0.04], [-0.08, 0.1], [0.02, -0.12]]) {
    box(m, x + dx - 0.05, h * 0.72, z + dz - 0.05, x + dx + 0.05, h * 0.86, z + dz + 0.05, date);
  }
}
part('OA_palms', false, m => {
  palm(m, -3.15, 3.35, 2.45, true);
  palm(m, 3.25, 3.15, 2.6, true);
  palm(m, -3.45, -2.85, 2.15, false);
  palm(m, 3.55, -2.55, 2.25, false);
});

function pot(m, x, z, h, r, col) {
  const n = 5;
  const ring = (y, rad) => Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return [x + Math.cos(a) * rad, y, z + Math.sin(a) * rad];
  });
  const a = ring(0.02, r * 0.62), b = ring(h * 0.7, r), c = ring(h, r * 0.74);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    addQuad(m, a[i], a[j], b[j], b[i], mix(col, rgba(40, 16, 10), 0.2), mix(col, rgba(40, 16, 10), 0.2), col, col);
    addQuad(m, b[i], b[j], c[j], c[i], col, col, mix(col, rgba(255, 210, 170), 0.2), mix(col, rgba(255, 210, 170), 0.2));
  }
}
part('OA_pots', false, m => {
  const clay = rgba(176, 78, 48), clay2 = rgba(150, 64, 42);
  pot(m, -2.85, 2.85, 0.38, 0.18, clay);
  pot(m, 2.95, 2.7, 0.32, 0.15, clay2);
  pot(m, -3.05, -3.55, 0.28, 0.13, clay2);
  pot(m, 3.15, 0.85, 0.34, 0.16, clay);
  const leaf = rgba(58, 124, 60);
  addTri(m, [-2.85, 0.38, 2.85], [-3.02, 0.66, 2.9], [-2.78, 0.58, 2.7], leaf);
  addTri(m, [2.95, 0.32, 2.7], [3.12, 0.56, 2.78], [2.86, 0.5, 2.55], mix(leaf, rgba(180, 200, 80), 0.3));
});

part('OA_props', false, m => {
  const rug = [rgba(152, 48, 42), rgba(214, 154, 64), rgba(42, 110, 120), rgba(236, 210, 170)];
  const rx0 = -3.55, rx1 = -2.55, rz0 = 0.35, rz1 = 1.55;
  for (let j = 0; j < 4; j++) for (let i = 0; i < 3; i++) {
    const a = rx0 + (rx1 - rx0) * i / 3, b = rx0 + (rx1 - rx0) * (i + 1) / 3;
    const c = rz0 + (rz1 - rz0) * j / 4, d = rz0 + (rz1 - rz0) * (j + 1) / 4;
    addQuad(m, [a, Y, d], [b, Y, d], [b, Y, c], [a, Y, c], rug[(i + j) % rug.length]);
  }
  const cushion = rgba(168, 64, 58), cushion2 = rgba(196, 122, 48);
  box(m, 2.55, Y, 0.45, 3.15, 0.14, 0.95, cushion);
  box(m, 2.62, Y, 1.05, 3.2, 0.12, 1.45, cushion2);
  const lamp = rgba(212, 150, 64), glow = rgba(255, 196, 110);
  for (const [x, z] of [[-3.35, 4.2], [3.35, 4.2], [-4.05, -4.6], [4.05, -4.6]]) {
    box(m, x - 0.06, Y, z - 0.06, x + 0.06, 0.55, z + 0.06, lamp);
    box(m, x - 0.1, 0.55, z - 0.1, x + 0.1, 0.72, z + 0.1, glow);
  }
});

part('OA_pool', false, m => {
  const x0 = -1.4, x1 = 1.4, z0 = -5.15, z1 = -3.45, floor = -0.2, rim = 0.16;
  mosaicBand(m, x0, x1, z1 - rim, z1, 0);
  mosaicBand(m, x0, x1, z0, z0 + rim, 2);
  mosaicBand(m, x0, x0 + rim, z0 + rim, z1 - rim, 1);
  mosaicBand(m, x1 - rim, x1, z0 + rim, z1 - rim, 3);
  const ix0 = x0 + rim, ix1 = x1 - rim, iz0 = z0 + rim, iz1 = z1 - rim;
  addQuad(m, [ix0, floor, iz1], [ix1, floor, iz1], [ix1, floor, iz0], [ix0, floor, iz0], rgba(186, 156, 108));
  addQuad(m, [ix0, floor, iz0], [ix1, floor, iz0], [ix1, Y, iz0], [ix0, Y, iz0], rgba(150, 112, 74));
  addQuad(m, [ix1, floor, iz1], [ix0, floor, iz1], [ix0, Y, iz1], [ix1, Y, iz1], rgba(160, 120, 80));
  addQuad(m, [ix1, floor, iz0], [ix1, floor, iz1], [ix1, Y, iz1], [ix1, Y, iz0], rgba(140, 100, 68));
  addQuad(m, [ix0, floor, iz1], [ix0, floor, iz0], [ix0, Y, iz0], [ix0, Y, iz1], rgba(150, 108, 72));
  const fz = -4.3;
  for (let i = 0; i < 8; i++) {
    const a0 = (i / 8) * Math.PI * 2, a1 = ((i + 1) / 8) * Math.PI * 2;
    addQuad(m,
      [Math.cos(a0) * 0.34, floor, fz + Math.sin(a0) * 0.34],
      [Math.cos(a1) * 0.34, floor, fz + Math.sin(a1) * 0.34],
      [Math.cos(a1) * 0.28, 0.16, fz + Math.sin(a1) * 0.28],
      [Math.cos(a0) * 0.28, 0.16, fz + Math.sin(a0) * 0.28],
      rgba(228, 206, 176));
  }
  box(m, -0.07, floor, fz - 0.07, 0.07, 0.58, fz + 0.07, rgba(210, 186, 154));
  for (let i = 0; i < 6; i++) {
    const a0 = (i / 6) * Math.PI * 2, a1 = ((i + 1) / 6) * Math.PI * 2;
    addQuad(m,
      [Math.cos(a0) * 0.05, 0.58, fz + Math.sin(a0) * 0.05],
      [Math.cos(a1) * 0.05, 0.58, fz + Math.sin(a1) * 0.05],
      [Math.cos(a1) * 0.16, 0.7, fz + Math.sin(a1) * 0.16],
      [Math.cos(a0) * 0.16, 0.7, fz + Math.sin(a0) * 0.16],
      rgba(236, 220, 196));
  }
});
part('OA_water', true, m => {
  addQuad(m, [-1.22, -0.04, -3.64], [1.22, -0.04, -3.64], [1.22, -0.04, -4.96], [-1.22, -0.04, -4.96], rgba(56, 168, 176, 220), rgba(72, 186, 184, 220), rgba(36, 124, 150, 230), rgba(42, 140, 160, 230));
});
part('OA_spray', true, m => {
  const fz = -4.3;
  const drop = (dx, dz, y0, y1) => addQuad(m,
    [-0.035 + dx, y0, fz], [0.035 + dx, y0, fz], [0.05 + dx, y1, fz + dz], [-0.05 + dx, y1, fz + dz],
    rgba(210, 240, 238, 200), rgba(210, 240, 238, 200), rgba(230, 248, 244, 30), rgba(230, 248, 244, 30));
  drop(0, 0.28, 0.72, 0.05);
  drop(-0.22, -0.16, 0.7, 0.08);
  drop(0.22, -0.12, 0.7, 0.06);
  drop(-0.1, 0.16, 0.68, 0.12);
  drop(0.12, 0.1, 0.66, 0.1);
});

part('OA_canopy', false, m => {
  const cloth = rgba(168, 56, 46), saffron = rgba(214, 142, 52), post = rgba(112, 72, 44);
  const z0 = -6.15, z1 = -5.55, xL = -2.35, xR = 2.35;
  for (const x of [xL, xR]) {
    box(m, x - 0.055, Y, z0 - 0.055, x + 0.055, 1.7, z0 + 0.055, post);
    box(m, x - 0.055, Y, z1 - 0.055, x + 0.055, 1.52, z1 + 0.055, post);
  }
  box(m, xL, 1.6, z0 - 0.045, xR, 1.72, z0 + 0.045, post);
  const n = 7;
  for (let i = 0; i < n; i++) {
    const t0 = i / n, t1 = (i + 1) / n;
    const xa = xL + (xR - xL) * t0, xb = xL + (xR - xL) * t1;
    const sag = t => Math.sin(t * Math.PI) * 0.28;
    const yb0 = 1.66 - sag(t0), yb1 = 1.66 - sag(t1);
    const yf0 = 1.42 - sag(t0) * 0.85, yf1 = 1.42 - sag(t1) * 0.85;
    const col = i % 2 ? cloth : saffron;
    addQuad(m, [xa, yb0, z0], [xb, yb1, z0], [xb, yf1, z1], [xa, yf0, z1], mix(col, rgba(255, 220, 180), 0.1), col, mix(col, rgba(50, 16, 14), 0.2), col);
  }
});
part('OA_valance', true, m => {
  const z = -5.55, y = 1.4;
  for (let i = 0; i < 10; i++) {
    const x = -2.15 + i * 0.46;
    const col = i % 2 ? rgba(168, 56, 46, 235) : rgba(214, 142, 52, 235);
    addQuad(m, [x, y, z], [x + 0.22, y, z], [x + 0.18, y - 0.34, z + 0.03], [x + 0.04, y - 0.34, z + 0.03], col);
    addTri(m, [x + 0.04, y - 0.34, z + 0.03], [x + 0.18, y - 0.34, z + 0.03], [x + 0.11, y - 0.46, z + 0.04], col);
  }
});

part('OA_dunes', false, m => {
  const layers = [
    { z0: Z0, z1: -9.4, y0: 0, y1: 1.15, amp: 0.55, phase: 0.2, lit: rgba(232, 156, 86), shade: rgba(120, 72, 78) },
    { z0: -9.4, z1: -12.2, y0: 1.15, y1: 1.85, amp: 0.7, phase: 1.1, lit: rgba(214, 132, 78), shade: rgba(108, 64, 82) },
    { z0: -12.2, z1: -15.6, y0: 1.85, y1: 2.35, amp: 0.45, phase: 0.4, lit: rgba(232, 168, 120), shade: rgba(176, 120, 128) },
  ];
  const n = 14;
  for (const L of layers) {
    for (let i = 0; i < n; i++) {
      const t0 = i / n, t1 = (i + 1) / n;
      const x0 = -10 + 20 * t0, x1 = -10 + 20 * t1;
      const w0 = Math.sin(t0 * Math.PI * 2 + L.phase), w1 = Math.sin(t1 * Math.PI * 2 + L.phase);
      const yn0 = L.y0 + (L.z0 === Z0 ? 0 : w0 * L.amp * 0.15);
      const yn1 = L.y0 + (L.z0 === Z0 ? 0 : w1 * L.amp * 0.15);
      const yf0 = L.y1 + w0 * L.amp, yf1 = L.y1 + w1 * L.amp;
      addQuad(m, [x0, yn0, L.z0], [x1, yn1, L.z0], [x1, yf1, L.z1], [x0, yf0, L.z1], L.lit, L.lit, L.shade, L.shade);
    }
  }
  addQuad(m, [X1, Y, -2], [X1, Y, Z0], [9.4, 1.05, -8.5], [8.6, 0.55, -2.2], sandA, sandB, rgba(150, 96, 88), rgba(168, 112, 78));
  addQuad(m, [X0, Y, Z0], [X0, Y, -2], [-8.6, 0.65, -2.4], [-9.2, 1.15, -8.2], sandA, sandB, rgba(168, 112, 78), rgba(140, 88, 84));
});

part('OA_sky', true, m => {
  addQuad(m, [-18, 2.1, -15.4], [18, 2.1, -15.4], [14, 18, -16.2], [-14, 18, -16.2], rgba(244, 156, 96), rgba(232, 120, 84), rgba(120, 52, 84), rgba(58, 28, 62));
});
part('OA_sun', true, m => {
  const x = 1.55, y = 3.15, z = -15.15;
  const disc = (r, col, n) => {
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
      addTri(m, [x, y, z], [x + Math.cos(a0) * r, y + Math.sin(a0) * r, z], [x + Math.cos(a1) * r, y + Math.sin(a1) * r, z], col, col, col);
    }
  };
  disc(1.35, rgba(255, 186, 120, 70), 14);
  disc(0.72, rgba(255, 214, 150, 150), 12);
  disc(0.42, rgba(255, 236, 196), 10);
});

function pack() {
  const blobs = [], views = [], accessors = [], meshes = [], nodes = [{ name: 'env_oasis', children: [] }];
  let offset = 0;
  const align = n => { const m = (n - (offset % n)) % n; offset += m; if (m) blobs.push(Buffer.alloc(m)); };
  const pushArr = (arr, type, ctype) => {
    align(4);
    const buf = Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength);
    blobs.push(buf);
    views.push({ buffer: 0, byteOffset: offset, byteLength: buf.length, target: 34962 });
    const n = type === 'VEC4' ? 4 : type === 'VEC3' ? 3 : 1;
    const acc = { bufferView: views.length - 1, componentType: ctype, count: arr.length / n, type };
    if (ctype === 5121) acc.normalized = true;
    accessors.push(acc);
    offset += buf.length;
    return accessors.length - 1;
  };
  parts.forEach((p, pi) => {
    const pos = Float32Array.from(p.m.pos), nrm = Float32Array.from(p.m.nrm);
    const col = Uint8Array.from(p.m.col.map(v => Math.max(0, Math.min(255, Math.round(v)))));
    const startP = pushArr(pos, 'VEC3', 5126);
    pushArr(nrm, 'VEC3', 5126);
    pushArr(col, 'VEC4', 5121);
    align(2);
    const idx = Uint16Array.from(p.m.idx), ib = Buffer.from(idx.buffer, idx.byteOffset, idx.byteLength);
    blobs.push(ib);
    views.push({ buffer: 0, byteOffset: offset, byteLength: ib.length, target: 34963 });
    accessors.push({ bufferView: views.length - 1, componentType: 5123, count: idx.length, type: 'SCALAR' });
    offset += ib.length;
    meshes.push({ name: p.name, primitives: [{ attributes: { POSITION: startP, NORMAL: startP + 1, COLOR_0: startP + 2 }, indices: startP + 3, material: p.unlit ? 1 : 0 }] });
    nodes.push({ name: p.name, mesh: pi });
    nodes[0].children.push(nodes.length - 1);
  });
  const swayNode = nodes.findIndex(n => n.name === 'OA_valance');
  align(4);
  const times = Float32Array.from([0, 2.8, 5.6]);
  const values = Float32Array.from([0, 0, 0, 0.04, -0.03, 0.015, 0, 0, 0]);
  const tAcc = pushArr(times, 'SCALAR', 5126);
  const vAcc = pushArr(values, 'VEC3', 5126);
  accessors[tAcc].min = [0]; accessors[tAcc].max = [5.6];
  const materials = [
    { name: 'M_OA_vertex', doubleSided: true, pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], metallicFactor: 0, roughnessFactor: 1 } },
    { name: 'M_OA_unlit', doubleSided: true, alphaMode: 'BLEND', extensions: { KHR_materials_unlit: {} }, pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], metallicFactor: 0, roughnessFactor: 1 } },
  ];
  const json = {
    asset: { version: '2.0', generator: 'qf-env-oasis', extras: { license: 'original-procedural' } },
    extensionsUsed: ['KHR_materials_unlit'],
    scene: 0, scenes: [{ name: 'env_oasis', nodes: [0] }], nodes, meshes, materials,
    accessors, bufferViews: views, buffers: [{ byteLength: offset }],
    animations: [{ name: 'valance_sway', channels: [{ sampler: 0, target: { node: swayNode, path: 'translation' } }], samplers: [{ input: tAcc, output: vAcc, interpolation: 'LINEAR' }] }],
  };
  let text = Buffer.from(JSON.stringify(json)); while (text.length % 4) text = Buffer.concat([text, Buffer.from(' ')]);
  const bin = Buffer.concat(blobs); const binPad = (4 - (bin.length % 4)) % 4; const binChunk = Buffer.concat([bin, Buffer.alloc(binPad)]);
  const header = Buffer.alloc(12); header.writeUInt32LE(0x46546C67, 0); header.writeUInt32LE(2, 4);
  const jh = Buffer.alloc(8); jh.writeUInt32LE(text.length, 0); jh.writeUInt32LE(0x4E4F534A, 4);
  const bh = Buffer.alloc(8); bh.writeUInt32LE(binChunk.length, 0); bh.writeUInt32LE(0x004E4942, 4);
  const body = Buffer.concat([header, jh, text, bh, binChunk]); body.writeUInt32LE(body.length, 8);
  return body;
}

const body = pack();
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, body);
const tris = parts.reduce((n, p) => n + p.m.idx.length / 3, 0);
const counts = Object.fromEntries(parts.map(p => [p.name, p.m.idx.length / 3]));
console.log(JSON.stringify({ bytes: body.length, tris, counts, courtY: Y }, null, 2));
if (tris > 3000) throw Error('tris ' + tris);
