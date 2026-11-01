import { Color, Graphics, UIOpacity, Vec3, assetManager, isValid, tween } from 'cc';
import { artSprite, makeLabel, measure, popupScale, pressable, uiNode } from './PopupKit';
import { tintRgb } from './NightTint';
import { journeySeenDone, lastRegion, markRegionSeen, reducedMotion, seenRegions, setJourneySeenDone } from './UiPrefs';
import { REGION_DEFS, endingSeals, focusRegion, journeyProgress, journeyRows } from './JourneyCore';
import { CHAPTERS, defaultStages, journeyInput } from './IslandPanels';
import { BOARD_ART_BUNDLE } from './BoardArt';
import type { JourneyUi } from '../../bundles/board_art/journey_ui/JourneyPanels';
/** Main-package side of the lazy journey UI (journey book, region page, ending seals). The code itself is in
 *  bundles/board_art/journey_ui (built into the board_art subpackage's own script, not the main package). It has no
 *  runtime imports: this host hands it the cc classes and main-package helpers. Loading board_art runs the bundle script,
 *  which sets globalThis.__qfJourneyUi; the island overlay warms it at construction (same loadBundle as the panel art). */
export function journeyUiHost() {
  return { cc: { Color, Graphics, UIOpacity, Vec3, isValid, tween }, artSprite, makeLabel, measure, popupScale, pressable, uiNode, tintRgb,
    journeySeenDone, lastRegion, markRegionSeen, reducedMotion, seenRegions, setJourneySeenDone,
    REGION_DEFS, CHAPTERS, journeyRows, journeyProgress, focusRegion, journeyInput, endingSeals, defaultStages };
}
export type JourneyUiHost = ReturnType<typeof journeyUiHost>;
export const JOURNEY_UI_VERSION = 1;
let ui: JourneyUi | null = null, pending: Promise<JourneyUi | null> | null = null, t0 = 0, readyMs = -1;
const waiters: Array<(u: JourneyUi | null) => void> = [];
const now = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());
/** The UI if its script has run (sync). */
export function journeyUi(): JourneyUi | null {
  if (ui) return ui; const reg = (globalThis as any).__qfJourneyUi;
  if (reg && reg.version === JOURNEY_UI_VERSION && typeof reg.create === 'function') { ui = reg.create(journeyUiHost()); if (readyMs < 0) readyMs = t0 ? now() - t0 : 0; }
  return ui;
}
/** Start loading board_art (idempotent; engine caches the bundle). Resolves with the UI, or null if the bundle failed. */
export function warmJourneyUi(): Promise<JourneyUi | null> {
  if (journeyUi()) return Promise.resolve(ui); if (pending) return pending; t0 = now();
  pending = new Promise<JourneyUi | null>(done => {
    const finish = (e?: any) => { const u = journeyUi(); if (u) console.log('[QF_JOURNEY_UI] ready +' + Math.round(readyMs) + 'ms'); else { console.warn('[QF_JOURNEY_UI] unavailable', String(e || 'no registration')); pending = null; }
      done(u); waiters.splice(0).forEach(w => w(u)); };
    try { const have = assetManager.getBundle(BOARD_ART_BUNDLE); if (have) finish(); else assetManager.loadBundle(BOARD_ART_BUNDLE, (e: any) => finish(e)); } catch (e) { finish(e); }
  });
  return pending;
}
/** Run `fn` now if the UI is ready ('sync'), else as soon as it is ('deferred'; logs the wait). */
export function withJourneyUi(fn: (u: JourneyUi) => void, what: string): 'sync' | 'deferred' {
  const u = journeyUi(); if (u) { fn(u); return 'sync'; }
  const t = now(); void warmJourneyUi().then(v => { if (v) { console.warn('[QF_JOURNEY_UI] ' + what + ' deferred ' + Math.round(now() - t) + 'ms'); fn(v); } });
  return 'deferred';
}
export function journeyUiStats() { return { ready: !!ui, readyMs }; }
