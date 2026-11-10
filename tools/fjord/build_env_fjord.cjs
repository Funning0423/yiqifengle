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

const woodA = rgba(176, 118, 64), woodB = rgba(148, 96, 52), seam = rgba(92, 60, 36), grid = rgba(244, 240, 228);
const cellA = rgba(214, 166, 108), cellB = rgba(202, 154, 100), grain = rgba(168, 122, 74);
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
    const colr = (row + col) % 2 ? cellA : cellB;
    const x0 = edges[col] + halfL, x1 = edges[col + 1] - halfL, z0 = edges[row] + halfL, z1 = edges[row + 1] - halfL;
    const warm = mix(colr, rgba(232, 186, 120), 0.22);
    addQuad(m, [x0, Y, z1], [x1, Y, z1], [x1, Y, z0], [x0, Y, z0], warm, colr, mix(colr, rgba(160, 116, 72), 0.12), colr);
    const gx = x0 + (x1 - x0) * (0.35 + ((row + col) % 3) * 0.12);
    const gy = Y + 0.00005;
    addQuad(m, [gx, gy, z1], [gx + 0.028, gy, z1], [gx + 0.028, gy, z0], [gx, gy, z0], grain, mix(grain, colr, 0.35), grain, mix(grain, warm, 0.25));
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
  pane(-2.72, 1.22, -5.72, 0.16, 0.28, 1);
  pane(-2.95, 1.28, -6.15, 0.11, 0.2, 1);
  pane(2.78, 1.16, -6.05, 0.15, 0.26, 1);
  pane(2.55, 1.2, -6.4, 0.1, 0.18, 1);
});

part('FJ_cliffs', false, m => {
  // Solid masses. The face the camera sees slopes up and outward, so it reads as rock, not an edge-on sheet.
  const bands = [
    [0, 0.24, rgba(52, 58, 68)],
    [0.24, 0.46, rgba(112, 120, 132)],
    [0.46, 0.64, rgba(206, 170, 122)],
    [0.64, 0.84, rgba(136, 146, 158)],
  ];
  const mass = (sign, z0, z1, xFoot, xTop, h, fade) => {
    const s = sign, zm = (z0 + z1) / 2, jut = 0.35;
    const foot = (z) => s * (xFoot + (z < zm ? 0 : 0.15));
    const ridge = s * (xFoot - jut);
    const crown = s * xTop;
    const yRock = h * 0.84;
    const face = (xA, zA, xB, zB, xAt, xBt) => {
      for (const [a, b, col] of bands) {
        const c = mix(col, rgba(176, 188, 204), fade);
        const y0 = h * a, y1 = h * b;
        const x0a = xA + (xAt - xA) * (a / 0.84), x0b = xB + (xBt - xB) * (a / 0.84);
        const x1a = xA + (xAt - xA) * (Math.min(b, 0.84) / 0.84), x1b = xB + (xBt - xB) * (Math.min(b, 0.84) / 0.84);
        addQuad(m, [x0a, y0, zA], [x0b, y0, zB], [x1b, y1, zB], [x1a, y1, zA], c);
      }
    };
    face(foot(z0), z0, ridge, zm, crown, s * (xTop - 0.4));
    face(ridge, zm, foot(z1), z1, s * (xTop - 0.4), crown);
    const snow = rgba(232, 238, 244), snowB = rgba(214, 224, 234);
    addQuad(m, [crown, h, z0], [s * (xTop - 0.4), h, zm], [s * (xTop + 1.6), h * 0.96, zm], [s * (xTop + 1.6), h * 0.96, z0], snow, snow, snowB, snow);
    addQuad(m, [s * (xTop - 0.4), h, zm], [crown, h, z1], [s * (xTop + 1.6), h * 0.96, z1], [s * (xTop + 1.6), h * 0.96, zm], snow, snowB, snowB, snow);
    addQuad(m, [foot(z0), 0, z0], [s * (xTop + 1.6), 0, z0], [s * (xTop + 1.6), h * 0.96, z0], [crown, h, z0], mix(rgba(58, 64, 72), rgba(180, 190, 204), fade));
    addQuad(m, [s * (xTop + 1.6), 0, z1], [foot(z1), 0, z1], [crown, h, z1], [s * (xTop + 1.6), h * 0.96, z1], mix(rgba(64, 70, 78), rgba(180, 190, 204), fade));
  };
  mass(-1, 2.0, -2.6, 3.25, 4.5, 7.2, 0);
  mass(-1, -2.0, -7.6, 3.4, 4.8, 9.4, 0.08);
  mass(-1, -6.8, -13.2, 3.9, 5.6, 7.6, 0.28);
  mass(1, 1.6, -2.8, 3.35, 4.7, 6.6, 0);
  mass(1, -2.2, -8.0, 3.5, 5.0, 8.8, 0.1);
  mass(1, -7.2, -13.6, 4.1, 5.8, 7.2, 0.32);
});

part('FJ_falls', true, m => {
  const fall = (x, z, y0, y1, w) => {
    const foam = rgba(236, 246, 252, 210), stream = rgba(198, 224, 234, 160), fade = rgba(220, 236, 244, 0);
    addQuad(m, [x - w, y0, z], [x + w, y0, z], [x + w * 0.75, y1, z], [x - w * 0.75, y1, z], foam, stream, fade, fade);
    addQuad(m, [x - w * 3.2, 0.33, z + 0.15], [x + w * 3.2, 0.33, z + 0.2], [x + w * 1.4, 0.36, z - 0.05], [x - w * 1.4, 0.36, z], rgba(230, 242, 246, 80), rgba(230, 242, 246, 40), rgba(230, 242, 246, 0), rgba(230, 242, 246, 0));
  };
  fall(-3.15, -4.6, 0.4, 6.2, 0.14);
  fall(3.28, -5.2, 0.4, 5.6, 0.12);
  const foamLine = (xIn, xOut, z0, z1) => {
    const edge = rgba(232, 242, 246, 190), fade = rgba(210, 228, 234, 0);
    addQuad(m, [xIn, 0.33, z0], [xOut, 0.33, z0], [xOut, 0.35, z1], [xIn, 0.35, z1], rgba(240, 248, 250, 230), fade, fade, rgba(236, 246, 248, 160));
  };
  foamLine(-2.5, -3.2, 0.6, -8.4);
  foamLine(2.55, 3.25, 0.4, -8.6);
  foamLine(-7, 7, -12.2, -13.4);
  const wake = (cx, cz, radius, a0, a1, w) => {
    const n = 8;
    for (let i = 0; i < n; i++) {
      const t0 = i / n, t1 = (i + 1) / n;
      const ang = (t) => a0 + (a1 - a0) * t;
      const at = (t, rad) => [cx + Math.cos(ang(t)) * rad, 0.315, cz + Math.sin(ang(t)) * rad];
      const fade = Math.sin(((t0 + t1) / 2) * Math.PI);
      const ink = rgba(214, 234, 232, 150 * fade), gone = rgba(214, 234, 232, 0);
      addQuad(m, at(t0, radius), at(t1, radius), at(t1, radius + w), at(t0, radius + w), ink, ink, gone, gone);
    }
  };
  wake(0, -0.6, 2.85, Math.PI * 0.18, Math.PI * 0.82, 0.16);
  wake(-1.15, -4.7, 0.7, 0.1, 1.5, 0.12);
  wake(1.4, -5.5, 0.65, Math.PI + 0.05, Math.PI + 1.4, 0.11);
  const streak = (x0, z0, x1, z1) => {
    const lit = rgba(214, 236, 232, 190), soft = rgba(214, 236, 232, 0);
    const dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz) || 1, px = -dz / len * 0.07, pz = dx / len * 0.07;
    addQuad(m, [x0 - px, 0.33, z0 - pz], [x1 - px, 0.33, z1 - pz], [x1 + px, 0.34, z1 + pz], [x0 + px, 0.34, z0 + pz], soft, lit, lit, soft);
  };
  streak(-2.2, -2.7, 2.2, -2.85);
  streak(-1.5, -3.5, 1.4, -3.7);
  streak(-2.72, -1.8, -2.62, 1.5);
  streak(2.62, -2.0, 2.74, 1.3);
  streak(-1.8, -5.2, -0.5, -4.85);
  streak(0.7, -6.0, 2.1, -5.55);
});

part('FJ_trees', false, m => {
  const pine = (x, y, z, h) => {
    box(m, x - 0.05, y, z - 0.05, x + 0.05, y + h * 0.38, z + 0.05, rgba(74, 52, 36));
    const greens = [rgba(28, 62, 40), rgba(42, 92, 54), rgba(64, 118, 70)];
    for (let i = 0; i < 3; i++) peak(m, x, y + h * (0.28 + i * 0.22), z, h * (0.28 - i * 0.06), h * (0.24 - i * 0.05), h * 0.34, greens[i], false);
  };
  const spots = [[-2.45, 0.32, -4.2, 1.35], [-2.55, 0.3, -7.4, 1.7], [-2.7, 0.28, -10.2, 1.9],
    [2.5, 0.32, -4.6, 1.4], [2.6, 0.3, -7.8, 1.75], [2.7, 0.28, -10.6, 1.85],
    [-2.55, 0.3, 2.7, 1.05], [2.6, 0.3, 2.55, 1.0]];
  for (const [x, y, z, h] of spots) pine(x, y, z, h);
});

part('FJ_shore', false, m => {
  const pad = (x0, z0, x1, z1, h, c) => {
    box(m, x0, 0, z0, x1, h, z1, c);
  };
  pad(-3.35, -6.85, -2.35, -5.35, 0.7, rgba(78, 84, 78));
  pad(2.4, -7.15, 3.4, -5.55, 0.66, rgba(82, 86, 80));
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
  house(-2.72, -6.1, 0.4, 0.15);
  house(2.78, -6.45, 0.38, -0.2);
});

part('FJ_boats', false, m => {
  const boat = (x, z, yaw, scale) => {
    const c = Math.cos(yaw), sN = Math.sin(yaw);
    const p = (dx, dy, dz) => [x + dx * c - dz * sN, dy, z + dx * sN + dz * c];
    const hull = rgba(168, 96, 54), hullD = rgba(112, 66, 40), deck = rgba(198, 156, 112), oar = rgba(92, 62, 38);
    const y = 0.32, s = scale;
    addTri(m, p(0, y, 0.82 * s), p(-0.28 * s, y, -0.05 * s), p(0.28 * s, y, -0.05 * s), hullD);
    addQuad(m, p(-0.28 * s, y, -0.05 * s), p(-0.3 * s, y, -0.5 * s), p(0.3 * s, y, -0.5 * s), p(0.28 * s, y, -0.05 * s), hullD);
    addQuad(m, p(-0.28 * s, y, -0.42 * s), p(0, y, 0.82 * s), p(0, y + 0.16 * s, 0.62 * s), p(-0.32 * s, y + 0.15 * s, -0.48 * s), hull);
    addQuad(m, p(0.28 * s, y, -0.42 * s), p(0.32 * s, y + 0.15 * s, -0.48 * s), p(0, y + 0.16 * s, 0.62 * s), p(0, y, 0.82 * s), mix(hull, hullD, 0.45));
    addQuad(m, p(-0.3 * s, y, -0.5 * s), p(-0.32 * s, y + 0.15 * s, -0.5 * s), p(0.32 * s, y + 0.15 * s, -0.5 * s), p(0.3 * s, y, -0.5 * s), hullD);
    addTri(m, p(0, y + 0.1 * s, 0.48 * s), p(-0.2 * s, y + 0.1 * s, -0.32 * s), p(0.2 * s, y + 0.1 * s, -0.32 * s), deck);
    addQuad(m, p(-0.18 * s, y + 0.16 * s, 0.05 * s), p(-0.78 * s, y + 0.08 * s, -0.22 * s), p(-0.74 * s, y + 0.12 * s, -0.08 * s), p(-0.16 * s, y + 0.2 * s, 0.14 * s), oar);
    addQuad(m, p(0.18 * s, y + 0.16 * s, -0.02 * s), p(0.16 * s, y + 0.2 * s, 0.08 * s), p(0.76 * s, y + 0.12 * s, -0.28 * s), p(0.8 * s, y + 0.08 * s, -0.4 * s), oar);
  };
  boat(-1.15, -5.35, 0.7, 1.15);
  boat(1.4, -6.15, -0.85, 1.0);
});

part('FJ_water', true, m => {
  const deep = rgba(8, 28, 64), mid = rgba(14, 58, 102), far = rgba(36, 78, 118);
  const green = rgba(36, 120, 104), cyan = rgba(40, 130, 150), violet = rgba(70, 78, 140);
  const cols = 10, rows = 16, xL = -16, xR = 16, zN = 9, zF = -42;
  const yAt = (i, k) => 0.26 + Math.sin(i * 1.7 + k * 0.8) * 0.03 + Math.cos(k * 1.3) * 0.018;
  const colorAt = (i, k) => {
    const u = i / cols, v = k / rows;
    let c = mix(rgba(10, 40, 78), rgba(28, 74, 118), Math.min(1, v * 1.5));
    c = mix(c, rgba(46, 98, 142), Math.max(0, (v - 0.55) / 0.45));
    const aur = u < 0.5 ? mix(green, cyan, u * 2) : mix(cyan, violet, (u - 0.5) * 2);
    const band = Math.exp(-((v - 0.32) * (v - 0.32)) / 0.02);
    c = mix(c, aur, 0.22 * band);
    const ripple = Math.pow(Math.max(0, Math.sin(u * 16 + v * 28)), 2);
    c = mix(c, rgba(150, 190, 198), (v < 0.45 ? 0.12 : 0.04) * ripple);
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
  // Full bodies standing on the waterline. Rock below, snow above, a few trees at the foot.
  const peak = (x, z, h, w, rock, dark, snow, trees) => {
    const y0 = 0.28, yS = y0 + h * 0.5, tip = [x + w * 0.06, y0 + h, z];
    const L = [x - w, y0, z + 0.3], R = [x + w * 0.92, y0, z + 0.4], F = [x + w * 0.04, y0, z + 0.55];
    const sL = [x - w * 0.4, yS, z + 0.14], sR = [x + w * 0.38, yS, z + 0.18], sF = [x + w * 0.02, yS, z + 0.26];
    addTri(m, L, sL, F, dark, dark, rock);
    addTri(m, sL, sF, F, dark, rock, rock);
    addTri(m, F, sF, R, rock, rock, mix(rock, rgba(230, 236, 240), 0.1));
    addTri(m, sF, sR, R, rock, mix(rock, rgba(230, 236, 240), 0.14), mix(rock, rgba(230, 236, 240), 0.08));
    addTri(m, sL, tip, sF, snow, snow, mix(snow, rock, 0.12));
    addTri(m, sF, tip, sR, mix(snow, rgba(198, 208, 218), 0.22), snow, snow);
    if (!trees) return;
    const g = rgba(32, 68, 44), g2 = rgba(24, 56, 38);
    addTri(m, [x - w * 0.5, y0, z + 0.36], [x - w * 0.18, y0, z + 0.4], [x - w * 0.34, y0 + h * 0.14, z + 0.32], g);
    addTri(m, [x + w * 0.08, y0, z + 0.46], [x + w * 0.36, y0, z + 0.42], [x + w * 0.2, y0 + h * 0.12, z + 0.38], g2);
  };
  const nearR = rgba(72, 80, 92), nearD = rgba(42, 48, 58), snow = rgba(242, 246, 250);
  const midR = rgba(108, 126, 148), midD = rgba(74, 92, 114), pale = rgba(226, 232, 238);
  const farR = rgba(150, 168, 188), farD = rgba(118, 138, 160), farS = rgba(198, 210, 222);
  peak(-5.4, -11.8, 3.6, 2.05, nearR, nearD, snow, true);
  peak(0.4, -12.3, 2.35, 1.4, nearR, nearD, snow, true);
  peak(5.0, -11.9, 3.35, 1.9, nearR, nearD, snow, true);
  peak(-6.6, -17.4, 2.9, 2.2, midR, midD, pale, true);
  peak(-1.2, -18.0, 2.4, 1.7, midR, midD, pale, false);
  peak(3.6, -17.5, 2.7, 2.05, midR, midD, pale, true);
  peak(-6.2, -22.2, 4.8, 2.3, farR, farD, rgba(232, 238, 244), false);
  peak(-0.6, -22.8, 5.3, 2.05, farR, farD, rgba(232, 238, 244), false);
  peak(5.0, -22.4, 4.5, 2.2, farR, farD, rgba(232, 238, 244), false);
});

part('FJ_fog', true, m => {
  const sheet = (z, y0, y1, alpha, col) => {
    addQuad(m, [-20, y0, z], [20, y0, z + 1.2], [20, y1, z + 0.4], [-20, y1, z], rgba(col[0], col[1], col[2], alpha));
  };
  sheet(-15, 0.3, 1.15, 32, [168, 186, 198]);
});

part('FJ_sky', true, m => {
  const horizon = rgba(36, 64, 112), dusk = rgba(42, 36, 92), zenith = rgba(8, 10, 26);
  addQuad(m, [-18, 0.15, -36], [18, 0.15, -36], [16, 22, -36.6], [-16, 22, -36.6], rgba(52, 86, 136), rgba(70, 64, 128), rgba(22, 16, 48), rgba(8, 10, 26));
});

part('FJ_stars', true, m => {
  const star = (x, y, z, s, warm) => {
    const c = warm ? rgba(255, 236, 210) : rgba(230, 238, 255);
    addQuad(m, [x - s, y - s, z], [x + s, y - s, z], [x + s, y + s, z], [x - s, y + s, z], c);
  };
  const stars = [[-2.4, 16.2, -18, 0.035, 0], [1.1, 17.4, -19, 0.028, 1], [-0.4, 19.2, -22, 0.032, 0],
    [3.2, 15.6, -17, 0.03, 0], [-4.1, 14.8, -16, 0.026, 1], [0.7, 21, -24, 0.024, 0],
    [-1.8, 18.4, -21, 0.03, 0], [2.4, 19.6, -23, 0.022, 1], [-3.4, 17.8, -20, 0.028, 0],
    [4.6, 16.4, -18, 0.024, 0], [-0.8, 15.2, -16, 0.02, 1], [1.8, 14.6, -15, 0.022, 0],
    [-5.2, 16.8, -19, 0.02, 0], [0.2, 20.4, -25, 0.02, 0], [3.6, 18.2, -21, 0.026, 1]];
  for (const s of stars) star(s[0], s[1], s[2], s[3], s[4]);
});

part('FJ_aurora', true, m => {
  // One sheet. Alpha lives only on the vertices, so neighbouring strips share a smooth fade.
  const n = 40, yBase = 8.4, height = 3.6, z = -11, amp = 0.32, x0 = -5.6, x1 = 5.6, alpha = 150;
  const green = rgba(124, 232, 156), cyan = rgba(70, 216, 208), purple = rgba(170, 142, 236);
  const at = (t) => t < 0.5 ? mix(green, cyan, t * 2) : mix(cyan, purple, (t - 0.5) * 2);
  const edge = (t) => Math.min(1, Math.min(t, 1 - t) / 0.24);
  for (let i = 0; i < n; i++) {
    const t0 = i / n, t1 = (i + 1) / n;
    const wave = (t) => Math.sin(t * Math.PI * 1.6 + 0.4) * amp;
    const xa = x0 + (x1 - x0) * t0, xb = x0 + (x1 - x0) * t1;
    const y0 = yBase + wave(t0), y1 = yBase + wave(t1);
    const c0 = at(t0), c1 = at(t1);
    addQuad(m,
      [xa, y0, z], [xb, y1, z], [xb, y1 + height, z], [xa, y0 + height, z],
      rgba(c0[0], c0[1], c0[2], alpha * edge(t0)), rgba(c1[0], c1[1], c1[2], alpha * edge(t1)),
      rgba(c1[0], c1[1], c1[2], 0), rgba(c0[0], c0[1], c0[2], 0));
  }
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
if (tris > 3000) throw Error('tris ' + tris);
