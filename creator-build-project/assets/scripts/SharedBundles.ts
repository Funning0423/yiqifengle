import { assetManager } from 'cc';
/** One shared copy of builtin-standard (≈1.0 MiB EffectAsset) instead of one per bundle.
 * shared_effects (priority 6, WeChat subpackage) holds a material that references the effect, so Creator packs the effect there
 * and the priority-1 bundles reference it instead of copying it. Cocos 3.8 does not load bundle deps on its own, so every
 * loadBundle of a dependent bundle first loads shared_effects. Installed once at import; idempotent. */
export const SHARED_BUNDLE = 'shared_effects';
export const SHARED_DEPENDENTS: readonly string[] = ['region_island', 'region_meadow', 'region_skycity', 'region_lakeside', 'region_transit_balloon', 'static_seat_preview', 'board_art'];
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

/** F2 (77b76c3 audit): Creator 3.8.8 serialises AnimationClips as CCON binary. config.extensionMap lists them as '.cconb' but the
 * build writes them as '.bin' (official layout; the mini-game adapter rewrites .cconb→.bin, web downloadCCONB asks for .bin first and
 * only falls back to the never-shipped .cconb URL when the .bin request fails). A transient .bin failure on first launch therefore
 * surfaced as 404s on .cconb. This wraps the '.cconb' downloader so it only ever requests the shipped .bin: the engine's own
 * fallback becomes a second .bin attempt instead of a guaranteed 404, matching WeChat behaviour. Idempotent; no package bytes. */
export function installCconbBinOnly(am: any = assetManager): boolean {
  const d = am && am.downloader, table = d && d._downloaders;
  if (!table || typeof table['.cconb'] !== 'function' || table['.cconb'].__qfBinOnly) return false;
  const orig = table['.cconb'];
  const wrapped: any = function (url: string, options: any, done: any) {
    const bin = typeof url === 'string' ? url.replace(/\.cconb(?=$|[?#])/, '.bin') : url;
    return orig.call(this, bin, options, (err: any, data: any) => {
      if (err && (globalThis as any).__worldFlowLog) console.warn('[QF_CCONB] .bin load failed', bin, err && err.message);
      done(err, data);
    });
  };
  wrapped.__qfBinOnly = true; table['.cconb'] = wrapped; return true;
}
installCconbBinOnly();
