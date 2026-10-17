/**
 * v3.3 (GGbot): engine-independent half of the lakeside static merge (no 'cc'; unit-tested in Node).
 * Why: with GPU instancing the lakeside background still costs one draw call per GLB kind (~36 on the Mac, 79 total with board+UI).
 * 45 of the 48 lakeside GLBs import the same palette material (T_LK_palette_256, roughness 0.8, double-sided), so after the
 * instances are placed, every static instance that shares a material (by content, not by object) and a vertex layout is baked into
 * one world-space mesh (split at 65,535 vertices for 16-bit indices). Nothing in the lakeside scene moves at runtime (GLB
 * animations: 0; Animation components are disabled by the lease), so this is lossless for the picture.
 */
export type LakesideAttr = 'position' | 'normal' | 'uv' | 'color';
/** gfx.FormatType numbering (3.8.8 gfx/base/define.ts): NONE 0, UNORM 1, SNORM 2, UINT 3, INT 4, UFLOAT 5, FLOAT 6. */
export const FMT = Object.freeze({ UNORM: 1, SNORM: 2, UINT: 3, INT: 4, UFLOAT: 5, FLOAT: 6 });
export type LakesideFormat = Readonly<{ type: number; size: number; count: number }>;
/** IEEE half -> float (quantized meshes keep RGB16F/RG16F when the device can read half vertex attributes). */
export function halfToFloat(h: number): number {
  const s = (h & 0x8000) ? -1 : 1, e = (h >> 10) & 0x1f, m = h & 0x3ff;
  if (e === 0) return s * m * Math.pow(2, -24);
  if (e === 31) return m ? NaN : s * Infinity;
  return s * (1 + m / 1024) * Math.pow(2, e - 15);
}
/** Mesh.readAttribute() returns the RAW storage of an attribute (half floats as Uint16, normalized ints as ints). Converts it to
 *  plain floats; normalized integer formats are scaled to 0..1 / -1..1 (colours stay 0..1 here). */
export function lakesideAttrToFloat(raw: ArrayLike<number>, f: LakesideFormat, normalized: boolean): number[] {
  const bytes = f.size / f.count, out = new Array<number>(raw.length);
  if (f.type === FMT.FLOAT || f.type === FMT.UFLOAT) { for (let i = 0; i < raw.length; i++) out[i] = bytes === 2 ? halfToFloat(raw[i]) : raw[i]; return out; }
  const signed = f.type === FMT.SNORM || f.type === FMT.INT, max = signed ? Math.pow(2, bytes * 8 - 1) - 1 : Math.pow(2, bytes * 8) - 1;
  const norm = normalized || f.type === FMT.UNORM || f.type === FMT.SNORM;
  for (let i = 0; i < raw.length; i++) out[i] = norm ? Math.max(-1, raw[i] / max) : raw[i];
  return out;
}
/** Content key of a material: two GLBs whose imported materials have the same effect, technique, defines, textures, uniforms and
 *  states draw identically, so they can share one merged mesh. Blended materials are never merged (sorting). */
export type LakesideMaterialFacts = Readonly<{ effect: string; technique: number; defines: Record<string, unknown>; props: Record<string, unknown>; cull: number; blend: boolean; priority: number }>;
export function lakesideMaterialKey(m: LakesideMaterialFacts): string {
  const defs = Object.keys(m.defines || {}).filter(k => k !== 'USE_INSTANCING').sort().map(k => k + '=' + String(m.defines[k]));
  const props = Object.keys(m.props || {}).sort().map(k => k + '=' + JSON.stringify(m.props[k]));
  return [m.effect, m.technique, defs.join(','), props.join(','), 'cull' + m.cull, m.blend ? 'blend' : 'opaque', 'p' + m.priority].join('|');
}
export type LakesidePiece = Readonly<{ group: string; vertices: number; indices: number }>;
/** Groups pieces by key and packs them into chunks of at most `maxVertices` vertices (16-bit indices). Order is stable. */
export function lakesideMergePlan(pieces: readonly LakesidePiece[], maxVertices = 65535): Array<{ group: string; pieces: number[]; vertices: number; indices: number }> {
  const out: Array<{ group: string; pieces: number[]; vertices: number; indices: number }> = [], open = new Map<string, { group: string; pieces: number[]; vertices: number; indices: number }>();
  pieces.forEach((p, i) => {
    if (!(p.vertices > 0) || p.vertices > maxVertices) return; // empty or oversized pieces stay unmerged
    let c = open.get(p.group);
    if (!c || c.vertices + p.vertices > maxVertices) { c = { group: p.group, pieces: [], vertices: 0, indices: 0 }; open.set(p.group, c); out.push(c); }
    c.pieces.push(i); c.vertices += p.vertices; c.indices += p.indices;
  });
  return out;
}
/** Appends one placed piece in world space. m = column-major 4x4 (Cocos Mat4 m00..m15) of the piece relative to the merged node.
 *  Normals use the inverse-transpose of the upper 3x3 (non-uniform scales in the r5h3 export) and are renormalised. */
export function lakesideAppendPiece(dst: { positions: number[]; normals: number[]; uvs: number[]; colors: number[]; indices: number[]; vertices: number },
  src: { positions: number[]; normals?: number[] | null; uvs?: number[] | null; colors?: number[] | null; indices: ArrayLike<number> }, m: ArrayLike<number>, layout: Readonly<Record<LakesideAttr, boolean>>): void {
  const n = src.positions.length / 3, base = dst.vertices;
  const a00 = m[0], a01 = m[1], a02 = m[2], a10 = m[4], a11 = m[5], a12 = m[6], a20 = m[8], a21 = m[9], a22 = m[10];
  // inverse-transpose of the 3x3 via cofactors (determinant sign kept so mirrored placements keep outward normals)
  const c00 = a11 * a22 - a12 * a21, c01 = a12 * a20 - a10 * a22, c02 = a10 * a21 - a11 * a20;
  const c10 = a02 * a21 - a01 * a22, c11 = a00 * a22 - a02 * a20, c12 = a01 * a20 - a00 * a21;
  const c20 = a01 * a12 - a02 * a11, c21 = a02 * a10 - a00 * a12, c22 = a00 * a11 - a01 * a10;
  const det = a00 * c00 + a01 * c01 + a02 * c02, sg = det < 0 ? -1 : 1;
  for (let i = 0; i < n; i++) {
    const x = src.positions[i * 3], y = src.positions[i * 3 + 1], z = src.positions[i * 3 + 2];
    dst.positions.push(m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]);
    if (layout.normal) {
      const nx = src.normals ? src.normals[i * 3] : 0, ny = src.normals ? src.normals[i * 3 + 1] : 1, nz = src.normals ? src.normals[i * 3 + 2] : 0;
      let ox = (c00 * nx + c10 * ny + c20 * nz) * sg, oy = (c01 * nx + c11 * ny + c21 * nz) * sg, oz = (c02 * nx + c12 * ny + c22 * nz) * sg;
      const l = Math.hypot(ox, oy, oz) || 1; ox /= l; oy /= l; oz /= l; dst.normals.push(ox, oy, oz);
    }
    if (layout.uv) dst.uvs.push(src.uvs ? src.uvs[i * 2] : 0, src.uvs ? src.uvs[i * 2 + 1] : 0);
    if (layout.color) for (let k = 0; k < 4; k++) dst.colors.push(src.colors ? src.colors[i * 4 + k] : 1);
  }
  for (let i = 0; i < src.indices.length; i++) dst.indices.push(src.indices[i] + base);
  dst.vertices += n;
}
/** v3.3 switch: static merge on by default; web builds can compare once per lakeside load with ?lakemerge=off (WeChat: constant). */
export function lakesideStaticMergeEnabled(search?: string | null): boolean { return !/[?&]lakemerge=(off|0|false)\b/.test(search || ''); }
export function lakesideStaticMergeFromEnv(): boolean {
  let q: string | null = null;
  try { const w: any = typeof window !== 'undefined' ? window : null; q = w && w.location && typeof w.location.search === 'string' ? w.location.search : null; } catch { q = null; }
  return lakesideStaticMergeEnabled(q);
}
