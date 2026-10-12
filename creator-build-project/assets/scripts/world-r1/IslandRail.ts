import { CAMERA_FIXED, createPathSampler } from './CameraPose';
import type { CameraPose, LookAtPose } from './CameraPose';
import { spanCameraKeys } from './WorldFlowCore';
import type { RouteConfig } from './WorldFlowCore';
/** Manual dolly along the outbound exit arc, only after that arc has already settled.
 * u = 1 is cameraIsland (the settled wide shot, never higher). u = 0 is span progress
 * ISLAND_PULL_NEAR: the nearest pose that still frames the lighthouse body and the door
 * in a phone portrait (~402/874) without entering the tower or the leaning palm.
 * The lamp may crop. Finger down (dy < 0) and pinch apart (scale > 1) move toward the
 * close-up, which is also lower. The doorway-speed landing sags a few centimetres; the
 * pull uses a non-decreasing height of this suffix so that sag cannot fail startup or
 * rise above the settled wide shot. Exit-arc generation, door angles and pace are not touched. */
export const ISLAND_PULL_NEAR = 0.46;
const DRAG_PER_SCREEN = 1.25;
const PINCH_GAIN = 0.85;
/** Non-decreasing height along span progress. Knots before the near pose are ignored.
 *  A later knot that falls is held at the height already reached, and nothing is allowed
 *  above the settled wide shot. Linear between knots, so every sample in between rises too. */
function pullHeight(atY: (q: number) => number, progress: readonly number[], keyY: readonly number[], capY: number): (q: number) => number {
  const qs: number[] = [], ys: number[] = [];
  let floor = -Infinity;
  const push = (q: number, y0: number) => {
    if (qs.length && !(q > qs[qs.length - 1] + 1e-9)) return;
    let y = y0;
    if (y < floor) y = floor;
    if (y > capY) y = capY;
    floor = y;
    qs.push(q);
    ys.push(y);
  };
  push(ISLAND_PULL_NEAR, atY(ISLAND_PULL_NEAR));
  for (let i = 0; i < progress.length; i++) push(progress[i], keyY[i]);
  push(1, atY(1));
  return (q: number) => {
    if (q <= qs[0]) return ys[0];
    const n = qs.length - 1;
    if (q >= qs[n]) return ys[n];
    let lo = 0, hi = n;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (qs[m] <= q) lo = m; else hi = m; }
    const span = qs[hi] - qs[lo] || 1, u = (q - qs[lo]) / span;
    return ys[lo] + (ys[hi] - ys[lo]) * u;
  };
}
export class IslandRail {
  private u = 1;
  constructor(private readonly sample: (q: number) => CameraPose) {}
  reset() { this.u = 1; }
  moved() { return this.u < 1 - 1e-4; }
  fraction() { return this.u; }
  restore(u: number) { if (Number.isFinite(u)) this.u = u < 0 ? 0 : (u > 1 ? 1 : u); }
  /** dy is a fraction of screen height (UI y grows upward). scale is the pinch ratio since the last sample. */
  nudge(dy: number, scale: number): boolean {
    const before = this.u;
    if (Number.isFinite(scale) && scale > 0 && Math.abs(scale - 1) > 1e-4) this.u -= (scale - 1) * PINCH_GAIN;
    else {
      if (!Number.isFinite(dy)) return false;
      this.u += dy * DRAG_PER_SCREEN;
    }
    if (this.u < 0) this.u = 0; else if (this.u > 1) this.u = 1;
    return this.u !== before;
  }
  pose(): CameraPose { return this.sample(ISLAND_PULL_NEAR + (1 - ISLAND_PULL_NEAR) * this.u); }
}
export function createIslandRail(config: RouteConfig): IslandRail {
  const cross = config.cameraCrossOut, to = config.cameraToIsland, settle = config.cameraSettle, crane = config.crane, walk = config.walkDuration;
  if (!cross || cross.length < 2 || !to || to.length < 2 || !settle || settle.length < 2 || !crane || !(crane.settleSeconds > 0) || !walk) throw Error('Island pull needs the outbound exit arc');
  const outS = walk(config.outCrossing), toS = walk(config.toIsland), settleS = crane.settleSeconds;
  if (!(outS > 0) || !(toS > 0)) throw Error('Island pull span timing invalid');
  const keys = spanCameraKeys([{ seconds: outS, cameras: cross }, { seconds: toS, cameras: to }, { seconds: settleS, cameras: settle }]);
  const path: LookAtPose[] = [], progress: number[] = [];
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i], p = k.progress;
    if (typeof p !== 'number' || !Number.isFinite(p)) throw Error('Island pull span key has no progress');
    if (p + 1e-6 >= ISLAND_PULL_NEAR && k.position[1] > config.cameraIsland.position[1] + 0.02) throw Error('Island pull rises above the settled wide shot');
    path.push({ position: k.position, target: k.target, fovVerticalDeg: k.fovVerticalDeg });
    progress.push(p);
  }
  const sample = createPathSampler(path, progress, { interpolation: 'pchip' });
  const fov = config.cameraIsland.fovVerticalDeg ?? 42;
  const arc = (q: number) => sample(q, fov);
  const capY = config.cameraIsland.position[1];
  const keyY: number[] = [];
  for (let i = 0; i < path.length; i++) keyY.push(path[i].position[1]);
  const heightAt = pullHeight(q => arc(q).position[1], progress, keyY, capY);
  const at = (q: number): CameraPose => {
    const raw = arc(q), y = heightAt(q);
    if (q >= 1 - 1e-9 || Math.abs(y - raw.position[1]) <= 1e-6) return raw;
    return { position: [raw.position[0], y, raw.position[2]], rotation: raw.rotation, fovVerticalDeg: raw.fovVerticalDeg };
  };
  const near = at(ISLAND_PULL_NEAR), far = at(1), ip = config.cameraIsland.position;
  if (Math.abs(far.position[0] - ip[0]) > 1e-3 || Math.abs(far.position[1] - ip[1]) > 1e-3 || Math.abs(far.position[2] - ip[2]) > 1e-3) throw Error('Island pull far pose is not the settled island camera');
  if (Math.abs(far.fovVerticalDeg - (config.cameraIsland.fovVerticalDeg ?? 42)) > 1e-3) throw Error('Island pull far fov is not the settled island camera');
  if (!(near.position[1] <= far.position[1] - 1)) throw Error('Island pull close-up is not lower than the settled wide shot');
  const fovOk = (p: CameraPose) => p.fovVerticalDeg >= CAMERA_FIXED.minFov - 1e-4 && p.fovVerticalDeg <= CAMERA_FIXED.maxFov + 1e-4;
  if (!fovOk(near) || !fovOk(far)) throw Error('Island pull fov leaves the camera contract');
  let prev = near.position[1];
  for (let s = 1; s <= 8; s++) {
    const y = at(ISLAND_PULL_NEAR + (1 - ISLAND_PULL_NEAR) * s / 8).position[1];
    if (y + 1e-3 < prev) throw Error('Island pull track is not rising toward the wide shot');
    if (y > ip[1] + 0.02) throw Error('Island pull sample rises above the settled wide shot');
    prev = y;
  }
  return new IslandRail(at);
}
