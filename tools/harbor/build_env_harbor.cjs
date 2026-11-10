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

const slabA = rgba(238, 228, 210), slabB = rgba(228, 216, 196), joint = rgba(214, 202, 184);
const boardA = rgba(252, 247, 236), boardB = rgba(246, 239, 224), boardLine = rgba(226, 214, 196);
const glazeW = rgba(246, 248, 252), glazeB = rgba(36, 96, 186), glazeT = rgba(52, 164, 186);
const white = rgba(250, 246, 238), sunW = rgba(255, 238, 214), shadeW = rgba(206, 214, 226);
const dome = rgba(32, 88, 176), domeLit = rgba(86, 146, 214), domeShade = rgba(24, 58, 128);
const flower = rgba(214, 52, 108), flower2 = rgba(232, 104, 148), leaf = rgba(64, 142, 88), leafD = rgba(42, 108, 68);
const wood = rgba(168, 122, 78), woodD = rgba(132, 92, 58);

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
  slab(m, X0, -G1, Z0, Z1, slabA, slabB, joint);
  slab(m, G1, X1, Z0, Z1, slabA, slabB, joint);
  slab(m, -G1, G1, Z0, -G1, slabB, slabA, joint);
  slab(m, -G1, G1, G1, Z1, slabA, slabB, joint);
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
  faceBox(m, x - 0.045, y + h, z - 0.045, x + 0.045, y + h + 0.16, z + 0.045, white, sunW, shadeW, white);
  faceBox(m, x - 0.015, y + h + 0.16, z - 0.09, x + 0.015, y + h + 0.34, z + 0.09, white, sunW, shadeW, white);
  faceBox(m, x - 0.07, y + h + 0.24, z - 0.015, x + 0.07, y + h + 0.27, z + 0.015, white, sunW, shadeW, white);
}

function windowQ(m, x0, y0, z, x1, y1, col) {
  addQuad(m, [x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z], col);
}
function villa(m, x, z, w, d, h, opts) {
  const o = opts || {};
  const haze = o.haze || 0;
  const top = mix(white, rgba(214, 210, 220), haze);
  const sun = mix(sunW, rgba(210, 206, 214), haze);
  const shade = mix(shadeW, rgba(176, 184, 204), haze * 0.65);
  const front = mix(rgba(255, 244, 228), rgba(214, 210, 220), haze);
  faceBox(m, x, Y, z, x + w, h, z + d, top, sun, shade, front);
  const cap = mix(glazeB, rgba(150, 160, 186), haze);
  faceBox(m, x - 0.04, h, z - 0.04, x + w + 0.04, h + 0.06, z + d + 0.04, cap, mix(cap, sunW, 0.35), mix(cap, shade, 0.2), cap);
  if (o.dome) {
    const dc = mix(dome, rgba(140, 156, 186), haze);
    dome6(m, x + w * 0.5, z + d * 0.5, h + 0.06, Math.min(w, d) * 0.34, o.domeH || 0.72, dc, mix(domeLit, rgba(180, 190, 210), haze), mix(domeShade, rgba(120, 130, 160), haze));
  }
  const wz = z + d + 0.02;
  const win = mix(rgba(255, 214, 150), rgba(180, 190, 210), haze);
  const shut = mix(glazeB, rgba(140, 156, 186), haze);
  if (h > 0.9) {
    windowQ(m, x + w * 0.22, h * 0.45, wz, x + w * 0.42, h * 0.72, win);
    windowQ(m, x + w * 0.58, h * 0.45, wz, x + w * 0.78, h * 0.72, win);
    windowQ(m, x + w * 0.18, h * 0.42, wz + 0.001, x + w * 0.22, h * 0.75, shut);
    windowQ(m, x + w * 0.78, h * 0.42, wz + 0.001, x + w * 0.82, h * 0.75, shut);
  }
  if (o.door) windowQ(m, x + w * 0.4, 0.02, wz, x + w * 0.6, h * 0.38, mix(wood, rgba(160, 160, 176), haze));
}

part('HB_houses', false, m => {
  villa(m, -3.15, -3.55, 1.28, 1.15, 1.65, { dome: true, door: true, domeH: 0.58 });
  villa(m, -2.95, -5.05, 1.42, 1.05, 2.25, { dome: true, door: true, domeH: 0.7 });
  villa(m, -0.85, -4.85, 1.7, 1.05, 1.05, { dome: true, haze: 0.12, domeH: 0.78 });
  villa(m, 1.55, -3.45, 1.35, 1.15, 1.55, { dome: true, door: true, domeH: 0.55 });
  villa(m, 1.75, -4.95, 1.4, 1.05, 2.05, { dome: true, door: true, domeH: 0.66 });
  villa(m, -1.55, -6.15, 1.15, 0.7, 0.72, { haze: 0.42 });
  villa(m, 0.55, -6.25, 1.2, 0.62, 0.62, { haze: 0.5, dome: true, domeH: 0.38 });
  faceBox(m, -3.28, 1.65, -3.05, -2.95, 2.15, -2.72, white, sunW, shadeW, white);
  faceBox(m, 2.55, 2.05, -4.55, 2.88, 2.48, -4.22, white, sunW, shadeW, white);
});

part('HB_stairs', false, m => {
  const flight = (x, z, dx, dz, n, w) => {
    for (let i = 0; i < n; i++) {
      const y0 = i * 0.14, y1 = y0 + 0.14;
      const ax = x + dx * i, az = z + dz * i;
      const zLo = Math.min(az, az + dz), zHi = Math.max(az, az + dz) + 0.22;
      faceBox(m, ax, y0, zLo, ax + w, y1, zHi, i % 2 ? white : sunW, sunW, shadeW, white);
    }
  };
  flight(-2.68, -2.55, 0, -0.3, 6, 0.46);
  flight(2.22, -2.55, 0, -0.3, 6, 0.46);
  faceBox(m, -2.58, Y, -2.35, -2.28, 0.32, 2.35, white, sunW, shadeW, sunW);
  faceBox(m, 2.28, Y, -2.35, 2.58, 0.32, 2.35, white, sunW, shadeW, sunW);
  faceBox(m, -1.7, Y, 2.72, 1.7, 0.36, 2.98, white, sunW, shadeW, sunW);
  for (const x of [-1.85, -0.55, 0.55, 1.55]) faceBox(m, x, 0.36, 2.68, x + 0.26, 0.56, 3.02, white, sunW, shadeW, sunW);
});

part('HB_tower', false, m => {
  faceBox(m, -2.72, Y, -6.35, -1.55, 3.05, -5.15, white, sunW, shadeW, rgba(255, 244, 226));
  faceBox(m, -2.82, 3.05, -6.45, -1.45, 3.18, -5.05, mix(glazeB, white, 0.35), sunW, shadeW, glazeB);
  dome6(m, -2.14, -5.75, 3.18, 0.52, 0.72, dome, domeLit, domeShade);
  const fx = -2.14, fz = -5.13, fy = 2.05;
  const disc = (r, col, n) => {
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
      addTri(m, [fx, fy, fz], [fx + Math.cos(a0) * r, fy + Math.sin(a0) * r, fz], [fx + Math.cos(a1) * r, fy + Math.sin(a1) * r, fz], col);
    }
  };
  disc(0.34, rgba(36, 78, 150), 8);
  disc(0.26, rgba(252, 246, 234), 8);
  addQuad(m, [fx - 0.02, fy - 0.02, fz + 0.01], [fx + 0.02, fy - 0.02, fz + 0.01], [fx + 0.05, fy + 0.16, fz + 0.01], [fx - 0.01, fy + 0.16, fz + 0.01], rgba(42, 56, 78));
  addQuad(m, [fx - 0.02, fy, fz + 0.012], [fx + 0.14, fy - 0.02, fz + 0.012], [fx + 0.16, fy + 0.02, fz + 0.012], [fx, fy + 0.04, fz + 0.012], rgba(42, 56, 78));
  const mx = 2.35, mz = -5.85;
  const sides = 6, th = 2.35;
  for (let s = 0; s < 2; s++) {
    const y0 = th * s / 2, y1 = th * (s + 1) / 2, r0 = 0.42 - s * 0.04, r1 = 0.38 - s * 0.04;
    for (let i = 0; i < sides; i++) {
      const a0 = (i / sides) * Math.PI * 2, a1 = ((i + 1) / sides) * Math.PI * 2;
      const c = i < 3 ? sunW : shadeW;
      addQuad(m,
        [mx + Math.cos(a0) * r0, y0, mz + Math.sin(a0) * r0],
        [mx + Math.cos(a1) * r0, y0, mz + Math.sin(a1) * r0],
        [mx + Math.cos(a1) * r1, y1, mz + Math.sin(a1) * r1],
        [mx + Math.cos(a0) * r1, y1, mz + Math.sin(a0) * r1], c);
    }
  }
  dome6(m, mx, mz, th, 0.48, 0.55, wood, mix(wood, sunW, 0.35), woodD);
});

part('HB_sails', false, m => {
  const mx = 2.35, mz = -5.85, y = 2.15;
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
  const z = 3.55, y = 1.28;
  const bloom = (x, yy, zz, s, col) => {
    addQuad(m, [x - s, yy, zz], [x + s, yy, zz], [x + s * 0.7, yy + s * 1.35, zz + 0.04], [x - s * 0.7, yy + s * 1.35, zz + 0.04], col);
    addQuad(m, [x, yy, zz - s * 0.55], [x, yy, zz + s * 0.55], [x + 0.04, yy + s * 1.2, zz + s * 0.2], [x + 0.04, yy + s * 1.2, zz - s * 0.35], mix(col, rgba(255, 186, 198), 0.35));
    addTri(m, [x - s * 0.2, yy + s * 0.45, zz + 0.05], [x + s * 0.85, yy + s * 0.2, zz + 0.08], [x + s * 0.15, yy + s * 1.15, zz + 0.1], mix(col, flower2, 0.4));
  };
  for (const x of [-1.55, 1.55]) faceBox(m, x - 0.06, Y, z - 0.06, x + 0.06, y, z + 0.06, white, white, shadeW, white);
  faceBox(m, -1.6, y - 0.05, z - 0.05, 1.6, y + 0.05, z + 0.05, white, white, shadeW, white);
  for (let i = 0; i < 8; i++) {
    const x = -1.35 + i * 0.38;
    bloom(x, y - 0.02, z + 0.08, 0.16, i % 2 ? flower : flower2);
    if (i % 2 === 0) addTri(m, [x, y + 0.02, z], [x + 0.22, y + 0.16, z + 0.1], [x - 0.08, y + 0.14, z + 0.06], leaf);
  }
  for (const x of [-1.55, 1.55]) {
    bloom(x, 0.72, z + 0.1, 0.18, flower);
    bloom(x + (x < 0 ? 0.18 : -0.18), 0.95, z + 0.16, 0.14, flower2);
    addTri(m, [x, 0.55, z + 0.12], [x + 0.28, 0.85, z + 0.22], [x - 0.05, 0.8, z + 0.18], leaf);
    addTri(m, [x, 0.7, z + 0.16], [x + 0.16, 0.48, z + 0.28], [x - 0.12, 0.5, z + 0.24], leafD);
  }
  bloom(-0.15, 0.42, 3.15, 0.2, flower);
  bloom(0.35, 0.38, 3.22, 0.16, flower2);
});

part('HB_sea', true, m => {
  const layers = [
    { z0: -7.55, z1: -10.6, y0: -0.2, y1: -0.28, lit: rgba(64, 186, 204), shade: rgba(36, 140, 176), n: 12 },
    { z0: -10.6, z1: -14.4, y0: -0.28, y1: -0.36, lit: rgba(40, 132, 188), shade: rgba(28, 96, 160), n: 10 },
    { z0: -14.4, z1: -19.5, y0: -0.36, y1: -0.42, lit: rgba(78, 124, 176), shade: rgba(110, 142, 184), n: 8 },
  ];
  for (const L of layers) for (let i = 0; i < L.n; i++) {
    const t0 = i / L.n, t1 = (i + 1) / L.n;
    const x0 = -12 + 24 * t0, x1 = -12 + 24 * t1;
    const w0 = Math.sin(t0 * Math.PI * 3.2) * 0.06, w1 = Math.sin(t1 * Math.PI * 3.2) * 0.06;
    addQuad(m, [x0, L.y0 + w0, L.z0], [x1, L.y0 + w1, L.z0], [x1, L.y1, L.z1], [x0, L.y1, L.z1], L.lit, L.lit, L.shade, L.shade);
  }
  for (const [x, z, s] of [[-1.2, -8.6, 1], [2.4, -9.4, 0.7], [-3.1, -12.4, 0.55], [1.1, -15.2, 0.4]]) {
    addQuad(m, [x, -0.22, z], [x + 0.35 * s, -0.22, z + 0.08], [x + 0.5 * s, -0.2, z + 0.22], [x + 0.05 * s, -0.2, z + 0.16], rgba(230, 246, 248, 180));
  }
});

part('HB_islands', true, m => {
  const isle = (x, z, w, h, col, haze) => {
    const c = mix(col, rgba(176, 176, 196), haze);
    addQuad(m, [x - w, -0.12, z], [x + w * 0.2, -0.1, z + 0.2], [x + w * 0.15, h, z - 0.8], [x - w * 0.35, h * 0.92, z - 0.7], c);
    addQuad(m, [x + w * 0.2, -0.1, z + 0.2], [x + w, -0.08, z - 0.15], [x + w * 0.4, h * 0.7, z - 0.9], [x + w * 0.15, h, z - 0.8], mix(c, rgba(210, 200, 196), 0.25));
  };
  isle(-6.2, -11.4, 2.4, 1.35, rgba(176, 164, 170), 0.15);
  isle(4.8, -12.6, 1.8, 0.95, rgba(168, 170, 186), 0.35);
  isle(-1.4, -16.4, 3.2, 1.55, rgba(186, 180, 196), 0.55);
  isle(6.4, -17.2, 1.6, 0.7, rgba(196, 190, 204), 0.7);
});

function boat(m, x, z, s, haze) {
  const hull = mix(rgba(246, 242, 232), rgba(180, 184, 196), haze);
  const sail = mix(rgba(255, 252, 246), rgba(200, 204, 214), haze);
  const woodC = mix(wood, rgba(160, 164, 176), haze);
  const y0 = -0.18;
  faceBox(m, x - 0.45 * s, y0, z - 0.12 * s, x + 0.45 * s, y0 + 0.14 * s, z + 0.12 * s, hull, hull, mix(hull, shadeW, 0.3), hull);
  addQuad(m, [x - 0.08 * s, y0 + 0.14 * s, z], [x + 0.02 * s, y0 + 0.14 * s, z], [x + 0.02 * s, y0 + 0.92 * s, z], [x - 0.08 * s, y0 + 0.92 * s, z], woodC);
  addQuad(m, [x, y0 + 0.86 * s, z], [x + 0.55 * s, y0 + 0.22 * s, z], [x + 0.5 * s, y0 + 0.16 * s, z + 0.02], [x, y0 + 0.24 * s, z], sail);
  addQuad(m, [x, y0 + 0.82 * s, z], [x - 0.28 * s, y0 + 0.34 * s, z], [x - 0.24 * s, y0 + 0.3 * s, z], [x, y0 + 0.38 * s, z], mix(sail, rgba(220, 230, 240), 0.2));
}
part('HB_boats', true, m => {
  boat(m, -2.4, -8.8, 1.15, 0);
  boat(m, 3.6, -12.8, 0.85, 0.35);
  boat(m, -5.5, -15.6, 0.55, 0.6);
});

part('HB_cliffs', false, m => {
  const lip = (x0, x1, z0, z1, y1, lit, shade) => {
    addQuad(m, [x0, Y, z0], [x1, Y, z0], [x1, y1, z1], [x0, y1, z1], lit, lit, shade, shade);
  };
  lip(X0, X1, Z0, -7.55, -0.2, rgba(236, 226, 210), rgba(196, 206, 216));
  lip(-11.5, X0, -1.2, -12, -1.05, rgba(244, 236, 222), rgba(176, 188, 206));
  lip(X1, 11.2, -1.2, -12.4, -1.1, rgba(255, 236, 214), rgba(168, 180, 204));
  lip(-9.2, -6.4, 1.2, -8.2, -0.35, rgba(236, 228, 214), rgba(180, 190, 208));
  lip(6.5, 9.4, 0.8, -8.6, -0.4, rgba(255, 240, 220), rgba(176, 186, 206));
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
