import { Node, Scene, MeshRenderer, Material, Color, Camera, Mesh, Vec3, EffectAsset, utils, isValid } from 'cc';
import { GullFlock as Flock, GULL_FX, wingGeometry, wingTint } from './GullFlockCore';
import type { GullCam, GullCallEvent } from './GullFlockCore';
import type { V3 } from './IslandAtmosphereFxCore';
/** cc wrapper for GullFlockCore: fx_gull_N nodes (body + fx_gull_N_wing_L/R) under IslandAtmosphereFx, sharing the island's own
 * env_anim_seagull_fly_01_v22 meshes (no new mesh, no texture). One material copy of the gulls' M_env_palette carries the night
 * tint (the palette itself is never edited). Wings: own cambered two-sided wing meshes (wingGeometry) on builtin-unlit vertex colour
 * (white-grey underside, grey top), tinted by wingTint(night); fallback to the GLB wing planes if builtin-unlit is missing. No colliders, not in lighthouseTargets: gulls never take a tap.
 * Gull calls: defensive probe of __worldIntegration.onGullCall / requestGullCall / gullClock (Voice bot AmbienceAudio, fbee3d5);
 * absent = the flock keeps its own random flights. */
type GullNodes = { node: Node; wingL: Node; wingR: Node; shown: boolean };
const HERO = 'FLOW_REFERENCE_PLACEHOLDER_NOT_B';
export class GullFlock {
  private root: Node | null = null; private gulls: GullNodes[] = []; private material: Material | null = null; private base: Color | null = null; private tintKey = ''; private wingMat: Material | null = null; private wingMeshes: Mesh[] = []; private wingKey = '';
  private flock: Flock | null = null; private scene: Scene; private hero: Node | null = null;
  private wi: any = null; private subscribedFn: any = null; private off: (() => void) | null = null; private exterior = false; private fade = 1;
  constructor(scene: Scene, parent: Node) {
    this.scene = scene;
    const find = (n: string) => { const all = scene.getComponentsInChildren(MeshRenderer); for (let i = 0; i < all.length; i++) if (all[i].node.name === n && all[i].mesh) return all[i]; return null; };
    const body = find('env_anim_seagull_fly_01_v22'), wl = find('env_anim_seagull_fly_01_v22_wing_L'), wr = find('env_anim_seagull_fly_01_v22_wing_R');
    if (!body || !wl || !wr) { console.warn('[SCENE_FX] gull meshes not found; fx gulls skipped'); return; }
    const shared = body.sharedMaterial; let mat: Material | null = null;
    try { if (shared) { mat = new Material(); mat.copy(shared); const c = mat.getProperty('mainColor') as Color | null; this.base = c && (c as any).clone ? c.clone() : new Color(255, 255, 255, 255); } }
    catch (e) { mat = null; console.warn('[SCENE_FX] gull material copy failed; gulls use the shared palette without night tint', String(e)); }
    this.material = mat; const use = mat || shared;
    const root = new Node('fx_gulls'); parent.addChild(root); this.root = root;
    let wingL: Mesh | null = wl.mesh, wingR: Mesh | null = wr.mesh, wmat: Material | null = null;
    try { if (EffectAsset.get('builtin-unlit')) { const mk = (side: number) => { const g = wingGeometry(side); const m = utils.createMesh({ positions: g.positions, colors: g.colors, indices: g.indices,
        minPos: new Vec3(g.min[0], g.min[1], g.min[2]), maxPos: new Vec3(g.max[0], g.max[1], g.max[2]) }); this.wingMeshes.push(m); return m; };
      wmat = new Material(); wmat.initialize({ effectName: 'builtin-unlit', technique: 0, defines: { USE_VERTEX_COLOR: true } }); wmat.setProperty('mainColor', new Color(255, 255, 255, 255));
      wingL = mk(-1); wingR = mk(1); } }
    catch (e) { wmat = null; wingL = wl.mesh; wingR = wr.mesh; console.warn('[SCENE_FX] fx gull wings fall back to the GLB wing planes', String(e)); }
    this.wingMat = wmat;
    const part = (p: Node, name: string, mesh: Mesh | null, x: number, y: number, m?: Material | null) => { const n = new Node(name); p.addChild(n); n.setPosition(x, y, 0);
      const r = n.addComponent(MeshRenderer); r.mesh = mesh; const mm = m || use; if (mm) r.setMaterial(mm, 0); r.shadowCastingMode = MeshRenderer.ShadowCastingMode.OFF; return n; };
    for (let i = 0; i < GULL_FX.count; i++) { const n = new Node('fx_gull_' + i); root.addChild(n); n.active = false;
      part(n, 'fx_gull_' + i + '_body', body.mesh, 0, 0);
      this.gulls.push({ node: n, wingL: part(n, 'fx_gull_' + i + '_wing_L', wingL, -.04, .03, wmat), wingR: part(n, 'fx_gull_' + i + '_wing_R', wingR, .04, .03, wmat), shown: false }); }
    this.flock = new Flock((Date.now() & 0x7fffffff) ^ 0x5eed);
  }
  /** r4-prep (C): island-only gulls fade out over the lakeside journey's arrival (1 = normal, 0 = none shown); restored to 1 on leave. */
  setFade(f: number) { this.fade = Number.isFinite(f) ? Math.max(0, Math.min(1, f)) : 1; if (this.fade <= 1e-3) this.hide(); }
  setView(exterior: boolean) { this.exterior = exterior; if (this.flock) this.flock.setView(exterior); if (!exterior) this.hide(); }
  private hide() { for (let i = 0; i < this.gulls.length; i++) { const g = this.gulls[i]; if (isValid(g.node, true)) g.node.active = false; g.shown = false; } }
  /** Re-subscribes whenever __worldIntegration (or its onGullCall) appears or is rebuilt. */
  private probe() {
    let wi: any = null; try { wi = (globalThis as any).__worldIntegration; } catch (e) { wi = null; }
    const fn = wi && typeof wi.onGullCall === 'function' ? wi.onGullCall : null;
    if (wi === this.wi && fn === this.subscribedFn) return;
    if (this.off) { try { this.off(); } catch (e) { /* stale */ } this.off = null; }
    this.wi = wi; this.subscribedFn = fn;
    if (fn) try { const self = this; const off = fn((e: GullCallEvent) => { if (!self.flock) return; let clock: number | undefined;
      try { clock = typeof self.wi.gullClock === 'function' ? Number(self.wi.gullClock()) : undefined; } catch (err) { clock = undefined; } self.flock.onCall(e, clock); });
      this.off = typeof off === 'function' ? off : null; } catch (e) { console.warn('[SCENE_FX] onGullCall subscribe failed', String(e)); }
  }
  advance(dt: number, cameraNode: Node | null, night: number) {
    const f = this.flock, root = this.root; if (!f || !root || !isValid(root, true)) return; this.probe();
    if (!this.exterior || !cameraNode || !isValid(cameraNode, true)) { this.hide(); return; }
    const cc = cameraNode.getComponent(Camera), p = cameraNode.worldPosition;
    const fwd = cameraNode.forward, up = cameraNode.up, right = cameraNode.right, fov = cc ? cc.fov : 45, ra: any = cc ? (cc as any).camera : null;
    const aspect = ra && ra.aspect > 0 ? ra.aspect : .4629;
    const cam: GullCam = { pos: [p.x, p.y, p.z], fwd: [fwd.x, fwd.y, fwd.z], up: [up.x, up.y, up.z], right: [right.x, right.y, right.z], tanY: Math.tan(fov * Math.PI / 360), aspect };
    if (!this.hero || !isValid(this.hero, true)) this.hero = this.scene.getChildByName(HERO);
    const h = this.hero && isValid(this.hero, true) ? this.hero.worldPosition : null, hero: V3 | null = h ? [h.x, h.y, h.z] : null;
    const poses = f.advance(dt, cam, night, hero);
    while (f.requests.length) { const r = f.requests.shift()!; if (this.fade <= 1e-3) continue; try { if (this.wi && typeof this.wi.requestGullCall === 'function') this.wi.requestGullCall(r.dist, r.yawWorldDeg); } catch (e) { /* optional */ } }
    for (let i = 0; i < poses.length && i < this.gulls.length; i++) { const s = poses[i], g = this.gulls[i];
      const vis = s.visible && this.fade > 1e-3, k = s.size * this.fade;
      if (g.shown !== vis) { g.node.active = vis; g.shown = vis; } if (!vis) continue;
      g.node.setWorldPosition(s.pos[0], s.pos[1], s.pos[2]); g.node.setWorldRotation(s.rot[0], s.rot[1], s.rot[2], s.rot[3]); g.node.setScale(k, k, k);
      g.wingL.setRotation(s.wingL[0], s.wingL[1], s.wingL[2], s.wingL[3]); g.wingR.setRotation(s.wingR[0], s.wingR[1], s.wingR[2], s.wingR[3]);
      g.wingL.setScale(s.wingScaleX, 1, 1); g.wingR.setScale(s.wingScaleX, 1, 1); }
    if (this.material && this.base) { const t = Flock.tint(night), b = this.base, r = Math.round(b.r * t[0]), gg = Math.round(b.g * t[1]), bl = Math.round(b.b * t[2]), key = r + ',' + gg + ',' + bl;
      if (key !== this.tintKey) { this.tintKey = key; try { this.material.setProperty('mainColor', new Color(r, gg, bl, b.a)); } catch (e) { this.base = null; } } }
    if (this.wingMat) { const t = wingTint(night), r = Math.round(255 * Math.min(1, t[0])), gg = Math.round(255 * Math.min(1, t[1])), bl = Math.round(255 * Math.min(1, t[2])), key = r + ',' + gg + ',' + bl;
      if (key !== this.wingKey) { this.wingKey = key; try { this.wingMat.setProperty('mainColor', new Color(r, gg, bl, 255)); } catch (e) { this.wingMat = null; } } }
  }
  diagnostics() { const f = this.flock; return f ? { subscribed: !!this.off, stats: f.stats, nearLog: f.nearLog.slice(-8), shown: this.gulls.map(g => g.shown) } : null; }
  dispose() {
    if (this.off) { try { this.off(); } catch (e) { /* stale */ } this.off = null; }
    if (this.root && isValid(this.root, true)) this.root.destroy(); if (this.material) this.material.destroy(); if (this.wingMat) this.wingMat.destroy(); for (let i = 0; i < this.wingMeshes.length; i++) this.wingMeshes[i].destroy();
    this.root = null; this.material = null; this.wingMat = null; this.wingMeshes = []; this.gulls = []; this.flock = null;
  }
}
