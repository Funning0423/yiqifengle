import { approachNight } from '../world-r2/IslandPropsLayout';
/** Night look for 2D UI (INTEGRATION §4): sprites are multiplied, text is recoloured (never multiplied).
 *  K_UI = ISLAND_PROPS.tag.nightFill / fill, K_SEA = ISLAND_PROPS.seaNight.tint, K_HALF = 1 - (1 - K_UI) / 2 (chest, stars, rays).
 *  The weight follows the world day/night mode with the same 0.5 s linear approach as propNightWeight(). */
export type TintKind = 'ui' | 'sea' | 'half' | 'none';
export type TextRole = 'brown' | 'brown2' | 'teal' | 'white' | 'grey' | 'gold';
export const K_UI: readonly number[] = [0.621, 0.591, 0.562];
export const K_SEA: readonly number[] = [0.498, 0.624, 0.702];
export const K_HALF: readonly number[] = [0.811, 0.796, 0.781];
export const TEXT_DAY: Record<TextRole, readonly number[]> = { brown: [99, 63, 33], brown2: [118, 86, 55], teal: [38, 98, 104], white: [251, 248, 236], grey: [150, 140, 124], gold: [150, 104, 40] };
export const TEXT_NIGHT: Record<TextRole, readonly number[]> = { brown: [30, 19, 8], brown2: [34, 23, 11], teal: [6, 30, 34], white: [232, 226, 212], grey: [60, 54, 46], gold: [70, 46, 14] };
const K: Record<TintKind, readonly number[]> = { ui: K_UI, sea: K_SEA, half: K_HALF, none: [1, 1, 1] };
const clamp = (v: number) => Math.max(0, Math.min(1, v));
/** Multiplier for a sprite of `kind` at night weight w. */
export function tintFactor(kind: TintKind, w: number): number[] {
  const k = K[kind] || K.none, t = clamp(w);
  return [0, 1, 2].map(i => 1 + (k[i] - 1) * t);
}
/** 0..255 RGB of a white-based sprite colour (Sprite.color multiplies the texture). */
export function tintRgb(kind: TintKind, w: number, base: readonly number[] = [255, 255, 255]): number[] {
  const f = tintFactor(kind, w); return [0, 1, 2].map(i => Math.round((base[i] ?? 255) * f[i]));
}
export function textRgb(role: TextRole, w: number): number[] {
  const a = TEXT_DAY[role] || TEXT_DAY.brown, b = TEXT_NIGHT[role] || TEXT_NIGHT.brown, t = clamp(w);
  return [0, 1, 2].map(i => Math.round(a[i] + (b[i] - a[i]) * t));
}
/** WCAG relative-luminance contrast ratio of two 0..255 RGB colours. */
export function contrast(a: readonly number[], b: readonly number[]): number {
  const lum = (c: readonly number[]) => { const v = c.slice(0, 3).map(x => { const s = x / 255; return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
  const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
function worldSnap(): { mode?: string; uiBlend?: number } | null {
  try { const s = (globalThis as any).__worldDayNight?.snapshot?.(); return s && typeof s === 'object' ? s : null; } catch (e) { return null; }
}
let weight = -1, lastMs = 0;
/** Shared night weight for every UI layer; safe to call many times per frame.
 *  A published uiBlend (the 0.8 s world cross-fade) wins, so sky, sea and UI stay on one curve. */
export function uiNightWeight(nowMs = Date.now()): number {
  const snap = worldSnap();
  const published = snap && typeof snap.uiBlend === 'number' && Number.isFinite(snap.uiBlend) ? Math.max(0, Math.min(1, snap.uiBlend)) : null;
  if (published !== null) { weight = published; lastMs = nowMs; return weight; }
  const night = snap?.mode === 'night';
  if (weight < 0) { weight = night ? 1 : 0; lastMs = nowMs; return weight; }
  const dt = Math.max(0, (nowMs - lastMs) / 1000); lastMs = nowMs;
  if (dt > 0) weight = approachNight(weight, night, dt);
  return weight;
}
/** Test hook: forget the cached weight. */
export function resetUiNightWeight() { weight = -1; lastMs = 0; }
