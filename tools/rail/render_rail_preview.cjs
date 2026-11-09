'use strict';
// Offline preview of env_rail from the game board camera (RailSceneData.railBoardLook). Not a device capture.
const fs = require('node:fs'), path = require('node:path'), zlib = require('node:zlib');
const { createHarness } = require('../board-ui/harness.cjs');
const D = createHarness().load('region/RailSceneData');
const GLB = path.resolve(__dirname, '../../creator-build-project/assets/bundles/region_rail/models/env_rail.glb');
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
function loadGlb(file) {
  const b = fs.readFileSync(file), jl = b.readUInt32LE(12), j = JSON.parse(b.slice(20, 20 + jl).toString());
  const at = 20 + jl, bin = b.slice(at + 8, at + 8 + b.readUInt32LE(at));
  const acc = i => {
    const a = j.accessors[i], v = j.bufferViews[a.bufferView], start = (v.byteOffset || 0) + (a.byteOffset || 0);
    const n = a.type === 'VEC3' ? 3 : a.type === 'VEC2' ? 2 : 1, out = [];
    for (let k = 0; k < a.count; k++) { const p = []; for (let c = 0; c < n; c++) p.push(a.componentType === 5126 ? bin.readFloatLE(start + (k * n + c) * 4) : (a.componentType === 5123 ? bin.readUInt16LE(start + k * 2) : bin.readUInt32LE(start + k * 4))); out.push(n === 1 ? p[0] : p); }
    return out;
  };
  const tris = [];
  for (const node of j.nodes) {
    if (node.mesh === undefined) continue;
    for (const prim of j.meshes[node.mesh].primitives) {
      const pos = acc(prim.attributes.POSITION), uv = acc(prim.attributes.TEXCOORD_0), idx = acc(prim.indices);
      for (let i = 0; i < idx.length; i += 3) tris.push({ p: [pos[idx[i]], pos[idx[i + 1]], pos[idx[i + 2]]], uv: [uv[idx[i]], uv[idx[i + 1]], uv[idx[i + 2]]] });
    }
  }
  const img = j.images[0], view = j.bufferViews[img.bufferView], pngBuf = bin.slice(view.byteOffset, view.byteOffset + view.byteLength);
  return { tris, pngBuf };
}
function palette(pngBuf) {
  const sig = pngBuf.subarray(0, 8);
  let o = 8, w = 0, h = 0, data = null;
  while (o < pngBuf.length) {
    const len = pngBuf.readUInt32BE(o), type = pngBuf.subarray(o + 4, o + 8).toString();
    const chunk = pngBuf.subarray(o + 8, o + 8 + len);
    if (type === 'IHDR') { w = chunk.readUInt32BE(0); h = chunk.readUInt32BE(4); }
    if (type === 'IDAT') data = data ? Buffer.concat([data, chunk]) : chunk;
    o += 12 + len;
  }
  const raw = zlib.inflateSync(data), pix = [];
  for (let y = 0; y < h; y++) { const row = y * (w * 3 + 1); for (let x = 0; x < w; x++) pix.push([raw[row + 1 + x * 3], raw[row + 2 + x * 3], raw[row + 3 + x * 3]]); }
  return (u, v) => { const x = Math.max(0, Math.min(w - 1, Math.floor(u * w))), y = Math.max(0, Math.min(h - 1, Math.floor(v * h))); return pix[y * w + x]; };
}
function render(tris, sample, w, h, look) {
  const eye = look.position, target = look.target;
  const f = norm(sub(target, eye)), r = norm(cross(f, [0, 1, 0])), u = cross(r, f);
  const fy = Math.tan(look.fovVerticalDeg * Math.PI / 360);
  const fx = fy * (w / h);
  const light = norm([-0.35, 0.82, 0.45]);
  const color = Buffer.alloc(w * h * 4), zbuf = new Float32Array(w * h);
  const sky = [244, 230, 207, 255];
  for (let i = 0; i < w * h; i++) { color[i * 4] = sky[0]; color[i * 4 + 1] = sky[1]; color[i * 4 + 2] = sky[2]; color[i * 4 + 3] = 255; zbuf[i] = Infinity; }
  const project = p => {
    const d = sub(p, eye), z = dot(d, f); if (z < 0.05) return null;
    return { x: (w * 0.5) + (dot(d, r) / z) / fx * (w * 0.5), y: (h * 0.5) - (dot(d, u) / z) / fy * (h * 0.5), z };
  };
  for (const tri of tris) {
    const s = tri.p.map(project); if (s.some(v => !v)) continue;
    const n = norm(cross(sub(tri.p[1], tri.p[0]), sub(tri.p[2], tri.p[0])));
    let nd = Math.abs(dot(n, light)); nd = 0.38 + 0.62 * nd;
    let minX = Math.floor(Math.min(s[0].x, s[1].x, s[2].x)), maxX = Math.ceil(Math.max(s[0].x, s[1].x, s[2].x));
    let minY = Math.floor(Math.min(s[0].y, s[1].y, s[2].y)), maxY = Math.ceil(Math.max(s[0].y, s[1].y, s[2].y));
    minX = Math.max(0, minX); maxX = Math.min(w - 1, maxX); minY = Math.max(0, minY); maxY = Math.min(h - 1, maxY);
    const area = (s[1].x - s[0].x) * (s[2].y - s[0].y) - (s[2].x - s[0].x) * (s[1].y - s[0].y);
    if (Math.abs(area) < 1e-6) continue;
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      const px = x + 0.5, py = y + 0.5;
      const w0 = ((s[1].x - px) * (s[2].y - py) - (s[2].x - px) * (s[1].y - py)) / area;
      const w1 = ((s[2].x - px) * (s[0].y - py) - (s[0].x - px) * (s[2].y - py)) / area;
      const w2 = 1 - w0 - w1;
      if (w0 < -0.001 || w1 < -0.001 || w2 < -0.001) continue;
      const z = w0 * s[0].z + w1 * s[1].z + w2 * s[2].z, id = y * w + x;
      if (z >= zbuf[id]) continue; zbuf[id] = z;
      const tu = w0 * tri.uv[0][0] + w1 * tri.uv[1][0] + w2 * tri.uv[2][0];
      const tv = w0 * tri.uv[0][1] + w1 * tri.uv[1][1] + w2 * tri.uv[2][1];
      const c = sample(tu, tv);
      color[id * 4] = Math.min(255, c[0] * nd); color[id * 4 + 1] = Math.min(255, c[1] * nd); color[id * 4 + 2] = Math.min(255, c[2] * nd);
    }
  }
  return png(w, h, color);
}
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const { tris, pngBuf } = loadGlb(GLB), sample = palette(pngBuf);
fs.mkdirSync(OUT, { recursive: true });
const shots = [['rail-board-720x1280', 720, 1280], ['rail-board-390x844', 390, 844]];
for (const [name, w, h] of shots) {
  const look = D.railBoardLook(w / h);
  const file = path.join(OUT, name + '.png');
  fs.writeFileSync(file, render(tris, sample, w, h, look));
  console.log(file, look.fovVerticalDeg);
}
