import { Node, Camera, Material, MeshRenderer, EffectAsset, Label, UITransform, UIOpacity, RenderRoot2D, Color, Vec3, Vec4, Layers, resources, utils, isValid, screen } from 'cc';

/**
 * Glass sign v4-refined3.2 (运镜bot, approved prototype glass-panel-v4refined3.2-20261016T1419Z).
 * A world-space capsule glass card in the home room: 0.80 x 0.28 m, centre (0.05, 1.02, -4.70), world X/Y axes,
 * bob 0.012 m / 3.2 s. Tapping it plays the prototype's 27-frame feedback (scale, ring, ripple, fade) and then leaves
 * home through the normal leaveHome path. Edge AA lives in resources/world/glass-sign.effect (SDF + derivatives):
 * refined2 rim (inset 0.75 local px, 1.3 CSS px, white .43 r^.6) + top highlight (inset 2.2, white .8, width
 * 1.2 r^.6 CSS px, ends faded over 15 %). r = projected card width / 123.2 CSS px. No full-screen MSAA/FXAA.
 * Not reproduced from the CSS prototype: backdrop-filter blur(14px) saturate(1.4) (needs a scene-colour grab pass).
 */
export const GLASS_SIGN = Object.freeze({
  centre: [0.05, 1.02, -4.70] as const, widthM: 0.80, heightM: 0.28, bobAmp: 0.012, bobPeriod: 3.2,
  px: [280, 100] as const, pad: [130, 85] as const, refWidthCss: 123.2,
  rim: { alpha: 0.43, gamma: 0.6, widthCss: 1.3 }, top: { alpha: 0.8, widthCss: 1.2, gamma: 0.6 },
  caption: '出发去看海', leaf: '🍃', leaveAtFrame: 27,
});

export class GlassSign {
  readonly root: Node;
  private card: Node; private text: Node; private textOpacity: UIOpacity | null = null;
  private material: Material | null = null; private renderer: MeshRenderer | null = null;
  private t = 0; private tapT: number | null = null; private left = false; private shown = false; private disposed = false;
  private corners: Vec3[] = [new Vec3(), new Vec3(), new Vec3(), new Vec3()];
  private box: { l: number; r: number; t: number; b: number } | null = null; private onScreen = false;
  private stats = { effect: 'loading' as string, frames: 0 };

  constructor(scene: Node, private camera: Camera, private leave: () => void) {
    const S = GLASS_SIGN;
    this.root = new Node('GlassSignV4R32'); scene.addChild(this.root);
    this.root.layer = (camera.visibility & Layers.Enum.DEFAULT) ? Layers.Enum.DEFAULT : this.firstLayer(camera.visibility);
    this.root.setPosition(S.centre[0], S.centre[1], S.centre[2]); this.root.active = false;
    this.card = new Node('GlassSignCard'); this.card.layer = this.root.layer; this.root.addChild(this.card);
    this.text = new Node('GlassSignText'); this.text.layer = this.root.layer; this.root.addChild(this.text);
    this.buildText();
    resources.load('world/glass-sign', EffectAsset, (err: Error | null, fx: EffectAsset | null) => {
      if (this.disposed) return;
      if (err || !fx) { this.stats.effect = 'failed:' + String(err); console.warn('[GLASS_SIGN] effect unavailable', String(err)); return; }
      try { this.buildCard(fx); this.stats.effect = 'ready'; } catch (e) { this.stats.effect = 'failed:' + String(e); console.warn('[GLASS_SIGN] build failed', String(e)); }
    });
  }
  private firstLayer(mask: number) { for (let i = 0; i < 20; i++) if (mask & (1 << i)) return 1 << i; return Layers.Enum.DEFAULT; }
  /** One quad covering the card plus its shadow / ring / ripple margin; uv = sign-local px (card 0..280 x 0..100, y down). */
  private buildCard(fx: EffectAsset) {
    const S = GLASS_SIGN, sx = S.widthM / S.px[0], sy = S.heightM / S.px[1];
    const x0 = -S.pad[0], x1 = S.px[0] + S.pad[0], y0 = -S.pad[1], y1 = S.px[1] + S.pad[1];
    const P = (x: number, y: number) => [(x - S.px[0] / 2) * sx, -(y - S.px[1] / 2) * sy, 0];
    const mesh = utils.createMesh({ positions: [...P(x0, y0), ...P(x1, y0), ...P(x1, y1), ...P(x0, y1)], normals: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1],
      uvs: [x0, y0, x1, y0, x1, y1, x0, y1], indices: [0, 3, 2, 0, 2, 1] }, undefined, { calculateBounds: true });
    const m = new Material(); m.initialize({ effectAsset: fx, technique: 0 }); this.material = m;
    const r = this.card.addComponent(MeshRenderer); r.mesh = mesh; r.setMaterial(m, 0);
    r.shadowCastingMode = MeshRenderer.ShadowCastingMode.OFF; r.receiveShadow = MeshRenderer.ShadowReceivingMode.OFF; this.renderer = r;
  }
  /** Caption: world-camera Label (RenderRoot2D), system font, white 600 34px + soft dark shadow, leaf 30px + 12px gap. */
  private buildText() {
    const S = GLASS_SIGN, k = S.widthM / S.px[0];
    this.text.setScale(k, S.heightM / S.px[1], 1); this.text.setPosition(0, 0, 0.001);
    this.text.addComponent(RenderRoot2D); this.text.addComponent(UITransform).setContentSize(S.px[0], S.px[1]); this.textOpacity = this.text.addComponent(UIOpacity);
    const add = (name: string, s: string, size: number, x: number, w: number) => {
      const n = new Node(name); n.layer = this.root.layer; this.text.addChild(n); n.addComponent(UITransform).setContentSize(w, S.px[1]); n.setPosition(x, 1, 0);
      const l = n.addComponent(Label); l.string = s; l.fontSize = size; l.lineHeight = size + 4; l.isBold = true; l.fontFamily = 'Noto Sans CJK SC, PingFang SC, sans-serif';
      l.color = new Color(255, 255, 255, 255); l.horizontalAlign = Label.HorizontalAlign.CENTER; l.verticalAlign = Label.VerticalAlign.CENTER;
      l.enableShadow = true; l.shadowColor = new Color(0, 40, 60, 115); l.shadowOffset.set(0, -1); l.shadowBlur = 6; (l as any).spacingX = 4; return l;
    };
    // CSS: leaf (30px) + 12px margin + caption (34px, letter-spacing 4px), centred as one line
    const capW = 5 * 34 + 5 * 4, leafW = 34, total = leafW + 12 + capW;
    add('Leaf', S.leaf, 30, -total / 2 + leafW / 2, leafW + 8); add('Caption', S.caption, 34, -total / 2 + leafW + 12 + capW / 2, capW + 8);
  }
  /** Prototype tap feedback timeline (frames at 30 fps after the tap). */
  private feedback() {
    const cl = (x: number) => Math.max(0, Math.min(1, x)), eo = (x: number) => 1 - Math.pow(1 - x, 3);
    if (this.tapT === null) return { sc: 1, ring: 0, k: 0, rip: -1, ripA: 0, op: 1, f: -1 };
    const f = (this.t - this.tapT) * 30;
    const sc = f < 4 ? 1 - 0.08 * eo(f / 4) : (f < 10 ? 0.92 + 0.05 * Math.sin(cl((f - 4) / 6) * Math.PI / 2) : 0.97);
    const ring = f < 3 ? 0 : (f < 10 ? (f - 3) / 7 : 1 - cl((f - 10) / 9)), k = cl((f - 10) / 9);
    const rr = cl((f - 6) / 18), rip = f < 6 ? -1 : rr, ripA = f < 6 ? 0 : 1 - rr;
    return { sc, ring, k, rip, ripA, op: 1 - cl((f - 16) / 10), f };
  }
  /** Called every frame by the host. visible = home room view is up and input is allowed. */
  sync(dt: number, visible: boolean) {
    if (this.disposed) return;
    this.t += dt; this.stats.frames++;
    const want = (visible || this.tapT !== null) && !this.left;
    if (!want) { this.root.active = false; this.shown = false; this.onScreen = false; this.box = null; if (!visible) this.tapT = null; return; }
    const S = GLASS_SIGN, bob = S.bobAmp * Math.sin(2 * Math.PI * this.t / S.bobPeriod), fb = this.feedback();
    this.root.setPosition(S.centre[0], S.centre[1] + bob, S.centre[2]);
    // project the card corners (same test as the prototype: hidden when any corner is off the depth range)
    const cam = this.camera.camera; let ok = !!cam; const hw = S.widthM / 2, hh = S.heightM / 2;
    const xs: number[] = [], ys: number[] = [];
    if (cam) for (let i = 0; i < 4; i++) {
      const sx = i === 0 || i === 3 ? -1 : 1, sy = i < 2 ? 1 : -1, o = this.corners[i];
      cam.worldToScreen(o, new Vec3(S.centre[0] + sx * hw, S.centre[1] + sy * hh + bob, S.centre[2]));
      if (o.z < 0 || o.z > 1) ok = false; xs.push(o.x); ys.push(o.y);
    }
    this.onScreen = ok; this.root.active = ok; this.shown = ok;
    if (!ok) { this.box = null; return; }
    this.box = { l: Math.min(...xs), r: Math.max(...xs), t: Math.max(...ys), b: Math.min(...ys) }; // screen px, y up
    const dpr = screen.devicePixelRatio || 1, r = (this.box.r - this.box.l) / dpr / S.refWidthCss;
    const localPerPx = S.px[0] / Math.max(1, this.box.r - this.box.l);
    if (this.material) {
      this.material.setProperty('params0', new Vec4(Math.min(1, S.rim.alpha * Math.pow(r, S.rim.gamma)), S.top.widthCss * Math.pow(r, S.top.gamma) * dpr, S.rim.widthCss * dpr, fb.op));
      this.material.setProperty('params1', new Vec4(fb.sc, fb.ring, fb.rip, fb.k));
      this.material.setProperty('params2', new Vec4(fb.ripA, 0, localPerPx, dpr));
    }
    this.text.setScale(fb.sc * S.widthM / S.px[0], fb.sc * S.heightM / S.px[1], 1);
    if (this.textOpacity) this.textOpacity.opacity = Math.round(255 * fb.op);
    if (fb.f >= S.leaveAtFrame && !this.left) { this.left = true; this.root.active = false; this.leave(); }
  }
  /** Tap test in screen px (y up, same space as Camera.worldToScreen / EventTouch.getLocation). Starts the feedback. */
  tap(x: number, y: number): boolean {
    if (!this.hit(x, y) || this.tapT !== null || this.left) return false;
    this.tapT = this.t; return true;
  }
  hit(x: number, y: number) { const b = this.box; return !!b && this.shown && this.onScreen && x >= b.l && x <= b.r && y >= b.b && y <= b.t; }
  busy() { return this.tapT !== null && !this.left; }
  /** After a leave, the next home visit shows the sign again. */
  reset() { this.tapT = null; this.left = false; }
  diagnostics() { return { ...this.stats, visible: this.root.active, box: this.box ? { ...this.box } : null, corners: this.box ? this.corners.map(c => [c.x, c.y]) : null, tapped: this.tapT !== null, left: this.left, layer: this.root.layer }; }
  dispose() { if (this.disposed) return; this.disposed = true; if (isValid(this.root, true)) this.root.destroy(); this.material?.destroy(); this.material = null; }
}
