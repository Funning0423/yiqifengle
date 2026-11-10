'use strict';
// 石灯苔庭 v4. Vertex colours only. The 7×7 stays on the court at y = 0.
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
const boardA = rgba(236, 216, 184), boardB = rgba(222, 198, 164), boardLine = rgba(186, 162, 132);
const mossStone = rgba(58, 84, 60), mossStoneLit = rgba(78, 108, 74);
const rakeCol = rgba(176, 172, 162);
const stone = rgba(168, 160, 148), stoneLit = rgba(214, 204, 186), stoneShade = rgba(108, 102, 94);
const maple = rgba(196, 42, 32), maple2 = rgba(214, 84, 28), maple3 = rgba(214, 140, 42), mapleD = rgba(132, 28, 28);
const wood = rgba(138, 86, 48), woodLit = rgba(186, 128, 74), woodD = rgba(78, 46, 28);
const plaster = rgba(244, 236, 222), plasterShade = rgba(214, 202, 184);
const tile = rgba(48, 62, 88), tileLit = rgba(78, 98, 128), tileShade = rgba(28, 36, 52);
const water = rgba(36, 108, 132), waterDeep = rgba(16, 58, 86), waterLit = rgba(92, 158, 156);
const glow = rgba(255, 176, 78), glowSoft = rgba(255, 196, 120, 110);
const hazeC = rgba(168, 180, 184);
const skyGold = rgba(255, 198, 128), skyPeach = rgba(255, 214, 186), skyMist = rgba(168, 190, 196);

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
  const patch = (x0, z0, x1, z1, a, b) => addQuad(m, [x0, Y, z1], [x1, Y, z1], [x1, Y, z0], [x0, Y, z0], a, b || a, b || a, a);
  const rearX = [X0, -3.2, -0.2, 3.1, X1], rearC = [moss, mossY, mossDeep, mossLit];
  for (let i = 0; i < rearC.length; i++) patch(rearX[i], Z0, rearX[i + 1], -4.55, rearC[i], mix(rearC[i], mossLit, 0.25));
  patch(X0, -4.55, -1.9, -HALF, mossLit, moss);
  patch(-1.9, -4.55, 1.9, -HALF, sand, sandWarm);
  patch(1.9, -4.55, X1, -HALF, mossY, moss);
  patch(X0, -HALF, -HALF, 0.2, moss, mossDeep);
  patch(X0, 0.2, -HALF, HALF, mossY, mossLit);
  patch(HALF, -HALF, X1, 0.15, mossLit, moss);
  patch(HALF, 0.15, X1, HALF, moss, mossY);
  patch(X0, HALF, -1.25, 4.7, mossDeep, moss);
  patch(-1.25, HALF, 1.25, Z1, sand, sandWarm);
  patch(1.25, HALF, X1, 4.7, mossLit, mossY);
  patch(X0, 4.7, -1.25, Z1, moss, mossY);
  patch(1.25, 4.7, X1, Z1, mossY, mossLit);
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
  const stones = [[0.08, 4.62]];
  for (const [cx, cz] of stones) {
    for (const rad of [0.34, 0.5, 0.68, 0.88, 1.1]) {
      const n = 20, w = 0.011;
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
  faceBox(m, -CURB - 0.14, Y, -CURB - 0.12, -CURB, 0.07, CURB + 0.12, mossStoneLit, stone, mossStone, stoneShade);
  faceBox(m, CURB, Y, -CURB - 0.12, CURB + 0.14, 0.07, CURB + 0.12, mossStoneLit, stoneLit, mossStone, stone);
  faceBox(m, -CURB, Y, -CURB - 0.14, CURB, 0.07, -CURB, mossStone, mossStoneLit, stoneShade, mossStone);
  faceBox(m, -CURB, Y, CURB, CURB, 0.055, CURB + 0.13, woodD, wood, rgba(62, 36, 22), woodD);
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
    const lit = i < 2 ? rgba(168, 198, 72) : i > 4 ? rgba(16, 64, 34) : (col || moss);
    addQuad(m, A[i], A[j], B[j], B[i], lit);
    addQuad(m, B[i], B[j], C[j], C[i], mix(lit, mossLit, 0.3));
  }
}
function rock(m, x, z, s) {
  faceBox(m, x, 0.02, z, x + 0.34 * s, 0.16 * s, z + 0.26 * s, stoneLit, stone, stoneShade, stoneLit);
  addQuad(m, [x + 0.04 * s, 0.16 * s, z + 0.04 * s], [x + 0.28 * s, 0.16 * s, z + 0.02 * s], [x + 0.22 * s, 0.16 * s + 0.001, z + 0.22 * s], [x + 0.06 * s, 0.16 * s + 0.001, z + 0.2 * s], mossLit);
}
part('MG_moss', false, m => {
  const beds = [
    [-2.58, 1.7, 0.38, 0.22, moss], [2.6, 1.45, 0.36, 0.2, mossY],
    [-2.7, 0.35, 0.42, 0.26, mossLit], [2.72, 0.1, 0.4, 0.24, moss],
    [-2.62, -0.95, 0.36, 0.2, mossY], [2.66, -1.15, 0.34, 0.18, mossDeep],
    [-3.5, 2.3, 0.5, 0.28, moss], [3.55, 2.05, 0.48, 0.26, mossY],
    [-4.3, 0.6, 0.72, 0.4, mossLit], [4.35, 0.3, 0.68, 0.38, moss],
    [-4.6, -1.4, 0.62, 0.34, mossY], [4.7, -1.6, 0.6, 0.32, mossDeep],
    [-3.4, -2.7, 0.4, 0.22, moss], [3.45, -2.9, 0.38, 0.2, mossLit],
    [-2.35, 3.45, 0.55, 0.32, mossY], [2.4, 3.55, 0.52, 0.3, moss],
    [-3.7, 4.45, 0.62, 0.36, moss], [3.75, 4.55, 0.58, 0.34, mossLit],
    [-5.4, -5.7, 0.7, 0.28, moss], [-2.6, -6.05, 0.75, 0.24, mossY],
    [0.15, -5.85, 0.62, 0.22, mossDeep], [2.9, -6.1, 0.72, 0.26, mossLit],
    [5.3, -5.65, 0.6, 0.22, moss],
  ];
  for (const [x, z, r, h, col] of beds) mound(m, x, z, r, h, col);
  rock(m, -0.02, 4.5, 1.2);
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
function puff(m, x, y, z, r, lit, shade) {
  const n = 6;
  const ring = (rad, yy) => Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 + 0.4;
    return [x + Math.cos(a) * rad, yy, z + Math.sin(a) * rad * 0.78];
  });
  const A = ring(r, y), B = ring(r * 0.62, y + r * 0.42);
  const top = [x, y + r * 0.72, z];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const c = i < n / 2 ? lit : shade;
    addQuad(m, A[i], A[j], B[j], B[i], c);
    addTri(m, B[i], B[j], top, mix(c, lit, 0.45));
  }
}
function mapleTree(m, x, z, h, s, lean, side, tint) {
  trunk(m, x, z, h, 0.08 * s, lean * 1.4);
  const cx = x + lean * 1.1, cz = z + side * 0.05;
  limb(m, [x, h * 0.45, z], [cx + side * 0.12 * s, h + 0.05 * s, cz], 0.04 * s, woodD);
  puff(m, cx, h - 0.05 * s, cz, 0.42 * s, mix(maple, tint, 0.2), mapleD);
  puff(m, cx + side * 0.16 * s, h + 0.22 * s, cz + 0.04, 0.32 * s, mix(maple2, tint, 0.25), maple);
  puff(m, cx + side * 0.05 * s, h + 0.42 * s, cz - 0.02, 0.22 * s, maple3, maple2);
}
part('MG_maple', true, m => {
  mapleTree(m, -2.62, -0.85, 1.72, 1.05, -0.1, -1, rgba(210, 48, 28));
  mapleTree(m, 2.62, -0.8, 1.68, 1.02, 0.1, 1, rgba(214, 88, 24));
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

function dome(m, x, z, rx, rz, h, yb, lit, shade) {
  const n = 7;
  const heights = [0, 0.4, 0.75, 1], scales = [1, 0.72, 0.4, 0.06];
  const ring = k => Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 + 0.35;
    const wob = 0.9 + 0.12 * Math.sin(i * 1.6 + k);
    return [x + Math.cos(a) * rx * scales[k] * wob, yb + h * heights[k], z + Math.sin(a) * rz * scales[k] * wob];
  });
  const rings = heights.map((_, k) => ring(k));
  for (let k = 0; k < 3; k++) for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const c = i < 3 ? lit : shade;
    const up = k === 2 ? mix(c, lit, 0.35) : c;
    addQuad(m, rings[k][i], rings[k][j], rings[k + 1][j], rings[k + 1][i], up);
  }
}
part('MG_mountains', true, m => {
  const nearL = rgba(78, 128, 74), nearS = rgba(42, 86, 58);
  const midL = rgba(118, 150, 156), midS = rgba(78, 118, 132);
  const farL = rgba(176, 190, 196), farS = rgba(150, 170, 182);
  dome(m, -5.2, -8.6, 2.6, 1.5, 1.35, 0.02, nearL, nearS);
  dome(m, -0.6, -8.1, 2.3, 1.45, 1.7, 0.05, nearL, nearS);
  dome(m, 4.4, -8.8, 2.8, 1.55, 1.15, 0.0, mix(nearL, mossY, 0.2), nearS);
  dome(m, -2.9, -7.45, 1.45, 0.9, 0.78, 0.0, mossLit, moss);
  dome(m, 2.15, -7.6, 1.3, 0.85, 0.62, 0.0, mossY, mossDeep);
  dome(m, -6.3, -7.3, 1.05, 0.7, 0.5, 0.0, moss, mossDeep);
  dome(m, 6.15, -7.4, 1.1, 0.72, 0.52, 0.0, mossLit, moss);
  dome(m, -1.5, -9.7, 2.3, 1.15, 0.58, 0.12, nearL, nearS);
  dome(m, 2.6, -9.9, 2.1, 1.05, 0.5, 0.1, mix(nearL, midL, 0.3), nearS);
  dome(m, -5.6, -9.5, 1.7, 0.95, 0.42, 0.08, nearL, moss);
  dome(m, 1.4, -10.3, 4.2, 1.35, 0.9, 0.04, nearL, nearS);
  dome(m, -3.6, -10.4, 2.4, 1.2, 0.72, 0.06, mix(nearL, midL, 0.22), nearS);
  dome(m, -3.2, -12.2, 3.4, 1.7, 0.85, 0.2, midL, midS);
  dome(m, 3.6, -12.8, 3.6, 1.6, 0.62, 0.25, midL, midS);
  dome(m, 0.2, -16.8, 6.5, 2.2, 0.42, 0.45, farL, farS);
});

part('MG_mist', true, m => {
  addQuad(m, [-9, 0.35, -11.6], [9, 0.35, -11.6], [8, 1.15, -13.8], [-8, 1.15, -13.8], rgba(166, 186, 188, 56), rgba(166, 186, 188, 56), rgba(150, 174, 182, 18), rgba(150, 174, 182, 18));
  addQuad(m, [-10, 0.4, -13.2], [10, 0.4, -13.2], [8.5, 1.2, -15.6], [-8.5, 1.2, -15.6], rgba(170, 188, 192, 48));
  addQuad(m, [-11, 0.45, -15.4], [11, 0.45, -15.4], [9, 1.25, -18.6], [-9, 1.25, -18.6], rgba(186, 188, 190, 50));
});

part('MG_sky', true, m => {
  addQuad(m, [-28, -2.2, -21.6], [28, -2.2, -21.6], [22, 3.2, -22], [-22, 3.2, -22], skyMist, skyMist, skyPeach, skyPeach);
  addQuad(m, [-22, 3.2, -22], [22, 3.2, -22], [12, 17, -23.2], [-12, 17, -23.2], skyPeach, skyPeach, skyGold, skyGold);
});
part('MG_sun', true, m => {
  const x = 1.7, y = 6.15, z = -19.4;
  const disc = (r, col, n) => {
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
      addTri(m, [x, y, z], [x + Math.cos(a0) * r, y + Math.sin(a0) * r, z], [x + Math.cos(a1) * r, y + Math.sin(a1) * r, z], col, col, col);
    }
  };
  disc(1.45, rgba(255, 196, 140, 70), 14);
  disc(0.78, rgba(255, 220, 170, 130), 12);
  disc(0.34, rgba(255, 246, 226), 10);
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
