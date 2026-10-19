import { rotate } from './CameraPose';
import type { CameraPose, Q4, V3 } from './CameraPose';

/**
 * 运镜bot r5: dialog camera yield (docs/r5/dialog-yield/RESULT.md).
 * While the dialog bubble (docs/r5/ui/dialog/final/IMPLEMENT.md, ui/r5-design 1f3258c7) is open on a short screen, the camera
 * pitches down about its own horizontal right axis. The lens position never moves, so lens clearance and occlusion stay exactly
 * those of the camera underneath (rays depend on positions only). On the returnFollow rig, 2.6° equals lowering the look target
 * about 0.10 m, so she sits higher in frame and the bubble keeps its 13 pt gap.
 * The amount ramps with the viewport height in pt: full at ≤ fullBelowPt, none at ≥ noneAbovePt, so 375×667 and taller screens
 * don't move at all. Open and close use a quintic retarget over `seconds`, starting from the current value and velocity, so a
 * close in mid-open stays C1 with no jump (a reversal is stretched so it never accelerates harder than a normal open). Peak angular accel is about 5.77·θ/T² ≈ 42°/s², under the §4 limit of 120.
 */
export const DIALOG_CAMERA_YIELD = Object.freeze({ pitchDeg: 2.6, fullBelowPt: 540, noneAbovePt: 640, seconds: 0.6 });

/** Pitch-down for this viewport (pt). 0 means no yield. Smoothstep ramp between the two heights. */
export function dialogYieldPitchDeg(widthPt: number, heightPt: number): number {
  const c = DIALOG_CAMERA_YIELD;
  if (!(widthPt > 0) || !(heightPt > 0)) return 0;
  let k = (c.noneAbovePt - heightPt) / (c.noneAbovePt - c.fullBelowPt);
  k = k < 0 ? 0 : k > 1 ? 1 : k;
  return c.pitchDeg * k * k * (3 - 2 * k);
}

/** Minimal dialog hook: int/v1 has no DialogBubble yet. The dialog calls this on open (true) and close (false). */
let dialogOpen = false;
export function setDialogCameraOpen(open: boolean): void { dialogOpen = !!open; }
export function dialogCameraOpen(): boolean { return dialogOpen; }

/** Yield weight 0..1 with velocity (1/s). Quintic retarget: (x0, v0, a=0) to (goal, 0, 0) over T. When the goal changes while
 *  moving (a close in mid-open), T is stretched (up to 3×) until the peak accel is no more than a full 0→1 move over `seconds`
 *  (5.77/T²), so a reversal never accelerates harder than a normal open. */
export interface YieldMotion { x: number; v: number; goal: number; x0: number; v0: number; t: number; T: number; }
export function createYieldMotion(): YieldMotion { return { x: 0, v: 0, goal: 0, x0: 0, v0: 0, t: 0, T: 0 }; }
function quinticPeakAccel(D: number, v0: number, T: number): number {
  const V = v0 * T, c3 = 10 * D - 6 * V, c4 = -15 * D + 8 * V, c5 = 6 * D - 3 * V;
  let peak = 0;
  for (let i = 0; i <= 40; i++) { const u = i / 40, a = Math.abs(6 * c3 * u + 12 * c4 * u * u + 20 * c5 * u * u * u); if (a > peak) peak = a; }
  return peak / (T * T);
}
export function stepYieldMotion(m: YieldMotion, goal: number, dt: number, seconds: number = DIALOG_CAMERA_YIELD.seconds): number {
  const base = seconds > 0 ? seconds : 1e-3;
  if (goal !== m.goal) {
    m.goal = goal; m.x0 = m.x; m.v0 = m.v; m.t = 0;
    const D = goal - m.x, cap = 5.7735 / (base * base) * 1.001;
    let T = base * Math.max(0.35, Math.sqrt(Math.abs(D)));
    while (T < 3 * base && quinticPeakAccel(D, m.v0, T) > cap) T *= 1.05;
    m.T = T;
  }
  if (!(dt > 0) || !(m.T > 0)) return m.x;
  const T = m.T;
  m.t = Math.min(T, m.t + dt);
  const u = m.t / T, D = m.goal - m.x0, V = m.v0 * T;
  const c3 = 10 * D - 6 * V, c4 = -15 * D + 8 * V, c5 = 6 * D - 3 * V;
  m.x = m.x0 + V * u + c3 * u * u * u + c4 * u * u * u * u + c5 * u * u * u * u * u;
  m.v = (V + 3 * c3 * u * u + 4 * c4 * u * u * u + 5 * c5 * u * u * u * u) / T;
  if (u >= 1) { m.x = m.goal; m.v = 0; }
  return m.x;
}

function qmul(a: Q4, b: Q4): Q4 {
  return [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
}

/** Same lens position and fov, pitched down by `deg` (roll stays 0, pitch clamped to ±85°). */
export function yieldPose(base: CameraPose, deg: number): CameraPose {
  if (!(deg !== 0)) return base;
  const f = rotate(base.rotation, [0, 0, -1]);
  const h = Math.sqrt(f[0] * f[0] + f[2] * f[2]);
  if (h < 1e-6) return base;
  const lim = 85 * Math.PI / 180;
  let pitch = Math.atan2(f[1], h) - deg * Math.PI / 180;
  pitch = pitch < -lim ? -lim : pitch > lim ? lim : pitch;
  const yaw = Math.atan2(-f[0], -f[2]);
  const qy: Q4 = [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)], qx: Q4 = [Math.sin(pitch / 2), 0, 0, Math.cos(pitch / 2)];
  const p: V3 = [base.position[0], base.position[1], base.position[2]];
  return Object.freeze({ position: p, rotation: qmul(qy, qx), fovVerticalDeg: base.fovVerticalDeg });
}
