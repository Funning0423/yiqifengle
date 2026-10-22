// AudioPreload.ts — b16 meadow long-frame fix (GGbot): load ride/region audio while a board is on screen, so nothing calls
// assetManager.loadBundle / bundle.load on a cue mid-ride. Consumers (SailAudio, BedLayerAudio) adopt clips from this cache
// synchronously. A/B switch: globalThis.__qfAudioPreloadOff = true (or ?qfPreload=0, see QfDebugSwitches) disables it, so
// the old lazy path runs (SailAudio logs 'sail-audio-lazy-fallback').
import { AudioClip, assetManager } from 'cc';

const cache: { [key: string]: AudioClip } = {};
const pending: { [key: string]: Promise<AudioClip | null> } = {};
const key = (bundle: string, path: string) => bundle + '|' + path;

export function audioPreloadDisabled(): boolean { return (globalThis as any).__qfAudioPreloadOff === true; }
/** Synchronous: the preloaded clip, or null. Never loads. */
export function preloadedClip(bundle: string, path: string): AudioClip | null { return cache[key(bundle, path)] || null; }

function loadBundle(name: string): Promise<any> {
  const have = assetManager.getBundle(name); if (have) return Promise.resolve(have);
  return new Promise((ok, bad) => assetManager.loadBundle(name, (e: any, b: any) => (e || !b ? bad(e || Error('no bundle ' + name)) : ok(b))));
}
/** Preload clips of one bundle into the cache (addRef'd once, held for the session). Never rejects. */
export function preloadAudio(bundle: string, paths: readonly string[]): Promise<void> {
  if (audioPreloadDisabled()) return Promise.resolve();
  const todo = paths.filter(p => !cache[key(bundle, p)]);
  if (!todo.length) return Promise.resolve();
  return loadBundle(bundle).then(b => Promise.all(todo.map(p => {
    const k = key(bundle, p);
    if (!pending[k]) pending[k] = new Promise<AudioClip | null>(ok => b.load(p, AudioClip, (err: any, clip: AudioClip) => {
      if (err || !clip) { delete pending[k]; ok(null); return; } clip.addRef(); cache[k] = clip; ok(clip);
    }));
    return pending[k];
  }))).then(() => {}, err => { try { console.warn('[QF_AUDIO_PRELOAD] ' + bundle + ' failed: ' + String(err)); } catch { /* log only */ } });
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
