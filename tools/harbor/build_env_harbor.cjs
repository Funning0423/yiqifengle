'use strict';
// 白阶海港台地. Vertex colours only. The 7×7 is painted into the limestone
// terrace at y = 0. White cubes and blue domes sit on that same ground;
// the sea, islands and sun sit beyond the quay.
const fs = require('node:fs'), path = require('node:path');
const OUT = path.resolve(__dirname, '../../creator-build-project/assets/bundles/region_harbor/models/env_harbor.glb');
const Y = 0, X0 = -6.5, X1 = 6.5, Z0 = -7, Z1 = 7, HALF = 2.125;
const CELL = (HALF * 2) / 7, LINE = 0.026, BAND = 0.4;
const G0 = HALF + LINE * 0.5, G1 = G0 + BAND;
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
const parts = [];
function part(name, unlit, build) { const m = mesh(); build(m); parts.push({ name, unlit: !!unlit, m }); }

const slabA = rgba(246, 238, 224), slabB = rgba(238, 228, 210), joint = rgba(226, 214, 196);
const boardA = rgba(255, 251, 242), boardB = rgba(250, 244, 230), boardLine = rgba(232, 220, 202);
const glazeW = rgba(250, 252, 255), glazeB = rgba(18, 98, 214), glazeT = rgba(24, 168, 198);
const white = rgba(255, 252, 246), sunW = rgba(255, 232, 198), shadeW = rgba(246, 240, 230);
const coolW = rgba(236, 242, 248);
const dome = rgba(12, 102, 214), domeLit = rgba(56, 164, 242), domeShade = rgba(6, 68, 176);
const flower = rgba(220, 48, 112), flower2 = rgba(236, 96, 146), leaf = rgba(58, 150, 86), leafD = rgba(36, 112, 64);
const wood = rgba(176, 128, 78), woodD = rgba(140, 96, 58);
const hazeBlue = rgba(186, 208, 228);
const MILL = { x: 3.05, z: -4.7, y: -0.4 };
const TOWER = { x: -3.35, z: -4.55, y: -0.4 };

function faceBox(m, x0, y0, z0, x1, y1, z1, top, sun, shade, front) {
  addQuad(m, [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], top);
  addQuad(m, [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], shade);
  addQuad(m, [x1, y0, z1], [x1, y1, z1], [x1, y1, z0], [x1, y0, z0], sun);
  addQuad(m, [x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1], shade);
  addQuad(m, [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], front || sunW);
  addQuad(m, [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], shade);
}
function slab(m, x0, x1, z0, z1, a, b, seam) {
  if (x1 - x0 < 0.08 || z1 - z0 < 0.08) return;
  const nx = Math.max(1, Math.round((x1 - x0) / 1.45)), nz = Math.max(1, Math.round((z1 - z0) / 1.45));
  const g = 0.016;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const ax = x0 + (x1 - x0) * i / nx, bx = x0 + (x1 - x0) * (i + 1) / nx;
    const az = z0 + (z1 - z0) * j / nz, bz = z0 + (z1 - z0) * (j + 1) / nz;
    const ix0 = i === 0 ? ax : ax + g, ix1 = i === nx - 1 ? bx : bx - g;
    const iz0 = j === 0 ? az : az + g, iz1 = j === nz - 1 ? bz : bz - g;
    addQuad(m, [ix0, Y, iz1], [ix1, Y, iz1], [ix1, Y, iz0], [ix0, Y, iz0], (i + j) % 2 ? a : b);
    if (i > 0) addQuad(m, [ax, Y, iz0], [ax + g, Y, iz0], [ax + g, Y, iz1], [ax, Y, iz1], seam);
    if (j > 0) addQuad(m, [ix0, Y, az], [ix1, Y, az], [ix1, Y, az + g], [ix0, Y, az + g], seam);
  }
}
function glaze(m, x0, x1, z0, z1, row) {
  const n = Math.max(3, Math.round(Math.max(x1 - x0, z1 - z0) / 0.28));
  const alongX = (x1 - x0) >= (z1 - z0);
  for (let i = 0; i < n; i++) {
    const t0 = i / n, t1 = (i + 1) / n;
    const col = (i + row) % 5 === 0 ? glazeT : (i + row) % 2 ? glazeB : glazeW;
    if (alongX) {
      const a = x0 + (x1 - x0) * t0, b = x0 + (x1 - x0) * t1;
      addQuad(m, [a, Y, z1], [b, Y, z1], [b, Y, z0], [a, Y, z0], col);
    } else {
      const a = z0 + (z1 - z0) * t0, b = z0 + (z1 - z0) * t1;
      addQuad(m, [x0, Y, b], [x1, Y, b], [x1, Y, a], [x0, Y, a], col);
    }
  }
}

part('HB_ground', false, m => {
  const zDrop = -2.55;
  slab(m, X0, -G1, zDrop, Z1, slabA, slabB, joint);
  slab(m, G1, X1, zDrop, Z1, slabA, slabB, joint);
  slab(m, -G1, G1, G1, Z1, slabA, slabB, joint);
  addQuad(m, [X0, Y, Z0], [X0 + 0.04, Y, Z0], [X0 + 0.04, Y, Z0 + 0.04], [X0, Y, Z0 + 0.04], slabA);
  addQuad(m, [X1 - 0.04, Y, Z0], [X1, Y, Z0], [X1, Y, Z0 + 0.04], [X1 - 0.04, Y, Z0 + 0.04], slabA);
  glaze(m, -HALF, HALF, HALF, G1, 0);
  glaze(m, -HALF, HALF, -G1, -HALF, 1);
  glaze(m, -G1, -HALF, -HALF, HALF, 2);
  glaze(m, HALF, G1, -HALF, HALF, 3);
  const edges = [];
  for (let i = 0; i <= 7; i++) edges.push(i === 7 ? HALF : -HALF + i * CELL);
  const hL = LINE * 0.5;
  for (let row = 0; row < 7; row++) for (let col = 0; col < 7; col++) {
    const colr = (row + col) % 2 ? boardA : boardB;
    const a = edges[col] + hL, b = edges[col + 1] - hL, c = edges[row] + hL, d = edges[row + 1] - hL;
    addQuad(m, [a, Y, d], [b, Y, d], [b, Y, c], [a, Y, c], colr);
  }
  for (let i = 0; i <= 7; i++) {
    const x = edges[i];
    addQuad(m, [x - hL, Y, -HALF], [x + hL, Y, -HALF], [x + hL, Y, HALF], [x - hL, Y, HALF], boardLine);
  }
  for (let row = 0; row <= 7; row++) for (let col = 0; col < 7; col++) {
    const z = edges[row], a = edges[col] + hL, b = edges[col + 1] - hL;
    addQuad(m, [a, Y, z - hL], [b, Y, z - hL], [b, Y, z + hL], [a, Y, z + hL], boardLine);
  }
});

function dome6(m, x, z, y, r, h, col, lit, shade) {
  const n = 6, rings = [0, 0.42, 0.78, 1];
  const rad = [r, r * 0.86, r * 0.46, r * 0.08];
  const ring = k => Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 + 0.2;
    return [x + Math.cos(a) * rad[k], y + h * rings[k], z + Math.sin(a) * rad[k]];
  });
  const R = rings.map((_, k) => ring(k));
  for (let k = 0; k < 3; k++) for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const c = i < n / 2 ? lit : i === n - 1 ? shade : col;
    addQuad(m, R[k][i], R[k][j], R[k + 1][j], R[k + 1][i], c);
  }
}

function windowQ(m, x0, y0, z, x1, y1, col) {
  addQuad(m, [x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z], col);
}
function villa(m, x, z, w, d, h, opts) {
  const o = opts || {};
  const haze = o.haze || 0, y0 = o.y0 || 0;
  const top = mix(white, hazeBlue, haze * 0.85);
  const sun = mix(sunW, hazeBlue, haze * 0.45);
  const shade = mix(coolW, hazeBlue, haze * 0.7);
  const front = mix(rgba(255, 250, 242), hazeBlue, haze * 0.55);
  faceBox(m, x, y0, z, x + w, y0 + h, z + d, top, sun, shade, front);
  const cap = mix(glazeB, rgba(70, 150, 230), haze * 0.35);
  faceBox(m, x - 0.035, y0 + h, z - 0.035, x + w + 0.035, y0 + h + 0.055, z + d + 0.035, cap, mix(cap, domeLit, 0.35), mix(cap, domeShade, 0.25), cap);
  if (o.dome) {
    const dc = mix(dome, rgba(80, 150, 220), haze * 0.28);
    dome6(m, x + w * 0.5, z + d * 0.5, y0 + h + 0.055, Math.min(w, d) * 0.36, o.domeH || 0.7, dc, mix(domeLit, rgba(140, 200, 245), haze * 0.2), mix(domeShade, rgba(40, 90, 170), haze * 0.15));
  }
  const wz = z + d + 0.02;
  const win = mix(rgba(255, 220, 160), hazeBlue, haze * 0.4);
  const shut = mix(glazeB, rgba(70, 150, 230), haze * 0.25);
  if (h > 0.85) {
    windowQ(m, x + w * 0.22, y0 + h * 0.48, wz, x + w * 0.42, y0 + h * 0.74, win);
    windowQ(m, x + w * 0.58, y0 + h * 0.48, wz, x + w * 0.78, y0 + h * 0.74, win);
    windowQ(m, x + w * 0.18, y0 + h * 0.45, wz + 0.001, x + w * 0.22, y0 + h * 0.77, shut);
    windowQ(m, x + w * 0.78, y0 + h * 0.45, wz + 0.001, x + w * 0.82, y0 + h * 0.77, shut);
  }
  if (o.door) windowQ(m, x + w * 0.4, y0 + 0.02, wz, x + w * 0.6, y0 + h * 0.38, mix(wood, hazeBlue, haze * 0.3));
}

part('HB_houses', false, m => {
  villa(m, -3.55, -2.72, 1.15, 0.95, 1.45, { dome: true, door: true, domeH: 0.5 });
  villa(m, -3.2, -4.05, 1.0, 0.82, 1.1, { dome: true, door: true, y0: -0.4, haze: 0.1, domeH: 0.4 });
  villa(m, -2.95, -5.45, 0.85, 0.68, 0.82, { y0: -0.9, haze: 0.34, dome: true, domeH: 0.3 });
  villa(m, 2.4, -2.7, 1.12, 0.92, 1.38, { dome: true, door: true, domeH: 0.48 });
  villa(m, 2.65, -4.1, 0.95, 0.78, 1.02, { dome: true, y0: -0.4, haze: 0.12, domeH: 0.38 });
  villa(m, 2.5, -5.5, 0.8, 0.65, 0.78, { y0: -0.9, haze: 0.36 });
});

part('HB_stairs', false, m => {
  const flight = (x, z, yBase, drop, n, w) => {
    const run = 0.58;
    for (let i = 0; i < n; i++) {
      const y1 = yBase - drop * i, y0 = y1 - drop;
      const az = z - run * i;
      faceBox(m, x, y0, az - run, x + w, y1, az, white, sunW, rgba(186, 208, 224), rgba(255, 252, 246));
    }
  };
  flight(-2.92, 1.05, 0.08, 0.22, 6, 0.5);
  flight(2.42, 1.0, 0.08, 0.22, 6, 0.5);
  for (let i = 0; i < 4; i++) {
    const z = -2.62 - i * 0.46, y1 = -0.02 - i * 0.16, y0 = y1 - 0.16;
    faceBox(m, -2.2, y0, z - 0.46, -1.05, y1, z, white, sunW, rgba(168, 198, 220), rgba(255, 252, 246));
    faceBox(m, 1.05, y0, z - 0.46, 2.2, y1, z, white, sunW, rgba(168, 198, 220), rgba(255, 252, 246));
  }
  const cap = (x, z0, z1) => {
    const t = 0.07, h = 0.11, yb = 0.07;
    faceBox(m, x - t, Y, z0, x + t, yb, z1, white, sunW, shadeW, white);
    const n = 3;
    for (let i = 0; i < n; i++) {
      const a0 = Math.PI * i / n, a1 = Math.PI * (i + 1) / n;
      const x0 = x + Math.cos(a0) * t, x1 = x + Math.cos(a1) * t;
      const y0 = yb + Math.sin(a0) * h, y1 = yb + Math.sin(a1) * h;
      addQuad(m, [x0, y0, z1], [x1, y1, z1], [x1, y1, z0], [x0, y0, z0], i === n - 1 ? sunW : white);
    }
  };
  cap(-2.42, -1.7, -0.35);
  cap(-2.42, 0.25, 1.55);
  cap(2.42, -1.65, -0.3);
  cap(2.42, 0.3, 1.6);
});

part('HB_tower', false, m => {
  const tx = TOWER.x, tz = TOWER.z, ty = TOWER.y;
  faceBox(m, tx, ty, tz, tx + 0.95, ty + 2.15, tz + 0.85, white, sunW, coolW, rgba(255, 250, 242));
  faceBox(m, tx - 0.04, ty + 2.15, tz - 0.04, tx + 0.99, ty + 2.24, tz + 0.89, glazeB, domeLit, domeShade, glazeB);
  dome6(m, tx + 0.48, tz + 0.42, ty + 2.24, 0.4, 0.55, dome, domeLit, domeShade);
  const fx = tx + 0.48, fz = tz + 0.87, fy = ty + 1.35;
  const disc = (r, col, n) => {
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
      addTri(m, [fx, fy, fz], [fx + Math.cos(a0) * r, fy + Math.sin(a0) * r, fz], [fx + Math.cos(a1) * r, fy + Math.sin(a1) * r, fz], col);
    }
  };
  disc(0.22, rgba(18, 86, 190), 8);
  disc(0.16, rgba(255, 250, 240), 8);
  addQuad(m, [fx - 0.02, fy - 0.02, fz + 0.01], [fx + 0.02, fy - 0.02, fz + 0.01], [fx + 0.05, fy + 0.16, fz + 0.01], [fx - 0.01, fy + 0.16, fz + 0.01], rgba(42, 56, 78));
  addQuad(m, [fx - 0.02, fy, fz + 0.012], [fx + 0.14, fy - 0.02, fz + 0.012], [fx + 0.16, fy + 0.02, fz + 0.012], [fx, fy + 0.04, fz + 0.012], rgba(42, 56, 78));
  const mx = MILL.x, mz = MILL.z, my = MILL.y;
  const sides = 6, th = 1.75;
  for (let s = 0; s < 2; s++) {
    const y0 = my + th * s / 2, y1 = my + th * (s + 1) / 2, r0 = 0.38 - s * 0.03, r1 = 0.34 - s * 0.03;
    for (let i = 0; i < sides; i++) {
      const a0 = (i / sides) * Math.PI * 2, a1 = ((i + 1) / sides) * Math.PI * 2;
        const c = i < 3 ? sunW : coolW;
      addQuad(m,
        [mx + Math.cos(a0) * r0, y0, mz + Math.sin(a0) * r0],
        [mx + Math.cos(a1) * r0, y0, mz + Math.sin(a1) * r0],
        [mx + Math.cos(a1) * r1, y1, mz + Math.sin(a1) * r1],
        [mx + Math.cos(a0) * r1, y1, mz + Math.sin(a0) * r1], c);
    }
  }
  dome6(m, mx, mz, my + th, 0.42, 0.48, wood, mix(wood, sunW, 0.4), woodD);
});

part('HB_sails', false, m => {
  const mx = MILL.x, mz = MILL.z, y = MILL.y + 1.15;
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    const dx = Math.cos(a), dy = Math.sin(a), px = -dy, py = dx;
    const p = (k, s) => [mx + dx * k + px * s, y + dy * k + py * s, mz + 0.05];
    addQuad(m, p(0.18, 0.08), p(1.15, 0.16), p(1.15, -0.16), p(0.18, -0.08), i % 2 ? rgba(252, 248, 240) : rgba(244, 236, 220));
    addQuad(m, p(1.15, 0.16), p(1.35, 0.1), p(1.35, -0.1), p(1.15, -0.16), glazeB);
  }
  faceBox(m, mx - 0.08, y - 0.08, mz - 0.08, mx + 0.08, y + 0.08, mz + 0.1, wood, sunW, woodD, wood);
});

part('HB_bough', true, m => {
  const pot = (x, z) => {
    const n = 6, h = 0.22, r = 0.16;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
      addQuad(m,
        [x + Math.cos(a0) * r * 0.7, 0.02, z + Math.sin(a0) * r * 0.7],
        [x + Math.cos(a1) * r * 0.7, 0.02, z + Math.sin(a1) * r * 0.7],
        [x + Math.cos(a1) * r, h, z + Math.sin(a1) * r],
        [x + Math.cos(a0) * r, h, z + Math.sin(a0) * r],
        rgba(255, 250, 242));
    }
    const bloom = (dx, dy, dz, s, col) => {
      addQuad(m, [x + dx - s, dy, z + dz], [x + dx + s, dy, z + dz], [x + dx + s * 0.4, dy + s * 1.1, z + dz + 0.02], [x + dx - s * 0.4, dy + s * 1.1, z + dz + 0.02], col);
      addTri(m, [x + dx, dy + s * 0.2, z + dz + 0.03], [x + dx + s, dy + s * 0.15, z + dz], [x + dx + s * 0.1, dy + s * 0.9, z + dz + 0.04], mix(col, flower2, 0.35));
    };
    bloom(0, h, 0.02, 0.11, flower);
    bloom(0.08, h + 0.02, -0.02, 0.09, flower2);
    bloom(-0.07, h, 0.04, 0.08, flower);
    addTri(m, [x, h, z], [x + 0.14, h + 0.08, z + 0.06], [x - 0.02, h + 0.1, z + 0.02], leaf);
    addTri(m, [x, h + 0.02, z], [x - 0.12, h + 0.06, z + 0.05], [x - 0.02, h + 0.12, z], leafD);
  };
  pot(-1.55, 3.5);
  pot(1.55, 3.55);
});

part('HB_sea', true, m => {
  addQuad(m, [-1.2, -0.28, -2.7], [1.2, -0.28, -2.7], [1.35, -1.5, -6.35], [-1.35, -1.5, -6.35], rgba(86, 214, 224), rgba(86, 214, 224), rgba(18, 132, 204), rgba(18, 132, 204));
  const layers = [
    { z0: -6.35, z1: -10.2, y0: -1.55, y1: -1.5, lit: rgba(28, 188, 216), shade: rgba(10, 138, 200), n: 14 },
    { z0: -10.2, z1: -14.2, y0: -1.5, y1: -1.44, lit: rgba(20, 120, 204), shade: rgba(14, 88, 174), n: 10 },
    { z0: -14.2, z1: -19.6, y0: -1.44, y1: -1.38, lit: rgba(118, 164, 208), shade: rgba(156, 186, 214), n: 8 },
  ];
  for (const L of layers) for (let i = 0; i < L.n; i++) {
    const t0 = i / L.n, t1 = (i + 1) / L.n;
    const x0 = -12 + 24 * t0, x1 = -12 + 24 * t1;
    const w0 = Math.sin(t0 * Math.PI * 3.2) * 0.06, w1 = Math.sin(t1 * Math.PI * 3.2) * 0.06;
    addQuad(m, [x0, L.y0 + w0, L.z0], [x1, L.y0 + w1, L.z0], [x1, L.y1, L.z1], [x0, L.y1, L.z1], L.lit, L.lit, L.shade, L.shade);
  }
  for (const [x, z, s, y] of [[-0.15, -7.1, 0.85, -1.5], [0.85, -8.6, 0.6, -1.48], [-0.7, -10.4, 0.55, -1.46], [0.4, -12.6, 0.45, -1.44], [1.15, -15.2, 0.35, -1.4]]) {
    addQuad(m, [x, y, z], [x + 0.42 * s, y, z + 0.06], [x + 0.55 * s, y + 0.02, z + 0.2], [x + 0.06 * s, y + 0.02, z + 0.14], rgba(236, 250, 252, 210));
  }
});

part('HB_islands', true, m => {
  const volcano = (x, z, r, h, yb, lit, shade) => {
    const n = 7;
    const ring = (rad, y) => Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2 + 0.3;
      return [x + Math.cos(a) * rad, y, z + Math.sin(a) * rad];
    });
    const A = ring(r, yb), B = ring(r * 0.7, yb + h * 0.38), C = ring(r * 0.32, yb + h * 0.72);
    const P = [x - r * 0.08, yb + h, z - r * 0.15];
    addQuad(m, [x - r, yb, z + r * 0.15], [x + r * 0.35, yb, z + r * 0.45], [x + r * 0.1, yb + h * 0.62, z - r * 0.05], [x - r * 0.55, yb + h * 0.7, z - r * 0.2], shade, shade, lit, lit);
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const col = i < n * 0.45 ? lit : shade;
      addQuad(m, A[i], A[j], B[j], B[i], col);
      addQuad(m, B[i], B[j], C[j], C[i], mix(col, lit, 0.3));
      addTri(m, C[i], C[j], P, lit);
    }
  };
  volcano(-2.6, -9.2, 1.35, 1.05, -1.5, rgba(232, 220, 208), rgba(140, 168, 204));
  volcano(-6.2, -11.2, 2.4, 1.85, -1.5, rgba(228, 216, 204), rgba(142, 168, 204));
  volcano(6.4, -12.6, 1.9, 1.45, -1.48, rgba(206, 214, 224), rgba(140, 170, 208));
  volcano(-2.4, -16.2, 2.4, 0.72, -1.42, rgba(168, 196, 224), rgba(132, 164, 204));
  volcano(2.1, -17.4, 2.8, 0.58, -1.4, rgba(186, 208, 228), rgba(148, 176, 210));
});

function boat(m, x, z, s, haze) {
  const hull = mix(rgba(246, 242, 232), rgba(180, 184, 196), haze);
  const sail = mix(rgba(255, 252, 246), rgba(200, 204, 214), haze);
  const woodC = mix(wood, rgba(160, 164, 176), haze);
  const y0 = -1.42;
  faceBox(m, x - 0.45 * s, y0, z - 0.12 * s, x + 0.45 * s, y0 + 0.14 * s, z + 0.12 * s, hull, hull, mix(hull, shadeW, 0.3), hull);
  addQuad(m, [x - 0.08 * s, y0 + 0.14 * s, z], [x + 0.02 * s, y0 + 0.14 * s, z], [x + 0.02 * s, y0 + 0.92 * s, z], [x - 0.08 * s, y0 + 0.92 * s, z], woodC);
  addQuad(m, [x, y0 + 0.86 * s, z], [x + 0.55 * s, y0 + 0.22 * s, z], [x + 0.5 * s, y0 + 0.16 * s, z + 0.02], [x, y0 + 0.24 * s, z], sail);
  addQuad(m, [x, y0 + 0.82 * s, z], [x - 0.28 * s, y0 + 0.34 * s, z], [x - 0.24 * s, y0 + 0.3 * s, z], [x, y0 + 0.38 * s, z], mix(sail, rgba(220, 230, 240), 0.2));
}
part('HB_boats', true, m => {
  boat(m, 0.05, -7.4, 0.7, 0);
  boat(m, -0.7, -10.6, 0.5, 0.3);
  boat(m, 1.15, -14.2, 0.38, 0.55);
});

part('HB_cliffs', false, m => {
  const shelf = (x0, x1, z0, z1, y0, y1, lit, shade) => {
    addQuad(m, [x0, y0, z0], [x1, y0, z0], [x1, y1, z1], [x0, y1, z1], lit, lit, shade, shade);
  };
  const lime = rgba(255, 252, 246), warm = rgba(255, 236, 214), far = rgba(232, 238, 244);
  shelf(-6.2, -2.35, -2.55, -3.85, 0, -0.55, lime, warm);
  shelf(-5.6, -2.4, -3.85, -5.15, -0.55, -1.15, mix(lime, far, 0.18), mix(warm, far, 0.25));
  shelf(-5.1, -2.5, -5.15, -7.3, -1.15, -1.45, mix(lime, far, 0.4), far);
  shelf(2.35, 6.2, -2.55, -3.9, 0, -0.55, lime, warm);
  shelf(2.45, 5.8, -3.9, -5.2, -0.55, -1.15, mix(lime, far, 0.18), mix(warm, far, 0.25));
  shelf(2.55, 5.4, -5.2, -7.35, -1.15, -1.45, mix(lime, far, 0.4), far);
  shelf(-11.2, -6.2, -2.2, -11.5, 0, -1.2, lime, far);
  shelf(6.2, 11.2, -2.2, -11.8, 0, -1.25, warm, far);
});

part('HB_sky', true, m => {
  addQuad(m, [-20, 1.2, -19.2], [20, 1.2, -19.2], [16, 16, -20], [-16, 16, -20], rgba(255, 166, 112), rgba(255, 148, 104), rgba(120, 78, 150), rgba(72, 58, 132));
});
part('HB_sun', true, m => {
  const x = 3.4, y = 5.35, z = -18.6;
  const disc = (r, col, n) => {
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
      addTri(m, [x, y, z], [x + Math.cos(a0) * r, y + Math.sin(a0) * r, z], [x + Math.cos(a1) * r, y + Math.sin(a1) * r, z], col, col, col);
    }
  };
  disc(1.55, rgba(255, 176, 112, 55), 14);
  disc(0.86, rgba(255, 206, 140, 130), 12);
  disc(0.46, rgba(255, 244, 214), 10);
});

function pack() {
  const blobs = [], views = [], accessors = [], meshes = [], nodes = [{ name: 'env_harbor', children: [] }];
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
  const swayNode = nodes.findIndex(n => n.name === 'HB_bough');
  align(4);
  const times = Float32Array.from([0, 2.6, 5.2]);
  const values = Float32Array.from([0, 0, 0, 0.03, -0.02, 0.012, 0, 0, 0]);
  const tAcc = pushArr(times, 'SCALAR', 5126);
  const vAcc = pushArr(values, 'VEC3', 5126);
  accessors[tAcc].min = [0]; accessors[tAcc].max = [5.2];
  const materials = [
    { name: 'M_HB_vertex', doubleSided: true, pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], metallicFactor: 0, roughnessFactor: 1 } },
    { name: 'M_HB_unlit', doubleSided: true, alphaMode: 'BLEND', extensions: { KHR_materials_unlit: {} }, pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], metallicFactor: 0, roughnessFactor: 1 } },
  ];
  const json = {
    asset: { version: '2.0', generator: 'qf-env-harbor', extras: { license: 'original-procedural' } },
    extensionsUsed: ['KHR_materials_unlit'],
    scene: 0, scenes: [{ name: 'env_harbor', nodes: [0] }], nodes, meshes, materials,
    accessors, bufferViews: views, buffers: [{ byteLength: offset }],
    animations: [{ name: 'bough_sway', channels: [{ sampler: 0, target: { node: swayNode, path: 'translation' } }], samplers: [{ input: tAcc, output: vAcc, interpolation: 'LINEAR' }] }],
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
