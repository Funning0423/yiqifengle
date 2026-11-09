'use strict';
// Procedural low-poly autumn railway blockout. One 16×16 palette, no animation.
// The platform top is a single horizontal rectangle. RailSceneData seats the 7×7 on that plane.
const fs = require('node:fs'), path = require('node:path'), zlib = require('node:zlib');
const OUT = path.resolve(__dirname, '../../creator-build-project/assets/bundles/region_rail/models/env_rail.glb');
/** Exact in float32. Kept in lockstep with RailSceneData.RAIL_PLATFORM / RAIL_BOARD_INSET. */
const PLATFORM = { y: 0.5, minX: -2.5, maxX: 2.5, minZ: -2.5, maxZ: 2.5 };
const COLORS = [
  [0xE6, 0xD3, 0xB0], // 0 platform stone
  [0x4A, 0x43, 0x3A], // 1 rail iron
  [0x8B, 0x5A, 0x34], // 2 sleeper
  [0x6B, 0x3E, 0x28], // 3 trunk
  [0xD4, 0x6A, 0x2A], // 4 leaf orange
  [0xE0, 0x9A, 0x3A], // 5 leaf gold
  [0xC4, 0x48, 0x32], // 6 leaf red
  [0xF2, 0xE4, 0xC8], // 7 station wall
  [0xA3, 0x3B, 0x2B], // 8 roof
  [0x3E, 0x46, 0x50], // 9 signal post
  [0xF0, 0xB4, 0x2C], // 10 lamp amber
  [0xD6, 0x45, 0x3A], // 11 lamp red
  [0xC6, 0xA0, 0x68], // 12 ground
  [0x7E, 0x8F, 0x48], // 13 grass
  [0xC9, 0xB8, 0x96], // 14 step
  [0xA8, 0x5A, 0x28], // 15 dark leaf
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
function cone(m, cx, cy, cz, r, h, sides, color) {
  const top = [cx, cy + h, cz], ring = [];
  for (let i = 0; i < sides; i++) { const a = i / sides * Math.PI * 2; ring.push([cx + Math.cos(a) * r, cy, cz + Math.sin(a) * r]); }
  for (let i = 0; i < sides; i++) addTri(m, top, ring[(i + 1) % sides], ring[i], color);
  for (let i = 1; i < sides - 1; i++) addTri(m, ring[0], ring[i], ring[i + 1], color);
}
function tree(m, x, z, h, leaf) {
  box(m, x - 0.08, 0, z - 0.08, x + 0.08, h * 0.45, z + 0.08, 3);
  cone(m, x, h * 0.32, z, 0.55, h * 0.42, 5, leaf);
  cone(m, x, h * 0.55, z, 0.38, h * 0.4, 5, leaf === 4 ? 5 : leaf === 5 ? 6 : 4);
}
const parts = [];
function part(name, build) { const m = mesh(); build(m); parts.push({ name, m }); }
const P = PLATFORM;
part('RL_ground', m => { box(m, -8, -0.08, -8, 8, 0, 8, 12); box(m, -7.2, 0, -6.5, -3.2, 0.02, 6.5, 13); box(m, 3.2, 0, -6, 7.2, 0.02, 6, 13); });
part('RL_platform', m => { box(m, P.minX, 0, P.minZ, P.maxX, P.y, P.maxZ, 0); });
part('RL_steps', m => { box(m, -1.1, 0, 2.5, 1.1, 0.25, 3.15, 14); });
part('RL_rails', m => { box(m, -3.22, 0.08, -6.2, -3.08, 0.16, 6.2, 1); box(m, -2.78, 0.08, -6.2, -2.64, 0.16, 6.2, 1); });
part('RL_sleepers', m => { for (let z = -5.6; z <= 5.61; z += 0.8) box(m, -3.4, 0.02, z - 0.12, -2.55, 0.07, z + 0.12, 2); });
part('RL_station', m => {
  box(m, 2.62, 0, -1.05, 3.55, 1.9, 1.05, 7);
  box(m, 2.55, 1.9, -1.25, 3.72, 2.28, 1.25, 8);
  box(m, 3.15, 2.28, -0.2, 3.5, 2.85, 0.2, 8);
  box(m, 2.62, 1.15, -1.06, 2.95, 1.55, -0.5, 10);
  box(m, 2.95, 0, -0.28, 3.0, 1.05, 0.28, 2);
});
part('RL_signal', m => {
  box(m, -2.92, 0, 0.55, -2.72, 2.45, 0.75, 9);
  box(m, -3.02, 2.22, 0.46, -2.42, 2.62, 0.84, 9);
  box(m, -2.72, 2.3, 0.48, -2.52, 2.52, 0.82, 10);
  box(m, -2.5, 2.3, 0.48, -2.32, 2.52, 0.82, 11);
});
part('RL_trees', m => {
  const spots = [[-1.15, -4.2, 3.3, 4], [1.35, -4.5, 2.8, 5], [-4.3, -2.4, 2.4, 6], [3.4, -3.4, 3.1, 15], [-3.8, 2.6, 2.5, 4], [3.8, 2.4, 2.6, 5], [-4.4, 1.5, 2.1, 6]];
  for (const [x, z, h, leaf] of spots) tree(m, x, z, h, leaf);
});
part('RL_leaves', m => {
  const bits = [[-4.8, 1.2, 0.22, 4], [-3.2, 4.1, 0.16, 5], [3.4, 3.6, 0.2, 6], [5.1, -2.2, 0.18, 15], [-5.5, -2.4, 0.2, 4], [1.6, -3.6, 0.15, 5]];
  for (const [x, z, s, c] of bits) addQuad(m, [x, 0.03, z], [x + s, 0.04, z + 0.04], [x + s * 0.8, 0.03, z + s], [x - 0.02, 0.025, z + s * 0.7], c);
});
const png = png16();
const blobs = [], views = [], accessors = [], meshes = [], nodes = [{ name: 'env_rail', children: [] }];
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
  asset: { version: '2.0', generator: 'qf-env-rail', extras: { license: 'original-procedural' } },
  scene: 0, scenes: [{ name: 'env_rail', nodes: [0] }], nodes, meshes,
  materials: [{ name: 'M_RL_palette', doubleSided: true, pbrMetallicRoughness: { baseColorTexture: { index: 0 }, metallicFactor: 0, roughnessFactor: 1 } }],
  textures: [{ sampler: 0, source: 0 }], samplers: [{ magFilter: 9728, minFilter: 9728, wrapS: 33071, wrapT: 33071 }],
  images: [{ name: 'T_RL_palette_16', mimeType: 'image/png', bufferView: imageView }],
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
