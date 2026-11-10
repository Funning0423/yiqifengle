'use strict';
// 石灯苔庭. Vertex colours only. The 7×7 is painted into the raked sand
// court at y = 0. A low moss-stone curb and a wood lip edge that same floor.
// Stone lanterns, maples and moss mounds sit beside the board; the corridor,
// gate, bridge and pond sit behind it; mountains and mist close the view.
const fs = require('node:fs'), path = require('node:path');
const OUT = path.resolve(__dirname, '../../creator-build-project/assets/bundles/region_mossgarden/models/env_mossgarden.glb');
const Y = 0, YR = 0.00005, X0 = -6.5, X1 = 6.5, Z0 = -7, Z1 = 7, HALF = 2.125;
const CELL = (HALF * 2) / 7, LINE = 0.018, CURB = 2.16;
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

const sandA = rgba(246, 234, 210), sandB = rgba(236, 222, 194), sandJoint = rgba(224, 208, 180);
const boardA = rgba(255, 250, 238), boardB = rgba(250, 242, 224), boardLine = rgba(232, 218, 196);
const rakeCol = rgba(214, 186, 150);
const moss = rgba(58, 132, 68), mossLit = rgba(118, 176, 78), mossDeep = rgba(32, 92, 50);
const stone = rgba(196, 184, 164), stoneLit = rgba(222, 208, 184), stoneShade = rgba(132, 122, 108);
const maple = rgba(214, 42, 36), maple2 = rgba(232, 96, 28), maple3 = rgba(236, 164, 46), mapleD = rgba(168, 28, 32);
const wood = rgba(156, 96, 54), woodLit = rgba(204, 146, 86), woodD = rgba(96, 58, 34);
const plaster = rgba(252, 246, 234), plasterShade = rgba(228, 214, 196);
const tile = rgba(36, 52, 92), tileLit = rgba(72, 102, 158), tileShade = rgba(22, 32, 58);
const water = rgba(28, 118, 176), waterDeep = rgba(12, 58, 122), waterLit = rgba(72, 176, 198);
const glow = rgba(255, 186, 96), glowSoft = rgba(255, 210, 140, 90);
const hazeC = rgba(186, 196, 204);
const skyLow = rgba(255, 164, 102), skyMid = rgba(232, 112, 96), skyHigh = rgba(168, 86, 112);

function faceBox(m, x0, y0, z0, x1, y1, z1, top, sun, shade, front) {
  addQuad(m, [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], top);
  addQuad(m, [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], shade);
  addQuad(m, [x1, y0, z1], [x1, y1, z1], [x1, y1, z0], [x1, y0, z0], sun);
  addQuad(m, [x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1], shade);
  addQuad(m, [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], front || sun);
  addQuad(m, [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], shade);
}
function slab(m, x0, x1, z0, z1, a, b, seam, step) {
  if (x1 - x0 < 0.08 || z1 - z0 < 0.08) return;
  const s = step || 1.55;
  const nx = Math.max(1, Math.round((x1 - x0) / s)), nz = Math.max(1, Math.round((z1 - z0) / s));
  const g = 0.012;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const ax = x0 + (x1 - x0) * i / nx, bx = x0 + (x1 - x0) * (i + 1) / nx;
    const az = z0 + (z1 - z0) * j / nz, bz = z0 + (z1 - z0) * (j + 1) / nz;
    const ix0 = i === 0 ? ax : ax + g, ix1 = i === nx - 1 ? bx : bx - g;
    const iz0 = j === 0 ? az : az + g, iz1 = j === nz - 1 ? bz : bz - g;
    const mossTile = (i * 3 + j * 2) % 7 === 0;
    const col = mossTile ? mix(moss, a, 0.35) : ((i + j) % 2 ? a : b);
    addQuad(m, [ix0, Y, iz1], [ix1, Y, iz1], [ix1, Y, iz0], [ix0, Y, iz0], col);
    if (i > 0) addQuad(m, [ax, Y, iz0], [ax + g, Y, iz0], [ax + g, Y, iz1], [ax, Y, iz1], seam);
    if (j > 0) addQuad(m, [ix0, Y, az], [ix1, Y, az], [ix1, Y, az + g], [ix0, Y, az + g], seam);
  }
}

part('MG_ground', false, m => {
  slab(m, X0, -CURB, Z0, Z1, sandA, sandB, sandJoint);
  slab(m, CURB, X1, Z0, Z1, sandA, sandB, sandJoint);
  slab(m, -CURB, CURB, Z0, -CURB, sandA, sandB, sandJoint, 1.35);
  slab(m, -CURB, CURB, CURB, Z1, sandA, sandB, sandJoint, 1.35);
  const band = rgba(228, 214, 186);
  addQuad(m, [-HALF, Y, -CURB], [HALF, Y, -CURB], [HALF, Y, -HALF], [-HALF, Y, -HALF], band);
  addQuad(m, [-HALF, Y, HALF], [HALF, Y, HALF], [HALF, Y, CURB], [-HALF, Y, CURB], band);
  addQuad(m, [-CURB, Y, -HALF], [-HALF, Y, -HALF], [-HALF, Y, HALF], [-CURB, Y, HALF], band);
  addQuad(m, [HALF, Y, -HALF], [CURB, Y, -HALF], [CURB, Y, HALF], [HALF, Y, HALF], band);
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
  const waves = 7, seg = 9;
  for (let k = 0; k < waves; k++) {
    const zBase = -HALF + 0.16 + (k + 0.15) * (HALF * 2 - 0.28) / waves;
    for (let i = 0; i < seg; i++) {
      const t0 = i / seg, t1 = (i + 1) / seg;
      const x0 = -HALF + 0.1 + (HALF * 2 - 0.2) * t0;
      const x1 = -HALF + 0.1 + (HALF * 2 - 0.2) * t1;
      const bow = t => Math.sin(t * Math.PI) * 0.07 * (k % 2 ? 1 : -1);
      const z0 = zBase + bow(t0), z1 = zBase + bow(t1), w = 0.02;
      addQuad(m, [x0, YR, z0 - w], [x1, YR, z1 - w], [x1, YR, z1 + w], [x0, YR, z0 + w], rakeCol);
    }
  }
  faceBox(m, -CURB - 0.22, Y, -CURB - 0.22, -CURB, 0.09, CURB + 0.22, mossLit, stoneLit, stoneShade, stone);
  faceBox(m, CURB, Y, -CURB - 0.22, CURB + 0.22, 0.09, CURB + 0.22, mossLit, stoneLit, stoneShade, stone);
  faceBox(m, -CURB, Y, -CURB - 0.22, CURB, 0.09, -CURB, moss, stone, stoneShade, stone);
  faceBox(m, -CURB, Y, CURB, CURB, 0.05, CURB + 0.16, woodLit, wood, woodD, wood);
  const tufts = [[-3.4, 1.6], [3.6, 1.2], [-4.6, -1.4], [4.4, -0.6], [-1.2, 4.2], [1.4, 4.6], [-5.2, 3.2], [5.1, 2.4], [0.2, -5.6], [-3.8, -4.8], [4.2, -5.2]];
  for (const [x, z] of tufts) {
    addQuad(m, [x - 0.22, YR, z + 0.16], [x + 0.22, YR, z + 0.16], [x + 0.16, YR, z - 0.18], [x - 0.16, YR, z - 0.18], moss);
    addQuad(m, [x - 0.08, YR, z + 0.08], [x + 0.1, YR, z + 0.06], [x + 0.06, YR, z - 0.08], [x - 0.06, YR, z - 0.06], mossLit);
  }
});

function mound(m, x, z, r, h) {
  const n = 6;
  const ring = (rad, y) => Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 + 0.4;
    return [x + Math.cos(a) * rad, y, z + Math.sin(a) * rad];
  });
  const A = ring(r, 0.02), B = ring(r * 0.62, h * 0.55), C = ring(r * 0.22, h);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const lit = i < 2 ? mossLit : i > 4 ? mossDeep : moss;
    addQuad(m, A[i], A[j], B[j], B[i], lit);
    addQuad(m, B[i], B[j], C[j], C[i], mix(lit, mossLit, 0.35));
  }
}
part('MG_moss', false, m => {
  mound(m, -1.15, 3.55, 0.28, 0.16);
  mound(m, 1.25, 3.65, 0.24, 0.14);
  mound(m, -4.15, 0.35, 0.48, 0.32);
  mound(m, 4.35, -0.55, 0.4, 0.24);
  mound(m, -3.7, -2.55, 0.34, 0.2);
  mound(m, 3.85, -3.15, 0.3, 0.18);
  const rock = (x, z, s, mossy) => {
    faceBox(m, x, 0.02, z, x + 0.28 * s, 0.16 * s, z + 0.22 * s, mossy ? moss : stoneLit, stone, stoneShade, stoneLit);
    if (mossy) addQuad(m, [x - 0.02, 0.16 * s, z + 0.2 * s], [x + 0.3 * s, 0.16 * s, z + 0.18 * s], [x + 0.22 * s, 0.16 * s + 0.001, z - 0.02], [x + 0.02, 0.16 * s + 0.001, z], mossLit);
  };
  rock(-1.55, -3.25, 1.1, true);
  rock(1.25, -3.45, 0.9, true);
  rock(-0.95, -4.55, 0.7, false);
  rock(0.85, -4.7, 0.8, true);
});

function lantern(m, x, z, s, glowM) {
  const y0 = 0;
  faceBox(m, x - 0.22 * s, y0, z - 0.22 * s, x + 0.22 * s, y0 + 0.1 * s, z + 0.22 * s, stoneLit, stone, stoneShade, stone);
  faceBox(m, x - 0.08 * s, y0 + 0.1 * s, z - 0.08 * s, x + 0.08 * s, y0 + 0.42 * s, z + 0.08 * s, stone, stoneLit, stoneShade, stoneLit);
  const yb = y0 + 0.42 * s;
  faceBox(m, x - 0.2 * s, yb, z - 0.2 * s, x + 0.2 * s, yb + 0.28 * s, z + 0.2 * s, stoneLit, stone, stoneShade, plaster);
  const yt = yb + 0.28 * s;
  const n = 4;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2 + Math.PI / 4, a1 = ((i + 1) / n) * Math.PI * 2 + Math.PI / 4;
    const r0 = 0.3 * s, r1 = 0.04 * s, h = 0.28 * s;
    addQuad(m,
      [x + Math.cos(a0) * r0, yt, z + Math.sin(a0) * r0],
      [x + Math.cos(a1) * r0, yt, z + Math.sin(a1) * r0],
      [x + Math.cos(a1) * r1, yt + h, z + Math.sin(a1) * r1],
      [x + Math.cos(a0) * r1, yt + h, z + Math.sin(a0) * r1],
      i < 2 ? stoneLit : stoneShade);
  }
  faceBox(m, x - 0.03 * s, yt + 0.28 * s, z - 0.03 * s, x + 0.03 * s, yt + 0.4 * s, z + 0.03 * s, stoneLit, stone, stoneShade, stone);
  const win = (dx, dz) => {
    const wx = x + dx, wz = z + dz;
    glowM.push([wx, yb + 0.08 * s, wz, wx + (dx === 0 ? 0.12 * s : 0), yb + 0.2 * s, wz + (dz === 0 ? 0.12 * s : 0)]);
  };
  win(0, 0.2 * s + 0.012);
  win(0.2 * s + 0.012, 0);
}
const glows = [];
part('MG_lanterns', false, m => {
  lantern(m, -1.62, 3.22, 0.82, glows);
  lantern(m, 1.7, 3.32, 0.74, glows);
  lantern(m, -2.42, -1.15, 0.58, glows);
  lantern(m, 2.48, -1.45, 0.52, glows);
});
part('MG_glow', true, m => {
  for (const [x0, y0, z0, x1, y1, z1] of glows) {
    const flatZ = Math.abs(z1 - z0) < 0.001;
    if (flatZ) {
      addQuad(m, [x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], glow);
      addQuad(m, [x0 - 0.04, y0 - 0.03, z0 + 0.01], [x1 + 0.04, y0 - 0.03, z0 + 0.01], [x1 + 0.06, y1 + 0.04, z0 + 0.01], [x0 - 0.06, y1 + 0.04, z0 + 0.01], glowSoft);
    } else {
      addQuad(m, [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], glow);
      addQuad(m, [x0 + 0.01, y0 - 0.03, z0 - 0.04], [x0 + 0.01, y0 - 0.03, z1 + 0.04], [x0 + 0.01, y1 + 0.04, z1 + 0.06], [x0 + 0.01, y1 + 0.04, z0 - 0.06], glowSoft);
    }
  }
});

function trunk(m, x, z, h, r) {
  const n = 5;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
    const c = i < 2 ? woodLit : woodD;
    addQuad(m,
      [x + Math.cos(a0) * r, 0.02, z + Math.sin(a0) * r],
      [x + Math.cos(a1) * r, 0.02, z + Math.sin(a1) * r],
      [x + Math.cos(a1) * r * 0.7, h, z + Math.sin(a1) * r * 0.7],
      [x + Math.cos(a0) * r * 0.7, h, z + Math.sin(a0) * r * 0.7], c);
  }
}
function leaf(m, x, y, z, s, yaw, col) {
  const c = Math.cos(yaw), sn = Math.sin(yaw);
  const dx = c * s, dz = sn * s * 0.65;
  const px = -sn * s * 0.42, pz = c * s * 0.28;
  addQuad(m,
    [x - dx * 0.15, y, z - dz * 0.15],
    [x + px, y + s * 0.08, z + pz],
    [x + dx, y + s * 0.92, z + dz],
    [x - px * 0.8, y + s * 0.45, z - pz],
    col, mix(col, maple3, 0.25), col, mix(col, mapleD, 0.2));
}
function clump(m, x, y, z, w, h, col) {
  addQuad(m, [x - w, y, z], [x + w, y, z + 0.02], [x + w * 0.62, y + h, z + 0.08], [x - w * 0.62, y + h, z + 0.06], col, mix(col, maple3, 0.35), col, mix(col, mapleD, 0.25));
  addTri(m, [x - w * 0.2, y + h * 0.15, z + 0.03], [x + w * 0.85, y + h * 0.28, z], [x + w * 0.1, y + h * 0.95, z + 0.05], mix(col, maple2, 0.4));
}
function crown(m, x, y, z, s, tint) {
  const cols = [maple, maple2, maple3, mix(maple, maple2, 0.45)];
  const blobs = [[0, 0.15, 0.05, 1, 1.05], [0.55, 0, 0.12, 0.72, 0.8], [-0.52, 0.05, 0.02, 0.7, 0.78], [0.12, 0.55, -0.08, 0.62, 0.7], [-0.18, 0.42, 0.18, 0.55, 0.62], [0.28, -0.12, -0.2, 0.5, 0.55]];
  blobs.forEach((p, i) => clump(m, x + p[0] * s, y + p[1] * s, z + p[2] * s, s * p[3] * 0.55, s * p[4] * 0.7, mix(cols[i % cols.length], tint, 0.2)));
}
part('MG_maple', true, m => {
  trunk(m, -2.85, 0.35, 1.05, 0.08);
  crown(m, -2.9, 1.0, 0.35, 0.58, rgba(255, 64, 32));
  trunk(m, 2.88, 0.15, 0.98, 0.075);
  crown(m, 2.92, 0.94, 0.15, 0.55, rgba(255, 120, 32));
  trunk(m, -1.85, -4.15, 0.85, 0.06);
  crown(m, -1.85, 0.8, -4.15, 0.55, rgba(255, 140, 70));
  trunk(m, 1.95, -4.35, 0.72, 0.055);
  crown(m, 1.95, 0.68, -4.35, 0.48, hazeC);
  const fallen = [[-1.85, 3.15, 0.18, 0.4], [1.9, 3.25, 0.16, 1.1], [-2.7, 3.55, 0.14, 2.2], [2.55, 3.7, 0.15, 0.7], [-4.1, 0.4, 0.13, 1.6], [4.2, -0.2, 0.12, 2.5]];
  for (const [x, z, s, yaw] of fallen) leaf(m, x, 0.04, z, s, yaw, maple2);
});

function corridor(m, x0, x1, z0, z1, posts, haze) {
  const floor = mix(woodLit, hazeC, haze), post = mix(wood, hazeC, haze), roof = mix(tile, hazeC, haze * 0.6);
  const yf = 0.08;
  addQuad(m, [x0, yf, z1], [x1, yf, z1], [x1, yf, z0], [x0, yf, z0], floor, floor, mix(floor, woodD, 0.25), mix(floor, woodD, 0.25));
  addQuad(m, [x0, 0, z1], [x0, yf, z1], [x0, yf, z0], [x0, 0, z0], woodD);
  for (let i = 0; i < posts; i++) {
    const z = z0 + (z1 - z0) * (i + 0.5) / posts;
    const px = x0 < 0 ? x0 + 0.08 : x1 - 0.16;
    faceBox(m, px, 0, z - 0.06, px + 0.1, 1.05, z + 0.06, post, mix(post, woodLit, 0.3), woodD, post);
  }
  const yh = 1.05, y2 = 1.22;
  addQuad(m, [x0 - 0.08, yh, z1], [x1 + 0.08, yh, z1], [x1 + 0.08, yh, z0], [x0 - 0.08, yh, z0], roof);
  addQuad(m, [x0 - 0.12, y2, z1 + 0.05], [x1 + 0.12, y2, z1 + 0.05], [x1 + 0.08, yh, z0], [x0 - 0.08, yh, z0], mix(roof, tileLit, 0.35), mix(roof, tileLit, 0.35), roof, roof);
}
part('MG_corridor', false, m => {
  corridor(m, -3.05, -2.38, -0.85, 1.35, 4, 0);
  corridor(m, 2.4, 3.05, -1.7, 0.55, 4, 0.06);
});

part('MG_gate', false, m => {
  const z = -5.35, h = 1.05, open = 0.72;
  faceBox(m, -1.35, 0, z, -open, h, z + 0.28, plaster, plaster, plasterShade, plaster);
  faceBox(m, open, 0, z, 1.35, h, z + 0.28, plaster, plaster, plasterShade, plaster);
  faceBox(m, -1.45, h - 0.05, z - 0.05, 1.45, h + 0.05, z + 0.34, wood, woodLit, woodD, woodLit);
  const eave = (y0, y1, zNear, zFar, x0, x1) => {
    addQuad(m, [x0, y0, zNear], [x1, y0, zNear], [x1 * 0.72, y1, zFar], [x0 * 0.72, y1, zFar], tileLit, tileLit, tile, tile);
  };
  eave(h + 0.05, h + 0.52, z + 0.46, z + 0.08, -1.7, 1.7);
  eave(h + 0.05, h + 0.48, z - 0.12, z + 0.1, -1.6, 1.6);
  faceBox(m, -0.06, h + 0.4, z + 0.08, 0.06, h + 0.62, z + 0.22, tileLit, tile, tileShade, tile);
  for (let i = 0; i < 5; i++) {
    const x = -1.5 + i * 0.62;
    addQuad(m, [x, h + 0.18, z + 0.49], [x + 0.08, h + 0.18, z + 0.49], [x + 0.06, h + 0.44, z + 0.2], [x - 0.02, h + 0.44, z + 0.2], i % 2 ? tileShade : tile);
  }
  for (let i = 0; i < 3; i++) {
    const y0 = 0.02 + i * 0.07;
    faceBox(m, -open + 0.04, y0 - 0.07, z + 0.32, open - 0.04, y0, z + 0.62 - i * 0.04, stoneLit, stone, stoneShade, stone);
  }
  addQuad(m, [-open + 0.06, 0.22, z + 0.34], [-0.02, 0.22, z + 0.34], [-0.02, h - 0.12, z + 0.34], [-open + 0.06, h - 0.12, z + 0.34], wood);
  addQuad(m, [0.02, 0.22, z + 0.34], [open - 0.06, 0.22, z + 0.34], [open - 0.06, h - 0.12, z + 0.34], [0.02, h - 0.12, z + 0.34], woodLit);
});

part('MG_bridge', false, m => {
  const segs = 4;
  for (let i = 0; i < segs; i++) {
    const t0 = i / segs, t1 = (i + 1) / segs;
    const z0 = -2.55 - 1.05 * t0, z1 = -2.55 - 1.05 * t1;
    const arch = t => Math.sin(t * Math.PI) * 0.16;
    const y0 = 0.06 + arch(t0), y1 = 0.06 + arch(t1);
    addQuad(m, [-0.38, y0, z0], [0.38, y0, z0], [0.38, y1, z1], [-0.38, y1, z1], stoneLit, stoneLit, stone, stone);
    addQuad(m, [-0.38, y0 - 0.08, z0], [-0.38, y0, z0], [-0.38, y1, z1], [-0.38, y1 - 0.08, z1], stoneShade);
    addQuad(m, [0.38, y0 - 0.08, z0], [0.38, y0, z0], [0.38, y1, z1], [0.38, y1 - 0.08, z1], stone);
    addQuad(m, [-0.46, y0 + 0.08, z0], [-0.34, y0 + 0.08, z0], [-0.34, y1 + 0.1, z1], [-0.46, y1 + 0.1, z1], moss);
    addQuad(m, [0.34, y0 + 0.08, z0], [0.46, y0 + 0.08, z0], [0.46, y1 + 0.1, z1], [0.34, y1 + 0.1, z1], mossLit);
  }
  const stones = [[-0.55, -2.35], [0.62, -2.42], [0.05, -2.28]];
  for (const [x, z] of stones) addQuad(m, [x - 0.16, YR, z + 0.1], [x + 0.16, YR, z + 0.1], [x + 0.12, YR, z - 0.12], [x - 0.12, YR, z - 0.12], stoneLit);
});

part('MG_pond', true, m => {
  addQuad(m, [-1.95, 0.01, -2.38], [1.95, 0.01, -2.38], [1.6, 0.0, -4.2], [-1.6, 0.0, -4.2], waterLit, waterLit, waterDeep, waterDeep);
  addQuad(m, [-0.55, -0.02, -2.9], [0.85, -0.02, -2.95], [0.55, -0.025, -3.7], [-0.25, -0.025, -3.65], rgba(210, 236, 214, 160));
  const rip = [[-0.9, -3.15], [0.7, -3.35], [0.05, -3.7]];
  for (const [x, z] of rip) {
    addQuad(m, [x - 0.18, 0, z], [x + 0.18, 0, z], [x + 0.1, 0.01, z + 0.08], [x - 0.1, 0.01, z + 0.08], rgba(220, 245, 236, 120));
  }
});

function ridge(m, zBack, zFront, yBase, amp, x0, x1, peaks, lit, shade) {
  const n = peaks.length;
  for (let i = 0; i < n; i++) {
    const t0 = i / n, t1 = (i + 1) / n, tm = (t0 + t1) / 2;
    const xa = x0 + (x1 - x0) * t0, xb = x0 + (x1 - x0) * t1, xm = x0 + (x1 - x0) * tm;
    const h = yBase + amp * peaks[i];
    const col = i % 2 ? lit : shade;
    addQuad(m, [xa, yBase * 0.35, zFront], [xb, yBase * 0.35, zFront], [xb, yBase + amp * 0.25, zBack], [xa, yBase + amp * 0.25, zBack], shade, shade, col, col);
    addTri(m, [xa, yBase + amp * 0.25, zBack], [xb, yBase + amp * 0.25, zBack], [xm, h, zBack - 0.35], col, shade, lit);
  }
}
part('MG_mountains', true, m => {
  const nearL = rgba(92, 158, 86), nearS = rgba(42, 102, 72);
  const midL = rgba(126, 170, 164), midS = rgba(78, 124, 132);
  const farL = rgba(186, 204, 206), farS = rgba(150, 174, 184);
  ridge(m, -9.2, -7.4, 0.15, 1.55, -8.5, 8.2, [0.45, 0.9, 0.55, 1.15, 0.7, 1.0, 0.4, 0.8, 0.5], nearL, nearS);
  ridge(m, -12.4, -10.2, 0.35, 1.25, -9.5, 9.4, [0.35, 0.7, 1.05, 0.5, 0.85, 0.4, 0.95, 0.55], midL, midS);
  ridge(m, -16.8, -14.2, 0.55, 0.85, -11, 11, [0.3, 0.55, 0.4, 0.7, 0.35, 0.6, 0.45], farL, farS);
  ridge(m, -20.5, -17.6, 0.7, 0.45, -12, 12, [0.25, 0.4, 0.3, 0.5, 0.28, 0.38], farL, mix(farL, skyLow, 0.25));
});

part('MG_mist', true, m => {
  addQuad(m, [-8, 0.02, -6.6], [8, 0.02, -6.6], [7, 0.85, -8.6], [-7, 0.85, -8.6], rgba(255, 220, 186, 70), rgba(255, 220, 186, 70), rgba(186, 206, 200, 24), rgba(186, 206, 200, 24));
  addQuad(m, [-9, 0.15, -8.2], [9, 0.15, -8.2], [8, 1.1, -11.5], [-8, 1.1, -11.5], rgba(255, 214, 180, 50), rgba(255, 214, 180, 50), rgba(190, 206, 204, 30), rgba(190, 206, 204, 30));
  addQuad(m, [-10, 0.35, -12.8], [10, 0.35, -12.8], [9, 1.35, -16.2], [-9, 1.35, -16.2], rgba(220, 206, 196, 40));
  addQuad(m, [-11, 0.6, -17.2], [11, 0.6, -17.2], [10, 1.6, -20.2], [-10, 1.6, -20.2], rgba(210, 196, 198, 36));
});

part('MG_sky', true, m => {
  addQuad(m, [-24, -1.2, -21.2], [24, -1.2, -21.2], [16, 8.4, -22], [-16, 8.4, -22], skyLow, skyLow, skyMid, skyMid);
  addQuad(m, [-16, 8.4, -22], [16, 8.4, -22], [12, 18, -22.6], [-12, 18, -22.6], skyMid, skyMid, skyHigh, skyHigh);
});
part('MG_sun', true, m => {
  const x = 2.15, y = 6.35, z = -19.2;
  const disc = (r, col, n) => {
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
      addTri(m, [x, y, z], [x + Math.cos(a0) * r, y + Math.sin(a0) * r, z], [x + Math.cos(a1) * r, y + Math.sin(a1) * r, z], col, col, col);
    }
  };
  disc(1.7, rgba(255, 176, 112, 48), 14);
  disc(0.95, rgba(255, 206, 140, 120), 12);
  disc(0.42, rgba(255, 246, 220), 10);
});

function pack() {
  const blobs = [], views = [], accessors = [], meshes = [], nodes = [{ name: 'env_mossgarden', children: [] }];
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
  const swayNode = nodes.findIndex(n => n.name === 'MG_maple');
  align(4);
  const times = Float32Array.from([0, 2.8, 5.6]);
  const values = Float32Array.from([0, 0, 0, 0.035, 0.012, 0.018, 0, 0, 0]);
  const tAcc = pushArr(times, 'SCALAR', 5126);
  const vAcc = pushArr(values, 'VEC3', 5126);
  accessors[tAcc].min = [0]; accessors[tAcc].max = [5.6];
  const materials = [
    { name: 'M_MG_vertex', doubleSided: true, pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], metallicFactor: 0, roughnessFactor: 1 } },
    { name: 'M_MG_unlit', doubleSided: true, alphaMode: 'BLEND', extensions: { KHR_materials_unlit: {} }, pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], metallicFactor: 0, roughnessFactor: 1 } },
  ];
  const json = {
    asset: { version: '2.0', generator: 'qf-env-mossgarden', extras: { license: 'original-procedural' } },
    extensionsUsed: ['KHR_materials_unlit'],
    scene: 0, scenes: [{ name: 'env_mossgarden', nodes: [0] }], nodes, meshes, materials,
    accessors, bufferViews: views, buffers: [{ byteLength: offset }],
    animations: [{ name: 'maple_sway', channels: [{ sampler: 0, target: { node: swayNode, path: 'translation' } }], samplers: [{ input: tAcc, output: vAcc, interpolation: 'LINEAR' }] }],
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
