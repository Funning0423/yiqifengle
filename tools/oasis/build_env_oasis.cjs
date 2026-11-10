'use strict';
// Stylised desert-oasis courtyard. Vertex colours only (no texture). The sand-brick
// floor is one surface at y = 0, and the 7×7 grid is painted into that surface.
// Water, lamps, the sun and the dusk sky are unlit so the light does not recolour them.
const fs = require('node:fs'), path = require('node:path');
const OUT = path.resolve(__dirname, '../../creator-build-project/assets/bundles/region_oasis/models/env_oasis.glb');
const Y = 0, X0 = -6.5, X1 = 6.5, Z0 = -7, Z1 = 7;
const HALF = 2.125, CELL = (HALF * 2) / 7, LINE = 0.07;
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
  const cols = [ca, cb || ca, cc || ca];
  [a, b, c].forEach((p, i) => {
    m.pos.push(p[0], p[1], p[2]); m.nrm.push(nx, ny, nz);
    const c = cols[i]; m.col.push(c[0], c[1], c[2], c[3] ?? 255);
  });
  m.idx.push(base, base + 1, base + 2);
}
function addQuad(m, a, b, c, d, ca, cb, cc, cd) { addTri(m, a, b, c, ca, cb, cc); addTri(m, a, c, d, ca, cc, cd || ca); }
function box(m, x0, y0, z0, x1, y1, z1, c) {
  const top = c, bot = mix(c, rgba(40, 24, 16), 0.35), e = mix(c, rgba(40, 24, 16), 0.16), w = mix(c, rgba(255, 220, 180), 0.08);
  addQuad(m, [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], top);
  addQuad(m, [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], bot);
  addQuad(m, [x1, y0, z1], [x1, y1, z1], [x1, y1, z0], [x1, y0, z0], e);
  addQuad(m, [x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1], mix(c, rgba(20, 12, 8), 0.22));
  addQuad(m, [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], w);
  addQuad(m, [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], mix(c, rgba(20, 12, 8), 0.1));
}
const parts = [];
function part(name, unlit, build) { const m = mesh(); build(m); parts.push({ name, unlit: !!unlit, m }); }

const brickA = rgba(214, 158, 96), brickB = rgba(196, 138, 78), grout = rgba(132, 88, 52);
const cellA = rgba(244, 224, 188), cellB = rgba(232, 206, 164), cellLine = rgba(186, 142, 96);
function fillBricks(m, x0, x1, z0, z1) {
  if (x1 - x0 < 0.08 || z1 - z0 < 0.08) return;
  const nx = Math.max(1, Math.round((x1 - x0) / 1.08));
  const nz = Math.max(1, Math.round((z1 - z0) / 1.08));
  const cw = (x1 - x0) / nx, cd = (z1 - z0) / nz, g = 0.045;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const ax = i === 0 ? x0 : x0 + i * cw, bx = i === nx - 1 ? x1 : x0 + (i + 1) * cw;
    const az = j === 0 ? z0 : z0 + j * cd, bz = j === nz - 1 ? z1 : z0 + (j + 1) * cd;
    const ix0 = i === 0 ? ax : ax + g, ix1 = i === nx - 1 ? bx : bx - g;
    const iz0 = j === 0 ? az : az + g, iz1 = j === nz - 1 ? bz : bz - g;
    const col = (i + j * 2) % 3 === 0 ? brickB : brickA;
    const tone = mix(col, rgba(255, 228, 190), ((i * 5 + j * 3) % 4) * 0.03);
    addQuad(m, [ix0, Y, iz1], [ix1, Y, iz1], [ix1, Y, iz0], [ix0, Y, iz0], tone);
    if (i > 0) addQuad(m, [ax, Y, iz0], [ax + g, Y, iz0], [ax + g, Y, iz1], [ax, Y, iz1], grout);
    if (j > 0) addQuad(m, [ix0, Y, az], [ix1, Y, az], [ix1, Y, az + g], [ix0, Y, az + g], grout);
  }
}

part('OA_ground', false, m => {
  fillBricks(m, X0, -HALF, Z0, Z1);
  fillBricks(m, HALF, X1, Z0, Z1);
  fillBricks(m, -HALF, HALF, Z1 > 2.125 ? HALF : Z1, Z1);
  fillBricks(m, -HALF, HALF, Z0, -5.25);
  fillBricks(m, -HALF, HALF, -3.4, -HALF);
  fillBricks(m, -HALF, -1.45, -5.25, -3.4);
  fillBricks(m, 1.45, HALF, -5.25, -3.4);
  const edges = [];
  for (let i = 0; i <= 7; i++) edges.push(i === 7 ? HALF : -HALF + i * CELL);
  const halfL = LINE * 0.5;
  for (let row = 0; row < 7; row++) for (let col = 0; col < 7; col++) {
    const colr = (row + col) % 2 ? cellA : cellB;
    const x0 = edges[col] + halfL, x1 = edges[col + 1] - halfL, z0 = edges[row] + halfL, z1 = edges[row + 1] - halfL;
    addQuad(m, [x0, Y, z1], [x1, Y, z1], [x1, Y, z0], [x0, Y, z0], colr);
  }
  for (let i = 0; i <= 7; i++) {
    const x = edges[i];
    addQuad(m, [x - halfL, Y, -HALF], [x + halfL, Y, -HALF], [x + halfL, Y, HALF], [x - halfL, Y, HALF], cellLine);
  }
  for (let row = 0; row <= 7; row++) for (let col = 0; col < 7; col++) {
    const z = edges[row], a = edges[col] + halfL, b = edges[col + 1] - halfL;
    addQuad(m, [a, Y, z - halfL], [b, Y, z - halfL], [b, Y, z + halfL], [a, Y, z + halfL], cellLine);
  }
});

function roundArch(m, x0, x1, zL, zR, spring, rise, col) {
  const zc = (zL + zR) / 2, half = (zR - zL) / 2, n = 5;
  const inner = t => {
    const a = Math.PI * (1 - t);
    return [zc + Math.cos(a) * half, spring + Math.sin(a) * rise];
  };
  const outer = t => {
    const a = Math.PI * (1 - t);
    return [zc + Math.cos(a) * (half + 0.18), spring + Math.sin(a) * (rise + 0.2)];
  };
  for (let i = 0; i < n; i++) {
    const a = inner(i / n), b = inner((i + 1) / n), c = outer((i + 1) / n), d = outer(i / n);
    const shade = mix(col, rgba(92, 52, 32), i === 2 ? 0.02 : 0.12);
    addQuad(m, [x1, a[1], a[0]], [x1, b[1], b[0]], [x1, c[1], c[0]], [x1, d[1], d[0]], shade);
    addQuad(m, [x0, b[1], b[0]], [x0, a[1], a[0]], [x0, d[1], d[0]], [x0, c[1], c[0]], mix(shade, rgba(40, 22, 14), 0.2));
    addQuad(m, [x0, a[1], a[0]], [x1, a[1], a[0]], [x1, b[1], b[0]], [x0, b[1], b[0]], mix(col, rgba(255, 214, 170), 0.12));
    addQuad(m, [x0, d[1], d[0]], [x0, c[1], c[0]], [x1, c[1], c[0]], [x1, d[1], d[0]], mix(col, rgba(40, 22, 14), 0.18));
    const parapet = 2.28;
    addQuad(m, [x0, d[1], d[0]], [x0, parapet, d[0]], [x0, parapet, c[0]], [x0, c[1], c[0]], mix(col, rgba(40, 22, 14), 0.16));
    addQuad(m, [x1, d[1], d[0]], [x1, c[1], c[0]], [x1, parapet, c[0]], [x1, parapet, d[0]], col);
    addQuad(m, [x0, parapet, d[0]], [x1, parapet, d[0]], [x1, parapet, c[0]], [x0, parapet, c[0]], mix(col, rgba(255, 220, 180), 0.14));
  }
}

part('OA_arcade', false, m => {
  const sand = rgba(198, 118, 68), pier = rgba(176, 102, 58), foot = rgba(120, 74, 46);
  for (const sign of [-1, 1]) {
    const x = sign * 2.42, x0 = x - 0.14, x1 = x + 0.14;
    const zA = 0.15, bay = 1.52, piers = 4, pierW = 0.3;
    box(m, x0 - 0.04, Y, zA, x1 + 0.04, 0.16, zA + bay * 3, foot);
    for (let i = 0; i < piers; i++) {
      const z = zA + i * bay;
      box(m, x0, Y, z, x1, 1.18, z + pierW, pier);
      box(m, x0 - 0.02, 1.18, z - 0.02, x1 + 0.02, 1.28, z + pierW + 0.02, mix(sand, rgba(232, 190, 140), 0.35));
    }
    for (let i = 0; i < 3; i++) {
      const zL = zA + i * bay + pierW, zR = zA + (i + 1) * bay;
      roundArch(m, x0, x1, zL, zR, 1.18, 0.78, sand);
    }
    // Inner face string, so the wall reads as masonry rather than a rail.
    addQuad(m, [x - sign * 0.18, 0.16, zA], [x - sign * 0.18, 0.16, zA + bay * 3], [x - sign * 0.18, 0.28, zA + bay * 3], [x - sign * 0.18, 0.28, zA], rgba(146, 86, 50));
  }
});

function palm(m, x, z, h, r) {
  const trunk = rgba(122, 78, 42), trunkD = rgba(86, 52, 30), frond = rgba(58, 122, 64), frondD = rgba(36, 86, 48), date = rgba(176, 78, 36);
  const n = 4;
  for (let s = 0; s < 3; s++) {
    const y0 = h * s / 3, y1 = h * (s + 1) / 3;
    const r0 = r * (1 - s * 0.18), r1 = r * (1 - (s + 1) * 0.18);
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
      const col = i % 2 ? trunk : trunkD;
      addQuad(m,
        [x + Math.cos(a0) * r0, y0, z + Math.sin(a0) * r0],
        [x + Math.cos(a1) * r0, y0, z + Math.sin(a1) * r0],
        [x + Math.cos(a1) * r1, y1, z + Math.sin(a1) * r1],
        [x + Math.cos(a0) * r1, y1, z + Math.sin(a0) * r1],
        col);
    }
  }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    const dx = Math.cos(a), dz = Math.sin(a);
    const root = [x + dx * r * 0.2, h * 0.92, z + dz * r * 0.2];
    const tip = [x + dx * 0.85, h * 0.62, z + dz * 0.85];
    const side = [-dz * 0.16, 0, dx * 0.16];
    const col = i % 2 ? frond : frondD;
    addTri(m, root, [tip[0] + side[0], tip[1] + 0.18, tip[2] + side[2]], [tip[0] - side[0], tip[1], tip[2] - side[2]], mix(col, rgba(180, 210, 90), 0.25), col, frondD);
  }
  for (const [dx, dz] of [[0.16, 0.05], [-0.08, 0.14], [0.02, -0.12]]) {
    box(m, x + dx - 0.06, h * 0.72, z + dz - 0.06, x + dx + 0.06, h * 0.86, z + dz + 0.06, date);
  }
}

part('OA_palms', false, m => {
  palm(m, -2.85, 3.55, 2.35, 0.1);
  palm(m, 2.95, 3.25, 2.5, 0.11);
  palm(m, -3.15, -3.15, 2.2, 0.09);
  palm(m, 3.25, -2.95, 2.3, 0.09);
});

function pot(m, x, z, h, r, col) {
  const n = 5, lip = mix(col, rgba(255, 220, 180), 0.2), body = col, foot = mix(col, rgba(40, 18, 12), 0.25);
  const ring = (y, rad) => Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return [x + Math.cos(a) * rad, y, z + Math.sin(a) * rad];
  });
  const a = ring(0.02, r * 0.62), b = ring(h * 0.72, r), c = ring(h, r * 0.78);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    addQuad(m, a[i], a[j], b[j], b[i], foot, foot, body, body);
    addQuad(m, b[i], b[j], c[j], c[i], body, body, lip, lip);
  }
  addQuad(m, c[0], c[1], c[2], [x, h + 0.01, z], lip);
}

part('OA_pots', false, m => {
  const clay = rgba(176, 78, 48), clay2 = rgba(150, 64, 42);
  pot(m, -3.15, 3.55, 0.42, 0.2, clay);
  pot(m, -2.72, 4.05, 0.3, 0.15, clay2);
  pot(m, 3.2, 3.35, 0.46, 0.22, clay);
  pot(m, 2.7, 4.15, 0.28, 0.14, clay2);
  pot(m, -3.35, -2.55, 0.36, 0.16, clay2);
  pot(m, 3.4, -2.35, 0.34, 0.15, clay);
  const leaf = rgba(64, 130, 62);
  for (const [x, z, h] of [[-3.15, 3.55, 0.42], [3.2, 3.35, 0.46], [-3.35, -2.55, 0.36]]) {
    addTri(m, [x, h, z], [x - 0.16, h + 0.28, z + 0.04], [x + 0.02, h + 0.22, z - 0.14], leaf);
    addTri(m, [x, h, z], [x + 0.18, h + 0.24, z + 0.02], [x + 0.04, h + 0.18, z + 0.16], mix(leaf, rgba(170, 200, 80), 0.3));
  }
});

const mosaic = [rgba(42, 150, 138), rgba(36, 92, 148), rgba(214, 154, 64), rgba(236, 214, 176), rgba(64, 168, 150)];
part('OA_pool', false, m => {
  const x0 = -1.45, x1 = 1.45, z0 = -5.25, z1 = -3.4;
  const rim = 0.2, floor = -0.22;
  const tiles = (ax, az, bx, bz, row) => {
    const n = Math.max(2, Math.round((bx - ax) / 0.22));
    const w = (bx - ax) / n;
    for (let i = 0; i < n; i++) {
      const a = ax + i * w, b = a + w;
      addQuad(m, [a, Y, bz], [b, Y, bz], [b, Y, az], [a, Y, az], mosaic[(i + row) % mosaic.length]);
    }
  };
  tiles(x0, z1 - rim, x1, z1, 0);
  tiles(x0, z0, x1, z0 + rim, 1);
  tiles(x0, z0 + rim, x0 + rim, z1 - rim, 2);
  tiles(x1 - rim, z0 + rim, x1, z1 - rim, 3);
  const ix0 = x0 + rim, ix1 = x1 - rim, iz0 = z0 + rim, iz1 = z1 - rim;
  addQuad(m, [ix0, floor, iz1], [ix1, floor, iz1], [ix1, floor, iz0], [ix0, floor, iz0], rgba(186, 154, 104));
  addQuad(m, [ix0, floor, iz0], [ix1, floor, iz0], [ix1, Y, iz0], [ix0, Y, iz0], rgba(150, 112, 74));
  addQuad(m, [ix1, floor, iz1], [ix0, floor, iz1], [ix0, Y, iz1], [ix1, Y, iz1], rgba(160, 120, 80));
  addQuad(m, [ix1, floor, iz0], [ix1, floor, iz1], [ix1, Y, iz1], [ix1, Y, iz0], rgba(140, 100, 68));
  addQuad(m, [ix0, floor, iz1], [ix0, floor, iz0], [ix0, Y, iz0], [ix0, Y, iz1], rgba(150, 108, 72));
  // Fountain drum sits on the pool floor.
  const fx = 0, fz = -4.32, fr = 0.28;
  for (let i = 0; i < 6; i++) {
    const a0 = (i / 6) * Math.PI * 2, a1 = ((i + 1) / 6) * Math.PI * 2;
    addQuad(m,
      [fx + Math.cos(a0) * fr, floor, fz + Math.sin(a0) * fr],
      [fx + Math.cos(a1) * fr, floor, fz + Math.sin(a1) * fr],
      [fx + Math.cos(a1) * fr, 0.06, fz + Math.sin(a1) * fr],
      [fx + Math.cos(a0) * fr, 0.06, fz + Math.sin(a0) * fr],
      rgba(214, 190, 156));
  }
  box(m, -0.08, floor, fz - 0.08, 0.08, 0.62, fz + 0.08, rgba(196, 168, 136));
});

part('OA_water', true, m => {
  const ix0 = -1.25, ix1 = 1.25, iz0 = -5.05, iz1 = -3.6;
  addQuad(m, [ix0, -0.05, iz1], [ix1, -0.05, iz1], [ix1, -0.05, iz0], [ix0, -0.05, iz0], rgba(48, 156, 168, 210), rgba(64, 176, 176, 210), rgba(36, 120, 150, 220), rgba(42, 132, 158, 220));
});

part('OA_spray', true, m => {
  const fz = -4.32;
  const sheet = (dx, dz, h) => {
    addQuad(m, [-0.05 + dx, 0.58, fz], [0.05 + dx, 0.58, fz], [0.08 + dx, h, fz + dz], [-0.08 + dx, h, fz + dz], rgba(186, 230, 232, 180), rgba(186, 230, 232, 180), rgba(220, 246, 244, 40), rgba(220, 246, 244, 40));
  };
  sheet(0, 0.22, 0.12);
  sheet(-0.16, -0.12, 0.16);
  sheet(0.16, -0.08, 0.14);
});

part('OA_canopy', false, m => {
  const cloth = rgba(176, 64, 48), saffron = rgba(214, 138, 48), post = rgba(112, 72, 44);
  const z0 = -6.35, z1 = -5.45, xL = -2.15, xR = 2.15;
  for (const x of [xL, xR]) box(m, x - 0.06, Y, z0 - 0.06, x + 0.06, 1.72, z0 + 0.06, post);
  for (const x of [xL, xR]) box(m, x - 0.06, Y, z1 - 0.06, x + 0.06, 1.55, z1 + 0.06, post);
  box(m, xL, 1.62, z0 - 0.05, xR, 1.74, z0 + 0.05, post);
  const n = 6;
  for (let i = 0; i < n; i++) {
    const t0 = i / n, t1 = (i + 1) / n;
    const xa = xL + (xR - xL) * t0, xb = xL + (xR - xL) * t1;
    const sag = (t) => Math.sin(t * Math.PI) * 0.22;
    const y0 = 1.68 - sag(t0), y1 = 1.68 - sag(t1);
    const y2 = 1.48 - sag(t1) * 0.8, y3 = 1.48 - sag(t0) * 0.8;
    const col = i % 2 ? cloth : saffron;
    addQuad(m, [xa, y0, z0], [xb, y1, z0], [xb, y2, z1], [xa, y3, z1], mix(col, rgba(255, 220, 170), 0.12), col, mix(col, rgba(60, 20, 16), 0.18), col);
  }
});

part('OA_valance', true, m => {
  const z = -5.45, y = 1.46;
  for (let i = 0; i < 8; i++) {
    const x = -1.9 + i * 0.52;
    const col = i % 2 ? rgba(176, 64, 48, 230) : rgba(214, 138, 48, 230);
    addQuad(m, [x, y, z], [x + 0.36, y, z], [x + 0.3, y - 0.28, z + 0.02], [x + 0.06, y - 0.28, z + 0.02], col);
  }
});

part('OA_lamps', true, m => {
  const glow = rgba(255, 186, 96);
  for (const sign of [-1, 1]) {
    const x = sign * 2.26;
    for (const z of [0.3, 1.82, 3.34, 4.7]) {
      box(m, x - 0.05, 1.32, z - 0.05, x + 0.05, 1.48, z + 0.05, glow);
    }
  }
});

part('OA_dunes', false, m => {
  const near = rgba(214, 164, 104), mid = rgba(196, 140, 82), far = rgba(168, 112, 72), shade = rgba(132, 86, 58);
  addQuad(m, [X0, Y, Z0], [X1, Y, Z0], [4.2, 1.35, -10.2], [-4.2, 1.35, -10.4], near, near, mid, mid);
  addQuad(m, [-4.2, 1.35, -10.4], [4.2, 1.35, -10.2], [2.4, 2.15, -13.6], [-2.6, 2.05, -13.8], mid, mid, far, far);
  addQuad(m, [-2.6, 2.05, -13.8], [2.4, 2.15, -13.6], [0.4, 2.55, -16.2], [-1.2, 2.4, -16.4], far, far, shade, shade);
  addQuad(m, [X1, Y, Z0], [X1, Y, 2], [9.2, 1.15, -1.5], [8.4, 0.85, -6.2], near, mix(near, rgba(255, 214, 160), 0.15), mid, shade);
  addQuad(m, [X0, Y, 2], [X0, Y, Z0], [-8.6, 0.95, -6.4], [-9.4, 1.25, -1.2], near, near, shade, mid);
  // Distant palms stand on the dune, not in the air.
  const trunk = rgba(96, 64, 40), frond = rgba(48, 96, 58);
  const tuft = (x, y, z, h) => {
    addQuad(m, [x - 0.05, y, z], [x + 0.05, y, z], [x + 0.04, y + h, z - 0.2], [x - 0.04, y + h, z - 0.2], trunk);
    addTri(m, [x, y + h * 0.85, z - 0.15], [x - 0.45, y + h * 0.45, z - 0.35], [x + 0.4, y + h * 0.4, z - 0.05], frond);
  };
  tuft(-3.2, 1.55, -11.2, 1.3);
  tuft(3.4, 1.62, -11.6, 1.15);
});

part('OA_sky', true, m => {
  addQuad(m, [-16, 0.2, -18], [16, 0.2, -18], [12, 16, -20], [-12, 16, -20], rgba(232, 132, 78), rgba(214, 96, 72), rgba(92, 42, 78), rgba(48, 24, 58));
  addQuad(m, [-18, 1.2, -8], [18, 1.2, -8], [16, 0.2, -18], [-16, 0.2, -18], rgba(244, 168, 96, 80), rgba(236, 140, 84, 80), rgba(232, 132, 78, 0), rgba(232, 132, 78, 0));
});

part('OA_sun', true, m => {
  const x = 2.4, y = 6.8, z = -17.2, s = 0.72;
  addQuad(m, [x - s, y - s, z], [x + s, y - s, z], [x + s, y + s, z], [x - s, y + s, z], rgba(255, 214, 140));
  addQuad(m, [x - s * 1.7, y - s * 0.35, z + 0.1], [x + s * 1.7, y - s * 0.35, z + 0.1], [x + s * 1.35, y + s * 0.35, z + 0.1], [x - s * 1.35, y + s * 0.35, z + 0.1], rgba(255, 186, 120, 90));
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
  const values = Float32Array.from([0, 0, 0, 0.05, -0.02, 0.02, 0, 0, 0]);
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
console.log(JSON.stringify({ bytes: body.length, tris, counts, courtY: Y, budget: 943718 }, null, 2));
if (tris > 3000) throw Error('tris ' + tris);
