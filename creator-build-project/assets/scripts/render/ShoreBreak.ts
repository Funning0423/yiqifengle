import { Node, Scene, MeshRenderer, Material, Mesh, Vec3, Vec4, EffectAsset, utils, isValid } from 'cc';
import { approachNight, pickNight } from './IslandAtmosphereFxCore';
import { SHORE, bandAlpha, farShoreGeometry, foamMultiply, shoreBandGeometry, shorePhase, stepShoreClock, waveLinePose } from './ShoreBreakCore';
import type { ShoreGeometry, V3 } from './ShoreBreakCore';
import * as PropsLayout from '../world-r2/IslandPropsLayout';
/** Flat shore wash locked to AmbienceAudio.wavePlayhead (amb_waves_loop, 8.064 s).
 * Nodes live under scene-root 'ShoreBreak', outside the imported model. No colliders, no texture, no second night mesh.
 * Beach tongues follow the exterior layer; the far horizon follows the backdrop (rear window included).
 * env_sea_wave_line_01/02 are retargeted in lateUpdate so the 12 s idle clip is not a second rhythm. Their materials stay authored. */
type Fx = { node: Node; material: Material; applied: string };
type Line = { node: Node; x: number; y: number; z: number; sx: number; sy: number; sz: number };
const TECH_ALPHA_BLEND = 3;
function findNamed(root: Node, name: string): Node | null {
  if (root.name === name) return root;
  const kids = root.children;
  for (let i = 0; i < kids.length; i++) { const hit = findNamed(kids[i], name); if (hit) return hit; }
  return null;
}
export class ShoreBreak {
  private root: Node | null = null; private meshes: Mesh[] = []; private materials: Material[] = [];
  private bands: Fx[] = []; private far: Fx | null = null; private line01: Line | null = null; private line02: Line | null = null;
  private exterior = false; private backdrop = false; private night = false; private synced = false; private time = 0; private ownNight = 0; private nightShown = 0;
  private disposed = false;
  private last = { strength: 0, travel: 0, band: [] as number[], far: 0, lineY: [] as number[] };
  constructor(scene: Scene, model: Node | null) {
    if (!EffectAsset.get('builtin-unlit')) { console.warn('[SHORE] builtin-unlit unavailable; shore wash skipped'); return; }
    const root = new Node('ShoreBreak'); scene.addChild(root); this.root = root;
    for (let i = 0; i < SHORE.bands.length; i++) this.bands.push(this.fx(root, 'fx_shore_wash_' + i, this.mesh(shoreBandGeometry(i))));
    this.far = this.fx(root, 'fx_shore_far', this.mesh(farShoreGeometry()));
    if (model) { this.line01 = this.bindLine(model, 'env_sea_wave_line_01_v22'); this.line02 = this.bindLine(model, 'env_sea_wave_line_02_v22'); }
    root.active = false;
  }
  private mesh(g: ShoreGeometry): Mesh {
    const m = utils.createMesh({ positions: g.positions, colors: g.colors, indices: g.indices,
      minPos: new Vec3(g.min[0], g.min[1], g.min[2]), maxPos: new Vec3(g.max[0], g.max[1], g.max[2]) });
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
    return { node: node, x: p.x, y: p.y, z: p.z, sx: s.x, sy: s.y, sz: s.z };
  }
  /** exterior: beach tongues. backdrop: far horizon (rear window). night: target of the 0.5 s multiply. */
  setView(exterior: boolean, backdrop: boolean, night: boolean): void {
    this.exterior = exterior; this.backdrop = backdrop; this.night = night;
    if (!exterior && !backdrop) this.hideAll();
  }
  /** lateUpdate, after the idle clip has written the wave-line poses. */
  advance(dt: number): void {
    const root = this.root; if (this.disposed || !root || !isValid(root, true)) return;
    const step = Number.isFinite(dt) && dt > 0 ? Math.min(dt, 0.1) : 0;
    this.ownNight = this.synced ? approachNight(this.ownNight, this.night, step) : (this.night ? 1 : 0); this.synced = true;
    let shared: unknown = null;
    try { const f = (PropsLayout as any).propNightWeight; shared = typeof f === 'function' ? f() : null; } catch (e) { shared = null; }
    this.nightShown = pickNight(this.ownNight, shared);
    this.time = stepShoreClock(this.time, dt, this.playhead());
    const phase = shorePhase(this.time), rgb = foamMultiply(this.nightShown);
    this.last.strength = phase.strength; this.last.travel = phase.travel; this.last.band = [];
    let any = false;
    for (let i = 0; i < this.bands.length; i++) {
      const a = bandAlpha(phase.strength, phase.travel, SHORE.bands[i], SHORE.shorePeak);
      const show = this.exterior && a > 1 / 255; this.last.band.push(show ? a : 0);
      this.place(this.bands[i], rgb, show ? a : 0); if (show) any = true;
    }
    const farA = phase.strength * SHORE.farPeak, showFar = this.backdrop && farA > 1 / 255;
    this.last.far = showFar ? farA : 0; this.place(this.far, rgb, showFar ? farA : 0); if (showFar) any = true;
    if (root.active !== any) root.active = any;
    this.last.lineY = [];
    this.driveLine(this.line01, phase.line01); this.driveLine(this.line02, phase.line02);
  }
  private playhead(): number | null {
    try {
      const wi = (globalThis as any).__worldIntegration, f = wi && wi.wavePlayhead;
      if (typeof f !== 'function') return null;
      const v = f(); return typeof v === 'number' && Number.isFinite(v) ? v : null;
    } catch (e) { return null; }
  }
  private place(fx: Fx | null, rgb: V3, alpha: number): void {
    if (!fx || !isValid(fx.node, true)) return;
    const visible = alpha > 1 / 255; if (fx.node.active !== visible) fx.node.active = visible; if (!visible) return;
    const key = rgb[0].toFixed(3) + ',' + rgb[1].toFixed(3) + ',' + rgb[2].toFixed(3) + ',' + alpha.toFixed(3);
    if (key !== fx.applied) { fx.material.setProperty('mainColor', new Vec4(rgb[0], rgb[1], rgb[2], alpha)); fx.applied = key; }
  }
  private driveLine(line: Line | null, swell: { strength: number; travel: number }): void {
    if (!line || !isValid(line.node, true)) return;
    const pose = waveLinePose(swell.strength, swell.travel);
    line.node.setPosition(line.x, pose.y, line.z); line.node.setScale(pose.scale, line.sy, pose.scale);
    this.last.lineY.push(pose.y);
  }
  private hideAll(): void {
    const all: (Fx | null)[] = this.bands.concat([this.far]);
    for (let i = 0; i < all.length; i++) { const f = all[i]; if (f && isValid(f.node, true)) f.node.active = false; }
    if (this.root && isValid(this.root, true)) this.root.active = false;
  }
  diagnostics() {
    return { time: this.time, exterior: this.exterior, backdrop: this.backdrop, nightShown: this.nightShown, strength: this.last.strength, travel: this.last.travel, bandAlpha: this.last.band.slice(), farAlpha: this.last.far, lineY: this.last.lineY.slice(), ownNight: this.ownNight };
  }
  dispose(): void {
    if (this.disposed) return; this.disposed = true;
    this.restore(this.line01); this.restore(this.line02); this.line01 = this.line02 = null;
    if (this.root && isValid(this.root, true)) this.root.destroy();
    for (let i = 0; i < this.materials.length; i++) this.materials[i].destroy();
    for (let i = 0; i < this.meshes.length; i++) this.meshes[i].destroy();
    this.root = null; this.bands = []; this.far = null; this.materials = []; this.meshes = [];
  }
  private restore(line: Line | null): void {
    if (!line || !isValid(line.node, true)) return;
    line.node.setPosition(line.x, line.y, line.z); line.node.setScale(line.sx, line.sy, line.sz);
  }
}
