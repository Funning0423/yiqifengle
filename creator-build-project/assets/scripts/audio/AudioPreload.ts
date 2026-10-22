// AudioPreload.ts — b16 meadow long-frame fix (GGbot): load ride/region audio while a board is on screen, so nothing calls
// assetManager.loadBundle / bundle.load on a cue mid-ride. Consumers (SailAudio, BedLayerAudio) adopt clips from this cache
// synchronously. A/B switch: globalThis.__qfAudioPreloadOff = true (or ?qfPreload=0, see QfDebugSwitches) disables it, so
// the old lazy path runs (SailAudio logs 'sail-audio-lazy-fallback').
import { AudioClip, assetManager } from 'cc';

const cache: { [key: string]: AudioClip } = {};
const pending: { [key: string]: Promise<void> } = {};
const key = (bundle: string, path: string) => bundle + '|' + path;

export function audioPreloadDisabled(): boolean { return (globalThis as any).__qfAudioPreloadOff === true; }
/** Synchronous: the preloaded clip, or null. Never loads. */
export function preloadedClip(bundle: string, path: string): AudioClip | null { return cache[key(bundle, path)] || null; }

/** Preload clips of one bundle into the cache (addRef'd once, held for the session). Callback-chained (no microtask hop
 *  between the bundle and its clips). Never rejects. */
export function preloadAudio(bundle: string, paths: readonly string[]): Promise<void> {
  if (audioPreloadDisabled()) return Promise.resolve();
  const todo = paths.filter(p => !cache[key(bundle, p)] && !pending[key(bundle, p)]);
  if (!todo.length) return Promise.all(paths.map(p => pending[key(bundle, p)])).then(() => {});
  let release: () => void = () => {};
  const all = new Promise<void>(ok => { release = ok; });
  let left = todo.length;
  const done = () => { if (--left <= 0) release(); };
  const pull = (b: any) => { for (let i = 0; i < todo.length; i++) { const p = todo[i], k = key(bundle, p);
    b.load(p, AudioClip, (err: any, clip: AudioClip) => { if (!err && clip) { clip.addRef(); cache[k] = clip; } else { try { console.warn('[QF_AUDIO_PRELOAD] ' + k + ' failed: ' + String(err)); } catch { /* log */ } } delete pending[k]; done(); }); } };
  for (let i = 0; i < todo.length; i++) pending[key(bundle, todo[i])] = all as any;
  const have = assetManager.getBundle(bundle);
  if (have) pull(have);
  else assetManager.loadBundle(bundle, (e: any, b: any) => { if (e || !b) { try { console.warn('[QF_AUDIO_PRELOAD] bundle ' + bundle + ' failed: ' + String(e)); } catch { /* log */ } for (let i = 0; i < todo.length; i++) delete pending[key(bundle, todo[i])]; release(); return; } pull(b); });
  return all;
}
type Preloader = () => Promise<void>;
const preloaders: Preloader[] = [];
/** Audio components register what they need; the board-phase hook runs them all. */
export function registerAudioPreloader(fn: Preloader): void { preloaders.push(fn); }
/** Board phase (mainline-04 → sail to meadow, and any later board): warm all registered audio. Never rejects. */
export function preloadRideAudio(): Promise<void> {
  if (audioPreloadDisabled()) return Promise.resolve();
  return Promise.all(preloaders.map(f => { try { return f().catch(() => {}); } catch { return Promise.resolve(); } })).then(() => {});
}
/** tests only */
export function resetAudioPreloadForTest(): void { for (const k of Object.keys(cache)) delete cache[k]; for (const k of Object.keys(pending)) delete pending[k]; preloaders.length = 0; }
