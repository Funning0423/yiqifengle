'use strict';
// Offline preview from MossgardenSceneData.mossgardenBoardLook. Vertex colours, unlit stays unshaded.
const fs = require('node:fs'), path = require('node:path'), zlib = require('node:zlib');
const { createHarness } = require('../board-ui/harness.cjs');
const { loadGlb } = require('../fjord/glb_read.cjs');
const D = createHarness().load('region/MossgardenSceneData');
const GLB = path.resolve(__dirname, '../../creator-build-project/assets/bundles/region_mossgarden/models/env_mossgarden.glb');
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
function render(tris, w, h, look) {
  const eye = look.position, target = look.target;
  const f = norm(sub(target, eye)), r = norm(cross(f, [0, 1, 0])), u = cross(r, f);
  const fy = Math.tan(look.fovVerticalDeg * Math.PI / 360), fx = fy * (w / h);
  const light = norm([0.35, 0.86, 0.28]);
  const color = Buffer.alloc(w * h * 4), zbuf = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const t = y / h;
    const rr = 255 - t * 87, gg = 198 + t * 0, bb = 128 + t * 68;
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
    const nd = tri.unlit ? 1 : 0.86 + 0.14 * Math.max(0, dot(n, light));
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
const { meshes } = loadGlb(GLB);
const tris = [];
for (const mesh of meshes) for (let i = 0; i < mesh.idx.length; i += 3) {
  const ids = [mesh.idx[i], mesh.idx[i + 1], mesh.idx[i + 2]];
  tris.push({ p: ids.map(k => mesh.pos[k]), c: ids.map(k => mesh.col[k].map(v => v * 255)), unlit: mesh.unlit });
}
fs.mkdirSync(OUT, { recursive: true });
const w = 720, h = 1280, look = D.mossgardenBoardLook(w / h);
const file = path.join(OUT, 'mossgarden-board-720x1280.png');
fs.writeFileSync(file, render(tris, w, h, look));
const eye = look.position, target = look.target;
const f = norm(sub(target, eye)), r = norm(cross(f, [0, 1, 0])), u = cross(r, f);
const fy = Math.tan(look.fovVerticalDeg * Math.PI / 360), fx = fy * (w / h);
const b = D.mossgardenBoardBounds();
const corners = [[b.min[0], b.min[1], b.min[2]], [b.max[0], b.min[1], b.min[2]], [b.min[0], b.min[1], b.max[2]], [b.max[0], b.min[1], b.max[2]]];
const projected = corners.map(p => {
  const d = sub(p, eye), z = dot(d, f);
  return { x: w * 0.5 + (dot(d, r) / z) / fx * (w * 0.5), y: h * 0.5 - (dot(d, u) / z) / fy * (h * 0.5), z };
});
console.log(file, look, 'tris', tris.length);
console.log('board screen', projected.map(p => [Math.round(p.x), Math.round(p.y)]));
const harbor = process.env.HARBOR || path.join(OUT, 'harbor-board-720x1280.png');
if (fs.existsSync(harbor)) {
  function readPng(buf) {
    let o = 8, W = 0, H = 0, data = null;
    while (o < buf.length) {
      const len = buf.readUInt32BE(o), type = buf.subarray(o + 4, o + 8).toString();
      const chunk = buf.subarray(o + 8, o + 8 + len);
      if (type === 'IHDR') { W = chunk.readUInt32BE(0); H = chunk.readUInt32BE(4); }
      if (type === 'IDAT') data = data ? Buffer.concat([data, chunk]) : chunk;
      o += 12 + len;
    }
    const raw = zlib.inflateSync(data), pix = Buffer.alloc(W * H * 4);
    for (let y = 0; y < H; y++) pix.set(raw.subarray(y * (W * 4 + 1) + 1, y * (W * 4 + 1) + 1 + W * 4), y * W * 4);
    return { W, H, pix };
  }
  const gap = 16, left = readPng(fs.readFileSync(harbor)), right = readPng(fs.readFileSync(file));
  const cw = left.W + gap + right.W, ch = Math.max(left.H, right.H);
  const canvas = Buffer.alloc(cw * ch * 4); canvas.fill(18);
  const blit = (img, dx) => { for (let y = 0; y < img.H; y++) for (let x = 0; x < img.W; x++) canvas.set(img.pix.subarray((y * img.W + x) * 4, (y * img.W + x) * 4 + 4), (y * cw + dx + x) * 4); };
  blit(left, 0); blit(right, left.W + gap);
  const compare = path.join(OUT, 'harbor-mossgarden-compare.png');
  fs.writeFileSync(compare, png(cw, ch, canvas));
  console.log(compare);
}
const v3 = process.env.V3 || path.join(OUT, 'mossgarden-v3-720x1280.png');
if (fs.existsSync(v3) && fs.existsSync(file)) {
  function readPng(buf) {
    let o = 8, W = 0, H = 0, data = null;
    while (o < buf.length) {
      const len = buf.readUInt32BE(o), type = buf.subarray(o + 4, o + 8).toString();
      const chunk = buf.subarray(o + 8, o + 8 + len);
      if (type === 'IHDR') { W = chunk.readUInt32BE(0); H = chunk.readUInt32BE(4); }
      if (type === 'IDAT') data = data ? Buffer.concat([data, chunk]) : chunk;
      o += 12 + len;
    }
    const raw = zlib.inflateSync(data), pix = Buffer.alloc(W * H * 4);
    for (let y = 0; y < H; y++) pix.set(raw.subarray(y * (W * 4 + 1) + 1, y * (W * 4 + 1) + 1 + W * 4), y * W * 4);
    return { W, H, pix };
  }
  const gap = 16, left = readPng(fs.readFileSync(v3)), right = readPng(fs.readFileSync(file));
  const cw = left.W + gap + right.W, ch = Math.max(left.H, right.H);
  const canvas = Buffer.alloc(cw * ch * 4); canvas.fill(18);
  const blit = (img, dx) => { for (let y = 0; y < img.H; y++) for (let x = 0; x < img.W; x++) canvas.set(img.pix.subarray((y * img.W + x) * 4, (y * img.W + x) * 4 + 4), (y * cw + dx + x) * 4); };
  blit(left, 0); blit(right, left.W + gap);
  const compare = path.join(OUT, 'mossgarden-v3-v4-compare.png');
  fs.writeFileSync(compare, png(cw, ch, canvas));
  console.log(compare);
}
const v2 = process.env.V2 || path.join(OUT, 'mossgarden-v2-720x1280.png');
if (fs.existsSync(v2) && fs.existsSync(file)) {
  function readPng(buf) {
    let o = 8, W = 0, H = 0, data = null;
    while (o < buf.length) {
      const len = buf.readUInt32BE(o), type = buf.subarray(o + 4, o + 8).toString();
      const chunk = buf.subarray(o + 8, o + 8 + len);
      if (type === 'IHDR') { W = chunk.readUInt32BE(0); H = chunk.readUInt32BE(4); }
      if (type === 'IDAT') data = data ? Buffer.concat([data, chunk]) : chunk;
      o += 12 + len;
    }
    const raw = zlib.inflateSync(data), pix = Buffer.alloc(W * H * 4);
    for (let y = 0; y < H; y++) pix.set(raw.subarray(y * (W * 4 + 1) + 1, y * (W * 4 + 1) + 1 + W * 4), y * W * 4);
    return { W, H, pix };
  }
  const gap = 16, left = readPng(fs.readFileSync(v2)), right = readPng(fs.readFileSync(file));
  const cw = left.W + gap + right.W, ch = Math.max(left.H, right.H);
  const canvas = Buffer.alloc(cw * ch * 4); canvas.fill(18);
  const blit = (img, dx) => { for (let y = 0; y < img.H; y++) for (let x = 0; x < img.W; x++) canvas.set(img.pix.subarray((y * img.W + x) * 4, (y * img.W + x) * 4 + 4), (y * cw + dx + x) * 4); };
  blit(left, 0); blit(right, left.W + gap);
  const compare = path.join(OUT, 'mossgarden-v2-v3-compare.png');
  fs.writeFileSync(compare, png(cw, ch, canvas));
  console.log(compare);
}
const v1 = process.env.V1 || path.join(OUT, 'mossgarden-v1-720x1280.png');
if (fs.existsSync(v1) && fs.existsSync(file)) {
  function readPng(buf) {
    let o = 8, W = 0, H = 0, data = null;
    while (o < buf.length) {
      const len = buf.readUInt32BE(o), type = buf.subarray(o + 4, o + 8).toString();
      const chunk = buf.subarray(o + 8, o + 8 + len);
      if (type === 'IHDR') { W = chunk.readUInt32BE(0); H = chunk.readUInt32BE(4); }
      if (type === 'IDAT') data = data ? Buffer.concat([data, chunk]) : chunk;
      o += 12 + len;
    }
    const raw = zlib.inflateSync(data), pix = Buffer.alloc(W * H * 4);
    for (let y = 0; y < H; y++) pix.set(raw.subarray(y * (W * 4 + 1) + 1, y * (W * 4 + 1) + 1 + W * 4), y * W * 4);
    return { W, H, pix };
  }
  const gap = 16, left = readPng(fs.readFileSync(v1)), right = readPng(fs.readFileSync(file));
  const cw = left.W + gap + right.W, ch = Math.max(left.H, right.H);
  const canvas = Buffer.alloc(cw * ch * 4); canvas.fill(18);
  const blit = (img, dx) => { for (let y = 0; y < img.H; y++) for (let x = 0; x < img.W; x++) canvas.set(img.pix.subarray((y * img.W + x) * 4, (y * img.W + x) * 4 + 4), (y * cw + dx + x) * 4); };
  blit(left, 0); blit(right, left.W + gap);
  const compare = path.join(OUT, 'mossgarden-v1-v2-compare.png');
  fs.writeFileSync(compare, png(cw, ch, canvas));
  console.log(compare);
}
