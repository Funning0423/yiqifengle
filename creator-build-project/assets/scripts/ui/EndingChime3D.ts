import { _decorator, Camera, Color, Component, EffectAsset, Material, MeshRenderer, Node, Sprite, SpriteFrame, RenderTexture, director, isValid, resources, utils } from 'cc';
import { ENDING_CHIME, chimePartSwing, endingChimeParts, type ChimePart } from '../world-r2/EndingChimeGeometry';
const { ccclass } = _decorator;
const CHIME_LAYER = 1 << 16;
/** Live low-poly chime: code-built meshes (no asset), lit by the existing ui/warm-button-lit studio effect (vertex colours, fixed
 *  key/fill, sRGB out), rendered by an ortho camera on its own layer into a RenderTexture shown by the chime Sprite. */
@ccclass('EndingChime3D')
export class EndingChime3D extends Component {
  private rig: Node | null = null; private cam: Camera | null = null; private rt: RenderTexture | null = null; private frame: SpriteFrame | null = null;
  private mat: Material | null = null; private effect: EffectAsset | null = null; private parts: { n: Node; p: ChimePart }[] = []; private t = 0; private dead = false;
  build(sprite: Sprite, night: boolean, w: number, h: number, done: (ok: boolean, why?: string) => void) {
    resources.load('ui/warm-button-lit', EffectAsset, (err, effect) => {
      if (this.dead || !isValid(this.node, true)) return done(false, 'disposed');
      if (err || !effect) return done(false, String(err || 'effect'));
      try {
        const scene = director.getScene(); if (!scene) throw Error('no scene');
        if (!scene.getComponentsInChildren(Camera).every(c => (c.visibility & CHIME_LAYER) === 0)) throw Error('chime layer 16 visible to a scene camera');
        this.effect = effect; effect.addRef(); this.mat = new Material(); this.mat.initialize({ effectAsset: effect }); if (!this.mat.passes.length) throw Error('no passes');
        const C = ENDING_CHIME, rig = new Node('EndingChimeRig'); rig.layer = CHIME_LAYER; scene.addChild(rig); rig.setPosition(-30000, -30000, -30000); this.rig = rig;
        const model = new Node('EndingChimeModel'); model.layer = CHIME_LAYER; rig.addChild(model); model.setRotationFromEuler(C.tiltDeg, 0, 0);
        for (const p of endingChimeParts(night)) { const n = new Node(p.name); n.layer = CHIME_LAYER; model.addChild(n); n.setPosition(p.pivot[0], p.pivot[1], p.pivot[2]);
          const r = n.addComponent(MeshRenderer); r.mesh = utils.createMesh(p.geom, undefined, { calculateBounds: true }); r.setSharedMaterial(this.mat, 0); r.shadowCastingMode = MeshRenderer.ShadowCastingMode.OFF; this.parts.push({ n, p }); }
        const cn = new Node('EndingChimeCamera'); cn.layer = CHIME_LAYER; rig.addChild(cn); cn.setPosition(0, -C.boxH / 2, 500);
        const cam = cn.addComponent(Camera); cam.projection = Camera.ProjectionType.ORTHO; cam.orthoHeight = C.boxH / 2; cam.near = 1; cam.far = 1000; cam.visibility = CHIME_LAYER;
        cam.clearFlags = Camera.ClearFlag.SOLID_COLOR; cam.clearColor = new Color(0, 0, 0, 0); cam.priority = 43; cam.usePostProcess = false;
        // 3 px per screen point, ≤512 wide: sharp on 3× screens, ~1.2 MB GPU
        const px = Math.max(1, Math.min(512, Math.ceil(w * 3))), py = Math.max(1, Math.round(px * h / w));
        const rt = new RenderTexture(); rt.reset({ width: px, height: py }); (rt as any).setFilters?.(2, 2); cam.targetTexture = rt; this.cam = cam; this.rt = rt;
        const f = new SpriteFrame(); f.texture = rt; f.packable = false; this.frame = f; sprite.spriteFrame = f; this.tick(0); done(true);
      } catch (e) { this.release(); done(false, String(e)); }
    });
  }
  private tick(dt: number) { this.t += Math.min(dt, .1); for (const { n, p } of this.parts) { const [z, x] = chimePartSwing(p.swing, this.t); n.setRotationFromEuler(x, 0, z); } }
  update(dt: number) { if (this.parts.length) this.tick(dt); }
  private release() {
    if (this.cam && isValid(this.cam, true)) { this.cam.targetTexture = null; this.cam.enabled = false; } this.cam = null;
    if (this.rig && isValid(this.rig, true)) this.rig.destroy(); this.rig = null; this.parts = [];
    this.frame?.destroy(); this.frame = null; this.rt?.destroy(); this.rt = null; this.mat?.destroy(); this.mat = null; this.effect?.decRef(); this.effect = null;
  }
  onDestroy() { this.dead = true; this.release(); }
}
