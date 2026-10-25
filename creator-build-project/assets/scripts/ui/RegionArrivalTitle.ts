import { Color, Graphics, Label, Layers, Node, TTFFont, UIOpacity, UITransform, assetManager, isValid } from 'cc';
import { uiNightWeight } from './NightTint';
import { REGION_TITLE, REGION_TITLE_TYPE as TY, regionTitleInk, regionTitleLook, regionTitleState, regionTitleStyle, regionTitleTable } from './RegionArrivalTitleCore';
export { REGION_TITLE_STYLE, REGION_TITLE_A, REGION_TITLE_B, regionTitleState } from './RegionArrivalTitleCore';
/** 地名开局淡入 view (UI设计部 SPEC v1.1 §8): one node on the board UI root, above the Toast, centred on BoardLayout.toast.y.
 *  Layers bottom-up: B radial dark halo (Graphics rings, soft, no plate) → tight shade Label (outline = spread) → main Label
 *  (TTF QFLRegionTitle, Label shadow = soft shadow by day / glow at night, off at night in B) → 44×1 fading line. UIOpacity carries
 *  the timeline alpha × the night max alpha. No Button / BlockInputEvents / touch listeners: every touch reaches the board. */
export const REGION_TITLE_FONT = { bundle: 'board_art', path: 'font/QFLRegionTitle' } as const;
const rgba = (c: readonly number[], a: number) => new Color(c[0], c[1], c[2], Math.max(0, Math.min(255, Math.round(255 * a))));
function uiNode(name: string, parent: Node) { const n = new Node(name); n.layer = Layers.Enum.UI_2D; parent.addChild(n); n.addComponent(UITransform); return n; }
let fontPromise: Promise<TTFFont | null> | null = null;
function loadFont(): Promise<TTFFont | null> {
  if (fontPromise) return fontPromise;
  fontPromise = new Promise<TTFFont | null>(ok => {
    const got = (b: any) => { if (!b) { ok(null); return; } b.load(REGION_TITLE_FONT.path, TTFFont, (e: any, f: TTFFont) => ok(e || !f ? null : f)); };
    try { const b = assetManager.getBundle(REGION_TITLE_FONT.bundle); if (b) got(b); else assetManager.loadBundle(REGION_TITLE_FONT.bundle, (e, b2) => got(e ? null : b2)); } catch { ok(null); }
  }).then(f => { if (!f) fontPromise = null/* retry next time; the system font draws meanwhile */; return f; });
  return fontPromise;
}
export class RegionArrivalTitle {
  readonly node: Node; private op: UIOpacity; private body: Node; private halo: Graphics; private tight: Label; private main: Label; private line: Graphics;
  private t = -1; private text = ''; private y = 0; private screenW = 390; private lastLook = '';
  constructor(parent: Node) {
    this.node = uiNode('RegionArrivalTitle', parent); this.op = this.node.addComponent(UIOpacity); this.op.opacity = 0;
    this.body = uiNode('Body', this.node);
    this.halo = uiNode('Halo', this.body).addComponent(Graphics);
    this.tight = this.label('TightShade'); this.main = this.label('RegionName');
    this.line = uiNode('Line', this.body).addComponent(Graphics);
    this.node.active = false;
    void loadFont().then(f => { if (f && isValid(this.node, true)) { for (const l of [this.tight, this.main]) { l.useSystemFont = false; l.font = f; } } });
  }
  private label(name: string): Label {
    const n = uiNode(name, this.body); n.getComponent(UITransform)!.setContentSize(360, TY.lineHeight);
    const l = n.addComponent(Label); l.fontSize = TY.font; l.lineHeight = TY.lineHeight; l.isBold = false; (l as any).spacingX = 4/* §3: 3.6, Cocos rounds; 4 allowed */;
    l.horizontalAlign = Label.HorizontalAlign.CENTER; l.verticalAlign = Label.VerticalAlign.CENTER; l.overflow = Label.Overflow.NONE; l.enableWrapText = false;
    return l;
  }
  /** start the 2.0 s timeline now (presentForPlay or the first ready frame of a new region) */
  show(id: keyof typeof REGION_TITLE) {
    this.text = REGION_TITLE[id]; this.t = 0; this.main.string = this.tight.string = this.text; this.lastLook = '';
    const ink = regionTitleInk(this.text, this.screenW); this.main.fontSize = this.tight.fontSize = ink.font;
    this.node.active = true; this.apply(0);
  }
  /** layout: BoardLayout.toast.y (top-down pt) on a w×h screen; Canvas centred */
  place(w: number, h: number, toastY: number) { this.screenW = w; this.y = h / 2 - toastY; this.node.setPosition(0, this.y, 0); }
  showing() { return this.t >= 0; }
  update(dt: number) { if (this.t < 0 || !isValid(this.node, true)) return; this.t += Math.max(0, Math.min(dt, 0.1)); this.apply(this.t); }
  private apply(t: number) {
    const st = regionTitleState(t); if (st.done) { this.t = -1; this.op.opacity = 0; this.node.active = false; return; }
    const look = regionTitleLook(uiNightWeight(), regionTitleTable());
    this.body.setPosition(0, -st.dy, 0); this.op.opacity = Math.round(255 * st.alpha * look.maxAlpha);
    const key = JSON.stringify(look) + this.text; if (key === this.lastLook) return; this.lastLook = key; this.paint(look);
    (globalThis as any).__qfRegionTitle = { text: this.text, glowA: look.glowA, haloA: look.haloA, style: regionTitleStyle() };
  }
  private paint(L: ReturnType<typeof regionTitleLook>) {
    const m: any = this.main, k: any = this.tight;
    this.main.color = rgba(L.fill, 1);
    m.enableShadow = L.shadowA > 0.01; m.shadowColor = rgba(L.shadow, L.shadowA); m.shadowOffset = { x: 0, y: -L.shadowDy }; m.shadowBlur = Math.round(L.shadowBlur);
    // tight shade: same glyphs in the shade colour; the outline is the "spread", its own shadow softens the edge (§10.4)
    this.tight.color = rgba(L.tight, L.tightA); this.tight.node.setPosition(0, -0.5, 0);
    k.enableOutline = L.tightSpread > 0.2; k.outlineColor = rgba(L.tight, L.tightA); k.outlineWidth = Math.max(1, Math.round(L.tightSpread));
    k.enableShadow = true; k.shadowColor = rgba(L.tight, L.tightA * 0.6); k.shadowOffset = { x: 0, y: 0 }; k.shadowBlur = Math.max(1, Math.round(L.tightBlur));
    const ink = regionTitleInk(this.text, this.screenW);
    // B halo: ellipse rx = ink/2 + 30, ry = ink/2 + 18; smoothstep falloff drawn as soft concentric rings (no visible edge)
    const g = this.halo; g.clear();
    if (L.halo && L.haloA > 0.001) {
      const rx = ink.w / 2 + L.haloPadX, ry = ink.h / 2 + L.haloPadY, N = 14; let prev = 0;
      for (let i = 1; i <= N; i++) { const r = 1 - (i - 1) / N, s = 1 - r, a = s * s * (3 - 2 * s), da = Math.max(0, a - prev); prev = a;
        if (da <= 0) continue; g.fillColor = rgba(L.haloRgb, L.haloA * da); g.ellipse(0, 0, rx * r, ry * r); g.fill(); }
    }
    // §3 line: 44×1, 7 pt under the glyphs, ends fade (sin^1.5), alpha = 0.5 × text
    const ln = this.line, y = -ink.h / 2 - TY.lineGap + 3, seg = 11; ln.clear();
    for (let i = 0; i < seg; i++) { const x0 = -TY.lineW / 2 + TY.lineW * i / seg, u = (i + 0.5) / seg, a = Math.pow(Math.sin(Math.PI * u), 1.5) * TY.lineA;
      ln.fillColor = rgba(L.fill, a); ln.rect(x0, y, TY.lineW / seg + 0.2, TY.lineH); ln.fill(); }
  }
  diagnostics() { return { showing: this.showing(), t: this.t, text: this.text, y: this.y, opacity: this.op.opacity, blocksInput: false }; }
  dispose() { if (isValid(this.node, true)) this.node.destroy(); }
}
