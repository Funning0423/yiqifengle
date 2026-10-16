import { MeshRenderer, Node, Vec4, isValid } from 'cc';
import { ISLAND_PROPS, srgbToLinear } from './IslandPropsLayout';

/** v3.2 night sea (Mac review 764dcd8: the v3.1 tint never reached the pixels; sea Y 0.43–0.50 at night, unchanged).
 * The v3.1 path read mainColor with getProperty() as a byte Color and bound once, at prop load, only if RoomLightingRig's
 * instance already existed; any miss (no instance yet, property stored as linear Vec4 / absent, instance swapped later)
 * left it silently off. This binder:
 *  - reads and writes the real pass uniform (linear Vec4), the same API WorldFlowComponent's verified bindings use;
 *  - re-binds lazily every tick until it holds the renderer's CURRENT render material, and re-binds if that changes;
 *  - takes its own instance only after the sea has stayed on the shared material for graceS (RoomLightingRig instances
 *    it first when it can, so its tilingOffset scroll keeps working);
 *  - verifies each write by uniform readback and exposes {state, uniform} for diagnostics.
 * Day (w = 0) writes the authored uniform back exactly. */
export type SeaTintState = 'unbound' | 'waiting-instance' | 'instance-tint' | 'own-instance-tint' | 'failed';
export function seaLinearFactor(w: number, j: number): [number, number, number] {
  const k = Math.max(0, Math.min(1, w)), q = Math.max(0, Math.min(1, j)), a = srgbToLinear(ISLAND_PROPS.seaNight.tint), b = srgbToLinear(ISLAND_PROPS.seaNight.journeyTint);
  return [0, 1, 2].map(i => 1 + ((a[i] + (b[i] - a[i]) * q) - 1) * k) as [number, number, number];
}
export class SeaNightTint {
  state: SeaTintState = 'unbound'; uniform: number[] | null = null; rebinds = 0; error = '';
  private r: MeshRenderer | null = null; private mat: any = null; private authored: Vec4 | null = null; private own = false;
  private waitS = 0; private lastW = -1; private lastJ = -1;
  constructor(private readonly root: () => Node | null, private readonly graceS = 2) {}
  private find(): MeshRenderer | null {
    const top = this.root(); if (!top) return null; const name = ISLAND_PROPS.seaNight.node; let best: MeshRenderer | null = null;
    const walk = (n: Node) => { if (n.name === name) { const r = n.getComponent(MeshRenderer); if (r && (!best || (r.enabled && n.activeInHierarchy))) best = r; } for (const c of n.children) walk(c); };
    walk(top); return best;
  }
  private static read(m: any): Vec4 | null { const p = m?.passes?.[0], h = p?.getHandle?.(ISLAND_PROPS.seaNight.property); if (!h) return null; const v = new Vec4(); p.getUniform(h, v); return [v.x, v.y, v.z, v.w].every(Number.isFinite) ? v : null; }
  private bind(dt: number): boolean {
    const r = this.r && isValid(this.r, true) && isValid(this.r.node, true) ? this.r : this.find(); if (!r) { this.state = 'unbound'; return false; }
    const cur: any = r.getRenderMaterial(0), shared: any = r.getSharedMaterial(0); if (!cur || !shared) { this.state = 'unbound'; return false; }
    if (this.r === r && this.mat === cur && isValid(cur, true)) return true;
    // the instance we tinted was replaced (or first bind): never adopt the shared asset
    let m = cur;
    if (cur === shared) { this.waitS += dt; if (this.waitS < this.graceS) { this.state = 'waiting-instance'; return false; } m = r.getMaterialInstance(0); if (!m || m === shared) { this.state = 'failed'; this.error = 'no instance'; return false; } this.own = true; }
    else this.own = false;
    const a = SeaNightTint.read(shared) ?? SeaNightTint.read(m); if (!a) { this.state = 'failed'; this.error = 'mainColor uniform missing'; return false; }
    if (this.r) this.rebinds++;
    this.r = r; this.mat = m; this.authored = a; this.lastW = this.lastJ = -1; this.state = this.own ? 'own-instance-tint' : 'instance-tint'; return true;
  }
  /** w = night weight, j = journey weight, dt seconds. Safe to call every frame. */
  tick(w: number, j: number, dt: number): void {
    try {
      if (!this.bind(dt)) return; if (Math.abs(w - this.lastW) < 0.002 && Math.abs(j - this.lastJ) < 0.002) return;
      const a = this.authored!, f = seaLinearFactor(w, j), v = w <= 0 ? a.clone() : new Vec4(a.x * f[0], a.y * f[1], a.z * f[2], a.w);
      this.mat.setProperty(ISLAND_PROPS.seaNight.property, v); const back = SeaNightTint.read(this.mat);
      if (!back || Math.abs(back.x - v.x) > 1e-4 || Math.abs(back.z - v.z) > 1e-4) { this.state = 'failed'; this.error = 'readback mismatch'; return; }
      this.uniform = [back.x, back.y, back.z, back.w].map(x => +x.toFixed(4)); this.lastW = w; this.lastJ = j;
    } catch (e) { this.state = 'failed'; this.error = String(e); }
  }
  restore(): void {
    try { if (this.mat && isValid(this.mat, true) && this.authored) this.mat.setProperty(ISLAND_PROPS.seaNight.property, this.authored.clone());
      if (this.own && this.r && isValid(this.r, true) && this.r.getRenderMaterial(0) === this.mat) this.r.setSharedMaterial(this.r.getSharedMaterial(0)!, 0, true as any); } catch { /* best effort */ }
    this.r = null; this.mat = null; this.authored = null; this.state = 'unbound';
  }
}
