import { assetManager } from 'cc';
/** perf-r1 item 3 (memory only grows on device: textures 92→111 MB, buffers 15→51 MB on b3394140).
 *  On a region change, release the PREVIOUS region's bundle assets so GPU textures/buffers go back near baseline.
 *  Only frees memory: no content file is touched, and the bundle is removed from the cache so a later visit reloads
 *  it from the package exactly as on the first visit (assetManager.loadBundle/getBundle in RegionLoader.loadPrefab).
 *  Safety: a region is released only when (a) it is not the target, (b) it is not the warmed next target (preload),
 *  (c) the caller says nothing of it is still mounted (live nodes reference its meshes/materials). Shared bundles
 *  (island seat preview, balloon/sail transit, board art) are never released here.
 *  Hook: one call after ensureRegion() arrives (WorldNativeComposition is frozen — see outbox memory-release.diff.PROPOSED). */
export const REGION_RELEASE_BUNDLES: Readonly<Record<string, readonly string[]>> = {
  meadow: ['region_meadow'], skycity: ['region_skycity'], lakeside: ['region_lakeside'],
};
export interface ReleaseHost { getBundle(name: string): { releaseAll(): void } | null | undefined; removeBundle(b: any): void }
export interface ReleaseOptions { keep: readonly string[]; mounted: (region: string) => boolean; host?: ReleaseHost }
/** Pure plan: which regions' bundles may go now. */
export function planRegionRelease(target: string, opts: { keep?: readonly string[]; mounted: (region: string) => boolean }): string[] {
  const keep = new Set([target, ...(opts.keep || [])]);
  return Object.keys(REGION_RELEASE_BUNDLES).filter(r => !keep.has(r) && !opts.mounted(r));
}
/** Releases the planned regions' bundles. Returns the bundles actually released. Never throws (a failed release only logs). */
export function releaseRegionsExcept(target: string, opts: ReleaseOptions): string[] {
  const host: ReleaseHost = opts.host || (assetManager as any), out: string[] = [];
  let regions: string[] = [];
  try { regions = planRegionRelease(target, opts); } catch { return out; }
  for (const r of regions) for (const name of REGION_RELEASE_BUNDLES[r]) {
    try { const b = host.getBundle(name); if (!b) continue; b.releaseAll(); host.removeBundle(b); out.push(name); }
    catch (e) { console.warn('[QF_REGION_RELEASE]', name, String(e)); }
  }
  if (out.length) console.log('[QF_REGION_RELEASE]', target, out.join(','));
  return out;
}
