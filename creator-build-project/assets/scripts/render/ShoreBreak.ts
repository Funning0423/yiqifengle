import { Node, Scene, MeshRenderer, Material, Mesh, Vec3, Vec4, Quat, EffectAsset, utils, isValid } from 'cc';
import { approachNight, pickNight } from './IslandAtmosphereFxCore';
import { SHORE, farShoreGeometry, farWashAlpha, foamMultiply, seaSheetLift, seaUvShift, shorePhase, shoreWashGeometry, stepShoreClock, waveLinePose } from './ShoreBreakCore';
import type { SeaPhase, ShoreGeometry, V3 } from './ShoreBreakCore';
import * as PropsLayout from '../world-r2/IslandPropsLayout';
/** Same env_sea_surface, lifted on AmbienceAudio.wavePlayhead (amb_waves_loop, 8.064 s, hits 2.369 / 6.300).
 * Daytime blue is the imported COLOR_0. Rebuilding the mesh (even with RGB expanded to RGBA) left a_color at 0
 * on device, and builtin-standard multiplied the sea to black while the positions still moved. The authored
 * mesh, normals, both UV sets, and material instance stay. The node lifts by seaSheetLift — the same shoreline
 * height the white lip uses — so the swell and the shore hit share this playhead and meet on the sand.
 * The white lip is one untextured sheet under scene-root 'ShoreBreak'. It stays hidden while the crest is
 * still offshore, then runs back and the node hides. Night is foamMultiply on that lip. The sea material's
 * mainColor is never written here (IslandProps still tints this same sea). No second sea, no second night mesh.
 * Beach lip follows the exterior layer; the far lip follows the backdrop (rear window). Authored wave-line
 * rings stay sunk under the sea so the 12 s idle clip cannot leave a white ring between beats. */
type Fx = { node: Node; material: Material; applied: string };
type Line = { node: Node; x: number; y: number; z: number; sx: number; sy: number; sz: number; rot: Quat };
type SeaScroll = { instance: Material; offset: Vec4; baseZ: number; baseW: number };
type SeaNode = { node: Node; x: number; y: number; z: number };
const TECH_ALPHA_BLEND = 3;
function findNamed(root: Node, name: string): Node | null {
  if (root.name === name) return root;
  const kids = root.children;
  for (let i = 0; i < kids.length; i++) { const hit = findNamed(kids[i], name); if (hit) return hit; }
  return null;
}
export class ShoreBreak {
  private root: Node | null = null; private meshes: Mesh[] = []; private materials: Material[] = [];
  private wash: Fx | null = null; private far: Fx | null = null; private line01: Line | null = null; private line02: Line | null = null;
  private washPos: Float32Array | null = null; private washCol: Float32Array | null = null; private washIdx: Uint16Array | null = null;
  private washMin = new Vec3(); private washMax = new Vec3(); private washCount = 0;
  private seaScroll: SeaScroll | null = null; private seaNode: SeaNode | null = null;
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
  /** Keep the imported sea mesh. COLOR_0 stays the daytime blue. Only remember the node and scroll its UVs.
   * mainColor is never written (IslandProps tints that same instance at night). */
  private bindSea(model: Node): void {
    const node = findNamed(model, 'env_sea_surface');
    if (!node) { console.warn('[SHORE] sea surface missing'); return; }
    const p = node.position;
    this.seaNode = { node: node, x: p.x, y: p.y, z: p.z };
    const mr = node.getComponent(MeshRenderer);
    if (!mr) return;
    this.bindSeaScroll(mr);
  }
  /** Wavelet drift on the wave playhead. Does not touch mainColor. */
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
  /** lateUpdate, after the idle clip and RoomLightingRig. Playhead (or the paused fallback) is the only clock. */
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
      this.heaveSea(this.time, phase);
      this.scrollSea(this.time);
    } else this.restoreSeaNode();
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
  /** Whole sheet, same height as the lip. Runs after RoomLightingRig so its 3 mm sine does not lead the swell. */
  private heaveSea(time: number, phase: SeaPhase): void {
    const n = this.seaNode; if (!n || !isValid(n.node, true)) return;
    const h = seaSheetLift(time, phase);
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
    fx.node.setPosition(0, seaSheetLift(time, phase), 0);
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
  /** Actual sheet height after this frame's heave, in scene-root world coordinates. */
  surfaceWorldY(): number | undefined {
    const n = this.seaNode;
    return n && isValid(n.node, true) ? n.node.worldPosition.y : undefined;
  }
  diagnostics() {
    return { time: this.time, exterior: this.exterior, backdrop: this.backdrop, nightShown: this.nightShown, strength: this.last.strength, travel: this.last.travel, foamU: this.last.foamU, foamA: this.last.foamA, washAlpha: this.last.wash, farAlpha: this.last.far, seaSample: this.last.sea, lineY: this.last.lineY.slice(), ownNight: this.ownNight, seaBound: !!this.seaNode, seaScroll: !!this.seaScroll };
  }
  dispose(): void {
    if (this.disposed) return; this.disposed = true;
    this.restoreSeaNode();
    this.restore(this.line01); this.restore(this.line02); this.line01 = this.line02 = null;
    if (this.root && isValid(this.root, true)) this.root.destroy();
    for (let i = 0; i < this.materials.length; i++) this.materials[i].destroy();
    for (let i = 0; i < this.meshes.length; i++) this.meshes[i].destroy();
    this.root = null; this.wash = null; this.far = null; this.materials = []; this.meshes = []; this.seaScroll = null; this.seaNode = null;
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
