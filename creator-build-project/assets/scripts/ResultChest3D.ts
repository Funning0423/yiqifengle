import { Camera, Color, Layers, Material, MeshRenderer, Node, Prefab, Quat, RenderTexture, SphereLight, Sprite, SpriteFrame, UITransform, Vec3, assetManager, director, instantiate, isValid } from 'cc';
import { BoardArt } from './ui/BoardArt';
import { ISLAND_PROPS } from './world-r2/IslandPropsLayout';
/** Reward chest (c-popups/glb/result_chest.glb, bundle board_art/chest): rendered off-screen into a RenderTexture shown by
 *  a UI Sprite. The GLB carries M_env_palette_piece without textures, so every renderer is rebound to the island's shared
 *  M_env_palette material (same palette UVs). The lid (child `chest_lid`, origin on the hinge) follows the GLB's
 *  `chest_open` keys: 0.5 s, 0 → −126° → −114° → −118°, ending open so the inside is visible from the 36° camera. */
export const CHEST_LAYER = 1 << 19;
export const CHEST_PIXELS = 512;
const ORIGIN = new Vec3(10000, 10000, 10000);
/** chest_open rotation keys (degrees about +X), sampled every 1/30 s from the GLB. */
export const LID_KEYS: readonly number[] = [0, -4.32, -15.9, -32.67, -52.54, -73.46, -93.33, -110.1, -121.68, -126, -122.89, -117.11, -114, -115.04, -116.96, -118];
export const OPEN_SECONDS = 0.5;
export function lidAngleAt(t: number): number {
  const x = Math.max(0, Math.min(OPEN_SECONDS, t)) * 30, i = Math.min(LID_KEYS.length - 2, Math.floor(x)), f = x - i;
  return LID_KEYS[i] + (LID_KEYS[i + 1] - LID_KEYS[i]) * f;
}
/** SPEC v2.2: 3/4 top-down view, pitch 36°, from the front-right (azimuth 38°, so top, front and right side all show),
 *  fov 36° (≈ 55 mm), distance 5.6. One look-at height for both states (no re-framing jump when the lid opens): 0.68, not
 *  the SPEC's 0.42 / 0.55, because at 0.55 the lid's bounding box leaves the square frame top mid-sweep (−93°, 0.511 > 0.5).
 *  The closed chest then spans 60% of the frame width, its centre 2.8% below the frame centre. */
export const CHEST_CAMERA = { pitchDeg: 36, azimuthDeg: 38, fovDeg: 36, target: [0, 0.68, 0] as const, distance: 5.6 };
export function chestCameraPosition(): number[] {
  const p = CHEST_CAMERA.pitchDeg * Math.PI / 180, a = CHEST_CAMERA.azimuthDeg * Math.PI / 180, t = CHEST_CAMERA.target, d = CHEST_CAMERA.distance;
  return [t[0] + d * Math.cos(p) * Math.sin(a), t[1] + d * Math.sin(p), t[2] + d * Math.cos(p) * Math.cos(a)];
}
/** Outline (SPEC v2.2): ≈ 1.5 pt #4A2810 by expanding the silhouette (8 offset copies of the render behind it), not an inverted hull. */
export const CHEST_OUTLINE = { enabled: true, width: 1.5, color: [0x4a, 0x28, 0x10] };
function find(n: Node, name: string): Node | null {
  if (n.name === name) return n; for (let i = 0; i < n.children.length; i++) { const r = find(n.children[i], name); if (r) return r; } return null;
}
/** UI设计部 SPEC v2.2 chest look (every number lives here, easy to tweak). Blender (x, y, z-up) → Cocos (x, z, −y).
 *  Per-chest material instance: albedoScale (1.10, 1.06, 1.00), roughness 0.6, specular 0.35 (less plastic).
 *  Key: near-overhead from the top-left, #FFEDCC ×4 (a far sphere light standing in for the SPEC's directional light,
 *  so the island's main light is untouched); fill low front-right #CCE0FF ×0.4 so the sides fall one step darker;
 *  rim behind/above #FFD18C ×1.1 to pick out the lid's top edge; InnerGlow #FFCC6B ×1.4 r2.2 only once open. */
export const CHEST_LOOK = {
  material: { albedoScale: [1.10, 1.06, 1.0], roughness: 0.6, specularIntensity: 0.35 } as { albedoScale: number[]; roughness: number; specularIntensity?: number; mainColor?: number[]; emissive?: number[] } | null,
  lights: {
    key: { pos: [-1.6, 6, 1.4], color: '#ffedcc', lum: 4, range: 14 },
    fill: { pos: [4, 1.5, 3], color: '#cce0ff', lum: 0.4, range: 10 },
    rim: { pos: [0.5, 3.5, -3.5], color: '#ffd18c', lum: 1.1, range: 9 },
    inner: { pos: [0, 0.95, 0], color: '#ffcc6b', lum: 1.4, range: 2.2 },
  },
};
function warm(r: MeshRenderer, k: number) {
  const t = CHEST_LOOK.material; if (!t) return;
  try { const m = r.getMaterialInstance(k); if (!m) return;
    const set = (name: string, v: any) => { try { m.setProperty(name, v); } catch { } };
    set('albedoScale', new Vec3(t.albedoScale[0], t.albedoScale[1], t.albedoScale[2])); set('roughness', t.roughness); if (t.specularIntensity !== undefined) set('specularIntensity', t.specularIntensity);
    if (t.mainColor) set('mainColor', new Color(t.mainColor[0], t.mainColor[1], t.mainColor[2], 255));
    if (t.emissive) set('emissive', new Color(t.emissive[0], t.emissive[1], t.emissive[2], 255));
  } catch { }
}
function setLayer(n: Node, layer: number) { n.layer = layer; for (let i = 0; i < n.children.length; i++) setLayer(n.children[i], layer); }
export class ResultChest3D {
  readonly sprite: Sprite;
  private rig: Node | null = null; private lid: Node | null = null; private camera: Camera | null = null;
  private texture: RenderTexture | null = null; private frame: SpriteFrame | null = null;
  private t = 0; private playing = false; private disposed = false; private state = 'loading'; private error = '';
  private rest = new Quat(); private q = new Quat(); private inner: Node | null = null;
  private outline: Sprite[] = []; private root: Node;
  constructor(host: Node, size: number) {
    const n = new Node('ResultChest3D'); n.layer = Layers.Enum.UI_2D; host.addChild(n); this.root = n;
    n.addComponent(UITransform).setContentSize(size, size);
    const make = (name: string) => { const c = new Node(name); c.layer = Layers.Enum.UI_2D; n.addChild(c); c.addComponent(UITransform).setContentSize(size, size); const sp = c.addComponent(Sprite); sp.sizeMode = Sprite.SizeMode.CUSTOM; sp.trim = false; return sp; };
    if (CHEST_OUTLINE.enabled) for (let k = 0; k < 8; k++) { const sp = make('ChestOutline-' + k); const c = CHEST_OUTLINE.color; sp.color = new Color(c[0], c[1], c[2], 255); this.outline.push(sp); }
    this.sprite = make('ChestImage');
  }
  /** Container node: BoardPanels positions and sizes it; the render and its outline copies follow (see sync()). */
  get node() { return this.root; }
  private sync() {
    const ui = this.root.getComponent(UITransform); if (!ui) return; const w = ui.width, h = ui.height, o = CHEST_OUTLINE.width;
    const all = [...this.outline, this.sprite];
    for (let i = 0; i < all.length; i++) { const sp = all[i]; if (!isValid(sp, true)) continue; const t = sp.node.getComponent(UITransform)!; if (t.width !== w || t.height !== h) t.setContentSize(w, h); }
    for (let k = 0; k < this.outline.length; k++) { const a = k * Math.PI / 4; if (isValid(this.outline[k], true)) this.outline[k].node.setPosition(Math.round(Math.cos(a) * o * 100) / 100, Math.round(Math.sin(a) * o * 100) / 100, 0); }
  }
  get ready() { return this.state === 'ready'; }
  async load(): Promise<boolean> {
    try {
      const prefab: Prefab | null = await BoardArt.shared().chestPrefab();
      if (this.disposed) return false; if (!prefab) throw Error('chest prefab unavailable');
      const palette = await new Promise<Material | null>(ok => assetManager.loadAny({ uuid: ISLAND_PROPS.paletteMaterialUuid }, (e: any, m: Material) => ok(e || !m ? null : m)));
      if (this.disposed) return false;
      const scene = director.getScene(); if (!scene || !isValid(this.sprite, true)) throw Error('no scene');
      const rig = new Node('ResultChestRig'); scene.addChild(rig); rig.setWorldPosition(ORIGIN); this.rig = rig;
      const model = instantiate(prefab); rig.addChild(model); setLayer(model, CHEST_LAYER);
      if (palette) { const rs = model.getComponentsInChildren(MeshRenderer); for (let i = 0; i < rs.length; i++) { const r = rs[i]; for (let k = 0; k < r.sharedMaterials.length; k++) { r.setSharedMaterial(palette, k); warm(r, k); } r.shadowCastingMode = MeshRenderer.ShadowCastingMode.OFF; } }
      this.lid = find(model, 'chest_lid'); if (this.lid) this.rest.set(this.lid.rotation);
      const light = (name: string, p: number[], color: string, lum: number, range: number) => {
        const ln = new Node(name); ln.layer = CHEST_LAYER; rig.addChild(ln); ln.setPosition(p[0], p[1], p[2]);
        const l = ln.addComponent(SphereLight); l.color = new Color(color); l.size = 0.4; l.range = range; l.luminance = l.luminance * lum; l.visibility = CHEST_LAYER; return ln;
      };
      const L = CHEST_LOOK.lights;
      light('KeyLight', L.key.pos, L.key.color, L.key.lum, L.key.range); light('FillLight', L.fill.pos, L.fill.color, L.fill.lum, L.fill.range);
      light('RimLight', L.rim.pos, L.rim.color, L.rim.lum, L.rim.range); this.inner = light('InnerGlow', L.inner.pos, L.inner.color, L.inner.lum, L.inner.range);
      const cn = new Node('ResultChestCamera'); cn.layer = CHEST_LAYER; rig.addChild(cn); const cp = chestCameraPosition(); cn.setPosition(cp[0], cp[1], cp[2]);
      cn.lookAt(new Vec3(ORIGIN.x + CHEST_CAMERA.target[0], ORIGIN.y + CHEST_CAMERA.target[1], ORIGIN.z + CHEST_CAMERA.target[2]));
      const cam = cn.addComponent(Camera); cam.projection = Camera.ProjectionType.PERSPECTIVE; cam.fov = CHEST_CAMERA.fovDeg; cam.fovAxis = Camera.FOVAxis.VERTICAL;
      cam.near = 0.5; cam.far = 30; cam.visibility = CHEST_LAYER; cam.clearFlags = Camera.ClearFlag.SOLID_COLOR; cam.clearColor = new Color(0, 0, 0, 0); cam.priority = 45; cam.usePostProcess = false;
      const rt = new RenderTexture(); rt.reset({ width: CHEST_PIXELS, height: CHEST_PIXELS }); cam.targetTexture = rt; this.texture = rt; this.camera = cam;
      const f = new SpriteFrame(); f.texture = rt; f.packable = false; this.frame = f;
      if (!isValid(this.sprite, true)) throw Error('host destroyed');
      this.sprite.spriteFrame = f; for (let k = 0; k < this.outline.length; k++) this.outline[k].spriteFrame = f; this.sync(); this.apply(); this.state = 'ready'; return true;
    } catch (e) { this.state = 'failed'; this.error = String(e); console.warn('[RESULT_CHEST] 3D chest unavailable', this.error); this.disposeRig(); return false; }
  }
  /** Start the 0.5 s open animation (or jump to the end). */
  open(animate = true) { this.t = animate ? 0 : OPEN_SECONDS; this.playing = animate; this.apply(); }
  close() { this.t = 0; this.playing = false; this.apply(); }
  update(dt: number) { if (this.state === 'ready') this.sync(); if (!this.playing) return; this.t = Math.min(OPEN_SECONDS, this.t + Math.max(0, Math.min(dt, 0.1))); if (this.t >= OPEN_SECONDS) this.playing = false; this.apply(); }
  angle() { return lidAngleAt(this.t); }
  private apply() { if (this.inner && isValid(this.inner, true)) this.inner.active = this.t > 0; if (!this.lid || !isValid(this.lid, true)) return; Quat.fromEuler(this.q, lidAngleAt(this.t), 0, 0); Quat.multiply(this.q, this.rest, this.q); this.lid.setRotation(this.q); }
  diagnostics() { return { state: this.state, error: this.error, t: this.t, angle: this.angle(), pixels: CHEST_PIXELS, layer: CHEST_LAYER, camera: CHEST_CAMERA, outline: this.outline.length ? CHEST_OUTLINE.width : 0 }; }
  private disposeRig() {
    if (this.camera && isValid(this.camera, true)) { this.camera.targetTexture = null; this.camera.enabled = false; }
    if (this.rig && isValid(this.rig, true)) this.rig.destroy(); this.rig = null; this.lid = null; this.camera = null;
  }
  dispose() {
    if (this.disposed) return; this.disposed = true;
    if (isValid(this.sprite, true)) this.sprite.spriteFrame = null; for (let k = 0; k < this.outline.length; k++) if (isValid(this.outline[k], true)) this.outline[k].spriteFrame = null;
    this.disposeRig(); this.frame?.destroy(); this.frame = null; this.texture?.destroy(); this.texture = null;
  }
}
