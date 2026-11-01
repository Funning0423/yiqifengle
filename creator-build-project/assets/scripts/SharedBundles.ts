import { assetManager, director, Director, game, screen } from 'cc';
import { debugSearch } from './region/DebugQuery';
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

/** perf-r1 #4 (iPhone 16 Pro ~30 fps + heat, b3394140: no frameRate cap, no shadingScale, full DPR 3 shading).
 *  - frame cap: game.frameRate = 60 (the target stays 60; never 30).
 *  - effective render resolution: 3D cameras on the main window shade at ≤ RENDER_BUDGET.maxDpr device pixels per CSS px through the
 *    builtin custom pipeline's per-camera shadingScale (ScaledRadiance + one upscale blit); UI_2D-only cameras and render-to-texture
 *    cameras keep full resolution, so text/UI stay crisp. Same art, materials, lighting and shadows.
 *  - kill switch for A/B screenshots: launch query fullres=1 (dev/trial only, via debugSearch sources) keeps DPR 3.
 *  Cameras are scanned on scene launch and at most once per RENDER_BUDGET.scanFrames frames (cameraList is short; no host API). */
export const RENDER_BUDGET = { frameRate: 60, maxDpr: 2, scanFrames: 30 } as const;
const LAYER_DEFAULT = 1 << 30;
/** Pure: shadingScale for a device pixel ratio (1 = untouched). */
export function budgetShadingScale(dpr: number, maxDpr: number = RENDER_BUDGET.maxDpr): number {
  if (!(dpr > maxDpr) || !(maxDpr > 0)) return 1; return Math.round((maxDpr / dpr) * 1000) / 1000;
}
/** Pure: complete builtin-pipeline settings (mirrors makePipelineSettings in Cocos 3.8.8 internal pipeline-settings: the pipeline reads
 *  settings.bloom/fxaa/fsr/colorGrading/toneMapping/msaa directly, so a partial object would throw). Every effect stays OFF. */
export function budgetPipelineSettings(scale: number): any {
  return { msaa: { enabled: false, sampleCount: 4 }, enableShadingScale: true, shadingScale: scale,
    bloom: { enabled: false, type: 0, material: null, kawaseFilterMaterial: null, mipmapFilterMaterial: null, enableAlphaMask: false, iterations: 3, threshold: 0.8, intensity: 1 },
    toneMapping: { material: null }, colorGrading: { enabled: false, material: null, contribute: 1, colorGradingMap: null },
    fsr: { enabled: false, material: null, sharpness: 0.8 }, fxaa: { enabled: false, material: null }, __qfBudget: scale };
}
/** Pure: does this renderer camera get the budget? Main window (no RT target) and the DEFAULT layer (3D). */
export function budgetCamera(cam: { visibility?: number; window?: any } | null | undefined, mainWindow: any): boolean {
  if (!cam || cam.window !== mainWindow) return false; const v = cam.visibility ?? 0;
  return (v & LAYER_DEFAULT) !== 0; // builtin pipeline: DEFAULT layer = full 3D pipeline
}
export function applyRenderBudgetToCameras(root: any, scale: number): number {
  if (!root || scale >= 1) return 0; let n = 0; const list: any[] = root.cameraList || [];
  for (let i = 0; i < list.length; i++) { const c = list[i]; if (!budgetCamera(c, root.mainWindow)) continue; const ps = c.pipelineSettings;
    if (ps && ps.__qfBudget === scale) continue;
    if (ps && !ps.__qfBudget) continue; // a camera that already owns pipelineSettings keeps them
    c.pipelineSettings = budgetPipelineSettings(scale); n++; }
  return n;
}
export function fullResRequested(search: string): boolean { return /(?:^\?|&)fullres=1(?:&|$)/.test(search || ''); }
export function installRenderBudget(): void {
  const g = globalThis as any; if (g.__qfRenderBudget) return; g.__qfRenderBudget = true;
  try { game.frameRate = RENDER_BUDGET.frameRate; } catch { }
  let scale = 1; try { scale = fullResRequested(debugSearch()) ? 1 : budgetShadingScale(screen.devicePixelRatio || 1); } catch { }
  g.__qfRenderBudgetScale = scale; if (scale >= 1) return;
  let frame = 0; const scan = () => { try { applyRenderBudgetToCameras((director as any).root, scale); } catch { } };
  try { director.on(Director.EVENT_AFTER_SCENE_LAUNCH, scan);
    director.on(Director.EVENT_BEFORE_UPDATE, () => { if (++frame % RENDER_BUDGET.scanFrames === 1) scan(); }); } catch { }
}
installRenderBudget();
