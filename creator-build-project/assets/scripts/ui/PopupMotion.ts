/** PopupKit motion constants (SPEC system-panels §4, approved 2026-10-29). Pure: no 'cc' import, unit-tested in node. */
export const OPEN_S = 0.32;
export const CLOSE_S = 0.18;
/** Opacity reaches 1 within the first 190 ms of the 320 ms enter. */
export const OPEN_ALPHA_S = 0.19;
export const PRESS_SCALE = 0.96;
export const PRESS_SINK = 3;
export const RELEASE_S = 0.12;
export const TOGGLE_S = 0.18;
/** CSS cubic-bezier(x1,y1,x2,y2) as y(x), solved with Newton + bisection fallback. */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (t: number) => number {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (u: number) => ((ax * u + bx) * u + cx) * u, sy = (u: number) => ((ay * u + by) * u + cy) * u, dx = (u: number) => (3 * ax * u + 2 * bx) * u + cx;
  return (t: number) => {
    const x = Math.max(0, Math.min(1, Number.isFinite(t) ? t : 0)); if (x === 0 || x === 1) return x;
    let u = x; for (let i = 0; i < 8; i++) { const e = sx(u) - x, d = dx(u); if (Math.abs(e) < 1e-6) return sy(u); if (Math.abs(d) < 1e-6) break; u -= e / d; }
    let lo = 0, hi = 1; u = x; for (let i = 0; i < 40; i++) { const v = sx(u); if (Math.abs(v - x) < 1e-6) break; if (v < x) lo = u; else hi = u; u = (lo + hi) / 2; }
    return sy(u);
  };
}
/** M3 emphasized decelerate (enter) / emphasized accelerate (exit). */
export const easeEnter = cubicBezier(0.05, 0.7, 0.1, 1);
export const easeExit = cubicBezier(0.3, 0, 0.8, 0.15);
export function easeOutBack(t: number, s = 1.4): number { const x = Math.max(0, Math.min(1, t)) - 1; return 1 + (s + 1) * x * x * x + s * x * x; }
export function easeOutCubic(t: number): number { return 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3); }
/** Panel state at time t (enter: t since open; exit: c = remaining close time). reduced → no scale, fade only, same durations. */
export function enterAt(t: number, reduced = false): { scale: number; alpha: number } {
  const k = easeEnter(t / OPEN_S), a = easeEnter(Math.min(1, t / OPEN_ALPHA_S));
  return { scale: reduced ? 1 : 0.92 + 0.08 * k, alpha: a };
}
export function exitAt(elapsed: number, reduced = false): { scale: number; alpha: number } {
  const k = easeExit(elapsed / CLOSE_S); return { scale: reduced ? 1 : 1 - 0.04 * k, alpha: 1 - k };
}
/** Press feedback: pressed → PRESS_SCALE at once (same frame); released → back to 1 over RELEASE_S with easeOutBack(1.4). */
export function releaseScale(sinceRelease: number): number { return PRESS_SCALE + (1 - PRESS_SCALE) * easeOutBack(sinceRelease / RELEASE_S); }
