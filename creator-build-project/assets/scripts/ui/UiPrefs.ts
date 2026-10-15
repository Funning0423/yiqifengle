import { sys } from 'cc';
/** UI-only flags in localStorage (never in the journey save; INTEGRATION §7). */
export const SEEN_TOOLS_KEY = 'qfl.ui.seenTools';
export const SEEN_GUIDES_KEY = 'qfl.ui.seenGuides';
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
export function seenGuides(): string[] {
  try { const v = JSON.parse(get(SEEN_GUIDES_KEY) || '[]'); return Array.isArray(v) ? v.filter(x => typeof x === 'string') : []; } catch (e) { return []; }
}
export function hasSeenGuide(id: string): boolean { return !!id && seenGuides().indexOf(id) >= 0; }
export function markGuideSeen(id: string) {
  if (!id) return; const list = seenGuides(); if (list.indexOf(id) >= 0) return; list.push(id); set(SEEN_GUIDES_KEY, JSON.stringify(list));
}
export function cabinHintSeen(): boolean { return get(CABIN_HINT_KEY) === '1'; }
export function markCabinHintSeen() { set(CABIN_HINT_KEY, '1'); }
export function reducedMotion(): boolean {
  const v = get(REDUCED_MOTION_KEY); if (v === 'true' || v === '1') return true; if (v === 'false' || v === '0') return false;
  try { return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
}
export function setReducedMotion(on: boolean) { set(REDUCED_MOTION_KEY, on ? 'true' : 'false'); }
