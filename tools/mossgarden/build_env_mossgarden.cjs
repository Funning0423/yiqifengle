'use strict';
// 石灯苔庭 v2. Vertex colours only. The 7×7 stays on the court at y = 0.
// Around it: moss mounds and white sand with concentric rakes. Rakes never
// cross a board cell. Maples, lanterns and the corridors sit off the board.
const fs = require('node:fs'), path = require('node:path');
const OUT = path.resolve(__dirname, '../../creator-build-project/assets/bundles/region_mossgarden/models/env_mossgarden.glb');
const Y = 0, YR = 0.00005, X0 = -6.5, X1 = 6.5, Z0 = -7, Z1 = 7, HALF = 2.125;
const CELL = (HALF * 2) / 7, LINE = 0.016, CURB = 2.2;
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

const moss = rgba(46, 112, 58), mossLit = rgba(98, 158, 64), mossDeep = rgba(24, 72, 42), mossY = rgba(132, 156, 62);
const sand = rgba(244, 240, 228), sandWarm = rgba(232, 220, 196);
const boardA = rgba(250, 247, 238), boardB = rgba(244, 239, 226), boardLine = rgba(214, 198, 170);
const rakeCol = rgba(108, 84, 58);
const stone = rgba(168, 160, 148), stoneLit = rgba(214, 204, 186), stoneShade = rgba(108, 102, 94);
const maple = rgba(196, 42, 32), maple2 = rgba(214, 84, 28), maple3 = rgba(214, 140, 42), mapleD = rgba(132, 28, 28);
const wood = rgba(138, 86, 48), woodLit = rgba(186, 128, 74), woodD = rgba(78, 46, 28);
const plaster = rgba(244, 236, 222), plasterShade = rgba(214, 202, 184);
const tile = rgba(48, 62, 88), tileLit = rgba(78, 98, 128), tileShade = rgba(28, 36, 52);
const water = rgba(36, 108, 132), waterDeep = rgba(16, 58, 86), waterLit = rgba(92, 158, 156);
const glow = rgba(255, 176, 78), glowSoft = rgba(255, 196, 120, 110);
const hazeC = rgba(168, 180, 184);
const skyLow = rgba(214, 164, 142), skyMid = rgba(176, 142, 146), skyHigh = rgba(142, 128, 142);
const skyMist = rgba(186, 190, 188);

function faceBox(m, x0, y0, z0, x1, y1, z1, top, sun, shade, front) {
  addQuad(m, [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], top);
  addQuad(m, [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], shade);
  addQuad(m, [x1, y0, z1], [x1, y1, z1], [x1, y1, z0], [x1, y0, z0], sun);
  addQuad(m, [x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1], shade);
  addQuad(m, [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], front || sun);
  addQuad(m, [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], shade);
}
function hitsBoard(pts) {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const p of pts) { minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]); minZ = Math.min(minZ, p[2]); maxZ = Math.max(maxZ, p[2]); }
  return maxX > -HALF + 0.02 && minX < HALF - 0.02 && maxZ > -HALF + 0.02 && minZ < HALF - 0.02;
}

part('MG_ground', false, m => {
  addQuad(m, [X0, Y, Z1], [X1, Y, Z1], [X1, Y, Z0], [X0, Y, Z0], mossDeep, moss, moss, mossDeep);
  const sands = [
    [-6.35, -2.32, -2.2, 3.2], [2.32, 6.35, -2.6, 2.4],
    [-1.85, 1.85, 2.32, 6.55], [-6.2, -2.4, -6.4, -2.4], [2.4, 6.2, -6.5, -2.45],
  ];
  const sandY = 0.00004;
  for (const [x0, x1, z0, z1] of sands) addQuad(m, [x0, sandY, z1], [x1, sandY, z1], [x1, sandY, z0], [x0, sandY, z0], sand, sand, sandWarm, sand);
  const islands = [[-4.15, 0.7, 0.55, moss], [4.05, -0.55, 0.48, mossLit], [-3.7, -3.6, 0.42, mossDeep], [3.9, -3.7, 0.4, moss], [0.05, 4.55, 0.5, mossY]];
  for (const [x, z, r, col] of islands) {
    addQuad(m, [x - r, YR * 1.4, z + r * 0.7], [x + r, YR * 1.4, z + r * 0.72], [x + r * 0.7, YR * 1.4, z - r * 0.8], [x - r * 0.75, YR * 1.4, z - r * 0.7], col);
  }
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
  const stones = [[-4.15, 0.7], [4.15, -0.45], [-3.85, -3.55], [0.15, 4.7], [3.85, -3.85]];
  for (const [cx, cz] of stones) {
    for (const rad of [0.38, 0.62, 0.9, 1.22, 1.58]) {
      const n = 18, w = 0.032;
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
        const p = (a, r) => [cx + Math.cos(a) * r, YR * 4, cz + Math.sin(a) * r];
        const q = [p(a0, rad - w), p(a1, rad - w), p(a1, rad + w), p(a0, rad + w)];
        if (hitsBoard(q)) continue;
        if (q.some(v => v[0] < X0 || v[0] > X1 || v[2] < Z0 || v[2] > Z1)) continue;
        addQuad(m, q[0], q[1], q[2], q[3], rakeCol);
      }
    }
  }
  faceBox(m, -CURB - 0.16, Y, -CURB - 0.16, -CURB, 0.07, CURB + 0.16, mossLit, stoneLit, stoneShade, stone);
  faceBox(m, CURB, Y, -CURB - 0.16, CURB + 0.16, 0.07, CURB + 0.16, mossLit, stoneLit, stoneShade, stone);
  faceBox(m, -CURB, Y, -CURB - 0.16, CURB, 0.07, -CURB, moss, stone, stoneShade, stone);
  faceBox(m, -CURB, Y, CURB, CURB, 0.045, CURB + 0.12, woodLit, wood, woodD, wood);
});

function mound(m, x, z, r, h, col) {
  const n = 7;
  const ring = (rad, y) => Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 + 0.3;
    const wob = 0.82 + 0.18 * ((i * 5) % 3) / 2;
    return [x + Math.cos(a) * rad * wob, y, z + Math.sin(a) * rad * wob];
  });
  const A = ring(r, 0.02), B = ring(r * 0.62, h * 0.5), C = ring(r * 0.22, h);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const lit = i < 2 ? mossLit : i > 4 ? mossDeep : (col || moss);
    addQuad(m, A[i], A[j], B[j], B[i], lit);
    addQuad(m, B[i], B[j], C[j], C[i], mix(lit, mossLit, 0.3));
  }
}
function rock(m, x, z, s) {
  faceBox(m, x, 0.02, z, x + 0.34 * s, 0.16 * s, z + 0.26 * s, stoneLit, stone, stoneShade, stoneLit);
  addQuad(m, [x + 0.04 * s, 0.16 * s, z + 0.04 * s], [x + 0.28 * s, 0.16 * s, z + 0.02 * s], [x + 0.22 * s, 0.16 * s + 0.001, z + 0.22 * s], [x + 0.06 * s, 0.16 * s + 0.001, z + 0.2 * s], mossLit);
}
part('MG_moss', false, m => {
  mound(m, -4.15, 0.7, 0.62, 0.34, moss);
  mound(m, 4.15, -0.45, 0.55, 0.28, mossLit);
  mound(m, -3.85, -3.55, 0.48, 0.26, mossDeep);
  mound(m, 3.9, -3.8, 0.42, 0.22, moss);
  mound(m, -1.35, 3.7, 0.36, 0.18, mossY);
  mound(m, 1.4, 3.85, 0.32, 0.16, moss);
  mound(m, -5.1, 2.4, 0.4, 0.22, mossDeep);
  mound(m, 5.0, 1.6, 0.38, 0.2, mossLit);
  rock(m, -4.32, 0.52, 1.15);
  rock(m, 4.0, -0.62, 1.05);
  rock(m, -4.0, -3.7, 0.9);
  rock(m, 0.0, 4.5, 0.85);
  rock(m, 3.7, -3.95, 0.8);
});

function lantern(m, x, z, s, glowM) {
  faceBox(m, x - 0.26 * s, 0, z - 0.26 * s, x + 0.26 * s, 0.12 * s, z + 0.26 * s, stoneLit, stone, stoneShade, stone);
  faceBox(m, x - 0.09 * s, 0.12 * s, z - 0.09 * s, x + 0.09 * s, 0.48 * s, z + 0.09 * s, stone, stoneLit, stoneShade, stoneLit);
  const yb = 0.48 * s;
  faceBox(m, x - 0.24 * s, yb, z - 0.24 * s, x + 0.24 * s, yb + 0.34 * s, z + 0.24 * s, stoneLit, stone, stoneShade, plaster);
  const yt = yb + 0.34 * s;
  const n = 6;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2 + 0.2, a1 = ((i + 1) / n) * Math.PI * 2 + 0.2;
    const r0 = 0.38 * s, r1 = 0.05 * s, h = 0.32 * s;
    const kick = i % 2 === 0 ? 0.04 * s : 0;
    addQuad(m,
      [x + Math.cos(a0) * r0, yt, z + Math.sin(a0) * r0],
      [x + Math.cos(a1) * r0, yt, z + Math.sin(a1) * r0],
      [x + Math.cos(a1) * r1, yt + h + kick, z + Math.sin(a1) * r1],
      [x + Math.cos(a0) * r1, yt + h, z + Math.sin(a0) * r1],
      i < 3 ? stoneLit : stoneShade);
  }
  faceBox(m, x - 0.035 * s, yt + 0.3 * s, z - 0.035 * s, x + 0.035 * s, yt + 0.46 * s, z + 0.035 * s, stoneLit, stone, stoneShade, stone);
  glowM.push([x, yb + 0.16 * s, z + 0.24 * s + 0.01, 0.16 * s, 0.18 * s, 'z']);
  glowM.push([x + 0.24 * s + 0.01, yb + 0.16 * s, z, 0.16 * s, 0.18 * s, 'x']);
}
const glows = [];
part('MG_lanterns', false, m => {
  lantern(m, -2.78, 0.35, 1.2, glows);
  lantern(m, 2.82, 0.05, 1.12, glows);
  lantern(m, -1.48, 3.28, 0.72, glows);
  lantern(m, 1.55, 3.38, 0.66, glows);
});
part('MG_glow', true, m => {
  for (const [x, y, z, w, h, axis] of glows) {
    if (axis === 'z') {
      addQuad(m, [x - w, y, z], [x + w, y, z], [x + w, y + h, z], [x - w, y + h, z], glow);
      addQuad(m, [x - w * 1.8, y - h * 0.25, z + 0.02], [x + w * 1.8, y - h * 0.25, z + 0.02], [x + w * 1.5, y + h * 1.35, z + 0.02], [x - w * 1.5, y + h * 1.35, z + 0.02], glowSoft);
    } else {
      addQuad(m, [x, y, z - w], [x, y, z + w], [x, y + h, z + w], [x, y + h, z - w], glow);
      addQuad(m, [x + 0.02, y - h * 0.25, z - w * 1.8], [x + 0.02, y - h * 0.25, z + w * 1.8], [x + 0.02, y + h * 1.35, z + w * 1.5], [x + 0.02, y + h * 1.35, z - w * 1.5], glowSoft);
    }
  }
});

function trunk(m, x, z, h, r, lean) {
  const n = 6, lx = lean || 0;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
    const c = i < 2 ? woodLit : woodD;
    addQuad(m,
      [x + Math.cos(a0) * r, 0.02, z + Math.sin(a0) * r],
      [x + Math.cos(a1) * r, 0.02, z + Math.sin(a1) * r],
      [x + lx + Math.cos(a1) * r * 0.62, h, z + Math.sin(a1) * r * 0.62],
      [x + lx + Math.cos(a0) * r * 0.62, h, z + Math.sin(a0) * r * 0.62], c);
  }
}
function limb(m, a, b, w, col) {
  const dx = b[0] - a[0], dz = b[2] - a[2];
  let px = -dz, pz = dx;
  const l = Math.hypot(px, pz) || 1; px = px / l * w; pz = pz / l * w;
  addQuad(m, [a[0] - px, a[1], a[2] - pz], [a[0] + px, a[1], a[2] + pz], [b[0] + px * 0.4, b[1], b[2] + pz * 0.4], [b[0] - px * 0.4, b[1], b[2] - pz * 0.4], col, col, woodD, woodD);
}
function frond(m, x, y, z, dx, dy, dz, w, col) {
  const sx = dx < 0 ? -1 : 1;
  addQuad(m,
    [x, y, z],
    [x + dx, y + dy, z + dz],
    [x + dx * 0.72 + sx * w, y + dy * 0.45 + w * 0.25, z + dz * 0.55],
    [x + sx * w * 0.35, y + w * 0.08, z + w * 0.05],
    col, mix(col, maple3, 0.35), col, mix(col, mapleD, 0.3));
  addTri(m, [x + dx * 0.15, y + dy * 0.1, z], [x + dx + sx * w * 0.15, y + dy * 0.2, z + dz], [x + dx * 0.55 + sx * w * 0.55, y + dy * 0.85, z + dz * 0.4], mix(col, maple2, 0.4));
}
function mapleTree(m, x, z, h, s, lean, side, tint) {
  trunk(m, x, z, h, 0.1 * s, lean);
  const top = [x + lean, h, z];
  const arms = [
    [side * 0.72 * s, h + 0.42 * s, 0.12 * s],
    [side * 0.28 * s, h + 0.7 * s, -0.08 * s],
    [side * 0.15 * s, h + 0.22 * s, 0.48 * s],
    [side * 0.55 * s, h * 0.62, -0.28 * s],
  ];
  for (const a of arms) limb(m, [x + lean * 0.35, h * 0.78, z], [x + a[0], a[1], z + a[2]], 0.045 * s, wood);
  limb(m, top, [x + side * 0.85 * s, h + 0.15 * s, z + 0.05 * s], 0.04 * s, woodD);
  const fans = [
    [0.18, 0.92, 0.04, 0.85, maple],
    [0.08, 0.62, -0.1, 0.95, maple2],
    [0.28, 0.48, 0.16, 0.72, maple3],
    [0.05, 0.28, 0.22, 0.8, maple],
    [0.36, 0.15, -0.12, 0.66, mapleD],
    [0.12, 0.74, 0.18, 0.55, maple2],
    [0.22, 0.4, -0.2, 0.6, mix(maple, maple3, 0.4)],
  ];
  for (const f of fans) frond(m, x + lean * 0.4, h * 0.82, z, side * f[0] * s, f[1] * s + 0.2, f[2] * s, f[3] * s * 0.42, mix(f[4], tint, 0.15));
}
part('MG_maple', true, m => {
  mapleTree(m, -2.38, -0.35, 1.7, 0.95, -0.08, -1, rgba(210, 48, 28));
  mapleTree(m, -2.42, -1.7, 1.2, 0.7, -0.06, -1, rgba(196, 78, 26));
  mapleTree(m, 2.4, -0.55, 1.62, 0.9, 0.08, 1, rgba(214, 88, 24));
  mapleTree(m, 2.46, -1.9, 1.1, 0.66, 0.05, 1, rgba(180, 58, 26));
  const fallen = [[-2.55, 1.35, 0.16, 0.4], [-3.4, 0.1, 0.13, 1.2], [-2.7, -0.4, 0.12, 2.1], [-3.6, -2.2, 0.14, 0.8], [2.6, 0.9, 0.15, 1.5], [3.3, -0.3, 0.12, 0.6], [2.75, -1.1, 0.13, 2.4], [3.55, -2.3, 0.11, 1.1]];
  for (const [x, z, s, yaw] of fallen) {
    const c = Math.cos(yaw), sn = Math.sin(yaw);
    addQuad(m,
      [x - c * s, 0.035, z - sn * s * 0.6],
      [x + sn * s * 0.4, 0.04, z + c * s * 0.35],
      [x + c * s, 0.05, z + sn * s],
      [x - sn * s * 0.3, 0.038, z - c * s * 0.2],
      maple2, maple3, maple, mapleD);
  }
});

function corridor(m, x0, x1, z0, z1, posts) {
  const yf = 0.1, yh = 0.92, y2 = 1.08;
  addQuad(m, [x0, yf, z1], [x1, yf, z1], [x1, yf, z0], [x0, yf, z0], woodLit, woodLit, wood, wood);
  addQuad(m, [x0, 0.02, z1], [x0, yf, z1], [x0, yf, z0], [x0, 0.02, z0], woodD);
  for (let i = 0; i < posts; i++) {
    const z = z0 + (z1 - z0) * (i + 0.15) / posts;
    const px = x0 < 0 ? x1 - 0.1 : x0;
    faceBox(m, px, 0, z, px + 0.08, yh, z + 0.08, wood, woodLit, woodD, woodLit);
  }
  const outward = x0 < 0 ? -1 : 1;
  addQuad(m, [x0 + outward * 0.02, y2, z1], [x1, yh, z1], [x1, yh, z0], [x0 + outward * 0.02, y2, z0], tileLit, tile, tile, tileShade);
  addQuad(m, [x0, yh - 0.04, z1], [x1, yh - 0.04, z1], [x1, yh, z0], [x0, yh, z0], wood);
}
part('MG_corridor', false, m => {
  corridor(m, -3.55, -2.48, -4.35, 1.65, 7);
  corridor(m, 2.48, 3.55, -4.35, 1.45, 7);
  addQuad(m, [-2.48, 0.1, -4.35], [-1.15, 0.1, -4.35], [-1.15, 0.1, -4.05], [-2.48, 0.1, -4.05], woodLit);
  addQuad(m, [1.15, 0.1, -4.35], [2.48, 0.1, -4.35], [2.48, 0.1, -4.05], [1.15, 0.1, -4.05], wood);
  faceBox(m, -2.48, 0, -4.32, -2.4, 0.95, -4.24, wood, woodLit, woodD, wood);
  faceBox(m, 2.4, 0, -4.32, 2.48, 0.95, -4.24, wood, woodLit, woodD, wood);
});

part('MG_gate', false, m => {
  const z = -5.15, h = 1.15, open = 0.78;
  faceBox(m, -1.45, 0, z, -open, h, z + 0.28, plaster, plaster, plasterShade, plaster);
  faceBox(m, open, 0, z, 1.45, h, z + 0.28, plaster, plaster, plasterShade, plaster);
  faceBox(m, -1.55, h - 0.04, z - 0.04, 1.55, h + 0.05, z + 0.34, wood, woodLit, woodD, woodLit);
  const ridgeZ = z + 0.12, eaveZ = z + 0.62;
  addQuad(m, [-1.35, h + 0.48, ridgeZ], [1.35, h + 0.48, ridgeZ], [1.15, h + 0.16, eaveZ], [-1.15, h + 0.16, eaveZ], tileLit, tileLit, tile, tile);
  addTri(m, [-1.35, h + 0.48, ridgeZ], [-1.15, h + 0.16, eaveZ], [-2.05, h + 0.62, eaveZ + 0.18], tile, tileShade, tileLit);
  addTri(m, [1.35, h + 0.48, ridgeZ], [2.05, h + 0.62, eaveZ + 0.18], [1.15, h + 0.16, eaveZ], tileLit, tile, tile);
  addQuad(m, [-2.05, h + 0.62, eaveZ + 0.18], [-1.15, h + 0.16, eaveZ], [-1.15, h + 0.08, eaveZ + 0.04], [-1.85, h + 0.28, eaveZ + 0.16], woodD);
  addQuad(m, [2.05, h + 0.62, eaveZ + 0.18], [1.85, h + 0.28, eaveZ + 0.16], [1.15, h + 0.08, eaveZ + 0.04], [1.15, h + 0.16, eaveZ], wood);
  addQuad(m, [-1.25, h + 0.46, ridgeZ], [1.25, h + 0.46, ridgeZ], [1.05, h + 0.18, z - 0.22], [-1.05, h + 0.18, z - 0.22], tile, tile, tileShade, tileShade);
  addTri(m, [-1.25, h + 0.46, ridgeZ], [-1.72, h + 0.4, z - 0.28], [-1.05, h + 0.18, z - 0.22], tileShade);
  addTri(m, [1.25, h + 0.46, ridgeZ], [1.05, h + 0.18, z - 0.22], [1.72, h + 0.4, z - 0.28], tile);
  for (const sx of [-1.05, -0.35, 0.35, 1.05]) {
    addQuad(m, [sx, h + 0.05, eaveZ - 0.02], [sx + 0.08, h + 0.05, eaveZ - 0.02], [sx + 0.06, h + 0.2, ridgeZ + 0.08], [sx - 0.02, h + 0.2, ridgeZ + 0.08], woodD);
  }
  faceBox(m, -0.05, h + 0.46, ridgeZ - 0.04, 0.05, h + 0.68, ridgeZ + 0.16, tileLit, tile, tileShade, tile);
  for (let i = 0; i < 3; i++) {
    const y0 = 0.02 + i * 0.07;
    faceBox(m, -0.62, y0 - 0.07, z + 0.28, 0.62, y0, z + 0.55 - i * 0.04, stoneLit, stone, stoneShade, stone);
  }
  addQuad(m, [-open + 0.08, 0.22, z + 0.3], [-0.02, 0.22, z + 0.3], [-0.02, h - 0.14, z + 0.3], [-open + 0.08, h - 0.14, z + 0.3], wood);
  addQuad(m, [0.02, 0.22, z + 0.3], [open - 0.08, 0.22, z + 0.3], [open - 0.08, h - 0.14, z + 0.3], [0.02, h - 0.14, z + 0.3], woodLit);
});

part('MG_bridge', false, m => {
  const segs = 5;
  for (let i = 0; i < segs; i++) {
    const t0 = i / segs, t1 = (i + 1) / segs;
    const z0 = -2.48 - 1.15 * t0, z1 = -2.48 - 1.15 * t1;
    const arch = t => Math.sin(t * Math.PI) * 0.22;
    const y0 = 0.05 + arch(t0), y1 = 0.05 + arch(t1);
    addQuad(m, [-0.42, y0, z0], [0.42, y0, z0], [0.42, y1, z1], [-0.42, y1, z1], stoneLit, stoneLit, stone, stone);
    addQuad(m, [-0.42, y0 - 0.1, z0], [-0.42, y0, z0], [-0.42, y1, z1], [-0.42, y1 - 0.1, z1], stoneShade);
    addQuad(m, [0.42, y0 - 0.1, z0], [0.42, y0, z0], [0.42, y1, z1], [0.42, y1 - 0.1, z1], stone);
    addQuad(m, [-0.5, y0 + 0.1, z0], [-0.36, y0 + 0.1, z0], [-0.36, y1 + 0.12, z1], [-0.5, y1 + 0.12, z1], moss);
    addQuad(m, [0.36, y0 + 0.1, z0], [0.5, y0 + 0.1, z0], [0.5, y1 + 0.12, z1], [0.36, y1 + 0.12, z1], mossLit);
  }
});

part('MG_pond', true, m => {
  addQuad(m, [-1.85, 0.012, -2.42], [1.85, 0.012, -2.42], [1.55, 0.0, -4.35], [-1.55, 0.0, -4.35], waterLit, waterLit, waterDeep, water);
  addQuad(m, [-0.7, 0.02, -2.6], [0.85, 0.02, -2.65], [0.45, 0.015, -3.7], [-0.35, 0.015, -3.6], rgba(186, 214, 196, 140));
  for (const [x, z] of [[-1.1, -2.9], [1.05, -3.15], [-0.2, -3.85]]) {
    addQuad(m, [x - 0.22, 0.025, z], [x + 0.22, 0.025, z], [x + 0.12, 0.03, z + 0.1], [x - 0.12, 0.03, z + 0.1], rgba(210, 228, 214, 100));
  }
});

function hump(m, x, z, w, d, h, lit, shade, fade) {
  const yb = 0.04, top = yb + h;
  addQuad(m, [x - w, yb, z + d * 0.25], [x + w, yb, z + d * 0.05], [x + w * 0.72, top, z - d * 0.55], [x - w * 0.68, top * 0.92, z - d * 0.4], lit, shade, mix(lit, shade, 0.45), lit);
  addQuad(m, [x - w * 0.68, top * 0.92, z - d * 0.4], [x + w * 0.72, top, z - d * 0.55], [x + w * 0.4, yb + h * 0.35, z - d * 1.5], [x - w * 0.35, yb + h * 0.28, z - d * 1.35], mix(shade, fade, 0.35), fade, fade, shade);
  addQuad(m, [x + w * 0.2, yb, z + d * 0.15], [x + w * 1.15, yb, z - d * 0.2], [x + w * 0.7, yb + h * 0.48, z - d * 0.9], [x + w * 0.05, yb + h * 0.62, z - d * 0.5], shade, shade, mix(lit, fade, 0.4), shade);
}
part('MG_mountains', true, m => {
  const nearL = rgba(64, 112, 66), nearS = rgba(30, 72, 50);
  const midL = rgba(96, 132, 128), midS = rgba(64, 102, 110);
  const farL = rgba(158, 174, 172), far = rgba(176, 186, 186);
  const fall = rgba(186, 82, 36);
  hump(m, -3.4, -8.1, 2.1, 1.5, 1.55, nearL, nearS, midL);
  hump(m, 1.8, -7.7, 2.4, 1.7, 2.05, nearL, nearS, midS);
  hump(m, 5.6, -8.8, 1.5, 1.2, 0.85, mix(nearL, mossY, 0.25), nearS, midL);
  hump(m, -0.4, -11.2, 3.2, 1.8, 1.15, midL, midS, farL);
  hump(m, -5.2, -12.4, 2.2, 1.4, 0.62, midL, midS, farL);
  hump(m, 1.2, -16.2, 4.2, 2.0, 0.48, farL, far, skyMist);
  addQuad(m, [-2.6, 0.95, -8.0], [-1.2, 1.25, -8.35], [-1.0, 1.5, -8.6], [-2.3, 1.1, -8.2], fall, maple3, maple2, fall);
  addQuad(m, [1.4, 1.35, -7.7], [2.8, 1.7, -8.05], [2.5, 1.95, -8.3], [1.2, 1.5, -7.9], maple2, fall, maple3, maple);
  addQuad(m, [4.8, 0.55, -8.7], [6.1, 0.75, -8.95], [5.8, 1.0, -9.15], [4.6, 0.7, -8.85], mix(fall, maple3, 0.3), maple3, fall, maple2);
});

part('MG_mist', true, m => {
  addQuad(m, [-8, 0.05, -7.4], [8, 0.05, -7.4], [7.2, 0.9, -9.6], [-7.2, 0.9, -9.6], rgba(214, 196, 180, 78), rgba(214, 196, 180, 78), rgba(176, 190, 186, 28), rgba(176, 190, 186, 28));
  addQuad(m, [-10, 0.25, -11.2], [10, 0.25, -11.2], [8.5, 1.15, -14.2], [-8.5, 1.15, -14.2], rgba(196, 188, 184, 64));
  addQuad(m, [-11, 0.45, -15.4], [11, 0.45, -15.4], [9, 1.25, -18.6], [-9, 1.25, -18.6], rgba(186, 188, 190, 50));
});

part('MG_sky', true, m => {
  addQuad(m, [-26, -1.5, -21.4], [26, -1.5, -21.4], [18, 6.5, -22.2], [-18, 6.5, -22.2], skyMist, skyMist, skyLow, skyLow);
  addQuad(m, [-18, 6.5, -22.2], [18, 6.5, -22.2], [12, 16, -23], [-12, 16, -23], skyLow, skyLow, skyMid, skyHigh);
});
part('MG_sun', true, m => {
  const x = 1.7, y = 6.15, z = -19.4;
  const disc = (r, col, n) => {
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
      addTri(m, [x, y, z], [x + Math.cos(a0) * r, y + Math.sin(a0) * r, z], [x + Math.cos(a1) * r, y + Math.sin(a1) * r, z], col, col, col);
    }
  };
  disc(1.55, rgba(232, 186, 150, 42), 14);
  disc(0.82, rgba(244, 214, 180, 100), 12);
  disc(0.36, rgba(255, 244, 228), 10);
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
  const values = Float32Array.from([0, 0, 0, 0.028, 0.01, 0.016, 0, 0, 0]);
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
