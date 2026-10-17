import { Sprite, SpriteFrame, Node, Camera, Material, MeshRenderer, EffectAsset, Label, UITransform, UIOpacity, RenderRoot2D, Color, Vec3, Vec4, Layers, resources, utils, isValid, screen } from 'cc';
import { uiNightWeight } from '../ui/NightTint';

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
  caption: '出发去看海', leaf: { size: 44, png: 'world/glass-sign-leaf/spriteFrame', bbox: [7, 41, 48] as const, gap: 6 } as const, leaveAtFrame: 27,
  text: { color: [255, 255, 255, 255] as const, shadow: [0, 40, 60, 115] as const, shadowBlur: 6 },
});

/**
 * Night-only glass set (运镜bot, cine/night-glass-r4; Funning on 09a1b8e: night button too bright / milky).
 * Blended by uiNightWeight() (0 day .. 1 night, same 0.5 s approach as every night UI). At weight 0 every value
 * resolves to GLASS_SIGN exactly, so the approved day refine 3.2 is untouched.
 * - baseAlpha: multiplier on the white base layer (gradient + inner glow) -> walls and window light read through.
 * - baseTint: base colour at night (sRGB multiplier of white) = the room's dark warm wood/stone, not grey-white.
 * - rim: rim alpha multiplier (<= .5 of day), rimTint: faint chandelier warmth; top: top highlight multiplier
 *   (0 = only one thin rim reflection remains).
 * - text: warm white caption (TEXT_NIGHT.white) + thin dark-warm outline and soft shadow; no white backing.
 */
export const GLASS_SIGN_NIGHT = Object.freeze({
  baseAlpha: 0.45, baseTint: [0.22, 0.15, 0.09] as const,
  rim: 0.45, rimTint: [1.0, 0.86, 0.66] as const, top: 0.0,
  text: { color: [232, 226, 212, 255] as const, shadow: [20, 12, 5, 200] as const, shadowBlur: 3, outline: [38, 24, 12, 230] as const, outlineWidth: 1.5 },
});
const lerp = (a: number, b: number, t: number) => a * (1 - t) + b * t; // exact at both ends
/** Glass params at night weight w (exported for tests). w = 0 returns the day refine 3.2 values bit-for-bit. */
export function glassSignLook(w: number) {
  const t = Math.max(0, Math.min(1, Number.isFinite(w) ? w : 0)), N = GLASS_SIGN_NIGHT, D = GLASS_SIGN.text;
  const c4 = (a: readonly number[], b: readonly number[]) => [0, 1, 2, 3].map(i => Math.round(lerp(a[i], b[i], t)));
  return {
    w: t, params3: [lerp(1, N.baseAlpha, t), lerp(1, N.rim, t), lerp(1, N.top, t), 0],
    params4: [lerp(1, N.baseTint[0], t), lerp(1, N.baseTint[1], t), lerp(1, N.baseTint[2], t), 0],
    params5: [lerp(1, N.rimTint[0], t), lerp(1, N.rimTint[1], t), lerp(1, N.rimTint[2], t), 0],
    text: c4(D.color, N.text.color), shadow: c4(D.shadow, N.text.shadow), shadowBlur: lerp(D.shadowBlur, N.text.shadowBlur, t),
    outline: t > 0 ? [N.text.outline[0], N.text.outline[1], N.text.outline[2], Math.round(N.text.outline[3] * t)] : null, outlineWidth: N.text.outlineWidth,
  };
}

export class GlassSign {
  readonly root: Node;
  private card: Node; private text: Node; private textOpacity: UIOpacity | null = null;
  private material: Material | null = null; private renderer: MeshRenderer | null = null;
  private t = 0; private tapT: number | null = null; private left = false; private shown = false; private disposed = false;
  private corners: Vec3[] = [new Vec3(), new Vec3(), new Vec3(), new Vec3()];
  private box: { l: number; r: number; t: number; b: number } | null = null; private onScreen = false;
  private stats = { effect: 'loading' as string, frames: 0, night: 0 };
  private labels: Label[] = []; private lookW = -1;

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
      const l = n.addComponent(Label); l.string = s; l.fontSize = size; l.lineHeight = size + 4; l.isBold = true; l.fontFamily = 'sans-serif'; // bold system face (CSS 600); an outline pass merged strokes into blobs
      l.color = new Color(255, 255, 255, 255); l.horizontalAlign = Label.HorizontalAlign.CENTER; l.verticalAlign = Label.VerticalAlign.CENTER;
      l.enableShadow = true; l.shadowColor = new Color(0, 40, 60, 115); l.shadowOffset.set(0, -1); l.shadowBlur = 6; (l as any).spacingX = 4; this.labels.push(l); return l;
    };
    // G2b: leaf = 48x48 PNG (two leaves #6DBA3C/#A6DB6A, stem, thin dark outline; 8x supersampled then downscaled) drawn at
    // 44 px, visible leaf ~37 px = 1.1x the 34 px caption. Gap 6 px between the VISIBLE leaf edge (PNG bbox x 7..41 of 48) and
    // the measured caption; that group is centred on the card.
    const cap = add('Caption', S.caption, 34, 0, 0); cap.overflow = Label.Overflow.NONE; cap.horizontalAlign = Label.HorizontalAlign.LEFT;
    cap.updateRenderData(true); const measured = cap.node.getComponent(UITransform)!.width;
    const capW = Number.isFinite(measured) && measured > 0 ? measured : 5 * 34 + 4 * 4, g = glassSignGroup(capW);
    cap.node.setPosition(g.captionX, 1, 0);
    const leaf = new Node('Leaf'); leaf.layer = this.root.layer; this.text.addChild(leaf); leaf.addComponent(UITransform).setContentSize(S.leaf.size, S.leaf.size);
    leaf.setPosition(g.leafX, 1, 0); const sp = leaf.addComponent(Sprite); sp.sizeMode = Sprite.SizeMode.CUSTOM;
    resources.load(S.leaf.png, SpriteFrame, (err: Error | null, f: SpriteFrame | null) => { if (err || !f || !isValid(sp, true)) { if (err) console.warn('[GlassSign] leaf png unavailable', String(err)); return; } sp.spriteFrame = f; });
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
    const look = glassSignLook(uiNightWeight()); this.stats.night = look.w; this.applyTextLook(look);
    if (this.material) {
      this.material.setProperty('params0', new Vec4(Math.min(1, S.rim.alpha * Math.pow(r, S.rim.gamma)), S.top.widthCss * Math.pow(r, S.top.gamma) * dpr, S.rim.widthCss * dpr, fb.op));
      this.material.setProperty('params1', new Vec4(fb.sc, fb.ring, fb.rip, fb.k));
      this.material.setProperty('params2', new Vec4(fb.ripA, look.w, localPerPx, dpr));
      this.material.setProperty('params3', new Vec4(...(look.params3 as [number, number, number, number])));
      this.material.setProperty('params4', new Vec4(...(look.params4 as [number, number, number, number])));
      this.material.setProperty('params5', new Vec4(...(look.params5 as [number, number, number, number])));
    }
    this.text.setScale(fb.sc * S.widthM / S.px[0], fb.sc * S.heightM / S.px[1], 1);
    if (this.textOpacity) this.textOpacity.opacity = Math.round(255 * fb.op);
    if (fb.f >= S.leaveAtFrame && !this.left) { this.left = true; this.root.active = false; this.leave(); }
  }
  /** Caption colours follow the night weight; only touched when the weight moves, so day keeps the built Label as is. */
  private applyTextLook(look: ReturnType<typeof glassSignLook>) {
    const q = Math.round(look.w * 255); if (q === this.lookW) return; const first = this.lookW < 0; this.lookW = q;
    if (first && q === 0) return; // day from the start: the day Label stays exactly as built
    for (const l of this.labels) {
      if (!isValid(l, true)) continue;
      l.color = new Color(look.text[0], look.text[1], look.text[2], look.text[3]);
      l.shadowColor = new Color(look.shadow[0], look.shadow[1], look.shadow[2], look.shadow[3]); l.shadowBlur = look.shadowBlur;
      if (look.outline) { l.enableOutline = true; l.outlineColor = new Color(look.outline[0], look.outline[1], look.outline[2], look.outline[3]); l.outlineWidth = look.outlineWidth; }
      else l.enableOutline = false;
    }
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

/** G2b: centred group geometry (card-local px, centre 0): visible leaf width + gap + caption. */
export function glassSignGroup(captionW: number) {
  const L = GLASS_SIGN.leaf, k = L.size / L.bbox[2], visL = L.bbox[0] * k, visW = (L.bbox[1] - L.bbox[0]) * k;
  const total = visW + L.gap + captionW, left = -total / 2;
  return { total, visW, gap: L.gap, leafX: left - visL + L.size / 2, captionX: left + visW + L.gap + captionW / 2 };
}
