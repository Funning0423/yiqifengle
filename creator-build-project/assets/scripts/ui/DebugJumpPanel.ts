import { BlockInputEvents, Color, EventTouch, Graphics, Input, Label, Layers, Node, UITransform, input, sys } from 'cc';
import { applyJourneyNavigationSkin } from './JourneyNavigationSkin';
import { warmButton } from '../WarmButton';
/** Hidden debug jump. Three-finger double-tap, or Ctrl+Shift+D / Cmd+Shift+D on desktop web. */
export type DebugCommand =
  | { kind: 'place'; place: 'home' | 'island' | 'skycity' | 'r4' }
  | { kind: 'mainline'; level: number }
  | { kind: 'region'; stageId: string }
  | { kind: 'last'; checkpoint: 4 | 8 | 12 }
  | { kind: 'exit-flow' };
type Item = { label: string; run: () => void };
type Point = { id: number; x: number; y: number; t: number; moved: boolean };
const TAP_MS = 320, GAP_MS = 450, MOVE_PX = 28;
export class DebugJumpPanel {
  private readonly root: Node;
  private readonly sheet: Node;
  private readonly status: Label;
  private readonly buttons: Node[] = [];
  private readonly cluster: Point[] = [];
  private page = 'root';
  private open = false;
  private w = 0;
  private h = 0;
  private lastTriple = 0;
  private disposed = false;
  private readonly onKey = (e: KeyboardEvent) => {
    if (this.disposed || e.repeat) return;
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'D' || e.key === 'd' || e.code === 'KeyD')) { e.preventDefault(); this.toggle(); }
  };
  private readonly onTouchStart = (e: TouchEvent) => { const now = Date.now(); for (let i = 0; i < e.changedTouches.length; i++) { const t = e.changedTouches[i]; this.noteStart(t.identifier, t.clientX, t.clientY, now); } };
  private readonly onTouchMove = (e: TouchEvent) => { for (let i = 0; i < e.changedTouches.length; i++) { const t = e.changedTouches[i]; this.noteMove(t.identifier, t.clientX, t.clientY); } };
  private readonly onCocosStart = (e: EventTouch) => { const now = Date.now(), touches = e.getTouches(); for (let i = 0; i < touches.length; i++) { const p = touches[i].getLocation(); this.noteStart(touches[i].getID(), p.x, p.y, now); } };
  private readonly onCocosMove = (e: EventTouch) => { const touches = e.getTouches(); for (let i = 0; i < touches.length; i++) { const p = touches[i].getLocation(); this.noteMove(touches[i].getID(), p.x, p.y); } };
  constructor(parent: Node, private readonly opts: { status: () => string; go: (cmd: DebugCommand) => void }) {
    const root = new Node('DebugJumpPanel'); root.layer = Layers.Enum.UI_2D; parent.addChild(root);
    root.addComponent(UITransform); root.addComponent(BlockInputEvents); root.active = false; this.root = root;
    const shade = root.addComponent(Graphics);
    const sheet = new Node('DebugJumpSheet'); sheet.layer = Layers.Enum.UI_2D; root.addChild(sheet); sheet.addComponent(UITransform); this.sheet = sheet;
    const statusNode = new Node('DebugJumpStatus'); statusNode.layer = Layers.Enum.UI_2D; sheet.addChild(statusNode);
    statusNode.addComponent(UITransform).setContentSize(280, 28);
    const label = statusNode.addComponent(Label); label.fontSize = 14; label.lineHeight = 18; label.color = new Color('#fff4d6');
    label.horizontalAlign = Label.HorizontalAlign.CENTER; label.verticalAlign = Label.VerticalAlign.CENTER; this.status = label;
    this.shade = shade;
    this.listen();
  }
  private shade: Graphics;
  layout(width: number, height: number) {
    this.w = width; this.h = height;
    this.root.getComponent(UITransform)!.setContentSize(width, height);
    const g = this.shade; g.clear(); g.fillColor = new Color(18, 32, 34, 120); g.rect(-width / 2, -height / 2, width, height); g.fill();
    if (this.open) this.place();
  }
  toggle() { this.setOpen(!this.open); }
  close() { this.setOpen(false); }
  setOpen(on: boolean) {
    if (this.disposed) return;
    this.open = on; this.root.active = on;
    if (!on) return;
    this.page = 'root';
    const parent = this.root.parent; if (parent) this.root.setSiblingIndex(parent.children.length - 1);
    this.rebuild();
  }
  dispose() {
    if (this.disposed) return; this.disposed = true; this.unlisten();
    if (this.root.isValid) this.root.destroy();
  }
  private listen() {
    if (typeof document !== 'undefined') {
      document.addEventListener('keydown', this.onKey, true);
      if (sys.isBrowser) {
        document.addEventListener('touchstart', this.onTouchStart, true);
        document.addEventListener('touchmove', this.onTouchMove, true);
        return;
      }
    }
    input.on(Input.EventType.TOUCH_START, this.onCocosStart, this);
    input.on(Input.EventType.TOUCH_MOVE, this.onCocosMove, this);
  }
  private unlisten() {
    if (typeof document !== 'undefined') {
      document.removeEventListener('keydown', this.onKey, true);
      document.removeEventListener('touchstart', this.onTouchStart, true);
      document.removeEventListener('touchmove', this.onTouchMove, true);
    }
    input.off(Input.EventType.TOUCH_START, this.onCocosStart, this);
    input.off(Input.EventType.TOUCH_MOVE, this.onCocosMove, this);
  }
  private noteStart(id: number, x: number, y: number, t: number) {
    for (let i = this.cluster.length - 1; i >= 0; i--) if (t - this.cluster[i].t >= TAP_MS) this.cluster.splice(i, 1);
    this.cluster.push({ id, x, y, t, moved: false });
    const ids: number[] = [];
    for (let i = 0; i < this.cluster.length; i++) { const s = this.cluster[i]; if (!s.moved && ids.indexOf(s.id) < 0) ids.push(s.id); }
    if (ids.length < 3) return;
    if (this.lastTriple && t - this.lastTriple < GAP_MS) { this.lastTriple = 0; this.cluster.length = 0; this.toggle(); }
    else { this.lastTriple = t; this.cluster.length = 0; }
  }
  private noteMove(id: number, x: number, y: number) {
    for (let i = 0; i < this.cluster.length; i++) { const s = this.cluster[i]; if (s.id === id && Math.hypot(x - s.x, y - s.y) > MOVE_PX) s.moved = true; }
  }
  private rebuild() {
    for (let i = 0; i < this.buttons.length; i++) this.buttons[i].destroy();
    this.buttons.length = 0;
    let line = ''; try { line = this.opts.status() || ''; } catch { line = ''; }
    this.status.string = line;
    const items = this.items();
    for (let i = 0; i < items.length; i++) this.buttons.push(this.makeButton(items[i]));
    this.place();
  }
  private place() {
    const width = this.w || 375, height = this.h || 667, items = this.buttons.length;
    const cols = 2, bw = Math.min(168, Math.floor((width - 56) / cols)), bh = 46, gap = 8;
    const rows = Math.ceil(items / cols), blockH = rows * bh + (rows - 1) * gap, top = Math.min(height / 2 - 36, blockH / 2 + 24);
    this.status.node.setPosition(0, top + 22, 0);
    this.status.node.getComponent(UITransform)!.setContentSize(Math.max(120, width - 48), 24);
    for (let i = 0; i < items; i++) {
      const col = i % cols, row = Math.floor(i / cols);
      const x = (col - (cols - 1) / 2) * (bw + gap), y = top - row * (bh + gap) - bh / 2;
      this.buttons[i].setPosition(x, y, 0);
    }
  }
  private makeButton(item: Item): Node {
    const n = new Node('DebugJump'); n.layer = Layers.Enum.UI_2D; this.sheet.addChild(n);
    const bw = Math.min(168, Math.floor(((this.w || 375) - 56) / 2)), bh = 46;
    n.addComponent(UITransform).setContentSize(bw, bh);
    const text = new Node('VisibleLabel'); text.layer = Layers.Enum.UI_2D; n.addChild(text);
    text.addComponent(UITransform).setContentSize(bw - 16, bh);
    const l = text.addComponent(Label); l.string = item.label; l.fontSize = 15; l.lineHeight = 20; l.color = new Color('#fff4d6');
    l.horizontalAlign = Label.HorizontalAlign.CENTER; l.verticalAlign = Label.VerticalAlign.CENTER;
    const surface = warmButton(n, bw, bh);
    applyJourneyNavigationSkin(n, 'primary', bw, bh);
    surface.addContent(text);
    surface.bind(() => { const run = item.run; setTimeout(run, 0); });
    return n;
  }
  private items(): Item[] {
    const go = (cmd: DebugCommand) => () => this.opts.go(cmd);
    const back = () => { this.page = 'root'; this.rebuild(); };
    const levels = (prefix: string, n: number, cmd: (i: number) => DebugCommand) => {
      const out: Item[] = [];
      for (let i = 1; i <= n; i++) out.push({ label: prefix + String(i).padStart(2, '0'), run: go(cmd(i)) });
      out.push({ label: '返回', run: back });
      return out;
    };
    if (this.page === 'mainline') return levels('主线', 12, i => ({ kind: 'mainline', level: i }));
    if (this.page === 'tide') return levels('潮汐', 4, i => ({ kind: 'region', stageId: 'r05-tide-0' + i }));
    if (this.page === 'meadow') return levels('草甸', 4, i => ({ kind: 'region', stageId: 'r05-meadow-0' + i }));
    if (this.page === 'sky') return levels('天空', 4, i => ({ kind: 'region', stageId: 'r05-sky-0' + i }));
    const open = (page: string) => () => { this.page = page; this.rebuild(); };
    return [
      { label: '主页', run: go({ kind: 'place', place: 'home' }) },
      { label: '小岛', run: go({ kind: 'place', place: 'island' }) },
      { label: '天空城', run: go({ kind: 'place', place: 'skycity' }) },
      { label: '主线', run: open('mainline') },
      { label: '潮汐', run: open('tide') },
      { label: '草甸', run: open('meadow') },
      { label: '天空', run: open('sky') },
      { label: '原地区', run: go({ kind: 'place', place: 'r4' }) },
      { label: '主线04末步', run: go({ kind: 'last', checkpoint: 4 }) },
      { label: '主线08末步', run: go({ kind: 'last', checkpoint: 8 }) },
      { label: '主线12末步', run: go({ kind: 'last', checkpoint: 12 }) },
      { label: '退出流程', run: go({ kind: 'exit-flow' }) },
      { label: '关闭', run: () => this.setOpen(false) },
    ];
  }
}
