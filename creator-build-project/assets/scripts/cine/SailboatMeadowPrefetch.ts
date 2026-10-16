/**
 * Starts the meadow bundle + prefab load before the sailboat, so the cloud cover never has to hold for it
 * (r2: a 4.2 s grey hold, total ~7 s; r3 after the gate: ~1.0 s day / ~0.5 s night hold).
 *
 * Early trigger: the win result screen or the chest reward opens, but ONLY when that win's next step is the
 * sailboat trip, i.e. the session's nextStageId is a meadow stage (requiresMeadowScene, the same test
 * playRegionArrival uses to start the sail). Any other win logs a skip and loads nothing.
 * Deferred a few hundred ms so the panel's open tween owns those frames. The exit-camera / sail-time callers
 * still use prefetchSailboatMeadow(); everything shares one promise, so there is never a second load.
 *
 * Ownership: the finished prefab gets ONE addRef held by this module. releaseSailboatMeadow() drops it exactly
 * once (decRef, auto-release), so the prefab and its dependencies leave memory unless someone else (the live
 * meadow board background holds its own refs) still uses them. Release points:
 *  - the live meadow is unloaded (last board-background lease disposed) and no sail is armed;
 *  - the flow enters a non-meadow stage, or the camera settles at home (sail abandoned / next flow not meadow).
 * A failure clears the promise so the next trigger (or the driver's in-cloud hold) retries. No @ccclass.
 */
import type { Prefab } from 'cc';
import { REGIONS, loadRegionPrefab } from '../region/RegionLoader';
import { requiresMeadowScene } from '../world-r2/LevelRegion';

/** Delay after the result / chest panel opens before the load starts (panel open tween is ~0.25 s). */
export const MEADOW_PRELOAD_DEFER_MS = 400;
/** After a failed early load, one more early attempt this much later; the sail-time path retries regardless. */
export const MEADOW_PRELOAD_RETRY_MS = 3000;

type Held = Prefab & { addRef?(): unknown; decRef?(autoRelease?: boolean): unknown; isValid?: boolean };

let pending: Promise<Prefab> | null = null;
let loaded: Held | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let earlyRetried = false;
/** Bumped by every release; a load that finishes after a release does not take a ref. */
let generation = 0;
/** An early (result / chest) preload is waiting for its sail; a meadow unload in between must not drop it. */
let armed = false;
/** Live meadow board backgrounds currently mounted. */
let liveLeases = 0;

function nowMs(): number {
  const p = (globalThis as { performance?: { now(): number } }).performance;
  return Math.round(p && typeof p.now === 'function' ? p.now() : Date.now());
}

/** The meadow stage this win leads to by sailboat, else null. `s` is the board session snapshot. */
export function meadowSailNextStage(s: { state?: string; result?: { completionRecorded?: boolean } | null; nextStageId?: string | null; active?: { status?: string } | null } | null | undefined): string | null {
  if (!s || s.active?.status !== 'won' || s.state !== 'result.saved' || !s.result?.completionRecorded) return null;
  const next = s.nextStageId;
  return next && requiresMeadowScene({ stageId: next }) ? next : null;
}

export function prefetchSailboatMeadow(reason = 'late'): Promise<Prefab> {
  if (pending) return pending;
  const t0 = nowMs(), gen = generation;
  console.log(`[meadow-preload] start ${reason} t ${t0}`);
  const run: Promise<Prefab> = loadRegionPrefab(REGIONS.meadow).then(prefab => {
    const t1 = nowMs();
    if (gen !== generation) { console.log(`[meadow-preload] late-after-release ${reason} t ${t1}`); return prefab; }
    const p = prefab as Held;
    if (loaded !== p) { p.addRef?.(); loaded = p; }
    console.log(`[meadow-preload] ready ${reason} t ${t1} took ${t1 - t0}`);
    return prefab;
  }, (error: unknown) => {
    if (pending === run) pending = null;
    console.warn(`[meadow-preload] fail ${reason} t ${nowMs()} ${String(error)}`);
    throw error;
  });
  pending = run;
  void run.catch(() => {});
  return run;
}

/** Early, off-critical-path trigger (result / chest) for a meadow-bound win. Idempotent: no-op once a load is
 *  pending or done, and repeated calls while the deferral is waiting do not stack timers. */
export function scheduleSailboatMeadowPreload(reason: string, deferMs = MEADOW_PRELOAD_DEFER_MS): void {
  armed = true;
  if (pending || timer) return;
  timer = setTimeout(() => {
    timer = null;
    if (pending) return;
    prefetchSailboatMeadow(reason).catch(() => {
      if (earlyRetried || !armed) return;
      earlyRetried = true;
      scheduleSailboatMeadowPreload(reason + '-retry', MEADOW_PRELOAD_RETRY_MS);
    });
  }, deferMs);
}

/** Board hook: preload only when this win sails to the meadow; otherwise log the skip and load nothing. */
export function maybeScheduleSailboatMeadowPreload(reason: string, s: Parameters<typeof meadowSailNextStage>[0]): boolean {
  const next = meadowSailNextStage(s);
  if (!next) { console.log(`[meadow-preload] skip ${reason} next ${s?.nextStageId || 'none'}`); return false; }
  scheduleSailboatMeadowPreload(reason);
  return true;
}

/** Drop a deferral that has not started yet (board torn down before it fired). A started load is kept: the
 *  board is torn down by the very exit that leads into the sail; release happens at the points listed above. */
export function cancelScheduledSailboatMeadowPreload(): void {
  if (timer) { clearTimeout(timer); timer = null; }
}

/** The prefab when the early load already finished, else null. */
export function prefetchedSailboatMeadow(): Prefab | null {
  return loaded && loaded.isValid !== false ? loaded : null;
}

/** The sail has mounted (or given up on) the meadow: the next meadow unload may release. */
export function consumeSailboatMeadow(): void { armed = false; }

/** Drop this module's ref (once). Safe to call any number of times. Returns true if a ref was dropped. */
export function releaseSailboatMeadow(reason: string): boolean {
  cancelScheduledSailboatMeadowPreload();
  generation++; pending = null; armed = false; earlyRetried = false;
  const held = loaded; loaded = null;
  if (!held) return false;
  try { held.decRef?.(true); } catch (error) { console.warn('[meadow-preload] release failed', String(error)); }
  console.log(`[meadow-preload] release ${reason} t ${nowMs()} leases ${liveLeases}`);
  return true;
}

/** Live meadow board background mounted (+1) / disposed (-1). The last dispose releases unless a sail is armed. */
export function noteMeadowLease(delta: 1 | -1): void {
  liveLeases = Math.max(0, liveLeases + delta);
  if (delta < 0 && liveLeases === 0 && !armed) releaseSailboatMeadow('meadow-unload');
}
