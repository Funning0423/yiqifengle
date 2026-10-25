import { BlockInputEvents, Camera, Color, Graphics, Layers, MeshRenderer, Node, Prefab, RenderTexture, SphereLight, Sprite, SpriteFrame, UIOpacity, UITransform, Vec3, assetManager, director, instantiate, isValid, view } from 'cc';
import { WINDWIPE, WINDWIPE_COLORS, WindWipeState, contentAlpha, holdDrift, wipeLobes, windAxis, type WipeContent, type WipeVehicle } from '../world-r2/WindWipeCore';
import { uiNightWeight } from './NightTint';
/** 风云擦除 renderer (post-island SPEC §1). Replaces the black HomeFadeCover Graphics: the node keeps the name 'HomeFadeCover'
 *  so QA/tests that look it up still find it. Driven by WorldIntegrationBoot.fadeCover(alpha, seconds) through WindWipeState.
 *  Never paints black: day = warm cream cloud, night = deep blue with warm stars. Swallows touches while visible. */
export const WIPE_PROP_LAYER = 1 << 17;
const PROP_SRC: Record<WipeVehicle, { bundle: string; path: string; yaw: number }> = {
  sailboat: { bundle: 'transport_sail', path: 'sailboat/sailboat', yaw: 35 },
  balloon: { bundle: 'region_transit_balloon', path: 'transport_balloon/transport_balloon', yaw: 25 },
  chime: { bundle: 'region_lakeside', path: 'models/LK_windchime/LK_windchime', yaw: 30 },
};
const PROP_ORIGIN = new Vec3(-10000, 10000, -10000);
/** One existing GLB rendered off-screen into a RenderTexture (same technique as ResultChest3D), auto-framed by its mesh bounds. */
class WipeProp3D {
  sprite: Sprite; private rig: Node | null = null; private cam: Camera | null = null; private rt: RenderTexture | null = null; private model: Node | null = null;
  kind: WipeVehicle | null = null; state = 'idle'; private spin = 0;
  constructor(parent: Node, size: number) {
    const n = new Node('WindWipeVehicle'); n.layer = Layers.Enum.UI_2D; parent.addChild(n); n.addComponent(UITransform).setContentSize(size, size);
    this.sprite = n.addComponent(Sprite); this.sprite.sizeMode = Sprite.SizeMode.CUSTOM; this.sprite.trim = false;
  }
  show(kind: WipeVehicle | null) {
    if (kind === this.kind) return; this.kind = kind; if (this.model && isValid(this.model, true)) this.model.destroy(); this.model = null;
    this.sprite.node.active = !!kind && this.state === 'ready'; if (!kind) return; void this.load(kind);
  }
  private ensureRig() {
    if (this.rig && isValid(this.rig, true)) return true;
    const scene = director.getScene(); if (!scene) return false;
    const rig = new Node('WindWipePropRig'); scene.addChild(rig); rig.setWorldPosition(PROP_ORIGIN); this.rig = rig;
    const light = (p: number[], lum: number) => { const ln = new Node('WipeLight'); ln.layer = WIPE_PROP_LAYER; rig.addChild(ln); ln.setPosition(p[0], p[1], p[2]); const l = ln.addComponent(SphereLight); l.color = new Color('#FFEDCC'); l.size = .5; l.range = 40; l.luminance = l.luminance * lum; l.visibility = WIPE_PROP_LAYER; };
    light([-4, 7, 6], 5); light([5, 2, 4], 1.4);
    const cn = new Node('WindWipePropCamera'); cn.layer = WIPE_PROP_LAYER; rig.addChild(cn); cn.setPosition(0, 1.4, 6.2); cn.lookAt(new Vec3(PROP_ORIGIN.x, PROP_ORIGIN.y, PROP_ORIGIN.z));
    const cam = cn.addComponent(Camera); cam.projection = Camera.ProjectionType.PERSPECTIVE; cam.fov = 30; cam.near = .3; cam.far = 40; cam.visibility = WIPE_PROP_LAYER;
    cam.clearFlags = Camera.ClearFlag.SOLID_COLOR; cam.clearColor = new Color(0, 0, 0, 0); cam.priority = 44; cam.usePostProcess = false;
    const rt = new RenderTexture(); rt.reset({ width: 512, height: 512 }); (rt as any).setFilters?.(2, 2); cam.targetTexture = rt; this.cam = cam; this.rt = rt;
    const f = new SpriteFrame(); f.texture = rt; f.packable = false; this.sprite.spriteFrame = f; return true;
  }
  private async load(kind: WipeVehicle) {
    const src = PROP_SRC[kind];
    try {
      const bundle = assetManager.getBundle(src.bundle) || await new Promise<any>((ok, bad) => assetManager.loadBundle(src.bundle, (e, b) => e || !b ? bad(e || Error(src.bundle)) : ok(b)));
      const prefab: Prefab = await new Promise((ok, bad) => bundle.load(src.path, Prefab, (e: any, p: Prefab) => e || !p ? bad(e || Error(src.path)) : ok(p)));
      if (this.kind !== kind || !this.ensureRig()) return;
      const m = instantiate(prefab); const setLayer = (n: Node) => { n.layer = WIPE_PROP_LAYER; n.children.forEach(setLayer); }; setLayer(m);
      const holder = new Node('WipePropHolder'); holder.layer = WIPE_PROP_LAYER; this.rig!.addChild(holder); holder.addChild(m);
      // auto-frame: fit the mesh AABB (local struct bounds × node scale) into a 2.6 m box centred on the rig origin
      let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
      for (const r of m.getComponentsInChildren(MeshRenderer)) { r.shadowCastingMode = MeshRenderer.ShadowCastingMode.OFF; const st: any = r.mesh?.struct; if (!st?.minPosition) continue; const s = r.node.worldScale, p = r.node.worldPosition;
        mn = [Math.min(mn[0], p.x + st.minPosition.x * s.x), Math.min(mn[1], p.y + st.minPosition.y * s.y), Math.min(mn[2], p.z + st.minPosition.z * s.z)];
        mx = [Math.max(mx[0], p.x + st.maxPosition.x * s.x), Math.max(mx[1], p.y + st.maxPosition.y * s.y), Math.max(mx[2], p.z + st.maxPosition.z * s.z)]; }
      const ext = Math.max(.01, mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]), k = mn[0] < 1e8 ? 2.6 / ext : 1;
      m.setPosition(mn[0] < 1e8 ? -(mn[0] + mx[0]) / 2 + PROP_ORIGIN.x : 0, mn[0] < 1e8 ? -(mn[1] + mx[1]) / 2 + PROP_ORIGIN.y : 0, mn[0] < 1e8 ? -(mn[2] + mx[2]) / 2 + PROP_ORIGIN.z : 0);
      holder.setScale(k, k, k); holder.setRotationFromEuler(0, src.yaw, 0); this.model = holder; this.spin = src.yaw; this.state = 'ready'; this.sprite.node.active = true;
    } catch (e) { this.state = 'failed'; console.warn('[WindWipe] vehicle unavailable', kind, String(e)); this.sprite.node.active = false; }
  }
  tick(dt: number) { if (this.model && isValid(this.model, true)) { this.spin += dt * 6; this.model.setRotationFromEuler(0, this.spin, 0); } if (this.cam) this.cam.enabled = !!this.kind && this.sprite.node.activeInHierarchy; }
  dispose() { if (this.cam && isValid(this.cam, true)) { this.cam.targetTexture = null; this.cam.enabled = false; } if (this.rig && isValid(this.rig, true)) this.rig.destroy(); this.rig = null; this.rt?.destroy(); this.rt = null; }
}
export class WindWipeView {
  readonly node: Node; readonly state = new WindWipeState();
  private band: Graphics; private bandNode: Node; private hold: Node; private holdOp: UIOpacity; private prop: WipeProp3D; private dots: Graphics;
  private content: WipeContent | null = null; private pendingClear = false; private lobes = wipeLobes(); private now = 0; private inAt = -1; private last = '';
  private block: BlockInputEvents;
  constructor(parent: Node) {
    const node = new Node('HomeFadeCover'); node.layer = Layers.Enum.UI_2D; parent.addChild(node); node.addComponent(UITransform).setContentSize(4000, 4000); this.node = node;
    this.block = node.addComponent(BlockInputEvents);
    this.bandNode = new Node('WindWipeBand'); this.bandNode.layer = Layers.Enum.UI_2D; node.addChild(this.bandNode); this.bandNode.addComponent(UITransform);
    this.bandNode.angle = WINDWIPE.tiltDeg; this.band = this.bandNode.addComponent(Graphics);
    this.hold = new Node('WindWipeHold'); this.hold.layer = Layers.Enum.UI_2D; node.addChild(this.hold); this.hold.addComponent(UITransform); this.holdOp = this.hold.addComponent(UIOpacity);
    const shadow = new Node('VehicleShadow'); shadow.layer = Layers.Enum.UI_2D; this.hold.addChild(shadow); shadow.addComponent(UITransform); const sg = shadow.addComponent(Graphics); sg.fillColor = new Color(0x3c, 0x28, 0x14, 61); sg.ellipse(0, -92, 70, 12); sg.fill();
    this.prop = new WipeProp3D(this.hold, 200);
    // region-title SPEC §1: the hold has no place-name plank any more (the name fades in at the region's first level).
    const dn = new Node('WindDots'); dn.layer = Layers.Enum.UI_2D; this.hold.addChild(dn); dn.addComponent(UITransform); this.dots = dn.addComponent(Graphics);
    node.active = false;
  }
  setContent(c: WipeContent | null) {
    if (!c) { this.pendingClear = true; return; }
    this.pendingClear = false; this.content = c; this.prop.show(c.vehicle);
  }
  /** Legacy cover(alpha, seconds) ramp. */
  ramp(alpha: number, seconds: number, now: number) { this.now = now; const d = this.state.set(alpha, seconds, now); if (d === 'in') this.inAt = now; if (alpha > 0 || this.state.mode !== 'clear') this.node.active = true; }
  /** Per frame: returns true when the active ramp finished. */
  tick(now: number, dt: number): boolean {
    this.now = now; const done = this.state.tick(now); const sh = this.state.shape();
    if (sh.mode === 'clear') { this.node.active = false; if (this.pendingClear) { this.content = null; this.pendingClear = false; this.prop.show(null); } this.last = ''; return done; }
    this.node.active = true; this.block.enabled = true;
    const vs = view.getVisibleSize(), w = vs.width, h = vs.height, night = uiNightWeight() > .5;
    const key = sh.lead.toFixed(4) + '|' + sh.trail.toFixed(4) + '|' + w + 'x' + h + (night ? 'n' : 'd');
    if (key !== this.last) { this.last = key; this.paint(sh.lead, sh.trail, w, h, night); }
    const fullFor = this.state.fullSince >= 0 && sh.mode === 'full' ? now - this.state.fullSince : 0, inFor = this.inAt >= 0 ? now - this.inAt : 0;
    const a = this.content ? contentAlpha({ mode: sh.mode, fullFor, inFor }) : 0; this.holdOp.opacity = Math.round(255 * a); this.hold.active = a > 0.001;
    if (this.hold.active) {
      const k = Math.min(w / 390, h / 844), dr = holdDrift(fullFor);
      this.prop.sprite.node.setPosition(dr.dx * k - 40 * k, h / 2 - 330 * k + dr.dy * k, 0); this.prop.sprite.node.getComponent(UITransform)!.setContentSize(200 * k, 200 * k);
      this.dots.clear(); if (dr.dots) { const b = .5 + .5 * Math.sin(fullFor * Math.PI * 2 / .5); for (let i = -1; i <= 1; i++) { this.dots.fillColor = new Color(0x5a, 0x3a, 0x1e, Math.round(120 + 100 * b)); this.dots.circle(i * 14 * k, h / 2 - 512 * k, 3 * k); this.dots.fill(); } }
    }
    this.prop.tick(dt); return done;
  }
  private paint(lead: number, trail: number, w: number, h: number, night: boolean) {
    const g = this.band, ax = windAxis(w, h), C = night ? WINDWIPE_COLORS.night : WINDWIPE_COLORS.day; g.clear();
    const x0 = ax.at(Math.max(-1, trail)), x1 = ax.at(Math.min(2, lead)); if (x1 <= x0 && lead < 1.5) return;
    const a = WINDWIPE.tiltDeg * Math.PI / 180, ey = Math.abs(Math.sin(a)) * w / 2 + Math.abs(Math.cos(a)) * h / 2 + 120, N = 8;
    const col = (t: number) => { const u = Math.max(0, Math.min(1, t)); return new Color(Math.round(C.top[0] + (C.bottom[0] - C.top[0]) * u), Math.round(C.top[1] + (C.bottom[1] - C.top[1]) * u), Math.round(C.top[2] + (C.bottom[2] - C.top[2]) * u), 255); };
    for (let i = 0; i < N; i++) { const y1 = ey - 2 * ey * i / N, y0 = ey - 2 * ey * (i + 1) / N; g.fillColor = col((i + .5) / N); g.rect(x0, y0, x1 - x0, y1 - y0 + 1); g.fill(); }
    // edge lobes (cloud puffs) on the leading edge (bulging downwind) and the trailing edge (bulging upwind)
    for (const l of this.lobes) { const y = l.u * ey, c = col(.5 - y / (2 * ey));
      if (lead < 1.5) { g.fillColor = c; g.circle(x1 - l.r * (1 - l.bulge), y, l.r); g.fill(); }
      if (trail > -.5) { g.fillColor = c; g.circle(x0 + l.r * (1 - l.bulge), y, l.r); g.fill(); } }
    // low-poly facets (9 light slants)
    for (let i = 0; i < 9; i++) { const fx = x0 + (x1 - x0) * ((i * 0.618) % 1), fy = -ey + 2 * ey * ((i * 0.381 + .1) % 1), s = 60 + 14 * (i % 4);
      if (fx < x0 + 10 || fx > x1 - 10) continue; g.fillColor = new Color(C.facet[0], C.facet[1], C.facet[2], Math.round(255 * C.facetA)); g.moveTo(fx - s, fy - s * .4); g.lineTo(fx + s, fy - s * .1); g.lineTo(fx + s * .2, fy + s * .6); g.close(); g.fill(); }
    if (night) { const S = WINDWIPE_COLORS.night; g.fillColor = new Color(S.star[0], S.star[1], S.star[2], 220); for (let i = 0; i < S.stars; i++) { const sx = x0 + (x1 - x0) * ((i * 0.7548) % 1), sy = -ey + 2 * ey * ((i * 0.5698) % 1); if (sx < x0 + 6 || sx > x1 - 6) continue; g.circle(sx, sy, 1.2 + (i % 3) * .6); g.fill(); } }
  }
  diagnostics() { const s = this.state.shape(); return { mode: s.mode, lead: s.lead, trail: s.trail, opaque: s.opaque, content: this.content, vehicle: this.prop.state, holdVisible: this.hold.active, black: false }; }
  dispose() { this.prop.dispose(); }
}
