import { sys } from 'cc';
/** UI-only flags in localStorage (never in the journey save; INTEGRATION §7). */
export const SEEN_TOOLS_KEY = 'qfl.ui.seenTools';
export const SEEN_UNLOCKS_KEY = 'qfl.ui.seenUnlocks';
export const CABIN_HINT_KEY = 'qfl.ui.cabinHintSeen';
export const REDUCED_MOTION_KEY = 'forest-v33-reduced-motion';
function get(key: string): string | null { try { return sys.localStorage.getItem(key); } catch (e) { return null; } }
function set(key: string, value: string) { try { sys.localStorage.setItem(key, value); } catch (e) { console.warn('[UI_PREFS] write failed', key, String(e)); } }
export function seenTools(): string[] {
  try { const v = JSON.parse(get(SEEN_TOOLS_KEY) || '[]'); return Array.isArray(v) ? v.filter(x => typeof x === 'string') : []; } catch (e) { return []; }
}
export function hasSeenTool(kind: string): boolean { return seenTools().indexOf(kind) >= 0; }
export function markToolSeen(kind: string) {
  const list = seenTools(); if (list.indexOf(kind) >= 0) return; list.push(kind); set(SEEN_TOOLS_KEY, JSON.stringify(list));
}
/** Red-dot A: ids the player has already opened (book, chapter ids). Not part of the journey save. */
export function seenUnlocks(): string[] {
  try { const v = JSON.parse(get(SEEN_UNLOCKS_KEY) || '[]'); return Array.isArray(v) ? v.filter(x => typeof x === 'string') : []; } catch (e) { return []; }
}
export function hasSeenUnlock(id: string): boolean { return seenUnlocks().indexOf(id) >= 0; }
export function markUnlockSeen(id: string) {
  const list = seenUnlocks(); if (list.indexOf(id) >= 0) return; list.push(id); set(SEEN_UNLOCKS_KEY, JSON.stringify(list));
}
/** new-regions SPEC §6: red dots (regions entered once) and the journey total the bar last grew to. */
export const SEEN_REGIONS_KEY = 'qfl.ui.seenRegions', JOURNEY_SEEN_DONE_KEY = 'qfl.ui.journeySeenDone';
export function seenRegions(): string[] {
  try { const v = JSON.parse(get(SEEN_REGIONS_KEY) || '[]'); return Array.isArray(v) ? v.filter(x => typeof x === 'string') : []; } catch (e) { return []; }
}
export function markRegionSeen(id: string) { const list = seenRegions(); if (list.indexOf(id) >= 0) return; list.push(id); set(SEEN_REGIONS_KEY, JSON.stringify(list)); }
/** null = never opened (first open shows the bar at once: nothing to compare against). */
export function journeySeenDone(): number | null { const v = get(JOURNEY_SEEN_DONE_KEY); const n = v == null ? NaN : Number(v); return Number.isFinite(n) ? n : null; }
export function setJourneySeenDone(n: number) { set(JOURNEY_SEEN_DONE_KEY, String(n)); }
/** Focus rule (SPEC §2): the region the player last entered from the journey book. */
export const LAST_REGION_KEY = 'qfl.ui.lastRegion';
export function lastRegion(): any { return get(LAST_REGION_KEY) || null; }
export function setLastRegion(id: string) { set(LAST_REGION_KEY, id); }
export function cabinHintSeen(): boolean { return get(CABIN_HINT_KEY) === '1'; }
export function markCabinHintSeen() { set(CABIN_HINT_KEY, '1'); }
export function reducedMotion(): boolean {
  const v = get(REDUCED_MOTION_KEY); if (v === 'true' || v === '1') return true; if (v === 'false' || v === '0') return false;
  try { return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
}
export function setReducedMotion(on: boolean) { set(REDUCED_MOTION_KEY, on ? 'true' : 'false'); }
/** Vibration switch (system-panels SPEC §2.3): '1'/'0', default on. Every vibration in the game goes through vibrate(). */
export const VIBRATE_KEY = 'qfl.ui.vibrate';
export function vibrateEnabled(): boolean { return get(VIBRATE_KEY) !== '0'; }
export function setVibrateEnabled(on: boolean) { set(VIBRATE_KEY, on ? '1' : '0'); }
export function vibrate(type: 'light' | 'medium' | 'heavy' = 'light'): boolean {
  if (!vibrateEnabled()) return false;
  try { const w = (globalThis as any).wx; if (!w || typeof w.vibrateShort !== 'function') return false; w.vibrateShort({ type }); return true; } catch (e) { return false; }
}
/** Music on/off without setMuted (which would also stop SFX): off = volume 0, previous volume kept in qfl.audio.musicLast. */
export const MUSIC_LAST_KEY = 'qfl.audio.musicLast';
export interface MusicVolume { getMusicVolume(): number; setMusicVolume(v: number): void }
export function musicOn(a: MusicVolume | null | undefined): boolean { return (a?.getMusicVolume() ?? 0.4) > 0; }
export function setMusicOn(a: MusicVolume | null | undefined, on: boolean) {
  if (!a) return;
  if (!on) { const v = a.getMusicVolume(); if (v > 0) set(MUSIC_LAST_KEY, String(v)); a.setMusicVolume(0); return; }
  const last = Number(get(MUSIC_LAST_KEY)); a.setMusicVolume(Number.isFinite(last) && last > 0 ? Math.min(1, last) : 0.4);
}
