import { _decorator, BlockInputEvents, Camera, Color, Component, EffectAsset, Graphics, Layers, Material, MeshRenderer, Node, Sprite, SpriteFrame, RenderTexture, UITransform, director, isValid, resources, sys, utils, view } from 'cc';
import { artButton, artSprite, makeLabel, TintSet } from './PopupKit';
import { uiNightWeight } from './NightTint';
import { ENDING_ART, endingLayout, endingLayoutChecks, endingSwayDeg } from '../world-r2/EndingFlow';
import { ENDING_CHIME, chimePartSwing, endingChimeParts, type ChimePart } from '../world-r2/EndingChimeGeometry';
import { EndingChimeSway } from './EndingChimeSway';
import { EndingChime3D } from './EndingChime3D';
/** Ending screen v2 (UI设计部 SPEC §3 @94b821fd + Grok Bot: board on the post removed, night rendered on its own).
 *  Layers, back to front: lake-view render (day / night render, chosen once at build), live low-poly 3D wind chime (built in code,
 *  EndingChimeGeometry; each tube swings on its own, the whole chime ±4° / 3.2 s around its hang point on the post arm),
 *  night warm glow, the girl (whole body, between seals and button), bottom shade,
 *  「旅程完成」 plank, four seals, ONE button 「回小岛」 inset ≥24 pt. Text total: 7 characters. Swallows touches.
 *  ready() turns true when the art has loaded (or failed → warm gradient fallback) so the WindWipe reveal waits for it. */
type Part = 'bg' | 'chime' | 'girl';
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
    const pivot = this.ui(n, 'EndingChimePivot', 1, 1); pivot.setPosition(X(L.hang.x), Y(L.hang.y), 0); pivot.addComponent(EndingChimeSway);
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
