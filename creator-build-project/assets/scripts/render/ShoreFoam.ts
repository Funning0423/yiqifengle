import { Node, MeshRenderer, Material, Mesh, Vec3, Vec4, EffectAsset, resources, utils, isValid } from 'cc';
import { ISLAND_FOAM, islandShoreRibbon } from './ShoreFoamCore';
import type { ShoreFoamParams, Swash } from './ShoreFoamCore';
/** Engine side of ShoreFoamCore: the island shore ribbon (one static mesh, one material of resources/world/shore-foam.effect,
 *  alpha blend, no depth write). ShoreBreak owns it and drives it from its clock every lateUpdate. If the effect does not load the
 *  ribbon never shows and ShoreBreak keeps its old white lip (ready() stays false). */
export const SHORE_FOAM_EFFECT = 'world/shore-foam';
export function shoreFoamMaterial(fx: EffectAsset, p: ShoreFoamParams, defines: Record<string, boolean>): Material {
  const m = new Material();
  m.initialize({ effectAsset: fx, technique: 0, defines: defines });
  const v = function (a: number[]) { return new Vec4(a[0], a[1], a[2], a[3]); };
  m.setProperty('foamColor', v(p.foamColor)); m.setProperty('wetColor', v(p.wetColor)); m.setProperty('bandParams', v(p.bandParams));
  m.setProperty('lineParams', v(p.lineParams)); m.setProperty('cycle', v(p.cycle)); m.setProperty('tint', v(p.tint)); m.setProperty('lightParams', v(p.lightParams));
  return m;
}
export class ShoreFoam {
  private node: Node | null = null; private mesh: Mesh | null = null; private material: Material | null = null;
  private disposed = false; private state = 'loading'; private applied = ''; private swashV = new Vec4(); private tintV = new Vec4(1, 1, 1, 1); private cycleV = new Vec4(); private bandV = new Vec4();
  constructor(parent: Node) {
    const node = new Node('fx_shore_foam'); parent.addChild(node); node.active = false; this.node = node;
    resources.load(SHORE_FOAM_EFFECT, EffectAsset, (err: Error | null, fx: EffectAsset | null) => {
      if (this.disposed) return;
      if (err || !fx) { this.state = 'failed:' + String(err); console.warn('[SHORE] shore-foam effect unavailable; keeping the old lip', String(err)); return; }
      try { this.build(fx); this.state = 'ready'; } catch (e) { this.state = 'failed:' + String(e); console.warn('[SHORE] shore-foam build failed', String(e)); }
    });
  }
  private build(fx: EffectAsset): void {
    const node = this.node; if (!node || !isValid(node, true)) throw Error('owner destroyed');
    const g = islandShoreRibbon();
    this.mesh = utils.createMesh({ positions: g.positions, uvs: g.uvs, colors: g.colors, indices: g.indices,
      minPos: new Vec3(g.min[0], g.min[1] - 0.3, g.min[2]), maxPos: new Vec3(g.max[0], g.max[1] + 0.3, g.max[2]) });
    this.material = shoreFoamMaterial(fx, ISLAND_FOAM, { USE_CC_TIME: false, USE_LIT: false });
    const mr = node.addComponent(MeshRenderer); mr.mesh = this.mesh; mr.setMaterial(this.material, 0);
    mr.shadowCastingMode = MeshRenderer.ShadowCastingMode.OFF; mr.receiveShadow = MeshRenderer.ShadowReceivingMode.OFF;
  }
  ready(): boolean { return this.state === 'ready' && !!this.material && !!this.node && isValid(this.node, true); }
  status(): string { return this.state; }
  /** visible: exterior view. swash from islandSwash(clock); tint = islandFoamTint(night) (rgb multiply, alpha scale); lift = this
   *  frame's sea sheet lift (m); band = islandBandParams(night) (shorter, thinner lip at night). */
  update(visible: boolean, s: Swash, tint: number[], lift: number, band: number[]): void {
    const node = this.node; if (!node || !isValid(node, true)) return;
    const on = visible && this.ready(); if (node.active !== on) node.active = on; if (!on) return;
    const m = this.material!;
    this.swashV.set(s.front, s.foamA, s.wet, s.t); m.setProperty('swash', this.swashV);
    const c = ISLAND_FOAM.cycle; this.cycleV.set(c[0], c[1], c[2], lift); m.setProperty('cycle', this.cycleV);
    const key = tint[0].toFixed(3) + ',' + tint[1].toFixed(3) + ',' + tint[2].toFixed(3) + ',' + tint[3].toFixed(3) + ',' + band[1].toFixed(3) + ',' + band[2].toFixed(3);
    if (key !== this.applied) {
      this.tintV.set(tint[0], tint[1], tint[2], tint[3]); m.setProperty('tint', this.tintV);
      this.bandV.set(band[0], band[1], band[2], band[3]); m.setProperty('bandParams', this.bandV); this.applied = key;
    }
  }
  hide(): void { const n = this.node; if (n && isValid(n, true) && n.active) n.active = false; }
  dispose(): void {
    if (this.disposed) return; this.disposed = true;
    if (this.node && isValid(this.node, true)) this.node.destroy();
    if (this.material) this.material.destroy(); if (this.mesh) this.mesh.destroy();
    this.node = null; this.material = null; this.mesh = null;
  }
}
