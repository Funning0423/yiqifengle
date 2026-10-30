import { _decorator, Component, game, Game, BlockInputEvents, tween, Tween, Color, EventTouch, Graphics, Label, Layers, Node, Sprite, UIOpacity, UITransform, Vec3, isValid } from 'cc';
import { GameAudio } from '../audio/GameAudio';
import { ART_PX, BoardArt } from './BoardArt';
import { textRgb, tintRgb, uiNightWeight, type TextRole, type TintKind } from './NightTint';
import { reducedMotion } from './UiPrefs';
import { OPEN_S, CLOSE_S, PRESS_SCALE, PRESS_SINK, RELEASE_S, TOGGLE_S, easeOutBack, easeOutCubic, enterAt, exitAt } from './PopupMotion';
export { OPEN_S, CLOSE_S } from './PopupMotion';
/** Unified popup kit (INTEGRATION §3): one light-wood 9-slice frame without pegs, width 680 px of the 750 design,
 *  baked title on a plank centred on the top edge, 3-slice buttons, toggles, slider. Everything inside a panel is laid
 *  out in 750-design pixels: the panel body is scaled by popupScale(), so slice borders and fonts keep their art size.
 *  Coordinates: x = px from the panel centre (right +), y = px from the panel top edge (down +). */
export const PANEL_WIDTH = 680;
export const CONTENT_TOP = 104;
export const CONTENT_BOTTOM = 72;
export const SHADE = { rgb: [16, 28, 34], alpha: 0.35 } as const;
export function popupScale(width: number, height: number): number { return Math.max(0.3, Math.min(width / 750, height / 1300, 0.62)); }
export type Sound = 'button' | 'back' | 'tool' | 'none';
export function playSound(kind: Sound) {
  try { const a = GameAudio.instance; if (!a) return; if (kind === 'button') a.onButton(); else if (kind === 'back') a.onUiBack(); else if (kind === 'tool') a.onToolTap(); } catch (e) { /* sound is optional */ }
}
export function uiNode(name: string, parent: Node | null, width = 0, height = 0): Node {
  const n = new Node(name); n.layer = Layers.Enum.UI_2D; if (parent) parent.addChild(n); n.addComponent(UITransform).setContentSize(width, height); return n;
}
type Tinted = { sprite: Sprite; kind: TintKind; base: number[]; alpha: number };
type Texted = { label: Label; role: TextRole; alpha: number };
type Shape = { g: Graphics; draw: (g: Graphics, night: number, alpha: number) => void };
/** Night tint + text recolour registry shared by panels and the board HUD. */
export class TintSet {
  private sprites: Tinted[] = []; private labels: Texted[] = []; private shapes: Shape[] = [];
  private night = -1; private alpha = 1;
  sprite(sprite: Sprite, kind: TintKind, base: number[] = [255, 255, 255], alpha = 255) { const t = { sprite, kind, base, alpha }; this.sprites.push(t); this.paintSprite(t); return sprite; }
  label(label: Label, role: TextRole, alpha = 255) { const t = { label, role, alpha }; this.labels.push(t); this.paintLabel(t); return label; }
  setRole(label: Label, role: TextRole) { for (let i = 0; i < this.labels.length; i++) if (this.labels[i].label === label) { this.labels[i].role = role; this.paintLabel(this.labels[i]); } }
  setBase(sprite: Sprite, base: number[], alpha = 255) { for (let i = 0; i < this.sprites.length; i++) if (this.sprites[i].sprite === sprite) { this.sprites[i].base = base; this.sprites[i].alpha = alpha; this.paintSprite(this.sprites[i]); } }
  shape(g: Graphics, draw: Shape['draw']) { const s = { g, draw }; this.shapes.push(s); g.clear(); draw(g, Math.max(0, this.night), this.alpha); return g; }
  private paintSprite(t: Tinted) { if (!isValid(t.sprite, true)) return; const c = tintRgb(t.kind, Math.max(0, this.night), t.base); t.sprite.color = new Color(c[0], c[1], c[2], t.alpha); }
  private paintLabel(t: Texted) { if (!isValid(t.label, true)) return; const c = textRgb(t.role, Math.max(0, this.night)); t.label.color = new Color(c[0], c[1], c[2], t.alpha); }
  /** Graphics ignores UIOpacity, so shapes are redrawn with the panel alpha while it fades. */
  setAlpha(a: number) { if (Math.abs(a - this.alpha) < 0.004) return; this.alpha = a; this.redrawShapes(); }
  update(force = false) {
    const w = uiNightWeight(); if (!force && Math.abs(w - this.night) < 0.01 && !(w !== this.night && (w === 0 || w === 1))) return;
    this.night = w;
    for (let i = 0; i < this.sprites.length; i++) this.paintSprite(this.sprites[i]);
    for (let i = 0; i < this.labels.length; i++) this.paintLabel(this.labels[i]);
    this.redrawShapes();
  }
  private redrawShapes() { for (let i = 0; i < this.shapes.length; i++) { const s = this.shapes[i]; if (!isValid(s.g, true)) continue; s.g.clear(); s.draw(s.g, Math.max(0, this.night), this.alpha); } }
  weight() { return Math.max(0, this.night); }
  clear() { this.sprites.length = 0; this.labels.length = 0; this.shapes.length = 0; this.night = -1; }
}
/** Sprite from the art library; `width`/`height` in parent units (missing one keeps the aspect). */
export function artSprite(parent: Node, key: string, x: number, y: number, width?: number, height?: number, name?: string): Sprite {
  const art = BoardArt.shared(), size = art.size(key), n = uiNode(name || key.split('/').pop() || 'Art', parent);
  const w = width ?? (height !== undefined && size.height ? size.width * height / size.height : size.width);
  const h = height ?? (width !== undefined && size.width ? size.height * width / size.width : size.height);
  const f = art.frame(key);
  const sliced = !!(f && (f.insetLeft || f.insetRight || f.insetTop || f.insetBottom) && width !== undefined && height !== undefined);
  const px = sliced ? (ART_PX[key] || 1) : 1;
  n.getComponent(UITransform)!.setContentSize(w * px, h * px); if (px !== 1) n.setScale(1 / px, 1 / px, 1); n.setPosition(x, y, 0);
  const s = n.addComponent(Sprite); s.sizeMode = Sprite.SizeMode.CUSTOM; s.trim = false;
  if (f) { s.spriteFrame = f; if (sliced) s.type = Sprite.Type.SLICED; }
  return s;
}
export interface LabelOptions { width?: number; height?: number; bold?: boolean; align?: 'left' | 'center' | 'right'; lines?: number; name?: string }
export function makeLabel(parent: Node, text: string, x: number, y: number, size: number, opts: LabelOptions = {}): Label {
  const lines = opts.lines || 1, w = opts.width || 600, h = opts.height || Math.round(size * 1.4 * lines);
  const n = uiNode(opts.name || 'Text', parent, w, h); n.setPosition(x, y, 0);
  const l = n.addComponent(Label); l.string = text; l.fontSize = size; l.lineHeight = Math.round(size * 1.4); l.isBold = opts.bold !== false;
  l.horizontalAlign = opts.align === 'left' ? Label.HorizontalAlign.LEFT : opts.align === 'right' ? Label.HorizontalAlign.RIGHT : Label.HorizontalAlign.CENTER;
  l.verticalAlign = Label.VerticalAlign.CENTER; l.overflow = lines > 1 ? Label.Overflow.CLAMP : Label.Overflow.NONE; l.enableWrapText = lines > 1;
  if (opts.align === 'left') n.getComponent(UITransform)!.setAnchorPoint(0, 0.5); else if (opts.align === 'right') n.getComponent(UITransform)!.setAnchorPoint(1, 0.5);
  return l;
}
export interface ArtButtonHandle {
  node: Node; label: Label | null;
  setEnabled(on: boolean): void; enabled(): boolean;
  setText(text: string): void;
  setKind(kind: 'primary' | 'secondary'): void;
}
export interface ButtonOptions { icon?: string; iconScale?: number; fontSize?: number; sound?: Sound; name?: string }
/** Button/slider ownership is scoped to the originating finger and one visible lifetime. */
export interface PressHandle { cancel(): void; dispose(): void }
const blockedPressRoots = new WeakSet<Node>();
function pressNodeReady(node: Node) {
  for (let n: Node | null = node; n; n = n.parent) if (!isValid(n, true) || !n.activeInHierarchy || blockedPressRoots.has(n)) return false;
  return true;
}
@_decorator.ccclass('QfTouchInputLifecycle')
class TouchInputLifecycle extends Component {
  reset: () => void = () => {}; cleanup: () => void = () => {};
  onDisable() { this.reset(); }
  onDestroy() { try { this.reset(); } finally { this.cleanup(); } }
}
export function resetPresses(root: Node) {
  if (!isValid(root, true)) return;
  for (const guard of root.getComponentsInChildren(TouchInputLifecycle)) if (isValid(guard, true)) guard.reset();
}
function bindInputLifetime(node: Node, cancel: () => void) {
  const guard = node.addComponent(TouchInputLifecycle); guard.reset = cancel;
  const hide = () => cancel(); game.on(Game.EVENT_HIDE, hide);
  const detach = () => { game.off(Game.EVENT_HIDE, hide); }; guard.cleanup = detach;
  // The component itself may already have been destructed when its owner releases
  // this handle. Keep detach in the closure rather than dereferencing its fields.
  return () => { try { cancel(); } finally { detach(); } if (isValid(guard, true)) { guard.reset = () => {}; guard.cleanup = () => {}; } };
}
function pointerId(e: EventTouch | undefined) {
  const id = e && typeof e.getID === 'function' ? e.getID() : null;
  return typeof id === 'number' && Number.isFinite(id) ? id : null;
}
/** Press sinks 3px; leaving/re-entering changes feedback, but only an owner release inside activates. */
export function pressable(node: Node, content: Node, tap: () => void, opts: { sound?: Sound; enabled?: () => boolean; onPress?: (down: boolean) => void } = {}): PressHandle {
  let owner: number | null = null, down = false, disposed = false; const base = new Vec3(), baseScale = new Vec3(1, 1, 1);
  const ready = () => !disposed && pressNodeReady(node) && (!opts.enabled || opts.enabled());
  const hit = (e: EventTouch) => {
    const p = e && typeof e.getLocation === 'function' ? e.getLocation() : null;
    return !!p && Number.isFinite(p.x) && Number.isFinite(p.y) && !!node.getComponent(UITransform)?.hitTest(p, e.windowId);
  };
  const press = (on: boolean) => {
    if (on === down) return; down = on;
    // SPEC §4: press = same frame (scale 0.96, sink 3); release = 120 ms easeOutBack(1.4) back to rest.
    if (isValid(content, true)) { Tween.stopAllByTarget(content); if (on) { base.set(content.position); baseScale.set(content.scale); content.setPosition(base.x, base.y - PRESS_SINK, base.z); content.setScale(baseScale.x * PRESS_SCALE, baseScale.y * PRESS_SCALE, baseScale.z); } else { content.setPosition(base.x, base.y, base.z); if (reducedMotion()) content.setScale(baseScale); else tween(content).to(RELEASE_S, { scale: baseScale.clone() }, { easing: (k: number) => easeOutBack(k) }).start(); } }
    if (isValid(node, true) && isValid(content, true)) opts.onPress?.(on);
  };
  const cancel = () => { owner = null; press(false); };
  const start = (e: EventTouch) => { if (!e) return; e.propagationStopped = true; const id = pointerId(e); if (owner !== null || id === null || !ready() || !hit(e)) return; owner = id; press(true); };
  const move = (e: EventTouch) => { if (owner === null || pointerId(e) !== owner) return; e.propagationStopped = true; if (!ready()) { cancel(); return; } press(hit(e)); };
  const abort = (e: EventTouch) => { if (owner !== null && pointerId(e) === owner) cancel(); };
  const end = (e: EventTouch) => { if (owner === null || pointerId(e) !== owner) return; e.propagationStopped = true; const activate = ready() && hit(e); cancel(); if (!activate) return; GameAudio.notifyUserGesture(); playSound(opts.sound || 'button'); tap(); };
  node.on(Node.EventType.TOUCH_START, start); node.on(Node.EventType.TOUCH_MOVE, move);
  node.on(Node.EventType.TOUCH_CANCEL, abort); node.on(Node.EventType.TOUCH_END, end);
  const cleanup = bindInputLifetime(node, cancel);
  return { cancel, dispose() { if (disposed) return; disposed = true; cleanup(); if (isValid(node, true)) { node.off(Node.EventType.TOUCH_START, start); node.off(Node.EventType.TOUCH_MOVE, move); node.off(Node.EventType.TOUCH_CANCEL, abort); node.off(Node.EventType.TOUCH_END, end); } } };
}
export function artButton(parent: Node, tint: TintSet, kind: 'primary' | 'secondary', text: string, x: number, y: number, width: number, height: number, tap: () => void, opts: ButtonOptions = {}): ArtButtonHandle {
  const node = uiNode(opts.name || 'Button-' + text, parent, width, Math.max(height, 88)); node.setPosition(x, y, 0);
  const face = uiNode('Face', node, width, height);
  let k = kind; const key = () => k === 'primary' ? 'popup/btn_primary_3s' : 'popup/btn_secondary_3s';
  const bg = artSprite(face, key(), 0, 0, width, height, 'Plate'); tint.sprite(bg, 'ui');
  const fs = opts.fontSize || 34, cy = height * 0.03;
  let icon: Sprite | null = null; let label: Label | null = null;
  if (opts.icon) { const ih = height * (opts.iconScale || (opts.icon === 'popup/icon_play' ? 0.40 : 0.62)); icon = artSprite(face, opts.icon, 0, cy, undefined, ih, 'Icon'); tint.sprite(icon, 'ui'); }
  if (text) { label = makeLabel(face, text, 0, cy, fs, { width: width - 40, name: 'Label' }); tint.label(label, k === 'primary' ? 'white' : 'brown'); }
  const layoutContent = () => {
    if (!icon || !label) return;
    const iw = icon.node.getComponent(UITransform)!.width, tw = Math.min(width - 60, measure(label.string, fs)), gap = 12, x0 = -(iw + gap + tw) / 2;
    icon.node.setPosition(x0 + iw / 2, cy, 0); label.node.getComponent(UITransform)!.setAnchorPoint(0, 0.5); label.horizontalAlign = Label.HorizontalAlign.LEFT; label.node.setPosition(x0 + iw + gap, cy, 0);
  };
  layoutContent();
  let on = true; const op = node.addComponent(UIOpacity);
  const inputGuard = pressable(node, face, tap, { sound: opts.sound, enabled: () => on, onPress: d => tint.setBase(bg, d ? [240, 240, 240] : [255, 255, 255]) });
  return {
    node, label,
    setEnabled(v: boolean) { if (!v) inputGuard.cancel(); on = v; op.opacity = v ? 255 : 140; bg.grayscale = !v; if (icon) icon.grayscale = !v; },
    enabled: () => on,
    setText(t: string) { if (label) { label.string = t; layoutContent(); } },
    setKind(next) { if (next === k) return; k = next; const f = BoardArt.shared().frame(key()); if (f) bg.spriteFrame = f; if (label) tint.setRole(label, k === 'primary' ? 'white' : 'brown'); },
  };
}
/** Rough CJK-aware text width (px) for centring icon + label pairs; Label has no synchronous measure before render. */
export function measure(text: string, size: number): number {
  let w = 0; for (let i = 0; i < text.length; i++) { const c = text.charCodeAt(i); w += c > 0x2e80 ? size : c === 32 ? size * 0.3 : size * 0.56; } return w;
}
export interface ToggleHandle { node: Node; set(on: boolean, animate?: boolean): void; value(): boolean; update(dt: number): void }
export function artToggle(parent: Node, tint: TintSet, x: number, y: number, h: number, on: boolean, change: (on: boolean) => void, name = 'Toggle'): ToggleHandle {
  const w = h * 115 / 56, node = uiNode(name, parent, Math.max(w + 16, 88), Math.max(h + 16, 88)); node.setPosition(x, y, 0);
  const off = artSprite(node, 'popup/toggle_off', 0, 0, w, h, 'Off'); tint.sprite(off, 'ui');
  const onS = artSprite(node, 'popup/toggle_on', 0, 0, w, h, 'On'); tint.sprite(onS, 'ui');
  const onOp = onS.node.addComponent(UIOpacity);
  const knob = artSprite(node, 'popup/toggle_knob', 0, 0, h * 0.86, h * 0.86, 'Knob'); tint.sprite(knob, 'ui');
  let value = on, t = on ? 1 : 0;
  const paint = () => { const e = easeOutCubic(value ? t : 1 - t), k = value ? e : 1 - e; knob.node.setPosition(-w / 2 + h * 0.5 + (w - h) * k, -h * 0.02, 0); onOp.opacity = Math.round(255 * k); };
  paint();
  pressable(node, knob.node, () => { value = !value; change(value); }, { sound: 'button' });
  return { node, set(v: boolean, animate = false) { value = v; if (!animate) { t = v ? 1 : 0; paint(); } }, value: () => value,
    update(dt: number) { const target = value ? 1 : 0; if (t === target) return; t = target > t ? Math.min(1, t + dt / TOGGLE_S) : Math.max(0, t - dt / TOGGLE_S); paint(); } };
}
export interface SliderHandle { node: Node; set(v: number): void; value(): number }
/** Music volume slider: toggle_off rail, toggle_on fill clipped to the value, knob 1.5× rail height (0 new art). */
export function artSlider(parent: Node, tint: TintSet, x: number, y: number, w: number, h: number, value: number, change: (v: number) => void, name = 'Slider'): SliderHandle {
  const node = uiNode(name, parent, w + h * 2, Math.max(h * 2.6, 88)); node.setPosition(x, y, 0);
  const rail = artSprite(node, 'popup/toggle_off', 0, 0, w, h, 'Rail'); tint.sprite(rail, 'ui');
  const fill = artSprite(node, 'popup/toggle_on', 0, 0, w, h, 'Fill'); tint.sprite(fill, 'ui');
  const fillUi = fill.node.getComponent(UITransform)!; fillUi.setAnchorPoint(0, 0.5);
  const knob = artSprite(node, 'popup/toggle_knob', 0, 0, h * 1.5, h * 1.5, 'Knob'); tint.sprite(knob, 'ui');
  let v = Math.max(0, Math.min(1, value));
  const fillPx = ART_PX['popup/toggle_on'] || 1;
  const paint = () => {
    fill.node.active = v > 0.001; fill.node.setPosition(-w / 2, 0, 0);
    if (v > 0.001) fillUi.setContentSize(Math.max(w * v, 0.01) * fillPx, h * fillPx);
    knob.node.setPosition(-w / 2 + w * v, 0, 0);
  };
  paint();
  let pointer: number | null = null, startX = 0, startV = v, startLocal: number | null = null;
  const pointerId = (e: EventTouch) => (typeof e.getID === 'function' ? e.getID() : 0);
  const worldScaleX = () => { let k = 1, n: Node | null = node; while (n) { const s = n.scale.x; k *= s ? s : 1; n = n.parent; } return k || 1; };
  const localX = (e: EventTouch): number | null => {
    const ui = node.getComponent(UITransform) as (UITransform & { convertToNodeSpaceAR?: (p: Vec3) => Vec3 }) | null;
    const p = e.getUILocation(); if (!ui || !p || typeof ui.convertToNodeSpaceAR !== 'function') return null;
    const n = ui.convertToNodeSpaceAR(new Vec3(p.x, p.y, 0)); return Number.isFinite(n.x) ? n.x : null;
  };
  // Relative to the grab point, so the knob does not jump. Local space when the UI transform can convert; otherwise screen delta / world scale.
  const read = (e: EventTouch) => {
    const lx = localX(e);
    if (lx !== null && startLocal !== null) return startV + (lx - startLocal) / w;
    return startV + (e.getUILocation().x - startX) / (w * worldScaleX());
  };
  const commit = (next: number) => { if (!Number.isFinite(next)) next = v; v = Math.max(0, Math.min(1, next)); paint(); change(v); };
  bindInputLifetime(node, () => { pointer = null; });
  node.on(Node.EventType.TOUCH_START, (e: EventTouch) => {
    if (pointer !== null || !pressNodeReady(node)) return;
    e.propagationStopped = true; pointer = pointerId(e); startX = e.getUILocation().x; startV = v; startLocal = localX(e);
  });
  node.on(Node.EventType.TOUCH_MOVE, (e: EventTouch) => {
    if (pointer === null || pointerId(e) !== pointer || !pressNodeReady(node)) return;
    e.propagationStopped = true; const next = Math.max(0, Math.min(1, read(e)));
    if (Math.abs(next - v) < 0.001) return; commit(next);
  });
  // Release (and a drag that leaves the hit box, which Cocos reports as cancel) keeps the last value. It does not snap back.
  const finish = (e: EventTouch, sound: boolean) => {
    if (pointer === null || pointerId(e) !== pointer || !pressNodeReady(node)) return;
    e.propagationStopped = true; pointer = null; commit(read(e)); if (sound) playSound('button');
  };
  node.on(Node.EventType.TOUCH_END, (e: EventTouch) => finish(e, true));
  node.on(Node.EventType.TOUCH_CANCEL, (e: EventTouch) => finish(e, false));
  return { node, set(next: number) { v = Math.max(0, Math.min(1, next)); paint(); }, value: () => v };
}
/** Logical UI units, in the same coordinate space as width/height. Capsule is excluded
 * conservatively across the result header; callers without insets retain zero insets. */
export interface PopupSafeInsets { top: number; bottom: number; left: number; right: number; capsule?: { top: number; bottom: number; left: number; right: number } | null }
export interface PopupViewport { width: number; height: number; safeInsets?: PopupSafeInsets }
export interface PanelGeometry { width: number; height: number; scale: number; offsetX?: number; offsetY?: number; titleY?: number }
export interface PanelOptions {
  name: string; height: number; title: string; titleArt?: string | null; closable?: boolean; onClose?: () => void;
  width?: number; dy?: number; tint?: TintSet;
}
/** Full-screen modal: shade (35 % darken) + BlockInputEvents + framed panel. Opens 0.22 s fade + 0.92→1 ease-out, closes 0.15 s. */
export class PopupPanel {
  readonly root: Node; readonly body: Node; readonly tint: TintSet;
  width: number; height: number;
  private frame: Node; plank: Node;
  private layoutStrategy: ((width: number, height: number, safeInsets?: PopupSafeInsets) => PanelGeometry) | null = null;
  private reflow: ((geometry: PanelGeometry) => void) | null = null;
  private shade: Graphics; private opacity: UIOpacity; private t = 0; private closing = -1; private done: (() => void) | null = null;
  private toggles: ToggleHandle[] = []; private viewW = 0; private viewH = 0; private dy: number;
  private reduced = reducedMotion();
  private safeInsets: PopupSafeInsets | undefined; private safeKey = '';
  constructor(parent: Node, readonly options: PanelOptions, viewport: PopupViewport) {
    this.tint = options.tint || new TintSet(); this.width = options.width || PANEL_WIDTH; this.height = options.height; this.dy = options.dy || 0;
    this.root = uiNode(options.name, parent, viewport.width, viewport.height); this.root.addComponent(BlockInputEvents);
    const shadeNode = uiNode('PopupShade', this.root, viewport.width, viewport.height); this.shade = shadeNode.addComponent(Graphics);
    this.body = uiNode('PopupPanel', this.root, this.width, this.height); this.opacity = this.body.addComponent(UIOpacity); this.opacity.opacity = 0;
    const frame = artSprite(this.body, 'popup/panel_frame_9s', 0, 0, this.width, this.height, 'PanelFrame'); this.frame = frame.node; this.tint.sprite(frame, 'ui');
    const plank = this.titlePlank(options.title, options.titleArt || null); this.plank = plank; plank.setPosition(0, this.height / 2, 0);
    if (options.closable) this.closeButton();
    this.layout(viewport.width, viewport.height, viewport.safeInsets); this.tint.update(true); this.paintShade(0);
  }
  private titlePlank(title: string, art: string | null): Node {
    const lib = BoardArt.shared(), titleSize = art ? lib.size(art) : { width: measure(title, 46), height: 50 };
    const w = Math.max(300, titleSize.width + 150), h = 105, n = uiNode('TitlePlank', this.body, w, h);
    const plank = artSprite(n, 'popup/title_plank_3s', 0, 0, w, h, 'Plank'); this.tint.sprite(plank, 'ui');
    if (art && lib.frame(art)) { const t = artSprite(n, art, 0, -h * 0.02, titleSize.width, titleSize.height, 'Title'); this.tint.sprite(t, 'ui'); }
    else { const l = makeLabel(n, title, 0, -h * 0.02, 44, { width: w - 60, name: 'Title' }); this.tint.label(l, 'brown'); }
    return n;
  }
  private closeButton() {
    const n = uiNode('Close', this.body, 96, 96); n.setPosition(this.width / 2 - 32, this.height / 2 - 24, 0);
    const s = artSprite(n, 'popup/btn_close', 0, 0, 80, undefined, 'Face'); this.tint.sprite(s, 'ui');
    pressable(n, s.node, () => this.close(), { sound: 'back' });
  }
  /** Panel-local px → body node position (body origin = panel centre). */
  at(x: number, y: number): [number, number] { return [x, this.height / 2 - y]; }
  sprite(key: string, x: number, y: number, w?: number, h?: number, kind: TintKind = 'ui', parent?: Node): Sprite {
    const p = this.at(x, y), s = artSprite(parent || this.body, key, p[0], p[1], w, h); this.tint.sprite(s, kind); return s;
  }
  text(str: string, x: number, y: number, size: number, role: TextRole = 'brown', opts: LabelOptions & { parent?: Node } = {}): Label {
    const p = this.at(x, y), l = makeLabel(opts.parent || this.body, str, p[0], p[1], size, opts); this.tint.label(l, role); return l;
  }
  button(kind: 'primary' | 'secondary', label: string, x: number, y: number, w: number, h: number, tap: () => void, opts: ButtonOptions = {}): ArtButtonHandle {
    const p = this.at(x, y); return artButton(this.body, this.tint, kind, label, p[0], p[1], w, h, tap, opts);
  }
  toggle(x: number, y: number, h: number, on: boolean, change: (on: boolean) => void, name?: string): ToggleHandle {
    const p = this.at(x, y), t = artToggle(this.body, this.tint, p[0], p[1], h, on, change, name); this.toggles.push(t); return t;
  }
  slider(x: number, y: number, w: number, h: number, v: number, change: (v: number) => void, name?: string): SliderHandle {
    const p = this.at(x, y); return artSlider(this.body, this.tint, p[0], p[1], w, h, v, change, name);
  }
  /** Flat rounded "well" (the only inner layer the lite rules allow); colour is day RGB, night multiplies by K_UI. */
  well(x: number, y: number, w: number, h: number, rgb: number[] = [236, 224, 196], radius = 24, parent?: Node): Node {
    const n = uiNode('Well', parent || this.body, w, h), p = this.at(x, y); n.setPosition(p[0], p[1], 0);
    const g = n.addComponent(Graphics);
    this.tint.shape(g, (gr, night, alpha) => { const c = tintRgb('ui', night, rgb); gr.fillColor = new Color(c[0], c[1], c[2], Math.round(255 * alpha)); gr.roundRect(-w / 2, -h / 2, w, h, radius); gr.fill(); });
    return n;
  }
  /** Opt-in geometry for dense result pages. Other popup designs keep their original sizing. */
  setLayoutStrategy(strategy: (width: number, height: number, safeInsets?: PopupSafeInsets) => PanelGeometry, reflow: (geometry: PanelGeometry) => void) {
    this.layoutStrategy = strategy; this.reflow = reflow; this.layout(this.viewW, this.viewH, this.safeInsets);
  }
  layout(width: number, height: number, safeInsets?: PopupSafeInsets) {
    const key = JSON.stringify(safeInsets || null);
    if (this.layoutStrategy && this.viewW && (width !== this.viewW || height !== this.viewH || key !== this.safeKey)) resetPresses(this.root);
    this.safeInsets = safeInsets; this.safeKey = key;
    const geometry = this.layoutStrategy?.(width, height, safeInsets) || { width: this.width, height: this.height, scale: popupScale(width, height) };
    this.viewW = width; this.viewH = height; const s = geometry.scale;
    this.width = geometry.width; this.height = geometry.height;
    this.body.getComponent(UITransform)!.setContentSize(this.width, this.height);
    this.frame.getComponent(UITransform)!.setContentSize(this.width / this.frame.scale.x, this.height / this.frame.scale.y);
    this.plank.setPosition(0, geometry.titleY ?? this.height / 2, 0);
    this.root.getComponent(UITransform)!.setContentSize(width, height); this.shade.node.getComponent(UITransform)!.setContentSize(width, height);
    const k = this.motion().scale;
    this.body.setScale(s * k, s * k, 1); this.body.setPosition(geometry.offsetX ?? 0, geometry.offsetY ?? -this.dy * s, 0);
    this.reflow?.(geometry);
    this.paintShade(this.alpha());
  }
  /** SPEC §4: enter 320 ms cubic-bezier(0.05,0.7,0.1,1), exit 180 ms cubic-bezier(0.3,0,0.8,0.15); alpha on the same curves. */
  private motion() { return this.closing >= 0 ? exitAt(CLOSE_S - this.closing, this.reduced) : enterAt(this.t, this.reduced); }
  private alpha() { return this.motion().alpha; }
  private paintShade(a: number) {
    const g = this.shade; g.clear(); g.fillColor = new Color(SHADE.rgb[0], SHADE.rgb[1], SHADE.rgb[2], Math.round(255 * SHADE.alpha * a));
    g.rect(-this.viewW / 2, -this.viewH / 2, this.viewW, this.viewH); g.fill();
  }
  setInputEnabled(on: boolean) { if (on) blockedPressRoots.delete(this.root); else { blockedPressRoots.add(this.root); resetPresses(this.root); } }
  get isClosing() { return this.closing >= 0; }
  get alive() { return isValid(this.root, true); }
  update(dt: number) {
    if (!isValid(this.root, true)) return;
    const step = Math.max(0, Math.min(dt, 0.1));
    if (this.closing >= 0) { this.closing = Math.max(0, this.closing - step); if (this.closing <= 0) { this.finish(); return; } }
    else if (this.t < OPEN_S) this.t = Math.min(OPEN_S, this.t + step);
    const a = this.alpha(); this.opacity.opacity = Math.round(255 * a); this.tint.setAlpha(a); this.layout(this.viewW, this.viewH, this.safeInsets);
    for (let i = 0; i < this.toggles.length; i++) this.toggles[i].update(step);
    this.tint.update();
  }
  /** Show fully open now (no pop-in): for a panel that replaces one already on screen. */
  settleOpen() { if (this.closing >= 0 || !isValid(this.root, true)) return; this.t = OPEN_S; this.update(0); }
  close(done?: () => void) {
    if (this.closing >= 0 || !isValid(this.root, true)) return; this.done = done || null; this.closing = CLOSE_S; this.setInputEnabled(false);
    this.options.onClose?.();
  }
  /** Remove at once (no animation): host teardown. */
  destroy() { if (isValid(this.root, true)) { this.setInputEnabled(false); this.root.destroy(); } this.tint.clear(); }
  private finish() { const d = this.done; this.done = null; this.destroy(); d?.(); }
}
/** Ordered popups of one canvas: the last one is on top; closed panels drop out after their close animation. */
export class PopupStack {
  private list: PopupPanel[] = [];
  constructor(readonly parent: Node, private readonly viewport: () => PopupViewport) {}
  open(options: PanelOptions): PopupPanel {
    const p = new PopupPanel(this.parent, options, this.viewport()); p.root.setSiblingIndex(this.parent.children.length - 1); this.list.push(p); this.syncInput(); return p;
  }
  top(): PopupPanel | null { this.prune(); for (let i = this.list.length - 1; i >= 0; i--) if (!this.list[i].isClosing) return this.list[i]; return null; }
  find(name: string): PopupPanel | null { this.prune(); for (let i = this.list.length - 1; i >= 0; i--) if (this.list[i].options.name === name && !this.list[i].isClosing) return this.list[i]; return null; }
  /** True while any panel is open or still animating (input to the layer below stays blocked). */
  any(): boolean { this.prune(); return this.list.length > 0; }
  names(): string[] { this.prune(); return this.list.filter(p => !p.isClosing).map(p => p.options.name); }
  update(dt: number) { const l = this.list.slice(); for (let i = 0; i < l.length; i++) l[i].update(dt); this.prune(); }
  layout() { const v = this.viewport(); for (let i = 0; i < this.list.length; i++) this.list[i].layout(v.width, v.height, v.safeInsets); }
  close(name: string) { const p = this.find(name); if (p) p.close(); }
  clear() { for (let i = 0; i < this.list.length; i++) this.list[i].destroy(); this.list.length = 0; }
  private syncInput() { const top = this.list.length ? this.list[this.list.length - 1] : null; for (const p of this.list) p.setInputEnabled(p === top && !p.isClosing); }
  private prune() { this.list = this.list.filter(p => p.alive); this.syncInput(); }
}
