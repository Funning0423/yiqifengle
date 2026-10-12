import { Node, Scene, MeshRenderer, Material, Mesh, Vec3, Vec4, Quat, EffectAsset, utils, gfx, isValid } from 'cc';
import { approachNight, pickNight } from './IslandAtmosphereFxCore';
import { SHORE, farSeaPoint, farShoreGeometry, farWashAlpha, foamMultiply, seaAlbedoColors, seaHeight, seaUvShift, shorePhase, shoreWashGeometry, stepShoreClock, waveLinePose } from './ShoreBreakCore';
import type { SeaPhase, ShoreGeometry, V3 } from './ShoreBreakCore';
import * as PropsLayout from '../world-r2/IslandPropsLayout';
/** Same env_sea_surface, heaving on AmbienceAudio.wavePlayhead (amb_waves_loop, 8.064 s).
 * Daytime blue is COLOR_0 (RGB), not mainColor. The dynamic copy keeps that colour (alpha 1) and keeps
 * normals facing up (ny = 1 before normalize). A mesh without a_color is left authored — the standard
 * shader would multiply albedo by 0 and the sea would draw black — and only the node bobs / UVs scroll.
 * The white lip is one untextured sheet under scene-root 'ShoreBreak'. It only exists while the crest is on
 * the sand, then it runs back and the node hides. Night is foamMultiply on that lip. The sea material's
 * mainColor is never written here (IslandProps still tints this same sea). No second sea, no second night mesh.
 * Beach lip follows the exterior layer; the far lip follows the backdrop (rear window). Authored wave-line
 * rings stay sunk under the sea so the 12 s idle clip cannot leave a white ring between beats. */
type Fx = { node: Node; material: Material; applied: string };
type Line = { node: Node; x: number; y: number; z: number; sx: number; sy: number; sz: number; rot: Quat };
type SeaBind = {
  renderer: MeshRenderer; authored: Mesh; dynamic: Mesh; count: number;
  base: Float32Array; pos: Float32Array; nrm: Float32Array; baseUv: Float32Array; uv: Float32Array;
  colors: Float32Array | null; idx16: Uint16Array | null; idx32: Uint32Array | null; min: Vec3; max: Vec3;
};
type SeaScroll = { instance: Material; offset: Vec4; baseZ: number; baseW: number };
type SeaNode = { node: Node; x: number; y: number; z: number };
const TECH_ALPHA_BLEND = 3;
function findNamed(root: Node, name: string): Node | null {
  if (root.name === name) return root;
  const kids = root.children;
  for (let i = 0; i < kids.length; i++) { const hit = findNamed(kids[i], name); if (hit) return hit; }
  return null;
}
function copyFloats(src: ArrayLike<number>): Float32Array {
  const out = new Float32Array(src.length);
  for (let i = 0; i < src.length; i++) out[i] = src[i];
  return out;
}
export class ShoreBreak {
  private root: Node | null = null; private meshes: Mesh[] = []; private materials: Material[] = [];
  private wash: Fx | null = null; private far: Fx | null = null; private line01: Line | null = null; private line02: Line | null = null;
  private washPos: Float32Array | null = null; private washCol: Float32Array | null = null; private washIdx: Uint16Array | null = null;
  private washMin = new Vec3(); private washMax = new Vec3(); private washCount = 0;
  private sea: SeaBind | null = null; private seaScroll: SeaScroll | null = null; private seaNode: SeaNode | null = null;
  private exterior = false; private backdrop = false; private night = false; private synced = false; private time = 0; private ownNight = 0; private nightShown = 0;
  private disposed = false;
  private last = { strength: 0, travel: 0, foamU: 0, foamA: 0, wash: 0, far: 0, sea: 0, lineY: [] as number[] };
  constructor(scene: Scene, model: Node | null) {
    if (!EffectAsset.get('builtin-unlit')) { console.warn('[SHORE] builtin-unlit unavailable; shore wash skipped'); return; }
    const root = new Node('ShoreBreak'); scene.addChild(root); this.root = root;
    const lip = shoreWashGeometry(1, 0);
    this.washCount = lip.positions.length / 3;
    this.washPos = new Float32Array(lip.positions.length); this.washCol = new Float32Array(lip.colors.length);
    this.washIdx = new Uint16Array(lip.indices.length);
    for (let i = 0; i < lip.positions.length; i++) this.washPos[i] = lip.positions[i];
    for (let i = 0; i < lip.colors.length; i++) this.washCol[i] = lip.colors[i];
    for (let i = 0; i < lip.indices.length; i++) this.washIdx[i] = lip.indices[i];
    this.washMin.set(lip.min[0], lip.min[1], lip.min[2]); this.washMax.set(lip.max[0], lip.max[1], lip.max[2]);
    this.wash = this.fx(root, 'fx_shore_wash', this.dynamicWash());
    this.far = this.fx(root, 'fx_shore_far', this.mesh(farShoreGeometry()));
    if (model) {
      this.bindSea(model);
      this.line01 = this.bindLine(model, 'env_sea_wave_line_01_v22');
      this.line02 = this.bindLine(model, 'env_sea_wave_line_02_v22');
    }
    root.active = false;
  }
  private mesh(g: ShoreGeometry): Mesh {
    const m = utils.createMesh({ positions: g.positions, colors: g.colors, indices: g.indices,
      minPos: new Vec3(g.min[0], g.min[1], g.min[2]), maxPos: new Vec3(g.max[0], g.max[1], g.max[2]) });
    this.meshes.push(m); return m;
  }
  private dynamicWash(): Mesh {
    const create = (utils as any).MeshUtils && (utils as any).MeshUtils.createDynamicMesh;
    const pos = this.washPos!, col = this.washCol!, idx = this.washIdx!;
    if (typeof create !== 'function') {
      const m = utils.createMesh({ positions: pos, colors: col, indices: idx, minPos: this.washMin, maxPos: this.washMax });
      this.meshes.push(m); return m;
    }
    const m = create(0, { positions: pos, colors: col, indices16: idx, minPos: this.washMin, maxPos: this.washMax }, undefined, {
      maxSubMeshes: 1, maxSubMeshVertices: this.washCount + 4, maxSubMeshIndices: idx.length + 6,
    }) as Mesh;
    this.meshes.push(m); return m;
  }
  private fx(parent: Node, name: string, mesh: Mesh): Fx {
    const material = new Material(); this.materials.push(material);
    material.initialize({ effectName: 'builtin-unlit', technique: TECH_ALPHA_BLEND, defines: { USE_VERTEX_COLOR: true } });
    material.setProperty('mainColor', new Vec4(1, 1, 1, 0));
    const node = new Node(name); parent.addChild(node); node.active = false;
    const mr = node.addComponent(MeshRenderer); mr.mesh = mesh; mr.setMaterial(material, 0);
    mr.shadowCastingMode = MeshRenderer.ShadowCastingMode.OFF; mr.receiveShadow = MeshRenderer.ShadowReceivingMode.OFF;
    return { node: node, material: material, applied: '' };
  }
  private bindLine(model: Node, name: string): Line | null {
    const node = findNamed(model, name);
    if (!node) { console.warn('[SHORE] wave line missing', name); return null; }
    const p = node.position, s = node.scale;
    return { node: node, x: p.x, y: p.y, z: p.z, sx: s.x, sy: s.y, sz: s.z, rot: node.rotation.clone() };
  }
  /** Read the imported sea once. Swap in a dynamic copy only when its vertex colour (the daytime blue) can be kept.
   * Material (night tint included) stays. mainColor is never written. */
  private bindSea(model: Node): void {
    const node = findNamed(model, 'env_sea_surface');
    if (!node) { console.warn('[SHORE] sea surface missing'); return; }
    const p = node.position;
    this.seaNode = { node: node, x: p.x, y: p.y, z: p.z };
    const mr = node.getComponent(MeshRenderer);
    if (!mr) return;
    try { this.bindSeaMesh(mr); } catch (e) { console.warn('[SHORE] sea mesh bind failed; node bob and UV scroll only', String(e)); this.bindSeaScroll(mr); }
  }
  private bindSeaMesh(mr: MeshRenderer): void {
    const mesh = mr.mesh;
    if (!mesh || typeof (mesh as any).readAttribute !== 'function') { this.bindSeaScroll(mr); return; }
    const pos = mesh.readAttribute(0, gfx.AttributeName.ATTR_POSITION) as Float32Array | null;
    const nrm = mesh.readAttribute(0, gfx.AttributeName.ATTR_NORMAL) as Float32Array | null;
    const uv = mesh.readAttribute(0, gfx.AttributeName.ATTR_TEX_COORD) as Float32Array | null;
    const rawIdx = typeof mesh.readIndices === 'function' ? mesh.readIndices(0) : null;
    if (!pos || !nrm || !uv || !rawIdx || pos.length < 9 || nrm.length !== pos.length || uv.length < pos.length / 3 * 2) {
      console.warn('[SHORE] sea mesh not readable; UV scroll only'); this.bindSeaScroll(mr); return;
    }
    const count = pos.length / 3;
    let idx16: Uint16Array | null = null, idx32: Uint32Array | null = null;
    if (rawIdx instanceof Uint32Array) idx32 = new Uint32Array(rawIdx);
    else { idx16 = new Uint16Array(rawIdx.length); for (let i = 0; i < rawIdx.length; i++) idx16[i] = rawIdx[i]; }
    const rawColor = mesh.readAttribute(0, gfx.AttributeName.ATTR_COLOR) as ArrayLike<number> | null;
    const bpe = rawColor && typeof (rawColor as any).BYTES_PER_ELEMENT === 'number' ? (rawColor as any).BYTES_PER_ELEMENT : 4;
    const colors = seaAlbedoColors(rawColor, count, bpe);
    if (!colors) { console.warn('[SHORE] sea vertex color missing; mesh left authored so the blue stays lit'); this.bindSeaScroll(mr); return; }
    const base = copyFloats(pos), baseUv = copyFloats(uv);
    let minX = 1e9, minZ = 1e9, maxX = -1e9, maxZ = -1e9;
    for (let i = 0; i < count; i++) {
      const x = base[i * 3], z = base[i * 3 + 2];
      if (x < minX) minX = x; if (z < minZ) minZ = z; if (x > maxX) maxX = x; if (z > maxZ) maxZ = z;
    }
    const min = new Vec3(minX, -0.7, minZ), max = new Vec3(maxX, 0.7, maxZ);
    const create = (utils as any).MeshUtils && (utils as any).MeshUtils.createDynamicMesh;
    if (typeof create !== 'function') { console.warn('[SHORE] createDynamicMesh missing; UV scroll only'); this.bindSeaScroll(mr); return; }
    const geo: any = { positions: copyFloats(base), normals: copyFloats(nrm), uvs: copyFloats(baseUv), colors: colors, minPos: min, maxPos: max };
    if (idx16) geo.indices16 = idx16; else geo.indices32 = idx32;
    const indexCount = idx16 ? idx16.length : (idx32 ? idx32.length : 0);
    const dynamic = create(0, geo, undefined, { maxSubMeshes: 1, maxSubMeshVertices: count + 8, maxSubMeshIndices: indexCount + 8 }) as Mesh;
    this.meshes.push(dynamic);
    mr.mesh = dynamic;
    this.sea = { renderer: mr, authored: mesh, dynamic: dynamic, count: count, base: base, pos: geo.positions, nrm: geo.normals, baseUv: baseUv, uv: geo.uvs, colors: colors, idx16: idx16, idx32: idx32, min: min, max: max };
  }
  /** Visible wavelet drift when the vertex buffer cannot be read. Does not touch mainColor. */
  private bindSeaScroll(renderer: MeshRenderer): void {
    try {
      const instance = renderer.getMaterialInstance(0);
      if (!instance) return;
      const cur = instance.getProperty('tilingOffset') as Vec4 | null;
      const baseZ = cur && Number.isFinite(cur.z) ? cur.z : 0;
      const baseW = cur && Number.isFinite(cur.w) ? cur.w : 0;
      this.seaScroll = { instance: instance, offset: new Vec4(cur ? cur.x : 1, cur ? cur.y : 1, baseZ, baseW), baseZ: baseZ, baseW: baseW };
    } catch (e) { console.warn('[SHORE] sea UV scroll unavailable', String(e)); }
  }
  /** exterior: beach lip. backdrop: sea motion + far horizon (rear window). night: target of the 0.5 s multiply. */
  setView(exterior: boolean, backdrop: boolean, night: boolean): void {
    this.exterior = exterior; this.backdrop = backdrop; this.night = night;
    if (!exterior && !backdrop) this.hideAll();
  }
  /** lateUpdate, after the idle clip and RoomLightingRig have written. */
  advance(dt: number): void {
    const root = this.root; if (this.disposed || !root || !isValid(root, true)) return;
    const step = Number.isFinite(dt) && dt > 0 ? Math.min(dt, 0.1) : 0;
    this.ownNight = this.synced ? approachNight(this.ownNight, this.night, step) : (this.night ? 1 : 0); this.synced = true;
    let shared: unknown = null;
    try { const f = (PropsLayout as any).propNightWeight; shared = typeof f === 'function' ? f() : null; } catch (e) { shared = null; }
    this.nightShown = pickNight(this.ownNight, shared);
    this.time = stepShoreClock(this.time, dt, this.playhead());
    const phase = shorePhase(this.time), rgb = foamMultiply(this.nightShown);
    this.last.strength = phase.strength; this.last.travel = phase.travel; this.last.foamU = phase.foamU; this.last.foamA = phase.foamA;
    if (this.backdrop || this.exterior) {
      if (this.sea) this.displaceSea(this.time, phase); else this.heaveSea(this.time, phase);
      this.scrollSea(this.time);
    }
    const showWash = this.exterior && phase.foamA > 1 / 255;
    if (showWash) this.moveWash(phase.foamU, this.time);
    this.last.wash = showWash ? phase.foamA * SHORE.shorePeak : 0;
    this.place(this.wash, rgb, this.last.wash);
    const farA = this.backdrop ? farWashAlpha(phase.foamA) : 0;
    this.last.far = farA > 1 / 255 ? farA : 0;
    if (this.last.far > 0) this.moveFar(this.time, phase);
    this.place(this.far, rgb, this.last.far);
    const any = this.last.wash > 0 || this.last.far > 0;
    if (root.active !== any) root.active = any;
    this.last.lineY = [];
    this.holdLine(this.line01); this.holdLine(this.line02);
  }
  private playhead(): number | null {
    try {
      const wi = (globalThis as any).__worldIntegration, f = wi && wi.wavePlayhead;
      if (typeof f !== 'function') return null;
      const v = f(); return typeof v === 'number' && Number.isFinite(v) ? v : null;
    } catch (e) { return null; }
  }
  private displaceSea(time: number, phase: SeaPhase): void {
    const s = this.sea; if (!s || !isValid(s.renderer, true)) return;
    const shift = seaUvShift(time);
    const base = s.base, pos = s.pos, nrm = s.nrm, uv = s.uv, buv = s.baseUv;
    let minY = 1e9, maxY = -1e9, sample = 0;
    for (let i = 0; i < s.count; i++) {
      const x = base[i * 3], z = base[i * 3 + 2];
      const h = seaHeight(x, z, time, phase);
      pos[i * 3] = x; pos[i * 3 + 1] = h; pos[i * 3 + 2] = z;
      if (h < minY) minY = h; if (h > maxY) maxY = h;
      if (i === 0) sample = h;
      const hx = seaHeight(x + 0.45, z, time, phase) - seaHeight(x - 0.45, z, time, phase);
      const hz = seaHeight(x, z + 0.45, time, phase) - seaHeight(x, z - 0.45, time, phase);
      // ny is 1 before normalize, so the lit side stays up. A downward normal is an unlit black face.
      const nx = -hx / 0.9, ny = 1, nz = -hz / 0.9;
      const inv = 1 / Math.sqrt(nx * nx + ny * ny + nz * nz);
      nrm[i * 3] = nx * inv; nrm[i * 3 + 1] = ny * inv; nrm[i * 3 + 2] = nz * inv;
      uv[i * 2] = buv[i * 2] + shift.u; uv[i * 2 + 1] = buv[i * 2 + 1] + shift.v;
    }
    this.last.sea = sample;
    s.min.y = minY - 0.05; s.max.y = maxY + 0.05;
    const geo: any = { positions: pos, normals: nrm, uvs: uv, colors: s.colors, minPos: s.min, maxPos: s.max };
    if (s.idx16) geo.indices16 = s.idx16; else geo.indices32 = s.idx32;
    s.dynamic.updateSubMesh(0, geo);
  }
  /** Whole-sheet bob when the authored mesh must stay (no vertex colours to copy). Same clock as the swell. */
  private heaveSea(time: number, phase: SeaPhase): void {
    const n = this.seaNode; if (!n || !isValid(n.node, true)) return;
    const h = seaHeight(0, 40, time, phase);
    n.node.setPosition(n.x, n.y + h, n.z);
    this.last.sea = h;
  }
  private scrollSea(time: number): void {
    const s = this.seaScroll; if (!s || !isValid(s.instance, true)) return;
    const shift = seaUvShift(time);
    s.offset.z = s.baseZ + shift.u; s.offset.w = s.baseW + shift.v;
    s.instance.setProperty('tilingOffset', s.offset);
  }
  private moveWash(u: number, time: number): void {
    const pos = this.washPos, col = this.washCol, idx = this.washIdx, fx = this.wash;
    if (!pos || !col || !idx || !fx || !isValid(fx.node, true)) return;
    const g = shoreWashGeometry(u, time);
    if (g.positions.length !== pos.length || g.colors.length !== col.length || g.indices.length !== idx.length) return;
    for (let i = 0; i < pos.length; i++) pos[i] = g.positions[i];
    for (let i = 0; i < col.length; i++) col[i] = g.colors[i];
    this.washMin.set(g.min[0], g.min[1], g.min[2]); this.washMax.set(g.max[0], g.max[1], g.max[2]);
    const mesh = fx.node.getComponent(MeshRenderer)!.mesh as any;
    if (mesh && mesh.struct && mesh.struct.dynamic && typeof mesh.updateSubMesh === 'function') {
      mesh.updateSubMesh(0, { positions: pos, colors: col, indices16: idx, minPos: this.washMin, maxPos: this.washMax });
    } else if (mesh) {
      utils.createMesh({ positions: g.positions, colors: g.colors, indices: g.indices, minPos: this.washMin, maxPos: this.washMax }, mesh);
    }
  }
  private moveFar(time: number, phase: SeaPhase): void {
    const fx = this.far; if (!fx || !isValid(fx.node, true)) return;
    const p = farSeaPoint();
    const h = seaHeight(p[0], p[2], time, phase);
    fx.node.setPosition(0, h, 0);
  }
  private place(fx: Fx | null, rgb: V3, alpha: number): void {
    if (!fx || !isValid(fx.node, true)) return;
    const visible = alpha > 1 / 255; if (fx.node.active !== visible) fx.node.active = visible; if (!visible) return;
    const key = rgb[0].toFixed(3) + ',' + rgb[1].toFixed(3) + ',' + rgb[2].toFixed(3) + ',' + alpha.toFixed(3);
    if (key !== fx.applied) { fx.material.setProperty('mainColor', new Vec4(rgb[0], rgb[1], rgb[2], alpha)); fx.applied = key; }
  }
  /** Keep the authored rings under the sea. The 12 s clip must not lift a white ring between beats. */
  private holdLine(line: Line | null): void {
    if (!line || !isValid(line.node, true)) return;
    const pose = waveLinePose();
    line.node.setRotation(line.rot);
    line.node.setPosition(line.x, pose.y, line.z);
    line.node.setScale(line.sx * pose.scale, line.sy, line.sz * pose.scale);
    this.last.lineY.push(pose.y);
  }
  private hideAll(): void {
    const all: (Fx | null)[] = [this.wash, this.far];
    for (let i = 0; i < all.length; i++) { const f = all[i]; if (f && isValid(f.node, true)) f.node.active = false; }
    if (this.root && isValid(this.root, true)) this.root.active = false;
  }
  diagnostics() {
    return { time: this.time, exterior: this.exterior, backdrop: this.backdrop, nightShown: this.nightShown, strength: this.last.strength, travel: this.last.travel, foamU: this.last.foamU, foamA: this.last.foamA, washAlpha: this.last.wash, farAlpha: this.last.far, seaSample: this.last.sea, lineY: this.last.lineY.slice(), ownNight: this.ownNight, seaBound: !!this.sea, seaScroll: !!this.seaScroll };
  }
  dispose(): void {
    if (this.disposed) return; this.disposed = true;
    this.restoreSea();
    this.restoreSeaNode();
    this.restore(this.line01); this.restore(this.line02); this.line01 = this.line02 = null;
    if (this.root && isValid(this.root, true)) this.root.destroy();
    for (let i = 0; i < this.materials.length; i++) this.materials[i].destroy();
    for (let i = 0; i < this.meshes.length; i++) this.meshes[i].destroy();
    this.root = null; this.wash = null; this.far = null; this.materials = []; this.meshes = []; this.sea = null; this.seaScroll = null; this.seaNode = null;
  }
  private restoreSea(): void {
    const s = this.sea; if (!s) return;
    if (isValid(s.renderer, true) && isValid(s.renderer.node, true) && isValid(s.authored, true)) s.renderer.mesh = s.authored;
  }
  private restoreSeaNode(): void {
    const n = this.seaNode; if (!n || !isValid(n.node, true)) return;
    n.node.setPosition(n.x, n.y, n.z);
  }
  private restore(line: Line | null): void {
    if (!line || !isValid(line.node, true)) return;
    line.node.setRotation(line.rot);
    line.node.setPosition(line.x, line.y, line.z);
    line.node.setScale(line.sx, line.sy, line.sz);
  }
}
