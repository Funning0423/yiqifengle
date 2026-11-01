import { Node, UITransform, UIOpacity, Graphics, Color, Label, Layers, isValid } from 'cc';
import { makeLabel, measure } from './PopupKit';
import { TOAST_S } from './BoardLayout';
/** v3.3 (GGbot): the board's concise toast (ManagedMobileBoardUI.say/paintToast: cream pill, gold hairline, brown 15 px, 0.2 s in /
 *  2 s / 0.3 s out), for the island, where no board exists to own one. One line, no panel, no buttons, never technical text: callers
 *  pass player copy only (details go to the log). Inset below the top edge so it clears the WeChat capsule and the island dock. */
export const ISLAND_TOAST = Object.freeze({ inS: 0.2, holdS: TOAST_S, outS: 0.3, font: 15, h: 32, maxW: 330, padX: 40, topInset: 132 });
/** Copy (lead / UI设计部): shown when the lakeside scene cannot load and the player stays on the island. */
export const LAKESIDE_NOT_READY_TEXT = '湖畔暂时没准备好，先回小岛吧';
export function islandToastOpacity(t: number): number {
  const T = ISLAND_TOAST; if (t < 0) return 0;
  if (t < T.inS) return t / T.inS; if (t < T.inS + T.holdS) return 1; return Math.max(0, 1 - (t - T.inS - T.holdS) / T.outS);
}
export class IslandToast {
  private root: Node; private bg: Graphics; private label: Label; private t = -1;
  constructor(parent: Node) {
    const n = new Node('IslandToast'); n.layer = Layers.Enum.UI_2D; parent.addChild(n); n.addComponent(UITransform).setContentSize(300, ISLAND_TOAST.h);
    n.addComponent(UIOpacity).opacity = 0; n.active = false; this.root = n;
    const plate = new Node('ToastPlate'); plate.layer = Layers.Enum.UI_2D; n.addChild(plate); plate.addComponent(UITransform).setContentSize(300, ISLAND_TOAST.h); this.bg = plate.addComponent(Graphics);
    this.label = makeLabel(n, '', 0, 0, ISLAND_TOAST.font, { width: 320, name: 'ToastText' }); this.label.color = new Color(99, 63, 33, 255);
  }
  show(text: string) {
    if (!text || !isValid(this.root, true)) return; const T = ISLAND_TOAST, w = Math.min(T.maxW, measure(text, T.font) + T.padX), h = T.h;
    this.label.string = text; this.root.getComponent(UITransform)!.setContentSize(w, h); const g = this.bg; g.clear();
    g.fillColor = new Color(40, 30, 20, 40); g.roundRect(-w / 2 + 1, -h / 2 - 2, w, h, h / 2); g.fill();
    g.fillColor = new Color(248, 242, 226, 240); g.roundRect(-w / 2, -h / 2, w, h, h / 2); g.fill();
    g.strokeColor = new Color(201, 177, 133, 255); g.lineWidth = 1.5; g.roundRect(-w / 2, -h / 2, w, h, h / 2); g.stroke();
    this.t = 0; this.root.active = true; this.root.setSiblingIndex(this.root.parent!.children.length - 1);
  }
  update(dt: number, _width: number, height: number) {
    if (this.t < 0 || !isValid(this.root, true)) return; this.t += dt; const k = islandToastOpacity(this.t);
    this.root.setPosition(0, height / 2 - ISLAND_TOAST.topInset, 0); this.root.getComponent(UIOpacity)!.opacity = Math.round(255 * k);
    if (k <= 0 && this.t > ISLAND_TOAST.inS) { this.t = -1; this.root.active = false; }
  }
  visible() { return this.t >= 0; }
  dispose() { if (isValid(this.root, true)) this.root.destroy(); }
}
