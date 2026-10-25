/** Engine-free board screen layout (b-board v3.1, INTEGRATION §2). All values are logical pt, origin top-left, y down.
 *  Reference phone 390×844 (capsule y 51–83, home bar 34): pause (38,67) hit 44, info plate x 88–302 y 96–156,
 *  tray centre y 400 with pitch P 42.6 (82 px of the 750 design), tool bar y 730, step 82, hit 64.
 *  Hint banner (toast, r4.1): above the tray, centred in the plate→tray band (y 168–200 on the reference phone), every region alike. */
export interface SafeArea { top: number; bottom: number; left: number; right: number; capsule?: { left: number; top: number; right: number; bottom: number } | null }
export interface BoardLayout {
  width: number; height: number; pitch: number; k: number;
  pause: { x: number; y: number; size: number; hit: number };
  plate: { x: number; y: number; width: number; height: number };
  tray: { x: number; y: number; width: number; height: number };
  grid: { x: number; y: number; size: number };
  tools: { x: number; y: number; step: number; hit: number; size: number };
  /** Hint banner centre, its max width (≤ TOAST.maxWidth, inset from the screen / column edges) and fixed height. */
  toast: { x: number; y: number; maxWidth: number; height: number };
  capsuleAvoid: { left: number; top: number; bottom: number };
}
/** Hint banner (提示牌): 32 pt pill, ≤ 330 pt wide, ≥ 6 pt from the plate above and the tray below, ≥ 12 pt in from the screen edges. */
export const TOAST = { height: 32, gap: 6, maxWidth: 330, edge: 12 } as const;
export const REF = { pitch: 42.6, trayW: 681 / 82, trayH: 723 / 82, pauseX: 38, plateGap: 29, plateH: 60, trayGap: 56, toolsAboveSafe: 80, toolHalf: 52 } as const;
/** Display sizes relative to the pitch P. */
export const CELL = { piece: 1.21, pieceLift: 2 / 42.6, special: 1.80, bomb: 1.89, bombPiece: 0.8, tile: 1.16, obstacle: 1.16 } as const;
export function plateWidth(goals: number): number { return goals <= 2 ? 214 : goals === 3 ? 232 : 250; }
export function boardLayout(width: number, height: number, safe: SafeArea, goals = 2): BoardLayout {
  const cap = safe.capsule && safe.capsule.bottom > safe.capsule.top ? safe.capsule : null;
  const pauseY = cap ? (cap.top + cap.bottom) / 2 : Math.max(safe.top, 20) + 20;
  const plateTop = pauseY + REF.plateGap, plateBottom = plateTop + REF.plateH;
  if (width > height) return sideLayout(width, height, safe, goals, cap, pauseY, plateTop);
  const toolsY = height - Math.max(safe.bottom, 12) - REF.toolsAboveSafe;
  // The plate→tray band holds the hint banner (44 pt; short phones give the tray up to 20 pt for it). Only when the tray is
  // already at its minimum pitch (e.g. 390×520) does the band shrink; the banner then keeps the tray clear and overlaps the plate.
  const trayTopMin = plateBottom + Math.max(24, TOAST.height + 2 * TOAST.gap), trayBottomMax = toolsY - REF.toolHalf;
  const maxPitch = REF.pitch * Math.min(1.3, Math.max(1, width / 390));
  const pitch = Math.max(20, Math.min(maxPitch, (width - safe.left - safe.right - 18) / REF.trayW, (trayBottomMax - trayTopMin) / REF.trayH));
  const k = pitch / REF.pitch, trayW = pitch * REF.trayW, trayH = pitch * REF.trayH;
  const trayY = Math.min(plateBottom + Math.max(REF.trayGap * k, TOAST.height + 2 * TOAST.gap) + trayH / 2, trayBottomMax - trayH / 2), trayTop = trayY - trayH / 2;
  const cx = (safe.left + width - safe.right) / 2, toolK = Math.max(0.8, Math.min(1.2, k));
  return {
    width, height, pitch, k,
    pause: { x: safe.left + REF.pauseX, y: pauseY, size: 41, hit: 44 },
    plate: { x: width / 2, y: plateTop + REF.plateH / 2, width: plateWidth(goals), height: REF.plateH },
    tray: { x: cx, y: trayY, width: trayW, height: trayH },
    grid: { x: cx, y: trayY, size: pitch * 7 },
    tools: { x: cx, y: toolsY, step: 82 * toolK, hit: 64, size: 75 * toolK },
    toast: { x: cx, y: Math.min((plateBottom + trayTop) / 2, trayTop - TOAST.gap - TOAST.height / 2), maxWidth: Math.min(TOAST.maxWidth, width - safe.left - safe.right - 2 * TOAST.edge), height: TOAST.height },
    capsuleAvoid: { left: cap ? cap.left - 44 : width - 137, top: cap ? cap.top : 51, bottom: cap ? cap.bottom : 83 },
  };
}
/** Landscape (desktop preview / rotated devices): pause, plate and tool bar stack in a left column, the board takes
 *  the full height on the right. The portrait reference layout above is the shipped one. */
function sideLayout(width: number, height: number, safe: SafeArea, goals: number, cap: SafeArea['capsule'], pauseY: number, plateTop: number): BoardLayout {
  const pw = plateWidth(goals), colX = safe.left + 16 + pw / 2, colRight = colX + pw / 2 + 16;
  const toolK = 0.8, toolsY = plateTop + REF.plateH + 24 + 40 * toolK;
  const right = width - Math.max(safe.right, 12), top = Math.max(safe.top, 12) + 8, bottom = height - Math.max(safe.bottom, 12) - 8;
  const pitch = Math.max(14, Math.min(REF.pitch * 1.3, (right - colRight) / REF.trayW, (bottom - top) / REF.trayH));
  const k = pitch / REF.pitch, trayW = pitch * REF.trayW, trayH = pitch * REF.trayH, cx = (colRight + right) / 2, cy = (top + bottom) / 2;
  return {
    width, height, pitch, k,
    pause: { x: safe.left + REF.pauseX, y: pauseY, size: 41, hit: 44 },
    plate: { x: colX, y: plateTop + REF.plateH / 2, width: pw, height: REF.plateH },
    tray: { x: cx, y: cy, width: trayW, height: trayH },
    grid: { x: cx, y: cy, size: pitch * 7 },
    tools: { x: colX, y: toolsY, step: 82 * toolK, hit: 64, size: 75 * toolK },
    toast: sideToast(width, safe, cap, top, cx, cy - trayH / 2, cx - trayW / 2, colRight, right, toolsY + 40 * toolK + 28),
    capsuleAvoid: { left: cap ? cap.left - 44 : width - 137, top: cap ? cap.top : 51, bottom: cap ? cap.bottom : 83 },
  };
}
/** Landscape banner: above the tray (centred on it) when the strip over the tray holds it clear of the top inset and the
 *  capsule; otherwise (short windows, tray full height) in the left column under the tool bar, never over the tray. */
function sideToast(width: number, safe: SafeArea, cap: SafeArea['capsule'], top: number, trayX: number, trayTop: number, trayLeft: number, colRight: number, right: number, colY: number): BoardLayout['toast'] {
  const h = TOAST.height, w = Math.min(TOAST.maxWidth, right - colRight - 2 * TOAST.edge);
  const avoidLeft = cap ? cap.left - 44 : width - 137, avoidBottom = cap ? cap.bottom : 83;
  const bandTop = trayX + w / 2 > avoidLeft ? Math.max(top, avoidBottom) : top, room = trayTop - bandTop - h;
  if (room >= 2 * TOAST.gap) return { x: trayX, y: trayTop - Math.min(12, room / 2) - h / 2, maxWidth: w, height: h };
  const l = safe.left + TOAST.edge, r = trayLeft - TOAST.edge;
  return { x: (l + r) / 2, y: colY, maxWidth: Math.min(TOAST.maxWidth, r - l), height: h };
}
/** Centre of cell (row, col) in top-left pt. */
export function cellCenter(l: BoardLayout, index: number): { x: number; y: number } {
  const r = Math.floor(index / 7), c = index % 7; return { x: l.grid.x + (c - 3) * l.pitch, y: l.grid.y + (r - 3) * l.pitch };
}
/** Tool slot x positions, centred, for n ≤ 3 visible tools. */
export function toolSlots(l: BoardLayout, n: number): number[] {
  const out: number[] = []; for (let i = 0; i < n; i++) out.push(l.tools.x + (i - (n - 1) / 2) * l.tools.step); return out;
}
/** Board tool bar: at most 3, priority 星光 > 风语铃 > 潮汐瓶 > regional, only tools in stock at the start of the run. */
export const TOOL_PRIORITY: readonly string[] = ['bomb', 'windBell', 'tideBottle', 'tideNet', 'sunSeed', 'starShears', 'tideAnchor', 'prismShift'];
export function pickToolBar(tools: ReadonlyArray<{ kind: string; count: number }>): string[] {
  const ranked = tools.filter(t => t.kind !== 'pearl' && t.count > 0).map(t => t.kind);
  ranked.sort((a, b) => rank(a) - rank(b));
  return ranked.slice(0, 3);
}
/** QA frames only: URL `qaTools=3` forces the first 3 TOOL_PRIORITY tools into the bar (layout/camera checks).
 * `guarded` must be true only for the player build (`MINIGAME`): then this always returns null. */
export function qaForcedToolBar(search: string | null | undefined, guarded: boolean): string[] | null {
  if (guarded || typeof search !== 'string') return null;
  const m = /(?:^|[?&])qaTools=([123])(?:&|$)/.exec(search); return m ? TOOL_PRIORITY.slice(0, Number(m[1])) : null;
}
function rank(kind: string) { const i = TOOL_PRIORITY.indexOf(kind); return i < 0 ? TOOL_PRIORITY.length : i; }
/** Idle auto-hint clock: first hint after 5 s without input, then every 8 s; any input restarts the 5 s wait. */
export const HINT_FIRST_S = 5, HINT_REPEAT_S = 8, TOAST_S = 2;
export class IdleHintClock {
  private idle = 0; private shown = 0;
  reset() { this.idle = 0; this.shown = 0; }
  /** Advance; returns true on the frame a hint is due. */
  tick(dt: number, active: boolean): boolean {
    if (!active) { this.idle = 0; this.shown = 0; return false; }
    this.idle += Math.max(0, Math.min(dt, 0.25));
    const due = this.shown === 0 ? HINT_FIRST_S : HINT_FIRST_S + this.shown * HINT_REPEAT_S;
    if (this.idle >= due) { this.shown++; return true; }
    return false;
  }
  count() { return this.shown; }
}
/** Safe-area insets of the board UI (moved verbatim from ManagedMobileBoardUI.safeInsets, which now delegates here) so the
 *  lakeside landing→board hook predicts the exact BoardLayout frame the board UI will report. Reads CSS env + wx only. */
export function boardSafeInsets(w: number, h: number): SafeArea & { portrait: boolean } {
  const portrait = w < h * 1.1; let top = portrait ? 47 : 12, bottom = portrait ? 34 : 21, left = portrait ? 0 : 44, right = left;
  if (typeof document !== 'undefined' && document.documentElement && typeof getComputedStyle === 'function') { const css = getComputedStyle(document.documentElement); const read = (name: string) => parseFloat(css.getPropertyValue(name)) || 0; top = Math.max(top, read('--safe-top')); bottom = Math.max(bottom, read('--safe-bottom')); left = Math.max(left, read('--safe-left')); right = Math.max(right, read('--safe-right')); }
  const wx = (globalThis as any).wx; let info: any = null, capsule: any = null;
  try { info = wx?.getWindowInfo?.(); } catch { } if (!info) try { info = wx?.getSystemInfoSync?.(); } catch { }
  const ww = Number(info?.windowWidth) || w, hh = Number(info?.windowHeight) || h, sx = w / ww, sy = h / hh;
  const finite = (x: any) => typeof x === 'number' && Number.isFinite(x);
  if (ww > 0 && hh > 0 && Number.isFinite(sx) && Number.isFinite(sy)) {
    const a = info?.safeArea;
    if (a && [a.top, a.bottom, a.left, a.right].every(finite) && a.top >= 0 && a.bottom >= a.top && a.bottom <= hh && a.left >= 0 && a.right >= a.left && a.right <= ww) { top = Math.max(top, a.top * sy); bottom = Math.max(bottom, (hh - a.bottom) * sy); left = Math.max(left, a.left * sx); right = Math.max(right, (ww - a.right) * sx); }
    try { const r = wx?.getMenuButtonBoundingClientRect?.(); if (r && [r.top, r.bottom, r.left, r.right].every(finite) && r.top >= 0 && r.bottom > r.top && r.bottom < hh * .35 && r.left >= 0 && r.right > r.left && r.right <= ww) capsule = { top: r.top * sy, bottom: r.bottom * sy, left: r.left * sx, right: r.right * sx }; } catch { }
  }
  if (!capsule && portrait) capsule = { top: top + 4, bottom: top + 36, left: w - 93, right: w - 6 };
  return { top, bottom, left, right, portrait, capsule };
}

/** b16-fix（验收 9d4fcaa8：L13 规则弹窗在 320×568 上要不顶到 HUD）：弹窗默认居中；面板顶（含半块标题木牌 52.5 设计 px）若高过信息牌底 + 12 pt，
 *  就整体往下挪，但底边不低于屏幕底安全区上方 12 pt。返回 PopupPanel 的 dy（750 设计 px，正值向下）。纯函数。 */
/** b16 真机复核 ⑤：信息牌美术（木框外沿 + 阴影）比 geo.plate 低约 6.6pt：d58c1012 Mac web 在 320×568 / 375×667 实测标题木牌离信息牌
 *  只有 5.4pt（模型算的是 12pt）。下移时把这段外沿也算进去，保证真机 ≥12pt。 */
export const RULE_GUIDE_PLATE_OVERHANG = 7;
export function ruleGuideDy(width: number, height: number, panelH: number, plateBottom: number, safeBottom: number, scale: number): number {
  // v2.3：scale 由调用方传 PopupKit.popupScale(width, height)，这里不再抄缩放公式
  const s = scale, top = height / 2 - panelH * s / 2 - 52.5 * s, want = plateBottom + 12 + RULE_GUIDE_PLATE_OVERHANG;
  const room = (height - safeBottom - 12) - (height / 2 + panelH * s / 2);
  const down = Math.max(0, Math.min(want - top, room));
  return down / s;
}
/** 规则弹窗正文行数上限（320×568 下 9 行没有余量）。 */
export const RULE_GUIDE_MAX_LINES = 8;

/** b16 真机复核 ⑤：中文避头尾换行。行首不能是收尾标点（「）」「，」「。」等），行尾不能是开括号；遇到时把上一行最后一个字一起带到下一行。
 *  按 maxW 和 measure(字符串) 逐字贪心排版，返回各行；调用方用 '\n' 拼起来交给 Label（Label 宽度略大于 maxW，不会再自行折行）。 */
export const KINSOKU_NO_START = '）)」』】〕》〉，。、；：！？,.;:!?…·%～';
export const KINSOKU_NO_END = '（(「『【〔《〈';
export function wrapKinsoku(text: string, maxW: number, measure: (s: string) => number): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const ch of Array.from(para)) {
      if (line && measure(line + ch) > maxW) {
        let carry = '';
        const take = () => { carry = line[line.length - 1] + carry; line = line.slice(0, -1); };
        if (KINSOKU_NO_START.includes(ch)) take();
        while (line.length > 1 && (KINSOKU_NO_START.includes(carry[0] ?? '') || KINSOKU_NO_END.includes(line[line.length - 1]))) take();
        out.push(line); line = carry + ch;
      } else line += ch;
    }
    out.push(line);
  }
  return out;
}
