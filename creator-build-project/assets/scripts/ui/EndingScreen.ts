import { BlockInputEvents, Color, Graphics, Layers, Node, UITransform, isValid, view } from 'cc';
import { artButton, artSprite, makeLabel, TintSet } from './PopupKit';
import { uiNightWeight } from './NightTint';
import { endingLayout } from '../world-r2/EndingFlow';
/** TEMPORARY ending screen (TR9 target; the final lake-view + 3D chime design is being revised by UI设计部). Warm sky
 *  backdrop, 「旅程完成」 on the title plank, the four region seals, and ONE 3D-style button 「回小岛」 inset from the edges
 *  (width min(240, W−48), bottom 24 pt above the safe area). Text total: 7 characters. Swallows touches behind it. */
export class EndingScreen {
  readonly node: Node; private tint = new TintSet(); private alive = true;
  constructor(parent: Node, a: { home(): void; safeBottom?: number }) {
    const vs = view.getVisibleSize(), w = vs.width, h = vs.height, L = endingLayout(w, h, a.safeBottom ?? 0), night = uiNightWeight() > .5;
    const n = new Node('EndingScreen'); n.layer = Layers.Enum.UI_2D; parent.addChild(n); n.addComponent(UITransform).setContentSize(w, h); n.addComponent(BlockInputEvents); this.node = n;
    const bg = new Node('EndingBackdrop'); bg.layer = Layers.Enum.UI_2D; n.addChild(bg); bg.addComponent(UITransform).setContentSize(w, h); const g = bg.addComponent(Graphics);
    const top = night ? [0x28, 0x32, 0x52] : [0xff, 0xe6, 0xb8], bot = night ? [0x3e, 0x46, 0x68] : [0x9f, 0xd6, 0xd8];
    for (let i = 0; i < 12; i++) { const u = i / 11; g.fillColor = new Color(Math.round(top[0] + (bot[0] - top[0]) * u), Math.round(top[1] + (bot[1] - top[1]) * u), Math.round(top[2] + (bot[2] - top[2]) * u), 255); g.rect(-w / 2 - 2, h / 2 - (i + 1) * h / 12, w + 4, h / 12 + 1); g.fill(); }
    g.fillColor = new Color(0xff, 0xde, 0x8c, night ? 90 : 120); g.circle(0, L.glowY, w * .45); g.fill();
    const plank = artSprite(n, 'popup/title_plank_3s', 0, L.titleY, 196, 58, 'EndingPlank'); this.tint.sprite(plank, 'ui');
    const t = makeLabel(n, '旅程完成', 0, L.titleY + 2, 24, { width: 190, name: 'EndingTitle' }); t.color = new Color(0x5a, 0x3a, 0x1e, 255); (t as any).spacingX = 3;
    ['tide', 'meadow', 'sky', 'lake'].forEach((r, i) => { const s = artSprite(n, 'popup/reward_seal_' + r, (i - 1.5) * 58, L.sealY, 44, 44, 'Seal-' + r); this.tint.sprite(s, 'ui'); });
    artButton(n, this.tint, 'primary', '回小岛', 0, L.buttonY, L.buttonW, 62, () => { if (this.alive) a.home(); }, { fontSize: 20, name: 'EndingHome', sound: 'back' });
    this.tint.update(true);
  }
  ready() { return this.alive && isValid(this.node, true); }
  dispose() { this.alive = false; if (isValid(this.node, true)) this.node.destroy(); }
}
