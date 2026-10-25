import { _decorator, BlockInputEvents, Camera, Color, Component, EffectAsset, Graphics, Layers, Material, MeshRenderer, Node, Sprite, SpriteFrame, RenderTexture, UITransform, director, isValid, resources, sys, utils, view } from 'cc';
import { artButton, artSprite, makeLabel, TintSet } from './PopupKit';
import { uiNightWeight } from './NightTint';
import { ENDING_ART, endingLayout, endingLayoutChecks, endingSwayDeg } from '../world-r2/EndingFlow';
import { ENDING_CHIME, chimePartSwing, endingChimeParts, type ChimePart } from '../world-r2/EndingChimeGeometry';
/** Ending screen v2 (UI设计部 SPEC §3 @94b821fd + Grok Bot: board on the post removed, night rendered on its own).
 *  Layers, back to front: lake-view render (day / night render, chosen once at build), live low-poly 3D wind chime (built in code,
 *  EndingChimeGeometry; each tube swings on its own, the whole chime ±4° / 3.2 s around its hang point on the post arm),
 *  night warm glow, the girl (whole body, between seals and button), bottom shade,
 *  「旅程完成」 plank, four seals, ONE button 「回小岛」 inset ≥24 pt. Text total: 7 characters. Swallows touches.
 *  ready() turns true when the art has loaded (or failed → warm gradient fallback) so the WindWipe reveal waits for it. */
type Part = 'bg' | 'chime' | 'girl';
const { ccclass } = _decorator;
@ccclass('EndingChimeSway')
class ChimeSway extends Component { t = 0; update(dt: number) { this.t += Math.min(dt, .1); this.node.angle = endingSwayDeg(this.t); } }
const CHIME_LAYER = 1 << 16;
/** Live low-poly chime: code-built meshes (no asset), lit by the existing ui/warm-button-lit studio effect (vertex colours, fixed
 *  key/fill, sRGB out), rendered by an ortho camera on its own layer into a RenderTexture shown by the chime Sprite. */
@ccclass('EndingChime3D')
class EndingChime3D extends Component {
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
export class EndingScreen {
  readonly node: Node; private tint = new TintSet(); private alive = true; private pending = 3; private failed: string[] = [];
  readonly night: boolean; readonly layout: ReturnType<typeof endingLayout>;
  constructor(parent: Node, a: { home(): void; safeBottom?: number }) {
    const vs = view.getVisibleSize(), w = vs.width, h = vs.height, L = endingLayout(w, h, a.safeBottom ?? 0), night = uiNightWeight() > .5;
    this.night = night; this.layout = L;
    const X = (x: number) => x - w / 2, Y = (y: number) => h / 2 - y;   // top-left design points → centred cc points
    const n = new Node('EndingScreen'); n.layer = Layers.Enum.UI_2D; parent.addChild(n); n.addComponent(UITransform).setContentSize(w, h); n.addComponent(BlockInputEvents); this.node = n;
    // fallback backdrop (visible only until / unless the render loads)
    const fb = this.ui(n, 'EndingFallback', w, h); const g = fb.addComponent(Graphics);
    const top = night ? [0x0a, 0x10, 0x24] : [0x7f, 0xb6, 0xc8], bot = night ? [0x18, 0x22, 0x2c] : [0x7e, 0xa8, 0x5a];
    for (let i = 0; i < 12; i++) { const u = i / 11; g.fillColor = new Color(Math.round(top[0] + (bot[0] - top[0]) * u), Math.round(top[1] + (bot[1] - top[1]) * u), Math.round(top[2] + (bot[2] - top[2]) * u), 255); g.rect(-w / 2 - 2, h / 2 - (i + 1) * h / 12, w + 4, h / 12 + 1); g.fill(); }
    const mode = night ? 'night' : 'day';
    const bg = this.ui(n, 'EndingLake', L.bg.w, L.bg.h); bg.setPosition(X(L.bg.x + L.bg.w / 2), Y(L.bg.y + L.bg.h / 2), 0); this.load(bg, 'bg', ENDING_ART.dir + 'end_bg_' + mode);
    const cw = L.chime.x1 - L.chime.x0, chh = L.chime.y1 - L.chime.y0;
    const pivot = this.ui(n, 'EndingChimePivot', 1, 1); pivot.setPosition(X(L.hang.x), Y(L.hang.y), 0); pivot.addComponent(ChimeSway);
    const ch = this.ui(pivot, 'EndingChime', cw, chh); ch.setPosition(0, -chh / 2, 0);
    { const sp = ch.addComponent(Sprite); sp.sizeMode = Sprite.SizeMode.CUSTOM; sp.trim = false;
      ch.addComponent(EndingChime3D).build(sp, night, cw, chh, (ok, why) => { this.pending--; if (!ok) { this.failed.push('chime'); console.warn('[Ending] 3D chime unavailable', why); } }); }
    if (night) { const gl = this.ui(n, 'EndingChimeGlow', 2, 2); gl.setPosition(X(L.hang.x), Y((L.chime.y0 + L.chime.y1) / 2), 0); const gg = gl.addComponent(Graphics), c = ENDING_ART.nightGlow.color;
      for (let i = 10; i >= 1; i--) { gg.fillColor = new Color(c[0], c[1], c[2], Math.round(255 * ENDING_ART.nightGlow.alpha / 10)); gg.circle(0, 0, L.glowR * i / 10); gg.fill(); } }
    const gw = L.girl.x1 - L.girl.x0, gh = L.girl.y1 - L.girl.y0;
    const sh = this.ui(n, 'EndingGirlShadow', 2, 2); sh.setPosition(X((L.girl.x0 + L.girl.x1) / 2), Y(L.girl.y1 - gh * .01), 0); const sg = sh.addComponent(Graphics);
    sg.fillColor = night ? new Color(0, 0, 0, 90) : new Color(30, 40, 20, 80); sg.ellipse(0, 0, gw * .75, Math.max(3, gh * .04)); sg.fill();
    const girl = this.ui(n, 'EndingGirl', gw, gh); girl.setPosition(X((L.girl.x0 + L.girl.x1) / 2), Y((L.girl.y0 + L.girl.y1) / 2), 0); this.load(girl, 'girl', ENDING_ART.dir + 'end_girl_' + mode);
    // bottom 30 % shade (no panel)
    const sd = this.ui(n, 'EndingShade', w, h); const sdg = sd.addComponent(Graphics), S = night ? ENDING_ART.shade.night : ENDING_ART.shade.day, from = ENDING_ART.shade.from;
    for (let i = 0; i < 16; i++) { const u0 = from + (1 - from) * i / 16, u1 = from + (1 - from) * (i + 1) / 16; sdg.fillColor = new Color(S.rgb[0], S.rgb[1], S.rgb[2], Math.round(255 * S.a * (i + .5) / 16)); sdg.rect(-w / 2 - 2, h / 2 - u1 * h, w + 4, (u1 - u0) * h + 1); sdg.fill(); }
    const plank = artSprite(n, 'popup/title_plank_3s', 0, Y(L.titleCy), 196, 58, 'EndingPlank'); this.tint.sprite(plank, 'ui');
    const t = makeLabel(n, '旅程完成', 0, Y(L.titleCy) + 2, 24, { width: 190, name: 'EndingTitle' }); t.color = new Color(0x5a, 0x3a, 0x1e, 255); (t as any).spacingX = 3;
    ['tide', 'meadow', 'sky', 'lake'].forEach((r, i) => { const s = artSprite(n, 'popup/reward_seal_' + r, (i - 1.5) * 58, Y(L.sealsCy), 44, 44, 'Seal-' + r); this.tint.sprite(s, 'ui'); });
    artButton(n, this.tint, 'primary', '回小岛', 0, Y(L.buttonCy), L.buttonW, L.buttonH, () => { if (this.alive) a.home(); }, { fontSize: 20, name: 'EndingHome', sound: 'back' });
    this.tint.update(true);
    (globalThis as any).__qfEndingScreen = () => ({ night, ready: this.ready(), loaded: 3 - this.pending - this.failed.length, failed: this.failed.slice(), size: [w, h], layout: L, checks: endingLayoutChecks(w, h, a.safeBottom ?? 0) });
  }
  private ui(parent: Node, name: string, w: number, h: number) { const c = new Node(name); c.layer = Layers.Enum.UI_2D; parent.addChild(c); c.addComponent(UITransform).setContentSize(w, h); return c; }
  private load(node: Node, part: Part, path: string) {
    const s = node.addComponent(Sprite); s.sizeMode = Sprite.SizeMode.CUSTOM; s.trim = false;
    resources.load(path + '/spriteFrame', SpriteFrame, (err: Error | null, f: SpriteFrame | null) => {
      this.pending--;
      if (err || !f) { this.failed.push(part); console.warn('[Ending] art unavailable ' + path, String(err || 'null')); return; }
      if (isValid(node, true)) s.spriteFrame = f;
    });
  }
  /** Built and art settled (loaded or failed with fallback) — gates the WindWipe reveal. */
  ready() { return this.alive && isValid(this.node, true) && this.pending <= 0; }
  dispose() { this.alive = false; if (isValid(this.node, true)) this.node.destroy(); }
}
/** Journey-complete marker (display only; campaign saves are owned by the providers and already written at result.saved). */
export function markJourneyComplete() { try { sys.localStorage.setItem('qf-journey-complete', String(Date.now())); } catch { /* storage optional */ } }
