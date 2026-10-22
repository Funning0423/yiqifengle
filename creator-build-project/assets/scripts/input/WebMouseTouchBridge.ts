// H5 mouse → touch bridge (P2, report 20261023T0324 P2-1).
// Root cause: Cocos 3.8 web sets Feature.EVENT_MOUSE only when `ontouchstart` is undefined. In any browser that
// exposes touch (touch laptops, Chrome device emulation, Playwright hasTouch) the engine registers no mouse input at
// all, so mouse clicks never become Node TOUCH_* events — every handler in the game listens to TOUCH_* only.
// Fix: on web only (never under wx), when the engine has touch but no mouse, forward left-button mouse
// down/move/up on the game canvas as synthetic TouchEvents to the same canvas. The engine then emits ordinary
// TOUCH_START/MOVE/END, so all existing handlers work unchanged.
// No double fire: inactive when the engine already handles mouse; mouse events that follow a real touch
// (compat mouse events, sourceCapabilities.firesTouchEvents) are ignored; only one synthetic pointer at a time.
import { EDITOR } from 'cc/env';
import { sys } from 'cc';

export const MOUSE_TOUCH_ID = 9917;
export const COMPAT_MOUSE_WINDOW_MS = 1000;

export interface BridgeEnv {
  wx?: any; win: any; canvas: any; engineMouse: boolean; engineTouch: boolean; now?: () => number;
}
export interface BridgeHandle { active: boolean; reason: string; forwarded: number; skipped: number; dispose(): void; }

export function installMouseTouchBridge(env: BridgeEnv): BridgeHandle {
  const h: BridgeHandle = { active: false, reason: '', forwarded: 0, skipped: 0, dispose() {} };
  const win = env.win, canvas = env.canvas, now = env.now || (() => Date.now());
  if (env.wx) { h.reason = 'wx'; return h; }
  if (!win || !canvas || typeof canvas.addEventListener !== 'function') { h.reason = 'no-canvas'; return h; }
  if (env.engineMouse) { h.reason = 'engine-mouse'; return h; }
  if (!env.engineTouch) { h.reason = 'engine-no-touch'; return h; }
  if (typeof win.Touch !== 'function' || typeof win.TouchEvent !== 'function') { h.reason = 'no-touch-ctor'; return h; }
  let lastRealTouch = -Infinity, down = false;
  const onTouch = (e: any) => { if (e && e.isTrusted !== false) lastRealTouch = now(); };
  const fromTouch = (e: any) => !!(e && e.sourceCapabilities && e.sourceCapabilities.firesTouchEvents) || now() - lastRealTouch < COMPAT_MOUSE_WINDOW_MS;
  const send = (type: string, e: any) => {
    const t = new win.Touch({ identifier: MOUSE_TOUCH_ID, target: canvas, clientX: e.clientX, clientY: e.clientY,
      pageX: e.pageX, pageY: e.pageY, screenX: e.screenX, screenY: e.screenY, radiusX: 1, radiusY: 1, force: 1 });
    const live = type === 'touchend' || type === 'touchcancel' ? [] : [t];
    canvas.dispatchEvent(new win.TouchEvent(type, { bubbles: true, cancelable: true, composed: true, touches: live, targetTouches: live, changedTouches: [t] }));
    h.forwarded++;
  };
  const onDown = (e: any) => { if (e.button !== 0 || fromTouch(e)) { h.skipped++; return; } down = true; send('touchstart', e); if (e.cancelable) e.preventDefault(); };
  const onMove = (e: any) => { if (!down) return; if (fromTouch(e)) { h.skipped++; return; } send('touchmove', e); };
  const onUp = (e: any) => { if (!down) return; down = false; if (e.button !== 0 && e.type === 'mouseup') { send('touchcancel', e); return; } send('touchend', e); };
  const onBlur = () => { if (!down) return; down = false; send('touchcancel', { clientX: 0, clientY: 0, pageX: 0, pageY: 0, screenX: 0, screenY: 0 }); };
  const opts = { capture: true, passive: true };
  for (const t of ['touchstart', 'touchend', 'touchcancel']) win.addEventListener(t, onTouch, opts);
  canvas.addEventListener('mousedown', onDown, { capture: true, passive: false });
  win.addEventListener('mousemove', onMove, opts); win.addEventListener('mouseup', onUp, opts); win.addEventListener('blur', onBlur, opts);
  h.active = true; h.reason = 'mouse-to-touch';
  h.dispose = () => {
    for (const t of ['touchstart', 'touchend', 'touchcancel']) win.removeEventListener(t, onTouch, opts);
    canvas.removeEventListener('mousedown', onDown, { capture: true } as any);
    win.removeEventListener('mousemove', onMove, opts); win.removeEventListener('mouseup', onUp, opts); win.removeEventListener('blur', onBlur, opts);
    h.active = false;
  };
  return h;
}

function autoInstall() {
  const G: any = globalThis as any;
  if (G.__mouseTouchBridge) return;
  const win = typeof window !== 'undefined' ? window : null;
  const canvas = win && (win.document?.getElementById('GameCanvas') || win.document?.querySelector('canvas'));
  let engineMouse = true, engineTouch = false;
  try { engineMouse = !!sys.hasFeature(sys.Feature.EVENT_MOUSE); engineTouch = !!sys.hasFeature(sys.Feature.INPUT_TOUCH); } catch { /* keep off */ }
  G.__mouseTouchBridge = installMouseTouchBridge({ wx: G.wx, win, canvas, engineMouse, engineTouch });
}
if (!EDITOR) { try { autoInstall(); } catch (e) { console.warn('[MouseTouchBridge] install failed', e); } }
