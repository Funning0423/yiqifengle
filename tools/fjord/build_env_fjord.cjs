'use strict';
// Procedural low-poly fjord boardwalk. One 16×16 palette, no animation.
// FJ_platform stays float32 so the pier top y is exact. Every other mesh is
// KHR_mesh_quantization (uint16 positions + node scale, int8 normals, uint16 uvs).
// The wooden pier top is one horizontal rectangle. FjordSceneData seats the 7×7 on that plane.
const fs = require('node:fs'), path = require('node:path'), zlib = require('node:zlib');
const OUT = path.resolve(__dirname, '../../creator-build-project/assets/bundles/region_fjord/models/env_fjord.glb');
/** Exact in float32. Kept in lockstep with FjordSceneData.FJORD_PLATFORM / FJORD_BOARD_INSET. */
const PLATFORM = { y: 1.25, minX: -2.5, maxX: 2.5, minZ: -2.5, maxZ: 2.5 };
const INSET = 0.375;
const COLORS = [
  [0xC4, 0x8A, 0x4A], // 0 deck
  [0x8C, 0x55, 0x2E], // 1 plank
  [0x4A, 0x2E, 0x1C], // 2 dark wood
  [0xC4, 0x3A, 0x32], // 3 cabin red
  [0x7A, 0x22, 0x28], // 4 cabin dark
  [0x1C, 0x4C, 0x86], // 5 water
  [0x0C, 0x2A, 0x58], // 6 water deep
  [0x6A, 0x74, 0x84], // 7 cliff
  [0x3E, 0x48, 0x58], // 8 cliff dark
  [0xD8, 0xE4, 0xEE], // 9 snow
  [0x5C, 0xE0, 0x8A], // 10 aurora green
  [0x3A, 0xC8, 0xC4], // 11 aurora teal
  [0x7A, 0x6A, 0xE0], // 12 aurora violet
  [0x2A, 0x34, 0x44], // 13 rock
  [0xF2, 0xC6, 0x62], // 14 lamp
  [0xE8, 0xF4, 0xFF], // 15 foam
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
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
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
function peak(m, x, y0, z, r, h, color) {
  const top = [x, y0 + h, z];
  const ring = [[x + r, y0, z], [x, y0, z + r], [x - r, y0, z], [x, y0, z - r]];
  for (let i = 0; i < 4; i++) addTri(m, top, ring[i], ring[(i + 1) % 4], color);
}
function puff(m, cx, cy, cz, rx, ry, rz, color) {
  const top = [cx, cy + ry, cz], bot = [cx, cy - ry * 0.35, cz];
  const ring = [[cx + rx, cy, cz], [cx, cy, cz + rz], [cx - rx, cy, cz], [cx, cy, cz - rz]];
  for (let i = 0; i < 4; i++) {
    addTri(m, top, ring[i], ring[(i + 1) % 4], color);
    addTri(m, bot, ring[(i + 1) % 4], ring[i], color);
  }
}
function cabin(m, x, z, s) {
  const y0 = 0.55, y1 = y0 + s * 1.35;
  box(m, x - s, y0, z - s * 0.75, x + s, y1, z + s * 0.75, 3);
  const peakY = y1 + s * 0.7;
  addTri(m, [x, peakY, z], [x - s * 1.15, y1, z - s * 0.9], [x + s * 1.15, y1, z - s * 0.9], 4);
  addTri(m, [x, peakY, z], [x + s * 1.15, y1, z - s * 0.9], [x + s * 1.15, y1, z + s * 0.9], 4);
  addTri(m, [x, peakY, z], [x + s * 1.15, y1, z + s * 0.9], [x - s * 1.15, y1, z + s * 0.9], 4);
  addTri(m, [x, peakY, z], [x - s * 1.15, y1, z + s * 0.9], [x - s * 1.15, y1, z - s * 0.9], 4);
  addQuad(m, [x - s * 0.22, y0 + s * 0.35, z + s * 0.75], [x + s * 0.22, y0 + s * 0.35, z + s * 0.75], [x + s * 0.22, y0 + s * 0.85, z + s * 0.75], [x - s * 0.22, y0 + s * 0.85, z + s * 0.75], 14);
}
function ribbon(m, y, z, color, amp) {
  const xs = [-7.2, -3.6, 0, 3.6, 7.2];
  for (let i = 0; i < xs.length - 1; i++) {
    const y0 = y + (i % 2 ? amp : -amp), y1 = y + ((i + 1) % 2 ? amp : -amp);
    addQuad(m, [xs[i], y0, z], [xs[i + 1], y1, z + 0.15], [xs[i + 1], y1 - 0.7, z + 0.55], [xs[i], y0 - 0.7, z + 0.4], color);
  }
}
const parts = [];
function part(name, build, quantize) { const m = mesh(); build(m); parts.push({ name, m, quantize }); }
const P = PLATFORM;
part('FJ_platform', m => {
  box(m, P.minX, 0.75, P.minZ, P.maxX, P.y, P.maxZ, 0);
  box(m, P.minX + 0.25, 0.375, P.minZ + 0.25, P.maxX - 0.25, 0.75, P.maxZ - 0.25, 2);
}, false);
part('FJ_posts', m => {
  for (const [x, z] of [[-2.45, -2.2], [2.45, -2.2], [-2.45, 2.2], [2.45, 2.2]]) box(m, x - 0.09, -0.25, z - 0.09, x + 0.09, 0.4, z + 0.09, 2);
}, true);
part('FJ_water', m => {
  addQuad(m, [-13, 0, 9], [13, 0, 9], [13, 0, -15], [-13, 0, -15], 5);
  addQuad(m, [-9, -0.45, 6], [9, -0.45, 6], [9, -0.45, -11], [-9, -0.45, -11], 6);
  addQuad(m, [-5.5, 0.04, 7.2], [5.5, 0.04, 7.2], [5.5, 0.04, 3.4], [-5.5, 0.04, 3.4], 5);
  addQuad(m, [-4.2, 0.06, -6.4], [4.2, 0.06, -6.4], [3.4, 0.06, -9.2], [-3.4, 0.06, -9.2], 6);
}, true);
part('FJ_cliffs', m => {
  box(m, -12.4, 0, -12.5, -6.4, 7.4, 3.6, 7);
  box(m, 6.3, 0, -11.8, 12.2, 6.6, 2.8, 8);
  box(m, -6.6, 0, -14.2, 6.8, 5.8, -10.2, 7);
  box(m, -10.5, 4.2, -8.5, -7.2, 8.6, -4.2, 8);
  box(m, 7.1, 3.6, -9.2, 10.4, 8.2, -5.4, 7);
  box(m, -4.2, 4.4, -13.6, -0.6, 7.8, -11.2, 9);
  box(m, 1.2, 4.6, -13.8, 4.8, 8.4, -11.4, 9);
  peak(m, -9.2, 7.4, -6.2, 1.3, 2.4, 9);
  peak(m, 9.0, 6.6, -7.4, 1.2, 2.2, 9);
  peak(m, -2.2, 5.8, -12.6, 1.4, 2.6, 9);
  peak(m, 3.2, 5.8, -12.4, 1.15, 2.1, 8);
  peak(m, -8.4, 0, -8.6, 0.7, 1.5, 13);
  peak(m, 7.6, 0, -6.8, 0.65, 1.3, 13);
  peak(m, -5.8, 0, 4.6, 0.55, 0.9, 13);
  peak(m, 5.4, 0, 4.2, 0.5, 0.85, 13);
}, true);
part('FJ_shore', m => {
  box(m, -4.6, 0, -6.4, -2.35, 0.55, -3.6, 13);
  box(m, 2.3, 0, -6.8, 4.5, 0.48, -4.1, 13);
}, true);
part('FJ_cabins', m => {
  cabin(m, -3.45, -5.05, 0.62);
  cabin(m, 3.35, -5.45, 0.48);
}, true);
part('FJ_aurora', m => {
  ribbon(m, 8.6, -7.4, 10, 0.45);
  ribbon(m, 9.5, -6.2, 11, 0.55);
  ribbon(m, 10.3, -5.1, 12, 0.4);
  ribbon(m, 7.8, -8.6, 10, 0.35);
}, true);
part('FJ_lamps', m => {
  box(m, -2.48, 1.25, 0.125, -2.36, 1.875, 0.25, 2);
  peak(m, -2.42, 1.875, 0.1875, 0.125, 0.25, 14);
  box(m, 2.36, 1.25, -0.375, 2.48, 1.875, -0.25, 2);
  peak(m, 2.42, 1.875, -0.3125, 0.125, 0.25, 14);
  box(m, -3.45, 1.45, -4.55, -3.33, 2.05, -4.43, 2);
  peak(m, -3.39, 2.05, -4.49, 0.14, 0.22, 14);
}, true);
part('FJ_rails', m => {
  box(m, -2.5, 1.375, -2.125, -2.375, 1.5, 2.125, 1);
  box(m, 2.375, 1.375, -2.125, 2.5, 1.5, 2.125, 1);
  for (const z of [-1.75, -0.625, 0.625, 1.75]) {
    box(m, -2.5, 1.25, z - 0.0625, -2.375, 1.75, z + 0.0625, 2);
    box(m, 2.375, 1.25, z - 0.0625, 2.5, 1.75, z + 0.0625, 2);
  }
}, true);
part('FJ_trees', m => {
  box(m, -7.55, 0.55, -2.55, -7.4, 1.7, -2.4, 2);
  puff(m, -7.48, 1.95, -2.48, 0.42, 0.38, 0.36, 8);
  puff(m, -7.42, 2.35, -2.4, 0.26, 0.22, 0.22, 7);
  box(m, 7.35, 0.48, -2.15, 7.5, 1.65, -2.0, 2);
  puff(m, 7.42, 1.9, -2.08, 0.4, 0.36, 0.34, 8);
  puff(m, 7.48, 2.28, -2.02, 0.24, 0.2, 0.2, 7);
}, true);
part('FJ_approach', m => {
  for (let i = 0; i < 3; i++) {
    const z0 = 2.55 + i * 0.55;
    box(m, -0.85, 0.55 - i * 0.12, z0, 0.85, 0.78 - i * 0.12, z0 + 0.42, i % 2 ? 1 : 0);
  }
}, true);

function quantizeMesh(m) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < m.pos.length; i += 3) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], m.pos[i + k]); max[k] = Math.max(max[k], m.pos[i + k]); }
  const span = max.map((v, k) => v - min[k]);
  const q = new Uint16Array(m.pos.length);
  for (let i = 0; i < m.pos.length; i += 3) for (let k = 0; k < 3; k++) q[i + k] = span[k] === 0 ? 0 : Math.max(0, Math.min(65535, Math.round((m.pos[i + k] - min[k]) / span[k] * 65535)));
  const nq = new Int8Array(m.nrm.length);
  for (let i = 0; i < m.nrm.length; i++) nq[i] = Math.max(-127, Math.min(127, Math.round(m.nrm[i] * 127)));
  const uq = new Uint16Array(m.uv.length);
  for (let i = 0; i < m.uv.length; i++) uq[i] = Math.max(0, Math.min(65535, Math.round(m.uv[i] * 65535)));
  const matrix = [span[0] / 65535, 0, 0, 0, 0, span[1] / 65535, 0, 0, 0, 0, span[2] / 65535, 0, min[0], min[1], min[2], 1];
  return { pos: q, nrm: nq, uv: uq, matrix, posType: 5123, nrmType: 5120, uvType: 5123, nrmNorm: true, uvNorm: true };
}
const png = png16();
const blobs = [], views = [], accessors = [], meshes = [], nodes = [{ name: 'env_fjord', children: [] }];
let offset = 0;
const align = n => { const m = (n - (offset % n)) % n; offset += m; if (m) blobs.push(Buffer.alloc(m)); };
parts.forEach((part, pi) => {
  const src = part.m;
  const packed = part.quantize ? quantizeMesh(src) : null;
  const arrays = packed
    ? [[packed.pos, 'VEC3', 5123, false], [packed.nrm, 'VEC3', 5120, true], [packed.uv, 'VEC2', 5123, true]]
    : [[Float32Array.from(src.pos), 'VEC3', 5126, false], [Float32Array.from(src.nrm), 'VEC3', 5126, false], [Float32Array.from(src.uv), 'VEC2', 5126, false]];
  const start = accessors.length;
  arrays.forEach(([arr, type, ctype, normalized]) => {
    const size = ctype === 5126 ? 4 : ctype === 5123 || ctype === 5122 ? 2 : 1;
    align(4);
    const buf = Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength);
    blobs.push(buf);
    views.push({ buffer: 0, byteOffset: offset, byteLength: buf.length, target: 34962 });
    const acc = { bufferView: views.length - 1, componentType: ctype, count: arr.length / (type === 'VEC2' ? 2 : 3), type };
    if (normalized) acc.normalized = true;
    if (type !== 'SCALAR' && ctype === 5126) {
      const n = type === 'VEC2' ? 2 : 3; const min = Array(n).fill(Infinity), max = Array(n).fill(-Infinity);
      for (let i = 0; i < arr.length; i += n) for (let k = 0; k < n; k++) { min[k] = Math.min(min[k], arr[i + k]); max[k] = Math.max(max[k], arr[i + k]); }
      acc.min = min; acc.max = max;
    }
    accessors.push(acc);
    offset += buf.length; void size;
  });
  align(2);
  const idx = Uint16Array.from(src.idx), ib = Buffer.from(idx.buffer, idx.byteOffset, idx.byteLength); blobs.push(ib);
  views.push({ buffer: 0, byteOffset: offset, byteLength: ib.length, target: 34963 });
  accessors.push({ bufferView: views.length - 1, componentType: 5123, count: idx.length, type: 'SCALAR' });
  offset += ib.length;
  meshes.push({ name: part.name, primitives: [{ attributes: { POSITION: start, NORMAL: start + 1, TEXCOORD_0: start + 2 }, indices: start + 3, material: 0 }] });
  const node = { name: part.name, mesh: pi };
  if (packed) node.matrix = packed.matrix;
  nodes.push(node); nodes[0].children.push(nodes.length - 1);
});
align(4); const imageView = views.length; blobs.push(png); views.push({ buffer: 0, byteOffset: offset, byteLength: png.length }); offset += png.length;
const json = {
  asset: { version: '2.0', generator: 'qf-env-fjord', extras: { license: 'original-procedural' } },
  extensionsUsed: ['KHR_mesh_quantization'],
  extensionsRequired: ['KHR_mesh_quantization'],
  scene: 0, scenes: [{ name: 'env_fjord', nodes: [0] }], nodes, meshes,
  materials: [{ name: 'M_FJ_palette', doubleSided: true, pbrMetallicRoughness: { baseColorTexture: { index: 0 }, metallicFactor: 0, roughnessFactor: 1 } }],
  textures: [{ sampler: 0, source: 0 }], samplers: [{ magFilter: 9728, minFilter: 9728, wrapS: 33071, wrapT: 33071 }],
  images: [{ name: 'T_FJ_palette_16', mimeType: 'image/png', bufferView: imageView }],
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
console.log(JSON.stringify({ bytes: body.length, tris, nodes: parts.map(p => p.name), png: png.length, platform: PLATFORM, quantized: parts.filter(p => p.quantize).map(p => p.name), budget: 943718 }));
if (body.length > 943718) throw Error('over subpackage budget');
if (tris > 1000 || tris < 400) throw Error('tris ' + tris + ' outside the hot-spring magnitude');
