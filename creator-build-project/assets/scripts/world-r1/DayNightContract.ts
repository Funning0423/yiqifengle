/**
 * Day/night contract for the island. Night meshes are not forced on:
 * they follow this result, and only while the exterior layer is visible.
 * Game flow state is not an input and must not be changed by the caller.
 */
export type DayNightMode = 'day' | 'night';
export interface DayNightView {
  mode: DayNightMode;
  nightRenderersEnabled: boolean;
  skyNightBlend: number;
  lightScale: number;
  lightColor: readonly [number, number, number];
}
/** Same clock as the old localNight(): before 06:00 or from 18:00. */
export function localNight(date: Date): boolean {
  const hour = date.getHours();
  return Number.isFinite(hour) && (hour < 6 || hour >= 18);
}
export function resolveDayNight(mode: DayNightMode, exteriorVisible: boolean): DayNightView {
  const night = mode === 'night';
  return {
    mode,
    nightRenderersEnabled: night && exteriorVisible,
    skyNightBlend: night ? 1 : 0,
    lightScale: night ? 0.35 : 1,
    lightColor: night ? [180, 198, 232] : [255, 255, 255],
  };
}
/** Writes nightBlend only when the material actually has that slot. Island PBR sky returns false. */
export function writeNightBlend(material: { setProperty?: (n: string, v: number) => void; passes?: any[] } | null, value: number): boolean {
  if (!material || typeof material.setProperty !== 'function') return false;
  const passes = material.passes;
  if (Array.isArray(passes) && passes.length) {
    const handle = (name: string) => passes.reduce((h: number, p: any) => h || (p && typeof p.getHandle === 'function' ? (p.getHandle(name) | 0) : 0), 0);
    if (!handle('nightBlend')) return false;
  }
  material.setProperty('nightBlend', value);
  return true;
}
/** build05-next r2: day/night change listeners (lakeside lighting re-applies its own day/night look on top of the island's).
 *  WorldFlowComponent.applyDayNight emits after it has written the island main light and the rigs' views. Listener errors are
 *  swallowed; a listener must never throw into the world. */
const dayNightListeners = new Set<(mode: DayNightMode) => void>();
export function onDayNightChange(fn: (mode: DayNightMode) => void): () => void { dayNightListeners.add(fn); return () => { dayNightListeners.delete(fn); }; }
export function emitDayNightChange(mode: DayNightMode): void { for (const fn of Array.from(dayNightListeners)) { try { fn(mode); } catch (e) { void e; } } }
