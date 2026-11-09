'use strict';
// Procedural low-poly dawn cloud-sea blockout. One 16×16 palette, no animation.
// The stone terrace top is a single horizontal rectangle. CloudseaSceneData seats the 7×7 on that plane.
const fs = require('node:fs'), path = require('node:path'), zlib = require('node:zlib');
const OUT = path.resolve(__dirname, '../../creator-build-project/assets/bundles/region_cloudsea/models/env_cloudsea.glb');
/** Exact in float32. Kept in lockstep with CloudseaSceneData.CLOUDSEA_PLATFORM / CLOUDSEA_BOARD_INSET. */
const PLATFORM = { y: 0.5, minX: -2.5, maxX: 2.5, minZ: -2.5, maxZ: 2.5 };
const COLORS = [
  [0xE8, 0xD5, 0xC4], // 0 terrace stone
  [0xC4, 0xA0, 0x6A], // 1 plank
  [0x8B, 0x5E, 0x3C], // 2 dark wood
  [0xF7, 0xF1, 0xEA], // 3 cloud white
  [0xF6, 0xD0, 0xC4], // 4 cloud blush
  [0xE4, 0xD4, 0xE8], // 5 cloud lilac
  [0xD4, 0xC4, 0xC0], // 6 cloud shadow
  [0xF6, 0xC5, 0x6B], // 7 dawn gold
  [0xF4, 0xA1, 0x5A], // 8 sun
  [0x4A, 0x3F, 0x45], // 9 bird
  [0xE0, 0x7A, 0x72], // 10 flag
  [0xF8, 0xE6, 0xD0], // 11 flag pale
  [0x6B, 0x56, 0x48], // 12 pole
  [0xC9, 0xD6, 0xE0], // 13 mist
  [0xE8, 0xC8, 0xB8], // 14 far cloud
  [0xB7, 0xA8, 0x98], // 15 stone shadow
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
function discZ(m, cx, cy, cz, r, n, color) {
  const c = [cx, cy, cz], ring = [];
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; ring.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r, cz]); }
  for (let i = 0; i < n; i++) addTri(m, c, ring[i], ring[(i + 1) % n], color);
}
function bird(m, x, y, z, s) {
  addTri(m, [x - s, y, z], [x, y + s * 0.22, z + s * 0.7], [x - s * 0.08, y + 0.04, z - s * 0.25], 9);
  addTri(m, [x + s, y, z], [x + s * 0.08, y + 0.04, z - s * 0.25], [x, y + s * 0.22, z + s * 0.7], 9);
}
function flag(m, x, y0, z, h, flip, span) {
  const dir = flip ? -1 : 1, reach = span || 0.85;
  box(m, x - 0.05, y0, z - 0.05, x + 0.05, y0 + h, z + 0.05, 12);
  const top = y0 + h - 0.05, bot = y0 + h - 0.62, mid = reach * 0.55;
  addQuad(m, [x, top, z], [x + dir * mid, top - 0.08, z + 0.06], [x + dir * mid, bot + 0.04, z + 0.03], [x, bot + 0.06, z], 10);
  addQuad(m, [x + dir * mid, top - 0.08, z + 0.06], [x + dir * reach, top - 0.18, z - 0.03], [x + dir * reach, bot - 0.08, z], [x + dir * mid, bot + 0.04, z + 0.03], 11);
}
const parts = [];
function part(name, build) { const m = mesh(); build(m); parts.push({ name, m }); }
const P = PLATFORM;
part('CS_platform', m => { box(m, P.minX, 0.18, P.minZ, P.maxX, P.y, P.maxZ, 0); box(m, P.minX + 0.18, 0.08, P.minZ + 0.18, P.maxX - 0.18, 0.18, P.maxZ - 0.18, 15); });
part('CS_clouds', m => {
  box(m, -8.2, -0.55, -7.4, 8.2, -0.08, 7.2, 6);
  box(m, -6.4, -0.08, -5.6, -2.7, 0.22, -2.6, 3);
  box(m, 2.7, -0.06, -5.4, 6.8, 0.2, -2.7, 3);
  box(m, -5.6, 0.02, 2.55, -2.6, 0.38, 5.6, 4);
  box(m, 2.6, 0.0, 2.55, 5.4, 0.4, 5.8, 4);
  box(m, -6.6, 0.02, -6.2, -3.4, 0.78, -3.4, 14);
  box(m, -1.6, 0.08, -6.6, 0.8, 0.7, -3.6, 7);
  box(m, 2.4, 0.04, -6.2, 5.2, 0.62, -3.5, 5);
  box(m, -7.4, 0.0, -1.6, -3.2, 0.58, 2.2, 4);
  box(m, 3.3, 0.0, -1.8, 7.0, 0.5, 1.4, 5);
  box(m, -1.6, 0.06, 4.6, 1.8, 0.32, 6.8, 13);
  box(m, -3.4, 0.04, 3.2, -2.3, 0.46, 4.6, 6);
});
part('CS_walk', m => {
  for (let i = 0; i < 4; i++) {
    const z0 = 2.58 + i * 0.48;
    box(m, -0.72, 0.26, z0, 0.72, 0.4, z0 + 0.38, i % 2 ? 2 : 1);
  }
  box(m, -0.55, 0.02, 2.7, -0.4, 0.26, 2.84, 2);
  box(m, 0.4, 0.0, 4.15, 0.55, 0.26, 4.29, 2);
});
part('CS_pads', m => {
  box(m, 2.55, 0.14, -0.7, 2.92, 0.4, 0.7, 0);
  box(m, 2.6, 0.02, -0.5, 2.86, 0.14, 0.5, 15);
  box(m, -2.92, 0.1, -0.7, -2.55, 0.36, 0.7, 0);
});
part('CS_flags', m => {
  flag(m, -0.42, 0.4, 3.05, 1.15, true, 0.55);
  flag(m, -2.68, 0.36, 0.05, 1.2, true, 0.22);
  flag(m, 2.68, 0.4, -0.05, 1.15, false, 0.22);
});
part('CS_birds', m => {
  bird(m, -1.7, 2.45, -3.15, 0.42);
  bird(m, 1.85, 2.7, -3.55, 0.34);
  bird(m, 0.15, 3.05, -4.55, 0.28);
});
part('CS_sun', m => { discZ(m, 1.35, 2.55, -6.7, 0.72, 8, 8); discZ(m, 1.35, 2.55, -6.62, 0.38, 6, 7); });
const png = png16();
const blobs = [], views = [], accessors = [], meshes = [], nodes = [{ name: 'env_cloudsea', children: [] }];
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
  asset: { version: '2.0', generator: 'qf-env-cloudsea', extras: { license: 'original-procedural' } },
  scene: 0, scenes: [{ name: 'env_cloudsea', nodes: [0] }], nodes, meshes,
  materials: [{ name: 'M_CS_palette', doubleSided: true, pbrMetallicRoughness: { baseColorTexture: { index: 0 }, metallicFactor: 0, roughnessFactor: 1 } }],
  textures: [{ sampler: 0, source: 0 }], samplers: [{ magFilter: 9728, minFilter: 9728, wrapS: 33071, wrapT: 33071 }],
  images: [{ name: 'T_CS_palette_16', mimeType: 'image/png', bufferView: imageView }],
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
