/**
 * Starts the meadow bundle + prefab load while the exit camera is still flying, so the
 * sailboat cloud cover never has to hold for it (r2: a 4.2 s grey hold, total ~7 s).
 * One shared promise; a failure clears it so the driver can retry. No @ccclass.
 */
import type { Prefab } from 'cc';
import { REGIONS, loadRegionPrefab } from '../region/RegionLoader';

let pending: Promise<Prefab> | null = null;
let loaded: Prefab | null = null;

export function prefetchSailboatMeadow(): Promise<Prefab> {
  if (pending) return pending;
  const run: Promise<Prefab> = loadRegionPrefab(REGIONS.meadow).then(prefab => { loaded = prefab; return prefab; }, (error: unknown) => {
    if (pending === run) pending = null;
    throw error;
  });
  pending = run;
  run.catch(() => { /* the awaiting caller sees it */ });
  return run;
}

/** The prefab when the early load already finished, else null. */
export function prefetchedSailboatMeadow(): Prefab | null {
  return loaded && (loaded as Prefab & { isValid?: boolean }).isValid !== false ? loaded : null;
}
