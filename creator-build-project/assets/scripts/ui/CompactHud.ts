/** Compact board HUD for short portrait screens (Grok Bot 10/30, short-screen option (i): UI设计部 ui/coast-compact-hud 46649fd4,
 *  look-at unchanged). Engine-free numbers only. Applies ONLY behind the coast config (COAST_KIT.hud.select = 'compact', i.e. while
 *  BoardProjection.setCoastBoardKit(true)) and only for portrait with logical height ≤ 600; the default board layout is untouched.
 *  PENDING: dimensions are taken from SPEC 46649fd4 §3/§5/§8 until UI设计部 hands over the final SPEC and assets (no assets / .meta yet). */
import type { SafeArea } from './BoardLayout';
export const COMPACT_HUD_PENDING = false;
export const COMPACT_HUD_SOURCE = 'ui/coast-compact-hud 46649fd4 SPEC §3/§5/§8 + 8.x/8.y (final, UI设计部 10/30); no new cut assets (goal bar = hud_levelplate 3-slice, pill = Graphics, tools = existing icons scaled)';
import { K_UI, TEXT_DAY } from './NightTint';
export const COMPACT_TRIGGER = { portrait: true, maxHeight: 600 } as const;
export function compactHudApplies(w: number, h: number): boolean { return w < h * 1.1 && h <= COMPACT_TRIGGER.maxHeight; }
/** Toast crossfade with the level label (SPEC §3.4 / §8.1): in 150 ms easeOutCubic, out 120 ms easeInQuad; T includes both. */
export const COMPACT_TOAST_IN_S = 0.15, COMPACT_TOAST_OUT_S = 0.12;
/** board.compactToast.holdS (SPEC 8.y): FULLY VISIBLE time only = clamp(0.45 + n/4, 2.5, 4.5) s, n = characters without punctuation;
 *  total on screen = COMPACT_TOAST_IN_S + holdS + COMPACT_TOAST_OUT_S (13-char real copy: 3.70 + 0.27 = 3.97 s). */
export function compactToastHoldS(text: string): number { const n = Array.from(text.replace(/[\s\p{P}\p{S}]/gu, '')).length; return Math.min(4.5, Math.max(2.5, 0.45 + n / 4)); }
/** board.compactToast.firstPulseS: first toast of a level only, scale 1 → 1.05 → 1 easeOutBack after the enter (SPEC §8.3). */
export const COMPACT_TOAST_FIRST_PULSE_S = 0.12, COMPACT_TOAST_PULSE_SCALE = 1.05;
export interface CompactHudLayout {
  readonly pending: boolean; readonly rowY: number;
  readonly label: { x: number; y: number; height: number; maxRight: number; maxWidth: number };
  readonly toast: { x: number; y: number; height: number; maxWidth: number; top: number; bottom: number };
  readonly goalBar: { top: number; bottom: number; height: number; width: (goals: number) => number };
  readonly tools: { y: number; size: number; hit: number; step: number; hitTop: number };
  readonly pause: { x: number; y: number; hit: number };
  /** board no-go limits for this HUD: [top, bottom] = goal bar bottom (also ruleGuideDy's plate bottom), tool tap-area top = h − 94 */
  readonly limits: readonly [number, number];
}
export function compactHudLayout(w: number, h: number, safe: SafeArea): CompactHudLayout {
  const cap = safe.capsule && safe.capsule.bottom > safe.capsule.top ? safe.capsule : { top: safe.top + 4, bottom: safe.top + 36, left: w - 93, right: w - 6 };
  const rowY = (cap.top + cap.bottom) / 2, pauseHitBottom = rowY + 22, labelL = safe.left + 38 + 22 + 10, maxRight = cap.left - 10;
  const top = pauseHitBottom + 6, barH = 36, toolsY = h - Math.max(safe.bottom, 12) - 34, hit = 52;
  return {
    pending: COMPACT_HUD_PENDING, rowY,
    label: { x: labelL, y: rowY, height: 28, maxRight, maxWidth: maxRight - labelL },
    toast: { x: labelL, y: rowY, height: 36, maxWidth: maxRight - labelL, top: rowY - 18, bottom: rowY + 18 },
    goalBar: { top, bottom: top + barH, height: barH, width: (goals: number) => Math.min(goals >= 3 ? 250 : goals === 2 ? 232 : 214, w - 24) },
    tools: { y: toolsY, size: 48, hit, step: 64, hitTop: toolsY - hit / 2 },
    pause: { x: safe.left + 38, y: rowY, hit: 44 },
    limits: [top + barH, toolsY - hit / 2],
  };
}
/** Level label (SPEC §3.2/§8.5): '05 · name' 13 pt pill in the capsule row. Name ≤ maxNameChars shows whole; longer → cut to
 *  (maxNameChars − 1) chars + '…'; the number '05 · ' and ≥ 1 name char always stay. 320 wide: 7 (else 6 + …); 390 wide: 12. */
export const COMPACT_LABEL = { fontPt: 13, height: 28, padL: 12, radius: 14, fill: '#FFF4DC', fillAlpha: 0.92, stroke: '#C4A678', strokePt: 1.5 } as const;
export function compactMaxNameChars(w: number): number { return Math.round(w) <= 320 ? 7 : 12; }
export function compactLevelLabel(levelNo: number, name: string, w: number): string {
  const head = String(levelNo).padStart(2, '0') + ' · ', ch = Array.from(name), max = compactMaxNameChars(w);
  return head + (ch.length <= max ? name : ch.slice(0, Math.max(1, max - 1)).join('') + '…');
}
/** Hint pill (SPEC §8.2): replaces the label at the same spot; 36 high, 12 pt, line 14, pad 10 l/r; ≤ 2 lines, broken after '，'.
 *  Width = text + 20 (CJK 12 pt = 12 pt per char), ≤ slot width. */
export const COMPACT_TOAST = { fontPt: 12, lineH: 14, height: 36, padX: 10, maxLines: 2 } as const;
export function compactToastLines(text: string, maxWidth: number): { lines: string[]; width: number } {
  const wOf = (t: string) => Array.from(t).length * COMPACT_TOAST.fontPt, inner = maxWidth - 2 * COMPACT_TOAST.padX;
  let lines = [text]; if (wOf(text) > inner) { const k = text.indexOf('，'); lines = k > 0 ? [text.slice(0, k + 1), text.slice(k + 1)] : [text]; }
  return { lines, width: Math.min(maxWidth, Math.max(...lines.map(wOf)) + 2 * COMPACT_TOAST.padX) };
}
/** Colours (SPEC §8 r3 + 8.x + 8.y): text TEXT_DAY.brown / teal by day; night: sprites × K_UI, brown TEXT_NIGHT, moves cyan [0,22,26];
 *  hourglass icon + divider opaque at night (day unchanged), divider with 6 pt each side. */
export const COMPACT_COLORS = {
  day: { text: TEXT_DAY.brown, moves: TEXT_DAY.teal, hourglassAlpha: 1, dividerAlpha: 1 },
  night: { text: [30, 19, 8] as readonly number[], moves: [0, 22, 26] as readonly number[], tint: K_UI, hourglassAlpha: 1, dividerAlpha: 1 },
  divider: { w: 1.5, h: 18, color: '#C4A678', marginPt: 6 },
} as const;
