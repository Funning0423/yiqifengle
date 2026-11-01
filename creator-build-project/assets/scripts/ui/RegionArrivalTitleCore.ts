/** 地名开局淡入 (Region Arrival Title) core — UI设计部 SPEC v1.1 (ui/region-arrival-title 00bae3e7, approved by Grok Bot).
 *  Pure (no cc imports) so Node tests drive it: the name table, the 2.0 s timeline (§5), the once-per-region flag (§6),
 *  the A/B style tables and the day/night colour mix (§3, §10), and the tip queue that waits behind the title (§7).
 *  ui/RegionArrivalTitle.ts draws it; ManagedMobileBoardUI triggers it after presentForPlay. */
export type RegionTitleId = 'meadow' | 'skycity' | 'lakeside';
/** §2: names come from the code (WindWipeCore / CHAPTERS). The sky city chapter name 「天空回声」 is a chapter name, not this. */
export const REGION_TITLE: Readonly<Record<RegionTitleId, string>> = { meadow: '花粉草甸', skycity: '天空之城', lakeside: '风铃湖畔' };
/** §5 timeline + §3 type (spec_params.json: font 24, track 0.15 em, line 44×1 gap 7 α0.5, in 0.4 / hold 1.2 / out 0.4, rise 6). */
export const REGION_TITLE_TIMING = { inS: 0.4, holdS: 1.35, outS: 0.25, risePt: 6 } as const;
export const REGION_TITLE_TOTAL_S = REGION_TITLE_TIMING.inS + REGION_TITLE_TIMING.holdS + REGION_TITLE_TIMING.outS;
export const REGION_TITLE_TYPE = { font: 24, lineHeight: 32, track: 0.15, spacingX: 3.6, lineW: 44, lineGap: 7, lineH: 1, lineA: 0.5, inkH: 31, minEdge: 32, minFont: 20 } as const;
export interface RegionTitleStyleTable {
  fillDay: readonly number[]; fillNight: readonly number[]; nightAlpha: number;
  shadowDay: readonly number[]; shadowDayA: number; shadowDayBlur: number; shadowDayDy: number;
  glowNight: readonly number[]; glowNightA: number; glowNightBlur: number;
  tightDay: readonly number[]; tightDayA: number; tightDayBlur: number; tightDaySpread: number;
  tightNight: readonly number[]; tightNightA: number; tightNightBlur: number; tightNightSpread: number;
  halo: boolean; haloDay: readonly number[]; haloDayA: number; haloNight: readonly number[]; haloNightA: number; haloPadX: number; haloPadY: number;
}
/** Style A (SPEC §3): soft shadow + tight shade by day, light-blue outer glow at night. Kept as the backup. */
export const REGION_TITLE_A: RegionTitleStyleTable = {
  fillDay: [255, 248, 236], fillNight: [232, 238, 255], nightAlpha: 0.9,
  shadowDay: [90, 58, 30], shadowDayA: 0.5, shadowDayBlur: 4.5, shadowDayDy: 1,
  glowNight: [156, 180, 240], glowNightA: 0.38, glowNightBlur: 7,
  tightDay: [90, 58, 30], tightDayA: 0.4, tightDayBlur: 1, tightDaySpread: 0,
  tightNight: [20, 28, 52], tightNightA: 0.22, tightNightBlur: 1, tightNightSpread: 0,
  halo: false, haloDay: [90, 58, 30], haloDayA: 0, haloNight: [20, 28, 52], haloNightA: 0, haloPadX: 30, haloPadY: 18,
};
/** Style B (SPEC §10, spec_params.json "B"): deeper warm-brown shade + faint radial dark halo, no plate; at night the glow is OFF. */
export const REGION_TITLE_B: RegionTitleStyleTable = {
  ...REGION_TITLE_A,
  shadowDayA: 0.6, shadowDayBlur: 4, shadowDayDy: 1,
  glowNightA: 0,
  tightDayA: 0.95, tightDayBlur: 0.7, tightDaySpread: 3.2,
  tightNightA: 0.75, tightNightBlur: 1, tightNightSpread: 1.5,
  halo: true, haloDay: [90, 58, 30], haloDayA: 0.24, haloNight: [20, 28, 52], haloNightA: 0.22, haloPadX: 30, haloPadY: 18,
};
/** §10.1 switch. Default B (A is 1.3:1 on the windmill blades by day; B ≥ 3.3:1 on all 7 sizes day and night). A remote/local
 *  config `globalThis.__qfConfig.regionTitleStyle` wins when present. */
export const REGION_TITLE_STYLE: { style: 'A' | 'B' } = { style: 'B' };
export function regionTitleStyle(): 'A' | 'B' {
  try { const c = (globalThis as any).__qfConfig?.regionTitleStyle; if (c === 'A' || c === 'B') return c; } catch { }
  return REGION_TITLE_STYLE.style === 'A' ? 'A' : 'B';
}
export function regionTitleTable(style = regionTitleStyle()): RegionTitleStyleTable { return style === 'A' ? REGION_TITLE_A : REGION_TITLE_B; }
/** §5: ease-out cubic in (alpha and the 6 pt rise share the curve), hold, ease-in quad out. dy = pt below the rest position. */
export function regionTitleState(t: number): { alpha: number; dy: number; done: boolean } {
  const T = REGION_TITLE_TIMING, x = Number.isFinite(t) ? t : 0;
  if (x < 0) return { alpha: 0, dy: T.risePt, done: false };
  if (x < T.inS) { const e = 1 - Math.pow(1 - x / T.inS, 3); return { alpha: e, dy: T.risePt * (1 - e), done: false }; }
  if (x < T.inS + T.holdS) return { alpha: 1, dy: 0, done: false };
  if (x < REGION_TITLE_TOTAL_S) { const u = (x - T.inS - T.holdS) / T.outS; return { alpha: 1 - u * u, dy: 0, done: false }; }
  return { alpha: 0, dy: 0, done: true };
}
const mix = (a: readonly number[], b: readonly number[], w: number) => [0, 1, 2].map(i => Math.round(a[i] + (b[i] - a[i]) * w));
const lerp = (a: number, b: number, w: number) => a + (b - a) * w;
/** §3/§10: every colour and alpha mixed channel-wise by uiNightWeight() (recolour, never multiply — NightTint rule). */
export function regionTitleLook(nightW: number, table = regionTitleTable()) {
  const w = Math.max(0, Math.min(1, Number.isFinite(nightW) ? nightW : 0)), s = table;
  // the soft shadow by day becomes the glow at night (both are the Label shadow): in B the glow alpha is 0 → shadow off at night
  return {
    fill: mix(s.fillDay, s.fillNight, w), maxAlpha: lerp(1, s.nightAlpha, w),
    shadow: mix(s.shadowDay, s.glowNight, w), shadowA: lerp(s.shadowDayA, s.glowNightA, w), shadowBlur: lerp(s.shadowDayBlur, s.glowNightBlur, w), shadowDy: lerp(s.shadowDayDy, 0, w),
    glowA: s.glowNightA * w,
    tight: mix(s.tightDay, s.tightNight, w), tightA: lerp(s.tightDayA, s.tightNightA, w), tightBlur: lerp(s.tightDayBlur, s.tightNightBlur, w), tightSpread: lerp(s.tightDaySpread, s.tightNightSpread, w),
    halo: s.halo, haloPadX: s.haloPadX, haloPadY: s.haloPadY, haloRgb: mix(s.haloDay, s.haloNight, w), haloA: s.halo ? lerp(s.haloDayA, s.haloNightA, w) : 0,
  };
}
/** Ink block of a name at the 24 pt type (§3: four characters ≈ 107×31); > 9 chars shrink to keep 32 pt edges, min 20 pt. */
export function regionTitleInk(text: string, screenW: number): { w: number; h: number; font: number } {
  const n = Math.max(1, Array.from(text || '').length), T = REGION_TITLE_TYPE;
  const at = (f: number) => n * f + (n - 1) * f * T.track;
  let f: number = T.font; while (f > T.minFont && at(f) > screenW - 2 * T.minEdge) f -= 1;
  return { w: at(f), h: Math.round(T.inkH * f / T.font), font: f };
}
/** P3 (界面验收部 cand-stage5: L9 title over the board by 1.6 px at 390): the title's DRAWN extent, not just the ink box, must
 *  keep REGION_TITLE_CLEAR pt from the info plate above and the tray (board frame) below. Drawn extent from the centre:
 *  glyph half + tight-shade spread + half the soft-shadow blur (+ the shadow drop below), and below also the 44×1 line.
 *  Measured on the active style table (day and night worst case; default B). */
export const REGION_TITLE_CLEAR = 2;
export function regionTitleExtent(font: number, table: RegionTitleStyleTable = regionTitleTable()): { up: number; down: number } {
  const T = REGION_TITLE_TYPE, half = (T.inkH * font / T.font) / 2, s = table;
  const spread = Math.max(s.tightDaySpread, s.tightNightSpread), blur = Math.max(s.shadowDayBlur, s.glowNightA > 0 ? s.glowNightBlur : 0) / 2;
  return { up: half + spread + blur, down: Math.max(half + spread + blur + s.shadowDayDy, half + T.lineGap - 3 + T.lineH) };
}
/** Font + centre y (top-down pt) inside the plate→tray band: the largest font (≤ the width rule) whose drawn extent + 2×clear fits;
 *  y balances the two clearances. fits=false only if even minFont cannot (then centred, best effort). */
export function regionTitleFit(text: string, screenW: number, bandTop: number, bandBottom: number, clear = REGION_TITLE_CLEAR): { font: number; y: number; up: number; down: number; fits: boolean } {
  let f = regionTitleInk(text, screenW).font, e = regionTitleExtent(f); const band = bandBottom - bandTop;
  while (f > REGION_TITLE_TYPE.minFont && e.up + e.down + 2 * clear > band) { f -= 1; e = regionTitleExtent(f); }
  return { font: f, y: (bandTop + e.up + bandBottom - e.down) / 2, up: e.up, down: e.down, fits: e.up + e.down + 2 * clear <= band + 1e-9 };
}
/** §2/§6 region of a board: mainline 5–8 meadow, 9–12 skycity, 13–16 lakeside; 风铃湖畔 challenges r04/r05-lake-* lakeside.
 *  Island (tide, L1–4) is the start, not an arrival → null. */
export function regionForStage(stageId: unknown): RegionTitleId | null {
  const id = String(stageId ?? ''); const m = /^mainline-(\d+)$/.exec(id);
  if (m) { const n = Number(m[1]); return n >= 5 && n <= 8 ? 'meadow' : n >= 9 && n <= 12 ? 'skycity' : n >= 13 && n <= 16 ? 'lakeside' : null; }
  if (/^r0[45]-lake-\d+$/.test(id)) return 'lakeside';
  return null;
}
/** §6 once per region. UI flag in localStorage like the other qfl.ui.* flags (not the journey save; see UiPrefs). */
export const SEEN_REGION_TITLE_KEY = 'qfl.ui.seenRegionTitle';
export interface KeyStore { getItem(k: string): string | null; setItem(k: string, v: string): void }
export function seenRegionTitles(store: KeyStore | null | undefined): Partial<Record<RegionTitleId, 1>> {
  try { const v = JSON.parse(store?.getItem(SEEN_REGION_TITLE_KEY) || '{}'); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; } catch { return {}; }
}
export function markRegionTitleSeen(store: KeyStore | null | undefined, id: RegionTitleId) {
  const v = seenRegionTitles(store); if (v[id]) return; v[id] = 1; try { store?.setItem(SEEN_REGION_TITLE_KEY, JSON.stringify(v)); } catch { }
}
/** §6: show when the board belongs to a region not seen yet; never on read-only boards, tutorial demos or the ending. */
export function regionTitleFor(s: any, store: KeyStore | null | undefined): RegionTitleId | null {
  if (!s?.active || s.readOnly || s.hidden) return null;
  if (s.provider === 'tutorial' || s.provider === 'ending' || s.active.tutorial || s.active.demo) return null;
  const id = regionForStage(s.active.stageId); if (!id) return null;
  return seenRegionTitles(store)[id] ? null : id;
}
/** §7 queue: tips (say / item hints) that arrive while the title shows wait and come out afterwards in their original order, one
 *  per toast; an item tip whose tool was cancelled meanwhile is dropped (valid() false). */
export interface QueuedTip { text: string; fade: number; valid?: () => boolean }
export class RegionTitleGate {
  private until = -1; private q: QueuedTip[] = [];
  begin(now: number) { this.until = now + REGION_TITLE_TOTAL_S; }
  active(now: number) { return this.until >= 0 && now < this.until; }
  /** true once the title has ended (and only once) */
  ended(now: number) { if (this.until >= 0 && now >= this.until) { this.until = -1; return true; } return false; }
  hold(t: QueuedTip) { this.q.push(t); if (this.q.length > 4) this.q.shift(); }
  next(): QueuedTip | null { while (this.q.length) { const t = this.q.shift()!; if (!t.valid || t.valid()) return t; } return null; }
  pending() { return this.q.length; }
  clear() { this.q.length = 0; this.until = -1; }
}
