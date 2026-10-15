import { BlockInputEvents, Color, EventTouch, Graphics, Input, Label, Layers, Node, UITransform, input } from 'cc';
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
type Finger = { id: number; x: number; y: number };
export type DebugChordState = { armed: boolean; chordAt: number };
const CHORD_MIN_MS = 40, CHORD_GAP_MS = 700, CHORD_HOLD_MS = 80, MOVE_PX = 36;
/** Ctrl/Cmd+Shift+D. keyCode 68 covers browsers that omit key/code on a captured event. */
export function isDebugShortcut(e: { repeat?: boolean; ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean; key?: string; code?: string; keyCode?: number } | null): boolean {
  if (!e || e.repeat) return false;
  const key = e.key === 'D' || e.key === 'd' || e.code === 'KeyD' || e.keyCode === 68;
  return !!((e.ctrlKey || e.metaKey) && e.shiftKey && key);
}
/** Two three-finger chords 40–700 ms apart toggle. A later touchstart (≥80 ms) counts even if the fingers never lifted. */
export function considerDebugChord(state: DebugChordState, now: number, fingers: number, phase: 'start' | 'move' | 'end' | 'cancel'): boolean {
  if (phase === 'cancel') { state.armed = false; state.chordAt = 0; return false; }
  if (phase === 'end' || phase === 'move' || fingers < 3) { if (fingers < 3) state.armed = false; return false; }
  if (phase !== 'start') return false;
  const dt = state.chordAt > 0 ? now - state.chordAt : 0;
  const rising = !state.armed, held = state.armed && dt >= CHORD_HOLD_MS;
  if (!rising && !held) return false;
  const pair = state.chordAt > 0 && dt >= CHORD_MIN_MS && dt <= CHORD_GAP_MS;
  state.armed = true;
  if (pair) { state.chordAt = 0; return true; }
  state.chordAt = now;
  return false;
}
export class DebugJumpPanel {
  private readonly root: Node;
  private readonly sheet: Node;
  private readonly status: Label;
  private readonly buttons: Node[] = [];
  private page = 'root';
  private open = false;
  private w = 0;
  private h = 0;
  private disposed = false;
  private lastDom = 0;
  private lastShortcut = 0;
  private lastChordEvent = 0;
  private readonly chord: DebugChordState = { armed: false, chordAt: 0 };
  private readonly fingers: Finger[] = [];
  private readonly onKey = (e: KeyboardEvent) => {
    if (this.disposed || !isDebugShortcut(e)) return;
    const now = Date.now(); if (now - this.lastShortcut < 30) return;
    this.lastShortcut = now; e.preventDefault(); this.toggle();
  };
  private readonly onTouchStart = (e: TouchEvent) => { this.lastDom = Date.now(); this.rememberList(e.changedTouches); if (this.drifted(e.changedTouches)) this.feed(0, 'cancel'); else this.feed(this.domCount(e, false), 'start'); };
  private readonly onTouchMove = (e: TouchEvent) => { this.lastDom = Date.now(); if (this.drifted(e.changedTouches)) this.feed(0, 'cancel'); };
  private readonly onTouchEnd = (e: TouchEvent) => { this.lastDom = Date.now(); this.forgetList(e.changedTouches); this.feed(this.domCount(e, true), 'end'); };
  private readonly onCocosStart = (e: EventTouch) => { if (Date.now() - this.lastDom < 50) return; this.rememberCocos(e); this.feed(this.cocosCount(e), 'start'); };
  private readonly onCocosMove = (e: EventTouch) => { if (Date.now() - this.lastDom < 50) return; if (this.driftedCocos(e)) this.feed(0, 'cancel'); };
  private readonly onCocosEnd = (e: EventTouch) => { if (Date.now() - this.lastDom < 50) return; this.feed(this.cocosCount(e), 'end'); };
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
    const doc = typeof document !== 'undefined' ? document : null;
    const win = typeof window !== 'undefined' ? window : null;
    if (doc) doc.addEventListener('keydown', this.onKey, true);
    if (win) win.addEventListener('keydown', this.onKey, true);
    if (doc) {
      doc.addEventListener('touchstart', this.onTouchStart, true);
      doc.addEventListener('touchmove', this.onTouchMove, true);
      doc.addEventListener('touchend', this.onTouchEnd, true);
      doc.addEventListener('touchcancel', this.onTouchEnd, true);
    }
    input.on(Input.EventType.TOUCH_START, this.onCocosStart, this);
    input.on(Input.EventType.TOUCH_MOVE, this.onCocosMove, this);
    input.on(Input.EventType.TOUCH_END, this.onCocosEnd, this);
    input.on(Input.EventType.TOUCH_CANCEL, this.onCocosEnd, this);
  }
  private unlisten() {
    const doc = typeof document !== 'undefined' ? document : null;
    const win = typeof window !== 'undefined' ? window : null;
    if (doc) {
      doc.removeEventListener('keydown', this.onKey, true);
      doc.removeEventListener('touchstart', this.onTouchStart, true);
      doc.removeEventListener('touchmove', this.onTouchMove, true);
      doc.removeEventListener('touchend', this.onTouchEnd, true);
      doc.removeEventListener('touchcancel', this.onTouchEnd, true);
    }
    if (win) win.removeEventListener('keydown', this.onKey, true);
    input.off(Input.EventType.TOUCH_START, this.onCocosStart, this);
    input.off(Input.EventType.TOUCH_MOVE, this.onCocosMove, this);
    input.off(Input.EventType.TOUCH_END, this.onCocosEnd, this);
    input.off(Input.EventType.TOUCH_CANCEL, this.onCocosEnd, this);
  }
  private feed(fingers: number, phase: 'start' | 'move' | 'end' | 'cancel') {
    if (this.disposed) return;
    const now = Date.now();
    // Document capture and the Cocos input both see one browser touch. A second start inside 50 ms is the same chord.
    if (phase === 'start' && now - this.lastChordEvent < 50) return;
    if (phase === 'start') this.lastChordEvent = now;
    if (considerDebugChord(this.chord, now, fingers, phase)) this.toggle();
    if (fingers <= 0) this.fingers.length = 0;
  }
  private domCount(e: TouchEvent, ending: boolean) {
    const live = e.touches ? e.touches.length : 0, changed = e.changedTouches ? e.changedTouches.length : 0;
    return ending ? live : Math.max(live, changed);
  }
  private rememberList(list: ArrayLike<{ identifier: number; clientX: number; clientY: number }> | undefined) {
    if (!list) return;
    for (let i = 0; i < list.length; i++) this.remember(list[i].identifier, list[i].clientX, list[i].clientY);
  }
  private remember(id: number, x: number, y: number) {
    for (let i = 0; i < this.fingers.length; i++) if (this.fingers[i].id === id) return;
    this.fingers.push({ id, x, y });
  }
  private forgetList(list: ArrayLike<{ identifier: number }> | undefined) {
    if (!list) return;
    for (let i = 0; i < list.length; i++) {
      const id = list[i].identifier;
      for (let j = this.fingers.length - 1; j >= 0; j--) if (this.fingers[j].id === id) this.fingers.splice(j, 1);
    }
  }
  private drifted(list: ArrayLike<{ identifier: number; clientX: number; clientY: number }> | undefined) {
    if (!list) return false;
    for (let i = 0; i < list.length; i++) {
      const t = list[i];
      for (let j = 0; j < this.fingers.length; j++) {
        const s = this.fingers[j];
        if (s.id === t.identifier && Math.hypot(t.clientX - s.x, t.clientY - s.y) > MOVE_PX) return true;
      }
    }
    return false;
  }
  private cocosCount(e: EventTouch) { const t = e.getTouches(); return t ? t.length : 0; }
  private rememberCocos(e: EventTouch) {
    const touches = e.getTouches();
    for (let i = 0; i < touches.length; i++) { const p = touches[i].getLocation(); this.remember(touches[i].getID(), p.x, p.y); }
  }
  private driftedCocos(e: EventTouch) {
    const touches = e.getTouches();
    for (let i = 0; i < touches.length; i++) {
      const p = touches[i].getLocation(), id = touches[i].getID();
      for (let j = 0; j < this.fingers.length; j++) {
        const s = this.fingers[j];
        if (s.id === id && Math.hypot(p.x - s.x, p.y - s.y) > MOVE_PX) return true;
      }
    }
    return false;
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
