'use strict';
// Stylised fjord boardwalk. Vertex colours only (no texture). The pier top is one
// flat surface at y = 1.25, and the 7×7 grid is painted into that surface.
// Aurora, stars, windows and lanterns are unlit so the light does not recolour them.
const fs = require('node:fs'), path = require('node:path');
const OUT = path.resolve(__dirname, '../../creator-build-project/assets/bundles/region_fjord/models/env_fjord.glb');
const Y = 1.25, X0 = -2.5, X1 = 2.5, Z0 = -2.5, Z1 = 2.5;
const HALF = 2.125, CELL = (HALF * 2) / 7, LINE = 0.086;
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
  addQuad(m, [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], c);
  addQuad(m, [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], mix(c, rgba(0, 0, 0), 0.35));
  addQuad(m, [x1, y0, z1], [x1, y1, z1], [x1, y1, z0], [x1, y0, z0], mix(c, rgba(0, 0, 0), 0.18));
  addQuad(m, [x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1], mix(c, rgba(0, 0, 0), 0.28));
  addQuad(m, [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], mix(c, rgba(255, 255, 255), 0.08));
  addQuad(m, [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], mix(c, rgba(0, 0, 0), 0.12));
}
function peak(m, x, y0, z, rx, rz, h, c, snow) {
  const top = [x, y0 + h, z], ring = [[x + rx, y0, z], [x, y0, z + rz], [x - rx, y0, z], [x, y0, z - rz]];
  for (let i = 0; i < 4; i++) {
    const t = i / 4, col = mix(c, rgba(210, 220, 230), t > 0.5 && snow ? 0.75 : 0.08 + (i % 2) * 0.08);
    addTri(m, top, ring[i], ring[(i + 1) % 4], snow ? rgba(232, 238, 244) : col, col, mix(col, rgba(40, 46, 54), 0.25));
  }
}
const parts = [];
function part(name, unlit, build) { const m = mesh(); build(m); parts.push({ name, unlit: !!unlit, m }); }

const woodA = rgba(176, 118, 64), woodB = rgba(148, 96, 52), seam = rgba(92, 60, 36), grid = rgba(236, 232, 214);
part('FJ_platform', false, m => {
  const yb = 0.62;
  addQuad(m, [X0, yb, Z0], [X1, yb, Z0], [X1, yb, Z1], [X0, yb, Z1], rgba(74, 48, 30));
  addQuad(m, [X0, yb, Z1], [X1, yb, Z1], [X1, Y, Z1], [X0, Y, Z1], rgba(120, 78, 44));
  addQuad(m, [X1, yb, Z0], [X0, yb, Z0], [X0, Y, Z0], [X1, Y, Z0], rgba(96, 62, 36));
  addQuad(m, [X1, yb, Z1], [X1, yb, Z0], [X1, Y, Z0], [X1, Y, Z1], rgba(132, 86, 48));
  addQuad(m, [X0, yb, Z0], [X0, yb, Z1], [X0, Y, Z1], [X0, Y, Z0], rgba(110, 72, 40));
  const plank = (x0, x1, z0, z1) => {
    const stripes = Math.max(2, Math.round((x1 - x0) / 0.22));
    const w = (x1 - x0) / stripes;
    for (let i = 0; i < stripes; i++) {
      const a = x0 + i * w, b = a + w * 0.9, gap = a + w;
      const col = i % 2 ? woodA : woodB;
      addQuad(m, [a, Y, z1], [b, Y, z1], [b, Y, z0], [a, Y, z0], col, mix(col, rgba(255, 230, 190), 0.12), mix(col, rgba(40, 24, 12), 0.18), col);
      if (b < gap - 1e-4) addQuad(m, [b, Y, z1], [gap, Y, z1], [gap, Y, z0], [b, Y, z0], seam);
    }
  };
  plank(X0, -HALF, Z0, Z1); plank(HALF, X1, Z0, Z1); plank(-HALF, HALF, Z0, -HALF); plank(-HALF, HALF, HALF, Z1);
  const edges = [];
  for (let i = 0; i <= 7; i++) edges.push(i === 7 ? HALF : -HALF + i * CELL);
  const halfL = LINE * 0.5;
  for (let row = 0; row < 7; row++) for (let col = 0; col < 7; col++) {
    plank(edges[col] + halfL, edges[col + 1] - halfL, edges[row] + halfL, edges[row + 1] - halfL);
  }
  for (let i = 0; i <= 7; i++) {
    const x = edges[i];
    addQuad(m, [x - halfL, Y, -HALF], [x + halfL, Y, -HALF], [x + halfL, Y, HALF], [x - halfL, Y, HALF], grid);
  }
  for (let row = 0; row <= 7; row++) for (let col = 0; col < 7; col++) {
    const z = edges[row], a = edges[col] + halfL, b = edges[col + 1] - halfL;
    addQuad(m, [a, Y, z - halfL], [b, Y, z - halfL], [b, Y, z + halfL], [a, Y, z + halfL], grid);
  }
  for (const [x, z] of [[-2.28, -2.05], [2.28, -2.05], [-2.28, 2.05], [2.28, 2.05], [-2.28, 0], [2.28, 0]]) {
    box(m, x - 0.07, -0.05, z - 0.07, x + 0.07, yb, z + 0.07, rgba(78, 52, 34));
  }
});

part('FJ_steps', false, m => {
  const plankLike = (x0, x1, z0, z1, y) => {
    const n = 6, w = (x1 - x0) / n;
    for (let i = 0; i < n; i++) {
      const a = x0 + i * w, b = a + w * 0.88;
      addQuad(m, [a, y, z1], [b, y, z1], [b, y, z0], [a, y, z0], i % 2 ? rgba(176, 118, 64) : rgba(148, 96, 52));
      addQuad(m, [b, y, z1], [a + w, y, z1], [a + w, y, z0], [b, y, z0], rgba(92, 60, 36));
    }
  };
  for (let i = 0; i < 4; i++) {
    const z0 = 2.55 + i * 0.48, y1 = Y - i * 0.2, y0 = y1 - 0.16;
    plankLike(-0.95, 0.95, z0, z0 + 0.4, y1);
    addQuad(m, [-0.95, y0, z0 + 0.4], [0.95, y0, z0 + 0.4], [0.95, y1, z0 + 0.4], [-0.95, y1, z0 + 0.4], rgba(120, 78, 44));
  }
});

part('FJ_rails', false, m => {
  const posts = [];
  for (const x of [-2.32, 2.32]) for (const z of [-1.9, -0.7, 0.5, 1.7]) {
    posts.push([x, z]);
    box(m, x - 0.045, Y, z - 0.045, x + 0.045, Y + 0.72, z + 0.045, rgba(92, 60, 36));
  }
  const rope = (a, b, y, col) => {
    const mid = [(a[0] + b[0]) / 2, y - 0.05, (a[2] + b[2]) / 2];
    const span = (p, q) => {
      const dx = q[0] - p[0], dz = q[2] - p[2], len = Math.hypot(dx, dz) || 1, px = -dz / len * 0.07, pz = dx / len * 0.07;
      addQuad(m, [p[0] - px, p[1], p[2] - pz], [q[0] - px, q[1], q[2] - pz], [q[0] + px, q[1], q[2] + pz], [p[0] + px, p[1], p[2] + pz], col);
    };
    span([a[0], y, a[2]], mid); span(mid, [b[0], y, b[2]]);
  };
  for (const x of [-2.32, 2.32]) {
    const zs = [-1.9, -0.7, 0.5, 1.7];
    for (let i = 0; i < zs.length - 1; i++) {
      rope([x, 0, zs[i]], [x, 0, zs[i + 1]], Y + 0.58, rgba(214, 186, 142));
      rope([x, 0, zs[i]], [x, 0, zs[i + 1]], Y + 0.32, rgba(176, 142, 102));
    }
  }
});

part('FJ_glow', true, m => {
  const lantern = (x, y, z) => {
    box(m, x - 0.07, y, z - 0.07, x + 0.07, y + 0.16, z + 0.07, rgba(255, 176, 78));
    addTri(m, [x, y + 0.28, z], [x - 0.09, y + 0.16, z - 0.09], [x + 0.09, y + 0.16, z - 0.09], rgba(255, 214, 120));
    addTri(m, [x, y + 0.28, z], [x + 0.09, y + 0.16, z - 0.09], [x + 0.09, y + 0.16, z + 0.09], rgba(255, 196, 90));
    addTri(m, [x, y + 0.28, z], [x + 0.09, y + 0.16, z + 0.09], [x - 0.09, y + 0.16, z + 0.09], rgba(255, 214, 120));
    addTri(m, [x, y + 0.28, z], [x - 0.09, y + 0.16, z + 0.09], [x - 0.09, y + 0.16, z - 0.09], rgba(255, 186, 70));
  };
  for (const x of [-2.32, 2.32]) for (const z of [-1.9, 0.5, 1.7]) lantern(x, Y + 0.62, z);
  const pane = (x, y, z, w, h, facing) => {
    const frame = rgba(236, 232, 220), glow = rgba(255, 186, 96);
    const zf = facing > 0 ? 0.02 : -0.02;
    addQuad(m, [x - w, y, z], [x + w, y, z], [x + w, y + h, z], [x - w, y + h, z], frame);
    addQuad(m, [x - w * 0.62, y + h * 0.16, z + zf], [x + w * 0.62, y + h * 0.16, z + zf], [x + w * 0.62, y + h * 0.82, z + zf], [x - w * 0.62, y + h * 0.82, z + zf], glow);
  };
  pane(-2.72, 1.18, -3.15, 0.16, 0.28, 1);
  pane(-3.05, 1.22, -3.55, 0.12, 0.2, 1);
  pane(2.72, 1.12, -2.85, 0.15, 0.26, 1);
});

const rock = [rgba(54, 62, 74), rgba(118, 104, 86), rgba(70, 84, 98), rgba(142, 132, 116)];
part('FJ_cliffs', false, m => {
  const wall = (sign, zStart, zStep, n, xNear, xFar, h0) => {
    for (let i = 0; i < n; i++) {
      const zA = zStart - i * zStep, zB = zA - zStep * 0.92;
      const jag = ((i * 5) % 3) * 0.55;
      const h = h0 + jag + (i % 4) * 0.7;
      const xa = sign * (xNear + (i % 2) * 0.35), xb = sign * (xFar + jag * 0.4);
      const mid = h * (0.42 + (i % 3) * 0.06);
      const c0 = rock[i % rock.length], c1 = rock[(i + 1) % rock.length];
      const snowLine = h > 8.2;
      addQuad(m, [xa, 0, zA], [xa, 0, zB], [xa, mid, zB], [xa, mid, zA], mix(c0, rgba(30, 36, 44), 0.25));
      addQuad(m, [xa, mid, zA], [xa, mid, zB], [xb, h * 0.92, zB], [xb, h, zA], c1, mix(c1, rgba(20, 24, 30), 0.2), c0, c1);
      addQuad(m, [xb, 0.2, zA], [xb, 0.2, zB], [xb, h * 0.55, zB], [xb, h * 0.55, zA], mix(c0, rgba(40, 46, 54), 0.35));
      if (snowLine) {
        addQuad(m, [xa * 0.92, h * 0.78, zA], [xa * 0.92, h * 0.78, zB], [xb, h, zB], [xb, h + 0.15, zA], rgba(214, 224, 232), rgba(186, 204, 216), rgba(236, 242, 246), rgba(236, 242, 246));
      }
      if (i % 3 === 0) peak(m, (xa + xb) * 0.5, h * 0.62, (zA + zB) * 0.5, 0.85, 0.6, h * 0.28, c1, h > 8.4);
    }
  };
  wall(-1, 2.8, 1.55, 12, 3.35, 7.8, 9.2);
  wall(1, 2.4, 1.5, 12, 3.45, 8.2, 8.6);
  wall(-1, -6.5, 2.3, 4, 8.4, 14.5, 10.4);
  wall(1, -6.0, 2.4, 4, 8.8, 15.2, 9.6);
});

part('FJ_falls', true, m => {
  const fall = (x, z, yTop, width) => {
    const foam = rgba(232, 244, 250, 200), stream = rgba(186, 216, 228, 150), mist = rgba(200, 224, 232, 60);
    addQuad(m, [x - width, 0.4, z + 0.08], [x + width, 0.4, z + 0.12], [x + width * 0.65, yTop, z - 0.05], [x - width * 0.65, yTop, z], foam, stream, rgba(244, 250, 252, 80), foam);
    addQuad(m, [x - width * 2.2, 0.32, z + 0.25], [x + width * 2.2, 0.32, z + 0.35], [x + width, 0.9, z + 0.1], [x - width, 0.9, z + 0.05], mist, mist, rgba(210, 230, 236, 20), rgba(210, 230, 236, 10));
  };
  fall(-3.22, -5.6, 6.4, 0.11);
  fall(3.32, -3.8, 5.8, 0.1);
});

part('FJ_trees', false, m => {
  const pine = (x, y, z, h) => {
    box(m, x - 0.05, y, z - 0.05, x + 0.05, y + h * 0.38, z + 0.05, rgba(74, 52, 36));
    const greens = [rgba(28, 62, 40), rgba(42, 92, 54), rgba(64, 118, 70)];
    for (let i = 0; i < 3; i++) peak(m, x, y + h * (0.28 + i * 0.22), z, h * (0.28 - i * 0.06), h * (0.24 - i * 0.05), h * 0.34, greens[i], false);
  };
  const spots = [[-2.85, 0.32, -3.35, 1.25], [-2.72, 0.3, -5.4, 1.65], [-2.95, 0.28, -7.6, 1.45], [-3.05, 0.3, -10, 1.9],
    [2.82, 0.32, -3.1, 1.3], [2.9, 0.3, -5.8, 1.7], [2.78, 0.28, -8.2, 1.5], [3.02, 0.3, -10.6, 2.0],
    [-2.7, 0.3, 2.85, 1.05], [2.68, 0.3, 2.75, 1.0], [-3.05, 0.26, -1.4, 1.15], [3.1, 0.26, -0.6, 1.2]];
  for (const [x, y, z, h] of spots) pine(x, y, z, h);
});

part('FJ_shore', false, m => {
  const pad = (x0, z0, x1, z1, h, c) => {
    box(m, x0, 0, z0, x1, h, z1, c);
  };
  pad(-3.45, -4.15, -2.3, -2.7, 0.58, rgba(58, 64, 72));
  pad(2.35, -3.85, 3.5, -2.55, 0.52, rgba(64, 68, 76));
  pad(-3.3, 2.55, -2.35, 3.35, 0.36, rgba(52, 58, 66));
  pad(2.4, 2.45, 3.35, 3.25, 0.34, rgba(54, 60, 68));
});

part('FJ_cabins', false, m => {
  const house = (x, z, s, yaw) => {
    const c = Math.cos(yaw), sN = Math.sin(yaw);
    const p = (dx, dy, dz) => [x + dx * c - dz * sN, dy, z + dx * sN + dz * c];
    const wall = rgba(176, 52, 46), dark = rgba(120, 36, 36), turf = rgba(74, 112, 62), turfD = rgba(48, 82, 44);
    const y0 = 0.72, y1 = y0 + s * 1.15;
    addQuad(m, p(-s, y0, s * 0.72), p(s, y0, s * 0.72), p(s, y1, s * 0.72), p(-s, y1, s * 0.72), wall);
    addQuad(m, p(s, y0, -s * 0.72), p(-s, y0, -s * 0.72), p(-s, y1, -s * 0.72), p(s, y1, -s * 0.72), dark);
    addQuad(m, p(s, y0, s * 0.72), p(s, y0, -s * 0.72), p(s, y1, -s * 0.72), p(s, y1, s * 0.72), mix(wall, dark, 0.4));
    addQuad(m, p(-s, y0, -s * 0.72), p(-s, y0, s * 0.72), p(-s, y1, s * 0.72), p(-s, y1, -s * 0.72), mix(dark, wall, 0.3));
    addQuad(m, p(-s * 1.12, y1, s * 0.86), p(s * 1.12, y1, s * 0.86), p(s * 0.2, y1 + s * 0.55, 0.05), p(-s * 0.2, y1 + s * 0.55, 0.05), turf, turfD, turf, turf);
    addQuad(m, p(s * 1.12, y1, -s * 0.86), p(-s * 1.12, y1, -s * 0.86), p(-s * 0.2, y1 + s * 0.55, -0.05), p(s * 0.2, y1 + s * 0.55, -0.05), turfD, turf, turfD, turf);
    addQuad(m, p(-s * 1.12, y1, -s * 0.86), p(-s * 1.12, y1, s * 0.86), p(-s * 0.2, y1 + s * 0.55, 0.05), p(-s * 0.2, y1 + s * 0.55, -0.05), mix(turf, rgba(30, 50, 28), 0.2));
    addQuad(m, p(s * 1.12, y1, s * 0.86), p(s * 1.12, y1, -s * 0.86), p(s * 0.2, y1 + s * 0.55, -0.05), p(s * 0.2, y1 + s * 0.55, 0.05), mix(turfD, rgba(90, 130, 74), 0.25));
  };
  house(-2.7, -3.5, 0.46, 0.5);
  house(2.72, -3.25, 0.42, -0.4);
});

part('FJ_boats', false, m => {
  const boat = (x, z, yaw, scale) => {
    const c = Math.cos(yaw), sN = Math.sin(yaw);
    const p = (dx, dy, dz) => [x + dx * c - dz * sN, dy, z + dx * sN + dz * c];
    const hull = rgba(176, 98, 54), inner = rgba(112, 68, 40), trim = rgba(236, 214, 170);
    const y = 0.34;
    addQuad(m, p(-0.22 * scale, y, -0.7 * scale), p(0.22 * scale, y, -0.7 * scale), p(0.34 * scale, y + 0.16 * scale, 0.55 * scale), p(-0.34 * scale, y + 0.16 * scale, 0.55 * scale), hull);
    addQuad(m, p(-0.18 * scale, y + 0.05 * scale, -0.4 * scale), p(0.18 * scale, y + 0.05 * scale, -0.4 * scale), p(0.22 * scale, y + 0.12 * scale, 0.35 * scale), p(-0.22 * scale, y + 0.12 * scale, 0.35 * scale), inner);
    addQuad(m, p(-0.02 * scale, y + 0.12 * scale, -0.1 * scale), p(0.02 * scale, y + 0.12 * scale, -0.1 * scale), p(0.02 * scale, y + 0.7 * scale, -0.1 * scale), p(-0.02 * scale, y + 0.7 * scale, -0.1 * scale), trim);
  };
  boat(-1.55, -4.7, 0.4, 1.35);
  boat(1.7, -5.5, -0.6, 1.15);
});

part('FJ_water', true, m => {
  const deep = rgba(8, 28, 64), mid = rgba(14, 58, 102), far = rgba(36, 78, 118);
  const green = rgba(36, 120, 104), cyan = rgba(40, 130, 150), violet = rgba(70, 78, 140);
  const cols = 10, rows = 16, xL = -16, xR = 16, zN = 9, zF = -42;
  const yAt = (i, k) => 0.26 + Math.sin(i * 1.7 + k * 0.8) * 0.03 + Math.cos(k * 1.3) * 0.018;
  const colorAt = (i, k) => {
    const u = i / cols, v = k / rows;
    let c = mix(mix(deep, mid, Math.min(1, v * 1.4)), far, Math.max(0, v - 0.45) / 0.55);
    const across = mix(green, mix(cyan, violet, u), 0.35 + 0.65 * Math.min(1, v * 1.3));
    c = mix(c, across, v > 0.15 && v < 0.7 ? 0.62 : 0.3);
    c = mix(c, rgba(220, 240, 230), 0.18 * Math.max(0, Math.sin(u * 9 + v * 14)));
    return c;
  };
  for (let k = 0; k < rows; k++) for (let i = 0; i < cols; i++) {
    const xa = xL + (xR - xL) * i / cols, xb = xL + (xR - xL) * (i + 1) / cols;
    const za = zN + (zF - zN) * k / rows, zb = zN + (zF - zN) * (k + 1) / rows;
    addQuad(m,
      [xa, yAt(i, k), za], [xb, yAt(i + 1, k), za], [xb, yAt(i + 1, k + 1), zb], [xa, yAt(i, k + 1), zb],
      colorAt(i, k), colorAt(i + 1, k), colorAt(i + 1, k + 1), colorAt(i, k + 1));
  }
});

part('FJ_mountains', false, m => {
  const ridge = (z, tint, snow, peaks) => {
    for (const [x, h, w] of peaks) {
      const shade = mix(tint, rgba(36, 44, 56), 0.28);
      const cap = mix(rgba(236, 242, 248), tint, 0.08);
      addTri(m, [x - w, 0.2, z + 0.5], [x, 0.2 + h * 0.62, z], [x + w * 0.15, 0.2 + h, z - 0.25], shade, tint, cap);
      addTri(m, [x + w, 0.2, z + 0.7], [x + w * 0.15, 0.2 + h, z - 0.25], [x, 0.2 + h * 0.62, z], mix(shade, rgba(20, 26, 34), 0.2), cap, tint);
      if (snow) addTri(m, [x - w * 0.22, 0.2 + h * 0.72, z], [x + w * 0.28, 0.2 + h * 0.7, z + 0.15], [x + w * 0.12, 0.2 + h, z - 0.2], rgba(220, 230, 238), rgba(236, 242, 248), rgba(248, 250, 252));
    }
  };
  ridge(-16.5, rgba(62, 74, 90), true, [[-8, 3.6, 2.6], [-3.2, 4.4, 2.4], [2.2, 3.8, 2.5], [7.4, 3.4, 2.7]]);
  ridge(-24, rgba(98, 116, 138), true, [[-11, 3.2, 3.1], [-5.2, 4.0, 2.8], [0.6, 3.6, 2.9], [6.4, 3.8, 3.0], [12, 2.8, 2.6]]);
  ridge(-34, rgba(156, 174, 194), false, [[-12, 2.4, 3.4], [-4, 2.8, 3.2], [4.5, 2.6, 3.3], [12, 2.2, 3.0]]);
});

part('FJ_fog', true, m => {
  const sheet = (z, y0, y1, alpha, col) => {
    addQuad(m, [-20, y0, z], [20, y0, z + 1.2], [20, y1, z + 0.4], [-20, y1, z], rgba(col[0], col[1], col[2], alpha));
  };
  sheet(-26, 0.8, 4.2, 46, [150, 176, 196]);
  sheet(-33, 1.0, 4.6, 72, [176, 196, 210]);
  sheet(-41, 1.2, 3.8, 96, [200, 214, 224]);
});

part('FJ_sky', true, m => {
  const horizon = rgba(46, 78, 128), dusk = rgba(58, 42, 108), zenith = rgba(8, 10, 28);
  addQuad(m, [-28, 3.2, -26], [28, 3.2, -26], [24, 7.2, -20], [-24, 7.2, -20], horizon, mix(horizon, rgba(70, 110, 150), 0.35), mix(horizon, dusk, 0.4), dusk);
  addQuad(m, [-26, 7.2, -22], [26, 7.2, -22], [22, 11.5, -16], [-22, 11.5, -16], mix(horizon, dusk, 0.35), dusk, mix(dusk, zenith, 0.35), mix(dusk, rgba(36, 28, 78), 0.2));
  addQuad(m, [-24, 11.2, -16], [24, 11.2, -16], [12, 22, -40], [-12, 22, -40], mix(dusk, zenith, 0.25), mix(dusk, zenith, 0.45), zenith, zenith);
});

part('FJ_stars', true, m => {
  const star = (x, y, z, s, warm) => {
    const c = warm ? rgba(255, 232, 196) : rgba(226, 236, 255);
    addQuad(m, [x - s, y, z], [x + s, y, z], [x + s * 0.2, y + s * 1.6, z], [x - s * 0.2, y + s * 1.6, z], c);
    addQuad(m, [x, y + s * 0.2, z], [x, y + s * 1.2, z], [x + s * 1.5, y + s * 0.7, z], [x - s * 1.5, y + s * 0.7, z], c);
  };
  const stars = [[-4.2, 16.5, -12, 0.09, 1], [2.6, 18.2, -14, 0.06, 0], [-0.4, 20, -16, 0.07, 0], [5.5, 15.8, -11, 0.06, 1],
    [-7, 15.2, -13, 0.05, 0], [1.2, 22, -20, 0.05, 0], [-3.2, 17.4, -18, 0.06, 1], [4.2, 19.5, -17, 0.05, 0],
    [0.2, 14.8, -11, 0.045, 0], [-2.2, 19.2, -15, 0.05, 1], [7.2, 17, -13, 0.045, 0], [-6.2, 18.6, -16, 0.05, 0]];
  for (const s of stars) star(s[0], s[1], s[2], s[3], s[4]);
});

part('FJ_aurora', true, m => {
  // Curtains face the camera (constant depth) so they read as ribbons, not edge-on streaks.
  const curtain = (y0, y1, z, phase, x0, x1, stops, alpha) => {
    const n = 16;
    const at = (t) => t < 0.5 ? mix(stops[0], stops[1], t * 2) : mix(stops[1], stops[2], (t - 0.5) * 2);
    for (let i = 0; i < n; i++) {
      const t0 = i / n, t1 = (i + 1) / n;
      const xa = x0 + (x1 - x0) * t0, xb = x0 + (x1 - x0) * t1;
      const bow = (t) => Math.sin(t * Math.PI) * 0.7 + Math.sin(t * Math.PI * 2 + phase) * 0.35;
      const ya = y0 + bow(t0), yb = y0 + bow(t1);
      const ha = y1 + bow(t0) * 0.45, hb = y1 + bow(t1) * 0.45;
      const spanA = ha - ya, spanB = hb - yb;
      const loA = ya + spanA * 0.2, loB = yb + spanB * 0.2;
      const hiA = ya + spanA * 0.8, hiB = yb + spanB * 0.8;
      const edge = Math.min(1, Math.min(t0, 1 - t0) / 0.12);
      const c0 = at(t0), c1 = at(t1);
      const fade = (c, a) => rgba(c[0], c[1], c[2], a * edge);
      addQuad(m, [xa, ya, z], [xb, yb, z], [xb, loB, z], [xa, loA, z], fade(c0, 0), fade(c1, 0), fade(c1, alpha), fade(c0, alpha));
      addQuad(m, [xa, loA, z], [xb, loB, z], [xb, hiB, z], [xa, hiA, z], fade(c0, alpha), fade(c1, alpha), fade(c1, alpha), fade(c0, alpha));
      addQuad(m, [xa, hiA, z], [xb, hiB, z], [xb, hb, z], [xa, ha, z], fade(c0, alpha), fade(c1, alpha), fade(c1, 0), fade(c0, 0));
    }
  };
  const green = rgba(132, 240, 154), cyan = rgba(72, 224, 214), purple = rgba(186, 140, 248);
  curtain(5.0, 9.4, -9, 0.2, -6.2, 6.2, [green, cyan, purple], 220);
  curtain(9.2, 13.0, -16, 1.8, -7, 7, [green, cyan, purple], 130);
});

function pack() {
  const blobs = [], views = [], accessors = [], meshes = [], nodes = [{ name: 'env_fjord', children: [] }];
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
  const auroraNode = nodes.findIndex(n => n.name === 'FJ_aurora');
  align(4);
  const times = Float32Array.from([0, 3.5, 7]);
  const values = Float32Array.from([0, 0, 0, 0.28, 0.06, 0, 0, 0, 0]);
  const tAcc = pushArr(times, 'SCALAR', 5126);
  const vAcc = pushArr(values, 'VEC3', 5126);
  accessors[tAcc].min = [0]; accessors[tAcc].max = [7];
  const materials = [
    { name: 'M_FJ_vertex', doubleSided: true, pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], metallicFactor: 0, roughnessFactor: 1 } },
    { name: 'M_FJ_unlit', doubleSided: true, alphaMode: 'BLEND', extensions: { KHR_materials_unlit: {} }, pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], metallicFactor: 0, roughnessFactor: 1 } },
  ];
  const json = {
    asset: { version: '2.0', generator: 'qf-env-fjord', extras: { license: 'original-procedural' } },
    extensionsUsed: ['KHR_materials_unlit'],
    scene: 0, scenes: [{ name: 'env_fjord', nodes: [0] }], nodes, meshes, materials,
    accessors, bufferViews: views, buffers: [{ byteLength: offset }],
    animations: [{ name: 'aurora_sway', channels: [{ sampler: 0, target: { node: auroraNode, path: 'translation' } }], samplers: [{ input: tAcc, output: vAcc, interpolation: 'LINEAR' }] }],
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
console.log(JSON.stringify({ bytes: body.length, tris, counts, platformY: Y, budget: 943718 }, null, 2));
if (body.length > 943718) throw Error('over subpackage budget ' + body.length);
if (tris > 2500) throw Error('tris ' + tris);
