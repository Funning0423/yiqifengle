import { Node, Sprite, UITransform, Layers, Color, isValid } from 'cc';
import { BoardArt } from '../ui/BoardArt';
import { reducedMotion } from '../ui/UiPrefs';
/** Cabin hint (INTEGRATION §8, c-popups round3/cabin_hint.py): no bubble, no text. On the first return to the island the
 *  cabin windows / door glow and breathe three times, then rest at 0.25 until the cabin is tapped once (qfl.ui.cabinHintSeen).
 *  Not night-tinted (the glow is light). Normal blending: additive/screen sprites are unverified on WeChat devices. */
export const CABIN_HINT = { inS: 0.4, upS: 0.7, downS: 0.9, breaths: 3, rest: 0.25, reduced: 0.6, outS: 0.3 } as const;
export const CABIN_HINT_TOTAL_S = CABIN_HINT.inS + CABIN_HINT.breaths * (CABIN_HINT.upS + CABIN_HINT.downS);
/** 750×1624 island-picture px (the picture fills the screen like a cover-fit background). */
export const CABIN_SPOTS: ReadonlyArray<{ name: string; box: readonly [number, number, number, number]; k: number }> = [
  { name: 'dormer', box: [438, 652, 456, 676], k: 1 },
  { name: 'front', box: [472, 737, 502, 772], k: 1 },
  { name: 'door', box: [435, 744, 462, 808], k: 0.7 },
];
const ease = (x: number) => 0.5 - 0.5 * Math.cos(Math.PI * Math.max(0, Math.min(1, x)));
export function cabinHintIntensity(t: number, reduced = false): number {
  if (reduced) return CABIN_HINT.reduced;
  if (t < CABIN_HINT.inS) return CABIN_HINT.rest * ease(t / CABIN_HINT.inS);
  t -= CABIN_HINT.inS;
  for (let i = 0; i < CABIN_HINT.breaths; i++) {
    if (t < CABIN_HINT.upS) return CABIN_HINT.rest + (1 - CABIN_HINT.rest) * ease(t / CABIN_HINT.upS); t -= CABIN_HINT.upS;
    if (t < CABIN_HINT.downS) return 1 - (1 - CABIN_HINT.rest) * ease(t / CABIN_HINT.downS); t -= CABIN_HINT.downS;
  }
  return CABIN_HINT.rest;
}
export function cabinSpotRect(width: number, height: number, box: readonly number[]) {
  const s = Math.max(width / 750, height / 1624), cx = (box[0] + box[2]) / 2, cy = (box[1] + box[3]) / 2, r = Math.max(box[2] - box[0], box[3] - box[1]) * 1.6;
  return { x: (cx - 375) * s, y: (812 - cy) * s, size: r * 2 * s };
}
export class CabinHint {
  private root: Node; private spots: Sprite[] = []; private t = -1; private out = -1; private dead = false;
  constructor(parent: Node) {
    this.root = new Node('CabinHint'); this.root.layer = Layers.Enum.UI_2D; parent.addChild(this.root); this.root.setSiblingIndex(0); this.root.addComponent(UITransform); this.root.active = false;
    for (const spot of CABIN_SPOTS) {
      const n = new Node('CabinGlow-' + spot.name); n.layer = Layers.Enum.UI_2D; this.root.addChild(n); n.addComponent(UITransform);
      const s = n.addComponent(Sprite); s.sizeMode = Sprite.SizeMode.CUSTOM; s.trim = false; this.spots.push(s);
    }
    void BoardArt.shared().load('r3');
  }
  get active() { return !this.dead && this.t >= 0 && this.out < 0; }
  start() { if (this.dead || this.t >= 0) return; this.t = 0; this.out = -1; }
  /** Tapped: 0.3 s fade from the current level, then gone for good. */
  dismiss() { if (this.dead || this.t < 0 || this.out >= 0) return; this.out = 0; }
  intensity() {
    if (this.t < 0) return 0; const base = cabinHintIntensity(this.t, reducedMotion());
    return this.out < 0 ? base : base * Math.max(0, 1 - this.out / CABIN_HINT.outS);
  }
  update(dt: number, width: number, height: number, visible: boolean) {
    if (this.dead || !isValid(this.root, true)) return;
    if (this.t >= 0) { const step = Math.max(0, Math.min(dt, 0.1)); if (visible || this.out >= 0) this.t += step; if (this.out >= 0) this.out += step; }
    if (this.out >= CABIN_HINT.outS) { this.t = -1; this.out = -1; this.dispose(); return; }
    const on = visible && this.t >= 0; this.root.active = on; if (!on) return;
    const frame = BoardArt.shared().frame('r3/cabin_glow'), i = this.intensity();
    for (let k = 0; k < this.spots.length; k++) {
      const s = this.spots[k], spot = CABIN_SPOTS[k], r = cabinSpotRect(width, height, spot.box);
      if (frame && s.spriteFrame !== frame) s.spriteFrame = frame;
      s.node.setPosition(r.x, r.y, 0); s.node.getComponent(UITransform)!.setContentSize(r.size, r.size);
      s.color = new Color(255, 214, 140, Math.round(255 * Math.min(1, 0.85 * i * spot.k)));
    }
  }
  diagnostics() { return { active: this.active, t: this.t, out: this.out, intensity: this.intensity(), visible: !this.dead && this.root.active }; }
  dispose() { if (this.dead) return; this.dead = true; if (isValid(this.root, true)) this.root.destroy(); }
}
