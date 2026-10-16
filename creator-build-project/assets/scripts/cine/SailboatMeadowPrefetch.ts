/**
 * Starts the meadow bundle + prefab load before the sailboat, so the cloud cover never has to hold for it
 * (r2: a 4.2 s grey hold, total ~7 s; r3 after the gate: ~1.0 s day / ~0.5 s night hold).
 * Early trigger: the level result screen or the chest reward opens (scheduleSailboatMeadowPreload), deferred a few
 * hundred ms so the panel's open tween owns those frames. The exit-camera / sail-time callers still use
 * prefetchSailboatMeadow(); everything shares one promise, so there is never a second load.
 * A failure clears the promise so the next trigger (or the driver's in-cloud hold) retries. No @ccclass.
 */
import type { Prefab } from 'cc';
import { REGIONS, loadRegionPrefab } from '../region/RegionLoader';

/** Delay after the result / chest panel opens before the load starts (panel open tween is ~0.25 s). */
export const MEADOW_PRELOAD_DEFER_MS = 400;
/** After a failed early load, one more early attempt this much later; the sail-time path retries regardless. */
export const MEADOW_PRELOAD_RETRY_MS = 3000;

let pending: Promise<Prefab> | null = null;
let loaded: Prefab | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let earlyRetried = false;

function nowMs(): number {
  const p = (globalThis as { performance?: { now(): number } }).performance;
  return Math.round(p && typeof p.now === 'function' ? p.now() : Date.now());
}

export function prefetchSailboatMeadow(reason = 'late'): Promise<Prefab> {
  if (pending) return pending;
  const t0 = nowMs();
  console.log(`[meadow-preload] start ${reason} t ${t0}`);
  const run: Promise<Prefab> = loadRegionPrefab(REGIONS.meadow).then(prefab => {
    loaded = prefab;
    const t1 = nowMs();
    console.log(`[meadow-preload] ready ${reason} t ${t1} took ${t1 - t0}`);
    return prefab;
  }, (error: unknown) => {
    if (pending === run) pending = null;
    console.warn(`[meadow-preload] fail ${reason} t ${nowMs()} ${String(error)}`);
    throw error;
  });
  pending = run;
  run.catch(() => { /* the awaiting caller sees it */ });
  return run;
}

/** Early, off-critical-path trigger (result screen / chest). Idempotent: no-op once a load is pending or done,
 *  and repeated calls while the deferral is waiting do not stack timers. */
export function scheduleSailboatMeadowPreload(reason: string, deferMs = MEADOW_PRELOAD_DEFER_MS): void {
  if (pending || timer) return;
  timer = setTimeout(() => {
    timer = null;
    if (pending) return;
    prefetchSailboatMeadow(reason).catch(() => {
      if (earlyRetried) return;
      earlyRetried = true;
      scheduleSailboatMeadowPreload(reason + '-retry', MEADOW_PRELOAD_RETRY_MS);
    });
  }, deferMs);
}

/** Drop a deferral that has not started yet (board torn down before it fired). A started load is kept: the
 *  prefab stays in the meadow bundle's cache for the sail, which is the next place the player can go. */
export function cancelScheduledSailboatMeadowPreload(): void {
  if (timer) { clearTimeout(timer); timer = null; }
}

/** The prefab when the early load already finished, else null. */
export function prefetchedSailboatMeadow(): Prefab | null {
  return loaded && (loaded as Prefab & { isValid?: boolean }).isValid !== false ? loaded : null;
}
