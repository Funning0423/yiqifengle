import { Node, Prefab, Material, MeshRenderer, Camera, Label, UITransform, RenderRoot2D, Color, EffectAsset, Mesh, assetManager, AssetManager, instantiate, isValid, utils, game } from 'cc';
import type { CameraPose } from '../world-r1/CameraPose';
import { ISLAND_PROPS, PROP_ROLES, propButtonLayout, seaAnchor, signpostRectUi, uiToScreen, softEllipse, softRing, rippleAt, type FlatMesh, type PropRole, type Rect } from './IslandPropsLayout';
import { onPropTap } from './IslandPropTaps';

/**
 * T9 island 3D UI props host (runtime). Owns only its own nodes under one root; never touches the imported island
 * model, its renderers or RoomLightingRig state. Lighting: every prop renderer shares the island's M_env_palette
 * material asset (same Main Light / ambient / day-night writes as the island; nothing is swapped per weight).
 * The only material swap is the signpost lamp: day = its own M_signpost_lamp, night = shared M_env_palette
 * (lamp UVs sit on the palette's emissive row, so it glows with no new asset). Optional: when loading fails the
 * caller keeps the flat buttons (ready stays false).
 */
export class IslandProps {
  /** Same subscription as IslandPropTaps.onPropTap (exposed on the host for discoverability). */
  static readonly onPropTap = onPropTap;
  readonly root: Node;
  private ready_ = false; private failure: string | null = null; private disposed = false;
  private palette: Material | null = null; private lamp: MeshRenderer | null = null; private lampDay: Material | null = null; private night: boolean | null = null;
  private sign: Node | null = null; private palms: Node[] = []; private buttons = new Map<PropRole, Node>();
  private stats = { prefabs: 0, renderers: 0, rebound: 0, lampSwaps: 0, label: 'none' as string, water: 'none' as string };
  private water: { meshes: Mesh[]; shadow: Material | null; ripples: { node: Node; material: Material }[] } = { meshes: [], shadow: null, ripples: [] };
  constructor(parent: Node, private camera: Camera) {
    this.root = new Node('IslandUiProps'); parent.addChild(this.root); this.root.active = false;
  }
  get ready() { return this.ready_ && !this.disposed; }
  diagnostics() {
    const pose = this.pose();
    return { version: ISLAND_PROPS.version, ready: this.ready, failure: this.failure, night: this.night, active: this.root.isValid && this.root.active, ...this.stats,
      buttons: Array.from(this.buttons).map(([k, n]) => ({ role: k, active: n.active, p: [n.worldPosition.x, n.worldPosition.y, n.worldPosition.z], s: n.scale.x })), cameraFov: pose?.fovVerticalDeg ?? null };
  }
  async load(): Promise<boolean> {
    try {
      const bundle = assetManager.getBundle(ISLAND_PROPS.bundle) || await new Promise<AssetManager.Bundle>((ok, fail) => assetManager.loadBundle(ISLAND_PROPS.bundle, (e, b) => e || !b ? fail(e || Error('no bundle')) : ok(b)));
      const prefabs = await new Promise<Prefab[]>((ok, fail) => bundle.loadDir(ISLAND_PROPS.dir, Prefab, (e, list: Prefab[]) => e ? fail(e) : ok(list || [])));
      const palette = await new Promise<Material>((ok, fail) => assetManager.loadAny({ uuid: ISLAND_PROPS.paletteMaterialUuid }, (e: any, m: Material) => e || !m ? fail(e || Error('no palette')) : ok(m)));
      if (this.disposed || !isValid(this.root, true)) return false;
      if (palette.name && palette.name !== ISLAND_PROPS.paletteMaterialName) console.warn('[T9_PROPS] palette material name', palette.name);
      this.palette = palette; this.stats.prefabs = prefabs.length;
      const get = (name: string) => { const p = prefabs.find(x => x.name === name); if (!p) throw Error('ui-props prefab missing: ' + name); return p; };
      const S = ISLAND_PROPS.signpost;
      this.sign = this.mount(get(S.prefab), S.position, S.yawDeg, S.scale);
      for (const p of ISLAND_PROPS.palms) this.palms.push(this.mount(get(p.prefab), p.position, p.yawDeg, p.scale));
      for (const role of PROP_ROLES) { const n = this.mount(get(ISLAND_PROPS.buttons[role].prefab), [0, ISLAND_PROPS.seaY, 0], 0, 1); n.active = false; this.buttons.set(role, n); }
      this.addSignText(this.sign);
      this.addSignWater();
      if (!this.lamp) console.warn('[T9_PROPS] lamp_glass renderer missing; lamp stays as imported');
      this.ready_ = true; return true;
    } catch (e) { this.failure = String(e); console.warn('[T9_PROPS] props unavailable, flat buttons stay', this.failure); return false; }
  }
  private mount(prefab: Prefab, p: readonly number[], yawDeg: number, scale: number): Node {
    const n = instantiate(prefab); this.root.addChild(n); n.setPosition(p[0], p[1], p[2]); n.setRotationFromEuler(0, yawDeg, 0); n.setScale(scale, scale, scale);
    for (const r of n.getComponentsInChildren(MeshRenderer)) {
      this.stats.renderers++;
      if (r.node.name === ISLAND_PROPS.signpost.lampNode) { this.lamp = r; this.lampDay = r.sharedMaterial; continue; }
      const count = Math.max(1, r.sharedMaterials.length);
      for (let i = 0; i < count; i++) { r.setSharedMaterial(this.palette!, i); this.stats.rebound++; }
    }
    return n;
  }
  /** "继续旅程" on the sign face: a 2D Label rendered by the world camera (RenderRoot2D), system font, no font asset. */
  private addSignText(sign: Node) {
    try {
      const T = ISLAND_PROPS.signpost.text, px = 300; // label pixels per local metre
      const n = new Node('SignText'); n.layer = sign.layer; sign.addChild(n); n.setPosition(T.center[0], T.center[1], T.center[2]); n.setScale(1 / px, 1 / px, 1 / px);
      n.addComponent(RenderRoot2D); const t = n.addComponent(UITransform); t.setContentSize(T.widthM * px * 0.9, T.heightM * px * 0.8);
      const l = n.addComponent(Label); l.string = T.string; l.fontSize = 104; l.lineHeight = 112; l.isBold = true; l.color = new Color(T.color);
      l.horizontalAlign = Label.HorizontalAlign.CENTER; l.verticalAlign = Label.VerticalAlign.CENTER; l.overflow = Label.Overflow.SHRINK;
      this.stats.label = 'render-root-2d';
    } catch (e) { this.stats.label = 'failed:' + String(e); console.warn('[T9_PROPS] sign text unavailable', String(e)); }
  }
  /** Contact shadow + two ripple rings at the sign posts. Procedural meshes (vertex alpha) + builtin-unlit technique 3
   * (two-sided alpha blend, no depth write; same as the tea steam in RoomLightingRig). No asset bytes; optional. */
  private addSignWater() {
    try {
      if (!EffectAsset.get('builtin-unlit')) { this.stats.water = 'skipped:no-builtin-unlit'; return; }
      const S = ISLAND_PROPS.signpost, W = S.water;
      const mk = (g: FlatMesh) => { const m = utils.createMesh({ positions: g.positions, normals: g.normals, colors: g.colors, indices: g.indices }, undefined, { calculateBounds: true }); this.water.meshes.push(m); return m; };
      const mat = (hex: string, a: number) => { const m = new Material(); m.initialize({ effectName: 'builtin-unlit', technique: 3, defines: { USE_VERTEX_COLOR: true } }); const c = new Color(hex); c.a = Math.round(a * 255); m.setProperty('mainColor', c); return m; };
      const place = (name: string, mesh: Mesh, m: Material, lift: number) => {
        const n = new Node(name); n.layer = this.sign!.layer; this.root.addChild(n);
        n.setPosition(S.position[0], ISLAND_PROPS.seaY + lift, S.position[2]); n.setRotationFromEuler(0, S.yawDeg, 0); n.setScale(S.scale, 1, S.scale);
        const r = n.addComponent(MeshRenderer); r.mesh = mesh; r.setMaterial(m, 0);
        r.shadowCastingMode = MeshRenderer.ShadowCastingMode.OFF; r.receiveShadow = MeshRenderer.ShadowReceivingMode.OFF; return n; };
      this.water.shadow = mat(W.shadow.color, W.shadow.alpha);
      place('SignContactShadow', mk(softEllipse(W.centerX, W.shadow.rx, W.shadow.rz)), this.water.shadow, W.ripple.lift * 0.5);
      const ring = mk(softRing(W.centerX, W.ripple.rx, W.ripple.rz, W.ripple.band));
      for (let k = 0; k < 2; k++) { const m = mat(W.ripple.color, W.ripple.alpha); this.water.ripples.push({ node: place('SignRipple' + k, ring, m, W.ripple.lift), material: m }); }
      this.stats.water = 'procedural';
    } catch (e) { this.stats.water = 'failed:' + String(e); console.warn('[T9_PROPS] sign water unavailable', String(e)); }
  }
  private tickWater(night: boolean) {
    const S = ISLAND_PROPS.signpost, W = S.water.ripple, t = game.totalTime / 1000;
    if (this.water.shadow) { const c = new Color(S.water.shadow.color); c.a = Math.round((night ? S.water.shadow.nightAlpha : S.water.shadow.alpha) * 255); this.water.shadow.setProperty('mainColor', c); }
    this.water.ripples.forEach((r, k) => {
      if (!isValid(r.node, true)) return; const a = rippleAt(t, k), c = new Color(night ? W.nightColor : W.color);
      // grow around the centre between the posts (mesh is centred at centerX)
      const cx = S.water.centerX * S.scale, yaw = S.yawDeg * Math.PI / 180, dx = cx * (1 - a.scale);
      r.node.setPosition(S.position[0] + dx * Math.cos(yaw), ISLAND_PROPS.seaY + W.lift, S.position[2] - dx * Math.sin(yaw));
      r.node.setScale(S.scale * a.scale, 1, S.scale * a.scale);
      c.a = Math.round((night ? W.nightAlpha : W.alpha) * a.alpha * 255); r.material.setProperty('mainColor', c);
    });
  }
  /** Current world-camera pose (read-only; camera is written by CameraPose.applyCameraPose only). */
  pose(): CameraPose | null {
    const c = this.camera; if (!c || !isValid(c, true) || !isValid(c.node, true)) return null;
    const p = c.node.worldPosition, q = c.node.worldRotation;
    return { position: [p.x, p.y, p.z], rotation: [q.x, q.y, q.z, q.w], fovVerticalDeg: c.fov };
  }
  /** Once per frame from the host. exterior = island exterior layer visible; buttons = island dock is showing. */
  sync(o: { exterior: boolean; night: boolean; buttons: boolean; width: number; height: number }) {
    if (!this.ready || !isValid(this.root, true)) return;
    if (this.root.active !== o.exterior) this.root.active = o.exterior;
    if (this.night !== o.night) {
      this.night = o.night;
      if (this.lamp && isValid(this.lamp, true)) { const m = o.night ? this.palette : this.lampDay; if (m) { this.lamp.setSharedMaterial(m, 0); this.stats.lampSwaps++; } }
    }
    if (o.exterior) this.tickWater(o.night);
    const pose = o.buttons && o.exterior ? this.pose() : null;
    const slots = pose && o.width > 0 && o.height > 0 ? propButtonLayout(o.width, o.height).slots : [];
    for (const role of PROP_ROLES) {
      const n = this.buttons.get(role)!, slot = slots.find(s => s.role === role);
      if (!pose || !slot) { if (n.active) n.active = false; continue; }
      const [sx, sy] = uiToScreen(slot.prop.x, slot.prop.bottom, o.width, o.height);
      const a = seaAnchor(pose, o.width / o.height, sx, sy, slot.prop.height, o.height, ISLAND_PROPS.buttons[role].heightM);
      n.setWorldPosition(a.point[0], a.point[1], a.point[2]); n.setRotationFromEuler(0, a.yawDeg, 0); n.setScale(a.scale, a.scale, a.scale);
      if (!n.active) n.active = true;
    }
  }
  /** Hit rect of the signpost in UI units (centre origin) for the live camera, or null when not usable. */
  signRect(width: number, height: number): Rect | null {
    if (!this.ready || !this.root.active) return null; const pose = this.pose(); if (!pose || !(width > 0) || !(height > 0)) return null;
    const r = signpostRectUi(pose, width, height); if (!r) return null;
    return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) };
  }
  dispose() { if (this.disposed) return; this.disposed = true; this.ready_ = false; for (const m of this.water.meshes) m.destroy(); this.water.shadow?.destroy(); for (const r of this.water.ripples) r.material.destroy(); this.water = { meshes: [], shadow: null, ripples: [] }; this.buttons.clear(); this.palms = []; this.sign = null; this.lamp = null; if (isValid(this.root, true)) this.root.destroy(); }
}
