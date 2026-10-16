import { assetManager } from 'cc';
/** One shared copy of builtin-standard (≈1.0 MiB EffectAsset) instead of one per bundle.
 * shared_effects (priority 6, WeChat subpackage) holds a material that references the effect, so Creator packs the effect there
 * and the priority-1 bundles reference it instead of copying it. Cocos 3.8 does not load bundle deps on its own, so every
 * loadBundle of a dependent bundle first loads shared_effects. Installed once at import; idempotent. */
export const SHARED_BUNDLE = 'shared_effects';
export const SHARED_DEPENDENTS: readonly string[] = ['region_island', 'region_meadow', 'region_skycity', 'static_seat_preview', 'board_art'];
export function installSharedBundleDeps(am: any = assetManager): void {
  if (!am || typeof am.loadBundle !== 'function' || am.__qfSharedDeps) return;
  const orig = am.loadBundle.bind(am); am.__qfSharedDeps = true;
  am.loadBundle = function (name: string, a?: any, b?: any) {
    const cb = typeof a === 'function' ? a : b, opts = typeof a === 'function' ? undefined : a;
    const go = () => (opts === undefined ? orig(name, cb) : orig(name, opts, cb));
    if (name === SHARED_BUNDLE || !SHARED_DEPENDENTS.includes(name) || am.getBundle(SHARED_BUNDLE)) return go();
    orig(SHARED_BUNDLE, (e: any) => { if (e) { if (typeof cb === 'function') cb(e, null); return; } go(); });
  };
}
installSharedBundleDeps();
