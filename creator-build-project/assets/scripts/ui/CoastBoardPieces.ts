/** In-scene coast pieces (coast pilot P1, decision 1): 2D sprites placed on the projected slabs so they read as scene objects —
 *  perspective size per tile (far row smaller), a contact shadow (foreshortened ellipse on the slab top, drawn with Graphics, no new
 *  asset) and the slabs' lighting tint. Read-only on the camera: it only consumes BoardProjection numbers. Not used by the default
 *  board; ManagedMobileBoardUI is unchanged. Only built while the coast config is on (BoardProjection.setCoastBoardKit). */
import { _decorator, Component, Node, UITransform, Sprite, SpriteFrame, Graphics, Color } from 'cc';
import { boardKitFor, type RegionBoardKit } from './BoardKit';
import { kitPiecePlacement, projectedGrid } from './BoardProjection';
const { ccclass } = _decorator;
@ccclass('CoastBoardPieces')
export class CoastBoardPieces extends Component {
  private pieces: Node[] = []; private shadows: Node[] = [];
  /** Lay out 49 pieces for `types` (engine tile type 0..5 or -1 = empty). Returns false (nothing drawn) when the coast config is off
   *  or the projection is invalid; the caller then keeps the 2D board (BoardKit.kitGrid counts that fallback). */
  layoutPieces(w: number, h: number, types: ReadonlyArray<number>, frames: ReadonlyArray<SpriteFrame | null>, kit: RegionBoardKit = boardKitFor('coast')): boolean {
    if (!kit.board || !kit.camera || !projectedGrid(kit, w, h)) return false;
    // all shadows first (under every piece), then pieces far row → near row so nearer pieces overlap farther ones
    if (!this.shadows.length) { for (let i = 0; i < 49; i++) this.shadows[i] = this.child('shadow' + i); for (let i = 0; i < 49; i++) this.pieces[i] = this.child('piece' + i); }
    for (let i = 0; i < 49; i++) {
      const p = kitPiecePlacement(kit, w, h, i), t = types[i], f = t >= 0 ? frames[t] : null;
      const sh = this.shadows[i], pc = this.pieces[i];
      sh.setPosition(p.x - w / 2, h / 2 - p.y, 0); const g = sh.getComponent(Graphics) || sh.addComponent(Graphics); g.clear();
      const c = new Color(p.shadow.color); c.a = Math.round(255 * p.shadow.opacity); g.fillColor = c; g.ellipse(0, 0, p.shadow.w / 2, p.shadow.h / 2); g.fill();
      sh.active = !!f;
      const ut = pc.getComponent(UITransform) || pc.addComponent(UITransform), sp = pc.getComponent(Sprite) || pc.addComponent(Sprite);
      sp.sizeMode = Sprite.SizeMode.CUSTOM; sp.spriteFrame = f; sp.color = new Color(p.tint);
      ut.setAnchorPoint(0.5, p.anchorY); ut.setContentSize(p.width, p.width); pc.setPosition(p.x - w / 2, h / 2 - p.y, 0); pc.active = !!f;
    }
    return true;
  }
  private child(name: string): Node { const n = new Node(name); n.layer = this.node.layer; n.addComponent(UITransform); this.node.addChild(n); return n; }
}
