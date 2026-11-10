'use strict';
// Procedural low-poly hot-spring valley blockout. One 16×16 palette, no animation.
// The wooden deck top is a single horizontal rectangle. HotspringSceneData seats the 7×7 on that plane.
const fs = require('node:fs'), path = require('node:path'), zlib = require('node:zlib');
const OUT = path.resolve(__dirname, '../../creator-build-project/assets/bundles/region_hotspring/models/env_hotspring.glb');
/** Exact in float32. Kept in lockstep with HotspringSceneData.HOTSPRING_PLATFORM / HOTSPRING_BOARD_INSET. */
const PLATFORM = { y: 0.5, minX: -2.5, maxX: 2.5, minZ: -2.5, maxZ: 2.5 };
const COLORS = [
  [0xE4, 0xC4, 0x96], // 0 deck
  [0xC4, 0x96, 0x5C], // 1 plank
  [0x6E, 0x45, 0x2C], // 2 dark wood
  [0xC9, 0xC3, 0xB6], // 3 stone
  [0x8A, 0x84, 0x78], // 4 stone shadow
  [0x6E, 0xC4, 0xC0], // 5 water
  [0x2F, 0x86, 0x90], // 6 water deep
  [0xF7, 0xFB, 0xF8], // 7 steam
  [0xD5, 0xE6, 0xE2], // 8 steam shade
  [0x7C, 0xA3, 0x58], // 9 bamboo
  [0x3F, 0x62, 0x32], // 10 bamboo dark
  [0xE2, 0x53, 0x38], // 11 lantern
  [0xF6, 0xC2, 0x62], // 12 lantern glow
  [0xD2, 0x3A, 0x3C], // 13 maple
  [0x8C, 0x24, 0x32], // 14 maple dark
  [0x6A, 0x8C, 0x62], // 15 valley moss
];
function crc32(buf) {
  let c, n = -1;
  if (!crc32.t) { crc32.t = []; for (let i = 0; i < 256; i++) { c = i; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc32.t[i] = c >>> 0; } }
  for (let i = 0; i < buf.length; i++) n = crc32.t[(n ^ buf[i]) & 255] ^ (n >>> 8);
  return (n ^ -1) >>> 0;
}
function png16() {
  const w = 16, h = 16, raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    const row = y * (w * 3 + 1); raw[row] = 0;
    for (let x = 0; x < w; x++) { const c = COLORS[x], o = row + 1 + x * 3; raw[o] = c[0]; raw[o + 1] = c[1]; raw[o + 2] = c[2]; }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const chunk = (type, data) => { const t = Buffer.from(type), len = Buffer.alloc(4), crc = Buffer.alloc(4); len.writeUInt32BE(data.length); crc.writeUInt32BE(crc32(Buffer.concat([t, data]))); return Buffer.concat([len, t, data, crc]); };
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
function uv(i) { return [(i + 0.5) / 16, 0.5]; }
function mesh() { return { pos: [], nrm: [], uv: [], idx: [] }; }
function addTri(m, a, b, c, color) {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.hypot(nx, ny, nz) || 1;
  nx /= l; ny /= l; nz /= l; const t = uv(color), base = m.pos.length / 3;
  for (const p of [a, b, c]) { m.pos.push(p[0], p[1], p[2]); m.nrm.push(nx, ny, nz); m.uv.push(t[0], t[1]); }
  m.idx.push(base, base + 1, base + 2);
}
function addQuad(m, a, b, c, d, color) { addTri(m, a, b, c, color); addTri(m, a, c, d, color); }
function box(m, x0, y0, z0, x1, y1, z1, color) {
  addQuad(m, [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], color);
  addQuad(m, [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], color);
  addQuad(m, [x1, y0, z1], [x1, y1, z1], [x1, y1, z0], [x1, y0, z0], color);
  addQuad(m, [x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1], color);
  addQuad(m, [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], color);
  addQuad(m, [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], color);
}
function puff(m, cx, cy, cz, rx, ry, rz, color) {
  const top = [cx, cy + ry, cz], bot = [cx, cy - ry * 0.35, cz];
  const ring = [[cx + rx, cy, cz], [cx, cy, cz + rz], [cx - rx, cy, cz], [cx, cy, cz - rz]];
  for (let i = 0; i < 4; i++) {
    addTri(m, top, ring[i], ring[(i + 1) % 4], color);
    addTri(m, bot, ring[(i + 1) % 4], ring[i], color);
  }
}
function lantern(m, x, y, z, s) {
  box(m, x - s * 0.28, y, z - s * 0.28, x + s * 0.28, y + s, z + s * 0.28, 11);
  const top = y + s, peak = y + s + s * 0.42;
  addTri(m, [x, peak, z], [x - s * 0.42, top, z - s * 0.42], [x + s * 0.42, top, z - s * 0.42], 12);
  addTri(m, [x, peak, z], [x + s * 0.42, top, z - s * 0.42], [x + s * 0.42, top, z + s * 0.42], 12);
  addTri(m, [x, peak, z], [x + s * 0.42, top, z + s * 0.42], [x - s * 0.42, top, z + s * 0.42], 12);
  addTri(m, [x, peak, z], [x - s * 0.42, top, z + s * 0.42], [x - s * 0.42, top, z - s * 0.42], 12);
}
const parts = [];
function part(name, build) { const m = mesh(); build(m); parts.push({ name, m }); }
const P = PLATFORM;
part('HS_platform', m => {
  box(m, P.minX, 0.18, P.minZ, P.maxX, P.y, P.maxZ, 0);
  box(m, P.minX + 0.22, 0.06, P.minZ + 0.22, P.maxX - 0.22, 0.18, P.maxZ - 0.22, 2);
});
part('HS_valley', m => {
  box(m, -8.4, -0.55, -7.6, 8.4, 0.0, 6.8, 15);
  box(m, -7.2, 0.0, -7.4, -3.4, 0.85, -5.6, 4);
  box(m, 3.2, 0.0, -7.2, 7.4, 0.7, -5.5, 4);
});
part('HS_pools', m => {
  box(m, -3.22, 0.0, -1.05, -2.62, 0.4, 0.85, 3);
  addQuad(m, [-3.08, 0.42, 0.68], [-2.76, 0.42, 0.68], [-2.76, 0.42, -0.88], [-3.08, 0.42, -0.88], 5);
  addQuad(m, [-3.0, 0.44, 0.42], [-2.84, 0.44, 0.42], [-2.84, 0.44, -0.62], [-3.0, 0.44, -0.62], 6);
  box(m, 2.62, 0.0, -0.45, 3.22, 0.36, 1.05, 3);
  addQuad(m, [2.76, 0.38, 0.88], [3.08, 0.38, 0.88], [3.08, 0.38, -0.28], [2.76, 0.38, -0.28], 5);
  addQuad(m, [2.86, 0.4, 0.62], [2.98, 0.4, 0.62], [2.98, 0.4, -0.05], [2.86, 0.4, -0.05], 6);
  box(m, -1.05, 0.0, -4.15, 1.05, 0.34, -2.72, 3);
  addQuad(m, [-0.88, 0.36, -2.88], [0.88, 0.36, -2.88], [0.88, 0.36, -3.98], [-0.88, 0.36, -3.98], 5);
  box(m, -3.12, 0.0, -1.22, -2.88, 0.2, -0.98, 4);
  box(m, 2.88, 0.0, 1.08, 3.12, 0.22, 1.32, 4);
});
part('HS_steam', m => {
  puff(m, -2.92, 0.95, -0.1, 0.28, 0.32, 0.24, 7);
  puff(m, -2.78, 1.4, 0.12, 0.2, 0.26, 0.18, 8);
  puff(m, 2.92, 0.9, 0.28, 0.26, 0.3, 0.22, 7);
  puff(m, 2.78, 1.35, 0.05, 0.18, 0.24, 0.16, 8);
  puff(m, 0.0, 0.9, -3.4, 0.36, 0.3, 0.22, 7);
  puff(m, 0.18, 1.35, -3.22, 0.22, 0.26, 0.16, 8);
});
part('HS_fence', m => {
  const poles = [-2.7, -1.35, 0, 1.35, 2.7];
  for (const x of poles) box(m, x - 0.06, 0.0, -4.55, x + 0.06, 1.22, -4.43, 9);
  box(m, -2.7, 0.42, -4.53, 2.7, 0.52, -4.45, 10);
  box(m, -2.7, 0.92, -4.53, 2.7, 1.02, -4.45, 10);
  box(m, -3.08, 0.0, 1.05, -2.96, 0.92, 1.17, 9);
  box(m, -3.08, 0.0, 1.55, -2.96, 0.92, 1.67, 9);
  box(m, -3.08, 0.42, 1.05, -2.96, 0.5, 1.67, 10);
});
part('HS_lanterns', m => {
  box(m, -0.05, 1.02, -4.58, 0.05, 1.42, -4.4, 2);
  lantern(m, 0, 1.42, -4.49, 0.28);
  box(m, -0.98, 0.38, 3.42, -0.86, 1.22, 3.54, 2);
  lantern(m, -0.92, 1.22, 3.48, 0.26);
  box(m, 0.86, 0.38, 3.42, 0.98, 1.22, 3.54, 2);
  lantern(m, 0.92, 1.22, 3.48, 0.26);
  lantern(m, 2.78, 0.36, 1.15, 0.2);
});
part('HS_maple', m => {
  box(m, -3.02, 0.0, -3.55, -2.84, 1.05, -3.37, 2);
  puff(m, -2.92, 1.32, -3.46, 0.48, 0.38, 0.42, 13);
  puff(m, -2.72, 1.68, -3.28, 0.28, 0.24, 0.24, 14);
  box(m, 2.78, 0.0, -3.42, 2.96, 1.12, -3.24, 2);
  puff(m, 2.9, 1.4, -3.32, 0.5, 0.4, 0.44, 13);
  puff(m, 2.68, 1.78, -3.12, 0.28, 0.24, 0.24, 14);
  box(m, -2.78, 0.0, 1.28, -2.66, 0.72, 1.4, 2);
  puff(m, -2.72, 0.92, 1.34, 0.22, 0.2, 0.2, 13);
});
part('HS_corridor', m => {
  for (const z of [2.85, 4.05]) {
    box(m, -0.98, 0.22, z - 0.06, -0.86, 1.42, z + 0.06, 2);
    box(m, 0.86, 0.22, z - 0.06, 0.98, 1.42, z + 0.06, 2);
  }
  box(m, -1.08, 1.32, 2.68, 1.08, 1.46, 4.28, 1);
  box(m, -1.02, 1.46, 2.72, 1.02, 1.54, 4.22, 2);
  for (let i = 0; i < 3; i++) {
    const z0 = 2.62 + i * 0.55;
    box(m, -0.72, 0.22, z0, 0.72, 0.38, z0 + 0.46, i % 2 ? 2 : 1);
  }
});
const png = png16();
const blobs = [], views = [], accessors = [], meshes = [], nodes = [{ name: 'env_hotspring', children: [] }];
let offset = 0;
const align = () => { const m = (4 - (offset % 4)) % 4; offset += m; if (m) blobs.push(Buffer.alloc(m)); };
parts.forEach((part, pi) => {
  const m = part.m, start = accessors.length;
  const arrays = [[Float32Array.from(m.pos), 'VEC3', 12], [Float32Array.from(m.nrm), 'VEC3', 12], [Float32Array.from(m.uv), 'VEC2', 8]];
  arrays.forEach(([arr, type, size]) => {
    align(); const buf = Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength); blobs.push(buf);
    views.push({ buffer: 0, byteOffset: offset, byteLength: buf.length, target: 34962 });
    const n = type === 'VEC2' ? 2 : 3; let min = Array(n).fill(Infinity), max = Array(n).fill(-Infinity);
    for (let i = 0; i < arr.length; i += n) for (let k = 0; k < n; k++) { min[k] = Math.min(min[k], arr[i + k]); max[k] = Math.max(max[k], arr[i + k]); }
    accessors.push({ bufferView: views.length - 1, componentType: 5126, count: arr.length / n, type, min, max });
    offset += buf.length; void size;
  });
  align(); const idx = Uint16Array.from(m.idx), ib = Buffer.from(idx.buffer, idx.byteOffset, idx.byteLength); blobs.push(ib);
  views.push({ buffer: 0, byteOffset: offset, byteLength: ib.length, target: 34963 });
  accessors.push({ bufferView: views.length - 1, componentType: 5123, count: idx.length, type: 'SCALAR' });
  offset += ib.length;
  meshes.push({ name: part.name, primitives: [{ attributes: { POSITION: start, NORMAL: start + 1, TEXCOORD_0: start + 2 }, indices: start + 3, material: 0 }] });
  nodes.push({ name: part.name, mesh: pi }); nodes[0].children.push(nodes.length - 1);
});
align(); const imageView = views.length; blobs.push(png); views.push({ buffer: 0, byteOffset: offset, byteLength: png.length }); offset += png.length;
const json = {
  asset: { version: '2.0', generator: 'qf-env-hotspring', extras: { license: 'original-procedural' } },
  scene: 0, scenes: [{ name: 'env_hotspring', nodes: [0] }], nodes, meshes,
  materials: [{ name: 'M_HS_palette', doubleSided: true, pbrMetallicRoughness: { baseColorTexture: { index: 0 }, metallicFactor: 0, roughnessFactor: 1 } }],
  textures: [{ sampler: 0, source: 0 }], samplers: [{ magFilter: 9728, minFilter: 9728, wrapS: 33071, wrapT: 33071 }],
  images: [{ name: 'T_HS_palette_16', mimeType: 'image/png', bufferView: imageView }],
  accessors, bufferViews: views, buffers: [{ byteLength: offset }],
};
let text = Buffer.from(JSON.stringify(json)); while (text.length % 4) text = Buffer.concat([text, Buffer.from(' ')]);
const bin = Buffer.concat(blobs); const binPad = (4 - (bin.length % 4)) % 4; const binChunk = Buffer.concat([bin, Buffer.alloc(binPad)]);
const header = Buffer.alloc(12); header.writeUInt32LE(0x46546C67, 0); header.writeUInt32LE(2, 4);
const jh = Buffer.alloc(8); jh.writeUInt32LE(text.length, 0); jh.writeUInt32LE(0x4E4F534A, 4);
const bh = Buffer.alloc(8); bh.writeUInt32LE(binChunk.length, 0); bh.writeUInt32LE(0x004E4942, 4);
const body = Buffer.concat([header, jh, text, bh, binChunk]); body.writeUInt32LE(body.length, 8);
fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, body);
const tris = parts.reduce((n, p) => n + p.m.idx.length / 3, 0);
console.log(JSON.stringify({ bytes: body.length, tris, nodes: parts.map(p => p.name), png: png.length, platform: PLATFORM, budget: 943718 }));
if (body.length > 943718) throw Error('over subpackage budget');
if (tris > 4000) throw Error('tris ' + tris);
