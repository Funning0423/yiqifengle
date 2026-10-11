/** Engine-free board screen layout (b-board v3.1, INTEGRATION §2). All values are logical pt, origin top-left, y down.
 *  Reference phone 390×844 (capsule y 51–83, home bar 34): pause (38,67) hit 44, info plate x 88–302 y 96–156,
 *  tray centre y 400 with pitch P 42.6 (82 px of the 750 design), tool bar y 730, step 82, hit 64. */
export interface SafeArea { top: number; bottom: number; left: number; right: number; capsule?: { left: number; top: number; right: number; bottom: number } | null }
export interface BoardLayout {
  width: number; height: number; pitch: number; k: number;
  pause: { x: number; y: number; size: number; hit: number };
  plate: { x: number; y: number; width: number; height: number };
  tray: { x: number; y: number; width: number; height: number };
  grid: { x: number; y: number; size: number };
  tools: { x: number; y: number; step: number; hit: number; size: number };
  toast: { x: number; y: number };
  capsuleAvoid: { left: number; top: number; bottom: number };
}
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
  const trayTopMin = plateBottom + 24, trayBottomMax = toolsY - REF.toolHalf;
  const maxPitch = REF.pitch * Math.min(1.3, Math.max(1, width / 390));
  const pitch = Math.max(20, Math.min(maxPitch, (width - safe.left - safe.right - 18) / REF.trayW, (trayBottomMax - trayTopMin) / REF.trayH));
  const k = pitch / REF.pitch, trayW = pitch * REF.trayW, trayH = pitch * REF.trayH;
  const trayY = Math.min(plateBottom + REF.trayGap * k + trayH / 2, trayBottomMax - trayH / 2);
  const cx = (safe.left + width - safe.right) / 2, toolK = Math.max(0.8, Math.min(1.2, k));
  return {
    width, height, pitch, k,
    pause: { x: safe.left + REF.pauseX, y: pauseY, size: 41, hit: 44 },
    plate: { x: width / 2, y: plateTop + REF.plateH / 2, width: plateWidth(goals), height: REF.plateH },
    tray: { x: cx, y: trayY, width: trayW, height: trayH },
    grid: { x: cx, y: trayY, size: pitch * 7 },
    tools: { x: cx, y: toolsY, step: 82 * toolK, hit: 64, size: 75 * toolK },
    toast: { x: cx, y: toolsY - 62 * toolK },
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
    toast: { x: colX, y: toolsY + 40 * toolK + 28 },
    capsuleAvoid: { left: cap ? cap.left - 44 : width - 137, top: cap ? cap.top : 51, bottom: cap ? cap.bottom : 83 },
  };
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
