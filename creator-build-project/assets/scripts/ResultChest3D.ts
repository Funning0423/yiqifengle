import { Camera, Color, Layers, Material, MeshRenderer, Node, Prefab, Quat, RenderTexture, SphereLight, Sprite, SpriteFrame, UITransform, Vec3, assetManager, director, instantiate, isValid } from 'cc';
import { BoardArt } from './ui/BoardArt';
import { ISLAND_PROPS } from './world-r2/IslandPropsLayout';
/** Reward chest (c-popups/glb/result_chest.glb, bundle board_art/chest): rendered off-screen into a RenderTexture shown by
 *  a UI Sprite. The GLB carries M_env_palette_piece without textures, so every renderer is rebound to the island's shared
 *  M_env_palette material (same palette UVs). The lid (child `chest_lid`, origin on the hinge) follows the GLB's
 *  `chest_open` keys: 0.5 s, 0 → −126° → −114° → −118°, ending open so the inside is visible from the 40° camera. */
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
/** Camera pitched 40° down at the chest; framing covers the whole lid sweep (highest point ≈ y 2.0 at −93°). */
export const CHEST_CAMERA = { pitchDeg: 40, fovDeg: 30, target: [0, 0.9, -0.35] as const, distance: 5.9 };
export function chestCameraPosition(): number[] {
  const p = CHEST_CAMERA.pitchDeg * Math.PI / 180, t = CHEST_CAMERA.target, d = CHEST_CAMERA.distance;
  return [t[0], t[1] + d * Math.sin(p), t[2] + d * Math.cos(p)];
}
function find(n: Node, name: string): Node | null {
  if (n.name === name) return n; for (let i = 0; i < n.children.length; i++) { const r = find(n.children[i], name); if (r) return r; } return null;
}
/** UI设计部 SPEC v2.1 chest look (pending Funning's confirmation, so every number lives here and is easy to tweak):
 *  same model + island M_env_palette, a per-chest material instance brightened with albedoScale and roughness 0.55,
 *  KeyLight 3.2, FillLight unchanged, a new RimLight behind/above, InnerGlow only once the lid opens. */
export const CHEST_LOOK = {
  material: { albedoScale: [1.12, 1.08, 1.0], roughness: 0.55 } as { albedoScale: number[]; roughness: number; mainColor?: number[]; emissive?: number[] } | null,
  lights: {
    key: { pos: [-1.6, 3.2, 2.6], color: '#fff1d8', lum: 3.2, range: 9 },
    fill: { pos: [2.2, 1.6, 2.2], color: '#dbe9ff', lum: 1, range: 8 },
    rim: { pos: [0, 1.8, -2.5], color: '#ffd9a0', lum: 1.2, range: 8 },
    inner: { pos: [0, 0.95, 0], color: '#ffd890', lum: 1.4, range: 2.2 },
  },
};
function warm(r: MeshRenderer, k: number) {
  const t = CHEST_LOOK.material; if (!t) return;
  try { const m = r.getMaterialInstance(k); if (!m) return;
    const set = (name: string, v: any) => { try { m.setProperty(name, v); } catch { } };
    set('albedoScale', new Vec3(t.albedoScale[0], t.albedoScale[1], t.albedoScale[2])); set('roughness', t.roughness);
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
  constructor(host: Node, size: number) {
    const n = new Node('ResultChest3D'); n.layer = Layers.Enum.UI_2D; host.addChild(n);
    n.addComponent(UITransform).setContentSize(size, size);
    this.sprite = n.addComponent(Sprite); this.sprite.sizeMode = Sprite.SizeMode.CUSTOM; this.sprite.trim = false;
  }
  get node() { return this.sprite.node; }
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
      this.sprite.spriteFrame = f; this.apply(); this.state = 'ready'; return true;
    } catch (e) { this.state = 'failed'; this.error = String(e); console.warn('[RESULT_CHEST] 3D chest unavailable', this.error); this.disposeRig(); return false; }
  }
  /** Start the 0.5 s open animation (or jump to the end). */
  open(animate = true) { this.t = animate ? 0 : OPEN_SECONDS; this.playing = animate; this.apply(); }
  close() { this.t = 0; this.playing = false; this.apply(); }
  update(dt: number) { if (!this.playing) return; this.t = Math.min(OPEN_SECONDS, this.t + Math.max(0, Math.min(dt, 0.1))); if (this.t >= OPEN_SECONDS) this.playing = false; this.apply(); }
  angle() { return lidAngleAt(this.t); }
  private apply() { if (this.inner && isValid(this.inner, true)) this.inner.active = this.t > 0; if (!this.lid || !isValid(this.lid, true)) return; Quat.fromEuler(this.q, lidAngleAt(this.t), 0, 0); Quat.multiply(this.q, this.rest, this.q); this.lid.setRotation(this.q); }
  diagnostics() { return { state: this.state, error: this.error, t: this.t, angle: this.angle(), pixels: CHEST_PIXELS, layer: CHEST_LAYER }; }
  private disposeRig() {
    if (this.camera && isValid(this.camera, true)) { this.camera.targetTexture = null; this.camera.enabled = false; }
    if (this.rig && isValid(this.rig, true)) this.rig.destroy(); this.rig = null; this.lid = null; this.camera = null;
  }
  dispose() {
    if (this.disposed) return; this.disposed = true;
    if (isValid(this.sprite, true)) this.sprite.spriteFrame = null;
    this.disposeRig(); this.frame?.destroy(); this.frame = null; this.texture?.destroy(); this.texture = null;
  }
}
