import { Color, Graphics, Label, Layers, Node, UIOpacity, UITransform, director, isValid, sys } from 'cc';
import { makeLabel } from './PopupKit';
import { uiNightWeight } from './NightTint';
import { LAKESIDE_TOUCHDOWN } from '../region/LakesideBalloon';
import { LAKESIDE_SKIP_SPEC as SK, arrivalAnchor, canSkipLakesideRide, lakesideRide, runLakesideRideSkip, seenT03, signState, skipAlpha, skipPlacement, type ArrivalAnchor } from '../region/LakesideArrivalCore';
import { onWipeRevealed } from '../world-r1/ScreenCover';
/** T-03 风铃湖畔 「跳过」badge (UI设计部 SPEC §6). The landing plank sign was removed by the region-title SPEC §1 (00bae3e7): no
 *  UI over a transition; 风铃湖畔 fades in at L13's start (ui/RegionArrivalTitle.ts). The arrival anchor is still tracked (timing only).
 *  Badge: from the 2nd viewing (seenT03), only during the visible flight; tap → 0.94 press → WindWipe kind 'ride' (host.wipe)
 *  → under the cover runLakesideRideSkip() (the ride jumps to touchdown) → reveal → the sign at reveal + 0.3 s. */
export interface LakesideArrivalHost {
  now(): number;
  /** runs a WindWipe kind 'ride' with this work under the cover; resolves after the reveal */
  wipeRide(work: () => Promise<any>, ready: () => boolean): Promise<unknown>;
  safe(w: number, h: number): { top: number; bottom: number; capsuleBottom: number | null };
}
const col = (c: readonly number[], a = 1) => new Color(c[0], c[1], c[2], Math.round(255 * a));
export class LakesideArrivalUI {
  readonly node: Node;
  private badge: Node; private badgeOp: UIOpacity; private pill: Graphics; private badgeLabel: Label;
  private anchor: ArrivalAnchor | null = null; private skipping = false; private pressT = -1; private seen = false; private lastRide = false;
  private offEv: () => void; private offRev: () => void; private skipWipe = false;
  constructor(parent: Node, private host: LakesideArrivalHost) {
    const n = new Node('LakesideArrival'); n.layer = Layers.Enum.UI_2D; parent.addChild(n); n.addComponent(UITransform).setContentSize(1, 1); this.node = n;
    this.badge = new Node('LakesideSkip'); this.badge.layer = Layers.Enum.UI_2D; n.addChild(this.badge); this.badge.addComponent(UITransform).setContentSize(SK.hitW, SK.hitH); this.badgeOp = this.badge.addComponent(UIOpacity);
    const g = new Node('Pill'); g.layer = Layers.Enum.UI_2D; this.badge.addChild(g); g.addComponent(UITransform).setContentSize(SK.w, SK.h); this.pill = g.addComponent(Graphics);
    this.badgeLabel = makeLabel(g, SK.text, -7, 0, SK.font, { width: 40, name: 'SkipText' });
    this.badge.on(Node.EventType.TOUCH_END, () => this.tap()); this.badge.active = false;
    const onTouch = (e: any) => { if (e?.skipped) return/* the skip reveal anchors the sign */; this.anchor = arrivalAnchor(this.host.now(), 'touchdown', LAKESIDE_TOUCHDOWN, e); };
    director.on(LAKESIDE_TOUCHDOWN.event, onTouch); this.offEv = () => director.off(LAKESIDE_TOUCHDOWN.event, onTouch);
    this.offRev = onWipeRevealed(e => { if (e.kind === 'ride' && this.skipWipe) { this.skipWipe = false; this.anchor = arrivalAnchor(this.host.now(), 'skip', LAKESIDE_TOUCHDOWN); } });
  }
  private tap() {
    if (this.skipping || !canSkipLakesideRide()) return; this.skipping = true; this.pressT = 0; this.skipWipe = true;
    let placed = false;
    void this.host.wipeRide(async () => { const r = await runLakesideRideSkip(); placed = true; return r; }, () => placed && !!(lakesideRide()?.landed ?? true))
      .catch(() => { }).then(() => { this.skipping = false; });
  }
  private paintPill(night: boolean) {
    const g = this.pill; g.clear(); g.fillColor = col(night ? SK.nightBg : SK.dayBg, SK.bgA); g.roundRect(-SK.w / 2, -SK.h / 2, SK.w, SK.h, SK.r); g.fill();
    const tc = col(night ? SK.nightText : SK.dayText, SK.textA); this.badgeLabel.color = tc;
    g.strokeColor = tc; g.lineWidth = SK.arrowPt; for (const dx of [14, 20]) { g.moveTo(dx - 3, 5); g.lineTo(dx + 2, 0); g.lineTo(dx - 3, -5); g.stroke(); }
  }
  /** per frame from WorldIntegrationBoot.update (UI points, Canvas centred). */
  update(dt: number, w: number, h: number) {
    if (!isValid(this.node, true)) return;
    const ride = lakesideRide(), night = uiNightWeight() > .5, safe = this.host.safe(w, h);
    if (ride && !this.lastRide) this.seen = seenT03(sys.localStorage as any)/* read once per ride: the touchdown of THIS ride marks it */;
    this.lastRide = !!ride;
    // badge
    let a = ride ? skipAlpha(ride.t, ride.flightAt, ride.touchdownAt, this.seen) : 0; if (ride && (ride.skipped || ride.landed)) a = 0;
    if (this.skipping && this.pressT >= 0) { this.pressT += dt; a = Math.max(a, 1); }
    this.badge.active = a > .001; if (this.badge.active) {
      const p = skipPlacement(w, h, safe.bottom); this.badge.setPosition(p.cx - w / 2, h / 2 - p.cy, 0); this.badgeOp.opacity = Math.round(255 * a); this.paintPill(night);
      const u = this.pressT >= 0 ? Math.min(1, this.pressT / SK.pressS) : 1, k = u < .5 ? 1 - (1 - SK.pressScale) * u * 2 : SK.pressScale + (1 - SK.pressScale) * (u - .5) * 2; this.badge.setScale(k, k, 1);
    }
    // no sign (region-title SPEC §1): only expire the arrival anchor
    const an = this.anchor; if (an && signState(this.host.now() - an.at, an).done) this.anchor = null;
  }
  diagnostics() { return { sign: false, badge: this.badge.active, anchor: this.anchor, seen: this.seen, skipping: this.skipping }; }
  dispose() { this.offEv(); this.offRev(); if (isValid(this.node, true)) this.node.destroy(); }
}
