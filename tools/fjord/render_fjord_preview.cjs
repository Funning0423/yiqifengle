'use strict';
// Offline preview from FjordSceneData.fjordBoardLook. Vertex colours, unlit stays unshaded.
const fs = require('node:fs'), path = require('node:path'), zlib = require('node:zlib');
const { createHarness } = require('../board-ui/harness.cjs');
const { loadGlb } = require('./glb_read.cjs');
const D = createHarness().load('region/FjordSceneData');
const GLB = path.resolve(__dirname, '../../creator-build-project/assets/bundles/region_fjord/models/env_fjord.glb');
const OLD = process.env.OLD || '/home/ubuntu/.cursor/projects/agent-repos-yiqifengle/assets/fjord-v1-77aa19f1.png';
const OUT = process.env.OUT || '/opt/cursor/artifacts';
function crc32(buf) {
  let c, n = -1;
  if (!crc32.t) { crc32.t = []; for (let i = 0; i < 256; i++) { c = i; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc32.t[i] = c >>> 0; } }
  for (let i = 0; i < buf.length; i++) n = crc32.t[(n ^ buf[i]) & 255] ^ (n >>> 8);
  return (n ^ -1) >>> 0;
}
function png(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { const row = y * (w * 4 + 1); raw[row] = 0; rgba.copy(raw, row + 1, y * w * 4, (y + 1) * w * 4); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  const chunk = (type, data) => { const t = Buffer.from(type), len = Buffer.alloc(4), crc = Buffer.alloc(4); len.writeUInt32BE(data.length); crc.writeUInt32BE(crc32(Buffer.concat([t, data]))); return Buffer.concat([len, t, data, crc]); };
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
function readPng(file) {
  const buf = fs.readFileSync(file);
  let o = 8, w = 0, h = 0, data = null;
  while (o < buf.length) {
    const len = buf.readUInt32BE(o), type = buf.subarray(o + 4, o + 8).toString();
    const chunk = buf.subarray(o + 8, o + 8 + len);
    if (type === 'IHDR') { w = chunk.readUInt32BE(0); h = chunk.readUInt32BE(4); }
    if (type === 'IDAT') data = data ? Buffer.concat([data, chunk]) : chunk;
    o += 12 + len;
  }
  const raw = zlib.inflateSync(data), pix = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) pix.set(raw.subarray(y * (w * 4 + 1) + 1, y * (w * 4 + 1) + 1 + w * 4), y * w * 4);
  return { w, h, pix };
}
function render(tris, w, h, look) {
  const eye = look.position, target = look.target;
  const f = norm(sub(target, eye)), r = norm(cross(f, [0, 1, 0])), u = cross(r, f);
  const fy = Math.tan(look.fovVerticalDeg * Math.PI / 360), fx = fy * (w / h);
  const light = norm([-0.25, 0.82, 0.35]);
  const color = Buffer.alloc(w * h * 4), zbuf = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const t = y / h, rr = 6 + (1 - t) * 16, gg = 10 + (1 - t) * 22, bb = 28 + (1 - t) * 36;
    for (let x = 0; x < w; x++) { const id = y * w + x; color[id * 4] = rr; color[id * 4 + 1] = gg; color[id * 4 + 2] = bb; color[id * 4 + 3] = 255; zbuf[id] = 1e9; }
  }
  const project = p => {
    const d = sub(p, eye), z = dot(d, f); if (z < 0.08) return null;
    return { x: w * 0.5 + (dot(d, r) / z) / fx * (w * 0.5), y: h * 0.5 - (dot(d, u) / z) / fy * (h * 0.5), z };
  };
  const opaque = [], blend = [];
  for (const tri of tris) {
    const s = tri.p.map(project); if (s.some(v => !v)) continue;
    const n = norm(cross(sub(tri.p[1], tri.p[0]), sub(tri.p[2], tri.p[0])));
    const nd = tri.unlit ? 1 : 0.48 + 0.52 * Math.abs(dot(n, light));
    const item = { s, c: tri.c.map(c => [Math.min(255, c[0] * nd), Math.min(255, c[1] * nd), Math.min(255, c[2] * nd), c[3]]), z: (s[0].z + s[1].z + s[2].z) / 3 };
    (tri.c.some(c => c[3] < 250) ? blend : opaque).push(item);
  }
  const paint = (tri, srcOver) => {
    const s = tri.s;
    let minX = Math.max(0, Math.floor(Math.min(s[0].x, s[1].x, s[2].x))), maxX = Math.min(w - 1, Math.ceil(Math.max(s[0].x, s[1].x, s[2].x)));
    let minY = Math.max(0, Math.floor(Math.min(s[0].y, s[1].y, s[2].y))), maxY = Math.min(h - 1, Math.ceil(Math.max(s[0].y, s[1].y, s[2].y)));
    const area = (s[1].x - s[0].x) * (s[2].y - s[0].y) - (s[2].x - s[0].x) * (s[1].y - s[0].y);
    if (Math.abs(area) < 1e-6) return;
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      const px = x + 0.5, py = y + 0.5;
      const w0 = ((s[1].x - px) * (s[2].y - py) - (s[2].x - px) * (s[1].y - py)) / area;
      const w1 = ((s[2].x - px) * (s[0].y - py) - (s[0].x - px) * (s[2].y - py)) / area;
      const w2 = 1 - w0 - w1;
      if (w0 < -0.001 || w1 < -0.001 || w2 < -0.001) continue;
      const z = w0 * s[0].z + w1 * s[1].z + w2 * s[2].z, id = y * w + x;
      if (z >= zbuf[id]) continue;
      const cr = w0 * tri.c[0][0] + w1 * tri.c[1][0] + w2 * tri.c[2][0];
      const cg = w0 * tri.c[0][1] + w1 * tri.c[1][1] + w2 * tri.c[2][1];
      const cb = w0 * tri.c[0][2] + w1 * tri.c[1][2] + w2 * tri.c[2][2];
      const ca = (w0 * tri.c[0][3] + w1 * tri.c[1][3] + w2 * tri.c[2][3]) / 255;
      if (srcOver && ca < 0.995) {
        const a = Math.max(0, Math.min(1, ca));
        color[id * 4] = color[id * 4] * (1 - a) + cr * a;
        color[id * 4 + 1] = color[id * 4 + 1] * (1 - a) + cg * a;
        color[id * 4 + 2] = color[id * 4 + 2] * (1 - a) + cb * a;
      } else { zbuf[id] = z; color[id * 4] = cr; color[id * 4 + 1] = cg; color[id * 4 + 2] = cb; }
    }
  };
  for (const tri of opaque) paint(tri, false);
  blend.sort((a, b) => b.z - a.z);
  for (const tri of blend) paint(tri, true);
  return png(w, h, color);
}
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
function blit(dst, dw, dx, dy, src, sw, sh) {
  for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
    const s = (y * sw + x) * 4, d = ((dy + y) * dw + dx + x) * 4;
    dst[d] = src[s]; dst[d + 1] = src[s + 1]; dst[d + 2] = src[s + 2]; dst[d + 3] = 255;
  }
}
const { meshes } = loadGlb(GLB);
const tris = [];
for (const mesh of meshes) for (let i = 0; i < mesh.idx.length; i += 3) {
  const ids = [mesh.idx[i], mesh.idx[i + 1], mesh.idx[i + 2]];
  tris.push({ p: ids.map(k => mesh.pos[k]), c: ids.map(k => mesh.col[k].map(v => v * 255)), unlit: mesh.unlit });
}
fs.mkdirSync(OUT, { recursive: true });
const w = 720, h = 1280, look = D.fjordBoardLook(w / h);
const file = path.join(OUT, 'fjord-board-720x1280.png');
const rendered = render(tris, w, h, look);
fs.writeFileSync(file, rendered);
console.log(file, look.fovVerticalDeg, 'tris', tris.length);
if (fs.existsSync(OLD)) {
  const old = readPng(OLD), gap = 16;
  const canvas = Buffer.alloc((w * 2 + gap) * h * 4);
  canvas.fill(12);
  const scale = (src, sw, sh) => {
    const out = Buffer.alloc(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const sx = Math.min(sw - 1, Math.floor(x * sw / w)), sy = Math.min(sh - 1, Math.floor(y * sh / h));
      out.set(src.subarray((sy * sw + sx) * 4, (sy * sw + sx) * 4 + 4), (y * w + x) * 4);
    }
    return out;
  };
  blit(canvas, w * 2 + gap, 0, 0, scale(old.pix, old.w, old.h), w, h);
  blit(canvas, w * 2 + gap, w + gap, 0, readPng(file).pix, w, h);
  const compare = path.join(OUT, 'fjord-art-compare.png');
  fs.writeFileSync(compare, png(w * 2 + gap, h, canvas));
  console.log(compare);
}
