/**
 * T9 tap subscription for the island 3D UI props (engine-free; for Voice bot A5 click sounds, T0 marks, QA).
 *
 *   const off = onPropTap((target, phase, info) => { ... });   // returns the unsubscribe fn
 *   target: 'signpost' (继续旅程 / mainline) | 'bag' (行囊) | 'book' (旅程册) | 'settings' (设置)
 *   phase:  'press'   = touch went down inside the hit area (WarmButton TOUCH_START on the same node)
 *           'confirm' = WarmButton accepted the tap (touch ended inside, not dragged away) and the handler is
 *                       about to run; fired from inside the bound action, immediately before dispatch.
 *   info.blocked: true when the host refuses the action at that moment (busy, modal/journal open, board modal,
 *                 overlay disabled). Blocked confirms run no action.
 * Fires for real touches and for T0-injected touches alike (same Cocos input path). It never plays sound and
 * never changes the action; listener exceptions are caught and logged. Also fires while the flat fallback
 * buttons are shown (props not loaded); info.props tells which look was on screen.
 */
export type PropTapTarget = 'signpost' | 'bag' | 'book' | 'settings';
export type PropTapPhase = 'press' | 'confirm';
export type PropTapInfo = Readonly<{ blocked: boolean; props: boolean }>;
export type PropTapListener = (target: PropTapTarget, phase: PropTapPhase, info: PropTapInfo) => void;
const listeners = new Set<PropTapListener>();
let propsShown = false;
export function onPropTap(fn: PropTapListener): () => void {
  if (typeof fn !== 'function') return () => {};
  listeners.add(fn); let live = true;
  return () => { if (live) { live = false; listeners.delete(fn); } };
}
export function emitPropTap(target: PropTapTarget, phase: PropTapPhase, blocked: boolean): void {
  const info: PropTapInfo = Object.freeze({ blocked: !!blocked, props: propsShown });
  for (const fn of Array.from(listeners)) { try { fn(target, phase, info); } catch (e) { console.warn('[T9_PROP_TAP] listener failed', String(e)); } }
}
/** Host bookkeeping only: whether the 3D props (not the flat fallback buttons) are on screen. */
export function setPropTapLook(props: boolean): void { propsShown = !!props; }
export function propTapListenerCount(): number { return listeners.size; }
