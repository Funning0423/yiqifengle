import { Node, Prefab, Material, MeshRenderer, Camera, Label, UITransform, UIOpacity, RenderRoot2D, Color, SphereLight, EffectAsset, Mesh, assetManager, AssetManager, instantiate, isValid, utils, game } from 'cc';
import type { CameraPose } from '../world-r1/CameraPose';
import { ISLAND_PROPS, PROP_ROLES, propButtonLayout, seaAnchor, signpostHitUi, signpostRectUi, uiToScreen, softEllipse, softRing, rippleAt, mixHex, approachNight, lampLightAt, setPropNightWeight, seaColorAt, type FlatMesh, type PropRole, type Rect } from './IslandPropsLayout';
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
  private stats = { prefabs: 0, renderers: 0, rebound: 0, lampSwaps: 0, label: 'none' as string, water: 'none' as string, entrance: 1, fadeMaterials: 0, lampLight: 'none' as string, nightWeight: 0, sea: 'none' as string };
  /** T9n: smoothed night weight (0 day .. 1 night) shared by the lamp light, water tint, sign text and the bottom tags. */
  private nightW = 0; private lastTime = -1; private lampLight: SphereLight | null = null; private lampBase = 0; private glow: { node: Node; material: Material } | null = null; private signLabel: Label | null = null;
  /** T9n-2: unlit amber lamp glass (night), its glow disc, and the night sea tint binding (restored at weight 0). */
  private lampNightMat: Material | null = null; private lampGlow: { node: Node; material: Material } | null = null; private sea: { material: Material; authored: number[]; applied: number } | null = null;
  /** Signpost entrance (driven by the host from applyIslandEntrance): 1 = fully shown, 0 = hidden. */
  private entrance = 1; private fade: { r: MeshRenderer; i: number; m: Material }[] = []; private signText: UIOpacity | null = null; private view = { width: 0, height: 0 };
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
      this.addLampLight();
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
      this.signText = n.addComponent(UIOpacity); this.signLabel = l; this.stats.label = 'render-root-2d';
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
  private tickWater(w: number) {
    const S = ISLAND_PROPS.signpost, W = S.water.ripple, t = game.totalTime / 1000, mix = (a: number, b: number) => a + (b - a) * w;
    if (this.water.shadow) { const c = new Color(S.water.shadow.color); c.a = Math.round(mix(S.water.shadow.alpha, S.water.shadow.nightAlpha) * this.entrance * 255); this.water.shadow.setProperty('mainColor', c); }
    this.water.ripples.forEach((r, k) => {
      if (!isValid(r.node, true)) return; const a = rippleAt(t, k), c = new Color(mixHex(W.color, W.nightColor, w));
      // grow around the centre between the posts (mesh is centred at centerX)
      const cx = S.water.centerX * S.scale, yaw = S.yawDeg * Math.PI / 180, dx = cx * (1 - a.scale);
      r.node.setPosition(S.position[0] + dx * Math.cos(yaw), ISLAND_PROPS.seaY + W.lift, S.position[2] - dx * Math.sin(yaw));
      r.node.setScale(S.scale * a.scale, 1, S.scale * a.scale);
      c.a = Math.round(mix(W.alpha, W.nightAlpha) * a.alpha * this.entrance * 255); r.material.setProperty('mainColor', c);
    });
    // T9n: lamp light + warm water pool + sign text colour follow the same night weight (smooth, no pop)
    const L = lampLightAt(w);
    if (this.lampLight && isValid(this.lampLight, true)) { if (this.lampLight.enabled !== L.enabled) this.lampLight.enabled = L.enabled; this.lampLight.luminance = this.lampBase * L.scale * this.entrance; }
    if (this.glow && isValid(this.glow.node, true)) { const R = S.lampLight.reflection, c = new Color(R.color); const a = Math.round(R.alpha * (L.scale / S.lampLight.luminanceScale) * this.entrance * 255); c.a = a; this.glow.material.setProperty('mainColor', c); if (this.glow.node.active !== a > 0) this.glow.node.active = a > 0; }
    if (this.lampGlow && isValid(this.lampGlow.node, true)) { const G = S.lampGlass.glow, c = new Color(G.color); const a = Math.round(G.alpha * (L.scale / S.lampLight.luminanceScale) * this.entrance * 255); c.a = a; this.lampGlow.material.setProperty('mainColor', c); if (this.lampGlow.node.active !== a > 0) this.lampGlow.node.active = a > 0; }
    this.tickSea(w);
    if (this.signLabel && isValid(this.signLabel, true)) this.signLabel.color = new Color(mixHex(S.text.color, S.text.nightColor, w));
  }
  /** T9n-2 night sea: tint the sea renderer's EXISTING material instance (RoomLightingRig's tilingOffset instance) only. */
  private bindSea() {
    try {
      const find = (n: Node): Node | null => { if (n.name === ISLAND_PROPS.seaNight.node) return n; for (const c of n.children) { const r = find(c); if (r) return r; } return null; };
      let top: Node = this.root; while (top.parent) top = top.parent;
      const r = find(top)?.getComponent(MeshRenderer), shared = r?.getSharedMaterial(0), mat = r?.getRenderMaterial(0) as Material | null;
      if (!r || !shared || !mat || mat === shared) { this.stats.sea = 'skipped:no-instance'; return; }
      const c = mat.getProperty(ISLAND_PROPS.seaNight.property) as Color | null; if (!c) { this.stats.sea = 'skipped:no-mainColor'; return; }
      this.sea = { material: mat, authored: [c.r, c.g, c.b, c.a], applied: 0 }; this.stats.sea = 'instance-tint';
    } catch (e) { this.sea = null; this.stats.sea = 'failed:' + String(e); }
  }
  private tickSea(w: number) {
    const sea = this.sea; if (!sea || !isValid(sea.material, true)) return; if (Math.abs(w - sea.applied) < 0.004 && !(w === 0 && sea.applied !== 0)) return;
    const v = seaColorAt(sea.authored, w); sea.material.setProperty(ISLAND_PROPS.seaNight.property, new Color(v[0], v[1], v[2], v[3])); sea.applied = w;
  }
  private restoreSea() { const sea = this.sea; this.sea = null; if (sea && isValid(sea.material, true)) sea.material.setProperty(ISLAND_PROPS.seaNight.property, new Color(sea.authored[0], sea.authored[1], sea.authored[2], sea.authored[3])); }
  /** T9n: warm SphereLight next to lamp_glass, night only. Light.visibility = the sign's own layer bit (a user layer the
   * world camera already renders and nothing else uses), so the forward-add pass touches only the sign's 2 renderers
   * (island, sea, palms, buttons are not lit by it). Skipped (lamp keeps its emissive glow only) when the camera does
   * not render that layer. Plus a faint additive warm pool on the sea (procedural, builtin-unlit "add"). */
  private addLampLight() {
    const S = ISLAND_PROPS.signpost, LL = S.lampLight, sign = this.sign!, layer = 1 << LL.layerBit;
    this.bindSea();
    try {
      const fx = EffectAsset.get('builtin-unlit');
      if (fx) {
        const m = new Material(); m.initialize({ effectName: 'builtin-unlit', technique: 0 }); m.setProperty('mainColor', new Color(S.lampGlass.nightColor)); this.lampNightMat = m;
        const add = fx.techniques.findIndex(t => t.name === 'add');
        if (add >= 0) {
          const G = S.lampGlass.glow, g = softEllipse(0, G.radius, G.radius), xy = { positions: [] as number[], normals: [] as number[] };
          for (let i = 0; i < g.positions.length; i += 3) { xy.positions.push(g.positions[i], g.positions[i + 2], 0); xy.normals.push(0, 0, 1); } // disc in the sign's XY plane (faces the camera like the sign)
          const mesh = utils.createMesh({ positions: xy.positions, normals: xy.normals, colors: g.colors, indices: g.indices }, undefined, { calculateBounds: true }); this.water.meshes.push(mesh);
          const gm = new Material(); gm.initialize({ effectName: 'builtin-unlit', technique: add, defines: { USE_VERTEX_COLOR: true } }); const c = new Color(G.color); c.a = 0; gm.setProperty('mainColor', c);
          const n = new Node('SignLampGlow'); n.layer = sign.layer; sign.addChild(n); n.setPosition(G.center[0], G.center[1], G.center[2]);
          const r = n.addComponent(MeshRenderer); r.mesh = mesh; r.setMaterial(gm, 0); r.shadowCastingMode = MeshRenderer.ShadowCastingMode.OFF; r.receiveShadow = MeshRenderer.ShadowReceivingMode.OFF;
          n.active = false; this.lampGlow = { node: n, material: gm };
        }
      }
    } catch (e) { console.warn('[T9_PROPS] amber lamp unavailable', String(e)); }
    try {
      if (!this.camera || (this.camera.visibility & layer) === 0) { this.stats.lampLight = 'skipped:camera-layer'; }
      else {
        const walk = (n: Node) => { n.layer = layer; for (const c of n.children) walk(c); }; walk(sign);
        const n = new Node('SignLampLight'); n.layer = layer; sign.addChild(n); n.setPosition(LL.local[0], LL.local[1], LL.local[2]);
        const l = n.addComponent(SphereLight); l.color = new Color(LL.color); l.size = LL.size * S.scale; l.range = LL.range * S.scale; l.visibility = layer;
        this.lampBase = l.luminance; l.luminance = 0; l.enabled = false; this.lampLight = l; this.stats.lampLight = 'sphere-light';
      }
    } catch (e) { this.lampLight = null; this.stats.lampLight = 'failed:' + String(e); console.warn('[T9_PROPS] lamp light unavailable', String(e)); }
    try {
      const fx = EffectAsset.get('builtin-unlit'); const tech = fx ? fx.techniques.findIndex(t => t.name === 'add') : -1; if (tech < 0) return;
      const R = LL.reflection, g = softEllipse(0, R.rx, R.rz), mesh = utils.createMesh({ positions: g.positions, normals: g.normals, colors: g.colors, indices: g.indices }, undefined, { calculateBounds: true });
      this.water.meshes.push(mesh);
      const m = new Material(); m.initialize({ effectName: 'builtin-unlit', technique: tech, defines: { USE_VERTEX_COLOR: true } }); const c = new Color(R.color); c.a = 0; m.setProperty('mainColor', c);
      const yaw = S.yawDeg * Math.PI / 180, x = R.x * S.scale;
      const n = new Node('SignLampReflection'); n.layer = this.root.layer; this.root.addChild(n);
      n.setPosition(S.position[0] + x * Math.cos(yaw), ISLAND_PROPS.seaY + R.lift, S.position[2] - x * Math.sin(yaw)); n.setRotationFromEuler(0, S.yawDeg, 0); n.setScale(S.scale, 1, S.scale);
      const r = n.addComponent(MeshRenderer); r.mesh = mesh; r.setMaterial(m, 0); r.shadowCastingMode = MeshRenderer.ShadowCastingMode.OFF; r.receiveShadow = MeshRenderer.ShadowReceivingMode.OFF;
      n.active = false; this.glow = { node: n, material: m };
    } catch (e) { this.glow = null; console.warn('[T9_PROPS] lamp reflection unavailable', String(e)); }
  }
  /** Current world-camera pose (read-only; camera is written by CameraPose.applyCameraPose only). */
  pose(): CameraPose | null {
    const c = this.camera; if (!c || !isValid(c, true) || !isValid(c.node, true)) return null;
    const p = c.node.worldPosition, q = c.node.worldRotation;
    return { position: [p.x, p.y, p.z], rotation: [q.x, q.y, q.z, q.w], fovVerticalDeg: c.fov };
  }
  /** Once per frame from the host. exterior = island exterior layer visible; buttons = island dock is showing. */
  sync(o: { exterior: boolean; night: boolean; buttons: boolean; width: number; height: number; dock?: { dy: number; k: number } }) {
    if (!this.ready || !isValid(this.root, true)) return;
    if (this.root.active !== o.exterior) this.root.active = o.exterior;
    this.view.width = o.width; this.view.height = o.height;
    const now = game.totalTime / 1000, first = this.lastTime < 0, dt = first ? 0 : now - this.lastTime; this.lastTime = now;
    // first sync snaps to the current mode (no fade at startup); afterwards a switch fades over nightFadeS
    this.nightW = first ? (o.night ? 1 : 0) : approachNight(this.nightW, o.night, dt);
    this.stats.nightWeight = +this.nightW.toFixed(3); setPropNightWeight(this.nightW);
    // lamp glass day/night material: swapped at the middle of the fade (light is half up), not at the switch instant
    const lampNight = this.nightW >= 0.5;
    if (this.night !== lampNight) {
      this.night = lampNight;
      if (this.lamp && isValid(this.lamp, true) && !this.fade.length) { const m = lampNight ? (this.lampNightMat ?? this.palette) : this.lampDay; if (m) { this.lamp.setSharedMaterial(m, 0); this.stats.lampSwaps++; } }
    }
    if (o.exterior) this.tickWater(this.nightW);
    const pose = o.buttons && o.exterior ? this.pose() : null;
    const slots = pose && o.width > 0 && o.height > 0 ? propButtonLayout(o.width, o.height).slots : [];
    for (const role of PROP_ROLES) {
      const n = this.buttons.get(role)!, slot = slots.find(s => s.role === role);
      if (!pose || !slot) { if (n.active) n.active = false; continue; }
      // follow the flat dock's T2 entrance (slide + scale about the canvas centre) so the 3D buttons enter with it
      const k = o.dock?.k ?? 1, dy = o.dock?.dy ?? 0;
      const [sx, sy] = uiToScreen(slot.prop.x * k, slot.prop.bottom * k + dy, o.width, o.height);
      const a = seaAnchor(pose, o.width / o.height, sx, sy, slot.prop.height * k, o.height, ISLAND_PROPS.buttons[role].heightM);
      n.setWorldPosition(a.point[0], a.point[1], a.point[2]); n.setRotationFromEuler(0, a.yawDeg, 0); n.setScale(a.scale, a.scale, a.scale);
      if (!n.active) n.active = true;
    }
  }
  /**
   * Signpost entrance step (T2+ sequence, after the bottom-row buttons). e = eased progress from the host's
   * applyIslandEntrance (same 0.25 s, same cubic ease-out); risePx = the same screen slide the buttons use, converted to
   * metres at the sign so it rises out of the water. 0 < e < 1 fades via temporary transparent copies of the shared
   * materials (same effect, its "transparent" technique, alpha = e); e = 1 restores the shared materials (no lasting swap).
   * Water shadow/ripples follow the same alpha. e = 0 hides the sign.
   */
  setSignEntrance(e: number, risePx = 0) {
    const sign = this.sign; if (!this.ready || !sign || !isValid(sign, true)) return;
    e = Math.max(0, Math.min(1, e)); if (e === this.entrance && risePx === 0) return;
    this.entrance = e; this.stats.entrance = +e.toFixed(3);
    const S = ISLAND_PROPS.signpost; let rise = 0;
    if (risePx > 0 && e < 1) { const pose = this.pose(), r = pose && this.view.height > 0 ? signpostRectUi(pose, this.view.width, this.view.height) : null; if (r && r.height > 0) rise = risePx * (S.boxMax[1] - S.boxMin[1]) * S.scale / r.height; }
    sign.setPosition(S.position[0], S.position[1] - rise, S.position[2]);
    if (sign.active !== e > 0) sign.active = e > 0;
    if (this.signText && isValid(this.signText, true)) this.signText.opacity = Math.round(255 * e);
    if (e >= 1 || e <= 0) { this.endFade(); return; }
    if (!this.fade.length) this.beginFade();
    for (const f of this.fade) { const c = (f.m.getProperty('mainColor') as Color | null)?.clone?.() ?? new Color(255, 255, 255, 255); c.a = Math.round(255 * e); f.m.setProperty('mainColor', c); }
  }
  private beginFade() {
    for (const r of this.sign!.getComponentsInChildren(MeshRenderer)) {
      if (r.node.name === 'SignLampGlow') continue; // additive glow fades by its own alpha
      const count = Math.max(1, r.sharedMaterials.length);
      for (let i = 0; i < count; i++) {
        const shared = r.sharedMaterials[i]; if (!shared || !shared.effectAsset) continue;
        const tech = shared.effectAsset.techniques.findIndex(t => t.name === 'transparent'); if (tech < 0) continue;
        try { const m = new Material(); m.copy(shared, { technique: tech }); r.setMaterial(m, i); this.fade.push({ r, i, m }); } catch (e) { console.warn('[T9_PROPS] sign fade unavailable', String(e)); }
      }
    }
    this.stats.fadeMaterials = this.fade.length;
  }
  private endFade() {
    if (!this.fade.length) return;
    for (const f of this.fade) {
      if (isValid(f.r, true)) f.r.setSharedMaterial(f.r === this.lamp ? (this.night ? (this.lampNightMat ?? this.palette) : this.lampDay) ?? this.palette! : this.palette!, f.i);
      f.m.destroy();
    }
    this.fade = [];
  }
  /** Mainline hit rect (>= 88x88, see signpostHitUi) of the signpost in UI units (centre origin) for the live camera, or null when not usable. */
  signRect(width: number, height: number): Rect | null {
    if (!this.ready || !this.root.active) return null; const pose = this.pose(); if (!pose || !(width > 0) || !(height > 0)) return null;
    const r = signpostHitUi(pose, width, height); if (!r) return null;
    return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) };
  }
  dispose() { if (this.disposed) return; this.endFade(); this.restoreSea(); this.lampGlow?.material.destroy(); this.lampGlow = null; this.glow?.material.destroy(); this.glow = null; this.lampLight = null; this.signLabel = null; setPropNightWeight(0); this.disposed = true; this.ready_ = false; for (const m of this.water.meshes) m.destroy(); this.water.shadow?.destroy(); for (const r of this.water.ripples) r.material.destroy(); this.water = { meshes: [], shadow: null, ripples: [] }; this.buttons.clear(); this.palms = []; this.sign = null; this.lamp = null; if (isValid(this.root, true)) this.root.destroy(); this.lampNightMat?.destroy(); this.lampNightMat = null; }
}
