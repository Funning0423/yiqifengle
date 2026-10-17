import { Node, UITransform, Label, Color, Layers, isValid } from 'cc';
import { DEBUG } from 'cc/env';
import { boardSafeInsets } from './BoardLayout';
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
  try { const env = host.getAccountInfoSync?.()?.miniProgram?.envVersion; return env === 'develop' || env === 'trial'; } catch { return false; }
}
/** Centre of the line in canvas coords (origin centre, y up): right-aligned, inset from the safe-area bottom/right edges.
 *  The WeChat capsule is top-right, so the line never meets it; the rect is returned for tests. */
export function devPreviewMarkRect(width: number, height: number, safe = boardSafeInsets(width, height)) {
  const M = DEV_PREVIEW_MARK, right = Math.max(0, safe.right) + M.inset, bottom = Math.max(0, safe.bottom) + M.inset;
  const w = Math.min(M.width, Math.max(1, width - 2 * right)), h = M.line;
  return { x: width / 2 - right - w / 2, y: -height / 2 + bottom + h / 2, width: w, height: h, right, bottom, capsule: safe.capsule ?? null };
}
export class DevPreviewMark {
  readonly root: Node; private label: Label; readonly enabled: boolean;
  constructor(parent: Node, enabled = devPreviewBuild()) {
    this.enabled = enabled;
    const n = new Node('DevPreviewMark'); n.layer = Layers.Enum.UI_2D; parent.addChild(n);
    const M = DEV_PREVIEW_MARK; n.addComponent(UITransform).setContentSize(M.width, M.line);
    const l = n.addComponent(Label); l.string = DEV_PREVIEW_TEXT; l.fontSize = M.font; l.lineHeight = M.line;
    l.color = new Color(255, 255, 255, M.alpha); l.horizontalAlign = Label.HorizontalAlign.RIGHT; l.verticalAlign = Label.VerticalAlign.CENTER;
    l.overflow = Label.Overflow.SHRINK; l.enableWrapText = false;
    this.label = l; this.root = n; n.active = false;
  }
  /** visible: the caller's "journey cutscene on screen" state. Release builds never show it. */
  sync(width: number, height: number, visible: boolean) {
    if (!isValid(this.root, true)) return; const on = this.enabled && visible; this.root.active = on; if (!on) return;
    const r = devPreviewMarkRect(width, height); this.root.getComponent(UITransform)!.setContentSize(r.width, r.height); this.root.setPosition(r.x, r.y, 0);
    const parent = this.root.parent; if (parent && parent.children[parent.children.length - 1] !== this.root) this.root.setSiblingIndex(parent.children.length - 1);
  }
  diagnostics() { const r = this.root; return { enabled: this.enabled, visible: isValid(r, true) && r.activeInHierarchy, text: this.label.string, x: r.position.x, y: r.position.y }; }
  dispose() { if (isValid(this.root, true)) this.root.destroy(); }
}
