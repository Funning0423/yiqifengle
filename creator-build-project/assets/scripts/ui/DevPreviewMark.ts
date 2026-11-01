import { Node, UITransform, Label, Color, Layers, isValid, director, Director, view } from 'cc';
import { debugSearch } from '../region/DebugQuery';
import { DEBUG } from 'cc/env';
import { boardSafeInsets } from './BoardLayout';
import { wxQaEnv } from '../world-r2/QaSkip';
/** Funning (Mac, 09a1b8e): the journey cutscene carries no button and no caption strip. Test builds only show one tiny,
 *  semi-transparent line in the bottom-right corner; release builds show nothing. It is a bare Label: no Button, no
 *  BlockInputEvents, no touch listener, so every tap passes through to the picture (and tapping never pauses). */
export const DEV_PREVIEW_TEXT = '开发预览画面，不代表最终效果';
export const DEV_PREVIEW_MARK = Object.freeze({ font: 10, line: 14, width: 140, inset: 12, alpha: 150 });
/** Which builds show the line.
 *  - Cocos build define DEBUG (cc/env; build option "debug": true, e.g. tools/wechat-build-options.json): always.
 *  - WeChat: wx.getAccountInfoSync().miniProgram.envVersion 'develop' (devtools / 开发版) or 'trial' (体验版): shown;
 *    'release' (正式版), or anything unreadable: hidden. This is what tells the desktop/test package (built with
 *    tools/build-guard/wechat-release.json, debug false) apart from the store build, which DEBUG alone cannot.
 *  - No wx (web-mobile preview / harness): shown; web builds are internal only. */
export function devPreviewBuild(debug: boolean = DEBUG, host: any = (globalThis as any).wx): boolean {
  if (debug) return true;
  if (!host) return true;
  try { return wxQaEnv(host); } catch { return false; } /* env read once per wx (QaSkip) */
}
/** Centre of the line in canvas coords (origin centre, y up): right-aligned, inset from the safe-area bottom/right edges.
 *  The WeChat capsule is top-right, so the line never meets it; the rect is returned for tests. */
export function devPreviewMarkRect(width: number, height: number, safe = boardSafeInsets(width, height)) {
  const M = DEV_PREVIEW_MARK, right = Math.max(0, safe.right) + M.inset, bottom = Math.max(0, safe.bottom) + M.inset;
  const w = Math.min(M.width, Math.max(1, width - 2 * right)), h = M.line;
  return { x: width / 2 - right - w / 2, y: -height / 2 + bottom + h / 2, width: w, height: h, right, bottom, capsule: safe.capsule ?? null };
}
/** perf-r1: dev-only on-screen perf overlay (fps, avg/max frame ms, >33 ms frames, JS heap, GPU texture/buffer MB) for real-device
 *  numbers in the DevTools / 开发版 / 体验版 (trial) build. Flag: launch query `perf=1` (location.search, DevTools 编译模式 启动参数,
 *  preview/trial QR 启动参数, or globalThis.__qfQuery), read once at construction. Off by default. Only constructed when
 *  devPreviewBuild() — a formal release (envVersion 'release', DEBUG off) never creates it, and debugSearch never reads a wx query
 *  there. No wx.login / wx.authorize, no storage, no sync host API per frame (performance.now + device.memoryStatus only). */
export const PERF_OVERLAY_FLAG = 'perf';
export function perfOverlayOn(search: string = debugSearch()): boolean { return /(?:^\?|&)perf=1(?:&|$)/.test(search || ''); }
/** Pure: summary of one window of frame intervals (ms). */
export function perfWindow(ms: number[]) { let sum = 0, max = 0, slow = 0; for (const v of ms) { sum += v; if (v > max) max = v; if (v > 33.4) slow++; }
  const n = ms.length; return { fps: n && sum > 0 ? Math.round(n * 1000 / sum) : 0, avg: n ? +(sum / n).toFixed(1) : 0, max: Math.round(max), slow }; }
export class PerfOverlay {
  readonly root: Node; private label: Label; private last = -1; private buf: number[] = []; private t0 = 0;
  constructor(parent: Node) {
    const n = new Node('QfPerfOverlay'); n.layer = Layers.Enum.UI_2D; parent.addChild(n); n.addComponent(UITransform).setContentSize(220, 44);
    const l = n.addComponent(Label); l.fontSize = 11; l.lineHeight = 14; l.color = new Color(255, 255, 160, 230); l.horizontalAlign = Label.HorizontalAlign.LEFT;
    l.overflow = Label.Overflow.CLAMP; l.enableWrapText = true; l.string = 'perf …'; this.label = l; this.root = n;
    director.on(Director.EVENT_AFTER_DRAW, this.tick, this);
  }
  private tick() {
    if (!isValid(this.root, true)) { director.off(Director.EVENT_AFTER_DRAW, this.tick, this); return; }
    const now = (globalThis as any).performance?.now?.() ?? Date.now(); if (this.last >= 0) this.buf.push(now - this.last); this.last = now;
    if (!this.t0) this.t0 = now; if (now - this.t0 < 500) return; this.t0 = now;
    const w = perfWindow(this.buf); this.buf.length = 0;
    let heap = '-', tex = '-', bufMB = '-';
    try { const m = (globalThis as any).performance?.memory; if (m?.usedJSHeapSize) heap = (m.usedJSHeapSize / 1048576).toFixed(0); } catch { }
    try { const ms = (director as any).root?.device?.memoryStatus; if (ms) { tex = (ms.textureSize / 1048576).toFixed(0); bufMB = (ms.bufferSize / 1048576).toFixed(0); } } catch { }
    this.label.string = `fps ${w.fps}  avg ${w.avg}ms  max ${w.max}ms  >33:${w.slow}\nheap ${heap}MB  tex ${tex}MB  buf ${bufMB}MB`;
    try { const f = view.getVisibleSize(), safe = boardSafeInsets(f.width, f.height); this.root.setPosition(-f.width / 2 + 12 + 110, f.height / 2 - Math.max(0, safe.top) - 30, 0);
      const p = this.root.parent; if (p && p.children[p.children.length - 1] !== this.root) this.root.setSiblingIndex(p.children.length - 1); } catch { }
  }
  dispose() { director.off(Director.EVENT_AFTER_DRAW, this.tick, this); if (isValid(this.root, true)) this.root.destroy(); }
}
export class DevPreviewMark {
  readonly root: Node; private label: Label; readonly enabled: boolean; private perf: PerfOverlay | null = null;
  constructor(parent: Node, enabled = devPreviewBuild()) {
    this.enabled = enabled;
    const n = new Node('DevPreviewMark'); n.layer = Layers.Enum.UI_2D; parent.addChild(n);
    const M = DEV_PREVIEW_MARK; n.addComponent(UITransform).setContentSize(M.width, M.line);
    const l = n.addComponent(Label); l.string = DEV_PREVIEW_TEXT; l.fontSize = M.font; l.lineHeight = M.line;
    l.color = new Color(255, 255, 255, M.alpha); l.horizontalAlign = Label.HorizontalAlign.RIGHT; l.verticalAlign = Label.VerticalAlign.CENTER;
    l.overflow = Label.Overflow.SHRINK; l.enableWrapText = false;
    this.label = l; this.root = n; n.active = false;
    if (enabled) { try { if (perfOverlayOn()) this.perf = new PerfOverlay(parent); } catch { } }
  }
  /** visible: the caller's "journey cutscene on screen" state. Release builds never show it. */
  sync(width: number, height: number, visible: boolean) {
    if (!isValid(this.root, true)) return; const on = this.enabled && visible; this.root.active = on; if (!on) return;
    const r = devPreviewMarkRect(width, height); this.root.getComponent(UITransform)!.setContentSize(r.width, r.height); this.root.setPosition(r.x, r.y, 0);
    const parent = this.root.parent; if (parent && parent.children[parent.children.length - 1] !== this.root) this.root.setSiblingIndex(parent.children.length - 1);
  }
  diagnostics() { const r = this.root; return { enabled: this.enabled, visible: isValid(r, true) && r.activeInHierarchy, text: this.label.string, x: r.position.x, y: r.position.y }; }
  dispose() { this.perf?.dispose(); this.perf = null; if (isValid(this.root, true)) this.root.destroy(); }
}
